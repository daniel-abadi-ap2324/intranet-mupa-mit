/**
 * Servidor MCP FALSO para las pruebas: imita POST /mcp de mupa-intranet-mcp (JSON-RPC `tools/call`, sin sesión,
 * respuesta JSON; forma medida contra el servicio real en mupa-intranet-mcp/tests/test_mcp.py).
 */
import type { Server } from 'node:http'

import express from 'express'

type RpcRequest = { jsonrpc: string; id: number; method: string; params: { name: string; arguments: Record<string, unknown> } }
type Mode = { kind: 'ok'; hints: unknown } | { kind: 'text-only'; hints: unknown } | { kind: 'sse'; hints: unknown } | { kind: 'tool-error' } | { kind: 'rpc-error' } | { kind: 'http'; status: number } | { kind: 'garbage' } | { kind: 'slow'; ms: number } | { kind: 'drop' }

const DEFAULT_HINTS = {
  query: '',
  terms: [],
  pages: [{ path: '/recursos-humanos?seccion=comprobantes', title: 'Comprobantes de pago', about: 'x', score: 10 }],
  endpoints: [{ id: 'GET /api/rrhh/comprobantes', summary: 'Los comprobantes de pago (talonario), por páginas.', page: '/recursos-humanos?seccion=comprobantes', score: 10 }],
  expanded_terms: ['talonario', 'salario'],
}

export async function startFakeMcp(url: string) {
  const requests: { headers: Record<string, string | string[] | undefined>; body: RpcRequest }[] = []
  let mode: Mode = { kind: 'ok', hints: DEFAULT_HINTS }

  const app = express()
  app.use(express.json())
  app.post('/mcp', async (req, res) => {
    const body = req.body as RpcRequest
    requests.push({ headers: req.headers, body })
    const m = mode
    const wrap = (id: number, result: unknown) => ({ jsonrpc: '2.0', id, result })
    if (m.kind === 'drop') return req.socket.destroy()
    if (m.kind === 'http') return res.status(m.status).send('error')
    if (m.kind === 'garbage') return res.type('text/html').send('<html>no soy JSON-RPC</html>')
    if (m.kind === 'slow') await new Promise((r) => setTimeout(r, m.ms))
    if (m.kind === 'rpc-error') return res.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } })
    if (m.kind === 'tool-error') return res.json(wrap(body.id, { isError: true, content: [{ type: 'text', text: 'Error executing tool search_intranet: El catálogo todavía no está cargado' }] }))
    const hints = m.kind === 'slow' ? DEFAULT_HINTS : m.hints
    if (m.kind === 'text-only') return res.json(wrap(body.id, { isError: false, content: [{ type: 'text', text: JSON.stringify(hints) }] }))
    if (m.kind === 'sse') return res.type('text/event-stream').send(`event: message\ndata: ${JSON.stringify(wrap(body.id, { isError: false, structuredContent: hints, content: [] }))}\n\n`)
    res.json(wrap(body.id, { isError: false, structuredContent: hints, content: [{ type: 'text', text: JSON.stringify(hints) }] }))
  })

  const { port } = new URL(url)
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(Number(port), '127.0.0.1', () => resolve(s))
  })

  return {
    requests,
    set(next: Mode) {
      mode = next
    },
    reset() {
      mode = { kind: 'ok', hints: DEFAULT_HINTS }
      requests.length = 0
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

export type FakeMcp = Awaited<ReturnType<typeof startFakeMcp>>
export { DEFAULT_HINTS }
