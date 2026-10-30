/** Utilidades de RRHH Express: montos, horas, antigüedad, calendario del mes y cómo se ve cada día. */
import { describe, expect, it } from 'vitest'

import { antiguedad, minutosAHoras, moneda, mensajeConexion, moverMes, pagosPorFecha, periodo, semanasDelMes, tipoDia, validarConexion, type Comprobante, type DiaMarcacion } from '@/lib/rrhh'

const dia = (d: Partial<DiaMarcacion>): DiaMarcacion => ({
  fecha: '2026-09-01',
  estado: null,
  entrada: null,
  salida: null,
  horas: null,
  horasRegulares: null,
  tardanza: null,
  entradaAntes: null,
  salidaAnticipada: null,
  sobretiempo: null,
  feriado: null,
  excepcion: null,
  ausencia: null,
  ...d,
})

describe('RRHH Express', () => {
  it('montos en balboas', () => {
    expect(moneda(1234.5)).toBe('B/. 1,234.50')
    expect(moneda(0)).toBe('B/. 0.00')
  })

  it('minutos a horas', () => {
    expect(minutosAHoras(0)).toBe('0 min')
    expect(minutosAHoras(45)).toBe('45 min')
    expect(minutosAHoras(60)).toBe('1 h')
    expect(minutosAHoras(90)).toBe('1 h 30 min')
  })

  it('antigüedad', () => {
    const hoy = new Date(2026, 9, 1)
    expect(antiguedad('2015-03-01', hoy)).toBe('11 años y 7 meses')
    expect(antiguedad('2025-10-01', hoy)).toBe('1 año')
    expect(antiguedad('2026-08-15', hoy)).toBe('1 mes')
    expect(antiguedad('2026-09-20', hoy)).toBe('menos de un mes')
  })

  it('mover de mes cruza el año', () => {
    expect(moverMes(2026, 1, -1)).toEqual({ anio: 2025, mes: 12 })
    expect(moverMes(2026, 12, 1)).toEqual({ anio: 2027, mes: 1 })
  })

  it('el calendario empieza en lunes y tiene semanas completas', () => {
    // Septiembre de 2026 empieza en martes y tiene 30 días.
    const s = semanasDelMes(2026, 9, [dia({ fecha: '2026-09-02', estado: 'FERIADO' })])
    expect(s[0][0]).toBeNull()
    expect(s[0][1]?.fecha).toBe('2026-09-01')
    expect(s[0][2]?.dato?.estado).toBe('FERIADO')
    expect(s.every((sem) => sem.length === 7)).toBe(true)
    expect(s.flat().filter(Boolean)).toHaveLength(30)
  })

  it('cómo se ve cada día', () => {
    expect(tipoDia(null).tipo).toBe('sin-dato')
    expect(tipoDia(dia({ estado: 'FERIADO', feriado: 'Independencia' })).etiqueta).toBe('Feriado: Independencia')
    expect(tipoDia(dia({ estado: 'DIA_LIBRE' })).tipo).toBe('libre')
    expect(tipoDia(dia({ estado: 'AUSENCIA' })).tipo).toBe('ausencia')
    expect(tipoDia(dia({ estado: 'COMPLETA', entrada: '07:58', salida: '16:02' })).tipo).toBe('presente')
    expect(tipoDia(dia({ estado: 'COMPLETA', entrada: '08:20', salida: '16:00', tardanza: '00:20' })).etiqueta).toBe('Tardanza de 20 min')
    expect(tipoDia(dia({ estado: 'INCOMPLETA', entrada: '08:00', salida: '08:00' })).tipo).toBe('incompleta')
  })

  it('período de un comprobante', () => {
    const c = (anio: number | null, mes: number | null, quincena: number | null) => ({ periodo: { anio, mes, quincena }, fecha: null }) as Comprobante
    expect(periodo(c(2026, 9, 2))).toBe('2.ª quincena de septiembre 2026')
    expect(periodo(c(2026, 0, 2))).toBe('Pago especial 2026')
  })
})

describe('conectar RRHH Express: lo que se revisa y lo que se dice', () => {
  const base = { pedirCedula: false, cedula: '', clave: '' }

  it('con la cédula ya conocida solo se revisa el número de cargo: obligatorio y solo números', () => {
    expect(validarConexion(base)).toEqual({ clave: 'Escribe tu número de cargo.' })
    expect(validarConexion({ ...base, clave: '  ' })).toEqual({ clave: 'Escribe tu número de cargo.' })
    expect(validarConexion({ ...base, clave: '12ab' })).toEqual({ clave: 'El número de cargo tiene solo números.' })
    expect(validarConexion({ ...base, clave: ' 424 ' })).toEqual({})
  })

  it('sin cédula conocida también se pide la cédula, con guiones', () => {
    const d = { ...base, pedirCedula: true, clave: '424' }
    expect(validarConexion(d).cedula).toMatch(/con guiones/)
    expect(validarConexion({ ...d, cedula: '8000100' }).cedula).toBeDefined()
    expect(validarConexion({ ...d, cedula: '8-123-456' })).toEqual({})
    expect(validarConexion({ ...d, cedula: 'e-8-12345' })).toEqual({})
  })

  it('las credenciales malas dan un solo mensaje (no dicen cuál dato falló)', () => {
    expect(mensajeConexion('RRHH_CREDENCIALES', 401, { pedirCedula: true })).toBe('La cédula o el número de cargo no coinciden.')
    expect(mensajeConexion('RRHH_CREDENCIALES', 401, { pedirCedula: false })).toBe('El número de cargo no coincide.')
  })

  it('demasiados intentos y RRHH caído tienen su propio aviso', () => {
    const d = { pedirCedula: true }
    expect(mensajeConexion('RRHH_DEMASIADOS_INTENTOS', 429, d)).toMatch(/varios intentos.*15 minutos/)
    expect(mensajeConexion('RRHH_UNAVAILABLE', 503, d)).toMatch(/no responde/)
    expect(mensajeConexion(null, 502, d)).toMatch(/no responde/)
  })

  it('junta los pagos del mismo día en una barra y deja aparte los de otras fechas', () => {
    const c = (planilla: number, cheque: number | null, fecha: string | null, bruto: number, neto: number) =>
      ({ planilla, cheque, fecha, bruto, neto, periodo: { anio: 2026, mes: 9, quincena: 2 } }) as Comprobante
    const dias = pagosPorFecha([c(10, 2, '2026-09-30', 300, 250), c(9, 1, '2026-09-15', 1000, 852), c(10, 1, '2026-09-30', 1000, 852), c(11, null, null, 50, 40)])
    expect(dias.map((d) => d.fecha)).toEqual([null, '2026-09-15', '2026-09-30'])
    const doble = dias[2]
    expect(doble.pagos).toHaveLength(2)
    expect(doble.bruto).toBe(1300)
    expect(doble.neto).toBe(1102)
    expect(new Set(dias.map((d) => d.clave)).size).toBe(3)
  })
})
