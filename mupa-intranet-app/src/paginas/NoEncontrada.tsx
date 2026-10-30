/** Cualquier dirección que no existe en la intranet. */
import React from 'react'
import { Link, useLocation } from 'react-router'

import { CabeceraPagina } from '../components/ui'

export function NoEncontrada() {
  const ruta = useLocation().pathname
  return (
    <div style={{ maxWidth: 760 }}>
      <CabeceraPagina titulo="Página no encontrada" intro={<>La dirección <code>{ruta}</code> no existe en la intranet.</>} />
      <div className="empty-state">
        <b>No encontrado</b>
        <p>Revisa la dirección o usa el buscador de arriba.</p>
        <p><Link className="ds-btn ds-btn--subtle" to="/">Volver al inicio</Link></p>
      </div>
    </div>
  )
}
