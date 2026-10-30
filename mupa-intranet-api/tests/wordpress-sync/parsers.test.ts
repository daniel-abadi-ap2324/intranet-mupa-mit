import { describe, expect, it } from 'vitest'

import { articleText, plainText } from '../../src/shared/services/wordpress.service.ts'
import { bulletinDate, dateFromTitle } from '../../src/features/wordpress-sync/wordpress-sync.service.ts'

describe('dateFromTitle', () => {
  it('lee el título de los boletines de mupa.gob.pa', () => {
    expect(dateFromTitle('AlcalDía 30 de septiembre. 2026')).toBe('2026-09-30')
    expect(dateFromTitle('Alcaldía 5 de julio 2024')).toBe('2024-07-05')
    expect(dateFromTitle('AlcalDía 9 de julio de 2024')).toBe('2024-07-09')
    expect(dateFromTitle('AlcalDía 1 de Setiembre 2026')).toBe('2026-09-01')
  })

  it('devuelve null si no hay fecha válida', () => {
    expect(dateFromTitle('Boletín especial')).toBeNull()
    expect(dateFromTitle('AlcalDía 31 de febrero 2026')).toBeNull()
    expect(dateFromTitle('AlcalDía 3 de mayito 2026')).toBeNull()
  })
})

describe('bulletinDate', () => {
  const publicado = new Date('2026-09-30T20:44:10Z') // 15:44 en Panamá

  it('usa la fecha del título', () => {
    expect(bulletinDate('AlcalDía 29 de septiembre. 2026', publicado)).toBe('2026-09-29')
  })

  it('sin fecha en el título usa la de publicación en hora de Panamá', () => {
    expect(bulletinDate('Boletín especial', publicado)).toBe('2026-09-30')
    // 02:00 UTC del 1 de octubre sigue siendo 30 de septiembre en Panamá.
    expect(bulletinDate('Boletín especial', new Date('2026-10-01T02:00:00Z'))).toBe('2026-09-30')
  })

  it('si el título está a más de 45 días de la publicación (año mal escrito), usa la publicación', () => {
    expect(bulletinDate('AlcalDía 30 de septiembre. 2025', publicado)).toBe('2026-09-30')
  })
})

describe('plainText', () => {
  it('quita etiquetas y decodifica entidades', () => {
    expect(plainText('<p>Alcaldía &#8211; &#8220;Panamá&#8221; &amp; más&nbsp;[&hellip;]</p>')).toBe('Alcaldía – “Panamá” & más […]')
    expect(plainText('Ni&#xF1;ez <b>que</b>\n  brilla')).toBe('Niñez que brilla')
  })

  it('no inventa nada con entidades desconocidas ni números absurdos', () => {
    expect(plainText('a &zzz; b &#99999999; c')).toBe('a &zzz; b c')
  })
})

describe('articleText', () => {
  it('saca los párrafos del HTML de Elementor, sin estilos, galerías ni etiquetas', () => {
    const html = `<div class="elementor"><div dir="auto">Primer párrafo con &laquo;comillas&raquo;.</div><div dir="auto"> </div><div dir="auto">Segundo&nbsp;párrafo<br>con salto.</div>
      <div dir="auto"><p><style>#gallery-2 {margin:auto}</style><div class='gallery'><dl class='gallery-item'><dt><a href='x'><img src='y.jpg' alt=''></a></dt><dd>Pie de foto</dd></dl></div></p></div>
      <script>alert(1)</script><div dir="auto">Tercero</div></div>`
    expect(articleText(html)).toBe('Primer párrafo con «comillas».\n\nSegundo párrafo\n\ncon salto.\n\nTercero')
  })

  it('sin texto devuelve vacío y corta lo larguísimo', () => {
    expect(articleText('<div> </div><img src="a.jpg">')).toBe('')
    expect(articleText(`<p>${'a'.repeat(30_000)}</p>`)).toHaveLength(20_000)
  })
})
