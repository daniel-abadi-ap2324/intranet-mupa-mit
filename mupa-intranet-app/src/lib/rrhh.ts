/**
 * RRHH Express dentro de la intranet: los tipos de lo que devuelve la API (/api/rrhh)
 * y utilidades puras para mostrarlo (montos, horas, antigüedad, calendario del mes).
 */
import { MES, partes } from './fechas'

export type ConexionRrhh = {
  disponible: boolean
  conectada: boolean
  /** La sesión ya conoce la cédula (entró con Identity Central): solo se pide el número de cargo. */
  cedulaConocida: boolean
  /** Conexión de invitado: sin sesión en la intranet; se cierra sola tras unos minutos sin uso. */
  invitado: boolean
  nombre: string | null
  vence: string | null
  /** RRHH Express en mantenimiento: la pestaña entera lo dice. */
  mantenimiento?: boolean
}

/** Cédula panameña con guiones (la misma regla que la API). */
export const CEDULA = /^(PE|E|N|[1-9]|1[0-3])(AV|PI)?-\d{1,4}-\d{1,6}$/i

export type ErroresConexion = { cedula?: string; clave?: string }

/**
 * Lo que se revisa antes de mandar a RRHH Express. `pedirCedula`: la sesión no conoce la cédula (o no hay sesión).
 */
export function validarConexion(d: { pedirCedula: boolean; cedula: string; clave: string }): ErroresConexion {
  const e: ErroresConexion = {}
  if (d.pedirCedula && !CEDULA.test(d.cedula.trim())) e.cedula = 'Escribe tu cédula con guiones, por ejemplo 8-123-456.'
  const clave = d.clave.trim()
  if (!clave) e.clave = 'Escribe tu número de cargo.'
  else if (!/^\d+$/.test(clave)) e.clave = 'El número de cargo tiene solo números.'
  return e
}

/** El mensaje para la persona cuando RRHH Express no deja conectar. Las credenciales malas dan un solo mensaje. */
export function mensajeConexion(codigo: string | null, estado: number, d: { pedirCedula: boolean }): string {
  if (codigo === 'RRHH_CREDENCIALES') {
    return d.pedirCedula ? 'La cédula o el número de cargo no coinciden.' : 'El número de cargo no coincide.'
  }
  if (codigo === 'RRHH_DEMASIADOS_INTENTOS') return 'Hiciste varios intentos seguidos. Espera unos 15 minutos e inténtalo de nuevo.'
  if (codigo === 'RRHH_UNAVAILABLE' || codigo === 'RRHH_ERROR' || estado >= 500) return 'El sistema de RRHH no responde. Espera unos minutos y vuelve a intentarlo.'
  return 'No se pudo conectar. Revisa los datos e inténtalo de nuevo.'
}

export type DiaMarcacion = {
  fecha: string
  estado: string | null
  entrada: string | null
  salida: string | null
  horas: string | null
  horasRegulares: string | null
  tardanza: string | null
  entradaAntes: string | null
  salidaAnticipada: string | null
  sobretiempo: string | null
  feriado: string | null
  excepcion: string | null
  ausencia: string | null
}

export type MarcacionesMes = {
  anio: number
  mes: number
  horario: string | null
  resumen: { presentes: number; tardanzas: number; ausencias: number; libres: number }
  dias: DiaMarcacion[]
}

export type Comprobante = {
  planilla: number
  cheque: number | null
  fecha: string | null
  periodo: { anio: number | null; mes: number | null; quincena: number | null }
  cargo: string | null
  diasPagados: number | null
  bruto: number
  descuentos: { seguroSocial: number; seguroEducativo: number; impuestoRenta: number; fondoComplementario: number; asemup: number; otros: number; total: number }
  neto: number
  formaPago: string | null
  banco: string | null
  tipoCuenta: string | null
  cuenta: string | null
}

export type PaginaComprobantes = { pagina: number; paginas: number; total: number; items: Comprobante[] }
export type ResumenAnual = { anio: number; totales: { bruto: number; descuentos: number; neto: number }; items: Comprobante[] }
export type DetalleComprobante = { planilla: number; lineas: { codigo: string; tipo: string | null; monto: number; saldo: number }[] }

