import { z } from 'zod'

import { DomainError } from '../../shared/errors/domain-error.ts'
import { rhLinkService, type RhLinkService } from '../../shared/services/rhlink.service.ts'
import { eventBus, type EventBusService } from '../../shared/services/event-bus.service.ts'
import { tokenService, type TokenService } from '../../shared/services/token.service.ts'
import { authService, type AuthService } from '../auth/auth.service.ts'
import type { AccreditCompDto, CandidatesQueryDto, MonthQueryDto, UseCompDto } from './dtos/rrhh-query.dto.ts'
import type {
  AttendanceResponse,
  CompCandidatesResponse,
  CompCreatedResponse,
  CompRequestResponse,
  CompResponse,
  PayslipDetailResponse,
  PayslipResponse,
  PayslipsResponse,
  PayslipYearResponse,
  RecordResponse,
  RrhhStatusResponse,
} from './dtos/rrhh-response.dto.ts'
import type { ConnectRrhhDto } from './dtos/connect-rrhh.dto.ts'
import { GUEST_IDLE_MINUTES, GUEST_MAX_MINUTES, GUEST_TOKEN_PURPOSE, PAYSLIPS_PER_PAGE, TOKEN_PURPOSE } from './rrhh.constants.ts'
import { connectLimiter, type ConnectLimiter } from './rrhh.limiter.ts'
import { rrhhRepository, type RrhhRepository } from './rrhh.repository.ts'

// ---------- Lo que se lee de RH Link (solo lo que se usa; lo demás se descarta) ----------

const str = z.preprocess((v) => (v === null || v === undefined ? null : String(v).trim() || null), z.string().nullable())
const num = z.preprocess((v) => (v === null || v === undefined || v === '' ? null : Number(v)), z.number().nullable())
const amount = num.transform((n) => (n === null || Number.isNaN(n) ? 0 : Math.round(n * 100) / 100))
const dateOnly = str.transform((s) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null))

const dayUp = z.object({
  fecha: z.string(),
  estatus: str.optional(),
  primera_marcacion: str.optional(),
  ultima_marcacion: str.optional(),
  horas_trabajadas: str.optional(),
  horas_regulares: str.optional(),
  tardanza: str.optional(),
  entrada_antes: str.optional(),
  salida_anticipada: str.optional(),
  sobretiempo: str.optional(),
  descripcion_feriado: str.optional(),
  motivo_excepcion: str.optional(),
  tipo_ausencia: str.optional(),
})
const attendanceUp = z.object({
  marcaciones: z.array(dayUp),
  resumen: z.object({ presentes: amount, tardanzas: amount, ausencias: amount, dias_libres: amount }),
  horario: str.optional(),
})

const payslipUp = z.object({
  numero_planilla: z.coerce.number(),
  cheque: num.optional(),
  fecha_planilla: dateOnly.optional(),
  quincena: str.optional(),
  cargo: str.optional(),
  dias_pagado: num.optional(),
  salario: amount.optional(),
  impuesto_ss: amount.optional(),
  impuesto_se: amount.optional(),
  impuesto_sr: amount.optional(),
  impuesto_fc: amount.optional(),
  asemup: amount.optional(),
  otros_descuentos: amount.optional(),
  total_descuento: amount.optional(),
  monto_neto: amount.optional(),
  forma_pago: str.optional(),
  codigo_banco: str.optional(),
  tipo_cuenta: str.optional(),
  cuenta: str.optional(),
})
const historyUp = z.object({
  data: z.array(payslipUp),
  paginacion: z.object({ total: z.coerce.number(), pagina: z.coerce.number(), totalPaginas: z.coerce.number() }),
})
const yearUp = z.object({
  data: z.object({
    comprobantes: z.array(payslipUp),
    totales: z.object({ totalIngresos: amount, totalDeducciones: amount, totalNeto: amount }),
  }),
})
const detailUp = z.object({
  data: z.object({
    detallesPlano: z.array(z.object({ clave: str, subclave: str, tipo: str.optional(), monto: amount, saldo: amount.optional() })),
  }),
})

