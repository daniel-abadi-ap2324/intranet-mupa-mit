/**
 * Simulación de los sistemas de cada servicio (Clínica, códigos de llamada, Mesa de Ayuda) y de RH Link para las
 * pruebas del Inicio: el backend de pruebas no los tiene. Datos ficticios.
 */
import type { Page } from '@playwright/test'

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Panama' })
const HOY = new Date()

export type Opciones = { clinica?: 'ok' | 'error' | 'apagada'; glpi?: 'ok' | 'error'; codigos?: 'ok' | 'error'; rrhh?: boolean }

/** Simula los sistemas de cada servicio y cuenta cuántas veces se les pregunta. */
export async function simular(page: Page, o: Opciones = {}) {
  const llamadas = { clinica: 0, glpi: 0, codigos: 0, rrhhDatos: 0 }
  await page.route('**/api/clinic/appointments', (r) => {
    llamadas.clinica++
    if (o.clinica === 'error') return r.fulfill(json({ error: 'X' }, 502))
    if (o.clinica === 'apagada') return r.fulfill(json({ available: false, knownCedula: false, patientFound: false, total: 0, appointments: [] }))
    return r.fulfill(
      json({
        available: true,
        knownCedula: true,
        patientFound: true,
        total: 2,
        appointments: [
          { id: '9', date: dia(20), time: '14:05', type: 'CONSULTA', specialty: 'Odontología', doctor: null, status: 'AGENDADA', attended: false, cancelled: false },
          { id: '8', date: dia(5), time: '09:30', type: 'CONSULTA', specialty: 'Medicina general', doctor: null, status: 'AGENDADA', attended: false, cancelled: false },
        ],
      }),
    )
  })
  await page.route('**/api/glpi/tickets', (r) => {
    llamadas.glpi++
    if (o.glpi === 'error') return r.fulfill(json({ error: 'X' }, 502))
    return r.fulfill(
      json({
        available: true,
        knownCedula: true,
        userFound: true,
        total: 1,
        tickets: [{ id: 41, title: 'No abre el correo', status: 2, openedAt: dia(-2) + ' 08:00:00', updatedAt: dia(-1) + ' 10:00:00' }],
      }),
    )
  })
  await page.route('**/api/call-codes/requests', (r) => {
    llamadas.codigos++
    if (o.codigos === 'error') return r.fulfill(json({ error: 'X' }, 502))
    return r.fulfill(json({ available: true, knownCedula: true, total: 0, requests: [] }))
  })
  const conexion = (conectada: boolean) => ({ available: true, connected: conectada, knownCedula: true, guest: false, name: 'Persona Ficticia', expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() })
  await page.route('**/api/rrhh/**', (r) => {
    const ruta = new URL(r.request().url()).pathname.replace('/api/rrhh', '')
    if (ruta === '/conexion') return r.fulfill(json(conexion(!!o.rrhh)))
    llamadas.rrhhDatos++
    if (ruta === '/compensatorio')
      return r.fulfill(json({ workdayMinutes: 480, totalAvailable: 270, balances: { before: { available: 0, pending: 0, used: 0, expired: 0 }, after: { available: 270, pending: 0, used: 0, expired: 0 } }, expiring: [], requests: [] }))
    if (ruta === '/marcaciones')
      return r.fulfill(json({ year: HOY.getFullYear(), month: HOY.getMonth() + 1, schedule: 'L-V', summary: { present: 12, late: 2, absent: 0, daysOff: 4 }, days: [] }))
    if (ruta === '/comprobantes')
      return r.fulfill(
        json({
          page: 1,
          pages: 1,
          total: 1,
          items: [{ payroll: 9, voucher: 1, date: '2026-10-15', period: { year: 2026, month: 10, half: 1 }, jobTitle: null, daysPaid: 15, gross: 1000, deductions: { socialSecurity: 0, educationInsurance: 0, incomeTax: 0, complementaryFund: 0, asemup: 0, other: 0, total: 0 }, net: 1000, paymentMethod: 'AC', bank: null, accountType: null, account: null }],
        }),
      )
    return r.fulfill(json({ error: 'ROUTE_NOT_FOUND' }, 404))
  })
  return llamadas
}

