/**
 * Piezas comunes de RRHH Express: carga de datos que avisa si la conexión venció,
 * y la lista «dato: valor» del expediente y los comprobantes.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { ErrorApi } from '../../api'
import { Aviso } from '../ui'

/** Si la API dice que la cuenta de RRHH Express ya no está conectada. */
export const esDesconexion = (e: unknown) => e instanceof ErrorApi && e.codigo === 'RRHH_DESCONECTADO'

/** Mensaje para la persona ante un error de RRHH (los de RH Link ya vienen en español). */
export function mensajeRrhh(e: unknown): string {
  if (!(e instanceof ErrorApi) || e.estado >= 500 || e.codigo.startsWith('HTTP_')) return 'El sistema de RRHH no respondió. Intenta de nuevo en unos minutos.'
  return e.message
}

/**
 * Carga algo de RRHH Express. Si la conexión venció, llama a `alDesconectar` (la página
 * vuelve a la tarjeta de conectar); otro error queda en `error`.
 */
export function useRrhh<T>(cargar: () => Promise<T>, alDesconectar: () => void, deps: React.DependencyList) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fn = useCallback(cargar, deps)
  // Solo vale la última pedida: si el usuario cambia de mes rápido, una respuesta vieja no pisa la nueva.
  const ultima = useRef(0)

  const recargar = useCallback(async () => {
    const esta = ++ultima.current
    setCargando(true)
    setError(null)
    try {
      const r = await fn()
      if (esta === ultima.current) setDatos(r)
    } catch (e) {
      if (esta !== ultima.current) return
      if (esDesconexion(e)) alDesconectar()
      else setError(mensajeRrhh(e))
    } finally {
      if (esta === ultima.current) setCargando(false)
    }
  }, [fn, alDesconectar])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { datos, error, cargando, recargar }
}

export const Cargando = ({ t = 'Cargando…' }: { t?: string }) => (
  <p className="count-note" role="status">
    {t}
  </p>
)

export const ErrorCarga = ({ t, reintentar }: { t: string; reintentar: () => void }) => (
  <div className="rh-error">
    <Aviso tipo="warn">{t}</Aviso>
    <button type="button" className="ds-btn ds-btn--ghost" onClick={reintentar}>
      Intentar de nuevo
    </button>
  </div>
)

/** Lista de datos «etiqueta: valor». Los vacíos no se muestran. */
export function Datos({ filas }: { filas: [string, React.ReactNode | null | undefined][] }) {
  const visibles = filas.filter(([, v]) => v !== null && v !== undefined && v !== '')
  if (!visibles.length) return null
  return (
    <dl className="rh-dl">
      {visibles.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}
