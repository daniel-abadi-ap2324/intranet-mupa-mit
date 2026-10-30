/**
 * Recorrido guiado para usuarios nuevos: resalta, de a una, las partes reales de la pantalla
 * (la búsqueda, el asistente, el menú…) con una tarjeta al lado. Hecho a mano (sin librerías):
 * cumple la CSP y sigue el patrón de diálogo del W3C APG.
 *  - El foco entra a la tarjeta, Tab no sale de ella y Esc lo cierra (cuenta como visto).
 *  - Al cerrar, el foco vuelve a donde estaba.
 *  - "Paso N de M" se anuncia a los lectores de pantalla.
 *  - Sin animaciones con "reducir movimiento" (lo resuelve el CSS).
 *  - El tramo del asistente navega de verdad a /asistente (página fuera del armazón): por eso el recorrido se
 *    monta en App (`RecorridoRaiz`) y no en el Inicio. Ahí la tarjeta deja usar la página: la persona puede
 *    usar el ejemplo o escribir su pregunta, y el recorrido sigue cuando llega la respuesta.
 * Los pasos (y cuándo aparece solo) están en lib/recorrido.ts.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'

import { api } from '../../api'
import { useDatos } from '../../datos'
import { hoyIso } from '../../lib/fechas'
import { gestionDe } from '../../lib/menu'
import { LS_RECORRIDO, PREGUNTA_EJEMPLO, pasosRecorrido, RUTA_ASISTENTE, type Paso } from '../../lib/recorrido'
import { cerrarRecorrido, EVENTO_ASISTENTE, EVENTO_GUION, useRecorridoAbierto, type DetalleAsistente } from '../../lib/recorridoControl'
import { LS } from '../Proveedores'

/** Una parte de la pantalla se puede resaltar si está a la vista (no oculta ni fuera del menú plegado). */
function aLaVista(sel: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(sel)
  if (!el || !el.getClientRects().length) return null
  const s = getComputedStyle(el)
  return s.visibility === 'hidden' || s.display === 'none' ? null : el
}

const MARGEN = 12
const rutaDe = (p: Paso | undefined) => p?.ruta ?? '/'

/** Monta el recorrido cuando el Inicio lo pide; sabe si el asistente está disponible antes de armar los pasos. */
export function RecorridoRaiz() {
  const abierto = useRecorridoAbierto()
  const { usuario } = useDatos()
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const [asistente, setAsistente] = useState<boolean | null>(null)

  useEffect(() => {
    if (!abierto) return setAsistente(null)
    let vivo = true
    api.estadoAsistente().then((d) => vivo && setAsistente(d))
    return () => {
      vivo = false
    }
  }, [abierto])

  const pasos = useMemo(
    () =>
      asistente === null
        ? []
        : pasosRecorrido({
            conSesion: !!usuario,
            gestion: gestionDe(usuario).length > 0,
            movil: window.matchMedia('(max-width: 767px)').matches,
            asistente,
          }),
    // Se arman una vez al abrir (el ancho de la pantalla puede haber cambiado).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [asistente],
  )

  function terminar() {
    cerrarRecorrido()
    LS.set(LS_RECORRIDO, hoyIso())
    if (usuario && !usuario.recorridoVisto) api.marcarRecorrido().catch(() => undefined)
    // Si se cerró en la página del asistente, se vuelve a la intranet (a ella la llevó el recorrido).
    if (pathname === RUTA_ASISTENTE) navegar('/')
  }

  if (!abierto || asistente === null) return null
  return <Recorrido pasos={pasos} onTerminar={terminar} />
}