const recordUp = z.object({
  data: z.object({
    informacion_funcionario: z.object({
      nombre: str.optional(),
      descripcion_cargo: str.optional(),
      direccion: str.optional(),
      posicion: num.optional(),
      nombre_tipo_planilla: str.optional(),
      fecha_inicio: dateOnly.optional(),
      fecha_fin: dateOnly.optional(),
      estado_funcionario: str.optional(),
      salario_mensual: num.optional(),
      fecha_nacimiento: dateOnly.optional(),
      sexo: str.optional(),
      estado_civil: str.optional(),
      seguro_social: str.optional(),
    }),
    datos_personales: z
      .object({
        telefono: str.optional(),
        celular: str.optional(),
        email: str.optional(),
        provincia: str.optional(),
        distrito: str.optional(),
        corregimiento: str.optional(),
        barriada: str.optional(),
        edificio: str.optional(),
        casa: str.optional(),
        contacto_emergencia: str.optional(),
        telefono_emergencia: str.optional(),
        funcion: str.optional(),
        area: str.optional(),
      })
      .default({}),
    formacion_academica: z
      .array(z.object({ institucion: str.optional(), titulo: str.optional(), comentario: str.optional(), fecha_registro: dateOnly.optional() }))
      .default([]),
    evaluaciones: z
      .array(z.object({ fecha_evaluacion: dateOnly.optional(), promedio: num.optional(), categoria: str.optional(), comentarios: str.optional() }))
      .default([]),
    sanciones: z
      .array(z.object({ fecha_registro: dateOnly.optional(), sancion_aplicada: str.optional(), comentario: str.optional(), remunerable: z.boolean().optional() }))
      .default([]),
    dependientes: z
      .array(
        z.object({
          nombre1: str.optional(),
          nombre2: str.optional(),
          apellido1: str.optional(),
          apellido2: str.optional(),
          cedula: str.optional(),
          parentesco: str.optional(),
          fecha_nacimiento: dateOnly.optional(),
          es_dependiente_principal: z.boolean().optional(),
        }),
      )
      .default([]),
  }),
})

const bagUp = z.object({ minutos_disponibles: amount, minutos_pendientes: amount, minutos_consumidos: amount, minutos_expirados: amount })
const balanceUp = z.object({
  data: z.object({
    bolsas: z.object({ ANTES: bagUp, DESPUES: bagUp }),
    jornada_min: num.optional(),
    total_disponible_min: amount,
    proximos_vencimientos: z
      .array(z.object({ tipo: str, fecha_vencimiento: dateOnly, minutos_disponibles: amount, dias_restantes: num.optional() }))
      .default([]),
  }),
})
const compRequestUp = z.object({
  id: z.coerce.number(),
  clase: str.optional(),
  tipo: str.optional(),
  unidad: str.optional(),
  minutos_solicitados: num.optional(),
  dias_solicitados: num.optional(),
  fecha_trabajada: dateOnly.optional(),
  fecha_desde: dateOnly.optional(),
  fecha_hasta: dateOnly.optional(),
  motivo: str.optional(),
  estado: str.optional(),
  motivo_rechazo: str.optional(),
  created_at: str.optional(),
})
const compRequestsUp = z.object({ data: z.array(compRequestUp) })
const candidatesUp = z.object({ data: z.array(z.object({ fecha: dateOnly, tipo: z.string(), minutos: amount })) })
const createdUp = z.object({ data: z.object({ id: z.coerce.number(), minutos: num.optional() }), message: str.optional() })
const okUp = z.object({})

// Lo que trae el token de RH Link (lo emite RH Link al entrar; aquí solo se lee).
const tokenClaims = z.object({ funcionarioId: z.string().min(1), nombre: z.string().nullish(), exp: z.number() })

type Payslip = z.infer<typeof payslipUp>
type Connection = { sessionId?: number; guestId?: string; token: string; cedula: string }

// ---------- Máscaras ----------

/** Cuenta bancaria: solo los últimos 4 dígitos. */
const maskAccount = (s: string | null) => (s ? `••••${s.replace(/\s/g, '').slice(-4)}` : null)
/** Cédula o número de seguro social de otra persona: solo los últimos 3. */
const maskId = (s: string | null) => (s ? `•••${s.slice(-3)}` : null)

