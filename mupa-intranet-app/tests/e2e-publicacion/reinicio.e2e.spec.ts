import { expect, test } from '@playwright/test'

import { entrar } from '../e2e/ayuda'

test('reiniciar perfil requiere confirmar, permite cancelar y actualiza la lista', async ({ page }) => {
  await entrar(page, 'admin')
  let reiniciado = false
  let llamadas = 0
  const persona = { id: 999999, firstName: 'Persona', lastName: 'Ficticia', email: 'reinicio@ejemplo.test', roles: ['funcionario'], source: 'identity', departmentId: null, departmentName: null, suspendedAt: null, lastLoginAt: null }
  await page.route(/\/api\/users(?:\?.*)?$/, (route) => route.fulfill({ json: reiniciado ? [] : [persona] }))
  await page.route('**/api/users/999999/reset', async (route) => {
    expect(route.request().method()).toBe('POST')
    llamadas++
    reiniciado = true
    await route.fulfill({ status: 204 })
  })
  await page.goto('/gestion/usuarios')
  await page.getByRole('button', { name: 'Reiniciar el perfil de Persona Ficticia' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Reiniciar perfil: Persona Ficticia' })
  await expect(dialogo).toContainText('todas sus solicitudes')
  await expect(dialogo).toContainText('primero debe corregirse allí')
  await dialogo.getByRole('button', { name: 'Cancelar' }).click()
  expect(llamadas).toBe(0)
  await page.getByRole('button', { name: 'Reiniciar el perfil de Persona Ficticia' }).click()
  await dialogo.getByRole('button', { name: 'Reiniciar perfil', exact: true }).click()
  await expect(dialogo).toBeHidden()
  await expect(page.getByText('Ninguna persona coincide con los filtros.')).toBeVisible()
  expect(llamadas).toBe(1)
})
