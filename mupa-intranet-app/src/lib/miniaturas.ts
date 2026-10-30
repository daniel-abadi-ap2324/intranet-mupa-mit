/**
 * Miniatura de la primera página de un PDF de /sitio/ (Documentos y Manuales). Las dibuja una vez
 * mupa-intranet-api/scripts/miniaturas-documentos.ts y quedan en public/sitio/miniaturas/; sin miniatura, null.
 */
import HECHAS from '../data/miniaturas.json'

const CON_MINIATURA = new Set<string>(HECHAS)

export const miniaturaPdf = (h: string | null | undefined): string | null =>
  h && CON_MINIATURA.has(h) ? '/sitio/miniaturas/' + h.slice('/sitio/'.length).replace(/\.pdf$/, '.webp') : null
