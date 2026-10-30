/**
 * Filtros de una página guardados en la dirección (?q=…&cat=…): se pueden
 * compartir y sobreviven a Atrás. Se lleva estado propio, igual que Catalogo:
 * con React Router 7 la URL cambia dentro de una transición, y un campo de
 * texto controlado solo por la URL perdería letras al escribir rápido.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

export function useFiltroUrl<T extends Record<string, string>>(defecto: T): [T, (cambio: Partial<T>) => void] {
  const [sp, setSp] = useSearchParams()
  // El defecto es un objeto literal nuevo en cada render: se fija el del primero.
  const base = useRef(defecto).current
  const leer = useCallback((p: URLSearchParams) => Object.fromEntries(Object.keys(base).map((k) => [k, p.get(k) ?? base[k]])) as T, [base])

  const [valores, setValores] = useState<T>(() => leer(sp))
  const escrito = useRef(sp.toString())

  // La dirección cambió desde afuera (un enlace, Atrás): se vuelve a leer.
  useEffect(() => {
    const actual = sp.toString()
    if (actual === escrito.current) return
    escrito.current = actual
    setValores(leer(sp))
  }, [sp, leer])

  // El estado cambió: se escribe en la dirección, sin los valores por defecto.
  useEffect(() => {
    const p = new URLSearchParams()
    for (const k of Object.keys(base)) {
      const v = valores[k].trim()
      if (v && v !== base[k]) p.set(k, v)
    }
    const s = p.toString()
    if (s === escrito.current) return
    escrito.current = s
    setSp(p, { replace: true, preventScrollReset: true })
  }, [valores, base, setSp])

  const cambiar = useCallback((c: Partial<T>) => setValores((v) => ({ ...v, ...c })), [])
  return [valores, cambiar]
}
