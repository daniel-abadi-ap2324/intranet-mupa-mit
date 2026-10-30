/**
 * El departamento es obligatorio para entrar: quien inicia sesión sin uno lo elige antes de pasar.
 * sindepto es la cuenta de prueba que viene sin departamento (las demás ya lo traen).
 */
import { expect, test, type APIRequestContext } from '@playwright/test'

import { api, CUENTAS, vigilarErrores } from './ayuda'

/** Deja a sindepto sin departamento otra vez (como la crea el backend de pruebas). */
async function quitarDepartamento(request: APIRequestContext) {
  await api(request, 'admin')
  const lista = await (await request.get('/api/users?q=' + encodeURIComponent(CUENTAS.sindepto))).json()
  const persona = lista.find((u: { email: string }) => u.email === CUENTAS.sindepto)
  expect((await request.patch('/api/users/' + persona.id, { data: { departmentId: null } })).ok()).toBeTruthy()
}

test('sin departamento, entrar pide elegirlo (obligatorio) y recién ahí se pasa', async ({ page, request }) => {
  const errores = vigilarErrores(page)
  try {
    await page.goto('/entrar')
    await page.getByLabel('Cédula o correo').fill(CUENTAS.sindepto)
    await page.getByLabel('Contraseña', { exact: true }).fill('password')
    await page.getByRole('button', { name: 'Entrar' }).click()

    // La sesión ya está, pero no se pasa al Inicio: primero el departamento.
    await expect(page.getByRole('heading', { level: 1, name: 'Elige tu departamento' })).toBeVisible()
    await expect(page).toHaveURL(/\/entrar$/)
    await expect(page.locator('label[for="departamento"] .f-req')).toBeVisible()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByText('Elige tu departamento para continuar.')).toBeVisible()
    await expect(page.locator('#departamento')).toHaveAttribute('aria-invalid', 'true')

    // Tampoco se entra por otra dirección: se vuelve al login.
    await page.goto('/aplicaciones')
    await expect(page).toHaveURL(/\/entrar$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Elige tu departamento' })).toBeVisible()

    await page.locator('#departamento').selectOption({ label: 'Dirección de Tecnología e Innovación' })
    await page.getByRole('button', { name: 'Continuar' }).click()
    // Vuelve a donde iba.
    await expect(page).toHaveURL(/\/aplicaciones$/)
    await expect(page.locator('#sidebar')).toBeVisible()

    // Ya no se lo vuelve a pedir, y su cuenta lo muestra.
    await page.goto('/entrar')
    await expect(page.getByRole('heading', { level: 1, name: 'Ya iniciaste sesión' })).toBeVisible()
    expect(errores().filter((e) => !/409|403|401/.test(e))).toEqual([])
  } finally {
    await quitarDepartamento(request)
  }
})

test('quien ya tiene departamento entra directo', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByLabel('Cédula o correo').fill(CUENTAS.prueba1)
  await page.getByLabel('Contraseña', { exact: true }).fill('password')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Elige tu departamento' })).toHaveCount(0)
})

test('si RH Link no la tiene como funcionario activo, el login lo dice y no deja pasar', async ({ page }) => {
  await page.route('**/api/auth/login', (r) =>
    r.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'NOT_FUNCIONARIO', message: 'Tu cédula no aparece como funcionario activo en Recursos Humanos, así que no puedes entrar a la intranet. Si crees que es un error, comunícate con Recursos Humanos (506-9692, ext. 9171 o 9172).' }),
    }),
  )
  await page.goto('/entrar')
  await page.getByLabel('Cédula o correo').fill('8-123-456')
  await page.getByLabel('Contraseña', { exact: true }).fill('cualquiera')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toContainText('no aparece como funcionario activo en Recursos Humanos')
  await expect(page).toHaveURL(/\/entrar$/)
})
