"""La búsqueda en español: con preguntas como las haría el personal, sobre el catálogo real de la API."""

from __future__ import annotations

import pytest

from app.search import normalize, stem, tokenize

COMPROBANTES = "/recursos-humanos?seccion=comprobantes"


def top_page(index, query: str) -> str | None:
    pages = index.search(query)["pages"]
    return pages[0]["path"] if pages else None


def test_normalize_y_plurales():
    assert normalize("Comprobantes de PAGO ¡Ñandú!") == "comprobantes de pago ¡nandu!"
    assert stem("marcaciones") == "marcacion" and stem("comprobantes") == "comprobante" and stem("pago") == "pago"
    # Quita lo que no distingue nada («donde», «mi», «de») y deja lo que sí.
    assert tokenize("¿Dónde veo mi talonario de pago?") == ["talonario", "pago"]


@pytest.mark.parametrize(
    ("pregunta", "pagina"),
    [
        ("dónde veo mi talonario de pago", COMPROBANTES),
        ("quiero ver mi salario", COMPROBANTES),
        ("mis marcaciones y tardanzas", "/recursos-humanos?seccion=marcaciones"),
        ("cuánto tiempo compensatorio tengo", "/recursos-humanos?seccion=compensatorio"),
        ("necesito una cita médica", "/clinica"),
        ("boletines de reciclaje", "/boletines"),
        ("noticias de la alcaldía", "/noticias"),
        ("directorio extensión telefónica", "/directorio"),
        ("enviar una solicitud", "/formularios"),
        ("estado de mi solicitud", "/mis-solicitudes"),
        ("expediente datos personales dependientes", "/recursos-humanos?seccion=expediente"),
        ("videos instructivos", "/videos"),
    ],
)
def test_manda_a_la_pagina_correcta(index, pregunta, pagina):
    assert top_page(index, pregunta) == pagina


def test_no_importan_tildes_ni_mayusculas(index):
    a = index.search("DÓNDE VEO MI TALONARIO")
    b = index.search("donde veo mi talonario")
    assert [p["path"] for p in a["pages"]] == [p["path"] for p in b["pages"]]


def test_una_palabra_a_medias_tambien_encuentra(index):
    assert top_page(index, "marcac") == "/recursos-humanos?seccion=marcaciones"


def test_lo_que_no_tiene_que_ver_no_devuelve_nada(index):
    out = index.search("pizza con pepperoni")
    assert out["pages"] == [] and out["endpoints"] == []


def test_pantallas_de_gestion_solo_si_se_piden(index):
    por_defecto = index.search("publicar una noticia")
    assert not any(p["path"].startswith("/gestion") for p in por_defecto["pages"])
    assert not any(e["access_level"] == "roles" for e in por_defecto["endpoints"])

    gestion = index.search("publicar una noticia", include_management=True)
    assert "/gestion/noticias" in [p["path"] for p in gestion["pages"]]
    assert any(e["id"] == "POST /api/news" for e in gestion["endpoints"])


def test_los_endpoints_que_respaldan_la_pagina_vienen_con_ella(index):
    out = index.search("talonario")
    assert out["pages"][0]["endpoints"] and "GET /api/rrhh/comprobantes" in out["pages"][0]["endpoints"]
    assert out["endpoints"][0]["id"] == "GET /api/rrhh/comprobantes"
    assert out["endpoints"][0]["page"] == COMPROBANTES


def test_palabras_relacionadas_para_volver_a_preguntar(index):
    out = index.search("talonario")
    # Las palabras con que la intranet lo nombra, sin repetir la que la persona ya escribió.
    assert "comprobante de pago" in out["expanded_terms"]
    assert "talonario" not in out["expanded_terms"]


def test_buscar_endpoints_filtra_por_area_y_metodo(index):
    found = index.search_endpoints("boletín", area="boletines", method="post")
    assert [e["id"] for e in found] == ["POST /api/bulletins"]
    assert {e["method"] for e in index.search_endpoints("boletín")} >= {"GET", "POST"}


def test_toda_pagina_de_gestion_pide_roles_y_las_demas_no(index):
    paginas = {p.path: p for p in index.catalog.pages}
    assert paginas["/gestion/noticias"].derived and paginas["/gestion/noticias"].roles == ("admin", "comunicacion")
    assert paginas["/boletines"].roles == () and not paginas["/boletines"].derived
    assert paginas["/recursos-humanos?seccion=marcaciones"].roles == ()


def test_las_paginas_derivadas_tienen_titulo(index):
    for p in index.catalog.pages:
        assert p.title and p.about, p.path
