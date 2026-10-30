/**
 * Servidor de inferencia FALSO para las pruebas: imita /v1/chat/completions de vLLM
 * (misma forma de respuesta que el servidor real de la Alcaldía, medida el 2026-09-24).
 * Cada prueba decide qué contesta el "modelo" con `reply`.
 */
import type { Server } from 'node:http'

import express from 'express'

type Body = { messages: { role: string; content: string }[]; [k: string]: unknown }
type Reply =
  | { content: string | null; finishReason?: string }
  | { status: number; body?: string; contentType?: string }
  | { delayMs: number }
  | 'drop'

export async function startFakeLlm(url: string) {
  const requests: Body[] = []
  let reply: (body: Body) => Reply = () => ({ content: JSON.stringify({ answer: 'Respuesta de prueba.', applications: [], pages: [] }) })

  const app = express()
  app.use(express.json({ limit: '2mb' }))
  app.post('/v1/chat/completions', async (req, res) => {
    const body = req.body as Body
    requests.push(body)
    const r = reply(body)
    if (r === 'drop') return req.socket.destroy()
    if ('delayMs' in r) {
      await new Promise((resolve) => setTimeout(resolve, r.delayMs))
      return res.json({ choices: [{ index: 0, message: { role: 'assistant', content: '{"answer":"tarde","applications":[],"pages":[]}' }, finish_reason: 'stop' }] })
    }
    if ('status' in r) return res.status(r.status).type(r.contentType ?? 'application/json').send(r.body ?? '')
    res.json({
      id: 'chatcmpl-prueba',
      object: 'chat.completion',
      model: 'modelo-de-prueba',
      choices: [{ index: 0, message: { role: 'assistant', content: r.content, tool_calls: [], reasoning: null }, finish_reason: r.finishReason ?? 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    })
  })

  const { port } = new URL(url)
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(Number(port), '127.0.0.1', () => resolve(s))
  })

  return {
    requests,
    /** Qué contesta el modelo a partir de ahora. */
    reply(fn: (body: Body) => Reply) {
      reply = fn
    },
    /** Respuesta JSON del modelo (lo que iría en message.content). */
    answer(answer: string, applications: string[], pages: string[] = [], items?: string[]) {
      reply = () => ({ content: JSON.stringify({ answer, applications, pages, ...(items && { items }) }) })
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

export type FakeLlm = Awaited<ReturnType<typeof startFakeLlm>>
