"""El catálogo: se lee de la API con la llave, se renueva y nunca se pierde lo que ya había."""

from __future__ import annotations

import asyncio
import json

from app.catalog import CatalogStore, parse_catalog
from tests.conftest import KEY, make_settings


def run(coro):
    return asyncio.run(coro)


def test_lee_el_catalogo_de_la_api_con_la_llave(backend, tmp_path):
    store = CatalogStore(make_settings(tmp_path), client=backend.client())
    assert run(store.refresh()) is True
    assert store.source == "API" and store.ready and store.last_error is None
    assert backend.keys == [KEY]
    assert len(store.catalog.endpoints) == len(backend.catalog["endpoints"])


def test_sin_llave_o_con_otra_la_api_lo_rechaza_y_no_se_carga_nada(backend, tmp_path):
    store = CatalogStore(make_settings(tmp_path, internal_key="otra"), client=backend.client())
    assert run(store.refresh()) is False
    assert not store.ready and "401" in store.last_error


def test_si_la_api_cae_se_conserva_lo_ultimo_que_funciono(backend, tmp_path):
    store = CatalogStore(make_settings(tmp_path), client=backend.client())
    assert run(store.refresh())
    antes = store.catalog
    backend.fail = True
    assert run(store.refresh()) is False
    assert store.catalog is antes and store.ready
    assert "503" in store.last_error
    backend.fail = False
    assert run(store.refresh()) is True and store.last_error is None


def test_un_catalogo_vacio_no_pisa_el_bueno(backend, tmp_path):
    store = CatalogStore(make_settings(tmp_path), client=backend.client())
    run(store.refresh())
    antes = store.catalog
    backend.catalog = {**backend.catalog, "endpoints": []}
    assert run(store.refresh()) is False
    assert store.catalog is antes


def test_la_copia_de_respaldo_sirve_mientras_la_api_no_responde(backend, tmp_path):
    snapshot = tmp_path / "catalog.snapshot.json"
    snapshot.write_text(json.dumps(backend.catalog), encoding="utf-8")
    store = CatalogStore(make_settings(tmp_path, snapshot_file=str(snapshot)), client=backend.client())
    assert store.load_snapshot() and store.source == "copia de respaldo" and store.ready


def test_copia_de_respaldo_rota_o_ausente_no_tumba_nada(backend, tmp_path):
    roto = tmp_path / "roto.json"
    roto.write_text("{no es json", encoding="utf-8")
    assert not CatalogStore(make_settings(tmp_path, snapshot_file=str(roto))).load_snapshot()
    assert not CatalogStore(make_settings(tmp_path, snapshot_file=str(tmp_path / "no-existe.json"))).load_snapshot()


def test_parse_arma_las_paginas_de_gestion_y_enlaza_endpoints(raw_catalog):
    catalog = parse_catalog(raw_catalog)
    gestion = catalog.page("/gestion/boletines")
    assert gestion and gestion.derived and gestion.title == "Gestión · Boletines" and "POST /api/bulletins" in gestion.endpoint_ids
    # Las páginas del asistente conservan su título y descripción tal cual.
    marcaciones = catalog.page("/recursos-humanos?seccion=marcaciones")
    assert marcaciones and not marcaciones.derived and marcaciones.title == "Mis marcaciones"
    assert catalog.endpoint("get /api/news") is None or catalog.endpoint("GET /api/news")
    assert catalog.endpoint("GET /api/bulletins").method == "GET"
    assert catalog.endpoint("nada") is None
    assert "Boletines" in catalog.areas()
