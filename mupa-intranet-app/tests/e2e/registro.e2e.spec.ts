/**
 * Crear cuenta con la cédula (/registro). El backend de pruebas no tiene Identity
 * Central: el registro, la sesión nueva y el código de correo se simulan con
 * page.route. Personas ficticias.
 */
import { expect, test, type Page } from '@playwright/test'

const CUENTA = {
  id: 9001,
  email: 'registro.prueba@pty.gob.pa',
  emailVerified: false,
  firstName: 'Juan Carlos',
  lastName: 'Pérez Gómez',
  roles: ['funcionario'],
  departmentId: 1,
  tourSeenAt: new Date().toISOString(),
}

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function llenar(page: Page) {
  await page.getByLabel('Cédula').fill('8-000-0001')
  await page.getByLabel('Correo').fill(CUENTA.email)
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill('Clave-de-prueba-1')
  await page.getByLabel('Repite la contraseña').fill('Clave-de-prueba-1')
}

test('se llega desde /entrar, sin menú, y marca qué es obligatorio', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByRole('link', { name: 'Crear cuenta' }).click()
  await expect(page).toHaveURL(/\/registro$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Crea tu cuenta' })).toBeVisible()
  await expect(page.getByLabel('Cédula')).toBeFocused()
  await expect(page.locator('#sidebar')).toHaveCount(0)
  await expect(page.locator('label[for="reg-cargo"]')).toContainText('(opcional)')
  await expect(page.locator('label[for="reg-cedula"] .f-req')).toBeVisible()
  // El departamento no se pide: sale de RH Link al entrar.
  await expect(page.getByLabel('Departamento')).toHaveCount(0)
  // Cargo: sugerencias del catálogo de RRHH.
  expect(await page.locator('#reg-cargos option').count()).toBeGreaterThan(400)
  await expect(page.getByLabel('Cargo')).toHaveAttribute('list', 'reg-cargos')

  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)

  await page.getByRole('link', { name: 'Entra', exact: true }).click()
  await expect(page).toHaveURL(/\/entrar$/)
})

test('dice qué falta al lado de cada campo, sin llamar al servidor', async ({ page }) => {
  let llamadas = 0
  await page.route('**/api/auth/register', (r) => {
    llamadas++
    return r.fulfill(json({}, 500))
  })
  await page.goto('/registro')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  for (const texto of ['Escribe tu cédula.', 'Escribe tu correo.', 'La contraseña debe tener al menos 8 caracteres.', 'Vuelve a escribir la contraseña.']) {
    await expect(page.getByText(texto)).toBeVisible()
  }
  await expect(page.getByLabel('Cédula')).toBeFocused()
  await expect(page.getByLabel('Cédula')).toHaveAttribute('aria-invalid', 'true')

  await llenar(page)
  await page.getByLabel('Cédula').fill('8123456')
  await page.getByLabel('Repite la contraseña').fill('otra-clave-9')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByText('Escribe la cédula con guiones')).toBeVisible()
  await expect(page.getByText('Las dos contraseñas no son iguales.')).toBeVisible()
  // Solo correos institucionales.
  await page.getByLabel('Correo').fill('carlos@outlook.com')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByText('Usa tu correo institucional (@pty.gob.pa).')).toBeVisible()
  expect(llamadas).toBe(0)
})

test('si el servidor no está conectado al login de la Alcaldía, lo dice claro (no «revisa tu conexión»)', async ({ page }) => {
  await page.route('**/api/auth/register', (r) => r.fulfill(json({ error: 'REGISTRATION_UNAVAILABLE', message: 'El registro no está disponible en este servidor.' }, 503)))
  await page.goto('/registro')
  await llenar(page)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('alert')).toContainText('todavía no está disponible en este servidor')
  await expect(page.getByRole('alert')).not.toContainText('Revisa tu conexión')
})

test('los errores del servidor van a su campo; si la cuenta ya existe, ofrece entrar', async ({ page }) => {
  const respuestas = [
    json({ error: 'VALIDATION_ERROR', message: 'Los datos enviados no son válidos', fields: [{ field: 'password', message: 'La contraseña debe tener una mayúscula.' }] }, 400),
    json({ error: 'ALREADY_REGISTERED', message: 'Ya hay una cuenta con esa cédula o ese correo. Entra con ella o recupera tu contraseña.' }, 409),
  ]
  await page.route('**/api/auth/register', (r) => r.fulfill(respuestas.shift()!))
  await page.goto('/registro')
  await llenar(page)

  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.locator('#reg-clave-error')).toHaveText('La contraseña debe tener una mayúscula.')
  await expect(page.getByRole('textbox', { name: 'Contraseña', exact: true })).toBeFocused()

  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  const alerta = page.getByRole('alert')
  await expect(alerta).toContainText('Ya hay una cuenta con esa cédula')
  await alerta.getByRole('link', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
})

