/**
 * RRHH Express en la pestaña Recursos Humanos. El backend de pruebas no tiene RH Link
 * (sin RRHH_API_URL): aquí se simula /api/rrhh/** con datos ficticios. La conexión,
 * el cifrado y que solo se vean los datos propios se prueban en la API (tests/rrhh).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { entrar, vigilarErrores } from './ayuda'

const HOY = new Date()
const ANIO = HOY.getFullYear()
const MES = HOY.getMonth() + 1
const iso = (d: number) => `${ANIO}-${String(MES).padStart(2, '0')}-${String(d).padStart(2, '0')}`

const pago = (n: number) => ({
  payroll: 900 + n,
  voucher: 5000 + n,
  date: `${ANIO}-0${n}-15`,
  period: { year: ANIO, month: n, half: 1 },
  jobTitle: 'Analista de prueba',
  daysPaid: 15,
  gross: 1000,
  deductions: { socialSecurity: 97.5, educationInsurance: 12.5, incomeTax: 10, complementaryFund: 3, asemup: 5, other: 20, total: 148 },
  net: 852,
  paymentMethod: 'AC',
  bank: '71',
  accountType: 'S',
  account: '••••7890',
})

/** Un pago especial el mismo día y con la misma planilla que pago(2): el gráfico tiene que juntarlos en una barra. */
const extra = { ...pago(2), voucher: 6002, period: { year: ANIO, month: 0, half: null }, gross: 300, net: 250 }

