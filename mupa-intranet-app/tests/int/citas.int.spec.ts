/** «Mis citas» de la Clínica: estados con su texto, la hora en 12 h y la separación entre próximas e historial. */
import { describe, expect, it } from 'vitest'

import { citaAbierta, claseEstadoCita, estadoCita, horaCita, separarCitas, tituloCita, type CitaClinica } from '@/lib/clinica'

const cita = (id: string, fecha: string, estado: string, hora: string | null = '09:30'): CitaClinica => ({
  id, fecha, hora, tipo: 'CONSULTA', especialidad: 'Medicina general', medico: 'Dra. Ficticia', estado, atendida: estado === 'ATENDIDA', cancelada: estado === 'CANCELADA',
})

describe('estadoCita', () => {
  it('traduce los siete estados del sistema de la Clínica', () => {
    expect(estadoCita('AGENDADA')).toEqual({ texto: 'Agendada', tono: 'info' })
    expect(estadoCita('EN_ESPERA').texto).toBe('En espera del médico')
    expect(estadoCita('ATENDIDA').tono).toBe('ok')
    expect(estadoCita('ASISTIO').texto).toBe('Asististe')
    expect(estadoCita('NO_ASISTIO').tono).toBe('warn')
    expect(estadoCita('VENCIDA').tono).toBe('warn')
    expect(estadoCita('CANCELADA').tono).toBe('off')
  })

  it('un estado nuevo que la intranet no conoce se muestra legible, sin romperse', () => {
    expect(estadoCita('EN_PROCESO')).toEqual({ texto: 'En proceso', tono: 'off' })
  })
})

describe('horaCita', () => {
  it.each([
    ['09:30', '9:30 a. m.'],
    ['14:05', '2:05 p. m.'],
    ['00:15', '12:15 a. m.'],
    ['12:00:00', '12:00 p. m.'],
  ])('%s → %s', (hora, esperado) => expect(horaCita(hora)).toBe(esperado))

  it('sin hora o con una que no se entiende no inventa nada', () => {
    expect(horaCita(null)).toBeNull()
    expect(horaCita('mañana')).toBeNull()
  })
})

describe('separarCitas', () => {
  const hoy = '2026-10-06'
  const citas = [
    cita('1', '2026-09-01', 'ATENDIDA'),
    cita('2', '2026-10-20', 'AGENDADA'),
    cita('3', '2026-10-10', 'AGENDADA', '08:00'),
    cita('4', '2026-10-06', 'EN_ESPERA'),
    cita('5', '2026-10-08', 'CANCELADA'),
    cita('6', '2026-09-20', 'VENCIDA'),
    cita('7', '2026-10-01', 'AGENDADA'),
  ]

  it('próximas: agendadas o en espera desde hoy, la más cercana primero; lo demás es historial, lo más reciente primero', () => {
    const { proximas, historial } = separarCitas(citas, hoy)
    expect(proximas.map((c) => c.id)).toEqual(['4', '3', '2'])
    expect(historial.map((c) => c.id)).toEqual(['5', '7', '6', '1'])
  })

  it('una cita agendada cuya fecha ya pasó no cuenta como próxima', () => {
    expect(separarCitas([cita('9', '2026-10-05', 'AGENDADA')], hoy).proximas).toEqual([])
  })
})

describe('citas como solicitudes', () => {
  it('abierta = agendada o en espera con la fecha de hoy o futura', () => {
    expect(citaAbierta(cita('1', '2026-10-06', 'EN_ESPERA'), '2026-10-06')).toBe(true)
    expect(citaAbierta(cita('2', '2026-10-07', 'AGENDADA'), '2026-10-06')).toBe(true)
    expect(citaAbierta(cita('3', '2026-10-05', 'AGENDADA'), '2026-10-06')).toBe(false)
    expect(citaAbierta(cita('4', '2026-10-09', 'CANCELADA'), '2026-10-06')).toBe(false)
    expect(citaAbierta(cita('5', '2026-09-01', 'ATENDIDA'), '2026-10-06')).toBe(false)
  })

  it('el título dice el tipo y la especialidad; el estado usa las clases del bloque del Inicio', () => {
    expect(tituloCita(cita('1', '2026-10-06', 'AGENDADA'))).toBe('Cita · Medicina general')
    expect(tituloCita({ ...cita('2', '2026-10-06', 'AGENDADA'), tipo: 'CUPOS' })).toBe('Cita · Medicina general')
    expect(tituloCita({ ...cita('3', '2026-10-06', 'AGENDADA'), tipo: 'URGENCIA' })).toBe('Urgencia · Medicina general')
    expect(tituloCita({ ...cita('4', '2026-10-06', 'AGENDADA'), tipo: null, especialidad: null })).toBe('Cita médica')
    expect(tituloCita({ ...cita('5', '2026-10-06', 'AGENDADA'), tipo: 'URGENCIA', especialidad: null })).toBe('Urgencia')
    expect(claseEstadoCita('ATENDIDA')).toBe('ok')
    expect(claseEstadoCita('AGENDADA')).toBe('asg')
    expect(claseEstadoCita('VENCIDA')).toBe('rev')
    expect(claseEstadoCita('CANCELADA')).toBe('off')
  })
})
