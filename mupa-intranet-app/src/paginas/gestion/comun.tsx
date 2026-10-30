/**
 * Piezas comunes de las pantallas de gestión (/gestion/…): quién puede entrar y
 * cómo se muestran los errores. La pantalla solo decide qué mostrar; quien de
 * verdad permite o niega es el backend.
 */
import React, { useRef, useState } from 'react'
import { useLocation } from 'react-router'

import { api, ErrorApi } from '../../api'
import { PanelesGestion } from '../../components/gestion/Paneles'
import { Aviso, CabeceraPagina, EnlaceEntrar } from '../../components/ui'
import { useDatos } from '../../datos'
import { idActual, MENU_GESTION } from '../../lib/menu'
import { tieneRol, type Rol } from '../../lib/roles'

export const mensaje = (e: unknown) => (e instanceof ErrorApi ? e.message : 'No se pudo conectar con el servidor. Inténtalo de nuevo.')

/**
 * Cabecera de la página y, según la sesión y el rol, el contenido o el aviso de que falta permiso.
 * Las pantallas de gestión cuelgan del Centro de Gestión: la miga vuelve a él y arriba va la
 * barra con las demás pantallas de su grupo (el menú lateral solo lleva el Centro).
 */
export function PaginaGestion(p: { titulo: string; miga: string; intro: string; roles: Rol[]; quien: string; children: React.ReactNode }) {
  const { usuario } = useDatos()
  const id = idActual(useLocation().pathname)
  const item = id !== 'gestion-centro' ? MENU_GESTION.find((it) => it.id === id) : undefined
  const puede = !!usuario && tieneRol(usuario, ...p.roles)
  return (
    <>
      <CabeceraPagina titulo={p.titulo} miga={p.miga} intro={p.intro} padres={item ? [{ t: 'Centro de Gestión', h: '/gestion' }] : []} />
      {item && puede && <PanelesGestion grupos={[item.grupo]} actual={item.id} volver />}
      {!usuario ? (
        <Aviso>
          Inicia sesión para usar esta sección. <EnlaceEntrar />
        </Aviso>
      ) : !tieneRol(usuario, ...p.roles) ? (
        <Aviso tipo="warn">No tienes permiso para usar esta sección. Es para {p.quien}.</Aviso>
      ) : (
        p.children
      )}
    </>
  )
}

const MAX_ARCHIVO = 10 * 1024 * 1024

/**
 * Botón para subir un PDF o una imagen. Al terminar entrega la dirección
 * (/api/files/…) para ponerla en el campo que corresponda.
 */
export function SubirArchivo({ acepta, etiqueta, onSubido }: { acepta: string; etiqueta: string; onSubido: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [nota, setNota] = useState<{ t: string; error: boolean } | null>(null)

  const subir = async (archivo: File) => {
    if (archivo.size > MAX_ARCHIVO) {
      setNota({ t: 'El archivo pesa más de 10 MB.', error: true })
      return
    }
    setSubiendo(true)
    setNota(null)
    try {
      const r = await api.subirArchivo(archivo)
      onSubido(r.url)
      setNota({ t: 'Subido: ' + r.originalName, error: false })
    } catch (e) {
      setNota({ t: mensaje(e), error: true })
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <span className="gest-subir">
      <input
        ref={input}
        type="file"
        accept={acepta}
        hidden
        aria-label={etiqueta}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) subir(f)
        }}
      />
      <button type="button" className="ds-btn ds-btn--subtle" disabled={subiendo} onClick={() => input.current?.click()}>
        {subiendo ? 'Subiendo…' : etiqueta}
      </button>
      {nota && (
        <span className={nota.error ? 'f-err' : 'f-hint'} role={nota.error ? 'alert' : 'status'}>
          {nota.t}
        </span>
      )}
    </span>
  )
}

/** Fecha y hora cortas en hora de Panamá: "28 sep 2026, 10:32". */
export function fechaHora(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}
