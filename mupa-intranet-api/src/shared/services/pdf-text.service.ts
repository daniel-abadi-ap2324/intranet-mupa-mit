import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

/**
 * Lee el TEXTO de un PDF (los boletines «Alcaldía al día») y saca de él lo que sirve para encontrarlo:
 * una descripción corta (sus titulares, los textos grandes de la portada y las páginas), palabras clave y
 * el texto para buscar. Todo sale del propio PDF: no se inventa nada. Sin texto (un PDF escaneado),
 * devuelve null.
 */
export type PdfInfo = {
  /** Los titulares, separados por « · ». Null si no se encontró ninguno. */
  summary: string | null
  /** Palabras clave, de la más a la menos importante. */
  keywords: string[]
  /** Titulares, palabras clave y texto, sin tildes ni mayúsculas, para buscar con `normalizeSearch`. */
  searchText: string
}

/** Tope de lo que se guarda del texto de cada boletín (el de cuatro páginas ronda los 6 000 caracteres). */
const MAX_SEARCH_CHARS = 12_000
const MAX_PAGES = 12
const MAX_HEADLINES = 3
const MAX_SUMMARY_CHARS = 240
const MAX_KEYWORDS = 8

/** Sin tildes, en minúsculas y con los espacios normalizados: así se guarda y así se busca. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const STOPWORDS = new Set(
  (
    'para como pero porque cuando donde desde hasta entre sobre ante bajo tras durante mediante según segun ' +
    'esta este estos estas esto esos esas ese esa aquel aquella ellos ellas nosotros ustedes ' +
    'tiene tienen tener tendrá tendrán tuvo hace hacen hacer hizo será serán sido siendo está están estará ' +
    'puede pueden podrá podrán debe deben cada todo todos toda todas otro otros otra otras mismo misma ' +
    'también tambien además ademas aunque sino solo sólo muy más mas menos mucho muchos muchas poco pocos ' +
    'ahora antes después despues luego siempre nunca todavía aún aun así asi cual cuales quien quienes ' +
    'dijo dijeron señaló indicó explicó informó destacó anunció agregó expresó afirmó ' +
    'través entre unos unas una uno dos tres cuatro cinco seis siete ocho nueve diez ' +
    // De todos los boletines (no distinguen a uno de otro).
    'alcaldía alcaldia panamá panama alcalde mizrachi municipal municipales municipio boletín boletin ' +
    'informativo informativa lunes martes miércoles miercoles jueves viernes sábado sabado domingo ' +
    'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'
  ).split(' '),
)

type Line = { page: number; y: number; size: number; text: string }

/** Las líneas de texto de la página, de arriba a abajo, con el tamaño de letra más grande de cada una. */
function pageLines(page: number, items: { str: string; transform: number[] }[]): Line[] {
  const rows = new Map<number, { y: number; size: number; parts: { x: number; s: string }[] }>()
  for (const item of items) {
    if (!item.str.trim()) continue
    const size = Math.hypot(item.transform[0], item.transform[1])
    const y = Math.round(item.transform[5])
    const row = rows.get(y) ?? { y, size: 0, parts: [] }
    row.parts.push({ x: item.transform[4], s: item.str })
    row.size = Math.max(row.size, size)
    rows.set(y, row)
  }
  return [...rows.values()]
    .sort((a, b) => b.y - a.y)
    .map((r) => ({ page, y: r.y, size: r.size, text: r.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim() }))
    .filter((l) => l.text)
}

/** Lo que se repite en todos los boletines (cabecera, números de página, fechas): no es un titular. */
const NOT_HEADLINE = [/^\d{1,3}$/, /^alcald[ií]a( de panam[aá])?$/i, /^tu bolet[ií]n informativo$/i, /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo),? /i, /^www\./i, /casa de la municipalidad/i]

function sentenceCase(text: string): string {
  const letters = text.replace(/[^\p{L}]/gu, '')
  if (letters.length < 4 || letters !== letters.toUpperCase()) return text
  const lower = text.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/** Titulares: las líneas con letra bastante más grande que el cuerpo; las seguidas y del mismo tamaño forman uno solo. */
export function findHeadlines(lines: Line[]): string[] {
  const sizes = lines.map((l) => l.size).sort((a, b) => a - b)
  if (!sizes.length) return []
  const median = sizes[Math.floor(sizes.length / 2)]
  const big = lines.filter((l) => l.size >= median * 1.6 && l.size >= 14 && !NOT_HEADLINE.some((re) => re.test(l.text)))

  const groups: Line[][] = []
  for (const line of big) {
    const group = groups.at(-1)
    const last = group?.at(-1)
    const together = last && last.page === line.page && Math.abs(last.size - line.size) / last.size <= 0.25 && last.y - line.y <= last.size * 2
    if (group && together) group.push(line)
    else groups.push([line])
  }
  const seen = new Set<string>()
  const headlines: string[] = []
  for (const group of groups) {
    const text = sentenceCase(group.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim())
    const key = normalizeSearch(text)
    // Dos palabras («Retira tu») son un pedazo de un anuncio, no un titular.
    if (text.length < 12 || text.split(' ').length < 3 || seen.has(key)) continue
    seen.add(key)
    headlines.push(text)
  }
  return headlines
}

/** Las palabras que más pesan en el boletín: las de los titulares valen triple; sin las que no distinguen (artículos, meses, «Alcaldía»…). */
export function findKeywords(headlines: string[], body: string): string[] {
  const score = new Map<string, number>()
  const add = (text: string, weight: number) => {
    for (const word of text.toLowerCase().match(/\p{L}{5,}/gu) ?? []) {
      if (STOPWORDS.has(word) || STOPWORDS.has(normalizeSearch(word))) continue
      score.set(word, (score.get(word) ?? 0) + weight)
    }
  }
  add(body, 1)
  add(headlines.join(' '), 3)
  return [...score]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .slice(0, MAX_KEYWORDS)
    .map(([word]) => word)
}

/** Descripción corta, palabras clave y texto para buscar de un PDF. Lanza un Error si no se puede leer el PDF. */
export async function describePdf(pdf: Buffer): Promise<PdfInfo | null> {
  const task = getDocument({ data: new Uint8Array(pdf), verbosity: 0 })
  try {
    const doc = await task.promise
    const lines: Line[] = []
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const content = await (await doc.getPage(n)).getTextContent()
      lines.push(...pageLines(n, content.items.filter((i): i is typeof i & { str: string } => 'str' in i) as { str: string; transform: number[] }[]))
    }
    const body = lines.map((l) => l.text).join('\n')
    if (body.replace(/\s/g, '').length < 40) return null

    const headlines = findHeadlines(lines)
    const keywords = findKeywords(headlines, body)
    let summary = headlines.slice(0, MAX_HEADLINES).join(' · ')
    if (summary.length > MAX_SUMMARY_CHARS) summary = summary.slice(0, MAX_SUMMARY_CHARS - 1).replace(/\s+\S*$/, '') + '…'
    return {
      summary: summary || null,
      keywords,
      searchText: normalizeSearch([headlines.join(' '), keywords.join(' '), body].join(' ')).slice(0, MAX_SEARCH_CHARS),
    }
  } finally {
    await task.destroy()
  }
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** La fecha dicha de varias formas, para encontrar un boletín por «septiembre», «30 de septiembre» o «2026-09-30». */
export function dateWords(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return normalizeSearch(`${d} de ${MONTHS[m - 1]} de ${y} ${MONTHS[m - 1]} ${y} ${date} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`)
}
