import { env, type McpConfig } from '../../config/env.ts'

/**
 * Cliente mínimo del servidor MCP de la intranet (mupa-intranet-mcp, Python): llama a UNA herramienta con un
 * POST JSON-RPC a /mcp. El servidor corre sin sesión (stateless, respuesta JSON), así que no hace falta
 * `initialize` ni mantener un canal abierto: cada llamada es independiente y puede fallar sin arrastrar nada.
 * Con MCP_INTERNAL_KEY manda la llave compartida en `X-Internal-Key`.
 */
export class McpError extends Error {}

type ToolResult = { isError?: boolean; structuredContent?: unknown; content?: { type: string; text?: string }[] }

export class McpClient {
  private readonly config: McpConfig
  private readonly key: string | undefined
  private nextId = 1

  constructor(config: McpConfig, key: string | undefined) {
    this.config = config
    this.key = key
  }

  /** Llama a la herramienta y devuelve su resultado (el estructurado, o el texto leído como JSON). Lanza McpError si falla. */
  async callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    const res = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(this.key ? { 'X-Internal-Key': this.key } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: this.nextId++, method: 'tools/call', params: { name, arguments: args } }),
      redirect: 'manual',
      signal: AbortSignal.timeout(this.config.timeoutMs),
    })
    if (!res.ok) throw new McpError(`El servidor MCP respondió HTTP ${res.status}`)
    const body = parseRpc(await res.text(), res.headers.get('content-type') ?? '')
    if (body.error) throw new McpError(`El servidor MCP devolvió un error: ${body.error.message ?? body.error.code}`)
    const result = body.result
    if (!result || result.isError) throw new McpError(`La herramienta ${name} falló: ${result?.content?.[0]?.text ?? 'sin detalle'}`)
    if (result.structuredContent !== undefined) return result.structuredContent as T
    const text = result.content?.find((c) => c.type === 'text')?.text
    if (text === undefined) throw new McpError(`La herramienta ${name} no devolvió contenido`)
    try {
      return JSON.parse(text) as T
    } catch {
      throw new McpError(`La herramienta ${name} devolvió algo que no es JSON`)
    }
  }
}

type Rpc = { result?: ToolResult; error?: { code?: number; message?: string } }

/** La respuesta JSON-RPC: JSON directo o, si el servidor contestó como flujo de eventos, su primer `data:`. */
function parseRpc(text: string, contentType: string): Rpc {
  const raw = contentType.includes('text/event-stream') ? (text.split('\n').find((l) => l.startsWith('data:')) ?? '').slice(5).trim() : text
  try {
    const parsed = JSON.parse(raw) as Rpc
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    /* cae al error de abajo */
  }
  throw new McpError('El servidor MCP devolvió una respuesta que no es JSON-RPC')
}

/** El MCP de esta instalación, o null si no está configurado (MCP_URL vacío). */
export const mcpClient = env.mcp ? new McpClient(env.mcp, env.MCP_INTERNAL_KEY) : null
