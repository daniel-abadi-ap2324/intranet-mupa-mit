/**
 * Conversación con el asistente de búsqueda: el estado de las preguntas y
 * respuestas, y cómo se pinta cada respuesta. La usan el panel de la barra
 * superior y la tarjeta del Inicio. El backend (/api/assistant/ask) responde con
 * un texto corto, páginas de la intranet y las aplicaciones del catálogo que sirven;
 * nunca hace nada por la persona.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { api, ErrorApi, type ItemAsistente } from '../../api'
import type { App } from '../../lib/catalogo'
import { rutaVisible } from '../../lib/edicion'
import { AppTile } from '../AppTile'
import { Enlace } from '../ui'

export type PaginaAsistente = { path: string; title: string }
export type Turno = { id: number; pregunta: string; respuesta?: string; slugs?: string[]; paginas?: PaginaAsistente[]; items?: ItemAsistente[]; error?: string }

/** Preguntas de ejemplo: concretas y que el asistente sabe responder. */
export const EJEMPLOS = ['No me funciona el correo', '¿Dónde pido una carta de trabajo?', 'Necesito una cita en la clínica']

export function mensajeDeError(err: unknown): string {
  if (!(err instanceof ErrorApi)) return 'No se pudo conectar con la intranet. Revisa tu conexión.'
  // 429: el backend ya explica cuánto esperar.
  if (err.estado === 429) return err.message
  if (err.estado === 503) return 'El asistente no está disponible en este momento. Mientras tanto, usa el buscador.'
  return 'El asistente tuvo un problema al responder. Intenta de nuevo.'
}

/** Estado de una conversación. `preguntar` devuelve false si no se envió (texto corto o ya pensando). */
export function useConversacion() {
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [pensando, setPensando] = useState(false)
  const siguiente = useRef(0)
  const ocupado = useRef(false)

  const preguntar = useCallback(async (texto: string): Promise<boolean> => {
    const q = texto.trim()
    if (q.length < 2 || ocupado.current) return false
    ocupado.current = true
    const id = ++siguiente.current
    setTurnos((ts) => [...ts, { id, pregunta: q }])
    setPensando(true)
    try {
      const r = await api.preguntarAsistente(q)
      setTurnos((ts) => ts.map((t) => (t.id === id ? { ...t, respuesta: r.answer, slugs: r.applications, paginas: r.pages, items: r.items ?? [] } : t)))
    } catch (err) {
      setTurnos((ts) => ts.map((t) => (t.id === id ? { ...t, error: mensajeDeError(err) } : t)))
    } finally {
      ocupado.current = false
      setPensando(false)
    }
    return true
  }, [])

  const reiniciar = useCallback(() => setTurnos([]), [])
  return { turnos, pensando, preguntar, reiniciar }
}

const TIPO_ITEM: Record<ItemAsistente['kind'], string> = { boletin: 'Boletín', noticia: 'Noticia', formulario: 'Formulario' }

/**
 * El texto aparece de a poco, como si se escribiera (unos 2 s como máximo). Con «reducir movimiento», de una.
 * Devuelve el texto visible y si ya terminó.
 */
function useEscribir(texto: string | undefined, activo: boolean): [string, boolean] {
  const quieto = typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const [n, setN] = useState(activo && !quieto ? 0 : Infinity)
  useEffect(() => {
    if (!texto || !activo || quieto) return
    const paso = Math.max(1, Math.ceil(texto.length / 120))
    const id = window.setInterval(() => setN((x) => (x >= texto.length ? (window.clearInterval(id), x) : x + paso)), 16)
    return () => window.clearInterval(id)
  }, [texto, activo, quieto])
  if (!texto) return ['', false]
  return [texto.slice(0, n), n >= texto.length]
}

export function Respuesta({ turno: t, apps, escribir = false }: { turno: Turno; apps: App[]; /** Animar la respuesta (la página del asistente). */ escribir?: boolean }) {
  const [visible, listo] = useEscribir(t.respuesta, escribir)
  // Los slugs se resuelven contra el catálogo ya cargado: se muestran con la misma tarjeta que en Aplicaciones.
  const encontradas = (t.slugs ?? []).map((s) => apps.find((a) => a.id === s)).filter((a): a is App => !!a)
  // Páginas de la intranet (o PDF del sitio): solo las de esta edición, igual que el menú.
  const paginas = (t.paginas ?? []).filter((p) => rutaVisible(p.path))
  // Contenido concreto: la ruta la arma la API; una noticia sin texto propio puede llevar a su enlace original.
  const items = (t.items ?? []).filter((i) => !i.path.startsWith('/') || rutaVisible(i.path))
  return (
    <div className="app-asistente__turno">
      <p className="app-asistente__q">{t.pregunta}</p>
      {t.error ? (
        <div className="app-asistente__a is-error"><p>{t.error}</p></div>
      ) : t.respuesta === undefined ? (
        <div className="app-asistente__a is-pending">
          {escribir ? (
            <p className="asis-pensando" aria-label="Buscando…"><span /><span /><span /></p>
          ) : (
            <p>Buscando…</p>
          )}
        </div>
      ) : (
        <div className="app-asistente__a">
          <p>
            {escribir ? visible : t.respuesta}
            {escribir && !listo && <span className="asis-cursor" aria-hidden="true" />}
          </p>
          {(!escribir || listo) && items.length > 0 && (
            <ul className="app-asistente__items" aria-label="Contenido de la intranet">
              {items.map((i) => (
                <li key={i.path}>
                  <Enlace h={i.path} className={'asis-item asis-item--' + i.kind}>
                    <span className="asis-item__k">{TIPO_ITEM[i.kind]}</span>
                    <b>{i.title}</b>
                    {i.meta && <span className="asis-item__m">{i.meta}</span>}
                  </Enlace>
                </li>
              ))}
            </ul>
          )}
          {(!escribir || listo) && paginas.length > 0 && (
            <ul className="app-asistente__paginas" aria-label="Páginas de la intranet">
              {paginas.map((p) => (
                <li key={p.path}>
                  <Enlace h={p.path}>{p.title}</Enlace>
                </li>
              ))}
            </ul>
          )}
          {(!escribir || listo) && encontradas.length > 0 && <div className="app-asistente__apps">{encontradas.map((a) => <AppTile key={a.id} app={a} />)}</div>}
        </div>
      )}
    </div>
  )
}
