/**
 * Armazón de la gestión (/gestion y /gestion/…): una página aparte, como el asistente, sin el menú ni la barra
 * de la intranet. Se parece al panel de RH Link: la barra azul a la izquierda con todas las secciones
 * (las áreas del Centro y las pantallas de cada una), una barra superior con «volver» y la cuenta, y el contenido
 * en tarjetas sobre fondo claro. Las pantallas de gestión no cambian: solo cambia lo que las rodea.
 */
import React, { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'

import type { Usuario } from '../../api'
import { AREAS_GESTION, enBandeja, veArea, type AreaGestion } from '../../lib/gestion'
import { gestionDe, type ItemGestion } from '../../lib/menu'
import { useNotificacionesEnVivo } from '../../lib/useNotificacionesEnVivo'
import { ROL_ETIQUETA, tieneRol, type Rol } from '../../lib/roles'
import { Salir } from '../Salir'
import { EnlaceEntrar } from '../ui'
import { IconoGestion, type NombreIcono } from './Iconos'

type Nodo = { id: string; t: string; icono: NombreIcono; h: string; hijos: { id: string; t: string; icono: NombreIcono; h: string }[]; area?: AreaGestion }

const ICONO_AREA: Record<AreaGestion, NombreIcono> = { resumen: 'panel', solicitudes: 'bandeja', rrhh: 'personas', comunicacion: 'megafono', administracion: 'edificio' }

/** Las secciones de esta persona: cada área del Centro con las pantallas que cuelgan de ella. */
function secciones(usuario: Usuario | null): Nodo[] {
  const items = gestionDe(usuario).flatMap((g) => g.items)
  const de = (...ids: string[]) => ids.map((id) => items.find((it) => it.id === id)).filter((it): it is ItemGestion => !!it).map((it) => ({ id: it.id, t: it.t, icono: it.icono, h: it.h }))
  const grupos: Record<AreaGestion, string[]> = {
    resumen: [],
    solicitudes: ['gestion-formularios'],
    rrhh: [],
    comunicacion: ['gestion-anuncios', 'gestion-noticias', 'gestion-boletines', 'gestion-videos', 'gestion-inicio', 'gestion-marca'],
    administracion: ['gestion-usuarios', 'gestion-departamentos', 'gestion-aplicaciones'],
  }
  return AREAS_GESTION.filter((a) => veArea(usuario, a.v)).map((a) => ({
    id: 'area-' + a.v,
    t: a.t,
    icono: ICONO_AREA[a.v],
    h: a.v === 'resumen' ? '/gestion' : a.v === 'solicitudes' ? enBandeja() : '/gestion?area=' + a.v,
    area: a.v,
    hijos: de(...grupos[a.v]),
  }))
}

function Chevron({ abierto }: { abierto: boolean }) {
  return (
    <svg className={'gx-chev' + (abierto ? ' is-abierto' : '')} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function GestionShell({ usuario, sinConexion, sesionVencida, children }: { usuario: Usuario | null; sinConexion?: boolean; sesionVencida?: boolean; children: React.ReactNode }) {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  // El aviso en vivo de las solicitudes nuevas también suena y se ve aquí (la barra de la intranet no está en esta página).
  useNotificacionesEnVivo(usuario)
  const [cajon, setCajon] = useState(false)
  const [plegados, setPlegados] = useState<Record<string, boolean>>({})
  const nodos = secciones(usuario)
  const areaActual = (params.get('area') || 'resumen') as AreaGestion

  useEffect(() => setCajon(false), [pathname, params])
  useEffect(() => {
    if (!cajon) return
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setCajon(false)
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [cajon])

  const enPantalla = (h: string) => pathname === h || pathname.startsWith(h + '/')
  // El área del Centro está activa en /gestion con ese ?area=; la de Solicitudes también en /gestion/solicitudes.
  const areaActiva = (n: Nodo) => (pathname === '/gestion' && areaActual === n.area) || (n.area === 'solicitudes' && enPantalla('/gestion/solicitudes'))
  const hijoActivo = (n: Nodo) => n.hijos.some((h) => enPantalla(h.h.split('?')[0]))

  const rol = (['admin', 'gestorSolicitudes', 'comunicacion'] as Rol[]).find((r) => tieneRol(usuario, r))

  return (
    <div className="gx">
      <a className="sr-only" href="#contenido">
        Saltar al contenido
      </a>
      <aside className={'gx-lado' + (cajon ? ' is-abierto' : '')} id="gx-lado" aria-label="Secciones de gestión">
        <div className="gx-marca">
          {/* Logo oficial, sin tocar: su fondo es el mismo azul de la barra. */}
          <img src="/marca/logos/svg/logo-blanco-sobre-azul-vertical.svg" alt="Alcaldía de Panamá" width={104} height={130} />
        </div>
        <nav className="gx-nav" aria-label="Secciones de gestión">
          {nodos.map((n) => {
            const activa = areaActiva(n)
            const abierto = n.hijos.length > 0 && (plegados[n.id] ?? (activa || hijoActivo(n)))
            return (
              <div key={n.id} className="gx-grupo">
                <div className={'gx-fila' + (activa ? ' is-activa' : '') + (n.hijos.length ? ' tiene' : '')}>
                  <Link className="gx-item" to={n.h} aria-current={activa ? 'page' : undefined}>
                    <IconoGestion nombre={n.icono} className="gx-ic" />
                    <span>{n.t}</span>
                    {activa && <span className="gx-punto" aria-hidden="true" />}
                  </Link>
                  {n.hijos.length > 0 && (
                    <button type="button" className="gx-plegar" aria-expanded={abierto} aria-label={(abierto ? 'Ocultar ' : 'Mostrar ') + n.t} onClick={() => setPlegados({ ...plegados, [n.id]: !abierto })}>
                      <Chevron abierto={abierto} />
                    </button>
                  )}
                </div>
                {abierto && (
                  <div className="gx-hijos">
                    {n.hijos.map((h) => {
                      const aqui = enPantalla(h.h.split('?')[0])
                      return (
                        <Link key={h.id} className={'gx-item gx-item--hijo' + (aqui ? ' is-activa' : '')} to={h.h} aria-current={aqui ? 'page' : undefined}>
                          <IconoGestion nombre={h.icono} className="gx-ic" />
                          <span>{h.t}</span>
                          {aqui && <span className="gx-punto" aria-hidden="true" />}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <div className="gx-pie">
          <Link className="gx-item" to="/">
            <svg className="gx-ic" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Volver a la intranet</span>
          </Link>
          <p>Municipio de Panamá</p>
        </div>
      </aside>
      {cajon && <div className="gx-velo" onClick={() => setCajon(false)} aria-hidden="true" />}

      <div className="gx-cuerpo">
        <header className="gx-barra">
          <button type="button" className="gx-menu" aria-controls="gx-lado" aria-expanded={cajon} onClick={() => setCajon((v) => !v)}>
            <span className="sr-only">Secciones de gestión</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <Link className="gx-atras" to="/" aria-label="Volver a la intranet" title="Volver a la intranet">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="gx-titulo">
            <b>Gestión</b>
            <span>Intranet · Municipio de Panamá</span>
          </div>
          {usuario && (
            <div className="gx-cuenta">
              <span className="gx-quien" title={usuario.nombre}>
                <b>{usuario.nombre}</b>
                <span>{rol ? ROL_ETIQUETA[rol] : ROL_ETIQUETA.funcionario}</span>
              </span>
              <span className="gx-av" aria-hidden="true">
                {usuario.iniciales}
              </span>
              <Salir className="gx-salir" />
            </div>
          )}
        </header>
        <main className="gx-main" id="contenido">
          {sinConexion && (
            <div className="notice notice--warn" role="alert">
              <span className="ic" aria-hidden="true">⚠</span>
              <p>No se pudo conectar con el servidor de la intranet. Algunas secciones pueden verse vacías; inténtalo de nuevo en unos minutos.</p>
            </div>
          )}
          {sesionVencida && (
            <div className="notice notice--warn" role="alert">
              <span className="ic" aria-hidden="true">⚠</span>
              <p>
                Tu sesión venció y el último cambio no se guardó. <EnlaceEntrar>Vuelve a iniciar sesión</EnlaceEntrar> para seguir.
              </p>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
