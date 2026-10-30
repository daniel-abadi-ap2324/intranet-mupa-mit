/** Solicitudes de código de llamada: abiertas o cerradas por su estado, clase de estado, historial en español y título. */
import { describe, expect, it } from 'vitest'

import { claseEstadoCodigo, codigoAbierto, diaDe, horaDe, textoAccion, tituloCodigo, type SolicitudCodigo } from '@/lib/codigosLlamada'

const solicitud = (estadoId: number, extra: Partial<SolicitudCodigo> = {}): SolicitudCodigo => ({
  numero: 1, estadoId, estado: 'x', creada: '2026-09-15T10:32:00', actualizada: '2026-09-17T14:05:00', ubicacion: 'Dirección Ficticia', linea: 'LOCALES', extension: '4521', motivoRechazo: null, historial: [], ...extra,
})

describe('estados', () => {
  it('abiertas: pendientes (1 a 3) y aprobada (4); cerradas: rechazada, procesada y anulada', () => {
    expect([1, 2, 3, 4].map((id) => codigoAbierto(solicitud(id)))).toEqual([true, true, true, true])
    expect([5, 6, 7].map((id) => codigoAbierto(solicitud(id)))).toEqual([false, false, false])
  })

  it('cada estado tiene su clase', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(claseEstadoCodigo)).toEqual(['asg', 'asg', 'asg', 'asg', 'rev', 'ok', 'off'])
  })
})

describe('historial y fechas', () => {
  it('traduce las acciones del historial; una desconocida se dice como puede', () => {
    expect(textoAccion('CREATE')).toBe('Solicitud creada')
    expect(textoAccion('PROCESS')).toBe('Procesada: se generó el código')
    expect(textoAccion('ANULAR')).toBe('Anulada')
    expect(textoAccion('NUEVA_ACCION')).toBe('Nueva accion')
  })

  it('separa el día y la hora de la fecha sin zona', () => {
    expect(diaDe('2026-09-15T14:05:00')).toBe('2026-09-15')
    expect(horaDe('2026-09-15T14:05:00')).toBe('14:05')
    expect(horaDe('2026-09-15')).toBeNull()
  })
})

describe('tituloCodigo', () => {
  it('línea y extensión; con partes que falten, las que haya', () => {
    expect(tituloCodigo(solicitud(1))).toBe('Línea LOCALES · ext. 4521')
    expect(tituloCodigo(solicitud(1, { extension: null }))).toBe('Línea LOCALES')
    expect(tituloCodigo(solicitud(1, { linea: null, extension: null }))).toBe('Código de llamada')
  })
})
