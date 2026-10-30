"""Fixtures: la API falsa (sirve el catálogo real exportado, con su llave) y el servicio MCP en memoria o en un puerto."""

from __future__ import annotations

import json
import socket
import threading
import time
from pathlib import Path

import httpx
import pytest
import uvicorn
from fastapi import FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

from app.catalog import CatalogStore, parse_catalog
from app.config import Settings
from app.main import create_app
from app.search import SearchIndex

KEY = "llave-interna-de-prueba-1234"
SNAPSHOT = Path(__file__).resolve().parent.parent / "catalog.snapshot.json"


@pytest.fixture(scope="session")
def raw_catalog() -> dict:
    """El catálogo REAL de la API (`npm run catalogo:exportar`): así las pruebas ven los endpoints y páginas de verdad."""
    return json.loads(SNAPSHOT.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def index(raw_catalog) -> SearchIndex:
    return SearchIndex(parse_catalog(raw_catalog))


class FakeBackend:
    """La API de la intranet, solo con GET /api/meta/catalog (y su llave)."""

    def __init__(self, catalog: dict) -> None:
        self.catalog = catalog
        self.fail = False
        self.calls = 0
        self.keys: list[str | None] = []
        self.content_queries: list[str] = []
        self.app = FastAPI()

        @self.app.get("/api/meta/catalog")
        def catalog_route(x_internal_key: str | None = Header(default=None)):
            self.calls += 1
            self.keys.append(x_internal_key)
            if self.fail:
                raise HTTPException(503, "caída")
            if x_internal_key != KEY:
                raise HTTPException(401, "llave")
            return self.catalog

        @self.app.get("/api/meta/content")
        def content_route(q: str, limit: int = 5, x_internal_key: str | None = Header(default=None)):
            if x_internal_key != KEY:
                raise HTTPException(401, "llave")
            self.content_queries.append(q)
            return {"items": [{"id": "b12", "kind": "boletin", "title": "Boletín del 7 de octubre de 2026", "path": "/boletines/12", "meta": "Alcaldía al día", "about": "Plan de reciclaje"}][:limit]}

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://api")


@pytest.fixture()
def backend(raw_catalog) -> FakeBackend:
    return FakeBackend(raw_catalog)


def make_settings(tmp_path: Path | None = None, **over) -> Settings:
    base = dict(backend_url="http://api", internal_key=KEY, refresh_seconds=3600, request_timeout=2, snapshot_file=str(tmp_path / "no-hay.json") if tmp_path else "no-hay.json")
    base.update(over)
    return Settings(**base)


@pytest.fixture()
def service(backend, tmp_path):
    """El servicio completo en memoria (con su ciclo de vida), leyendo el catálogo de la API falsa."""
    settings = make_settings(tmp_path)
    store = CatalogStore(settings, client=backend.client())
    app = create_app(settings, store)
    with TestClient(app, headers={"X-Internal-Key": KEY}, base_url="http://mcp:8000") as client:
        yield client, store


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture()
def live_url(backend, tmp_path):
    """El servicio en un puerto de verdad, para probarlo con el cliente oficial de MCP."""
    settings = make_settings(tmp_path)
    store = CatalogStore(settings, client=backend.client())
    port = _free_port()
    server = uvicorn.Server(uvicorn.Config(create_app(settings, store), host="127.0.0.1", port=port, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    for _ in range(100):
        if server.started:
            break
        time.sleep(0.05)
    assert server.started, "el servicio no arrancó"
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(timeout=5)
