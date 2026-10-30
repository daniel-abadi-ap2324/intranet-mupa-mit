/**
 * Esta copia del repositorio no trae las llaves de los sistemas de la Alcaldía (Identity Central, RH Link,
 * la Clínica, códigos de llamada, GLPI y el servidor del asistente). Lo que depende de una de ellas lo dice
 * con este aviso corto, en vez de quedar vacío o dar un error.
 */
import React from 'react'

import { Aviso } from './ui'

export function SinLlave({ que, children }: { que: string; children?: React.ReactNode }) {
  return (
    <div className="sin-llave">
      <Aviso>
        {que} requiere una llave que no está incluida en esta copia.{children && <> {children}</>}
      </Aviso>
    </div>
  )
}
