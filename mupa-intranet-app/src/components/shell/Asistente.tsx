/**
 * Botón «Asistente» de la barra superior: abre la página del asistente (/asistente). Antes era un panel
 * emergente; desde oct-2026 el asistente tiene su propia página (paginas/Asistente.tsx).
 */
import React from 'react'
import { Link, useLocation } from 'react-router'

import { Icono } from './Iconos'

export function Asistente() {
  const aqui = useLocation().pathname === '/asistente'
  return (
    <Link className="app-iconbtn app-iconbtn--txt ia-glow" to="/asistente" title="Asistente" aria-current={aqui ? 'page' : undefined}>
      <Icono nombre="asistente" />
      <span className="lbl">Asistente</span>
    </Link>
  )
}
