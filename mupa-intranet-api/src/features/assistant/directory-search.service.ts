import { directoryService, type DirectoryEntry } from '../directory/directory.service.ts'
import { normalizeSearch } from '../../shared/services/pdf-text.service.ts'
import { coverage, questionTerms } from './content-search.service.ts'

export type { DirectoryEntry }

const MAX_PEOPLE = 8

/**
 * Busca en el directorio telefónico de la intranet (nombres, dirección, extensión y ubicación) a las personas u
 * oficinas que nombra la pregunta. Lee lo mismo que muestra /directorio (con la copia de la central, si la hay):
 * nada de cédulas ni datos que no estén ahí.
 */
export class DirectorySearchService {
  private readonly source: () => DirectoryEntry[]
  private entries: DirectoryEntry[] = []
  private texts: string[] = []

  constructor(source: DirectoryEntry[] | (() => DirectoryEntry[]) = () => directoryService.people()) {
    this.source = typeof source === 'function' ? source : () => source
  }

  /** Vuelve a indexar solo cuando cambia la lista (después de una sincronización con la central). */
  private load(): DirectoryEntry[] {
    const entries = this.source()
    if (entries !== this.entries) {
      this.entries = entries
      this.texts = entries.map((e) => normalizeSearch([e.nombre, e.apellido, e.direccion, e.ubicacion].join(' ')))
    }
    return this.entries
  }

  /** Hasta 8 personas u oficinas que coinciden con las palabras de la pregunta (las que más palabras cubren primero). */
  search(question: string, limit = MAX_PEOPLE): DirectoryEntry[] {
    const entries = this.load()
    const terms = questionTerms(question)
    if (!entries.length || !terms.length) return []
    const scores = coverage(this.texts, terms)
    const best = Math.max(...scores)
    if (best <= 0) return []
    // Solo las que cubren casi tanto como la mejor: «Marta Ejemplar» no trae a todos los Ejemplar de otra área.
    return scores
      .map((s, i) => ({ s, e: entries[i] }))
      .filter((x) => x.s > 0 && x.s >= best * 0.75)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((x) => x.e)
  }
}

export const directorySearchService = new DirectorySearchService()
