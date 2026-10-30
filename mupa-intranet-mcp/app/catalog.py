"""El catálogo: los endpoints y las páginas de la intranet, leídos de la API (GET /api/meta/catalog).

La API es la fuente de la verdad (sus rutas se averiguan solas del código y cada una lleva su descripción
en mupa-intranet-api/src/features/meta/endpoint-docs.ts). Aquí solo se guarda una copia en memoria, que se
renueva cada cierto tiempo; si la API no responde se sigue con la última copia buena, y al arrancar, con
catalog.snapshot.json.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

from .config import Settings

log = logging.getLogger("mupa-mcp.catalog")

#: Rutas que no son una página de la intranet que la gente abra, o cuyo título no sale de una descripción.
_PAGE_TITLES = {
    "/": "Inicio",
    "/registro": "Crear cuenta",
    "/entrar": "Entrar a la intranet",
    "/gestion": "Centro de Gestión",
}


#: Su descripción, cuando la de sus endpoints no dice para qué es la página (la API las mezcla con otras acciones).
_PAGE_ABOUT = {
    "/": "La página principal: saludo, búsqueda, accesos rápidos, noticias, boletines y trámites frecuentes. Cada persona puede personalizarla.",
    "/entrar": "Entrar a la intranet con el usuario y la contraseña.",
    "/registro": "Crear una cuenta con la cédula; el correo se confirma con un código.",
    "/gestion": "Centro de Gestión: cifras y bandeja de solicitudes, para el personal de gestión.",
}


@dataclass(frozen=True)
class Endpoint:
    id: str
    method: str
    path: str
    area: str
    summary: str
    access_level: str
    roles: tuple[str, ...]
    access: str
    page: str | None
    keywords: tuple[str, ...]
    request: dict[str, Any]

    @property
    def management(self) -> bool:
        """Lo usa personal de gestión (pide un rol), no cualquier persona."""
        return self.access_level == "roles"

    def to_dict(self, *, with_request: bool = False) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": self.id,
            "method": self.method,
            "path": self.path,
            "area": self.area,
            "summary": self.summary,
            "access": self.access,
            "access_level": self.access_level,
            "roles": list(self.roles),
            "page": self.page,
            "keywords": list(self.keywords),
        }
        if with_request:
            out["request"] = self.request
        return out


@dataclass(frozen=True)
class Page:
    path: str
    title: str
    about: str
    #: true si el título y la descripción se armaron aquí (la API no la tiene entre las páginas del asistente):
    #: son las pantallas de gestión (/gestion/…) y las de entrar o registrarse.
    derived: bool = False
    #: Endpoints que sirven a esta página.
    endpoint_ids: tuple[str, ...] = ()
    #: Roles que hacen falta para usarla (vacío = cualquiera).
    roles: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "title": self.title,
            "about": self.about,
            "derived": self.derived,
            "endpoints": list(self.endpoint_ids),
            "roles": list(self.roles),
        }


@dataclass
class Catalog:
    version: int = 1
    generated_at: str = ""
    edition: str = ""
    endpoints: list[Endpoint] = field(default_factory=list)
    pages: list[Page] = field(default_factory=list)
    facts: list[str] = field(default_factory=list)

    def endpoint(self, endpoint_id: str) -> Endpoint | None:
        wanted = " ".join(endpoint_id.split())
        for e in self.endpoints:
            if e.id == wanted:
                return e
        # «get /api/news» también vale.
        method, _, path = wanted.partition(" ")
        for e in self.endpoints:
            if e.method == method.upper() and e.path == path:
                return e
        return None

    def page(self, path: str) -> Page | None:
        return next((p for p in self.pages if p.path == path), None)

    def areas(self) -> list[str]:
        return sorted({e.area for e in self.endpoints})


def parse_catalog(raw: dict[str, Any]) -> Catalog:
    """Arma el catálogo desde el JSON de la API y le agrega las páginas que solo salen de los endpoints."""
    endpoints = [
        Endpoint(
            id=e["id"],
            method=e["method"],
            path=e["path"],
            area=e.get("area") or "Sin área",
            summary=e.get("summary") or "(sin descripción)",
            access_level=e.get("accessLevel", "open"),
            roles=tuple(e.get("roles") or ()),
            access=e.get("access") or "Cualquiera",
            page=e.get("page"),
            keywords=tuple(e.get("keywords") or ()),
            request=e.get("request") or {},
        )
        for e in raw.get("endpoints", [])
    ]
    by_page: dict[str, list[Endpoint]] = {}
    for e in endpoints:
        if e.page:
            by_page.setdefault(e.page, []).append(e)

    pages: list[Page] = []
    known: set[str] = set()
    for p in raw.get("pages", []):
        known.add(p["path"])
        linked = by_page.get(p["path"], [])
        pages.append(Page(path=p["path"], title=p["title"], about=p["about"], endpoint_ids=tuple(e.id for e in linked), roles=_roles_of(linked)))

    # Páginas que la API nombra en sus endpoints pero no están entre las del asistente (gestión, entrar…).
    for path, linked in sorted(by_page.items()):
        if path in known:
            continue
        # El área de la pantalla es la que más endpoints le sirven (/gestion/boletines: los de Boletines; subir un PDF es solo uno).
        area = Counter(e.area for e in linked).most_common(1)[0][0]
        title = _PAGE_TITLES.get(path) or f"Gestión · {area}"
        main_first = sorted(linked, key=lambda e: e.area != area)
        about = _PAGE_ABOUT.get(path) or " ".join(dict.fromkeys(e.summary for e in main_first[:2]))
        pages.append(Page(path=path, title=title, about=about, derived=True, endpoint_ids=tuple(e.id for e in linked), roles=_roles_of(linked)))

    return Catalog(
        version=int(raw.get("version", 1)),
        generated_at=str(raw.get("generatedAt", "")),
        edition=str(raw.get("edition", "")),
        endpoints=endpoints,
        pages=pages,
        facts=list(raw.get("facts") or []),
    )


def _roles_of(endpoints: list[Endpoint]) -> tuple[str, ...]:
    """Una página es de gestión solo si TODOS sus endpoints piden rol; entonces, los roles que alcanzan para alguno."""
    if not endpoints or not all(e.management for e in endpoints):
        return ()
    return tuple(sorted({r for e in endpoints for r in e.roles}))


class CatalogStore:
    """Guarda el catálogo y lo renueva. Un fallo al leer la API nunca borra lo que ya hay."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None) -> None:
        self.settings = settings
        self._client = client
        self.catalog = Catalog()
        self.source = "vacío"
        self.loaded_at: float | None = None
        self.last_error: str | None = None

    @property
    def ready(self) -> bool:
        return bool(self.catalog.endpoints)

    def status(self) -> dict[str, Any]:
        return {
            "ready": self.ready,
            "source": self.source,
            "edition": self.catalog.edition,
            "generated_at": self.catalog.generated_at,
            "loaded_seconds_ago": None if self.loaded_at is None else round(time.time() - self.loaded_at),
            "endpoints": len(self.catalog.endpoints),
            "pages": len(self.catalog.pages),
            "last_error": self.last_error,
        }

    def load_snapshot(self) -> bool:
        """La copia de respaldo (la que viene en la imagen). Solo se usa si todavía no hay nada."""
        path = Path(self.settings.snapshot_file)
        if not path.is_file():
            return False
        try:
            self.catalog = parse_catalog(json.loads(path.read_text(encoding="utf-8")))
        except (OSError, ValueError, KeyError) as exc:
            log.warning("No se pudo leer la copia de respaldo %s: %s", path, exc)
            return False
        self.source = "copia de respaldo"
        self.loaded_at = time.time()
        return True

    async def search_content(self, query: str, limit: int) -> list[dict[str, Any]]:
        """Boletines, noticias y formularios publicados que coinciden con la pregunta (GET /api/meta/content de la API).

        A diferencia del catálogo, esto se pregunta en vivo: el contenido cambia todo el día. Si la API no responde, lanza.
        """
        headers = {"X-Internal-Key": self.settings.internal_key} if self.settings.internal_key else {}
        own = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self.settings.request_timeout)
        try:
            res = await client.get(f"{self.settings.backend_url}/api/meta/content", params={"q": query, "limit": limit}, headers=headers)
            res.raise_for_status()
            return list(res.json().get("items", []))
        finally:
            if own:
                await client.aclose()

    async def search_site(self, query: str) -> dict[str, Any]:
        """Personas del directorio y textos de mupa.gob.pa que coinciden con la pregunta (GET /api/meta/site-search).

        En vivo, como search_content: la API lee el sitio y el directorio. Si la API no responde, lanza.
        """
        headers = {"X-Internal-Key": self.settings.internal_key} if self.settings.internal_key else {}
        own = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self.settings.request_timeout)
        try:
            res = await client.get(f"{self.settings.backend_url}/api/meta/site-search", params={"q": query}, headers=headers)
            res.raise_for_status()
            data = res.json()
            return {"people": list(data.get("people", [])), "site": list(data.get("site", []))}
        finally:
            if own:
                await client.aclose()

    async def refresh(self) -> bool:
        """Lee el catálogo de la API. True si lo logró."""
        headers = {"X-Internal-Key": self.settings.internal_key} if self.settings.internal_key else {}
        own = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self.settings.request_timeout)
        try:
            res = await client.get(f"{self.settings.backend_url}/api/meta/catalog", headers=headers)
            res.raise_for_status()
            catalog = parse_catalog(res.json())
            if not catalog.endpoints:
                raise ValueError("la API devolvió un catálogo sin endpoints")
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"
            log.warning("No se pudo leer el catálogo de la API (%s): %s", self.settings.backend_url, self.last_error)
            return False
        finally:
            if own:
                await client.aclose()
        self.catalog = catalog
        self.source = "API"
        self.loaded_at = time.time()
        self.last_error = None
        return True

    async def refresh_forever(self) -> None:
        while True:
            await asyncio.sleep(self.settings.refresh_seconds)
            await self.refresh()
