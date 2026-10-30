/**
 * Cómo se pinta cada bloque del Inicio. Mismo marcado que inicio-bloques.js
 * del prototipo (así aplica el mismo CSS). La lista de bloques y su validación
 * están en lib/bloques.ts.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { NIVEL_TEXTO, type Anuncio } from '../../lib/anuncios'
import type { Boletin } from '../../lib/contenido'
import { etiquetas, slug, type App } from '../../lib/catalogo'
import { AREAS } from '../../lib/catalogo'
import { BLOQUES, type CfgElegir, type CfgEnlaces, type CfgFiltro, type Item } from '../../lib/bloques'
import { activa } from '../../lib/edicion'
import { fechaLarga } from '../../lib/fechas'
import { minutosAHoras } from '../../lib/rrhh'
import { fechaComprobante, notaConteo, type ResumenRrhh } from '../../lib/tuDia'
import { esExterna, urlSegura } from '../../lib/url'
import { DIRECTORIO } from '../../data/directorio'
import { AppTile } from '../AppTile'
import { useSitio } from '../Proveedores'
import { Enlace, FilaDoc, FilaLista, Ic, MarcaExterna, Nota, Panel, plural, Vacio, type Fila } from '../ui'

// ---------- Datos que recibe el Inicio (los arma paginas/PaginaInicio.tsx) ----------
export type DatosInicio = {
  usuario: { corto: string } | null
  /** Los vigentes hoy (GET /announcements). `gestionar`: la persona puede publicarlos (Comunicación o administración). */
  /** items null = todavía cargando. */
  anuncios: { items: Anuncio[] | null; error: boolean; gestionar: boolean }
  solicitudes: { ejemplo?: boolean | null; nota?: string | null; items: { code?: string | null; t: string; m?: string | null; st?: string | null; c?: string | null; open?: boolean | null; h?: string | null }[] }
  noticias: { nota?: string | null; items: Fila[] }
  directorio: { nota?: string | null; personas: { ini?: string | null; t: string; meta?: string | null; ext?: string | null }[] }
  frecuentes: { nota?: string | null; items: Fila[] }
  campanas: { nota?: string | null; items: { src: string; alt: string; h?: string | null }[] }
  clinica: { intro?: string | null; items: Fila[] }
  mesa: { ext?: string | null; correo?: string | null; intro?: string | null }
  enlaces: { t: string; g?: string | null; h?: string | null }[]
  apps: App[]
  boletines: Boletin[]
  /** RRHH Express: null = no se sabe o no está conectado (el bloque «Mi resumen» no se muestra). */
  rrhh: ResumenRrhh | null
  formularios: { t: string; meta: string; h: string; area: string }[]
}
export type Ctx = { uid: string; cfg?: Item['cfg']; editando: boolean; datos: DatosInicio }

// ---------- "Elegir qué mostrar" (bloques con listas largas) ----------
/** Cada ítem se identifica por su destino, o por su nombre si no tiene. */
const claveDe = (x: { t: string; h?: string | null }) => x.h || x.t

/** Qué se puede elegir en un bloque (para el diálogo de Personalizar). */
export function opcionesElegibles(id: string, d: DatosInicio): { k: string; t: string }[] {
  const lista: { t: string; h?: string | null }[] =
    id === 'formularios' ? d.formularios : id === 'frecuentes' ? d.frecuentes.items : id === 'enlaces' ? d.enlaces.filter((l) => l.h) : id === 'clinica' ? d.clinica.items : []
  return lista.map((x) => ({ k: claveDe(x), t: x.t }))
}

function elegidos<T extends { t: string; h?: string | null }>(items: T[], cfg: Ctx['cfg']): { visibles: T[]; ocultos: number } {
  const o = (cfg as CfgElegir | undefined)?.ocultos ?? []
  const visibles = items.filter((x) => !o.includes(claveDe(x)))
  return { visibles, ocultos: items.length - visibles.length }
}

