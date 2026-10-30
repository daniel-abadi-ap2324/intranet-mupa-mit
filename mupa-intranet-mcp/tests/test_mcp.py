"""El protocolo MCP en /mcp: como lo llama la API (un POST JSON-RPC suelto) y con el cliente oficial."""

from __future__ import annotations

import asyncio
import json

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

from tests.conftest import KEY

HEADERS = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}


def rpc(client, method: str, params: dict | None = None, *, headers: dict | None = None):
    body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}
    return client.post("/mcp", json=body, headers={**HEADERS, **(headers or {})})


def call(client, name: str, **arguments):
    """Lo que hace la API: una sola llamada a la herramienta, sin initialize ni sesión."""
    res = rpc(client, "tools/call", {"name": name, "arguments": arguments})
    assert res.status_code == 200, res.text
    return res.json()["result"]


def test_post_suelto_sin_initialize_ni_sesion(service):
    client, _ = service
    result = call(client, "search_intranet", query="dónde veo mi talonario", limit=3)
    assert result["isError"] is False
    data = result["structuredContent"]
    assert data["pages"][0]["path"] == "/recursos-humanos?seccion=comprobantes"
    # También viene como texto (los clientes sin salida estructurada lo leen de ahí).
    assert json.loads(result["content"][0]["text"])["pages"][0]["path"] == data["pages"][0]["path"]


def test_sin_llave_no_entra(service):
    client, _ = service
    res = rpc(client, "tools/list", headers={"X-Internal-Key": "otra"})
    assert res.status_code == 401


def test_las_herramientas_que_ofrece(service):
    client, _ = service
    tools = {t["name"]: t for t in rpc(client, "tools/list").json()["result"]["tools"]}
    assert set(tools) == {"search_content", "search_intranet", "find_pages", "list_pages", "search_endpoints", "list_endpoints", "describe_endpoint", "get_confirmed_facts", "catalog_status", "search_mupa_site"}
    # Cada una se explica sola, en español, para que el modelo sepa cuándo usarla.
    assert all(t["description"] for t in tools.values())
    assert "talonario" in tools["search_intranet"]["description"]


def test_describe_endpoint_con_lo_que_recibe(service):
    client, _ = service
    data = call(client, "describe_endpoint", endpoint="POST /api/bulletins")["structuredContent"]
    assert data["roles"] == ["admin", "comunicacion"] and data["page"] == "/gestion/boletines"
    assert {"date", "pdfUrl"} <= set(data["request"]["body"]["properties"])
    assert data["page_info"]["title"] == "Gestión · Boletines"


def test_endpoint_que_no_existe_da_error_con_sugerencias(service):
    client, _ = service
    result = call(client, "describe_endpoint", endpoint="GET /api/boletines")
    assert result["isError"] is True
    assert "GET /api/bulletins" in result["content"][0]["text"]


def test_listas_y_datos_confirmados(service):
    client, _ = service
    por_area = call(client, "list_endpoints", area="Noticias", include_management=False)["structuredContent"]
    assert {e["id"] for e in por_area["endpoints"]} == {"GET /api/news", "GET /api/news/:id"}
    assert "Noticias" in por_area["areas"]
    paginas = call(client, "list_pages")["structuredContent"]
    assert paginas["count"] > 15 and not any(p["path"].startswith("/gestion") for p in paginas["pages"])
    assert any("1400" in f for f in call(client, "get_confirmed_facts")["structuredContent"]["facts"])
    assert call(client, "catalog_status")["structuredContent"]["source"] == "API"


def test_search_content_pregunta_a_la_api_con_la_llave(service, backend):
    client, _ = service
    data = call(client, "search_content", query="boletín del reciclaje", limit=3)["structuredContent"]
    assert data["items"][0]["path"] == "/boletines/12" and data["items"][0]["kind"] == "boletin"
    assert backend.content_queries == ["boletín del reciclaje"]


def test_recursos(service):
    client, _ = service
    names = {r["uri"] for r in rpc(client, "resources/list").json()["result"]["resources"]}
    assert names == {"mupa://catalog/endpoints", "mupa://catalog/pages", "mupa://catalog/facts"}
    contents = rpc(client, "resources/read", {"uri": "mupa://catalog/pages"}).json()["result"]["contents"]
    assert any(p["path"] == "/boletines" for p in json.loads(contents[0]["text"]))


def test_host_desconocido_se_rechaza(service):
    client, _ = service
    res = rpc(client, "tools/list", headers={"Host": "intruso.example.com"})
    assert res.status_code in (400, 421)


def test_con_el_cliente_oficial_de_mcp(live_url):
    async def sesion():
        async with streamablehttp_client(f"{live_url}/mcp", headers={"X-Internal-Key": KEY}) as (read, write, _):
            async with ClientSession(read, write) as session:
                init = await session.initialize()
                tools = await session.list_tools()
                result = await session.call_tool("find_pages", {"query": "marcaciones"})
                return init, tools, result

    init, tools, result = asyncio.run(sesion())
    assert init.serverInfo.name == "mupa-intranet"
    assert "search_intranet" in {t.name for t in tools.tools}
    assert result.isError is False
    assert result.structuredContent["pages"][0]["path"] == "/recursos-humanos?seccion=marcaciones"