function toPayslip(p: Payslip): PayslipResponse {
  const q = p.quincena ? /^(\d{4})(\d{2})([12])$/.exec(p.quincena) : null
  return {
    payroll: p.numero_planilla,
    voucher: p.cheque ?? null,
    date: p.fecha_planilla ?? null,
    period: { year: q ? Number(q[1]) : null, month: q ? Number(q[2]) : null, half: q ? Number(q[3]) : null },
    jobTitle: p.cargo ?? null,
    daysPaid: p.dias_pagado ?? null,
    gross: p.salario ?? 0,
    deductions: {
      socialSecurity: p.impuesto_ss ?? 0,
      educationInsurance: p.impuesto_se ?? 0,
      incomeTax: p.impuesto_sr ?? 0,
      complementaryFund: p.impuesto_fc ?? 0,
      asemup: p.asemup ?? 0,
      other: p.otros_descuentos ?? 0,
      total: p.total_descuento ?? 0,
    },
    net: p.monto_neto ?? 0,
    paymentMethod: p.forma_pago ?? null,
    bank: p.codigo_banco ?? null,
    accountType: p.tipo_cuenta ?? null,
    account: maskAccount(p.cuenta ?? null),
  }
}

function toCompRequest(s: z.infer<typeof compRequestUp>): CompRequestResponse {
  return {
    id: s.id,
    kind: s.clase ?? null,
    type: s.tipo ?? null,
    unit: s.unidad ?? null,
    minutes: s.minutos_solicitados ?? null,
    days: s.dias_solicitados ?? null,
    workedDate: s.fecha_trabajada ?? null,
    from: s.fecha_desde ?? null,
    to: s.fecha_hasta ?? null,
    reason: s.motivo ?? null,
    status: s.estado ?? null,
    rejectionReason: s.motivo_rechazo ?? null,
    createdAt: s.created_at ?? null,
  }
}

const NOT_CONNECTED = 'Conecta tu cuenta de RRHH Express para ver esto.'
const EXPIRED = 'Tu conexión con RRHH Express venció. Vuelve a conectarla.'

/** Quién pide: una sesión de la intranet (userId y, con cookie, su token) o una conexión de invitado (su cookie). */
export type Who = { userId?: number; sessionToken?: string; guestToken?: string }

/**
 * RRHH Express dentro de la intranet. La persona conecta su cuenta (cédula y número de cargo);
 * RH Link las comprueba y devuelve un token que
 * solo abre SUS datos. Ese token se guarda cifrado y atado a la sesión de la intranet o, si no
 * hay sesión, a una conexión de invitado con su propia cookie. La cédula con la que se consulta
 * sale siempre del token, nunca de lo que mande el navegador. Con sesión que ya conoce la cédula
 * (Identity Central), esa es la que se usa y no se acepta otra.
 */
export class RrhhService {
  private readonly rh: RhLinkService | null
  private readonly repository: RrhhRepository
  private readonly auth: AuthService
  private readonly tokens: TokenService
  private readonly limiter: ConnectLimiter
  private readonly events: EventBusService

  constructor(
    rh: RhLinkService | null,
    repository: RrhhRepository,
    auth: AuthService,
    tokens: TokenService,
    limiter: ConnectLimiter = connectLimiter,
    events: EventBusService = eventBus,
  ) {
    this.rh = rh
    this.repository = repository
    this.auth = auth
    this.tokens = tokens
    this.limiter = limiter
    this.events = events
  }

  /** Sin sesión ni cookie de invitado: solo dice si RRHH Express está disponible en este servidor. */
  async status(who: Who): Promise<RrhhStatusResponse> {
    const off: RrhhStatusResponse = { available: this.rh !== null, connected: false, knownCedula: false, guest: false, name: null, expiresAt: null }
    if (!this.rh) return off
    if (who.userId === undefined) return who.guestToken ? this.guestStatus(who.guestToken, off) : off
    if (!who.sessionToken) return off
    const session = await this.auth.findSession(who.sessionToken)
    if (!session || session.userId !== who.userId) return off
    const known = { ...off, knownCedula: Boolean(await this.auth.findSessionCedula(who.sessionToken)) }
    const row = await this.repository.findBySessionId(session.id)
    if (!row) return known
    try {
      if (row.expiresAt <= new Date()) throw new Error('vencida')
      const claims = this.claims(this.tokens.decrypt(row.token, who.sessionToken, TOKEN_PURPOSE))
      return { ...known, connected: true, name: claims.nombre?.trim() || null, expiresAt: row.expiresAt.toISOString() }
    } catch {
      await this.repository.deleteBySessionId(session.id)
      return known
    }
  }

