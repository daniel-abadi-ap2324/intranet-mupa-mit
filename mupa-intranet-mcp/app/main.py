"""FastAPI: sirve el servidor MCP en /mcp y unas rutas REST con lo mismo, para ver y probar el catálogo sin un cliente MCP."""

from __future__ import annotations

import asyncio
import hmac
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from .catalog import CatalogStore
from .config import Settings
from .mcp_server import build_mcp
from .search import normalize
from .services import NotReady, Services

log = logging.getLogger("mupa-mcp")

#: Sin llave: lo que Docker y el balanceador preguntan para saber si el servicio vive o ya está listo.
OPEN_PATHS = frozenset({"/salud", "/listo"})


def create_app(settings: Settings | None = None, store: CatalogStore | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    store = store or CatalogStore(settings)
    services = Services(store)
    mcp = build_mcp(services, settings)
    mcp_app = mcp.streamable_http_app()  # tiene que ir antes de usar mcp.session_manager

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        # La API puede tardar en estar lista: se arranca con la copia de respaldo y se pasa a la de la API en cuanto responde.
        store.load_snapshot()
        refreshed = await store.refresh()
        log.info("Catálogo cargado de %s: %s", store.source, store.status())
        tasks = [asyncio.create_task(store.refresh_forever())]
        if not refreshed:
            tasks.append(asyncio.create_task(_retry_until_loaded(store)))
        try:
            async with mcp.session_manager.run():
                yield
        finally:
            for task in tasks:
                task.cancel()

    app = FastAPI(
        title="MCP de la intranet MUPA",
        description="Describe los endpoints y las páginas de la intranet. El protocolo MCP está en /mcp; aquí, lo mismo en REST.",
        version="1.0.0",
        lifespan=lifespan,
    )

    @app.middleware("http")
    async def require_internal_key(request: Request, call_next):
        if settings.internal_key and request.url.path not in OPEN_PATHS:
            given = request.headers.get("x-internal-key", "")
            if not hmac.compare_digest(given.encode(), settings.internal_key.encode()):
                return JSONResponse({"error": "INVALID_INTERNAL_KEY", "message": "La llave interna no es válida."}, status_code=401)
        return await call_next(request)

    @app.exception_handler(NotReady)
    async def not_ready(_: Request, exc: NotReady):
        return JSONResponse({"error": "CATALOG_NOT_READY", "message": str(exc)}, status_code=503)

    @app.get("/salud", tags=["servicio"], summary="El servicio está vivo")
    def health() -> dict[str, Any]:
        return {"ok": True, "catalog_ready": store.ready}

    @app.get("/listo", tags=["servicio"], summary="Ya tiene el catálogo")
    def ready() -> dict[str, Any]:
        if not store.ready:
            raise HTTPException(503, "El catálogo todavía no está cargado.")
        return store.status()

    @app.get("/api/status", tags=["catálogo"], summary="De dónde salió el catálogo y cuántos endpoints tiene")
    def status() -> dict[str, Any]:
        return store.status()

    @app.post("/api/refresh", tags=["catálogo"], summary="Vuelve a leer el catálogo de la API ahora")
    async def refresh() -> dict[str, Any]:
        ok = await store.refresh()
        return {"refreshed": ok, **store.status()}

    @app.get("/api/endpoints", tags=["catálogo"], summary="Lista los endpoints de la API")
    def endpoints(area: str | None = None, method: str | None = None, q: str | None = None, include_management: bool = True, limit: int = Query(200, ge=1, le=500)) -> dict[str, Any]:
        index = services.index
        if q:
            found = index.search_endpoints(q, limit=limit, area=area, method=method, include_management=include_management)
        else:
            wanted = normalize(area).strip() if area else None
            found = [
                e.to_dict()
                for e in index.catalog.endpoints
                if (include_management or not e.management) and (wanted is None or normalize(e.area).strip() == wanted) and (method is None or e.method == method.upper())
            ][:limit]
        return {"count": len(found), "areas": index.catalog.areas(), "endpoints": found}

    @app.get("/api/endpoint", tags=["catálogo"], summary="Un endpoint con todo detalle (lo que recibe, como JSON Schema)")
    def endpoint(id: str = Query(..., description="Método y ruta, p. ej. «GET /api/bulletins»")) -> dict[str, Any]:
        found = services.index.catalog.endpoint(id)
        if found is None:
            raise HTTPException(404, f"No existe el endpoint «{id}».")
        return found.to_dict(with_request=True)

    @app.get("/api/pages", tags=["catálogo"], summary="Las páginas de la intranet")
    def pages(include_management: bool = False) -> dict[str, Any]:
        listed = [p.to_dict() for p in services.index.catalog.pages if include_management or not p.roles]
        return {"count": len(listed), "pages": listed}

    @app.get("/api/search", tags=["catálogo"], summary="Busca páginas y endpoints con las palabras de la persona")
    def search(q: str = Query(..., min_length=1, max_length=300), limit: int = Query(5, ge=1, le=20), include_management: bool = False) -> dict[str, Any]:
        return services.index.search(q, limit=limit, include_management=include_management)

    @app.get("/api/facts", tags=["catálogo"], summary="Los datos confirmados")
    def facts() -> dict[str, Any]:
        return {"facts": services.index.catalog.facts}

    # Al final: lo que no coincida con una ruta de arriba lo atiende el servidor MCP (/mcp).
    app.mount("/", mcp_app)
    return app


async def _retry_until_loaded(store: CatalogStore) -> None:
    """Si al arrancar la API no respondía, se reintenta seguido (cada 5 s) hasta lograrlo una vez."""
    while not await store.refresh():
        await asyncio.sleep(5)


# uvicorn app.main:app
app = create_app()