/** "3 ocultos · Elegir qué mostrar": que nadie piense que falta algo. */
function Ocultos({ n, editando }: { n: number; editando: boolean }) {
  if (!n) return null
  return (
    <p className="home-ocultos">
      {plural(n, 'oculto', 'ocultos')} por ti{editando ? '. Usa ⚙ para elegir qué mostrar.' : ' · '}
      {!editando && <Link to="/?personalizar=1">Elegir qué mostrar</Link>}
    </p>
  )
}

// ---------- Bloques ----------
const NIVEL: Record<string, string> = { urgente: 'var(--color-error-500)', importante: 'var(--color-warning-500)', normal: 'var(--action)' }

/** Un anuncio como se ve en el Inicio (también la vista previa del panel de Comunicación). */
export function FilaAnuncio({ a }: { a: Pick<Anuncio, 'titulo' | 'detalle' | 'nivel' | 'enlace'> }) {
  return (
    <div className="ann">
      <span className="sev" style={{ background: NIVEL[a.nivel] || NIVEL.normal }} title={NIVEL_TEXTO[a.nivel]} />
      <div>
        <b>
          <span className="sr-only">{NIVEL_TEXTO[a.nivel] || NIVEL_TEXTO.normal}: </span>
          {a.enlace ? (
            <Enlace h={a.enlace}>
              {a.titulo}
              {esExterna(a.enlace) && <MarcaExterna />}
            </Enlace>
          ) : (
            a.titulo
          )}
        </b>
        {a.detalle && <span className="ann__det">{a.detalle}</span>}
      </div>
    </div>
  )
}

function Anuncios({ uid, datos: { anuncios: A } }: Ctx) {
  return (
    <Panel
      uid={uid}
      t="Anuncios institucionales"
      g="◔"
      tint="var(--color-warning-100)"
      color="var(--color-warning-700)"
      tag={A.items?.length ? plural(A.items.length, 'vigente', 'vigentes') : undefined}
      more={A.gestionar ? 'Gestionar' : undefined}
      moreH="/gestion/anuncios"
    >
      {A.error ? (
        <Vacio t="No se pudieron cargar los anuncios. Vuelve a intentarlo en un momento." />
      ) : !A.items ? (
        <Vacio t="Cargando anuncios…" />
      ) : A.items.length ? (
        A.items.map((a) => <FilaAnuncio key={a.id} a={a} />)
      ) : (
        <Vacio t="No hay anuncios vigentes." />
      )}
    </Panel>
  )
}

function Accesos({ uid, datos }: Ctx) {
  const { favs } = useSitio()
  const fav = datos.apps.filter((a) => favs.includes(a.id))
  const sug = datos.apps.filter((a) => a.h && !favs.includes(a.id)).slice(0, Math.max(0, 6 - fav.length))
  return (
    <Panel uid={uid} t="Mis accesos rápidos" g="▧" more={'Ver los ' + datos.apps.length + ' sistemas →'} moreH="/aplicaciones">
      <div className="apps-grid quick-apps">{[...fav, ...sug].map((a) => <AppTile key={a.id} app={a} corta />)}</div>
      {sug.length > 0 && <Nota cls="quick-suggestions" t="Además de tus favoritos se muestran otros sistemas del catálogo. Marca ★ en Aplicaciones para personalizarlos." />}
    </Panel>
  )
}