  private async guestStatus(guestToken: string, off: RrhhStatusResponse): Promise<RrhhStatusResponse> {
    const id = this.tokens.hash(guestToken)
    const row = await this.repository.findGuest(id)
    if (!row) return off
    try {
      if (row.expiresAt <= new Date()) throw new Error('vencida')
      const claims = this.claims(this.tokens.decrypt(row.token, guestToken, GUEST_TOKEN_PURPOSE))
      return { ...off, connected: true, guest: true, name: claims.nombre?.trim() || null, expiresAt: row.expiresAt.toISOString() }
    } catch {
      await this.repository.deleteGuest(id)
      return off
    }
  }

  /**
   * Conecta la cuenta. Con sesión que conoce la cédula, esa es la que se usa (si el cuerpo trae otra: 400).
   * Con sesión sin cédula conocida (cuenta de prueba) o sin sesión, la cédula es obligatoria; sin sesión la
   * conexión es de invitado y devuelve la cookie nueva (`guestToken`). Los fallos cuentan para el límite por
   * cédula y por IP; un acierto no gasta cupo.
   */
  async connect(who: Who, body: ConnectRrhhDto, ip: string | undefined): Promise<{ status: RrhhStatusResponse; guestToken?: string }> {
    const rh = this.client()
    const session = who.userId !== undefined ? await this.session(who) : undefined
    let cedula = body.cedula
    let known: string | undefined
    if (session) {
      known = await this.auth.findSessionCedula(who.sessionToken as string)
      if (known && body.cedula) {
        throw new DomainError('Tu cédula ya está en tu sesión: escribe solo tu número de cargo.', 400, 'RRHH_CEDULA_CONOCIDA')
      }
      cedula = known ?? body.cedula
    }
    if (!cedula) throw new DomainError('Escribe tu cédula.', 400, 'RRHH_CEDULA_REQUERIDA')

    const refund = this.limiter.reserve(cedula, ip)
    let token: string
    try {
      token = await rh.loginCedula(cedula, body.password)
    } catch (err) {
      // Solo las credenciales malas gastan cupo; si RH Link está caído nadie queda bloqueado por eso.
      if (!(err instanceof DomainError && err.code === 'RRHH_CREDENCIALES')) refund()
      throw err
    }
    refund()
    const claims = this.claims(token)
    const base = { available: true, connected: true, knownCedula: known !== undefined, name: claims.nombre?.trim() || null }

    if (session) {
      const expiresAt = new Date(claims.exp * 1000)
      await this.repository.upsert({
        userId: who.userId as number,
        sessionId: session.id,
        token: this.tokens.encrypt(token, who.sessionToken as string, TOKEN_PURPOSE),
        expiresAt,
      })
      this.events.emit('rrhh.conectado', { tipo: 'sesion' }, who.userId as number)
      return { status: { ...base, guest: false, expiresAt: expiresAt.toISOString() } }
    }

    const now = new Date()
    await this.repository.purgeGuests(now)
    if (who.guestToken) await this.repository.deleteGuest(this.tokens.hash(who.guestToken))
    // Cookie nueva en cada conexión (nunca se reutiliza la anterior).
    const guestToken = this.tokens.generate()
    const expiresAt = new Date(Math.min(now.getTime() + GUEST_IDLE_MINUTES * 60_000, claims.exp * 1000))
    await this.repository.insertGuest({
      id: this.tokens.hash(guestToken),
      token: this.tokens.encrypt(token, guestToken, GUEST_TOKEN_PURPOSE),
      expiresAt,
    })
    this.events.emit('rrhh.conectado', { tipo: 'invitado' })
    return { status: { ...base, knownCedula: false, guest: true, expiresAt: expiresAt.toISOString() }, guestToken }
  }

  async disconnect(who: Who): Promise<void> {
    if (who.userId === undefined) {
      if (who.guestToken) await this.repository.deleteGuest(this.tokens.hash(who.guestToken))
      return
    }
    if (!who.sessionToken) return
    const session = await this.auth.findSession(who.sessionToken)
    if (session && session.userId === who.userId) await this.repository.deleteBySessionId(session.id)
  }

