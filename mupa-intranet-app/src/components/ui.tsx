/**
 * Piezas de interfaz compartidas por el Inicio y las páginas de sección. Mismo
 * marcado y clases que el prototipo (screens.css, pages/inicio.css), así usan
 * el mismo CSS.
 */
import React, { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router'

import { color } from '../lib/colores'
import { esArchivo, esExterna } from '../lib/url'
import type { Vista } from '../lib/vista'
import { useTitulo } from '../paginas/titulo'

/** Fila genérica de una lista (Inicio, RRHH, Clínica, Documentos…). */
export type Fila = {
  t: string
  meta?: string | null
  h?: string | null
  g?: string | null
  /** Foto de la fila (p. ej. de una noticia): sustituye al glifo. */
  img?: string | null
  color?: string | null
  ejemplo?: boolean | null
  sla?: string | null
  /** El plazo lo publica el sitio actual (si no, es una propuesta y se ve en ámbar). */
  slaConfirmado?: boolean
  tag?: string | null
  /** Color de la etiqueta: 'ok' (verde), 'warn' (ámbar) o 'brand' (azul). */
  tono?: 'ok' | 'warn' | 'brand' | null
}

/**
 * Enlace que se elige solo: página de la intranet (sin recargar), archivo,
 * correo o teléfono, otro sitio (pestaña nueva) o, sin destino, solo texto.
 */
export function Enlace({ h, className, title, children }: { h?: string | null; className?: string; title?: string; children: React.ReactNode }) {
  if (!h) return <span className={className} title={title}>{children}</span>
  if (esExterna(h)) return <a className={className} href={h} target="_blank" rel="noopener" title={title}>{children}</a>
  if (esArchivo(h) || /^(mailto|tel):/.test(h)) return <a className={className} href={h} title={title}>{children}</a>
  return <Link className={className} to={h} title={title}>{children}</Link>
}

/** Enlace a /entrar que recuerda esta página: después de iniciar sesión se vuelve aquí. */
export function EnlaceEntrar({ className, title, children = 'Iniciar sesión' }: { className?: string; title?: string; children?: React.ReactNode }) {
  const { pathname, search } = useLocation()
  return (
    <Link className={className} to="/entrar" state={{ volver: pathname + search }} title={title}>
      {children}
    </Link>
  )
}

export const MarcaExterna = () => <span className="ext-mark" aria-label="abre en pestaña nueva">↗</span>

export function Ic({ g, tint, c }: { g?: string | null; tint?: string; c?: string }) {
  return <span className="ic" style={tint ? { background: tint, color: c } : undefined} aria-hidden="true">{g}</span>
}

export function Panel(p: {
  uid: string
  t: string
  g: string
  tint?: string
  color?: string
  eg?: string
  tag?: string
  more?: string
  moreH?: string
  cls?: string
  pre?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className={'panel' + (p.cls ? ' ' + p.cls : '')} aria-labelledby={'h-' + p.uid}>
      <header>
        <Ic g={p.g} tint={p.tint} c={p.color} />
        <h2 id={'h-' + p.uid}>{p.t}</h2>
        {p.eg && <span className="eg">{p.eg}</span>}
        {p.tag && <span className="tag">{p.tag}</span>}
        {p.more && p.moreH && <Link className="more" to={p.moreH}>{p.more}</Link>}
      </header>
      {p.pre}
      <div className="body">{p.children}</div>
    </section>
  )
}

export const Nota = ({ t, cls = 'eg-note' }: { t?: string | null; cls?: string }) => (t ? <p className={cls}>{t}</p> : null)
export const Vacio = ({ t }: { t: string }) => <p className="home-empty">{t}</p>

export function FilaLista({ x, sla }: { x: Fila; sla?: boolean }) {
  const c = color(x.color)
  return (
    <Enlace h={x.h} className="list-row">
      <Ic g={x.g || '◦'} tint={c.tint} c={c.color} />
      <span className="tx">
        <b>{x.t}</b>
        {x.meta && <span>{x.meta}</span>}
      </span>
      {sla && x.sla && <span className={'sla' + (x.slaConfirmado ? '' : ' sla--prop')}>{x.sla}</span>}
      {x.ejemplo && <span className="eg">Ejemplo</span>}
      {x.h && esExterna(x.h) && <MarcaExterna />}
    </Enlace>
  )
}

export function FilaDoc({ x, ic = 'ic--off', g = '◫' }: { x: Fila; ic?: string; g?: string }) {
  const tono = x.tono || (x.tag === 'noticia' ? 'brand' : null)
  return (
    <Enlace h={x.h} className="doc-row">
      <span className={'ic ' + ic + (x.img ? ' ic--img' : '')} aria-hidden="true">{x.img ? <img src={x.img} alt="" loading="lazy" /> : x.g || g}</span>
      <span className="tx">
        <b>{x.t}</b>
        {x.meta && <span>{x.meta}</span>}
      </span>
      {x.tag && <span className={'tagline' + (tono ? ' tagline--' + tono : '')}>{x.tag}</span>}
    </Enlace>
  )
}

export const plural = (n: number, uno: string, varios: string) => n + ' ' + (n === 1 ? uno : varios)

// ---------- Páginas de sección ----------

/**
 * Migas + encabezado de la página. `miga` es el nombre corto (el del menú y de
 * la pestaña); `titulo`, el h1. `padres`: niveles intermedios (RRHH › Clínica).
 */
export function CabeceraPagina({
  titulo,
  miga,
  padres = [],
  intro,
  acciones,
  icono,
  pestanas,
}: {
  titulo: string
  miga?: string
  padres?: { t: string; h: string }[]
  intro?: React.ReactNode
  acciones?: React.ReactNode
  /** Ícono en un recuadro a la izquierda del título (decorativo). */
  icono?: React.ReactNode
  /** Pestañas (un `<nav>`) bajo el encabezado: el encabezado y las pestañas van juntos en una sola tarjeta. */
  pestanas?: React.ReactNode
}) {
  const corto = miga || titulo
  useTitulo(corto)
  const cabecera = (
    <div className={'page-head' + (icono ? ' page-head--ic' : '')}>
      {icono && <span className="page-head__ic" aria-hidden="true">{icono}</span>}
      <div className="txt">
        <h1>{titulo}</h1>
        {intro && <p>{intro}</p>}
      </div>
      {acciones && <div className="acts">{acciones}</div>}
    </div>
  )
  return (
    <>
      <p className="crumbs">
        <Link to="/">Inicio</Link>
        {padres.map((p) => (
          <React.Fragment key={p.h}>
            {' '}<span aria-hidden="true">/</span> <Link to={p.h}>{p.t}</Link>
          </React.Fragment>
        ))}{' '}
        <span aria-hidden="true">/</span> <span aria-current="page">{corto}</span>
      </p>
      {pestanas ? <div className="page-card">{cabecera}{pestanas}</div> : cabecera}
    </>
  )
}

/** Aviso informativo (ⓘ) o de advertencia (⚠). */
export function Aviso({ tipo, ic, children }: { tipo?: 'warn'; ic?: string; children: React.ReactNode }) {
  return (
    <div className={'notice' + (tipo === 'warn' ? ' notice--warn' : '')}>
      <span className="ic" aria-hidden="true">{ic ?? (tipo === 'warn' ? '⚠' : 'ⓘ')}</span>
      <p>{children}</p>
    </div>
  )
}

/** Botones de filtro: uno activo a la vez. */
export function Chips<T extends string>({ etiqueta, opciones, valor, onCambio }: { etiqueta: string; opciones: { v: T; t: string; n?: number }[]; valor: T; onCambio: (v: T) => void }) {
  return (
    <div className="chips" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.v} type="button" className={'chip-btn' + (o.v === valor ? ' is-active' : '')} aria-pressed={o.v === valor} onClick={() => onCambio(o.v)}>
          {o.t}
          {o.n !== undefined && <span className="n">{o.n}</span>}
        </button>
      ))}
    </div>
  )
}