function Solicitudes({ uid, datos: { solicitudes: S } }: Ctx) {
  const vacio = S.items.length === 0
  const [tab, setTab] = useState<'open' | 'closed' | 'all'>('open')
  const tabs: [typeof tab, string][] = [['open', 'Abiertas'], ['closed', 'Cerradas'], ['all', 'Todas']]
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const lista = S.items.filter((x) => tab === 'all' || (tab === 'open') === !!x.open)
  const pre = (
    <div className="tabs" role="tablist" aria-label="Filtrar solicitudes">
      {tabs.map(([k, t], i) => (
        <button
          key={k}
          ref={(el) => { refs.current[i] = el }}
          type="button"
          role="tab"
          id={`tab-${uid}-${k}`}
          aria-controls={'tk-' + uid}
          aria-selected={tab === k}
          tabIndex={tab === k ? 0 : -1}
          className={tab === k ? 'is-active' : undefined}
          onClick={() => setTab(k)}
          onKeyDown={(e) => {
            const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
            if (!d) return
            e.preventDefault()
            const n = (i + d + tabs.length) % tabs.length
            setTab(tabs[n][0])
            refs.current[n]?.focus()
          }}
        >
          {t}
        </button>
      ))}
    </div>
  )
  // Sin nada que mostrar (o sin sesión, o sin las integraciones conectadas): una línea corta, no pestañas vacías.
  if (vacio)
    return (
      <Panel uid={uid} t="Mis solicitudes" g="▥" cls="tickets is-vacio" eg={S.ejemplo ? 'Ejemplo' : undefined} more="Ver todas →" moreH="/mis-solicitudes">
        <Vacio t={S.nota || 'Aquí verás tus citas, códigos de llamada y tickets.'} />
      </Panel>
    )
  return (
    <Panel uid={uid} t="Mis solicitudes" g="▥" cls="tickets" eg={S.ejemplo ? 'Ejemplo' : undefined} pre={pre} more="Ver todas →" moreH="/mis-solicitudes">
      <div className="rows" id={'tk-' + uid} role="tabpanel" aria-labelledby={`tab-${uid}-${tab}`}>
        {lista.length ? lista.map((x, i) => (
          <div className="row" key={i}>
            <div className="main">
              <p className="code">{x.code}</p>
              <p className="t">{x.h ? <Link to={x.h}>{x.t}</Link> : x.t}</p>
              <p className="m">{x.m}</p>
            </div>
            <span className={'st st--' + (x.c || 'off')}>{x.st}</span>
          </div>
        )) : <Vacio t="No hay solicitudes en esta vista." />}
      </div>
      <Nota t={S.nota} />
    </Panel>
  )
}

function Noticias({ uid, datos: { noticias: N } }: Ctx) {
  return (
    <Panel uid={uid} t="Noticias y comunicados" g="◫" more="Ver todas →" moreH="/noticias">
      {N.items.length ? <div className="doc-list">{N.items.map((x, i) => <FilaDoc key={i} x={x} />)}</div> : <Vacio t="Aún no hay noticias publicadas." />}
      <Nota t={N.nota} />
    </Panel>
  )
}

/** Las 5 direcciones con más personas en el directorio: atajos al Directorio ya filtrado. */
const DIRECCIONES_TOP = (() => {
  const n = new Map<string, number>()
  for (const p of DIRECTORIO.personas) if (p.direccion) n.set(p.direccion, (n.get(p.direccion) || 0) + 1)
  return [...n].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'es')).slice(0, 5).map(([d]) => d)
})()

function Directorio({ uid, datos: { directorio: P } }: Ctx) {
  const navegar = useNavigate()
  return (
    <Panel uid={uid} t="Directorio institucional" g="◉" more="Abrir →" moreH="/directorio">
      <form
        className="dir-find"
        action="/directorio"
        method="get"
        role="search"
        onSubmit={(e) => {
          // Dentro de la SPA (sin recargar); el Directorio lee ?q=.
          e.preventDefault()
          const q = String(new FormData(e.currentTarget).get('q') || '').trim()
          navegar('/directorio' + (q ? '?q=' + encodeURIComponent(q) : ''))
        }}
      >
        <label className="sr-only" htmlFor={'q-' + uid}>Buscar persona o extensión</label>
        <input id={'q-' + uid} name="q" type="search" placeholder="Nombre, dirección o extensión…" />
        <button type="submit">Buscar</button>
      </form>
      {P.personas.map((p, i) => (
        <Link className="person-row" key={i} to={'/directorio?q=' + encodeURIComponent(p.ext || p.t)} title={'Ver ' + p.t + ' en el directorio'}>
          <span className="av" aria-hidden="true">{p.ini}</span>
          <span className="tx"><b>{p.t}</b><span>{p.meta}</span></span>
          <span className="ext">{p.ext}</span>
        </Link>
      ))}
      <div className="dir-deps" role="group" aria-label="Buscar por dirección">
        <span className="dir-deps__lbl">Por dirección</span>
        {DIRECCIONES_TOP.map((d) => (
          <Link key={d} className="chip-btn" to={'/directorio?dir=' + encodeURIComponent(d)}>{d}</Link>
        ))}
      </div>
      <p className="dir-pie">
        Central: <a href={'tel:+507' + DIRECTORIO.central.replace(/\D/g, '')}>{DIRECTORIO.central}</a>
        {' · '}
        <a href={DIRECTORIO.organigrama} target="_blank" rel="noopener">Ver organigrama<MarcaExterna /></a>
      </p>
      <Nota t={P.nota} />
    </Panel>
  )
}

