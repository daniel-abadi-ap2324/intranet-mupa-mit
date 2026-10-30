import React from 'react'
import { useNavigate } from 'react-router'

import { api } from '../api'
import { useDatos } from '../datos'

/**
 * Cerrar sesión: el backend borra la cookie y la SPA vuelve a pedir los datos sin sesión.
 * Es la única lógica de salir: la usan Configuración, el menú de la cuenta de la barra superior y la página de gestión.
 * `className` cambia el aspecto (por defecto, el botón fantasma de siempre); `alSalir` corre antes de volver al Inicio.
 */
export function Salir({ className = 'ds-btn ds-btn--ghost', alSalir }: { className?: string; alSalir?: () => void }) {
  const navegar = useNavigate()
  const { recargar } = useDatos()
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await api.salir().catch(() => undefined)
        alSalir?.()
        await recargar()
        navegar('/')
      }}
    >
      Cerrar sesión
    </button>
  )
}