/** Bloques o lista, como en Google Drive (lib/vista.ts). */
export function SelectorVista({ valor, onCambio }: { valor: Vista; onCambio: (v: Vista) => void }) {
  const opciones: { v: Vista; t: string; icono: React.ReactNode }[] = [
    {
      v: 'bloques',
      t: 'Bloques',
      icono: <path d="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z" />,
    },
    {
      v: 'lista',
      t: 'Lista',
      icono: <path d="M3 4h14v2H3zM3 9h14v2H3zM3 14h14v2H3z" />,
    },
  ]
  return (
    <div className="vista-sel" role="group" aria-label="Ver como">
      {opciones.map((o) => (
        <button key={o.v} type="button" className={o.v === valor ? 'is-active' : ''} aria-pressed={o.v === valor} onClick={() => onCambio(o.v)} title={'Ver en ' + o.t.toLowerCase()}>
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
            {o.icono}
          </svg>
          {o.t}
        </button>
      ))}
    </div>
  )
}

export function CampoBusqueda({ valor, onCambio, etiqueta, placeholder }: { valor: string; onCambio: (v: string) => void; etiqueta: string; placeholder: string }) {
  return (
    <label className="find">
      <span aria-hidden="true">⌕</span>
      <input type="search" value={valor} onChange={(e) => onCambio(e.target.value)} placeholder={placeholder} aria-label={etiqueta} autoComplete="off" />
    </label>
  )
}

