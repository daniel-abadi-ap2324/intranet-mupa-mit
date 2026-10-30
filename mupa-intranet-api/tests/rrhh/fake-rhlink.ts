/**
 * RH Link falso (el backend de RRHH Express) para las pruebas, con el contrato que
 * tiene el real (código de RH Link, medido el 2026-10-01): login por cédula, token JWT
 * con `funcionarioId` y rutas que solo dejan ver la cédula propia (403 si no).
 * Personas y datos ficticios.
 */
import { createHmac, randomUUID } from 'node:crypto'
import type { Server } from 'node:http'

import express, { type NextFunction, type Request, type Response } from 'express'

export type FakeEmployee = { cedula: string; password: string; nombre: string; saldoMin?: number }
export type FakeRequest = { method: string; path: string; auth?: string; body: Record<string, unknown> }
type Forced = { status: number; body?: string; contentType?: string } | 'drop'

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')

export async function startFakeRhLink(options: { url: string; ttlSeconds?: number; adUser?: string; adPassword?: string }) {
  const employees = new Map<string, FakeEmployee>()
  // Verificación de funcionarios (GET empleados/cedula/:c con un token de AD): cédula → estado en RH Link.
  const funcionarios = new Map<string, { estado: string; ubicacion?: number; nombre?: string }>()
  const adIssued: string[] = []
  const adRevoked = new Set<string>()
  let adLogins = 0
  const requests: FakeRequest[] = []
  const issued: string[] = []
  const revoked = new Set<string>()
  const solicitudes: Array<Record<string, unknown>> = []
  const state: { next: Forced | null } = { next: null }

  const sign = (cedula: string, nombre: string) => {
    const now = Math.floor(Date.now() / 1000)
    const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ funcionarioId: cedula, nombre, estado: 'ACTIVA', iat: now, exp: now + (options.ttlSeconds ?? 8 * 3600), jti: randomUUID() })}`
    const token = `${head}.${createHmac('sha256', 'secreto-falso').update(head).digest('base64url')}`
    issued.push(token)
    return token
  }

  const app = express()
  app.use(express.json())

  app.use((req, res, next) => {
    requests.push({ method: req.method, path: req.originalUrl, auth: req.headers.authorization, body: { ...(req.body ?? {}) } })
    const o = state.next
    if (!o) return next()
    state.next = null
    if (o === 'drop') return req.socket.destroy()
    res.status(o.status).type(o.contentType ?? 'application/json').send(o.body ?? '')
  })

  // Login de AD (el que usa la API para preguntar quién es funcionario).
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body ?? {}
    if (username !== options.adUser || password !== options.adPassword) return res.status(401).json({ success: false, message: 'Credenciales inválidas' })
    adLogins++
    const now = Math.floor(Date.now() / 1000)
    const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ username, rol: 'rhl_lector', iat: now, exp: now + (options.ttlSeconds ?? 3600), jti: randomUUID() })}`
    const token = `${head}.${createHmac('sha256', 'secreto-falso-ad').update(head).digest('base64url')}`
    adIssued.push(token)
    res.json({ success: true, message: 'ok', user: { username }, tokens: { accessToken: token, refreshToken: 'x', tokenType: 'Bearer', expiresIn: '1h' } })
  })

  app.get('/empleados/cedula/:c', (req, res) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '')
    if (!token) return res.status(401).json({ success: false, message: 'Token de autenticación requerido' })
    const ok = adIssued.includes(token) && !adRevoked.has(token)
    if (!ok) return res.status(403).json({ success: false, message: 'Token inválido o expirado' })
    const f = funcionarios.get(req.params.c)
    if (!f) return res.status(404).json({ success: false, mensaje: 'Empleado no encontrado' })
    res.json({ success: true, data: { cedula: req.params.c, nombre: f.nombre ?? 'PERSONA FICTICIA', salario_mensual: 1000, direccion: 'DIRECCION FICTICIA', ubicacion_codigo: f.ubicacion ?? 99999, estado_funcionario: f.estado } })
  })

  app.post('/api/auth/login-cedula', (req, res) => {
    const { cedula, password } = req.body ?? {}
    if (!cedula || !password) return res.status(400).json({ success: false, message: 'Cédula y contraseña requeridos' })
    const e = employees.get(cedula)
    if (!e || e.password !== password) return res.status(401).json({ success: false, message: 'Cédula o contraseña incorrecta' })
    res.json({ success: true, token: sign(e.cedula, e.nombre), mustSetPassword: false, funcionario: { cedula: e.cedula, nombre: e.nombre } })
  })

  // Token de funcionario: la cédula sale del token. Vencido, revocado o falso → 403 (como el real).
  const auth = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '')
    if (!token) return res.status(401).json({ success: false, message: 'Token de autenticación requerido' })
    try {
      const [h, p, s] = token.split('.')
      if (createHmac('sha256', 'secreto-falso').update(`${h}.${p}`).digest('base64url') !== s || revoked.has(token)) throw new Error()
      const claims = JSON.parse(Buffer.from(p, 'base64url').toString())
      if (claims.exp * 1000 < Date.now()) throw new Error()
      res.locals.cedula = claims.funcionarioId
      next()
    } catch {
      res.status(403).json({ success: false, message: 'Token inválido o expirado' })
    }
  }
  const own = (req: Request, res: Response, next: NextFunction) =>
    req.params.c === res.locals.cedula ? next() : res.status(403).json({ success: false, message: 'Solo puede consultar su propia información' })

  app.get('/api/marcaciones/:c', auth, own, (req, res) => {
    const mm = String(req.query.mes).padStart(2, '0')
    res.json({
      success: true,
      marcaciones: [
        { fecha: `${req.query.anio}-${mm}-01`, primera_marcacion: '07:58', ultima_marcacion: '16:02', horas_trabajadas: '08:04', horas_regulares: '08:00', tardanza: null, entrada_antes: '00:02', salida_anticipada: null, sobretiempo: '00:02', estatus: 'COMPLETA', tipo_dia: 'COMPLETA', descripcion_feriado: null, motivo_excepcion: null, tipo_ausencia: null },
        { fecha: `${req.query.anio}-${mm}-02`, primera_marcacion: '08:20', ultima_marcacion: '16:00', horas_trabajadas: '07:40', horas_regulares: '08:00', tardanza: '00:20', entrada_antes: null, salida_anticipada: null, sobretiempo: null, estatus: 'COMPLETA', tipo_dia: 'COMPLETA', descripcion_feriado: null, motivo_excepcion: null, tipo_ausencia: null },
        { fecha: `${req.query.anio}-${mm}-03`, primera_marcacion: null, ultima_marcacion: null, horas_trabajadas: null, horas_regulares: null, tardanza: null, entrada_antes: null, salida_anticipada: null, sobretiempo: null, estatus: 'FERIADO', tipo_dia: 'FERIADO', descripcion_feriado: 'Día ficticio', motivo_excepcion: null, tipo_ausencia: null },
      ],
      resumen: { presentes: 1, tardanzas: 1, ausencias: 0, dias_libres: 0 },
      horario: 'Horario de prueba L-V 8:00-16:00',
    })
  })

  const comprobante = (cedula: string, n: number) => ({
    posicion: 1234,
    cedula,
    nombre: 'Persona Ficticia',
    fecha_nacimiento: '1990-01-01T00:00:00.000Z',
    cargo: 'Analista de prueba',
    seguro_social: '123456789',
    salario: '1000.00',
    fecha_planilla: `2026-09-${n === 1 ? '15' : '30'}T00:00:00.000Z`,
    quincena: `20260${9}${n}`,
    forma_pago: 'AC',
    codigo_banco: '71  ',
    cuenta: '0401234567890',
    tipo_cuenta: 'S',
    impuesto_sr: 10,
    impuesto_ss: 97.5,
    impuesto_se: 12.5,
    impuesto_fc: 3,
    asemup: 5,
    otros_descuentos: 20,
    total_descuento: 148,
    monto_neto: 852,
    cheque: 5000 + n,
    numero_planilla: 900 + n,
    dias_pagado: 15,
  })

  app.get('/api/comprobantes/:c/historial', auth, own, (req, res) => {
    res.json({ success: true, data: [comprobante(req.params.c as string, 2), comprobante(req.params.c as string, 1)], paginacion: { total: 2, pagina: Number(req.query.pagina ?? 1), limite: Number(req.query.limite ?? 50), totalPaginas: 1 } })
  })
  app.get('/api/comprobantes/:c/resumen/:anio', auth, own, (req, res) => {
    res.json({ success: true, data: { comprobantes: [comprobante(req.params.c as string, 1), comprobante(req.params.c as string, 2)], totales: { totalIngresos: '2000.00', totalDeducciones: '296.00', totalNeto: '1704.00' }, cantidad: 2 } })
  })
  app.get('/api/comprobantes/:c/detalle', auth, own, (req, res) => {
    if (Number(req.query.numero_planilla) === 404) return res.status(404).json({ success: false, message: 'No se encontraron detalles de comprobante', data: [] })
    res.json({ success: true, data: { cedula: req.params.c, detallesPlano: [{ cedula: req.params.c, renglon: 1, clave: '120', subclave: '000123', monto: '20.00', saldo: '180.00', tipo: '01 ', estado: 'A' }], total: 1 } })
  })

  app.get('/expediente/:c', auth, own, (req, res) => {
    res.json({
      success: true,
      data: {
        informacion_funcionario: { cedula: req.params.c, nombre: 'PERSONA FICTICIA', posicion: 1234, direccion: 'Dirección de Prueba', fecha_inicio: '2015-03-01', fecha_nacimiento: '1990-01-01', sexo: 'F', estado_civil: 'SOLTERA', seguro_social: '123456789', nombre_tipo_planilla: 'PERMANENTE', salario_mensual: 2000, descripcion_cargo: 'Analista de prueba', estado_funcionario: 'ACTIVA', fecha_fin: null },
        datos_personales: { cedula: req.params.c, telefono: '000-0000', celular: '6000-0000', email: 'persona@ejemplo.test', provincia: 'Panamá', distrito: 'Panamá', corregimiento: 'Prueba', barriada: '', edificio: '', casa: '1', contacto_emergencia: 'Contacto Ficticio', telefono_emergencia: '6000-0001', condicion_salud: 'DATO MEDICO FICTICIO', funcion: '', area: '' },
        formacion_academica: [{ id: '1', institucion: 'Universidad Ficticia', titulo: 'Licenciatura de prueba', comentario: '', fecha_registro: '2020-01-01T00:00:00.000Z' }],
        evaluaciones: [{ cedula: req.params.c, promedio: 4.5, categoria: 'Excelente', comentarios: '', fecha_evaluacion: '2025-12-01T00:00:00.000Z' }],
        sanciones: [],
        dependientes: [{ id_dependiente: 1, nombre1: 'Hijo', nombre2: null, apellido1: 'Ficticio', apellido2: null, cedula: '8-000-999', parentesco: 'HIJO', fecha_nacimiento: '2015-05-05T00:00:00.000Z', es_dependiente_principal: true }],
      },
    })
  })

  const saldo = (c: string) => employees.get(c)?.saldoMin ?? 0
  app.get('/api/comp-tiempo/saldo/:c', auth, own, (req, res) => {
    const s = saldo(req.params.c as string)
    res.json({
      success: true,
      data: {
        cedula: req.params.c,
        bolsas: { ANTES: { minutos_disponibles: 0, minutos_pendientes: 0, minutos_consumidos: 0, minutos_expirados: 0 }, DESPUES: { minutos_disponibles: s, minutos_pendientes: 0, minutos_consumidos: 30, minutos_expirados: 0 } },
        jornada_min: 480,
        total_disponible_min: s,
        proximos_vencimientos: s ? [{ tipo: 'DESPUES', fecha_vencimiento: '2027-01-15T00:00:00.000Z', minutos_disponibles: s, dias_restantes: 100 }] : [],
      },
    })
  })
  app.get('/api/comp-tiempo/candidatos/:c', auth, own, (_req, res) => {
    res.json({ success: true, data: [{ fecha: '2026-09-10T00:00:00.000Z', tipo: 'DESPUES', minutos: 45, minutos_marca: 105, franquicia_min: 60 }] })
  })
  app.get('/api/comp-tiempo/solicitudes', auth, (_req, res) => {
    res.json({ success: true, data: solicitudes.filter((s) => s.cedula === res.locals.cedula) })
  })
  app.post('/api/comp-tiempo/solicitudes/acreditacion', auth, (req, res) => {
    const { cedula, tipo, fecha_trabajada } = req.body
    if (cedula !== res.locals.cedula) return res.status(403).json({ success: false, message: 'Solo puede gestionar su propio tiempo compensatorio' })
    if (!cedula || !tipo || !fecha_trabajada) return res.status(400).json({ success: false, message: 'Campos obligatorios: cedula, tipo, fecha_trabajada' })
    const id = solicitudes.length + 1
    solicitudes.push({ id, cedula, tipo, clase: 'ACREDITACION', unidad: 'HORAS', minutos_solicitados: 45, fecha_trabajada, motivo: req.body.motivo, estado: 'PENDIENTE', created_at: new Date().toISOString() })
    res.status(201).json({ success: true, data: { id, minutos: 45 }, message: 'Solicitud de acreditación creada por 45 min' })
  })
  app.post('/api/comp-tiempo/solicitudes/uso', auth, (req, res) => {
    const { cedula, tipo, unidad, minutos, dias, fecha_desde, fecha_hasta } = req.body
    if (cedula !== res.locals.cedula) return res.status(403).json({ success: false, message: 'Solo puede gestionar su propio tiempo compensatorio' })
    const pedidos = unidad === 'DIAS' ? dias * 480 : minutos
    if (pedidos > saldo(cedula)) return res.status(409).json({ success: false, message: `Saldo insuficiente en bolsa ${tipo}. Disponible: ${saldo(cedula)} min, solicitado: ${pedidos} min` })
    const id = solicitudes.length + 1
    solicitudes.push({ id, cedula, tipo, clase: 'USO', unidad, minutos_solicitados: pedidos, dias_solicitados: dias ?? null, fecha_desde, fecha_hasta, estado: 'PENDIENTE', created_at: new Date().toISOString() })
    res.status(201).json({ success: true, data: { id, minutos: pedidos }, message: 'Solicitud de uso creada' })
  })
  app.patch('/api/comp-tiempo/solicitudes/:id/cancelar', auth, (req, res) => {
    const s = solicitudes.find((x) => x.id === Number(req.params.id))
    if (!s) return res.status(404).json({ success: false, message: 'Solicitud no encontrada' })
    if (s.cedula !== res.locals.cedula) return res.status(403).json({ success: false, message: 'Solo puede consultar/gestionar su propio tiempo compensatorio' })
    if (s.estado !== 'PENDIENTE') return res.status(409).json({ success: false, message: 'No se pudo cancelar (no está pendiente)' })
    s.estado = 'CANCELADA'
    res.json({ success: true, message: 'Solicitud cancelada' })
  })

  const { port } = new URL(options.url)
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(Number(port), '127.0.0.1', () => resolve(s))
  })

  return {
    requests,
    solicitudes,
    addEmployee(e: FakeEmployee) {
      employees.set(e.cedula, e)
      return e
    },
    /** Pone o cambia a un funcionario en el registro de RH Link (estado: ACTIVA, INACTIVA…). */
    addFuncionario(cedula: string, estado = 'ACTIVA', ubicacion?: number, nombre?: string) {
      funcionarios.set(cedula, { estado, ubicacion, nombre })
    },
    removeFuncionario(cedula: string) {
      funcionarios.delete(cedula)
    },
    get adLogins() {
      return adLogins
    },
    /** Invalida los tokens de AD emitidos (como si RH Link los revocara). */
    revokeAdTokens() {
      for (const t of adIssued) adRevoked.add(t)
    },
    /** Invalida todos los tokens emitidos hasta ahora (como si vencieran en RH Link). */
    revokeAll() {
      for (const t of issued) revoked.add(t)
    },
    failNext(o: Forced) {
      state.next = o
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

export type FakeRhLink = Awaited<ReturnType<typeof startFakeRhLink>>
