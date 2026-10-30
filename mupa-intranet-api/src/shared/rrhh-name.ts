/**
 * El nombre que da RH Link viene en un solo campo y en mayúsculas ("JUAN CARLOS PEREZ GOMEZ"). Aquí se pasa a
 * «Juan Carlos Perez Gomez» y se separa en nombre y apellido según el orden configurado (RRHH_NOMBRE_ORDEN):
 *  - nombres-primero: «NOMBRE(S) APELLIDO(S)»: el nombre es la primera palabra (o las dos primeras si son 4 o más).
 *  - apellidos-primero: «APELLIDO(S) NOMBRE(S)»: los apellidos son las dos primeras palabras (o la primera si hay 2).
 */
export type NameOrder = 'nombres-primero' | 'apellidos-primero'

const SMALL = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e'])

/** "JUAN CARLOS" → "Juan Carlos" (las partículas "de", "del"… en minúscula salvo al inicio). */
export function titleCase(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      const lower = w.toLowerCase()
      return i > 0 && SMALL.has(lower) ? lower : lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

export function splitRrhhName(raw: string, order: NameOrder): { fullName: string; firstName: string; lastName: string } | null {
  const words = raw.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return null
  const fullName = titleCase(words.join(' '))
  const w = fullName.split(' ')
  if (order === 'apellidos-primero') {
    const surnames = w.length >= 3 ? 2 : 1
    return { fullName, firstName: w.slice(surnames).join(' '), lastName: w.slice(0, surnames).join(' ') }
  }
  const given = w.length >= 4 ? 2 : 1
  return { fullName, firstName: w.slice(0, given).join(' '), lastName: w.slice(given).join(' ') }
}
