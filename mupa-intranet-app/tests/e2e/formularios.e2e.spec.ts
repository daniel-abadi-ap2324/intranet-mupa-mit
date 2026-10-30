/** Formularios de solicitud: índice, validación, perfil, secciones condicionales y listas. El envío es simulado. */
import { expect, test, type Page } from '@playwright/test'

import { entrar, vigilarErrores } from './ayuda'

const enviar = (page: Page) => page.locator('form .f-actions').getByRole('button', { name: 'Revisar y enviar' }).click()

test('el índice muestra los 7 formularios y los 2 sistemas propios, y lleva a cada uno; el menú marca uno solo', async ({ page }) => {
  const errores = vigilarErrores(page)
  await page.goto('/formularios')
  await expect(page.getByRole('heading', { level: 1, name: 'Formularios de solicitud' })).toBeVisible()
  await expect(page.locator('.sys-card')).toHaveCount(9)
  // Código de llamadas y WIFI se piden en su propio sistema (como en la intranet actual), no con un formulario.
  const tecnologia = page.getByRole('region', { name: 'Tecnología' })
  await expect(tecnologia.getByRole('link', { name: /Código de llamadas/ })).toHaveAttribute('href', 'https://cdr.mupa.gob.pa/pinrequests/create')
  await expect(tecnologia.getByRole('link', { name: /Acceso a la red WIFI/ })).toHaveAttribute('href', 'http://wifi.mupa.gob.pa:9001/solicitud')
  await expect(page.locator('a[href="/formularios/codigo-de-llamadas"]')).toHaveCount(0)
  // RRHH maneja sus trámites como siempre: no hay formularios de carta de trabajo ni de certificación.
  await expect(page.getByRole('link', { name: /Carta de Trabajo|Certificación/ })).toHaveCount(0)
  await page.getByRole('link', { name: /Solicitud de Carpetas Compartidas/ }).click()
  await expect(page).toHaveURL(/\/formularios\/carpetas-compartidas$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Solicitud de Carpetas Compartidas')
  await expect(page).toHaveTitle('Solicitud de Carpetas Compartidas — Intranet MUPA')
  await expect(page.locator('#sidebar [aria-current="page"]')).toHaveCount(1)
  await expect(page.locator('#sidebar [aria-current="page"]')).toHaveText(/Aplicaciones/)
  expect(errores()).toEqual([])
})

test('enviar vacío muestra los errores con enlaces; se corrigen en vivo; la revisión no manda nada', async ({ page }) => {
  const errores = vigilarErrores(page)
  const envios: string[] = []
  page.on('request', (r) => r.method() !== 'GET' && envios.push(r.method() + ' ' + r.url()))
  await page.goto('/formularios/carpetas-compartidas')

  await enviar(page)
  const resumen = page.locator('.f-errs')
  await expect(resumen).toBeFocused()
  await expect(resumen).toContainText('Revisa 10 datos antes de enviar')
  await resumen.getByRole('link', { name: 'Completa «Cédula».' }).click()
  await expect(page.getByLabel('Cédula')).toBeFocused()

  await page.getByLabel('Nombres').fill('Persona')
  await page.getByLabel('Apellidos').fill('de Prueba')
  await page.getByLabel('Cédula').fill('8-12345-1')
  await expect(page.locator('.f-err', { hasText: 'guiones' })).toBeVisible()
  await page.getByLabel('Cédula').fill('pe-1-23')
  await page.getByLabel('Cédula').blur()
  await expect(page.getByLabel('Cédula')).toHaveValue('PE-1-23')
  await page.getByLabel('Dirección').fill('Dirección de Prueba')
  await page.getByLabel('Departamento').fill('Departamento de Prueba')
  await page.getByLabel('Correo institucional').fill('persona@ejemplo.test')
  await page.getByLabel('Nombre de la carpeta').fill('Carpeta Ficticia')
  await page.getByLabel('Ubicación de la carpeta').fill('Servidor ficticio')
  await page.getByRole('radio', { name: 'Lectura' }).check()
  await page.getByRole('radio', { name: 'Sí', exact: true }).check()
  await expect(resumen).toBeHidden()
  await expect(page.locator('.f-prog')).toContainText('10 de 10')

  await enviar(page)
  await expect(page.getByRole('heading', { name: 'Solicitud lista (simulación)' })).toBeFocused()
  await expect(page.locator('.f-review')).toContainText('PE-1-23')
  await expect(page.locator('.f-review')).toContainText('Lectura')
  await page.getByRole('button', { name: '← Corregir algo' }).click()
  await expect(page.getByLabel('Nombre de la carpeta')).toHaveValue('Carpeta Ficticia')
  expect(envios).toEqual([])
  expect(errores()).toEqual([])
})

test('con sesión completa nombre y correo del perfil; Limpiar los vuelve a poner', async ({ page }) => {
  await entrar(page, 'prueba1')
  await page.goto('/formularios/codigo-de-impresion')
  const nombre = page.getByLabel('Nombre completo')
  await expect(nombre).toHaveValue('Lucía Herrera')
  await expect(page.getByLabel('Correo institucional')).toHaveValue('prueba1@ejemplo.test')
  await expect(page.locator('.f-field.is-auto .f-chip')).toHaveCount(2)
  await expect(page.locator('.f-perfil')).toContainText('2 datos')
  await nombre.fill('Otro nombre')
  await page.getByRole('button', { name: 'Limpiar' }).click()
  await expect(nombre).toHaveValue('Lucía Herrera')
})

test('lista-de-difusion muestra la sección que corresponde a la opción elegida', async ({ page }) => {
  await page.goto('/formularios/lista-de-difusion')
  await expect(page.locator('.f-section')).toHaveCount(2)
  await page.getByRole('radio', { name: 'Crear una lista nueva' }).check()
  await expect(page.getByRole('heading', { name: 'Lista nueva' })).toBeVisible()
  await expect(page.locator('.f-num').last()).toHaveText('3')
  await page.getByRole('radio', { name: 'Actualizar una lista existente' }).check()
  await expect(page.getByRole('heading', { name: 'Lista nueva' })).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Actualizar lista' })).toBeVisible()
})

test('internet-proveedores: participantes de 1 a 5 y duración entre 1 y 24 horas', async ({ page }) => {
  await page.goto('/formularios/internet-proveedores')
  const agregar = page.getByRole('button', { name: 'Agregar participante' })
  for (let i = 0; i < 4; i++) await agregar.click()
  await expect(page.locator('.f-item')).toHaveCount(5)
  await expect(agregar).toBeHidden()
  await page.getByRole('button', { name: 'Quitar participante 2' }).click()
  await expect(page.locator('.f-item')).toHaveCount(4)
  await expect(agregar).toBeVisible()
  await page.getByLabel('Duración (horas)').fill('25')
  await enviar(page)
  await expect(page.locator('.f-errs')).toContainText('entre 1 y 24')
})

test('nuevo-funcionario: una casilla abre sus sub-campos y suma sus obligatorios', async ({ page }) => {
  await page.goto('/formularios/nuevo-funcionario')
  const total = async () => Number((await page.locator('.f-prog p b').innerText()).split(' de ')[1])
  const antes = await total()
  const casilla = page.getByRole('checkbox', { name: 'Carpeta compartida' })
  await casilla.check()
  await expect(page.getByLabel('Nombre de la carpeta')).toBeVisible()
  expect(await total()).toBe(antes + 4)
  await casilla.uncheck()
  await expect(page.getByLabel('Nombre de la carpeta')).toBeHidden()
  expect(await total()).toBe(antes)
})

test('un formulario que no existe es "Página no encontrada"', async ({ page }) => {
  await page.goto('/formularios/no-existe')
  await expect(page.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeVisible()
})
