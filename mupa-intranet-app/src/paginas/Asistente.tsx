/**
 * El asistente, a pantalla completa (/asistente), como un chat: sin el menú ni la barra del sitio (App.tsx lo saca
 * del armazón), con su propio «Volver a la intranet». Modo claro, fondo de rayos de luz (WebGL,
 * components/fondos/LightRays), el escudo de la Alcaldía con un brillo que lo recorre, y animaciones suaves: todo
 * entra con un fundido, las respuestas se escriben solas y las tarjetas aparecen después. Con «reducir movimiento»,
 * nada se mueve. Con `?q=` pregunta al entrar (lo usan el buscador y el Inicio).
 */
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { api } from '../api'
import { Respuesta, useConversacion } from '../components/asistente/conversacion'
import { MESA } from '../components/asistente/TarjetaAsistente'
import { useDatos } from '../datos'
import { activa } from '../lib/edicion'
import { EVENTO_ASISTENTE, EVENTO_GUION, type DetalleAsistente } from '../lib/recorridoControl'

// El fondo trae WebGL (ogl): se carga aparte, solo en esta página.
const LightRays = lazy(() => import('../components/fondos/LightRays'))

/** Preguntas de ejemplo que muestran lo que sabe hacer: páginas, apps y contenido concreto. */
const SUGERENCIAS = ['¿Cuál es el último boletín?', 'No me funciona el correo', '¿Dónde veo mis comprobantes de pago?', 'Necesito una cita en la Clínica', 'Quiero acceso a la red WIFI']

/** El escudo oficial (sin recortar ni recrear: el archivo de Identidad visual) dentro de un medallón con brillo. */
function Escudo({ chico = false }: { chico?: boolean }) {
  return (
    <span className={'asis-escudo' + (chico ? ' asis-escudo--chico' : '')} aria-hidden="true">
      <span className="asis-escudo__aura" />
      <span className="asis-escudo__anillo" />
      <span className="asis-escudo__disco">
        <img src="/marca/logos/svg/logo-azul-sobre-blanco-vertical.svg" alt="" width={70} height={88} />
        <span className="asis-escudo__brillo" />
      </span>
    </span>
  )
}

