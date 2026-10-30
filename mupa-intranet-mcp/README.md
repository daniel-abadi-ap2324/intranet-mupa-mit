# MCP de la intranet MUPA (Python + FastAPI)

Servidor [MCP](https://modelcontextprotocol.io) que **describe los endpoints de la API y las páginas de la intranet**
para que el asistente (el chatbot) entienda qué hay y mande a cada persona a la página correcta.

```
asistente (API) ──POST /mcp (search_intranet)──▶  mcp  ──GET /api/meta/catalog──▶  API
   ▲  pistas: páginas, endpoints y palabras relacionadas                      (rutas + descripciones, con llave)
   └─ el modelo decide con ellas; si el MCP no responde, contesta igual
```

## Cómo funciona

1. **La API es la fuente de la verdad.** `mupa-intranet-api/src/features/meta` averigua solo sus rutas (método, ruta, roles que
   exige, DTO que valida → JSON Schema) y les une su descripción en español
   (`endpoint-docs.ts`). Una prueba (`tests/meta.test.ts`) obliga a que **toda** ruta montada tenga su descripción y que
   ninguna sobre, así el catálogo no se queda atrás. Lo entrega en `GET /api/meta/catalog`, solo con la llave interna.
2. **Este servicio lo lee** (al arrancar y cada 5 min), arma un índice de búsqueda en español y lo ofrece de dos formas:
   - **MCP** en `POST /mcp` (streamable HTTP, **sin sesión** y con respuesta JSON: se puede llamar con un `fetch`).
   - **REST** con lo mismo, para verlo sin un cliente MCP: `/docs` (Swagger), `/api/search?q=…`, `/api/endpoints`, `/api/pages`…
3. **Si la API no responde**, sigue con la última copia buena; al arrancar usa `catalog.snapshot.json` (la copia que viene en
   la imagen) y reintenta cada 5 s hasta lograr leer la API.
4. **La API le pide pistas al asistente** (`assistant.service.ts`): antes de preguntarle al modelo manda la pregunta a
   `search_intranet` y agrega al prompt las páginas más probables, los endpoints que las respaldan y las palabras con que se
   nombra lo mismo. Solo pasan páginas que existen en esa edición. Si el MCP falla o tarda más de `MCP_TIMEOUT_MS`, el asistente
   responde igual, sin pistas.

## Herramientas MCP

| Herramienta | Para qué |
|---|---|
| `search_intranet(query, limit, include_management)` | **La principal.** Páginas a las que mandar, endpoints que las respaldan y `expanded_terms` (otras palabras con que la intranet nombra lo mismo). |
| `search_content(query, limit)` | Contenido concreto que responde a la pregunta: boletines (por tema o fecha), noticias y formularios publicados, con su `path` en la intranet. Pregunta en vivo a `GET /api/meta/content` (con la llave interna). |
| `find_pages(query, limit)` | Solo páginas (ruta, título, para qué sirve, endpoints). |
| `list_pages(include_management)` | Todas las páginas. |
| `search_endpoints(query, area, method, …)` | Endpoints por lo que hacen. |
| `list_endpoints(area, method, …)` | Lista de endpoints con su área y quién los usa. |
| `describe_endpoint("GET /api/bulletins")` | Un endpoint con lo que recibe (params, query y cuerpo como JSON Schema). |
| `get_confirmed_facts()` | Datos confirmados (teléfonos, extensiones, dónde se hace cada cosa). |
| `catalog_status()` | De dónde salió el catálogo y de qué edición es. |

Recursos: `mupa://catalog/endpoints`, `mupa://catalog/pages`, `mupa://catalog/facts`.

Las pantallas y endpoints de **gestión** (los que piden un rol) no salen salvo con `include_management=true`: quien pregunta
dónde está algo no necesita `/gestion/…`.

Llamarlo a mano (sin `initialize`, como lo hace la API):

```bash
curl -X POST http://localhost:8000/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -H "X-Internal-Key: $MCP_INTERNAL_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_intranet","arguments":{"query":"dónde veo mi talonario"}}}'
```

## Configuración (variables de entorno)

| Variable | Qué es |
|---|---|
| `BACKEND_URL` | Dónde está la API (`http://api:3000` en Docker). |
| `MCP_INTERNAL_KEY` | Llave compartida con la API. La API la exige para dar su catálogo y este servicio la exige a quien lo llame (todo menos `/salud` y `/listo`). Vacía = sin llave (solo desarrollo). |
| `CATALOG_REFRESH_SECONDS` | Cada cuánto vuelve a leer el catálogo (300). |
| `BACKEND_TIMEOUT_SECONDS` | Espera máxima por respuesta de la API (5). |
| `CATALOG_SNAPSHOT_FILE` | Copia de respaldo (`catalog.snapshot.json`). |
| `MCP_ALLOWED_HOSTS` | Hosts con que se puede llamar (protección contra DNS rebinding); por defecto `mcp:*`, `localhost:*`, `127.0.0.1:*`. |

En `docker compose` el servicio `mcp` no publica ningún puerto y nginx no lo alcanza (ni siquiera `/api/meta/`).

## Cuando cambian los endpoints

1. Agrega o cambia la ruta en la API y su descripción en `mupa-intranet-api/src/features/meta/endpoint-docs.ts`
   (`npm test` en la API avisa si falta o sobra una).
2. Si cambia una página del asistente (`assistant.knowledge.ts`), cambia solo ahí.
3. Regenera la copia de respaldo: en `mupa-intranet-api`, `npm run catalogo:exportar` (escribe
   `mupa-intranet-mcp/catalog.snapshot.json`; las pruebas de este servicio trabajan con ella).
4. En producción, el MCP toma lo nuevo solo (≤ 5 min) o con `POST /api/refresh`.

## Desarrollo y pruebas

```bash
cd mupa-intranet-mcp
python -m venv .venv && . .venv/bin/activate        # en Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest                                               # búsqueda, catálogo, REST y MCP (con el cliente oficial)
uvicorn app.main:app --reload --port 8000            # BACKEND_URL=http://localhost:3000 MCP_INTERNAL_KEY=…
```

El SDK de MCP se queda en `1.x` (`mcp>=1.13,<2`): la 2.x renombró `FastMCP` y cambió su API.