  async attendance(who: Who, q: MonthQueryDto): Promise<AttendanceResponse> {
    const r = await this.call(who, (c, rh) =>
      rh.request('GET', `/api/marcaciones/${encodeURIComponent(c.cedula)}?anio=${q.year}&mes=${q.month}`, c.token, attendanceUp),
    )
    return {
      year: q.year,
      month: q.month,
      schedule: r.horario ?? null,
      summary: { present: r.resumen.presentes, late: r.resumen.tardanzas, absent: r.resumen.ausencias, daysOff: r.resumen.dias_libres },
      days: r.marcaciones.map((d) => ({
        date: d.fecha.slice(0, 10),
        status: d.estatus ?? null,
        firstPunch: d.primera_marcacion ?? null,
        lastPunch: d.ultima_marcacion ?? null,
        hoursWorked: d.horas_trabajadas ?? null,
        regularHours: d.horas_regulares ?? null,
        late: d.tardanza ?? null,
        earlyArrival: d.entrada_antes ?? null,
        earlyLeave: d.salida_anticipada ?? null,
        overtime: d.sobretiempo ?? null,
        holiday: d.descripcion_feriado ?? null,
        exception: d.motivo_excepcion ?? null,
        absenceType: d.tipo_ausencia ?? null,
      })),
    }
  }

  async payslips(who: Who, page: number): Promise<PayslipsResponse> {
    const r = await this.call(who, (c, rh) =>
      rh.request('GET', `/api/comprobantes/${encodeURIComponent(c.cedula)}/historial?limite=${PAYSLIPS_PER_PAGE}&pagina=${page}`, c.token, historyUp),
    )
    return { page: r.paginacion.pagina, pages: r.paginacion.totalPaginas, total: r.paginacion.total, items: r.data.map(toPayslip) }
  }

  async payslipYear(who: Who, year: number): Promise<PayslipYearResponse> {
    const r = await this.call(who, (c, rh) =>
      rh.request('GET', `/api/comprobantes/${encodeURIComponent(c.cedula)}/resumen/${year}`, c.token, yearUp),
    )
    const t = r.data.totales
    return { year, totals: { gross: t.totalIngresos, deductions: t.totalDeducciones, net: t.totalNeto }, items: r.data.comprobantes.map(toPayslip) }
  }

  async payslipDetail(who: Who, payroll: number): Promise<PayslipDetailResponse> {
    const r = await this.call(who, (c, rh) =>
      rh.request('GET', `/api/comprobantes/${encodeURIComponent(c.cedula)}/detalle?numero_planilla=${payroll}`, c.token, detailUp),
    )
    return {
      payroll,
      lines: r.data.detallesPlano.map((l) => ({
        code: [l.clave, l.subclave].filter(Boolean).join('-'),
        type: l.tipo ?? null,
        amount: l.monto,
        balance: l.saldo ?? 0,
      })),
    }
  }

  async record(who: Who): Promise<RecordResponse> {
    const { data: d } = await this.call(who, (c, rh) => rh.request('GET', `/expediente/${encodeURIComponent(c.cedula)}`, c.token, recordUp))
    const f = d.informacion_funcionario
    const p = d.datos_personales
    return {
      job: {
        name: f.nombre ?? null,
        jobTitle: f.descripcion_cargo ?? null,
        department: f.direccion ?? null,
        positionNumber: f.posicion ?? null,
        payrollType: f.nombre_tipo_planilla ?? null,
        startDate: f.fecha_inicio ?? null,
        endDate: f.fecha_fin ?? null,
        status: f.estado_funcionario ?? null,
        monthlySalary: f.salario_mensual ?? null,
      },
      // La condición de salud que guarda RRHH no se trae: es un dato médico.
      personal: {
        birthDate: f.fecha_nacimiento ?? null,
        sex: f.sexo ?? null,
        maritalStatus: f.estado_civil ?? null,
        socialSecurity: maskId(f.seguro_social ?? null),
        phone: p.telefono ?? null,
        mobile: p.celular ?? null,
        email: p.email ?? null,
        province: p.provincia ?? null,
        district: p.distrito ?? null,
        township: p.corregimiento ?? null,
        neighborhood: p.barriada ?? null,
        building: p.edificio ?? null,
        house: p.casa ?? null,
        emergencyContact: p.contacto_emergencia ?? null,
        emergencyPhone: p.telefono_emergencia ?? null,
        role: p.funcion ?? null,
        area: p.area ?? null,
      },
      education: d.formacion_academica.map((e) => ({
        institution: e.institucion ?? null,
        title: e.titulo ?? null,
        comment: e.comentario ?? null,
        date: e.fecha_registro ?? null,
      })),
      evaluations: d.evaluaciones.map((e) => ({
        date: e.fecha_evaluacion ?? null,
        average: e.promedio ?? null,
        category: e.categoria ?? null,
        comments: e.comentarios ?? null,
      })),
      sanctions: d.sanciones.map((s) => ({
        date: s.fecha_registro ?? null,
        sanction: s.sancion_aplicada ?? null,
        comment: s.comentario ?? null,
        paid: s.remunerable ?? false,
      })),
      dependents: d.dependientes.map((x) => ({
        name: [x.nombre1, x.nombre2, x.apellido1, x.apellido2].filter(Boolean).join(' ') || 'Sin nombre',
        relationship: x.parentesco ?? null,
        birthDate: x.fecha_nacimiento ?? null,
        idNumber: maskId(x.cedula ?? null),
        primary: x.es_dependiente_principal ?? false,
      })),
    }
  }