/** Franja de cifras (.stat-strip). */
export function Estadisticas({ items }: { items: { v: React.ReactNode; k: string }[] }) {
  return (
    <div className="stat-strip">
      {items.map((s) => (
        <div className="stat" key={s.k}>
          <div className="v">{s.v}</div>
          <div className="k">{s.k}</div>
        </div>
      ))}
    </div>
  )
}

// Dos tonos más que usan las tarjetas del prototipo (no se ofrecen al personalizar el Inicio).
const TONOS_EXTRA: Record<string, { tint: string; color: string }> = {
  cafe: { tint: 'var(--color-brown-100)', color: 'var(--color-brown-400)' },
  gris: { tint: 'var(--bg-base)', color: 'var(--fg-default)' },
}

/** Colores (fondo y letra) de un tono de tarjeta; los dos extra son de la propuesta de diseño. */
export const tonoTarjeta = (c?: string | null) => TONOS_EXTRA[c || ''] || color(c)

/**
 * Tarjeta grande (.sys-card): icono de color, título, descripción y etiquetas.
 * Con `h` toda la tarjeta es el enlace; sin `h` es una tarjeta fija que puede
 * llevar un botón (`accion`), o verse apagada (`apagada`).
 */
export function TarjetaSistema({
  h,
  g,
  color: c,
  t,
  p,
  meta,
  accion,
  apagada,
}: {
  h?: string | null
  g: string
  color?: string | null
  t: string
  p?: React.ReactNode
  meta?: React.ReactNode
  accion?: React.ReactNode
  apagada?: boolean
}) {
  const col = apagada ? TONOS_EXTRA.gris : TONOS_EXTRA[c || ''] || color(c)
  const cuerpo = (
    <>
      <span className="ic" style={{ background: col.tint, color: col.color }} aria-hidden="true">{g}</span>
      <span className="tx">
        <b>{t}</b>
        {p && <p>{p}</p>}
        {meta && <span className="meta">{meta}</span>}
        {accion && <span className="meta" style={{ marginTop: 8 }}>{accion}</span>}
      </span>
    </>
  )
  if (h) {
    return (
      <Enlace h={h} className="sys-card">
        {cuerpo}
        {esExterna(h) && <MarcaExterna />}
      </Enlace>
    )
  }
  return <div className={'sys-card' + (apagada ? ' is-disabled' : '')} style={{ cursor: 'default' }}>{cuerpo}</div>
}

/** Extensiones o datos cortos destacados (.ext-grid). */
export function Extensiones({ items }: { items: { v: React.ReactNode; t: string }[] }) {
  return (
    <div className="ext-grid">
      {items.map((x) => (
        <div className="ext-tile" key={x.t}>
          <b>{x.v}</b>
          <span>{x.t}</span>
        </div>
      ))}
    </div>
  )
}

// ---------- Contraseña ----------

/**
 * El «ojito»: botón para mostrar u ocultar lo escrito en un campo de contraseña. Es un botón de verdad (Tab, Enter y
 * Espacio), con nombre claro («Mostrar contraseña» / «Ocultar contraseña») y `aria-pressed`. `controla` son los ids de
 * los campos que mueve. `nombre` es de qué es el campo («contraseña», «número de cargo»).
 */
