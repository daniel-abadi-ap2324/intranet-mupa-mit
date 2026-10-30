/**
 * Menú lateral (rail en tablet, cajón en teléfono) y barra inferior móvil.
 * Mismo marcado y clases que el prototipo (shell.js + app-shell.js).
 */
import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'

import { useDatos } from '../../datos'
import { recientesSinVer } from '../../lib/fechas'
import { contieneActual, gestionDe, idActual, INFERIOR, MENU, MENU_SESION, PIE_MENU, type ItemMenu } from '../../lib/menu'
import type { Usuario } from '../../api'
import { LS, useSitio } from '../Proveedores'
import { EnlaceEntrar } from '../ui'

/** Boletines de los últimos 90 días que esta persona no ha visto (se ponen en cero al abrir Boletines). */
function Contador({ it }: { it: ItemMenu }) {
  const { bolVisto } = useSitio()
  const { boletines } = useDatos()
  if (it.badge !== 'boletines') return null
  const n = recientesSinVer(boletines.map((b) => b.fecha), bolVisto)
  return n > 0 ? <span className="count" aria-label={n + (n === 1 ? ' boletín reciente sin abrir' : ' boletines recientes sin abrir')}>{n}</span> : null
}

function Enlace({ it, sub, extra, actual }: { it: ItemMenu; sub?: boolean; extra?: string; actual: string | null }) {
  const activo = it.id === actual
  const cls = ['app-navitem', sub && 'app-navitem--sub', activo && 'is-active', it.aside && 'app-navitem--aside', extra].filter(Boolean).join(' ')
  const contenido = (
    <>
      {!sub && <span className={'glyph' + (it.id === 'asistente' ? ' ia-glow' : '')} aria-hidden="true">{it.g} </span>}
      <span className="lbl">{it.t}</span>
      <Contador it={it} />
      {it.tag && <span className="tagline">{it.tag}</span>}
      {it.pdf && <span className="pdf-mark" title="Abre un PDF">PDF</span>}
      {it.ext && <span className="ext-mark" aria-label="abre en pestaña nueva">↗</span>}
    </>
  )
  return it.ext ? (
    <a className={cls} href={it.h} target="_blank" rel="noopener" data-tip={it.t} title={it.title}>{contenido}</a>
  ) : (
    <Link className={cls} to={it.h} aria-current={activo ? 'page' : undefined} data-tip={it.t} title={it.title}>{contenido}</Link>
  )
}

