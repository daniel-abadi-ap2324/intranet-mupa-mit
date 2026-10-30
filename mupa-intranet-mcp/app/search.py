"""Búsqueda en español sobre el catálogo: sin tildes ni mayúsculas, con plurales y con palabras relacionadas.

No usa un modelo: puntúa coincidencias de palabras con pesos (palabras clave > resumen > ruta). Además devuelve
las palabras clave de lo que encontró que la persona no escribió (`expanded_terms`): sirven para volver a
preguntar con las palabras con que la intranet nombra las cosas («talonario» ↔ «comprobante de pago»).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

from .catalog import Catalog, Endpoint, Page

STOPWORDS = frozenset(
    """
    a al algo alguien ante aqui asi aun bajo cada como con cual cuando cuanto de del desde donde el ella ellos en entre
    era eres es esa ese eso esta este esto esos estoy fue ha hay hasta la las le les lo los me mi mis mucho muy nada
    ni no nos o os otra otro para pero por porque que quien se si sin sobre soy su sus te tengo ti tu tus un una uno
    unos unas usted ustedes va ver veo voy y ya yo quiero necesito puedo puede pueden donde como hacer hago busco
    encuentro encontrar saber sacar pedir dar hay tener tienen
    alcaldia mupa municipio panama intranet
    """.split()
)

_WORD = re.compile(r"[a-z0-9]+")


def normalize(text: str) -> str:
    """Minúsculas y sin tildes: «Comprobantes de Pago» → «comprobantes de pago»."""
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).lower()


def stem(word: str) -> str:
    """Quita el plural: «marcaciones» → «marcacion», «comprobantes» → «comprobante», «tardanzas» → «tardanza»."""
    if len(word) > 5 and word.endswith("ones"):
        return word[:-2]
    if len(word) > 3 and word.endswith("s"):
        return word[:-1]
    return word


def tokenize(text: str) -> list[str]:
    return [stem(w) for w in _WORD.findall(normalize(text)) if len(w) > 1 and w not in STOPWORDS]


def _matches(query_token: str, doc_token: str) -> bool:
    if query_token == doc_token:
        return True
    # Prefijos solo con palabras de cuatro letras o más: «marcac» encuentra «marcacion», pero «de» no encuentra «departamento».
    return (len(query_token) >= 4 and doc_token.startswith(query_token)) or (len(doc_token) >= 4 and query_token.startswith(doc_token))


@dataclass
class _Doc:
    """Un endpoint o una página, con las palabras en que se puede encontrar y cuánto pesa cada una."""

    weights: dict[str, float] = field(default_factory=dict)
    phrases: list[str] = field(default_factory=list)  # palabras clave enteras, normalizadas
    keywords: tuple[str, ...] = ()

    def add(self, text: str, weight: float) -> None:
        for token in tokenize(text):
            if self.weights.get(token, 0) < weight:
                self.weights[token] = weight

    def score(self, query_tokens: list[str], query_text: str) -> tuple[float, list[str]]:
        total = 0.0
        matched: list[str] = []
        for q in query_tokens:
            best = max((w for t, w in self.weights.items() if _matches(q, t)), default=0.0)
            if best:
                total += best
                matched.append(q)
        if not matched:
            return 0.0, []
        if len(matched) == len(query_tokens):
            total *= 1.5  # trae todas las palabras
        if len(query_text) >= 4 and any(query_text in p for p in self.phrases):
            total += 6  # la frase entera es una palabra clave
        return total, matched


def _endpoint_doc(e: Endpoint, page: Page | None) -> _Doc:
    doc = _Doc(keywords=e.keywords)
    for kw in e.keywords:
        doc.add(kw, 5)
        doc.phrases.append(normalize(kw))
    doc.add(e.summary, 3)
    doc.add(e.area, 2)
    doc.add(e.path.replace("/api/", "").replace("/", " ").replace(":", " "), 1.5)
    if page:
        doc.add(page.title, 2)
    return doc


def _page_doc(p: Page, linked: list[Endpoint]) -> _Doc:
    doc = _Doc()
    doc.add(p.title, 6)
    doc.add(p.about, 3)
    # Las palabras con que se piden sus endpoints también encuentran la página («talonario» → Comprobantes de pago).
    for e in linked:
        for kw in e.keywords:
            doc.add(kw, 4)
            doc.phrases.append(normalize(kw))
        doc.add(e.summary, 1.5)
    doc.keywords = tuple(dict.fromkeys(kw for e in linked for kw in e.keywords))
    return doc


class SearchIndex:
    """Índice en memoria del catálogo. Se reconstruye cuando el catálogo cambia (`build`)."""

    def __init__(self, catalog: Catalog) -> None:
        self.catalog = catalog
        self._pages_by_path = {p.path: p for p in catalog.pages}
        self._endpoints_by_id = {e.id: e for e in catalog.endpoints}
        self._endpoint_docs = {e.id: _endpoint_doc(e, self._pages_by_path.get(e.page or "")) for e in catalog.endpoints}
        self._page_docs = {p.path: _page_doc(p, [self._endpoints_by_id[i] for i in p.endpoint_ids if i in self._endpoints_by_id]) for p in catalog.pages}

    # ---- búsquedas ----

    def search_endpoints(self, query: str, *, limit: int = 8, include_management: bool = True, area: str | None = None, method: str | None = None) -> list[dict[str, Any]]:
        tokens, text = tokenize(query), normalize(query).strip()
        ranked: list[tuple[float, Endpoint, list[str]]] = []
        for e in self.catalog.endpoints:
            if (not include_management and e.management) or (area and normalize(e.area) != normalize(area)) or (method and e.method != method.upper()):
                continue
            score, matched = self._endpoint_docs[e.id].score(tokens, text)
            if score:
                ranked.append((score, e, matched))
        ranked.sort(key=lambda r: (-r[0], r[1].id))
        return [{**e.to_dict(), "score": round(score, 2), "matched": matched} for score, e, matched in ranked[:limit]]

    def search_pages(self, query: str, *, limit: int = 5, include_management: bool = False) -> list[dict[str, Any]]:
        tokens, text = tokenize(query), normalize(query).strip()
        ranked: list[tuple[float, Page, list[str]]] = []
        for p in self.catalog.pages:
            if p.roles and not include_management:
                continue  # las pantallas de gestión no son para quien pregunta dónde está algo
            score, matched = self._page_docs[p.path].score(tokens, text)
            if score:
                ranked.append((score, p, matched))
        ranked.sort(key=lambda r: (-r[0], r[1].path))
        return [{**p.to_dict(), "score": round(score, 2), "matched": matched} for score, p, matched in ranked[:limit]]

    def expand(self, query: str, pages: list[dict[str, Any]], endpoints: list[dict[str, Any]], *, limit: int = 8) -> list[str]:
        """Palabras clave de lo encontrado que la persona no escribió: con ellas puede preguntar mejor."""
        asked = set(tokenize(query)) | {normalize(query).strip()}
        found: dict[str, float] = {}
        for rank, item in enumerate(endpoints[:4]):
            for kw in item["keywords"]:
                found[kw] = max(found.get(kw, 0), 4 - rank * 0.5)
        for rank, item in enumerate(pages[:3]):
            for kw in self._page_docs[item["path"]].keywords:
                found[kw] = max(found.get(kw, 0), 3 - rank * 0.5)
        fresh = [(w, kw) for kw, w in found.items() if normalize(kw) not in asked and not all(t in asked for t in tokenize(kw))]
        fresh.sort(key=lambda x: (-x[0], x[1]))
        return [kw for _, kw in fresh[:limit]]

    def search(self, query: str, *, limit: int = 5, include_management: bool = False) -> dict[str, Any]:
        """Lo que el asistente pide: páginas a las que mandar a la persona, endpoints que lo respaldan y palabras relacionadas."""
        pages = self.search_pages(query, limit=limit, include_management=include_management)
        endpoints = self.search_endpoints(query, limit=limit, include_management=include_management)
        return {
            "query": query,
            "terms": tokenize(query),
            "pages": pages,
            "endpoints": endpoints,
            "expanded_terms": self.expand(query, pages, endpoints),
        }
