/**
 * Vista de las páginas con listas de archivos y entradas (Noticias, Boletines, Documentos, Manuales): en bloques
 * (tarjetas con la portada o el PDF a la vista, como Google Drive) o en lista. Bloques es lo de siempre; la elección se
 * recuerda en este navegador y vale para todas esas páginas.
 */
import { useCallback, useState } from 'react'

export type Vista = 'bloques' | 'lista'

const CLAVE = 'mupa:vista'

export function leerVista(): Vista {
  try {
    return localStorage.getItem(CLAVE) === 'lista' ? 'lista' : 'bloques'
  } catch {
    return 'bloques'
  }
}

export function useVista(): [Vista, (v: Vista) => void] {
  const [vista, setVista] = useState<Vista>(leerVista)
  const cambiar = useCallback((v: Vista) => {
    setVista(v)
    try {
      localStorage.setItem(CLAVE, v)
    } catch {
      // Sin almacenamiento (ventana privada): la elección dura lo que dura la página.
    }
  }, [])
  return [vista, cambiar]
}
