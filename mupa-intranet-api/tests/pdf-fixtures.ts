/** PDF de prueba con TEXTO de varios tamaños (titulares grandes y cuerpo chico), armado a mano. */
export type PdfText = { size: number; text: string }

export function textPdf(pages: PdfText[][]): Buffer {
  const objs: string[] = []
  // 1 catálogo, 2 páginas, 3 fuente; luego, por página, su objeto y su contenido.
  objs.push('<< /Type /Catalog /Pages 2 0 R >>')
  objs.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`)
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  pages.forEach((lines, i) => {
    let y = 760
    const stream = lines
      .map((l) => {
        y -= l.size + 14
        // Solo ASCII y sin paréntesis: el PDF se escribe en latin1 y no hace falta escapar nada.
        return `BT /F1 ${l.size} Tf 40 ${y} Td (${l.text}) Tj ET`
      })
      .join('\n')
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`)
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  })
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

// Cada línea cabe en el ancho de la página (612 pt): pdfjs corta lo que se sale.
const CUERPO = 'El proyecto de reciclaje avanza en los barrios y llegara a mas escuelas.'

/** Un boletín de dos páginas: dos titulares grandes, el número de página y mucho texto de cuerpo sobre reciclaje y mercados. */
export function boletinDePrueba(): Buffer {
  return textPdf([
    [
      { size: 60, text: 'ALCALDIA' },
      { size: 22, text: 'Nuevo programa de reciclaje en los barrios' },
      { size: 11, text: CUERPO },
      { size: 11, text: CUERPO },
      { size: 11, text: 'Los mercados municipales ampliaran su horario para mas visitantes.' },
    ],
    [
      { size: 18, text: '2' },
      { size: 22, text: 'Mercados municipales con horario extendido' },
      { size: 11, text: CUERPO },
      { size: 11, text: 'Los mercados municipales abriran hasta las ocho de la noche.' },
    ],
  ])
}

const TEATRO = 'El festival de teatro llenara de arte el casco antiguo con teatro y musica.'

/** Un boletín de una página sobre un festival de teatro: un titular y varias líneas de cuerpo. */
export function boletinDeTeatro(): Buffer {
  return textPdf([[{ size: 22, text: 'Festival de teatro en el casco antiguo' }, ...Array.from({ length: 6 }, () => ({ size: 11, text: TEATRO }))]])
}