function Enviar() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PaginaAsistente() {
  const { apps, usuario } = useDatos()
  const conv = useConversacion()
  const navegar = useNavigate()
  const [pregunta, setPregunta] = useState('')
  const [disponible, setDisponible] = useState<boolean | null>(null)
  const [params, setParams] = useSearchParams()
  const entrada = useRef<HTMLTextAreaElement>(null)
  const hilo = useRef<HTMLDivElement>(null)
  const inicial = useRef(params.get('q'))
  // El recorrido (lib/recorrido.ts) pide escribir una pregunta de ejemplo aquí, como lo haría una persona.
  const [guion, setGuion] = useState<string | null>(null)
  const pensabaAntes = useRef(false)

  useEffect(() => {
    document.title = 'Asistente — Intranet MUPA'
    let vivo = true
    api
      .estadoAsistente()
      .then((d) => vivo && setDisponible(d))
      .catch(() => vivo && setDisponible(false))
    return () => {
      vivo = false
    }
  }, [])

  // ?q= : la pregunta que trae el buscador o el Inicio se hace sola, una vez, y se saca de la dirección.
  useEffect(() => {
    if (!disponible || !inicial.current) return
    const q = inicial.current
    inicial.current = null
    setParams({}, { replace: true })
    void conv.preguntar(q)
  }, [disponible, conv, setParams])

  useEffect(() => {
    const oir = (e: Event) => setGuion((e as CustomEvent<string>).detail)
    window.addEventListener(EVENTO_GUION, oir)
    return () => window.removeEventListener(EVENTO_GUION, oir)
  }, [])

  // Se escribe la pregunta del recorrido letra por letra (con «reducir movimiento», de una) y se envía.
  useEffect(() => {
    if (guion === null || disponible === null) return
    const emitir = (d: DetalleAsistente) => window.dispatchEvent(new CustomEvent(EVENTO_ASISTENTE, { detail: d }))
    if (!disponible) {
      setGuion(null)
      emitir({ fase: 'error', mensaje: 'El asistente no está disponible en este momento.' })
      return
    }
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let n = quieto ? guion.length : 0
    let t: number
    const paso = () => {
      setPregunta(guion.slice(0, n))
      if (n < guion.length) {
        n++
        t = window.setTimeout(paso, 38)
      } else {
        t = window.setTimeout(() => {
          setGuion(null)
          void enviar(guion)
        }, 700)
      }
    }
    paso()
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guion, disponible])

  // El recorrido se entera de cuándo se envía una pregunta y cuándo llega su respuesta (o su error).
  useEffect(() => {
    if (conv.pensando && !pensabaAntes.current) window.dispatchEvent(new CustomEvent<DetalleAsistente>(EVENTO_ASISTENTE, { detail: { fase: 'enviando' } }))
    if (!conv.pensando && pensabaAntes.current) {
      const u = conv.turnos[conv.turnos.length - 1]
      window.dispatchEvent(new CustomEvent<DetalleAsistente>(EVENTO_ASISTENTE, { detail: u?.error ? { fase: 'error', mensaje: u.error } : { fase: 'listo' } }))
    }
    pensabaAntes.current = conv.pensando
  }, [conv.pensando, conv.turnos])

  // La caja crece con el texto que se le pone por programa (el ejemplo del recorrido).
  useEffect(() => {
    const el = entrada.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }, [pregunta])

  // La conversación baja sola mientras llega (y mientras se escribe la respuesta).
  useEffect(() => {
    const el = hilo.current
    if (!el) return
    const bajar = () => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    bajar()
    const mo = new MutationObserver(bajar)
    mo.observe(el, { childList: true, subtree: true, characterData: true })
    return () => mo.disconnect()
  }, [conv.turnos.length])

  useEffect(() => {
    if (disponible) entrada.current?.focus()
  }, [disponible])

  async function enviar(texto: string) {
    setPregunta('')
    if (!(await conv.preguntar(texto))) setPregunta(texto)
    entrada.current?.focus()
  }

  const vacia = conv.turnos.length === 0
  const nombre = usuario?.nombre?.split(' ')[0]

  return (
    <div className={'asis' + (vacia ? ' is-vacia' : '')}>
      <div className="asis__fondo" aria-hidden="true">
        <Suspense fallback={null}>
          <LightRays className="asis__rayos" color="#2f7bff" glow={0.7} spread={0.85} length={0.4} speed={0.7} mouseInfluence={0.06} />
        </Suspense>
      </div>

      <header className="asis__barra">
        <button type="button" className="asis__volver" onClick={() => (window.history.length > 1 ? navegar(-1) : navegar('/'))}>
          <span aria-hidden="true">←</span> Volver a la intranet
        </button>
        {!vacia && (
          <div className="asis__marca">
            <Escudo chico />
            <span>Asistente</span>
          </div>
        )}
        {!vacia ? (
          <button type="button" className="asis__nueva" disabled={conv.pensando} onClick={conv.reiniciar}>
            Nueva conversación
          </button>
        ) : (
          <span />
        )}
      </header>

      <main className="asis__principal" id="contenido">
        {vacia ? (
          <section className="asis__hola" aria-labelledby="asis-titulo">
            <Escudo />
            <p className="asis__kicker">Asistente de la intranet</p>
            <h1 id="asis-titulo">{nombre ? `Hola, ${nombre}. ¿En qué te ayudo?` : '¿En qué te ayudo hoy?'}</h1>
            <p className="asis__intro">Pregunta con tus palabras: te llevo a la página, la aplicación, el boletín{activa('formularios') ? ', la noticia o el formulario' : ' o el documento'} que necesitas.</p>
            {disponible === false && (
              <p className="asis__aviso" role="status">
                El asistente necesita un servidor de modelo de lenguaje (<code>LLM_URL</code>), que no está incluido en esta copia. <Link to="/">Vuelve a la intranet</Link> y usa el buscador.
              </p>
            )}
          </section>
        ) : (
          <div className="asis__hilo" ref={hilo} role="log" aria-live="polite" aria-busy={conv.pensando}>
            <h1 className="sr-only">Asistente</h1>
            {conv.turnos.map((t) => (
              <Respuesta key={t.id} turno={t} apps={apps} escribir />
            ))}
          </div>
        )}
      </main>

      <footer className="asis__pie">
        {vacia && disponible !== false && (
          <ul className="asis__sug" aria-label="Preguntas de ejemplo">
            {SUGERENCIAS.map((s, i) => (
              <li key={s} style={{ '--i': i } as React.CSSProperties}>
                <button type="button" className="asis__chip" disabled={!disponible || conv.pensando} onClick={() => void enviar(s)}>
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="asis__caja"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar(pregunta)
          }}
        >
          <label className="sr-only" htmlFor="asis-pregunta">
            Tu pregunta para el asistente
          </label>
          <textarea
            id="asis-pregunta"
            ref={entrada}
            rows={1}
            maxLength={300}
            placeholder={vacia ? 'Escribe tu pregunta…' : 'Sigue preguntando…'}
            value={pregunta}
            disabled={disponible === false}
            onChange={(e) => {
              setPregunta(e.target.value)
              // Crece con el texto, hasta 5 líneas.
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
            }}
            onKeyDown={(e) => {
              // Enter envía; Mayús+Enter hace un salto de línea.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void enviar(pregunta)
              }
            }}
          />
          <button className="asis__enviar" type="submit" aria-label="Preguntar" title="Preguntar" disabled={!disponible || conv.pensando || pregunta.trim().length < 2}>
            <Enviar />
          </button>
        </form>
        <p className="asis__nota">
          Respuestas generadas con IA en un servidor de la Alcaldía: verifica antes de actuar. No escribas cédulas ni contraseñas. ¿No se resolvió? <Link to="/mesa-servicios">{MESA}</Link>.
        </p>
      </footer>
    </div>
  )
}
