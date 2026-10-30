"""Configuración desde variables de entorno (todas opcionales; los valores por defecto sirven en docker compose)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    return int(raw) if raw else default


@dataclass(frozen=True)
class Settings:
    #: Dónde está la API (sin barra al final). En docker compose es el servicio `api`.
    backend_url: str = "http://api:3000"
    #: Llave compartida con la API (MCP_INTERNAL_KEY): la API se la exige al MCP para dar su catálogo y
    #: el MCP se la exige a quien lo llame (la propia API, cuando el asistente le pide pistas).
    #: Vacía = sin llave (solo para desarrollo local).
    internal_key: str = ""
    #: Cada cuánto vuelve a leer el catálogo de la API (segundos).
    refresh_seconds: int = 300
    #: Espera máxima por respuesta de la API (segundos).
    request_timeout: int = 5
    #: Copia del catálogo para cuando la API no responde (el JSON de `npm run catalogo:exportar`).
    snapshot_file: str = "catalog.snapshot.json"
    #: Hosts con los que se puede llamar al MCP (protección contra DNS rebinding del SDK).
    allowed_hosts: tuple[str, ...] = field(default=("mcp:*", "mupa-intranet-mcp:*", "localhost:*", "127.0.0.1:*"))

    @classmethod
    def from_env(cls) -> "Settings":
        hosts = tuple(h.strip() for h in os.environ.get("MCP_ALLOWED_HOSTS", "").split(",") if h.strip())
        defaults = cls()
        return cls(
            backend_url=os.environ.get("BACKEND_URL", defaults.backend_url).strip().rstrip("/"),
            internal_key=os.environ.get("MCP_INTERNAL_KEY", "").strip(),
            refresh_seconds=_int("CATALOG_REFRESH_SECONDS", defaults.refresh_seconds),
            request_timeout=_int("BACKEND_TIMEOUT_SECONDS", defaults.request_timeout),
            snapshot_file=os.environ.get("CATALOG_SNAPSHOT_FILE", defaults.snapshot_file).strip(),
            allowed_hosts=hosts or defaults.allowed_hosts,
        )
