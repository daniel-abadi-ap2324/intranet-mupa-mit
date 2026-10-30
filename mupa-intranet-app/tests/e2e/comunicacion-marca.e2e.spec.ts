/**
 * Identidad visual y comunicación (/comunicacion y /comunicacion/guia-del-logo): el paquete de Comunicación
 * (logos, paleta, tipografías, texturas, manual, plantillas, redes). Lo que el paquete no trae se ve
 * «Pendiente de Comunicación» y sin enlace; no hay formulario de apoyo, comunicación escrita ni preguntas frecuentes.
 */
import { expect, test, type Page } from '@playwright/test'

import { vigilarErrores } from './ayuda'

/** Recorre la página para que carguen las imágenes perezosas y comprueba que ninguna quedó rota. */
async function imagenesCargadas(page: Page) {
  const alto = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y <= alto; y += 600) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(60)
  }
  await page.waitForLoadState('networkidle')
  const rotas = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src))
  expect(rotas).toEqual([])
}

test.describe('Identidad visual', () => {
  test('logos: 16 versiones con vista previa y descarga; el PDF que falta se dice', async ({ page }) => {
    const errores = vigilarErrores(page)
    await page.goto('/comunicacion')
    await expect(page.getByRole('heading', { level: 1, name: 'Identidad visual y comunicación' })).toBeVisible()
    await expect(page.locator('.cm-logo')).toHaveCount(16)

    // Cada versión con su vista previa (con texto alternativo) y sus descargas.
    const primera = page.locator('.cm-logo').first()
    await expect(primera.getByRole('img')).toHaveAttribute('alt', /Logo de la Alcaldía de Panamá/)
    await expect(primera.getByRole('link', { name: /en SVG/ })).toHaveAttribute('href', /^\/marca\/logos\/svg\/logo-.*\.svg$/)
    await expect(page.locator('.cm-logo .cm-dl[href$=".png"]')).toHaveCount(16)
    await expect(page.locator('.cm-logo .cm-dl[href$=".pdf"]')).toHaveCount(15)
    await expect(page.locator('.cm-logo .cm-dl.is-pendiente')).toHaveCount(1)
    await expect(page.locator('.cm-logo .cm-dl.is-pendiente')).toContainText('PDF · pendiente')

    // Descarga real de un archivo.
    const descarga = page.waitForEvent('download')
    await primera.getByRole('link', { name: /en PNG/ }).click()
    expect((await descarga).suggestedFilename()).toMatch(/^logo-.*\.png$/)

    // Filtro por orientación.
    await page.getByRole('button', { name: /^Vertical/ }).click()
    await expect(page.locator('.cm-logo')).toHaveCount(8)
    await expect(page.locator('.cm-logo').first()).toContainText('Vertical')
    await page.getByRole('button', { name: /^Todos/ }).click()
    await expect(page.locator('.cm-logo')).toHaveCount(16)

    await imagenesCargadas(page)
    expect(errores()).toEqual([])
  })

  test('paleta: HEX, RGB y CMYK donde lo entregó Comunicación, y botón de copiar', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/comunicacion')
    const paleta = page.locator('#paleta')
    await expect(paleta.locator('.cm-color')).toHaveCount(19)

    const brillante = paleta.locator('.cm-color', { hasText: 'Azul brillante' })
    await expect(brillante).toContainText('#0046EF')
    await expect(brillante).toContainText('0, 70, 239')
    // Sin CMYK entregado: la fila no se muestra (ni «Pendiente» ni un valor inventado).
    await expect(brillante).not.toContainText('CMYK')
    await expect(paleta.locator('.cm-pendiente')).toHaveCount(0)

    const inst = paleta.locator('.cm-color', { hasText: 'Azul institucional' })
    await expect(inst).toContainText('95, 76, 0, 0')

    await brillante.getByRole('button', { name: /Copiar el HEX/ }).click()
    await expect(page.getByText('HEX copiado: #0046EF')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('#0046EF')
    await inst.getByRole('button', { name: /Copiar el RGB/ }).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('8, 58, 197')
    await expect(paleta).toContainText('Pantone Reflex Blue C')
  })

  test('tipografías: Noka y Prometo no vienen en esta copia (licencia); Montserrat se descarga y se carga desde el propio sitio', async ({ page, request }) => {
    const fuentes: string[] = []
    page.on('request', (r) => r.url().includes('/fonts/') && fuentes.push(new URL(r.url()).pathname))
    await page.goto('/comunicacion')
    const tipos = page.locator('#tipografias')
    await expect(tipos.locator('.cm-tipo')).toHaveCount(3)
    for (const nombre of ['Noka', 'Prometo']) {
      const tipo = tipos.locator('.cm-tipo', { hasText: nombre })
      await expect(tipo.getByRole('link', { name: /Descargar/ })).toHaveCount(0)
      await expect(tipo).toContainText('no incluida en esta copia')
    }
    const montserrat = tipos.locator('.cm-tipo', { hasText: 'Montserrat' }).getByRole('link', { name: /Descargar/ })
    await expect(montserrat).toHaveAttribute('href', '/marca/tipografias/Montserrat.zip')
    expect((await request.head('/marca/tipografias/Montserrat.zip')).status()).toBe(200)
    // Solo se carga Montserrat, desde el propio sitio, y los títulos la usan.
    await page.waitForLoadState('networkidle')
    const cargadas = await page.evaluate(async () => {
      await document.fonts.ready
      return [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')))]
    })
    expect(cargadas).toEqual(['Montserrat'])
    expect(fuentes.every((f) => /^[/]fonts[/]Montserrat-\d+[.]woff2$/.test(f))).toBe(true)
    expect(await page.locator('h1').evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^"?Montserrat/)
  })

  test('texturas, manual y plantillas: archivos que existen y se descargan', async ({ page, request }) => {
    await page.goto('/comunicacion')
    await expect(page.locator('#texturas .cm-texturas img')).toHaveCount(3)
    await expect(page.locator('#texturas').getByRole('link', { name: /editable \(\.ai\)/ })).toHaveAttribute('href', '/marca/texturas/texturas-editable.ai')

    // El manual y la guía se abren en otra pestaña, con rel seguro.
    const manual = page.locator('#manual').getByRole('link', { name: /Manual de marca/ })
    await expect(manual).toHaveAttribute('target', '_blank')
    await expect(manual).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(manual).toHaveAttribute('href', '/marca/manual/manual-de-marca.pdf')

    const plantillas = page.locator('#plantillas')
    // La firma es un .ai editable: solo se descarga, sin vista previa.
    await expect(plantillas.getByRole('link', { name: /Firma digital/ })).toHaveAttribute('href', /firma-digital-editable\.ai$/)
    await expect(plantillas.getByRole('link', { name: /Firma digital/ }).locator('img')).toHaveCount(0)
    await expect(plantillas.locator('.cm-wallpapers li')).toHaveCount(12)
    await expect(plantillas.locator('.cm-desc__img')).toHaveAttribute('alt', /videollamada/)

    // Todos los enlaces a /marca/ responden.
    const rutas = await page.locator('a[href^="/marca/"]').evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!))])
    expect(rutas.length).toBeGreaterThan(40)
    for (const r of rutas) expect((await request.head(r)).status(), r).toBe(200)
  })

  test('redes: las cuentas oficiales, en pestaña nueva y con rel seguro; el YouTube de I★PTY no se muestra', async ({ page }) => {
    await page.goto('/comunicacion')
    const redes = page.locator('#redes a')
    await expect(redes).toHaveCount(10)
    for (const a of await redes.all()) {
      await expect(a).toHaveAttribute('target', '_blank')
      await expect(a).toHaveAttribute('rel', 'noopener noreferrer')
      await expect(a).toHaveAttribute('href', /^https:\/\//)
    }
    await expect(page.getByRole('link', { name: 'Alcaldía de Panamá en Facebook (se abre en otra pestaña)' })).toHaveAttribute('href', 'https://www.facebook.com/municipio.depanama/')
    await expect(page.getByRole('link', { name: /Alcaldía de Panamá en YouTube/ })).toHaveAttribute('href', 'https://www.youtube.com/@panamadealcaldia')
    await expect(page.locator('#redes .cm-cuenta', { hasText: 'I★PTY' }).getByRole('link')).toHaveCount(3)
    await expect(page.getByRole('link', { name: /I★PTY en YouTube/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Policía Municipal en Instagram (se abre en otra pestaña)' })).toHaveAttribute('href', 'https://www.instagram.com/policiamunicipal_pty')
    // El pie del sitio usa los mismos enlaces nuevos.
    const pie = page.locator('footer')
    await expect(pie.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', 'https://www.facebook.com/municipio.depanama/')
    await expect(pie.getByRole('link', { name: 'YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/@panamadealcaldia')
  })

  test('sin formulario de apoyo, comunicación escrita ni preguntas frecuentes; a quién contactar, del directorio', async ({ page }) => {
    const errores = vigilarErrores(page)
    await page.goto('/comunicacion')
    await expect(page.getByRole('link', { name: /Solicitar apoyo/ })).toHaveCount(0)
    await expect(page.locator('main a[href^="/formularios"]')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /Preguntas frecuentes|Comunicación escrita/ })).toHaveCount(0)

    const contactar = page.locator('#contacto')
    await expect(contactar).toContainText('Recepción')
    await expect(contactar.locator('li', { hasText: 'ext. 4300' })).toBeVisible()
    await expect(contactar.locator('li', { hasText: 'ext. 4310' })).toContainText('Redes Sociales')
    // Sin correo: no se pide ni se muestra como pendiente.
    await expect(contactar.getByText(/correo/i)).toHaveCount(0)
    await contactar.getByRole('link', { name: /extensiones de Comunicaciones/ }).click()
    await expect(page).toHaveURL(/\/directorio\?dir=Comunicaciones$/)
    expect(errores()).toEqual([])
  })

  test('guía rápida del logo: los cuatro temas de la guía, sin inventar la medida mínima', async ({ page }) => {
    const errores = vigilarErrores(page)
    await page.goto('/comunicacion')
    await page.locator('#manual').getByRole('link', { name: /Guía rápida de uso del logo/ }).click()
    await expect(page).toHaveURL(/\/comunicacion\/guia-del-logo$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Guía rápida de uso del logo' })).toBeVisible()
    for (const h of ['¿Qué logo debo usar?', 'Tamaño mínimo y proporciones', 'Errores frecuentes']) await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible()
    // Correcto e incorrecto se dicen con texto, no solo con color.
    expect(await page.locator('.gl-ej.is-ok figcaption b').first().textContent()).toContain('Correcto')
    expect(await page.locator('.gl-ej.is-mal figcaption b').first().textContent()).toContain('No hacer')
    await expect(page.getByText('no fija una medida mínima')).toBeVisible()
    await expect(page.locator('.cm-pendiente')).toContainText('Pendiente de Comunicación')
    await expect(page.getByRole('link', { name: /PDF original/ })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(errores()).toEqual([])
  })

  test('las imágenes tienen texto alternativo y las páginas no se salen de la pantalla en el celular', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (const ruta of ['/comunicacion', '/comunicacion/guia-del-logo']) {
      await page.goto(ruta)
      await page.waitForLoadState('networkidle')
      expect(await page.locator('main img:not([alt])').count(), ruta + ': imágenes sin alt').toBe(0)
      const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ventana: window.innerWidth }))
      expect(ancho.doc, ruta + ': scroll horizontal').toBeLessThanOrEqual(ancho.ventana)
    }
  })

  test('el sitio usa el logo oficial en el menú, el login y el pie, sin errores', async ({ page }) => {
    const errores = vigilarErrores(page)
    await page.goto('/')
    await expect(page.locator('.app-sidebar .brand-logo--h')).toHaveAttribute('src', '/marca/logos/svg/logo-azul-sobre-blanco-horizontal.svg')
    await expect(page.locator('.app-sidebar .brand-logo--h')).toBeVisible()
    await expect(page.locator('footer img').first()).toHaveAttribute('src', '/marca/logos/svg/logo-azul-navy-sobre-blanco-horizontal.svg')
    await page.goto('/entrar')
    await expect(page.locator('.login__marca img')).toHaveAttribute('alt', 'Alcaldía de Panamá')
    expect(await page.locator('.login__marca img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0)
    expect(errores()).toEqual([])
  })

  test('Inicio: la tarjeta de identidad visual lleva a la sección y a la guía', async ({ page }) => {
    await page.goto('/')
    const tarjeta = page.locator('#identidad-visual')
    await expect(tarjeta.getByRole('heading', { name: 'Identidad visual' })).toBeVisible()
    await tarjeta.getByRole('link', { name: 'Paleta' }).click()
    await expect(page).toHaveURL(/\/comunicacion#paleta$/)
    await expect(page.locator('#paleta')).toBeInViewport()
    await page.goto('/')
    await page.locator('#identidad-visual').getByRole('link', { name: 'Guía del logo' }).click()
    await expect(page).toHaveURL(/\/comunicacion\/guia-del-logo$/)
    // El menú marca «Identidad visual» también en la guía.
    await expect(page.locator('.app-sidebar [aria-current="page"]')).toContainText('Identidad visual')
  })
})