export type Expediente = {
  laboral: {
    nombre: string | null
    cargo: string | null
    direccion: string | null
    posicion: number | null
    planilla: string | null
    inicio: string | null
    fin: string | null
    estado: string | null
    salarioMensual: number | null
  }
  personal: {
    nacimiento: string | null
    sexo: string | null
    estadoCivil: string | null
    seguroSocial: string | null
    telefono: string | null
    celular: string | null
    correo: string | null
    provincia: string | null
    distrito: string | null
    corregimiento: string | null
    barriada: string | null
    edificio: string | null
    casa: string | null
    contactoEmergencia: string | null
    telefonoEmergencia: string | null
    funcion: string | null
    area: string | null
  }
  formacion: { institucion: string | null; titulo: string | null; comentario: string | null; fecha: string | null }[]
  evaluaciones: { fecha: string | null; promedio: number | null; categoria: string | null; comentarios: string | null }[]
  sanciones: { fecha: string | null; sancion: string | null; comentario: string | null; remunerable: boolean }[]
  dependientes: { nombre: string; parentesco: string | null; nacimiento: string | null; cedula: string | null; principal: boolean }[]
}

export type Bolsa = 'ANTES' | 'DESPUES'
export type SaldoBolsa = { disponible: number; pendiente: number; usado: number; vencido: number }

export type SolicitudCompensatorio = {
  id: number
  clase: string | null
  bolsa: string | null
  unidad: string | null
  minutos: number | null
  dias: number | null
  fechaTrabajada: string | null
  desde: string | null
  hasta: string | null
  motivo: string | null
  estado: string | null
  motivoRechazo: string | null
  creada: string | null
}

export type Compensatorio = {
  jornadaMin: number | null
  totalDisponible: number
  bolsas: Record<Bolsa, SaldoBolsa>
  vencimientos: { bolsa: string | null; fecha: string | null; minutos: number; diasRestantes: number | null }[]
  solicitudes: SolicitudCompensatorio[]
}

export type DiaReclamable = { fecha: string; bolsa: string; minutos: number }

// ---------- Utilidades ----------

