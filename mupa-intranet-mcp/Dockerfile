# syntax=docker/dockerfile:1
#
# Intranet MUPA — servidor MCP (Python + FastAPI). Describe los endpoints y las páginas de la intranet
# para el asistente. Lee el catálogo de la API (BACKEND_URL) y lo llama la API (MCP_URL).
# No se publica fuera de Docker: solo lo alcanzan los demás servicios de la red.
FROM python:3.12-slim
# Parches de seguridad del sistema.
RUN apt-get update && apt-get -y --no-install-recommends upgrade && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY app ./app
# La copia de respaldo del catálogo (`npm run catalogo:exportar`, en mupa-intranet-api): se usa mientras la API no responde.
COPY catalog.snapshot.json ./

RUN useradd --system --uid 10001 mcp
USER mcp
EXPOSE 8000

# /salud no pide llave: solo dice que el servicio vive.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/salud', timeout=2).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