/** RH Link simulado: `conectada` cambia con conectar y desconectar. Devuelve lo que se pidió. */
async function simular(page: Page, opciones: { disponible?: boolean; conectada?: boolean; vence?: boolean; conocida?: boolean; sesion?: boolean; limite?: boolean } = {}) {
  const estado = { conectada: opciones.conectada ?? false, usos: [] as unknown[], cancelada: false, conexiones: [] as Array<Record<string, unknown>> }
  // `conocida`: la sesión ya conoce la cédula. Sin `sesion` la conexión es de invitado.
  const conocida = opciones.conocida ?? false
  const invitado = !(opciones.sesion ?? conocida)
  const off = { available: opciones.disponible ?? true, connected: false, knownCedula: conocida, guest: false, name: null, expiresAt: null }
  const on = { available: true, connected: true, knownCedula: conocida, guest: invitado, name: 'Persona Ficticia', expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() }
  const desconectada = { status: 401, json: { error: 'RRHH_DESCONECTADO', message: 'Tu conexión con RRHH Express venció. Vuelve a conectarla.' } }

  await page.route('**/api/rrhh/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const ruta = url.pathname.replace('/api/rrhh', '')
    const m = req.method()
    if (ruta === '/conexion' && m === 'GET') return route.fulfill({ json: estado.conectada ? on : off })
    if (ruta === '/conexion' && m === 'POST') {
      const cuerpo = req.postDataJSON() as { cedula?: string; password: string }
      estado.conexiones.push(cuerpo)
      if (opciones.limite) return route.fulfill({ status: 429, json: { error: 'RRHH_DEMASIADOS_INTENTOS', message: 'Hiciste varios intentos seguidos.' } })
      // Con la cédula ya conocida el navegador no la manda; sin ella es obligatoria.
      if (conocida && cuerpo.cedula) return route.fulfill({ status: 400, json: { error: 'RRHH_CEDULA_CONOCIDA', message: 'Tu cédula ya está en tu sesión.' } })
      const buena = (conocida || cuerpo.cedula === '8-000-101') && ['clave-ficticia', '123456'].includes(cuerpo.password)
      if (!buena) return route.fulfill({ status: 401, json: { error: 'RRHH_CREDENCIALES', message: 'La cédula o la contraseña de RRHH Express no son correctas, o la cuenta no está activa.' } })
      estado.conectada = true
      return route.fulfill({ json: on })
    }
    if (ruta === '/conexion' && m === 'DELETE') {
      estado.conectada = false
      return route.fulfill({ status: 204 })
    }
    if (!estado.conectada || opciones.vence) {
      estado.conectada = false
      return route.fulfill(desconectada)
    }
    if (ruta === '/marcaciones') {
      const ym = url.searchParams.get('year') + '-' + String(url.searchParams.get('month')).padStart(2, '0')
      return route.fulfill({
        json: {
          year: Number(url.searchParams.get('year')),
          month: Number(url.searchParams.get('month')),
          schedule: 'Horario de prueba L-V 8:00-16:00',
          summary: { present: 1, late: 1, absent: 0, daysOff: 0 },
          days: [
            { date: ym + '-01', status: 'COMPLETA', firstPunch: '07:58', lastPunch: '16:02', hoursWorked: '08:04', regularHours: '08:00', late: null, earlyArrival: '00:02', earlyLeave: null, overtime: null, holiday: null, exception: null, absenceType: null },
            { date: ym + '-02', status: 'COMPLETA', firstPunch: '08:20', lastPunch: '16:00', hoursWorked: '07:40', regularHours: '08:00', late: '00:20', earlyArrival: null, earlyLeave: null, overtime: null, holiday: null, exception: null, absenceType: null },
          ],
        },
      })
    }
    if (ruta === '/expediente')
      return route.fulfill({
        json: {
          job: { name: 'PERSONA FICTICIA', jobTitle: 'Analista de prueba', department: 'Dirección de Prueba', positionNumber: 1234, payrollType: 'PERMANENTE', startDate: '2015-03-01', endDate: null, status: 'ACTIVA', monthlySalary: 2000 },
          personal: { birthDate: '1990-01-01', sex: 'F', maritalStatus: 'SOLTERA', socialSecurity: '•••789', phone: null, mobile: '6000-0000', email: 'persona@ejemplo.test', province: 'Panamá', district: null, township: null, neighborhood: null, building: null, house: null, emergencyContact: 'Contacto Ficticio', emergencyPhone: '6000-0001', role: null, area: null },
          education: [{ institution: 'Universidad Ficticia', title: 'Licenciatura de prueba', comment: null, date: null }],
          evaluations: [],
          sanctions: [],
          dependents: [{ name: 'Hijo Ficticio', relationship: 'HIJO', birthDate: '2015-05-05', idNumber: '•••999', primary: true }],
        },
      })
    if (ruta === '/compensatorio')
      return route.fulfill({
        json: {
          workdayMinutes: 480,
          totalAvailable: 240,
          balances: { before: { available: 0, pending: 0, used: 0, expired: 0 }, after: { available: 240, pending: 0, used: 30, expired: 0 } },
          expiring: [{ type: 'DESPUES', date: `${ANIO + 1}-01-15`, minutes: 240, daysLeft: 100 }],
          requests: estado.usos.length
            ? [{ id: 1, kind: 'USO', type: 'DESPUES', unit: 'HORAS', minutes: 90, days: null, workedDate: null, from: iso(5), to: iso(5), reason: null, status: estado.cancelada ? 'CANCELADA' : 'PENDIENTE', rejectionReason: null, createdAt: null }]
            : [],
        },
      })
    if (ruta === '/compensatorio/uso') {
      estado.usos.push(req.postDataJSON())
      return route.fulfill({ status: 201, json: { id: 1, minutes: 90, message: 'Solicitud de uso creada' } })
    }
    if (ruta === '/compensatorio/solicitudes/1/cancelar') {
      estado.cancelada = true
      return route.fulfill({ status: 204 })
    }
    if (ruta === '/comprobantes') return route.fulfill({ json: { page: 1, pages: 1, total: 3, items: [pago(2), extra, pago(1)] } })
    if (ruta.startsWith('/comprobantes/resumen/')) return route.fulfill({ json: { year: ANIO, totals: { gross: 2000, deductions: 296, net: 1704 }, items: [pago(1), pago(2), extra] } })
    if (ruta === '/comprobantes/detalle') return route.fulfill({ json: { payroll: 902, lines: [{ code: '120-000123', type: '01', amount: 20, balance: 180 }] } })
    return route.fulfill({ status: 404, json: { error: 'ROUTE_NOT_FOUND', message: 'La ruta no existe.' } })
  })
  return estado
}