function Frecuentes({ uid, cfg, editando, datos: { frecuentes: F } }: Ctx) {
  const { visibles, ocultos } = elegidos(F.items, cfg)
  return (
    <Panel uid={uid} t="Trámites frecuentes" g="▤" {...(activa('formularios') ? { more: 'Todos los formularios →', moreH: '/formularios' } : {})}>
      <div className="home-list">{visibles.map((x, i) => <FilaLista key={i} x={x} sla />)}</div>
      <Ocultos n={ocultos} editando={editando} />
      <Nota t={F.nota} />
    </Panel>
  )
}

function Boletines({ uid, datos: { boletines: L } }: Ctx) {
  return (
    <section className="bul-band" aria-labelledby={'h-' + uid}>
      <header>
        <h2 id={'h-' + uid}>Boletines informativos</h2>
        <Link to="/boletines">Ver los {L.length} →</Link>
      </header>
      {L.length ? (
        <div className="bul-grid">
          {L.slice(0, 4).map((b) => (
            <Link className="bul-card" key={b.id} to={b.pdf ? '/boletines/' + b.id : '/boletines'}>
              {b.portada && <img className="bul-card__img" src={b.portada} alt="" loading="lazy" />}
              <span className="k">Alcaldía al día</span>
              <b>{fechaLarga(b.fecha)}</b>
              <span>Boletín informativo · Leer →</span>
            </Link>
          ))}
        </div>
      ) : <p className="bul-empty">Aún no hay boletines publicados.</p>}
    </section>
  )
}

function Campanas({ uid, datos: { campanas: K } }: Ctx) {
  const [i, setI] = useState(0)
  const [cols, setCols] = useState(2)
  const tira = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = tira.current
    if (!el) return
    const medir = () => setCols((getComputedStyle(el).gridTemplateColumns || '').split(' ').filter(Boolean).length || 1)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const L = K.items
  const visible = (n: number) => Array.from({ length: cols }, (_, k) => (i + k) % L.length).includes(n)
  return (
    <section className="panel home-campaigns" aria-labelledby={'h-' + uid}>
      <header className="campaign-head">
        <Ic g="◫" />
        <h2 id={'h-' + uid}>Campañas y avisos</h2>
        {L.length > 1 && (
          <div className="campaign-controls">
            <button type="button" aria-label="Ver campañas anteriores" onClick={() => setI((i - 1 + L.length) % L.length)}>←</button>
            <button type="button" aria-label="Ver campañas siguientes" onClick={() => setI((i + 1) % L.length)}>→</button>
          </div>
        )}
      </header>
      <div className="body">
        {L.length ? (
          <div className="banner-strip" ref={tira} aria-live="polite">
            {L.map((x, n) => {
              const img = <img src={x.src} alt={x.alt} loading="lazy" />
              return x.h ? <a key={n} href={x.h} hidden={!visible(n)}>{img}</a> : <img key={n} src={x.src} alt={x.alt} loading="lazy" hidden={!visible(n)} />
            })}
          </div>
        ) : <Vacio t="No hay campañas publicadas." />}
        <Nota t={K.nota} cls="campaign-note" />
      </div>
    </section>
  )
}