const B = new Intl.NumberFormat('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 1234.5 → "B/. 1,234.50". */
export const moneda = (n: number) => 'B/. ' + B.format(n)

/** 90 → "1 h 30 min"; 45 → "45 min"; 0 → "0 min". */
export function minutosAHoras(min: number): string {
  const m = Math.round(Math.abs(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  const signo = min < 0 ? '−' : ''
  if (!h) return signo + r + ' min'
  return signo + h + ' h' + (r ? ' ' + r + ' min' : '')
}

/** Tiempo desde "AAAA-MM-DD" hasta hoy: "10 años y 7 meses", "3 meses", "menos de un mes". */
export function antiguedad(inicio: string, hoy = new Date()): string {
  const { anio, mes, dia } = partes(inicio)
  let meses = (hoy.getFullYear() - anio) * 12 + (hoy.getMonth() + 1 - mes)
  if (hoy.getDate() < dia) meses--
  if (meses < 1) return 'menos de un mes'
  const a = Math.floor(meses / 12)
  const m = meses % 12
  const txt = (n: number, uno: string, varios: string) => n + ' ' + (n === 1 ? uno : varios)
  if (!a) return txt(m, 'mes', 'meses')
  return txt(a, 'año', 'años') + (m ? ' y ' + txt(m, 'mes', 'meses') : '')
}

/** "Septiembre 2026" a partir de año y mes (1-12). */
export const nombreMes = (anio: number, mes: number) => MES[mes - 1].charAt(0).toUpperCase() + MES[mes - 1].slice(1) + ' ' + anio

/** Mes anterior o siguiente. */
export function moverMes(anio: number, mes: number, delta: number): { anio: number; mes: number } {
  const i = anio * 12 + (mes - 1) + delta
  return { anio: Math.floor(i / 12), mes: (i % 12) + 1 }
}

/** Período de un comprobante: "2.ª quincena de septiembre 2026", o "Pago especial 2026" (mes 0). */
export function periodo(c: Comprobante): string {
  const { anio, mes, quincena } = c.periodo
  if (anio && mes && mes >= 1 && mes <= 12 && quincena) return (quincena === 1 ? '1.ª' : '2.ª') + ' quincena de ' + MES[mes - 1] + ' ' + anio
  if (anio) return 'Pago especial ' + anio
  return c.fecha ?? 'Pago'
}

/** Un día de pago del gráfico: uno o más comprobantes de la misma fecha, sumados. */
export type DiaDePago = { clave: string; fecha: string | null; base: Comprobante; pagos: Comprobante[]; bruto: number; neto: number }

/**
 * Junta los comprobantes del mismo día (a veces RRHH paga dos en una fecha) para que el gráfico
 * tenga una barra por día. Sin fecha, cada planilla va aparte. Ordena del más viejo al más nuevo.
 */
export function pagosPorFecha(items: Comprobante[]): DiaDePago[] {
  const dias = new Map<string, DiaDePago>()
  items.forEach((c, i) => {
    const clave = c.fecha ? 'f' + c.fecha.slice(0, 10) : 'p' + c.planilla + '-' + (c.cheque ?? i)
    const d = dias.get(clave)
    if (d) {
      d.pagos.push(c)
      d.bruto += c.bruto
      d.neto += c.neto
    } else dias.set(clave, { clave, fecha: c.fecha, base: c, pagos: [c], bruto: c.bruto, neto: c.neto })
  })
  return [...dias.values()].sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
}

export type Celda = { fecha: string; dia: number; dato: DiaMarcacion | null } | null

/**
 * Semanas del mes (de lunes a domingo) para el calendario. Cada celda es un día del
 * mes con su marcación (o null si RRHH no tiene dato) o null fuera del mes.
 */
export function semanasDelMes(anio: number, mes: number, dias: DiaMarcacion[]): Celda[][] {
  const porFecha = new Map(dias.map((d) => [d.fecha, d]))
  const total = new Date(anio, mes, 0).getDate()
  // getDay: 0 = domingo. Lunes primero: lunes = 0 … domingo = 6.
  const primero = (new Date(anio, mes - 1, 1).getDay() + 6) % 7
  const celdas: Celda[] = Array.from({ length: primero }, () => null)
  for (let d = 1; d <= total; d++) {
    const fecha = anio + '-' + String(mes).padStart(2, '0') + '-' + String(d).padStart(2, '0')
    celdas.push({ fecha, dia: d, dato: porFecha.get(fecha) ?? null })
  }
  while (celdas.length % 7) celdas.push(null)
  const semanas: Celda[][] = []
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7))
  return semanas
}

export type TipoDia = 'presente' | 'tardanza' | 'ausencia' | 'justificada' | 'feriado' | 'libre' | 'exceptuado' | 'incompleta' | 'sin-dato'

/** Cómo se ve un día: tono del calendario y su etiqueta. Lo que RRHH no clasifica se muestra por sus marcas. */
export function tipoDia(d: DiaMarcacion | null): { tipo: TipoDia; etiqueta: string } {
  if (!d) return { tipo: 'sin-dato', etiqueta: 'Sin marcación' }
  switch (d.estado) {
    case 'FERIADO':
      return { tipo: 'feriado', etiqueta: d.feriado ? 'Feriado: ' + d.feriado : 'Feriado' }
    case 'DIA_LIBRE':
      return { tipo: 'libre', etiqueta: 'Día libre' }
    case 'AUSENCIA':
      return { tipo: 'ausencia', etiqueta: 'Ausencia' }
    case 'AUSENCIA_JUSTIFICADA':
      return { tipo: 'justificada', etiqueta: d.ausencia ? 'Ausencia justificada: ' + d.ausencia.toLowerCase() : 'Ausencia justificada' }
    case 'EXCEPTUADO':
      return { tipo: 'exceptuado', etiqueta: d.excepcion ? 'Exceptuado de marcar: ' + d.excepcion.toLowerCase() : 'Exceptuado de marcar' }
  }
  if (!d.entrada || d.entrada === '00:00') return { tipo: 'sin-dato', etiqueta: 'Sin marcación' }
  if (!d.salida || d.salida === d.entrada) return { tipo: 'incompleta', etiqueta: 'Falta una marcación' }
  if (d.tardanza && d.tardanza !== '00:00') return { tipo: 'tardanza', etiqueta: 'Tardanza de ' + duracion(d.tardanza) }
  return { tipo: 'presente', etiqueta: 'Presente' }
}

/** "01:05" (h:mm) → "1 h 5 min". */
export function duracion(hhmm: string): string {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10))
  return Number.isNaN(h) ? hhmm : minutosAHoras(h * 60 + (m || 0))
}

/** Estado de una solicitud de compensatorio, en español. */
export const ESTADO_SOLICITUD: Record<string, { t: string; tono: 'ok' | 'warn' | 'brand' | null }> = {
  PENDIENTE: { t: 'Pendiente', tono: 'warn' },
  APROBADA: { t: 'Aprobada', tono: 'ok' },
  RECHAZADA: { t: 'Rechazada', tono: null },
  CANCELADA: { t: 'Cancelada', tono: null },
}

/** Las dos bolsas: tiempo por llegar antes y por quedarse después de la hora. */
export const BOLSA: Record<Bolsa, string> = { ANTES: 'Entrada anticipada', DESPUES: 'Sobretiempo' }

/** Formas de pago y tipos de cuenta de la planilla (los códigos que no están aquí se muestran tal cual). */
export const FORMA_PAGO: Record<string, string> = { AC: 'ACH (depósito a cuenta)' }
export const TIPO_CUENTA: Record<string, string> = { S: 'Ahorros', C: 'Corriente' }
