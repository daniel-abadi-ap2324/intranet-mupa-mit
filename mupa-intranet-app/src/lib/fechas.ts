/**
 * Fechas "AAAA-MM-DD" de los datos (boletines, noticias). Se leen a mano, sin
 * new Date('2026-08-05'): eso es la medianoche UTC y en Panamá (UTC-5) cae en
 * el día anterior.
 */
export const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function partes(iso: string): { anio: number; mes: number; dia: number } {
  const [a, m, d] = iso.split('-').map((x) => parseInt(x, 10))
  return { anio: a, mes: m, dia: d }
}

/** "2026-08-05" → "5 de agosto de 2026". */
export function fechaLarga(iso: string): string {
  const { anio, mes, dia } = partes(iso)
  return dia + ' de ' + MES[mes - 1] + ' de ' + anio
}

/** "2026-08-05" → "agosto de 2026". */
export function mesAnio(iso: string): string {
  const { anio, mes } = partes(iso)
  return MES[mes - 1] + ' de ' + anio
}

/** "2026-08-05" → Date a la medianoche local. */
export function aFecha(iso: string): Date {
  const { anio, mes, dia } = partes(iso)
  return new Date(anio, mes - 1, dia)
}

/** Fecha local de hoy en "AAAA-MM-DD". */
export function hoyIso(hoy = new Date()): string {
  const d = (n: number) => String(n).padStart(2, '0')
  return hoy.getFullYear() + '-' + d(hoy.getMonth() + 1) + '-' + d(hoy.getDate())
}

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export const mesCorto = (iso: string) => MES_CORTO[partes(iso).mes - 1]

/** "2026-08-05" → "5 ago 2026". */
export function fechaCorta(iso: string): string {
  const { anio, dia } = partes(iso)
  return dia + ' ' + mesCorto(iso) + ' ' + anio
}

/** "2026-08-05" → "miércoles 5 de agosto de 2026". */
export const diaLargo = (iso: string) => DIA[aFecha(iso).getDay()] + ' ' + fechaLarga(iso)

export const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Cuántas fechas son de los últimos 90 días y posteriores a la última vista
 * (el contador de boletines nuevos del menú). `visto`: "AAAA-MM-DD" o ''.
 */
export function recientesSinVer(fechas: string[], visto: string, hoy = new Date()): number {
  const limite = hoyIso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 90))
  return fechas.filter((f) => f > limite && f > visto).length
}