  async compensatory(who: Who): Promise<CompResponse> {
    return this.call(who, async (c, rh) => {
      const [balance, requests] = await Promise.all([
        rh.request('GET', `/api/comp-tiempo/saldo/${encodeURIComponent(c.cedula)}`, c.token, balanceUp),
        rh.request('GET', '/api/comp-tiempo/solicitudes', c.token, compRequestsUp),
      ])
      const bag = (b: z.infer<typeof bagUp>) => ({
        available: b.minutos_disponibles,
        pending: b.minutos_pendientes,
        used: b.minutos_consumidos,
        expired: b.minutos_expirados,
      })
      const b = balance.data
      return {
        workdayMinutes: b.jornada_min ?? null,
        totalAvailable: b.total_disponible_min,
        balances: { before: bag(b.bolsas.ANTES), after: bag(b.bolsas.DESPUES) },
        expiring: b.proximos_vencimientos.map((v) => ({ type: v.tipo, date: v.fecha_vencimiento, minutes: v.minutos_disponibles, daysLeft: v.dias_restantes ?? null })),
        requests: requests.data.map(toCompRequest),
      }
    })
  }

  async compCandidates(who: Who, q: CandidatesQueryDto): Promise<CompCandidatesResponse> {
    const params = new URLSearchParams()
    if (q.from) params.set('desde', q.from)
    if (q.to) params.set('hasta', q.to)
    const r = await this.call(who, (c, rh) =>
      rh.request('GET', `/api/comp-tiempo/candidatos/${encodeURIComponent(c.cedula)}${params.size ? `?${params}` : ''}`, c.token, candidatesUp),
    )
    return r.data.filter((x) => x.fecha).map((x) => ({ date: x.fecha as string, type: x.tipo, minutes: x.minutos }))
  }

  async accreditComp(who: Who, d: AccreditCompDto): Promise<CompCreatedResponse> {
    const r = await this.call(who, (c, rh) =>
      rh.request('POST', '/api/comp-tiempo/solicitudes/acreditacion', c.token, createdUp, {
        cedula: c.cedula,
        tipo: d.type,
        fecha_trabajada: d.workedDate,
        motivo: d.reason || null,
      }),
    )
    return { id: r.data.id, minutes: r.data.minutos ?? null, message: r.message ?? null }
  }

  async useComp(who: Who, d: UseCompDto): Promise<CompCreatedResponse> {
    const r = await this.call(who, (c, rh) =>
      rh.request('POST', '/api/comp-tiempo/solicitudes/uso', c.token, createdUp, {
        cedula: c.cedula,
        tipo: d.type,
        unidad: d.unit,
        ...(d.unit === 'HORAS' ? { minutos: Math.round(d.amount * 60) } : { dias: d.amount }),
        fecha_desde: d.from,
        fecha_hasta: d.to ?? d.from,
        motivo: d.reason || null,
      }),
    )
    return { id: r.data.id, minutes: r.data.minutos ?? null, message: r.message ?? null }
  }

  async cancelComp(who: Who, id: number): Promise<void> {
    await this.call(who, (c, rh) => rh.request('PATCH', `/api/comp-tiempo/solicitudes/${id}/cancelar`, c.token, okUp))
  }

  // ---------- Internos ----------

