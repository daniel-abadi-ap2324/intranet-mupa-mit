/**
 * El «ojito» de la contraseña (CampoClave / BotonOjo): con teclado, con nombre claro, y sin dejar la contraseña a la vista
 * ni guardada en ninguna parte. (El de RRHH Express, «Número de cargo», se prueba en rrhh.e2e.spec.ts.)
 */
import { expect, test, type Page } from '@playwright/test'

const campo = (page: Page) => page.getByLabel('Contraseña', { exact: true })
const SECRETA = 'clave-muy-secreta-12345'

test('el ojito se usa con teclado, con nombre claro y aria-pressed', async ({ page }) => {
  await page.goto('/entrar')
  await campo(page).fill(SECRETA)
  const ojo = page.getByRole('button', { name: 'Mostrar contraseña', exact: true })
  await expect(ojo).toHaveAttribute('aria-pressed', 'false')
  await expect(ojo).toHaveAttribute('aria-controls', 'password')
  expect((await ojo.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  // Tab desde el campo llega al ojito; Enter lo muestra y el foco no se pierde.
  await campo(page).focus()
  await page.keyboard.press('Tab')
  await expect(ojo).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(campo(page)).toHaveAttribute('type', 'text')
  const ocultar = page.getByRole('button', { name: 'Ocultar contraseña', exact: true })
  await expect(ocultar).toHaveAttribute('aria-pressed', 'true')
  await expect(ocultar).toBeFocused()
  // Espacio lo vuelve a tapar.
  await page.keyboard.press('Space')
  await expect(campo(page)).toHaveAttribute('type', 'password')
  await expect(page.getByRole('button', { name: 'Mostrar contraseña', exact: true })).toBeFocused()
  // El valor se conserva al alternar.
  await expect(campo(page)).toHaveValue(SECRETA)
  await expect(campo(page)).toHaveAttribute('autocomplete', 'current-password')
})

test('la contraseña no se filtra: ni a la URL, ni al navegador, ni a atributos; y se tapa al enviar', async ({ page }) => {
  const peticiones: string[] = []
  page.on('request', (r) => peticiones.push(r.url()))
  // Falla a propósito (la API responde 401): la persona sigue en la página con el campo a la vista.
  await page.goto('/entrar')
  await page.getByLabel('Cédula o correo').fill('nadie@ejemplo.test')
  await campo(page).fill(SECRETA)
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(campo(page)).toHaveAttribute('type', 'text')

  // Mientras está a la vista, no queda en el almacenamiento, en la URL ni en un atributo (title, aria-label, value).
  const rastros = await page.evaluate((s) => {
    const dentro = (o: Storage) => Object.entries(o).some(([k, v]) => k.includes(s) || String(v).includes(s))
    const atributos = [...document.querySelectorAll('*')].some((e) => ['title', 'aria-label', 'placeholder', 'data-valor'].some((a) => (e.getAttribute(a) || '').includes(s)))
    return { local: dentro(localStorage), sesion: dentro(sessionStorage), url: location.href.includes(s), atributos }
  }, SECRETA)
  expect(rastros).toEqual({ local: false, sesion: false, url: false, atributos: false })

  // Enviar la tapa de nuevo (el servidor dice que no es correcta y el campo queda vacío y tapado).
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('no son correctos')
  await expect(campo(page)).toHaveAttribute('type', 'password')
  await expect(page.getByRole('button', { name: 'Mostrar contraseña', exact: true })).toHaveAttribute('aria-pressed', 'false')
  expect(peticiones.every((u) => !u.includes(SECRETA))).toBe(true)
  const rastro = await page.evaluate((s) => [localStorage, sessionStorage].some((o) => Object.entries(o).some(([, v]) => String(v).includes(s))), SECRETA)
  expect(rastro).toBe(false)
})

test('al pasar el foco a otra parte de la página, la contraseña vuelve a taparse', async ({ page }) => {
  await page.goto('/entrar')
  await campo(page).fill(SECRETA)
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(campo(page)).toHaveAttribute('type', 'text')
  // Tab: del ojito al botón «Entrar» (fuera del campo).
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeFocused()
  await expect(campo(page)).toHaveAttribute('type', 'password')
})

test('el registro: un ojito para las dos contraseñas, con autocomplete de contraseña nueva', async ({ page }) => {
  await page.goto('/registro')
  const ojo = page.getByRole('button', { name: 'Mostrar contraseñas', exact: true })
  await expect(ojo).toHaveAttribute('aria-controls', 'reg-clave reg-confirmar')
  await expect(page.locator('#reg-clave')).toHaveAttribute('autocomplete', 'new-password')
  await expect(page.locator('#reg-confirmar')).toHaveAttribute('autocomplete', 'new-password')
  await page.locator('#reg-clave').fill(SECRETA)
  await ojo.click()
  await expect(page.locator('#reg-clave')).toHaveAttribute('type', 'text')
  await expect(page.locator('#reg-confirmar')).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Ocultar contraseñas', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
})
