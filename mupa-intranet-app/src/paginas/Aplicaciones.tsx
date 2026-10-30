import React from 'react'

import { Catalogo } from '../components/Catalogo'
import { CabeceraPagina } from '../components/ui'
import { useDatos } from '../datos'
import { tieneRol } from '../lib/roles'

export function Aplicaciones() {
  const { apps, usuario } = useDatos()
  // Solo quien edita el catálogo ve cuántas están por confirmar (las ve marcadas en la grilla).
  const porConfirmar = tieneRol(usuario, 'admin') ? apps.filter((a) => a.confirmado === false).length : 0
  return (
    <>
      <CabeceraPagina miga="Aplicaciones" titulo="Aplicaciones de la Alcaldía" intro="Todos los sistemas de la Alcaldía en un solo lugar." />
      {porConfirmar > 0 && (
        <div className="notice">
          <span className="ic" aria-hidden="true">ⓘ</span>
          <p>
            Hay <b>{porConfirmar}</b> marcadas <b>«Por confirmar»</b>: su descripción está deducida del nombre y falta que DITI la revise.
          </p>
        </div>
      )}
      <Catalogo apps={apps} />
    </>
  )
}
