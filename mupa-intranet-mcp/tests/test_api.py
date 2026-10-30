"""Las rutas REST del servicio: la llave, el estado y la consulta del catálogo."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.catalog import CatalogStore
from app.main import create_app
from tests.conftest import KEY, make_settings


def test_salud_y_listo_no_piden_llave_y_lo_demas_si(service):
    client, _ = service
    sin_llave = TestClient(client.app, base_url="http://mcp:8000")
    assert sin_llave.get("/salud").json() == {"ok": True, "catalog_ready": True}
    assert sin_llave.get("/listo").status_code == 200
    for ruta in ("/api/status", "/api/endpoints", "/api/pages", "/api/search?q=hola", "/docs"):
        assert sin_llave.get(ruta).status_code == 401, ruta
    assert sin_llave.get("/api/status", headers={"X-Internal-Key": "otra"}).status_code == 401
    assert client.get("/api/status").status_code == 200


def test_estado_dice_de_donde_salio_el_catalogo(service):
    client, _ = service
    data = client.get("/api/status").json()
    assert data["ready"] and data["source"] == "API" and data["edition"] == "completa"
    assert data["endpoints"] > 80 and data["pages"] > 20 and data["last_error"] is None


def test_lista_endpoints_con_filtros(service):
    client, _ = service
    todos = client.get("/api/endpoints").json()
    assert todos["count"] > 80 and "Boletines" in todos["areas"]
    boletines = client.get("/api/endpoints", params={"area": "boletines"}).json()
    assert {e["id"] for e in boletines["endpoints"]} == {"GET /api/bulletins", "GET /api/bulletins/manage", "POST /api/bulletins", "PATCH /api/bulletins/:id", "DELETE /api/bulletins/:id"}
    posts = client.get("/api/endpoints", params={"area": "boletines", "method": "post"}).json()
    assert [e["id"] for e in posts["endpoints"]] == ["POST /api/bulletins"]
    sin_gestion = client.get("/api/endpoints", params={"include_management": "false"}).json()
    assert 0 < sin_gestion["count"] < todos["count"] and all(e["access_level"] != "roles" for e in sin_gestion["endpoints"])
    assert client.get("/api/endpoints", params={"q": "talonario"}).json()["endpoints"][0]["id"] == "GET /api/rrhh/comprobantes"


def test_un_endpoint_con_lo_que_recibe(service):
    client, _ = service
    e = client.get("/api/endpoint", params={"id": "GET /api/bulletins"}).json()
    assert e["page"] == "/boletines" and list(e["request"]["query"]["properties"]) == ["q"]
    assert client.get("/api/endpoint", params={"id": "GET /api/no-existe"}).status_code == 404


def test_paginas_busqueda_y_datos(service):
    client, _ = service
    paginas = client.get("/api/pages").json()
    assert not any(p["path"].startswith("/gestion") for p in paginas["pages"])
    assert any(p["path"].startswith("/gestion") for p in client.get("/api/pages", params={"include_management": "true"}).json()["pages"])
    buscado = client.get("/api/search", params={"q": "cita médica"}).json()
    assert buscado["pages"][0]["path"] == "/clinica"
    assert client.get("/api/search", params={"q": ""}).status_code == 422
    assert any("1400" in f for f in client.get("/api/facts").json()["facts"])


def test_refrescar_vuelve_a_leer_la_api(service, backend):
    client, _ = service
    llamadas = backend.calls
    out = client.post("/api/refresh").json()
    assert out["refreshed"] is True and backend.calls == llamadas + 1


def test_si_cambia_el_catalogo_la_busqueda_lo_ve(service, backend):
    client, _ = service
    backend.catalog = {**backend.catalog, "pages": backend.catalog["pages"] + [{"path": "/biblioteca", "title": "Biblioteca digital", "about": "Libros y revistas en línea."}]}
    assert client.get("/api/search", params={"q": "biblioteca"}).json()["pages"] == []
    client.post("/api/refresh")
    assert client.get("/api/search", params={"q": "biblioteca"}).json()["pages"][0]["path"] == "/biblioteca"


def test_sin_catalogo_responde_503_y_listo_lo_dice(backend, tmp_path):
    backend.fail = True
    settings = make_settings(tmp_path)
    store = CatalogStore(settings, client=backend.client())
    with TestClient(create_app(settings, store), headers={"X-Internal-Key": KEY}, base_url="http://mcp:8000") as client:
        assert client.get("/salud").json() == {"ok": True, "catalog_ready": False}
        assert client.get("/listo").status_code == 503
        out = client.get("/api/search", params={"q": "hola"})
        assert out.status_code == 503 and out.json()["error"] == "CATALOG_NOT_READY"
