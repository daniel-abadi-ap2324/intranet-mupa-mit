/**
 * Nombres y correos largos (revisión de diseño, 26-oct-2026: «se le corta el nombre de la persona en una esquina»).
 * La sesión se simula con un nombre de 5 palabras y un correo largo sin espacios; en cada página y a varios anchos
 * se comprueba que el texto no queda cortado por el borde de la pantalla ni por un contenedor (se ajusta a varias
 * líneas) o, si se acorta con puntos suspensivos, que el nombre completo está en `title` o en `aria-label`.
 */
import { expect, test, type Page } from '@playwright/test'

import { entrar } from './ayuda'

const NOMBRE = 'María de los Ángeles'
const APELLIDO = 'Fernández de Castro González'
const CORREO = 'maria.de.los.angeles.fernandez.de.castro.gonzalez@alcaldiadepanama.gob.pa'

async function conNombreLargo(page: Page) {
  await entrar(page, 'admin')
  await page.route('**/api/auth/session', async (r) => {
    const resp = await r.fetch()
    const j = await resp.json()
    if (!j) return r.fulfill({ response: resp })
    return r.fulfill({ json: { ...j, firstName: NOMBRE, lastName: APELLIDO, email: CORREO } })
  })
}

/** Textos con el nombre o el correo que se ven cortados: por el borde de la pantalla o por un contenedor que recorta. */
async function cortados(page: Page) {
  return page.evaluate(() => {
    const claves = ['Fernández', 'alcaldiadepanama', 'María de los']
    const malos: string[] = []
    const completo = 'María de los Ángeles Fernández de Castro González'
    const ancho = document.documentElement.clientWidth
    const hojas = [...document.querySelectorAll<HTMLElement>('body *')]
    for (const el of hojas) {
      const textos = [...el.childNodes].filter((n): n is Text => n.nodeType === 3 && claves.some((c) => (n.textContent || '').includes(c)))
      if (!textos.length) continue
      const rb = el.getBoundingClientRect()
      if (rb.width === 0 || rb.height === 0) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden') continue
      const nombre = el.tagName + '.' + el.className
      // Con puntos suspensivos el texto se recorta a propósito: el nombre completo tiene que estar en title o aria-label.
      const acortado = cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1
      if (acortado) {
        let ok = false
        for (let a: HTMLElement | null = el; a; a = a.parentElement) {
          if ((a.getAttribute('title') || '').includes(completo) || (a.getAttribute('aria-label') || '').includes(completo)) ok = true
        }
        if (!ok) malos.push(`${nombre}: acortado sin el nombre completo accesible`)
        continue
      }
      for (const t of textos) {
        // Lo que ocupa el texto de verdad (no la caja del elemento, que puede ser más angosta que el texto que se sale).
        const rango = document.createRange()
        rango.selectNodeContents(t)
        const rc = rango.getBoundingClientRect()
        if (rc.left < -0.5 || rc.right > ancho + 0.5) malos.push(`${nombre}: fuera de la pantalla (${Math.round(rc.left)}–${Math.round(rc.right)} de ${ancho})`)
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const o = getComputedStyle(a)
          if (o.overflowX === 'visible' && o.overflowY === 'visible') continue
          const ra = a.getBoundingClientRect()
          if (rc.right > ra.right + 0.5 || rc.left < ra.left - 0.5) malos.push(`${nombre}: recortado por ${a.tagName}.${a.className}`)
        }
        // Y el propio elemento no puede dejar el texto salirse de su caja.
        if (rc.right > rb.right + 0.5 || rc.left < rb.left - 0.5) malos.push(`${nombre}: el texto se sale de su caja`)
      }
    }
    return malos
  })
}

const ANCHOS = [320, 390, 768, 1024, 1440, 1920]

for (const ancho of ANCHOS) {
  test(`nombre y correo largos sin cortarse a ${ancho} px`, async ({ page }) => {
    await conNombreLargo(page)
    await page.setViewportSize({ width: ancho, height: 900 })
    for (const ruta of ['/', '/configuracion', '/mis-solicitudes', '/gestion', '/entrar', '/registro']) {
      await page.goto(ruta)
      await page.locator('#contenido, main, .login, body').first().waitFor()
      await page.waitForTimeout(500)
      // Menú lateral: en teléfono es un cajón que se abre con «Más».
      if (ancho < 768 && !ruta.startsWith('/gestion') && ruta !== '/entrar' && ruta !== '/registro') {
        await page.locator('.app-menubtn').click()
        await page.waitForTimeout(300)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `${ruta} @${ancho}: desplazamiento horizontal`).toBe(false)
      expect(await cortados(page), `${ruta} @${ancho}`).toEqual([])
    }
  })
}

test('el menú de la cuenta muestra el nombre completo y el correo completo', async ({ page }) => {
  await conNombreLargo(page)
  for (const ancho of [320, 1440]) {
    await page.setViewportSize({ width: ancho, height: 800 })
    await page.goto('/clinica')
    await page.getByRole('button', { name: /^Tu cuenta: / }).click()
    const panel = page.locator('#cuenta-menu')
    await expect(panel).toContainText(`${NOMBRE} ${APELLIDO}`)
    await expect(panel).toContainText(CORREO)
    const caja = (await panel.boundingBox())!
    expect(caja.x).toBeGreaterThanOrEqual(0)
    expect(caja.x + caja.width).toBeLessThanOrEqual(ancho)
    // Los textos del panel caben dentro de él (se parten en líneas).
    expect(await page.evaluate(() => { const p = document.querySelector('#cuenta-menu')!; return p.scrollWidth <= p.clientWidth + 1 })).toBe(true)
  }
  // El botón lleva el nombre completo para lectores de pantalla y como ayuda al pasar el cursor.
  const boton = page.getByRole('button', { name: /^Tu cuenta: / })
  await expect(boton).toHaveAttribute('aria-label', `Tu cuenta: ${NOMBRE} ${APELLIDO}`)
  await expect(boton).toHaveAttribute('title', `${NOMBRE} ${APELLIDO}`)
})