test('crea la cuenta, entra sola y confirma el correo con el código', async ({ page }) => {
  let registrada = false
  let enviado: Record<string, unknown> = {}
  let cuenta = { ...CUENTA }
  await page.route('**/api/auth/register', async (r) => {
    enviado = r.request().postDataJSON()
    registrada = true
    await r.fulfill(json(cuenta, 201))
  })
  await page.route('**/api/auth/session', (r) => (registrada ? r.fulfill(json(cuenta)) : r.continue()))
  await page.route('**/api/me/email/code', (r) => r.fulfill(json({ maskedEmail: 'ju***@pty.gob.pa', expiresInMinutes: 10 })))
  await page.route('**/api/me/email/verify', async (r) => {
    if (r.request().postDataJSON().code !== '246810') return r.fulfill(json({ error: 'INVALID_EMAIL_CODE', message: 'El código no es correcto o ya venció. Pide uno nuevo.' }, 400))
    cuenta = { ...cuenta, emailVerified: true }
    await r.fulfill(json(cuenta))
  })

  await page.goto('/registro')
  await llenar(page)
  await page.getByLabel('Cargo').fill('Analista')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Tu cuenta está lista' })).toBeVisible()
  // Sin nombre ni departamento (salen de RH Link); los opcionales vacíos no se mandan; la confirmación de la contraseña no sale del navegador.
  expect(enviado).toEqual({
    identityNumber: '8-000-0001',
    password: 'Clave-de-prueba-1',
    email: CUENTA.email,
    jobTitle: 'Analista',
  })

  await page.getByRole('button', { name: 'Enviar código' }).click()
  await expect(page.getByText('Te mandamos un código a ju***@pty.gob.pa. Vence en 10 minutos.')).toBeVisible()
  await expect(page.getByLabel('Código')).toBeFocused()
  await page.getByLabel('Código').fill('111111')
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.locator('#codigo-correo-error')).toContainText('no es correcto')
  await page.getByLabel('Código').fill('246810')
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('Confirmaste tu correo')).toBeVisible()

  await page.getByRole('button', { name: 'Ir al inicio' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('solo pide cédula, correo y contraseña; el nombre aparece únicamente si Recursos Humanos no lo pudo dar', async ({ page }) => {
  const respuestas = [
    json({ error: 'VALIDATION_ERROR', message: 'Los datos enviados no son válidos', fields: [{ field: 'firstName', message: 'Escribe tu nombre.' }, { field: 'lastName', message: 'Escribe tu apellido.' }] }, 400),
    json(CUENTA, 201),
  ]
  let enviado: Record<string, unknown> = {}
  let creada = false
  await page.route('**/api/auth/register', (r) => {
    enviado = r.request().postDataJSON()
    const respuesta = respuestas.shift()!
    creada = respuesta.status === 201
    return r.fulfill(respuesta)
  })
  await page.route('**/api/auth/session', (r) => (creada ? r.fulfill(json(CUENTA)) : r.continue()))
  await page.goto('/registro')
  // De entrada: solo lo imprescindible (sin nombre, apellido ni departamento); lo demás es opcional.
  await expect(page.getByLabel('Nombre')).toHaveCount(0)
  await expect(page.getByLabel('Apellido')).toHaveCount(0)
  await expect(page.getByLabel('Departamento')).toHaveCount(0)
  for (const t of ['Celular', 'Teléfono o extensión', 'Cargo']) await expect(page.locator('label', { hasText: t })).toContainText('(opcional)')

  await llenar(page)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  // RH Link no trajo el nombre: ahora sí se pide, con el foco en el primero.
  await expect(page.getByLabel('Nombre')).toBeVisible()
  await expect(page.getByLabel('Apellido')).toBeVisible()
  await expect(page.getByText('Escribe tu nombre.')).toBeVisible()
  await page.getByLabel('Nombre').fill('Juan Carlos')
  await page.getByLabel('Apellido').fill('Pérez Gómez')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Tu cuenta está lista' })).toBeVisible()
  expect(enviado).toMatchObject({ firstName: 'Juan Carlos', lastName: 'Pérez Gómez' })
})