export function BotonOjo({ visible, onAlternar, controla, nombre = 'contraseña' }: { visible: boolean; onAlternar: () => void; controla: string; nombre?: string }) {
  return (
    <button type="button" className="login__mostrar" aria-controls={controla} aria-pressed={visible} aria-label={(visible ? 'Ocultar ' : 'Mostrar ') + nombre} onClick={onAlternar}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        {visible && <path d="M4 4l16 16" />}
      </svg>
    </button>
  )
}

/**
 * Campo de contraseña con el «ojito» y el aviso de Bloq Mayús (/entrar y RRHH Express).
 * `describedBy`: los ids de los mensajes de error o ayuda del campo. `nombre`: cómo se llama lo que se escribe
 * (por defecto «contraseña»; en RRHH Express es el «número de cargo»).
 * Lo escrito solo vive en la memoria de la página: no se guarda en el navegador ni en la dirección, y vuelve a
 * taparse al enviar el formulario y al pasar el foco a otra parte de la página.
 */
export function CampoClave(p: {
  id: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password' | 'off'
  invalido?: boolean
  describedBy?: string
  inputRef?: React.Ref<HTMLInputElement>
  /** Teclado numérico en el teléfono (p. ej. el número de cargo). */
  inputMode?: 'numeric'
  nombre?: string
}) {
  const [mostrar, setMostrar] = React.useState(false)
  const [mayusculas, setMayusculas] = React.useState(false)
  const interno = React.useRef<HTMLInputElement | null>(null)
  const revisar = (e: React.KeyboardEvent) => setMayusculas(e.getModifierState?.('CapsLock') ?? false)
  const mayus = p.id + '-mayus'
  // Al enviar el formulario, la contraseña vuelve a taparse (también si el envío falla y la persona sigue en la página).
  React.useEffect(() => {
    const form = interno.current?.form
    if (!form) return
    const tapar = () => setMostrar(false)
    form.addEventListener('submit', tapar)
    return () => form.removeEventListener('submit', tapar)
  }, [])
  const ref = (el: HTMLInputElement | null) => {
    interno.current = el
    if (typeof p.inputRef === 'function') p.inputRef(el)
    else if (p.inputRef) (p.inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el
  }
  return (
    <>
      <div
        className="login__clave"
        // Si el foco se va a otra parte de la página (no al «ojito»), se vuelve a tapar.
        onBlur={(e) => {
          const a = e.relatedTarget as Node | null
          if (a && !e.currentTarget.contains(a)) setMostrar(false)
        }}
      >
        <input
          ref={ref}
          className="ds-input"
          id={p.id}
          name={p.id}
          type={mostrar ? 'text' : 'password'}
          autoComplete={p.autoComplete}
          inputMode={p.inputMode}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
          onKeyDown={revisar}
          onKeyUp={revisar}
          onBlur={() => setMayusculas(false)}
          aria-invalid={p.invalido ? true : undefined}
          aria-describedby={[p.describedBy, mayusculas && mayus].filter(Boolean).join(' ') || undefined}
        />
        <BotonOjo visible={mostrar} onAlternar={() => setMostrar((m) => !m)} controla={p.id} nombre={p.nombre} />
      </div>
      {mayusculas && (
        <p className="login__mayus" id={mayus} role="status">
          Tienes activadas las mayúsculas (Bloq Mayús).
        </p>
      )}
    </>
  )
}

// ---------- Diálogo ----------

/** Diálogo modal nativo (<dialog>): Escape o clic fuera lo cierran, y el foco vuelve a donde estaba. */
export function Dialogo({ id, titulo, onCerrar, children, pie }: { id: string; titulo: string; onCerrar: () => void; children: React.ReactNode; pie?: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    const volver = document.activeElement as HTMLElement | null
    d?.showModal?.()
    d?.querySelector<HTMLElement>('select, input, [data-add], [data-foco]')?.focus()
    return () => {
      if (volver && document.body.contains(volver)) volver.focus()
    }
  }, [])
  return (
    <dialog ref={ref} className="home-dlg" aria-labelledby={id + 'T'} onCancel={(e) => (e.preventDefault(), onCerrar())} onClick={(e) => e.target === ref.current && onCerrar()}>
      <div className="home-dlg__head">
        <h2 id={id + 'T'}>{titulo}</h2>
        <button type="button" className="home-dlg__x" aria-label="Cerrar" onClick={onCerrar}>✕</button>
      </div>
      {children}
      {pie}
    </dialog>
  )
}
