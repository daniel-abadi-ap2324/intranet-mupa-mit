/**
 * Gestor de Solicitudes: arma un formulario con el constructor (con una sección
 * que depende de una respuesta), lo ve en la vista previa y en Formularios, y
 * lo borra. Usa un título único y deja todo como estaba.
 */
import { expect, test } from '@playwright/test'

import { abrirPanel, entrar, vigilarErrores } from './ayuda'

test('el Gestor crea un formulario con una sección condicional, lo publica y lo borra', async ({ page }) => {
  const errores = vigilarErrores(page)
  const titulo = 'Formulario de prueba ' + Date.now()
  await entrar(page, 'gestor')
  await abrirPanel(page, 'Formularios')
  await page.getByRole('link', { name: 'Nuevo formulario' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Nuevo formulario' })).toBeVisible()

  // Sin título ni área no se guarda.
  await page.getByRole('button', { name: 'Guardar formulario' }).click()
  await expect(page.getByRole('alert')).toContainText('Escribe el título.')

  await page.getByLabel('Título', { exact: true }).fill(titulo)
  await page.getByLabel('Área').fill('Pruebas')
  await page.getByLabel('A quién llega').fill('Equipo de pruebas')

  await page.getByRole('button', { name: /Secciones y campos/ }).click()
  // Sección 1: una opción única con clave.
  const s1 = page.locator('.gest-fila').nth(0)
  await s1.getByRole('button', { name: 'Agregar campo' }).click()
  const campo2 = s1.getByRole('group', { name: 'Campo 2' })
  await campo2.getByLabel('Campo 2: etiqueta').fill('¿Qué necesitas?')
  await campo2.getByLabel('Tipo').selectOption('radio')
  await campo2.getByLabel('Opciones (una por línea)').fill('Equipo\nOtro')
  await campo2.getByLabel('Clave (para condiciones)').fill('necesidad')
  // Sección 2: solo si la respuesta es "Otro".
  await page.getByRole('button', { name: 'Agregar sección' }).click()
  const s2 = page.locator('.gest-fila').nth(1)
  await s2.getByLabel('Título de la sección').fill('Detalle de lo otro')
  await s2.getByLabel('Se muestra').selectOption({ label: 'Si «¿Qué necesitas?» es «Otro»' })

  // La vista previa muestra la sección 2 solo al elegir "Otro".
  await page.getByRole('button', { name: 'Vista previa' }).click()
  await expect(page.getByRole('heading', { name: 'Detalle de lo otro' })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Otro' }).check()
  await expect(page.getByRole('heading', { name: 'Detalle de lo otro' })).toBeVisible()

  await page.getByRole('button', { name: 'Guardar formulario' }).click()
  await expect(page).toHaveURL(/\/gestion\/formularios\/\d+/)
  await expect(page.locator('.home-toast.is-on')).toContainText('Formulario guardado')

  // Se ve en Formularios, en su área y marcado "De prueba".
  await page.goto('/formularios')
  const seccion = page.locator('section', { has: page.getByRole('heading', { name: 'Pruebas' }) })
  await expect(seccion.getByText(titulo)).toBeVisible()
  await expect(seccion.getByText('De prueba', { exact: true })).toBeVisible()
  await seccion.getByText(titulo).click()
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()

  // Se borra (todavía no tiene solicitudes).
  await page.goto('/gestion/formularios')
  await page.getByRole('button', { name: `Eliminar «${titulo}»` }).click()
  await page.getByRole('dialog', { name: 'Eliminar formulario' }).getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByRole('row', { name: new RegExp(titulo) })).toHaveCount(0)
  expect(errores()).toEqual([])
})

test('prender la recepción en un formulario con cédula muestra el motivo', async ({ page }) => {
  await entrar(page, 'gestor')
  await page.goto('/gestion/formularios')
  await page.getByRole('link', { name: /^Editar «Solicitud de Ingreso de Nuevos Funcionarios»/ }).click()
  await expect(page.getByText('Este formulario pide cédula.')).toBeVisible()
  await page.getByLabel('Recibe solicitudes').check()
  await page.getByRole('button', { name: 'Guardar formulario' }).click()
  await expect(page.getByRole('alert')).toContainText('la intranet no guarda cédulas')
})

test('un usuario no entra a la gestión de formularios', async ({ page }) => {
  await entrar(page, 'prueba1')
  await page.goto('/gestion/formularios')
  await expect(page.getByText('No tienes permiso para usar esta sección.')).toBeVisible()
  await page.goto('/gestion/formularios/nuevo')
  await expect(page.getByText('No tienes permiso para usar esta sección.')).toBeVisible()
})