function Enlaces({ uid, cfg, editando, datos }: Ctx) {
  const { visibles: enlaces, ocultos } = elegidos(datos.enlaces.filter((l) => l.h), cfg)
  return (
    <section className="panel" id="enlaces-institucionales" aria-labelledby={'h-' + uid}>
      <div className="body home-inst">
        <div className="inst-head">
          <Ic g="◈" />
          <h2 id={'h-' + uid}>Enlaces institucionales</h2>
          <span className="hint">Se abren en una pestaña nueva</span>
        </div>
        <div className="inst-chips">
          {/* Un enlace sin destino no se muestra: nunca un chip que no lleve a ningún lado. */}
          {enlaces.map((l) => (
            <a key={l.t} className="inst-chip" href={l.h!} target="_blank" rel="noopener"><span className="g" aria-hidden="true">{l.g}</span>{l.t}</a>
          ))}
        </div>
        <Ocultos n={ocultos} editando={editando} />
      </div>
    </section>
  )
}

/** Tarjeta que lleva a Identidad visual (/comunicacion): logo oficial y atajos a lo que más se busca. */
function Marca({ uid }: Ctx) {
  return (
    <section className="panel" id="identidad-visual" aria-labelledby={'h-' + uid}>
      <div className="body home-inst home-marca">
        <img className="home-marca__logo" src="/marca/logos/svg/logo-azul-sobre-blanco-vertical.svg" alt="Logo de la Alcaldía de Panamá" width={64} height={80} loading="lazy" />
        <div className="home-marca__tx">
          <div className="inst-head">
            <Ic g="✎" />
            <h2 id={'h-' + uid}>Identidad visual</h2>
            <Link className="hint" to="/comunicacion">Ver todo →</Link>
          </div>
          <div className="inst-chips">
            <Link className="marca-chip" to="/comunicacion#logos">Logos</Link>
            <Link className="marca-chip" to="/comunicacion#paleta">Paleta</Link>
            <Link className="marca-chip" to="/comunicacion/guia-del-logo">Guía del logo</Link>
            <Link className="marca-chip" to="/comunicacion#plantillas">Plantillas</Link>
            <Link className="marca-chip" to="/comunicacion#redes">Redes sociales</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function Clinica({ uid, cfg, editando, datos: { clinica: K } }: Ctx) {
  const { visibles, ocultos } = elegidos(K.items, cfg)
  return (
    <Panel uid={uid} t="Clínica Municipal" g="✚" tint="var(--color-coral-100)" color="var(--color-coral-400)" more="Ver clínica →" moreH="/clinica">
      {K.intro && <p className="ds-body-sm home-intro">{K.intro}</p>}
      <div className="home-list">{visibles.map((x, i) => <FilaLista key={i} x={{ ...x, color: 'coral' }} />)}</div>
      <Ocultos n={ocultos} editando={editando} />
    </Panel>
  )
}

function Mesa({ uid, datos: { mesa: M } }: Ctx) {
  return (
    <Panel uid={uid} t="Soporte técnico · Mesa de Servicios" g="☏" more="Abrir →" moreH="/mesa-servicios">
      {M.intro && <p className="ds-body-sm home-intro">{M.intro}</p>}
      <div className="mesa-contact">
        <div><span>Extensión</span><b>{M.ext}</b></div>
        {M.correo && <div><span>Correo</span><a href={'mailto:' + M.correo}>{M.correo}</a></div>}
      </div>
      <div className="home-list">
        {activa('formularios') && <FilaLista x={{ t: 'Formularios de Tecnología', meta: 'Accesos, códigos, carpetas y correo', g: '▤', h: '/formularios' }} />}
        <FilaLista x={{ t: 'Videos instructivos', meta: 'Restablecer usuario de máquina', g: '▶', color: 'morado', h: activa('videos') ? '/videos' : '/mesa-servicios#videos' }} />
      </div>
    </Panel>
  )
}

function Formularios({ uid, cfg, editando, datos }: Ctx) {
  const { visibles: F, ocultos } = elegidos(datos.formularios, cfg)
  return (
    <Panel uid={uid} t="Formularios de solicitud" g="▤" tint="var(--color-purple-100)" color="var(--color-purple-400)" more="Ver todos →" moreH="/formularios">
      {F.length ? <div className="doc-list home-cols">{F.map((f) => <FilaDoc key={f.h} x={f} ic="ic--web" g="▤" />)}</div> : <Vacio t="No hay formularios publicados." />}
      <Ocultos n={ocultos} editando={editando} />
    </Panel>
  )
}

export function tituloFiltro(cfg: CfgFiltro | undefined, apps: App[]): string {
  if (cfg?.titulo) return cfg.titulo
  if (!cfg?.valor) return 'Aplicaciones por tema'
  if (cfg.tipo === 'area') return 'Aplicaciones · ' + cfg.valor
  const t = etiquetas(apps).find((x) => x.slug === cfg.valor)
  return 'Aplicaciones · ' + (t ? t.name : cfg.valor)
}
function AppsFiltro({ uid, cfg, editando, datos }: Ctx) {
  const c = cfg as CfgFiltro | undefined
  const t = tituloFiltro(c, datos.apps)
  if (!c?.valor) return <Panel uid={uid} t={t} g="#"><Vacio t={editando ? 'Usa ⚙ para elegir un área o una etiqueta.' : 'Este bloque no tiene tema. Personaliza tu inicio para elegirlo.'} /></Panel>
  const L = datos.apps.filter((a) => (c.tipo === 'area' ? a.cat === c.valor : a.tags.map(slug).includes(c.valor)))
  const moreH = '/aplicaciones?' + (c.tipo === 'area' ? 'area=' : 'etiqueta=') + encodeURIComponent(c.valor)
  return (
    <Panel uid={uid} t={t} g="#" more={L.length > c.cantidad ? 'Ver las ' + L.length + ' →' : 'Ver en el catálogo →'} moreH={moreH}>
      {L.length ? <div className="apps-grid quick-apps">{L.slice(0, c.cantidad).map((a) => <AppTile key={a.id} app={a} />)}</div> : <Vacio t="No hay aplicaciones con ese filtro." />}
    </Panel>
  )
}

function MisEnlaces({ uid, cfg, editando }: Ctx) {
  const c = cfg as CfgEnlaces | undefined
  const L = (c?.links || []).filter((l) => urlSegura(l.h))
  return (
    <Panel uid={uid} t={c?.titulo || 'Mis enlaces'} g="↗">
      {L.length ? (
        <div className="doc-list home-cols">
          {L.map((l) => (
            <a key={l.h} className="doc-row" href={l.h} target="_blank" rel="noopener noreferrer">
              <span className="ic ic--web" aria-hidden="true">↗</span>
              <span className="tx"><b>{l.t}</b><span>{new URL(l.h).host.replace(/^www\./, '')}</span></span>
            </a>
          ))}
        </div>
      ) : <Vacio t={editando ? 'Usa ⚙ para agregar tus enlaces.' : 'Aún no tienes enlaces. Personaliza tu inicio para agregarlos.'} />}
    </Panel>
  )
}

// ---------- Mi resumen (solo con RRHH Express conectado) ----------
const RH = '/recursos-humanos?seccion='
const SIN_DATO = 'No se pudo consultar ahora'

function Cifra({ k, v, sub, h, tono }: { k: string; v: React.ReactNode; sub: React.ReactNode; h: string; tono?: 'ok' | 'warn' }) {
  return (
    <Link className={'kpi-tile' + (tono ? ' kpi-tile--' + tono : '')} to={h}>
      <span className="kpi-tile__k">{k}</span>
      <span className="kpi-tile__v">{v}</span>
      <span className="kpi-tile__sub">{sub}</span>
    </Link>
  )
}

function MiResumen({ uid, datos: { rrhh: R } }: Ctx) {
  if (!R?.conectada)
    return (
      <Panel uid={uid} t="Mi resumen" g="◎">
        <Vacio t="Este bloque necesita RRHH Express conectado. Se conecta en Recursos Humanos; mientras tanto no se muestra en tu Inicio." />
      </Panel>
    )
  const m = R.marcaciones
  const c = R.comprobante
  return (
    <Panel uid={uid} t="Mi resumen" g="◎" cls="panel--resumen" more="Recursos Humanos →" moreH="/recursos-humanos">
      <Link className="resumen-main" to={RH + 'compensatorio'}>
        <span className="resumen-main__k">Tiempo compensatorio</span>
        <span className="resumen-main__v">{R.compensatorioMin !== null ? minutosAHoras(R.compensatorioMin) : '—'}</span>
        <span className="resumen-main__n">
          {R.compensatorioMin === null ? SIN_DATO : R.vence ? minutosAHoras(R.vence.minutos) + ' vencen en ' + plural(R.vence.dias, 'día', 'días') : 'Disponible para usar'}
        </span>
      </Link>
      <div className="resumen-row">
        <Cifra k={m ? 'Tardanzas · ' + m.mes : 'Tardanzas'} v={m ? m.tardanzas : '—'} sub={m ? notaConteo(m.tardanzas, 'Sin tardanzas') : SIN_DATO} h={RH + 'marcaciones'} tono={m ? (m.tardanzas ? 'warn' : 'ok') : undefined} />
        <Cifra k={m ? 'Ausencias · ' + m.mes : 'Ausencias'} v={m ? m.ausencias : '—'} sub={m ? notaConteo(m.ausencias, 'Sin ausencias') : SIN_DATO} h={RH + 'marcaciones'} tono={m ? (m.ausencias ? 'warn' : 'ok') : undefined} />
        <Cifra
          k="Último comprobante"
          v={c && c !== 'sin' ? fechaComprobante(c.fecha) : '—'}
          sub={c === 'sin' ? 'Aún no hay comprobantes' : c ? c.periodo || 'Comprobante de pago' : SIN_DATO}
          h={RH + 'comprobantes'}
        />
      </div>
    </Panel>
  )
}

/** Un bloque que hoy no funciona (`pausa` en lib/bloques.ts): se puede agregar, pero dice que no está funcionando. */
function Pausado({ uid, id }: { uid: string; id: string }) {
  return (
    <Panel uid={uid} t={BLOQUES[id].t} g={BLOQUES[id].g}>
      <Vacio t="Este bloque no está funcionando por ahora. Cuando esté listo, aquí verás su contenido." />
    </Panel>
  )
}

export const RENDER: Record<string, (c: Ctx) => React.ReactElement> = {
  resumen: (c) => <MiResumen {...c} />,
  anuncios: (c) => (BLOQUES.anuncios?.pausa ? <Pausado uid={c.uid} id="anuncios" /> : <Anuncios {...c} />),
  accesos: (c) => <Accesos {...c} />,
  solicitudes: (c) => (BLOQUES.solicitudes?.pausa ? <Pausado uid={c.uid} id="solicitudes" /> : <Solicitudes {...c} />),
  noticias: (c) => <Noticias {...c} />,
  directorio: (c) => <Directorio {...c} />,
  frecuentes: (c) => <Frecuentes {...c} />,
  boletines: (c) => <Boletines {...c} />,
  campanas: (c) => <Campanas {...c} />,
  enlaces: (c) => <Enlaces {...c} />,
  marca: (c) => <Marca {...c} />,
  clinica: (c) => <Clinica {...c} />,
  mesa: (c) => <Mesa {...c} />,
  formularios: (c) => <Formularios {...c} />,
  'apps-filtro': (c) => <AppsFiltro {...c} />,
  'mis-enlaces': (c) => <MisEnlaces {...c} />,
}

/** Opciones del selector "Mostrar aplicaciones de" (áreas y etiquetas con cantidad). */
export function opcionesFiltro(apps: App[]) {
  return {
    areas: AREAS.map((a) => ({ v: 'area:' + a, t: a, n: apps.filter((x) => x.cat === a).length })).filter((o) => o.n),
    tags: etiquetas(apps).map((t) => ({ v: 'etiqueta:' + t.slug, t: t.name, n: t.count })),
  }
}
