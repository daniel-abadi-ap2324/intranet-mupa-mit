import { useMemo } from 'react'

import { DIRECTORIO } from '../data/directorio'
import { useDatos } from '../datos'
import { indiceBusqueda, type Resultado } from './busqueda'

/** El índice de búsqueda de esta persona (lo usan la barra superior y la caja del Inicio). */
export function useIndiceBusqueda(): Resultado[] {
  const { apps, contenido, formularios, noticias } = useDatos()
  return useMemo(
    () =>
      indiceBusqueda(apps, (contenido.enlaces || []) as { t: string; g?: string | null; h?: string | null }[], formularios, {
        personas: DIRECTORIO.personas,
        noticias,
      }),
    [apps, contenido, formularios, noticias],
  )
}
