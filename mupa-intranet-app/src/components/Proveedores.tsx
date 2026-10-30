/**
 * Estado compartido del sitio en el navegador:
 *  - favoritos ★ (en este navegador; por defecto, las aplicaciones destacadas)
 *  - aviso breve con acción opcional ("Deshacer")
 *  - cajón del menú en pantallas angostas
 *  - el último boletín visto (para el contador de boletines nuevos del menú)
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { useDatos } from '../datos'

const LS = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k)
      return v === null ? d : (JSON.parse(v) as T)
    } catch {
      return d
    }
  },
  set(k: string, v: unknown): boolean {
    try {
      localStorage.setItem(k, JSON.stringify(v))
      return true
    } catch {
      return false
    }
  },
  del(k: string) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* modo privado */
    }
  },
}
export { LS }

type Aviso = { msg: string; accion?: { t: string; fn: () => void } }
type Ctx = {
  favs: string[]
  esFav: (id: string) => boolean
  alternarFav: (id: string) => void
  avisar: (msg: string, accion?: Aviso['accion']) => void
  cajon: boolean
  setCajon: (v: boolean) => void
  /** Fecha del último boletín visto ("AAAA-MM-DD" o ''). */
  bolVisto: string
  /** Al abrir Boletines: todos quedan vistos. */
  marcarBoletines: () => void
}
const Contexto = createContext<Ctx | null>(null)

export function useSitio(): Ctx {
  const c = useContext(Contexto)
  if (!c) throw new Error('useSitio fuera de <Proveedores>')
  return c
}

export function Proveedores({ favoritosDefecto, children }: { favoritosDefecto: string[]; children: React.ReactNode }) {
  const [favs, setFavs] = useState<string[]>(favoritosDefecto)
  useEffect(() => {
    const guardados = LS.get<string[] | null>('mupa_favs', null)
    if (Array.isArray(guardados)) setFavs(guardados)
  }, [])

  const [aviso, setAviso] = useState<Aviso | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const avisar = useCallback((msg: string, accion?: Aviso['accion']) => {
    setAviso({ msg, accion })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setAviso(null), accion ? 7000 : 3200)
  }, [])

  const alternarFav = useCallback(
    (id: string) => {
      setFavs((f) => {
        const on = !f.includes(id)
        const n = on ? [...f, id] : f.filter((x) => x !== id)
        LS.set('mupa_favs', n)
        avisar(on ? 'Añadido a tus accesos rápidos' : 'Quitado de tus accesos rápidos')
        return n
      })
    },
    [avisar],
  )

  const [cajon, setCajon] = useState(false)
  useEffect(() => {
    document.body.classList.toggle('nav-open', cajon)
  }, [cajon])

  const { boletines } = useDatos()
  const [bolVisto, setBolVisto] = useState<string>(() => LS.get('mupa_bol_seen', ''))
  const marcarBoletines = useCallback(() => {
    const ultimo = boletines[0]?.fecha || ''
    setBolVisto(ultimo)
    LS.set('mupa_bol_seen', ultimo)
  }, [boletines])

  const valor = useMemo<Ctx>(
    () => ({ favs, esFav: (id) => favs.includes(id), alternarFav, avisar, cajon, setCajon, bolVisto, marcarBoletines }),
    [favs, alternarFav, avisar, cajon, bolVisto, marcarBoletines],
  )

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div className={'home-toast' + (aviso ? ' is-on' : '')} role="status" aria-live="polite">
        {aviso && <span>{aviso.msg}</span>}
        {aviso?.accion && (
          <button
            type="button"
            onClick={() => {
              const fn = aviso.accion!.fn
              setAviso(null)
              fn()
            }}
          >
            {aviso.accion.t}
          </button>
        )}
      </div>
    </Contexto.Provider>
  )
}