export function Recorrido({ pasos, onTerminar }: { pasos: Paso[]; onTerminar: () => void }) {
  const navegar = useNavigate()
  const { pathname } = useLocation()
  // Se decide al abrir (estamos en el Inicio) qué pasos del Inicio tienen su parte a la vista.
  const lista = useMemo(() => pasos.filter((p) => rutaDe(p) !== '/' || !p.objetivo || aLaVista(p.objetivo)), [pasos])
  const [i, setI] = useState(0)
  const [foco, setFoco] = useState<DOMRect | null>(null)
  const [encontrado, setEncontrado] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [asis, setAsis] = useState<DetalleAsistente | null>(null)
  const [escribiendo, setEscribiendo] = useState(false)
  const tarjeta = useRef<HTMLDivElement>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const volverA = useRef<HTMLElement | null>(null)
  const yendoA = useRef<string | null>(null)

  const paso = lista[i]
  const conBienvenida = lista[0]?.id === 'bienvenida'
  const total = lista.length - (conBienvenida ? 1 : 0)
  const numero = i + (conBienvenida ? 0 : 1)
  const ultimo = i === lista.length - 1
  const abajo = paso?.tipo === 'asistente-respuesta'
  const libre = paso?.tipo === 'asistente-escribir' || abajo

  // Al abrir se recuerda dónde estaba el foco; al cerrar, vuelve ahí.
  useEffect(() => {
    volverA.current = document.activeElement as HTMLElement | null
    return () => {
      const v = volverA.current
      if (v && document.body.contains(v)) v.focus()
    }
  }, [])

  // Cada paso lleva a su página (el del asistente, a /asistente) antes de buscar su parte de la pantalla.
  useEffect(() => {
    const r = rutaDe(paso)
    if (paso && r !== pathname) {
      yendoA.current = r
      navegar(r)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso])

  // Si la persona se va por su cuenta de la página del paso (Volver, el botón del navegador), el recorrido sigue
  // en el Inicio; si fue a cualquier otra parte, termina.
  useEffect(() => {
    if (yendoA.current !== null) {
      if (pathname === yendoA.current) yendoA.current = null
      return
    }
    if (!paso || pathname === rutaDe(paso)) return
    if (pathname === '/') {
      const sig = lista.findIndex((p, k) => k > i && rutaDe(p) === '/')
      if (sig >= 0) return setI(sig)
    }
    onTerminar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Resaltar la parte de este paso: se espera a que aparezca (la página puede estar cargando), se trae a la
  // vista y se mide (también al desplazar o cambiar el tamaño). Si no aparece, la tarjeta va al centro.
  useLayoutEffect(() => {
    setEncontrado(false)
    if (!paso || rutaDe(paso) !== pathname) return
    if (!paso.objetivo) {
      setFoco(null)
      setEncontrado(true)
      return
    }
    let t: number | undefined
    let remide: number | undefined
    let medir: () => void = () => undefined
    const poner = (e: HTMLElement) => {
      e.scrollIntoView({ block: 'center', inline: 'nearest' })
      medir = () => setFoco(e.getBoundingClientRect())
      medir()
      setEncontrado(true)
      window.addEventListener('resize', medir)
      window.addEventListener('scroll', medir, true)
      // La página puede estar entrando con una animación (el asistente): se vuelve a medir un momento.
      remide = window.setInterval(medir, 120)
      window.setTimeout(() => window.clearInterval(remide), 1500)
    }
    const ya = aLaVista(paso.objetivo)
    if (ya) poner(ya)
    else {
      setFoco(null)
      const desde = Date.now()
      t = window.setInterval(() => {
        const el = aLaVista(paso.objetivo!)
        if (el) {
          window.clearInterval(t)
          poner(el)
        } else if (Date.now() - desde > 2500) {
          window.clearInterval(t)
          setEncontrado(true)
        }
      }, 100)
    }
    return () => {
      if (t) window.clearInterval(t)
      if (remide) window.clearInterval(remide)
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [paso, pathname])

  // La tarjeta va debajo de la parte resaltada si cabe; si no, arriba. Nunca se sale de la pantalla.
  useLayoutEffect(() => {
    const t = tarjeta.current
    if (!t || !foco || abajo) return setPos(null)
    const alto = t.offsetHeight
    const ancho = t.offsetWidth
    const cabeAbajo = foco.bottom + MARGEN + alto <= window.innerHeight - MARGEN
    const top = cabeAbajo ? foco.bottom + MARGEN : Math.max(MARGEN, foco.top - MARGEN - alto)
    const left = Math.min(Math.max(MARGEN, foco.left), window.innerWidth - ancho - MARGEN)
    setPos({ top, left })
  }, [foco, i, asis, escribiendo, abajo])

  // El foco va al título de cada paso: el lector de pantalla lo lee.
  useEffect(() => {
    if (encontrado) titulo.current?.focus({ preventScroll: true })
  }, [i, encontrado])

  // Lo que pasa en la página del asistente: al enviarse la pregunta, el recorrido pasa a mostrar la respuesta.
  useEffect(() => {
    const oir = (e: Event) => setAsis((e as CustomEvent<DetalleAsistente>).detail)
    window.addEventListener(EVENTO_ASISTENTE, oir)
    return () => window.removeEventListener(EVENTO_ASISTENTE, oir)
  }, [])
  useEffect(() => {
    if (paso?.tipo === 'asistente-escribir' && asis?.fase === 'enviando') {
      setEscribiendo(false)
      setI((k) => k + 1)
    }
  }, [asis, paso])

  // Esc cierra desde cualquier parte (también con el foco en la caja del asistente).
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      onTerminar()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  })

  if (!paso) return null

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && !libre) {
      // Tab no sale de la tarjeta.
      const f = [...(tarjeta.current?.querySelectorAll<HTMLElement>('button') ?? [])]
      if (!f.length) return
      const primero = f[0]
      const final = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === primero || document.activeElement === titulo.current)) {
        e.preventDefault()
        final.focus()
      } else if (!e.shiftKey && document.activeElement === final) {
        e.preventDefault()
        primero.focus()
      }
    }
  }

  const atras = () => {
    let j = i - 1
    // Desde el Inicio no se vuelve a la página del asistente (la conversación ya no está): al paso anterior del Inicio.
    if (rutaDe(paso) === '/' && rutaDe(lista[j]) !== '/') while (j > 0 && rutaDe(lista[j]) !== '/') j--
    setI(Math.max(0, j))
  }
  const usarEjemplo = () => {
    setEscribiendo(true)
    window.dispatchEvent(new CustomEvent(EVENTO_GUION, { detail: PREGUNTA_EJEMPLO }))
  }

  // Texto de cada estado del tramo del asistente.
  let texto = paso.texto
  if (paso.tipo === 'asistente-escribir' && escribiendo) texto = 'Escribiendo la pregunta de ejemplo…'
  if (abajo) {
    if (!asis || asis.fase === 'enviando') texto = 'El asistente está buscando la respuesta…'
    else if (asis.fase === 'error') texto = (asis.mensaje ?? 'El asistente no pudo responder ahora.') + ' Puedes seguir con el recorrido y probarlo después desde «Asistente» en el menú.'
  }

  const P = 6
  const estilo: React.CSSProperties | undefined = !encontrado
    ? { visibility: 'hidden' }
    : foco && !abajo
      ? pos
        ? { top: pos.top, left: pos.left }
        : { visibility: 'hidden' }
      : undefined
  return createPortal(
    <div className={'tour' + (libre ? ' tour--libre' : '')}>
      {foco && !abajo ? (
        <div className="tour__foco" style={{ top: foco.top - P, left: foco.left - P, width: foco.width + P * 2, height: foco.height + P * 2 }} aria-hidden="true" />
      ) : abajo ? null : (
        <div className="tour__fondo" aria-hidden="true" />
      )}
      <div
        ref={tarjeta}
        className={'tour__card' + (abajo ? ' tour__card--abajo' : foco ? '' : ' tour__card--centro')}
        style={estilo}
        role="dialog"
        aria-modal={libre ? 'false' : 'true'}
        aria-labelledby="tour-t"
        aria-describedby="tour-d"
        onKeyDown={teclas}
      >
        {paso.id !== 'bienvenida' && (
          <p className="tour__paso">
            Paso {numero} de {total}
          </p>
        )}
        <h2 id="tour-t" ref={titulo} tabIndex={-1}>
          {paso.titulo}
        </h2>
        <p id="tour-d" className="tour__texto" aria-live={abajo ? 'polite' : undefined}>
          {texto}
        </p>
        <div className="tour__acciones">
          {paso.id === 'bienvenida' ? (
            <>
              <button type="button" className="ds-btn ds-btn--ghost" onClick={onTerminar}>
                Ahora no
              </button>
              <button type="button" className="ds-btn ds-btn--primary" onClick={() => setI(1)}>
                Empezar
              </button>
            </>
          ) : (
            <>
              {!ultimo && (
                <button type="button" className="tour__omitir" onClick={onTerminar}>
                  Omitir recorrido
                </button>
              )}
              {numero > 1 && (
                <button type="button" className="ds-btn ds-btn--ghost" onClick={atras}>
                  Atrás
                </button>
              )}
              {paso.tipo === 'asistente-escribir' ? (
                <button type="button" className="ds-btn ds-btn--primary" onClick={usarEjemplo} disabled={escribiendo}>
                  Usar el ejemplo
                </button>
              ) : (
                <button type="button" className="ds-btn ds-btn--primary" onClick={() => (ultimo ? onTerminar() : setI(i + 1))}>
                  {ultimo ? 'Terminar' : paso.tipo === 'probar' ? 'Probar el asistente' : abajo ? 'Volver a la intranet' : 'Siguiente'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {paso.id === 'bienvenida' ? '' : `Paso ${numero} de ${total}: ${paso.titulo}`}
      </p>
    </div>,
    document.body,
  )
}