  private client(): RhLinkService {
    if (!this.rh) throw new DomainError('RRHH Express no está disponible en este servidor.', 503, 'RRHH_UNAVAILABLE')
    return this.rh
  }

  /** La sesión (con cookie) de quien pide. Las apps con Bearer no tienen sesión donde guardar la conexión. */
  private async session(who: Who) {
    if (!who.sessionToken) throw new DomainError('RRHH Express solo se usa desde la intranet, con sesión iniciada.', 403, 'RRHH_SOLO_SESION')
    const session = await this.auth.findSession(who.sessionToken)
    if (!session || session.userId !== who.userId) throw new DomainError('Inicia sesión para continuar.', 401, 'AUTHENTICATION_REQUIRED')
    return session
  }

  /** Token y cédula de la conexión de quien pide (su sesión o su cookie de invitado). Si no hay o venció, hay que volver a conectar. */
  private async connection(who: Who): Promise<Connection> {
    if (who.userId === undefined) return this.guestConnection(who.guestToken)
    const session = await this.session(who)
    const row = await this.repository.findBySessionId(session.id)
    if (!row) throw new DomainError(NOT_CONNECTED, 401, 'RRHH_DESCONECTADO')
    try {
      if (row.expiresAt <= new Date()) throw new Error('vencida')
      const token = this.tokens.decrypt(row.token, who.sessionToken as string, TOKEN_PURPOSE)
      return { sessionId: session.id, token, cedula: this.claims(token).funcionarioId }
    } catch {
      await this.repository.deleteBySessionId(session.id)
      throw new DomainError(EXPIRED, 401, 'RRHH_DESCONECTADO')
    }
  }

  /** La conexión de invitado: cada uso la renueva (30 min sin uso), sin pasar de 2 horas ni del token de RH Link. */
  private async guestConnection(guestToken: string | undefined): Promise<Connection> {
    if (!guestToken) throw new DomainError('Inicia sesión o conecta tu cuenta de RRHH Express para continuar.', 401, 'AUTHENTICATION_REQUIRED')
    const id = this.tokens.hash(guestToken)
    const row = await this.repository.findGuest(id)
    if (!row) throw new DomainError(NOT_CONNECTED, 401, 'RRHH_DESCONECTADO')
    try {
      const now = Date.now()
      if (row.expiresAt.getTime() <= now) throw new Error('vencida')
      const token = this.tokens.decrypt(row.token, guestToken, GUEST_TOKEN_PURPOSE)
      const claims = this.claims(token)
      const next = Math.min(now + GUEST_IDLE_MINUTES * 60_000, row.createdAt.getTime() + GUEST_MAX_MINUTES * 60_000, claims.exp * 1000)
      if (next <= now) throw new Error('vencida')
      await this.repository.renewGuest(id, new Date(next))
      return { guestId: id, token, cedula: claims.funcionarioId }
    } catch {
      await this.repository.deleteGuest(id)
      throw new DomainError(EXPIRED, 401, 'RRHH_DESCONECTADO')
    }
  }

  /** Llama a RH Link con la conexión. Si RH Link ya no acepta el token, se borra la conexión. */
  private async call<T>(who: Who, fn: (c: Connection, rh: RhLinkService) => Promise<T>): Promise<T> {
    const rh = this.client()
    const c = await this.connection(who)
    try {
      return await fn(c, rh)
    } catch (err) {
      if (err instanceof DomainError && err.code === 'RRHH_DESCONECTADO') {
        if (c.sessionId !== undefined) await this.repository.deleteBySessionId(c.sessionId)
        if (c.guestId !== undefined) await this.repository.deleteGuest(c.guestId)
      }
      throw err
    }
  }

  /** Lee (sin verificar la firma: no tenemos la clave de RH Link) lo que trae su token. */
  private claims(token: string): z.infer<typeof tokenClaims> {
    let payload: unknown
    try {
      payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'))
    } catch {
      payload = null
    }
    const parsed = tokenClaims.safeParse(payload)
    if (!parsed.success) {
      console.error('RH Link devolvió un token sin funcionarioId o exp.')
      throw new DomainError('El sistema de RRHH tuvo un problema. Intenta de nuevo en unos minutos.', 502, 'RRHH_ERROR')
    }
    return parsed.data
  }
}

export const rrhhService = new RrhhService(rhLinkService, rrhhRepository, authService, tokenService)