export function Sidebar({ usuario }: { usuario: Usuario | null }) {
  const ruta = useLocation().pathname || '/'
  // Todas las pantallas de gestión marcan el Centro, que es la única entrada de gestión del menú.
  const id = idActual(ruta)
  const actual = id?.startsWith('gestion-') ? 'gestion-centro' : id
  const centro = gestionDe(usuario).flatMap((g) => g.items).find((it) => it.id === 'gestion-centro')
  const { cajon, setCajon } = useSitio()
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})
  useEffect(() => setAbiertos(LS.get('mupa_nav_open', {})), [])
  useEffect(() => setCajon(false), [ruta, setCajon])

  const alternar = (id: string, actual: boolean) => {
    const n = { ...abiertos, [id]: !actual }
    setAbiertos(n)
    LS.set('mupa_nav_open', n)
  }

  return (
    <aside className={'app-sidebar' + (cajon ? ' is-open' : '')} id="sidebar" aria-label="Menú de la intranet">
      <div className="app-brand">
        {/* Logo oficial: horizontal en el menú abierto; vertical en el menú angosto (tablet). */}
        <img className="brand-logo brand-logo--h" src="/marca/logos/svg/logo-azul-sobre-blanco-horizontal.svg" alt="Alcaldía de Panamá" width={176} height={91} />
        <img className="brand-logo brand-logo--v" src="/marca/logos/svg/logo-azul-sobre-blanco-vertical.svg" alt="Alcaldía de Panamá" width={44} height={55} />
        <span className="brand-intranet">Intranet MUPA</span>
      </div>
      <nav className="app-nav" aria-label="Navegación principal">
        <p className="kicker">Espacio de trabajo</p>
        {MENU.map((it) => {
          if (!it.children) return <Enlace key={it.id} it={it} actual={actual} />
          const enGrupo = contieneActual(it, actual)
          // Los grupos no se abren solos al entrar en su pestaña: solo si la persona toca la flecha.
          const abierto = !!abiertos[it.id]
          return (
            <div key={it.id} className={'app-navgroup' + (abierto ? ' is-open' : '') + (enGrupo ? ' is-current' : '')} data-group={it.id}>
              <div className="app-navgroup__row">
                <Enlace it={it} actual={actual} extra="app-navgroup__link" />
                <button className="app-navgroup__btn" type="button" aria-expanded={abierto} aria-controls={'navg-' + it.id} aria-label={'Mostrar secciones de ' + it.t} onClick={() => alternar(it.id, abierto)}>
                  <span className="chev" aria-hidden="true">▾</span>
                </button>
              </div>
              <div className="app-navgroup__panel" id={'navg-' + it.id} role="group" aria-label={it.t}>
                {it.children.map((c) => <Enlace key={c.id} it={c} sub actual={actual} />)}
              </div>
            </div>
          )
        })}
        {usuario && MENU_SESION.map((it) => <Enlace key={it.id} it={it} actual={actual} />)}
      </nav>
      <div className="app-foot">
        {centro && (
          <div className="app-foot__grupo" role="group" aria-labelledby="gest-menu">
            <p className="kicker" id="gest-menu">
              Gestión
            </p>
            <Enlace it={{ ...centro, title: centro.d }} actual={actual} />
          </div>
        )}
        {PIE_MENU.map((it) => <Enlace key={it.id} it={it} actual={actual} />)}
        {usuario ? (
          <a className="app-user" href="/configuracion" title={usuario.nombre + (usuario.correo ? ' · ' + usuario.correo : '')}>
            <span className="av" aria-hidden="true">{usuario.iniciales}</span>
            <span className="tx">
              <b>{usuario.nombre}</b>
              <span>{usuario.correo}</span>
            </span>
          </a>
        ) : (
          <EnlaceEntrar className="app-user" title="Iniciar sesión">
            <span className="av">?</span>
            <span className="tx">
              <b>Iniciar sesión</b>
              <span>Para guardar tu Inicio en tu cuenta</span>
            </span>
          </EnlaceEntrar>
        )}
      </div>
    </aside>
  )
}

export function BarraInferior() {
  const actual = idActual(useLocation().pathname || '/')
  const { cajon, setCajon } = useSitio()
  // Con el menú abierto en el celular, Escape lo cierra y el foco vuelve al botón "Más".
  useEffect(() => {
    if (!cajon) return
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setCajon(false)
      document.querySelector<HTMLElement>('.app-menubtn')?.focus()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [cajon, setCajon])
  return (
    <>
      <nav className="app-bottomnav" aria-label="Navegación móvil">
        {INFERIOR.map((id) => {
          const it = MENU.find((m) => m.id === id)!
          const activo = contieneActual(it, actual)
          return (
            <Link key={id} className={'app-bottomnav__item' + (activo ? ' is-active' : '')} to={it.h} aria-current={activo ? 'page' : undefined}>
              <span className="glyph" aria-hidden="true">{it.g}</span>
              <span className="lbl">{it.t}</span>
              <Contador it={it} />
            </Link>
          )
        })}
        <button className="app-bottomnav__item app-menubtn" type="button" aria-controls="sidebar" aria-expanded={cajon} aria-label="Más secciones" onClick={() => setCajon(!cajon)}>
          <span className="glyph" aria-hidden="true">⋯</span>
          <span className="lbl">Más</span>
        </button>
      </nav>
      {cajon && <div className="app-scrim" onClick={() => setCajon(false)} />}
    </>
  )
}
