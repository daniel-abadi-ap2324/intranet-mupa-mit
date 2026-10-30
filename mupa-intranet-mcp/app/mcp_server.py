"""El servidor MCP: las herramientas con que el asistente (o cualquier cliente MCP) averigua qué hay en la intranet.

Habla el protocolo MCP «streamable HTTP» sin sesión (stateless) y con respuesta JSON: cada llamada es una
petición POST independiente a /mcp, sin canal abierto. Así lo puede llamar con un `fetch` cualquier servicio
(la API de la intranet lo hace) y no hay estado que perder si el contenedor se reinicia.
"""

from __future__ import annotations

import json
from typing import Any

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from .config import Settings
from .search import normalize
from .services import Services

INSTRUCTIONS = (
    "Describe la intranet de la Alcaldía de Panamá: sus páginas (a dónde mandar a una persona) y los endpoints de su API "
    "(qué datos y acciones tiene cada una, quién puede usarlos). Para ayudar a alguien a encontrar algo, empieza por "
    "`search_intranet` con lo que preguntó; devuelve las páginas más probables, los endpoints que las respaldan y palabras "
    "relacionadas para reformular la pregunta. Nunca inventes una ruta: usa solo las que devuelven estas herramientas."
)


def build_mcp(services: Services, settings: Settings) -> FastMCP:
    mcp = FastMCP(
        "mupa-intranet",
        instructions=INSTRUCTIONS,
        stateless_http=True,
        json_response=True,
        # El MCP solo se llama desde la red interna de Docker: se aceptan sus nombres de host, no cualquiera.
        transport_security=TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=list(settings.allowed_hosts),
            allowed_origins=[],
        ),
    )

    @mcp.tool()
    def search_intranet(query: str, limit: int = 5, include_management: bool = False) -> dict[str, Any]:
        """Busca en la intranet lo que la persona pidió, con sus propias palabras («dónde veo mi talonario», «cita médica»).

        Devuelve `pages` (las páginas de la intranet a las que mandarla, la más probable primero), `endpoints` (lo que
        respalda a esas páginas: qué datos o acciones hay), `terms` (las palabras que se buscaron) y `expanded_terms`
        (palabras relacionadas con las que la intranet nombra eso, útiles para volver a preguntar).
        `include_management`: también pantallas y endpoints de gestión (solo para personal de Comunicación o administración).
        """
        return services.index.search(query, limit=max(1, min(limit, 20)), include_management=include_management)

    @mcp.tool()
    def find_pages(query: str, limit: int = 5) -> dict[str, Any]:
        """Páginas de la intranet que responden a la pregunta (ruta, título, para qué sirve y los endpoints que usa)."""
        return {"pages": services.index.search_pages(query, limit=max(1, min(limit, 20)))}

    @mcp.tool()
    def list_pages(include_management: bool = False) -> dict[str, Any]:
        """Todas las páginas de la intranet con su ruta, título y para qué sirven.
        `include_management`: también las pantallas de gestión (/gestion/…)."""
        pages = [p.to_dict() for p in services.index.catalog.pages if include_management or not p.roles]
        return {"count": len(pages), "pages": pages}

    @mcp.tool()
    def search_endpoints(query: str, limit: int = 8, area: str | None = None, method: str | None = None, include_management: bool = True) -> dict[str, Any]:
        """Busca endpoints de la API por lo que hacen. Filtra por `area` (p. ej. «Boletines») o `method` (GET, POST…)."""
        found = services.index.search_endpoints(query, limit=max(1, min(limit, 30)), area=area, method=method, include_management=include_management)
        return {"endpoints": found}

    @mcp.tool()
    def list_endpoints(area: str | None = None, method: str | None = None, include_management: bool = True) -> dict[str, Any]:
        """Lista los endpoints de la API (id, qué hacen, quién los puede usar y a qué página corresponden). Filtra por `area` o `method`."""
        index = services.index
        wanted = normalize(area).strip() if area else None
        endpoints = [
            e.to_dict()
            for e in index.catalog.endpoints
            if (include_management or not e.management) and (wanted is None or normalize(e.area).strip() == wanted) and (method is None or e.method == method.upper())
        ]
        return {"count": len(endpoints), "areas": index.catalog.areas(), "endpoints": endpoints}

    @mcp.tool()
    def describe_endpoint(endpoint: str) -> dict[str, Any]:
        """Describe un endpoint con todo detalle, incluido lo que recibe (parámetros, query y cuerpo como JSON Schema).
        `endpoint`: método y ruta, p. ej. «GET /api/bulletins» o «POST /api/requests»."""
        index = services.index
        found = index.catalog.endpoint(endpoint)
        if found is None:
            close = index.search_endpoints(endpoint, limit=3)
            raise ValueError(f"No existe el endpoint «{endpoint}». Se parecen: {', '.join(e['id'] for e in close) or 'ninguno'}.")
        page = index.catalog.page(found.page) if found.page else None
        return {**found.to_dict(with_request=True), "page_info": page.to_dict() if page else None}

    @mcp.tool()
    def get_confirmed_facts() -> dict[str, Any]:
        """Los datos confirmados de la intranet (teléfonos, extensiones, plazos, dónde se hace cada cosa). Solo estos se pueden dar como ciertos."""
        return {"facts": services.index.catalog.facts}

    @mcp.tool()
    async def search_content(query: str, limit: int = 5) -> dict[str, Any]:
        """Contenido concreto de la intranet que responde a la pregunta: boletines «Alcaldía al día» (por tema o fecha),
        noticias y formularios publicados. Cada uno trae `kind` (boletin, noticia, formulario), `title`, `path` (la ruta
        exacta de la intranet a la que llevar a la persona), `meta` (fecha o área) y `about` (de qué trata).
        Úsala cuando pidan «el boletín del 7 de octubre», «la noticia del reciclaje» o «el formulario de wifi».
        """
        items = await services.store.search_content(query, max(1, min(limit, 10)))
        return {"query": query, "items": items}

    @mcp.tool()
    async def search_mupa_site(query: str) -> dict[str, Any]:
        """Quién es quién en la Alcaldía: `people` son personas y oficinas del directorio telefónico de la intranet
        (nombre, dirección, extensión, ubicación) y `site` son textos públicos de mupa.gob.pa (el alcalde, el vicealcalde,
        cada director con su correo, noticias), con su `url`. Úsala cuando pregunten por una persona, una autoridad,
        un director, una extensión o algo de la Alcaldía que no está en la intranet.
        """
        found = await services.store.search_site(query)
        return {"query": query, **found}

    @mcp.tool()
    def catalog_status() -> dict[str, Any]:
        """De dónde salió el catálogo (la API o la copia de respaldo), de qué edición es y cuántos endpoints y páginas tiene."""
        return services.store.status()

    @mcp.resource("mupa://catalog/endpoints", mime_type="application/json")
    def resource_endpoints() -> str:
        """Todos los endpoints de la API, con lo que reciben."""
        return json.dumps([e.to_dict(with_request=True) for e in services.index.catalog.endpoints], ensure_ascii=False)

    @mcp.resource("mupa://catalog/pages", mime_type="application/json")
    def resource_pages() -> str:
        """Todas las páginas de la intranet."""
        return json.dumps([p.to_dict() for p in services.index.catalog.pages], ensure_ascii=False)

    @mcp.resource("mupa://catalog/facts", mime_type="application/json")
    def resource_facts() -> str:
        """Los datos confirmados."""
        return json.dumps(services.index.catalog.facts, ensure_ascii=False)

    return mcp
