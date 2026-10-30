/**
 * Jerarquía tipográfica de «Tu día» en el Inicio (revisión de diseño, 26-oct-2026: «el texto de la columna derecha se ve más
 * grande que el de la izquierda pero con menos peso»; sin la sesión iniciada). Sin sesión la tarjeta solo tenía un
 * párrafo de 14 px / 400, más grande y más liviano que el texto pequeño de la izquierda (la fecha del saludo, 13 px / 600).
 * Regla que se mide con los estilos calculados: lo principal (títulos, valores) es más grande o más grueso que lo
 * secundario (avisos, fechas), nunca al revés; y lo secundario de la derecha no supera al de la izquierda.
 */
import { expect, test, type Page } from '@playwright/test'

import { entrar } from './ayuda'

type Estilo = { texto: string; s: number; w: number }

async function medir(page: Page) {
  return page.evaluate(() => {
    const est = (el: Element): { texto: string; s: number; w: number } => {
      const c = getComputedStyle(el)
      return { texto: (el.textContent || '').trim().slice(0, 40), s: parseFloat(c.fontSize), w: Number(c.fontWeight) }
    }
    const raiz = document.querySelector('[data-testid="tu-dia"]')
    if (!raiz) throw new Error('No se ve «Tu día»')
    const fecha = document.querySelector('.home-hero .date, .date')
    const tarjetas = [...raiz.querySelectorAll('.dia__card')].map((c) => {
      const h = c.querySelector('h3')!
      const textos = [...c.querySelectorAll('p, span, b, dd, dt, a')]
        // Solo el texto propio y visible; los íconos, los contadores y los enlaces de acción no cuentan como texto secundario.
        .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 2))
        .filter((e) => !e.closest('h3, .dia__ic, .dia__n, .dia__mas'))
        .map((e) => ({ ...est(e), clase: e.className.toString() }))
      return { titulo: est(h), textos }
    })
    return {
      h2: est(raiz.querySelector('h2')!),
      fecha: fecha ? est(fecha) : null,
      subfecha: est(raiz.querySelector('.dia__head p')!),
      tarjetas,
    }
  })
}

const masGrandeYMasLiviano = (a: Estilo, b: Estilo) => a.s > b.s && a.w < b.w

for (const ancho of [1440, 390]) {
  for (const sesion of [false, true]) {
    test(`Inicio ${sesion ? 'con' : 'sin'} sesión a ${ancho} px: «Tu día» no tiene texto más grande y más liviano que su título`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 })
      if (sesion) await entrar(page, 'admin')
      else await page.goto('/')
      await expect(page.getByTestId('tu-dia')).toBeVisible()
      await page.waitForTimeout(500)
      const m = await medir(page)

      expect(m.tarjetas.length).toBeGreaterThan(0)
      for (const t of m.tarjetas) {
        // El título de cada tarjeta (h3) es lo principal: nada de la tarjeta es más grande y más liviano que él.
        for (const x of t.textos) {
          expect(masGrandeYMasLiviano(x, t.titulo), `«${x.texto}» (${x.s}/${x.w}) contra el título «${t.titulo.texto}» (${t.titulo.s}/${t.titulo.w})`).toBe(false)
        }
        // Los avisos y las notas (secundario) no superan el tamaño del título.
        for (const x of t.textos.filter((y) => /dia__vacio/.test(y.clase))) expect(x.s).toBeLessThanOrEqual(t.titulo.s)
      }
      // El título de la columna es lo más importante de ella: no es más liviano ni más chico que el de las tarjetas.
      for (const t of m.tarjetas) {
        expect(m.h2.s).toBeGreaterThanOrEqual(t.titulo.s)
        expect(m.h2.w).toBeGreaterThanOrEqual(t.titulo.w)
      }
      // Noka solo existe en 500, 700 y 800: el peso declarado es el que se ve.
      expect([500, 700, 800]).toContain(m.h2.w)
      // Lo secundario de la derecha (la fecha y los avisos) no es más grande que lo secundario de la izquierda (la fecha del saludo).
      if (m.fecha) {
        expect(m.subfecha.s).toBeLessThanOrEqual(m.fecha.s)
        for (const t of m.tarjetas) for (const x of t.textos.filter((y) => /dia__vacio/.test(y.clase))) expect(x.s).toBeLessThanOrEqual(m.fecha.s)
      }
    })
  }
}

test('sin sesión, la tarjeta de «Tu día» tiene el mismo esqueleto que las demás: título y aviso', async ({ page }) => {
  await page.goto('/')
  const tarjeta = page.getByTestId('tu-dia').locator('.dia__card').first()
  await expect(tarjeta.getByRole('heading', { level: 3, name: 'Solicitudes y citas' })).toBeVisible()
  await expect(tarjeta).toContainText('Inicia sesión para ver aquí tus solicitudes abiertas y tu próxima cita')
  await expect(tarjeta.getByRole('link', { name: 'Inicia sesión' })).toBeVisible()
})
