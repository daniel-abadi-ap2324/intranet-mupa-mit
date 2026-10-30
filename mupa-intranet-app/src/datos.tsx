/**
 * Datos que comparte todo el sitio: la sesión, el catálogo y el contenido del
 * Inicio. Se piden una vez al abrir la SPA y otra vez al entrar o salir.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import { alPerderSesion, api, type ContenidoInicio, type Usuario } from './api'
import type { App } from './lib/catalogo'
import { activa } from './lib/edicion'
import type { Boletin, Noticia } from './lib/contenido'
import type { Formulario } from './lib/formularios'

type Datos = {
  usuario: Usuario | null
  apps: App[]
  favoritos: string[]
  contenido: ContenidoInicio
  /** Publicados, del más nuevo al más viejo (el contador del menú, Boletines, Documentos, el Inicio). */
  boletines: Boletin[]
  /** Los publicados (Formularios, el buscador, Documentos, el Inicio). */
  formularios: Formulario[]
  /** Publicadas (el buscador). */
  noticias: Noticia[]
  /** true si el backend no respondió: el sitio se muestra con lo que haya. */
  sinConexion: boolean
  /** true si la sesión venció mientras se usaba el sitio: se avisa y se ofrece volver a entrar. */
  sesionVencida: boolean
}
type Ctx = Datos & { recargar: () => Promise<void> }

const Contexto = createContext<Ctx | null>(null)

export function useDatos(): Ctx {
  const c = useContext(Contexto)
  if (!c) throw new Error('useDatos fuera de <ProveedorDatos>')
  return c
}

// Lo que esta edición apaga no se pide (su ruta no existe en la API): queda vacío.
const vacio = <T,>(): Promise<T[]> => Promise.resolve([])

async function cargar(): Promise<Datos> {
  const [usuario, catalogo, contenido, boletines, formularios, noticias] = await Promise.allSettled([
    api.sesion(),
    api.catalogo(),
    api.contenidoInicio(),
    activa('boletines') ? api.boletines() : vacio<Boletin>(),
    activa('formularios') ? api.formularios() : vacio<Formulario>(),
    activa('noticias') ? api.noticias() : vacio<Noticia>(),
  ])
  return {
    usuario: usuario.status === 'fulfilled' ? usuario.value : null,
    apps: catalogo.status === 'fulfilled' ? catalogo.value.apps : [],
    favoritos: catalogo.status === 'fulfilled' ? catalogo.value.favoritos : [],
    contenido: contenido.status === 'fulfilled' ? contenido.value : {},
    boletines: boletines.status === 'fulfilled' ? boletines.value : [],
    formularios: formularios.status === 'fulfilled' ? formularios.value : [],
    noticias: noticias.status === 'fulfilled' ? noticias.value : [],
    sinConexion: [usuario, catalogo, contenido, boletines, formularios, noticias].some((r) => r.status === 'rejected'),
    sesionVencida: false,
  }
}

export function ProveedorDatos({ children }: { children: React.ReactNode }) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const recargar = useCallback(async () => setDatos(await cargar()), [])
  useEffect(() => {
    recargar()
  }, [recargar])

  // Si la sesión vence a medio uso, se vuelve a pedir todo sin sesión (el catálogo cambia) y se avisa.
  const conSesion = useRef(false)
  conSesion.current = !!datos?.usuario
  useEffect(() => {
    alPerderSesion(() => {
      if (!conSesion.current) return
      conSesion.current = false
      cargar().then((d) => setDatos({ ...d, sesionVencida: !d.usuario }))
    })
    return () => alPerderSesion(null)
  }, [])

  if (!datos) {
    return (
      <div className="app-cargando" role="status" aria-live="polite">
        Cargando la intranet…
      </div>
    )
  }
  return <Contexto.Provider value={{ ...datos, recargar }}>{children}</Contexto.Provider>
}