test('en mantenimiento: la pestaña solo lo dice, sin conectar ni datos', async ({ page }) => {
  const errores = vigilarErrores(page)
  await page.route('**/api/rrhh/**', (route) =>
    route.request().url().endsWith('/api/rrhh/conexion') && route.request().method() === 'GET'
      ? route.fulfill({ json: { available: false, connected: false, knownCedula: false, guest: false, name: null, expiresAt: null, maintenance: true } })
      : route.fulfill({ status: 503, json: { error: 'RRHH_EN_MANTENIMIENTO', message: 'RRHH Express está en mantenimiento' } }),
  )
  await page.goto('/recursos-humanos')
  await expect(page.getByText('Esta sección está en mantenimiento')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Conecta tu cuenta de RRHH Express' })).toHaveCount(0)
  await expect(page.locator('.rh-dato')).toHaveCount(0)
  await expect(page.locator('.rh-docs')).toHaveCount(0)
  expect(errores()).toEqual([])
})

test('sin RRHH Express en el servidor: los datos laborales siguen «Próximamente»', async ({ page }) => {
  await simular(page, { disponible: false })
  await page.goto('/recursos-humanos')
  await expect(page.locator('.rh-dato').first()).toContainText('Próximamente')
  await expect(page.getByRole('heading', { name: 'Conecta tu cuenta de RRHH Express' })).toHaveCount(0)
  // Sin RRHH Express el talonario no tiene dónde pedirse: la fila no se muestra (ni como fila sin enlace).
  await expect(page.locator('.rh-sol', { hasText: 'Talonario de pago' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Talonario de pago/ })).toHaveCount(0)
  await expect(page.locator('.rh-sol', { hasText: 'Tiempo compensatorio' })).toHaveCount(0)
})

test('sin sesión: cédula y número de cargo, con la figura del carnet; entrar es una opción, no un bloqueo', async ({ page }) => {
  await simular(page)
  await page.goto('/recursos-humanos')
  const conectar = page.locator('.rh-conectar')
  await expect(conectar.getByLabel('Cédula', { exact: true })).toBeVisible()
  await expect(conectar.getByLabel('Número de cargo', { exact: true })).toBeVisible()
  await expect(conectar.getByRole('button', { name: 'Ver mis datos' })).toBeEnabled()
  await expect(conectar).toContainText('No guardamos tus datos.')
  await expect(conectar.getByRole('button', { name: /contraseña/i })).toHaveCount(0)
  await expect(conectar.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible()
})

test('la figura del carnet marca la posición y solo lleva datos de ejemplo', async ({ page }) => {
  await simular(page)
  await page.goto('/recursos-humanos')
  const figura = page.locator('.rh-carnet-fig')
  await expect(figura.getByText('Ejemplo', { exact: true })).toBeVisible()
  await expect(figura.locator('.rh-carnet')).toHaveAttribute('aria-hidden', 'true')
  await expect(figura.locator('.rh-carnet__pos')).toHaveText('POSICIÓN: 000000')
  await expect(figura.getByText('Debajo del código QR: «Posición». Solo números.')).toBeVisible()
  // Datos ficticios: posición y nombre genéricos; el logo oficial sin tocar.
  const dibujo = (await figura.locator('.rh-carnet').textContent()) ?? ''
  expect(dibujo).toContain('NOMBRE APELLIDO')
  await expect(figura.locator('img.rh-carnet__logo')).toHaveAttribute('src', '/marca/logos/svg/logo-azul-sobre-blanco-horizontal.svg')
  // Cabe en la pantalla: la figura no desborda.
  const caja = await figura.boundingBox()
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
})

test('con sesión que conoce la cédula: un solo campo, el número de cargo', async ({ page }) => {
  const estado = await simular(page, { conocida: true })
  await entrar(page, 'prueba1')
  await page.goto('/recursos-humanos')
  const conectar = page.locator('.rh-conectar')
  await expect(conectar.getByLabel('Cédula', { exact: true })).toHaveCount(0)
  await expect(conectar.getByText('No guardamos tus datos.')).toBeVisible()
  await expect(conectar.getByLabel('Número de cargo', { exact: true })).toHaveAttribute('inputmode', 'numeric')
  await expect(conectar.getByRole('link', { name: 'Iniciar sesión' })).toHaveCount(0)
  await expect(page.locator('.rh-carnet-fig')).toBeVisible()

  await conectar.getByRole('button', { name: 'Ver mis datos' }).click()
  await expect(conectar.getByText('Escribe tu número de cargo.', { exact: true })).toBeVisible()
  await conectar.getByLabel('Número de cargo', { exact: true }).fill('12ab')
  await conectar.getByRole('button', { name: 'Ver mis datos' }).click()
  await expect(conectar.getByText('El número de cargo tiene solo números.')).toBeVisible()

  await conectar.getByLabel('Número de cargo', { exact: true }).fill('999999')
  await conectar.getByRole('button', { name: 'Ver mis datos' }).click()
  await expect(conectar.getByRole('alert')).toContainText('El número de cargo no coincide.')

  await conectar.getByLabel('Número de cargo', { exact: true }).fill('123456')
  await conectar.getByRole('button', { name: 'Ver mis datos' }).click()
  await expect(page.locator('.rh-cuenta')).toContainText('Persona Ficticia')
  // Con la cédula conocida el navegador no la manda.
  expect(estado.conexiones.every((c) => !('cedula' in c))).toBe(true)
})

test('sin sesión: conecta como invitado y avisa que la conexión se cierra sola', async ({ page }) => {
  await simular(page)
  await page.goto('/recursos-humanos')
  const conectar = page.locator('.rh-conectar')
  await conectar.getByRole('button', { name: 'Ver mis datos' }).click()
  await expect(conectar.getByText('Escribe tu cédula con guiones')).toBeVisible()
  await conectar.getByLabel('Cédula', { exact: true }).fill('8-000-101')
  await conectar.getByLabel('Número de cargo', { exact: true }).fill('999999')
  await conectar.getByRole('button', { name: 'Ver mis datos' }).click()
  await expect(conectar.getByRole('alert')).toContainText('La cédula o el número de cargo no coinciden.')
  await expect(conectar.getByLabel('Número de cargo', { exact: true })).toHaveValue('')

  await conectar.getByLabel('Número de cargo', { exact: true }).fill('123456')
  await conectar.getByRole('button', { name: 'Ver mis datos' }).click()
  await expect(page.locator('.rh-cuenta')).toContainText('Persona Ficticia')
  await expect(page.locator('.rh-cuenta')).toContainText('Se cierra en unos minutos sin uso')
  await expect(page.locator('.rh-dato', { hasText: 'Cargo' })).toContainText('Analista de prueba')
  await page.getByRole('button', { name: 'Desconectar' }).click()
  await expect(page.locator('.rh-conectar')).toBeVisible()
})

test('demasiados intentos: avisa que hay que esperar', async ({ page }) => {
  await simular(page, { limite: true })
  await page.goto('/recursos-humanos')
  const conectar = page.locator('.rh-conectar')
  await conectar.getByLabel('Cédula', { exact: true }).fill('8-000-101')
  await conectar.getByLabel('Número de cargo', { exact: true }).fill('123456')
  await conectar.getByRole('button', { name: 'Ver mis datos' }).click()
  await expect(conectar.getByRole('alert')).toContainText('Hiciste varios intentos seguidos. Espera unos 15 minutos')
})

test('conectar con una cuenta sin cédula conocida: cédula y número de cargo; se ven las cuatro pestañas', async ({ page }) => {
  await simular(page, { sesion: true })
  await entrar(page, 'prueba1')
  await page.goto('/recursos-humanos')
  const conectar = page.locator('.rh-conectar')
  await expect(conectar.getByRole('heading', { name: 'Conecta tu cuenta de RRHH Express' })).toBeVisible()
  // Con sesión no se ofrece «entra»: ya entró.
  await expect(conectar.locator('.rh-conectar__cuenta')).toHaveCount(0)
  await conectar.getByLabel('Cédula', { exact: true }).fill('8-000-101')
  const errores = vigilarErrores(page)
  await conectar.getByLabel('Número de cargo', { exact: true }).fill('123456')
  await conectar.getByRole('button', { name: 'Ver mis datos' }).click()

  // Resumen con datos reales y el nombre en la cabecera.
  await expect(page.locator('.rh-cuenta')).toContainText('Persona Ficticia')
  await expect(page.locator('.rh-dato', { hasText: 'Cargo' })).toContainText('Analista de prueba')
  await expect(page.locator('.rh-dato', { hasText: 'Último pago neto' })).toContainText('B/. 852.00')
  await expect(page.locator('.rh-dato', { hasText: 'Tiempo compensatorio' })).toContainText('4 h')

  // Marcaciones: el calendario y el detalle del día.
  const tabs = page.getByRole('tablist', { name: 'Datos de RRHH Express' })
  await expect(tabs.getByRole('tab', { name: 'Marcaciones' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Mes anterior' }).click()
  await page.getByRole('button', { name: /: Tardanza de 20 min$/ }).click()
  await expect(page.locator('.rh-dia-detalle')).toContainText('08:20')

  // Expediente: dependientes con la cédula enmascarada.
  await tabs.getByRole('tab', { name: 'Mi expediente' }).click()
  await expect(page).toHaveURL(/seccion=expediente/)
  await expect(page.locator('.rh-exp')).toContainText('Hijo Ficticio')
  await expect(page.locator('.rh-exp')).toContainText('•••999')

  // Comprobantes: detalle con la cuenta enmascarada.
  await tabs.getByRole('tab', { name: 'Comprobantes de pago' }).click()
  // Dos pagos el mismo día van en una sola barra; el historial sigue con los tres.
  await expect(page.locator('.rh-barras li')).toHaveCount(2)
  await expect(page.locator('.rh-barras li').nth(1)).toHaveAttribute('title', /^2 pagos del .*neto B\/\. ?1[.,]102/)
  await expect(page.locator('.rh-tabla tbody tr')).toHaveCount(3)
  await page.getByRole('button', { name: /Ver el comprobante de 1\.ª quincena de febrero/ }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg).toContainText('Neto pagado')
  await expect(dlg).toContainText('••••7890')
  await expect(dlg).toContainText('120-000123')
  await dlg.getByRole('button', { name: 'Cerrar' }).click()
  await expect(dlg).toBeHidden()
  expect(errores()).toEqual([])
})

test('tiempo compensatorio: pedir uso y cancelarlo', async ({ page }) => {
  const estado = await simular(page, { conectada: true })
  await entrar(page, 'prueba1')
  await page.goto('/recursos-humanos?seccion=compensatorio')
  await expect(page.locator('.rh-comp__total')).toContainText('4 h')
  await page.getByRole('button', { name: 'Usar tiempo' }).click()
  const dlg = page.getByRole('dialog', { name: 'Usar tiempo compensatorio' })
  await dlg.getByLabel('Cantidad').fill('1.5')
  await dlg.getByLabel('Fecha').fill(iso(5))
  await dlg.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Solicitud de uso creada' })).toBeVisible()
  expect(estado.usos[0]).toMatchObject({ type: 'DESPUES', unit: 'HORAS', amount: 1.5, from: iso(5) })

  page.once('dialog', (d) => d.accept())
  await page.locator('.rh-comp').getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.locator('.rh-comp .tagline')).toHaveText('Cancelada')
})

test('si la conexión venció, vuelve a pedir conectar; y se desconecta desde Configuración', async ({ page }) => {
  const estado = await simular(page, { conectada: true, vence: true, sesion: true })
  await entrar(page, 'prueba1')
  // El Inicio («Mi resumen») ya pidió sus datos y la conexión simulada venció ahí: se vuelve a dejar «conectada» para
  // que la que venza sea la que ve la pestaña de Recursos Humanos.
  estado.conectada = true
  await page.goto('/recursos-humanos')
  await expect(page.locator('.rh-conectar__vencida')).toContainText('venció')

  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await simular(page, { conectada: true, sesion: true })
  await page.goto('/configuracion')
  const panel = page.locator('section.panel', { hasText: 'Cuentas conectadas' })
  await expect(panel).toContainText('Conectada como Persona Ficticia')
  await panel.getByRole('button', { name: 'Desconectar' }).click()
  await expect(panel.getByRole('link', { name: 'Conectar' })).toHaveAttribute('href', '/recursos-humanos')
})

test('el formulario con el carnet en teléfono: sin desplazamiento horizontal, botones de 44 px y axe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await simular(page)
  await page.goto('/recursos-humanos')
  await expect(page.locator('.rh-conectar')).toBeVisible()
  const ancho = await page.evaluate(() => ({ pagina: document.documentElement.scrollWidth, ventana: window.innerWidth }))
  expect(ancho.pagina).toBeLessThanOrEqual(ancho.ventana)
  for (const nombre of ['Ver mis datos', 'Mostrar']) {
    const caja = await page.locator('.rh-conectar').getByRole('button', { name: nombre }).boundingBox()
    expect(caja!.height, nombre).toBeGreaterThanOrEqual(44)
  }
  const { violations } = await new AxeBuilder({ page }).include('.rh-conectar').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})

test('«Cómo solicitar» solo sale con RRHH Express conectado, y es texto en un desplegable', async ({ page }) => {
  await simular(page)
  await page.goto('/recursos-humanos')
  await expect(page.locator('details.rh-como')).toHaveCount(0)

  await simular(page, { conectada: true })
  await entrar(page, 'prueba1')
  await page.goto('/recursos-humanos')
  const como = page.locator('details.rh-como')
  await expect(como.locator('summary')).toHaveText('Cómo solicitar')
  await expect(como).toContainText('talonario de pago')
  await expect(como).toContainText('carta de trabajo, certificación laboral, vacaciones, permiso personal y corrección de marcación')
  await expect(como).toContainText('506-9692')
  await expect(como.getByRole('link')).toHaveCount(0)
})

test('el ojito del número de cargo tiene su nombre y funciona con teclado', async ({ page }) => {
  await simular(page)
  await page.goto('/recursos-humanos')
  const campo = page.getByLabel('Número de cargo', { exact: true })
  await campo.fill('1234567')
  const ojo = page.getByRole('button', { name: 'Mostrar número de cargo', exact: true })
  await expect(ojo).toHaveAttribute('aria-pressed', 'false')
  await campo.focus()
  await page.keyboard.press('Tab')
  await expect(ojo).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(campo).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Ocultar número de cargo', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Enter')
  await expect(campo).toHaveAttribute('type', 'password')
})
