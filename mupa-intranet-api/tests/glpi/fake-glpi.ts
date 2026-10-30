/**
 * GLPI falso para las pruebas: la parte de la API REST que usa la intranet (initSession con App-Token y Basic,
 * search/User por «Teléfono», search/Ticket por solicitante y killSession), con sus formatos (filas con los números de
 * campo como claves; 206 cuando el rango es parcial). Personas y tickets ficticios.
 */
import type { Server } from 'node:http'

import express from 'express'

export type FakeTicket = { id: number; title: string; status: number; date: string; date_mod: string; requester: number; content: string }
type Forced = { status: number; body?: string } | 'drop'

export async function startFakeGlpi(options: { url: string; appToken: string; login: string; password: string }) {
  const users: { id: number; phone: string }[] = []
  const tickets: FakeTicket[] = []
  const sessions = new Set<string>()
  const killed: string[] = []
  const calls: { path: string; query: Record<string, unknown> }[] = []
  const state: { next: Forced | null } = { next: null }
  const base = new URL(options.url).pathname.replace(/\/+$/, '')

  const app = express()
  // criteria[0][field]=… como objetos anidados (Express 5 no lo hace por defecto).
  app.set('query parser', 'extended')
  app.use((req, res, next) => {
    calls.push({ path: req.path, query: { ...req.query } })
    const o = state.next
    if (o) {
      state.next = null
      if (o === 'drop') return req.socket.destroy()
      return res.status(o.status).type('application/json').send(o.body ?? '')
    }
    if (req.header('app-token') !== options.appToken) return res.status(400).json(['ERROR_WRONG_APP_TOKEN_PARAMETER', 'El parámetro app_token es incorrecto'])
    next()
  })
  app.get(`${base}/initSession`, (req, res) => {
    const esperado = 'Basic ' + Buffer.from(`${options.login}:${options.password}`).toString('base64')
    if (req.header('authorization') !== esperado) return res.status(401).json(['ERROR_GLPI_LOGIN', 'Usuario o contraseña incorrectos'])
    const token = crypto.randomUUID()
    sessions.add(token)
    res.json({ session_token: token })
  })
  const conSesion: express.RequestHandler = (req, res, next) => {
    if (!sessions.has(req.header('session-token') ?? '')) return res.status(401).json(['ERROR_SESSION_TOKEN_INVALID', 'Sesión inválida'])
    next()
  }
  app.get(`${base}/killSession`, conSesion, (req, res) => {
    const t = req.header('session-token')!
    sessions.delete(t)
    killed.push(t)
    res.json(true)
  })

  type Criterio = { link?: string; field: string; searchtype: string; value: string }
  const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : Object.values((v ?? {}) as Record<string, T>))
  const criterios = (q: Record<string, unknown>) => lista<Criterio>(q.criteria)
  const columnas = (q: Record<string, unknown>) => lista<unknown>(q.forcedisplay).map(String)

  app.get(`${base}/search/User`, conSesion, (req, res) => {
    const [c] = criterios(req.query)
    // «contains» con ^…$: igualdad exacta (así lo hace GLPI).
    const m = c && c.field === '6' && c.searchtype === 'contains' ? /^\^(.*)\$$/.exec(c.value) : null
    const encontrados = m ? users.filter((u) => u.phone === m[1]) : []
    const cols = columnas(req.query)
    const data = encontrados.map((u) => Object.fromEntries(cols.map((f) => [f, f === '2' ? u.id : f === '6' ? u.phone : null])))
    res.json({ totalcount: data.length, count: data.length, ...(data.length ? { data } : {}) })
  })
  app.get(`${base}/search/Ticket`, conSesion, (req, res) => {
    const ids = criterios(req.query)
      .filter((c) => c.field === '4' && c.searchtype === 'equals')
      .map((c) => Number(c.value))
    const cols = columnas(req.query)
    const campo: Record<string, (t: FakeTicket) => unknown> = { '1': (t) => t.title, '2': (t) => t.id, '12': (t) => t.status, '15': (t) => t.date, '19': (t) => t.date_mod, '21': (t) => t.content }
    const suyos = tickets.filter((t) => ids.includes(t.requester)).sort((a, b) => b.date.localeCompare(a.date))
    const data = suyos.map((t) => Object.fromEntries(cols.map((f) => [f, campo[f]?.(t) ?? null])))
    // GLPI responde 206 cuando la búsqueda trae solo una parte (aquí, siempre que haya alguno).
    res.status(data.length ? 206 : 200).json({ totalcount: data.length, count: data.length, ...(data.length ? { data } : {}) })
  })

  const url = new URL(options.url)
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(Number(url.port), url.hostname, () => resolve(s))
  })

  return {
    calls,
    killed,
    openSessions: () => sessions.size,
    addUser(id: number, phone: string) {
      users.push({ id, phone })
    },
    addTicket(t: FakeTicket) {
      tickets.push(t)
    },
    failNext(o: Forced) {
      state.next = o
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

export type FakeGlpi = Awaited<ReturnType<typeof startFakeGlpi>>
