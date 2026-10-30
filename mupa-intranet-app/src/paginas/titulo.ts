import { useEffect } from 'react'

/** Título de la pestaña: "Aplicaciones — Intranet MUPA". Sin título = Inicio. */
export function useTitulo(t?: string) {
  useEffect(() => {
    document.title = (t || 'Inicio') + ' — Intranet MUPA'
  }, [t])
}
