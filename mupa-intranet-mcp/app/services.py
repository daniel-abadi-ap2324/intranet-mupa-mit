"""Lo que comparten el servidor MCP y las rutas REST: el catálogo y su índice de búsqueda."""

from __future__ import annotations

from .catalog import CatalogStore
from .search import SearchIndex


class NotReady(Exception):
    """El catálogo todavía no se cargó (la API no responde y no hay copia de respaldo)."""


class Services:
    def __init__(self, store: CatalogStore) -> None:
        self.store = store
        self._index: SearchIndex | None = None

    @property
    def index(self) -> SearchIndex:
        """El índice del catálogo actual; se rehace solo cuando el catálogo cambia."""
        if not self.store.ready:
            raise NotReady("El catálogo todavía no está cargado: la API no responde y no hay copia de respaldo.")
        if self._index is None or self._index.catalog is not self.store.catalog:
            self._index = SearchIndex(self.store.catalog)
        return self._index
