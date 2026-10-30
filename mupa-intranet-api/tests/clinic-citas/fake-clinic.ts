/**
 * API de la Clínica falsa para las pruebas: solo el historial de citas para otros sistemas
 * (GET /recepcion/integracion/historial/:cedula con la llave en X-Api-Key), con el contrato de la guía
 * que publica el propio servicio. Pacientes y citas ficticios.
 */
import type { Server } from 'node:http'

import express from 'express'

export type FakeCita = { id: number; fecha: string; hora: string | null; tipo: string; especialidad: string; medico: string; estado: string; asistio: boolean; atendido: boolean; cancelado: boolean }
type Forced = { status: number; body?: string } | 'drop'

export async function startFakeClinic(options: { url: string; apiKey: string }) {
  const pacientes = new Map<string, FakeCita[]>()
  const requests: { path: string; query: Record<string, unknown>; key?: string }[] = []
  const state: { next: Forced | null } = { next: null }

  const app = express()
  app.get('/recepcion/integracion/historial/:cedula', (req, res) => {
    requests.push({ path: req.originalUrl.split('?')[0], query: { ...req.query }, key: req.header('x-api-key') })
    const o = state.next
    if (o) {
      state.next = null
      if (o === 'drop') return req.socket.destroy()
      return res.status(o.status).type('application/json').send(o.body ?? '')
    }
    if (req.header('x-api-key') !== options.apiKey) return res.status(401).json({ success: false, message: 'Llave inválida' })
    const citas = pacientes.get(req.params.cedula)
    const { desde, hasta } = req.query as { desde?: string; hasta?: string }
    const data = (citas ?? []).filter((c) => (!desde || c.fecha >= desde) && (!hasta || c.fecha <= hasta))
    res.json({ success: true, paciente: citas ? { nombre: 'Paciente Ficticio' } : null, desde: desde ?? null, hasta: hasta ?? null, resumen: { total: data.length }, data })
  })

  const url = new URL(options.url)
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(Number(url.port), url.hostname, () => resolve(s))
  })

  return {
    requests,
    addPaciente(cedula: string, citas: FakeCita[]) {
      pacientes.set(cedula, citas)
    },
    failNext(o: Forced) {
      state.next = o
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

export type FakeClinic = Awaited<ReturnType<typeof startFakeClinic>>
