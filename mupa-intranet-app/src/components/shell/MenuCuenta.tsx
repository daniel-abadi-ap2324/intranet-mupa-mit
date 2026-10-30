/**
 * Menú de la cuenta (barra superior): el botón con el avatar y el nombre abre un panel con el nombre completo y el
 * correo (que se ajustan, nunca se cortan), el enlace a la cuenta y «Cerrar sesión», siempre en el mismo lugar.
 * Es un botón que despliega (no un menú de aplicación): Escape lo cierra y devuelve el foco al botón, el foco pasa al
 * primer enlace al abrir, y se cierra al salir de él con Tab, al hacer clic afuera o al cambiar de página.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'

import type { Usuario } from '../../api'
import { Salir } from '../Salir'

export function MenuCuenta({ usuario }: { usuario: Usuario }) {
  const [abierto, setAbierto] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  useEffect(() => setAbierto(false), [pathname])

  // Al abrir, el foco pasa al primer enlace del panel (quien usa teclado no tiene que buscarlo).
  useEffect(() => {
    if (abierto) panel.current?.querySelector<HTMLElement>('a, button')?.focus()
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !boton.current?.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAbierto(false)
      boton.current?.focus()
    }
    // El foco llegó a otra parte de la página (Tab): se cierra sin quitárselo. Con «focusin» y no con «blur» porque
    // Safari no da el foco a los botones al hacer clic y el menú se cerraría antes de que «Cerrar sesión» reciba el clic.
    const enfoque = (e: FocusEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !boton.current?.contains(t)) setAbierto(false)
    }
    document.addEventListener('click', fuera)
    document.addEventListener('keydown', esc)
    document.addEventListener('focusin', enfoque)
    return () => {
      document.removeEventListener('click', fuera)
      document.removeEventListener('keydown', esc)
      document.removeEventListener('focusin', enfoque)
    }
  }, [abierto])

  return (
    <div className="app-cuenta">
      <button
        ref={boton}
        id="cuenta-btn"
        type="button"
        className="app-userbtn"
        aria-expanded={abierto}
        aria-controls="cuenta-menu"
        aria-label={'Tu cuenta: ' + usuario.nombre}
        title={usuario.nombre}
        onClick={() => setAbierto(!abierto)}
      >
        <span className="av" aria-hidden="true">{usuario.iniciales}</span>
        <span className="nm" aria-hidden="true">{usuario.corto}</span>
        <span className="chev" aria-hidden="true">▾</span>
      </button>
      <div ref={panel} className="app-cuenta__menu" id="cuenta-menu" role="group" aria-label="Tu cuenta" hidden={!abierto}>
        <p className="app-cuenta__id">
          <b>{usuario.nombre}</b>
          {usuario.correo && <span>{usuario.correo}</span>}
        </p>
        <Link className="app-cuenta__item" to="/configuracion">
          Tu cuenta y configuración
        </Link>
        <Salir className="app-cuenta__item app-cuenta__salir" />
      </div>
    </div>
  )
}
