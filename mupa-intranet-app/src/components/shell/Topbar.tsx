/** Barra superior: buscador, asistente, notificaciones (si hay solicitudes en esta edición), ayuda y cuenta. */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'

import type { Resultado } from '../../lib/busqueda'
import { api, type NotificacionSolicitud, type Usuario } from '../../api'
import { activa } from '../../lib/edicion'
import { ATIENDEN_SOLICITUDES, enBandeja } from '../../lib/gestion'
import { tieneRol } from '../../lib/roles'
import { useNotificacionesEnVivo } from '../../lib/useNotificacionesEnVivo'
import type { SolicitudMia } from '../../lib/solicitudes'
import { Asistente } from './Asistente'
import { Buscador } from './Buscador'
import { Icono } from './Iconos'
import { MenuCuenta } from './MenuCuenta'
import { EnlaceEntrar } from '../ui'

// Las notificaciones son de solicitudes: sin ellas, no hay campana ni se consulta nada.
const CAMPANA = activa('formularios') || activa('bandeja')

export function Topbar({ indice, usuario }: { indice: Resultado[]; usuario: Usuario | null }) {
  const [notifs, setNotifs] = useState(false)
  const [ayuda, setAyuda] = useState(false)
  const botonAyuda = useRef<HTMLButtonElement>(null)
  const menuAyuda = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  // Solicitudes con una respuesta o un cambio de estado que la persona todavía no vio.
  const [sinLeer, setSinLeer] = useState(0)
  const [nuevas, setNuevas] = useState<SolicitudMia[] | null>(null)
  // Admin y Gestor de Solicitudes: además, las solicitudes que llegaron y nadie atendió.
  const atiende = CAMPANA && tieneRol(usuario, ...ATIENDEN_SOLICITUDES)
  const [pendientes, setPendientes] = useState<{ total: number; items: NotificacionSolicitud[] }>({ total: 0, items: [] })
  const total = sinLeer + pendientes.total
  // Admin y Gestor de Solicitudes: aviso en vivo cuando llega una solicitud.
  useNotificacionesEnVivo(usuario)
  const contar = useCallback(() => {
    if (!usuario || !CAMPANA) return setSinLeer(0)
    api
      .resumen()
      .then((r) => setSinLeer(r.unreadRequests ?? 0))
      .catch(() => undefined)
    if (atiende)
      api
        .notificaciones()
        .then(setPendientes)
        .catch(() => undefined)
  }, [usuario, atiende])
  useEffect(() => {
    if (!CAMPANA) return
    contar()
    // Al abrir o atender una solicitud, al llegar una nueva (aviso en vivo) o cada 2 minutos.
    const cada = setInterval(contar, 120_000)
    window.addEventListener('mupa:solicitudes', contar)
    return () => {
      clearInterval(cada)
      window.removeEventListener('mupa:solicitudes', contar)
    }
  }, [contar])
  useEffect(() => {
    if (!notifs || !usuario || !CAMPANA) return
    api
      .misSolicitudes()
      .then((L) => setNuevas(L.filter((s) => s.sinLeer)))
      .catch(() => setNuevas([]))
  }, [notifs, usuario])
  useEffect(() => {
    if (!notifs) return
    const fuera = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !boton.current?.contains(e.target as Node)) setNotifs(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifs(false)
        boton.current?.focus()
      }
    }
    document.addEventListener('click', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('click', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [notifs])

  // Menú de Ayuda: clic afuera o Escape lo cierran (mismo patrón que las notificaciones).
  useEffect(() => {
    if (!ayuda) return
    const fuera = (e: MouseEvent) => {
      if (!menuAyuda.current?.contains(e.target as Node) && !botonAyuda.current?.contains(e.target as Node)) setAyuda(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAyuda(false)
        botonAyuda.current?.focus()
      }
    }
    document.addEventListener('click', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('click', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [ayuda])

  // En el Inicio la búsqueda es la caja grande del encabezado: aquí no se repite.
  const enInicio = useLocation().pathname === '/'
  return (
    <header className={'app-topbar' + (enInicio ? ' app-topbar--inicio' : '')} id="topbar">
      {!enInicio && <Buscador indice={indice} />}
      <div className="app-topbar__acts">
        <Asistente />
        {CAMPANA && (
        <button
          ref={boton}
          className="app-iconbtn app-iconbtn--txt app-notifbtn"
          type="button"
          aria-label={total ? `Notificaciones: ${total} ${total === 1 ? 'solicitud con novedades' : 'solicitudes con novedades'}` : 'Notificaciones'}
          title="Notificaciones"
          aria-expanded={notifs}
          aria-controls="notifs"
          onClick={() => setNotifs(!notifs)}
        >
          <Icono nombre="notificaciones" />
          <span className="lbl" aria-hidden="true">Notificaciones</span>
          {total > 0 && (
            <span className="app-notifbtn__n" aria-hidden="true">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </button>
        )}
        <div className="app-ayuda">
          <button
            ref={botonAyuda}
            id="ayuda-btn"
            className="app-iconbtn app-iconbtn--txt"
            type="button"
            aria-label="Ayuda"
            title="Ayuda"
            aria-expanded={ayuda}
            aria-controls="ayuda-menu"
            onClick={() => setAyuda(!ayuda)}
          >
            <Icono nombre="ayuda" />
            <span className="lbl" aria-hidden="true">Ayuda</span>
          </button>
          <div ref={menuAyuda} className="app-ayuda__menu" id="ayuda-menu" hidden={!ayuda}>
            <Link to="/?recorrido=1" onClick={() => setAyuda(false)}>
              Ver el recorrido de la intranet
              <span>Un minuto por lo principal: búsqueda, asistente, menú y ayuda.</span>
            </Link>
            <Link to="/mesa-servicios" onClick={() => setAyuda(false)}>
              Mesa de Servicios · ext. 1400
              <span>{activa('formularios') ? 'Soporte técnico: teléfono, correo y formularios.' : 'Soporte técnico: teléfono y correo.'}</span>
            </Link>
          </div>
        </div>
        {usuario ? (
          <MenuCuenta usuario={usuario} />
        ) : (
          <EnlaceEntrar className="ds-btn ds-btn--subtle app-entrar" />
        )}
      </div>
      {CAMPANA && (
      <div ref={panel} className="app-notifs" id="notifs" hidden={!notifs}>
        <div className="app-notifs__head">
          <h3>Notificaciones</h3>
        </div>
        {atiende && pendientes.items.length > 0 && (
          <>
            <p className="app-notifs__grupo">Solicitudes nuevas por atender · {pendientes.total}</p>
            <ul className="app-notifs__lista">
              {pendientes.items.map((n) => (
                <li key={'p' + n.id}>
                  <Link to={enBandeja(n.id)} onClick={() => setNotifs(false)}>
                    <b>Nueva solicitud · {n.folio}</b>
                    <span>
                      {n.formulario} · {n.solicitante}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="app-notifs__pie">
              <Link to={enBandeja()} onClick={() => setNotifs(false)}>
                Ir a la bandeja de solicitudes →
              </Link>
            </p>
          </>
        )}
        {atiende && pendientes.items.length > 0 && nuevas?.length ? <p className="app-notifs__grupo">Respuestas a tus solicitudes</p> : null}
        {usuario && nuevas?.length ? (
          <ul className="app-notifs__lista">
            {nuevas.map((s) => (
              <li key={s.id}>
                <Link to={'/mis-solicitudes/' + s.id} onClick={() => setNotifs(false)}>
                  <b>Nueva respuesta · {s.folio}</b>
                  <span>{s.formulario}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : atiende && pendientes.items.length > 0 ? null : (
          <div className="empty-state empty-state--sm">
            <b>Sin notificaciones</b>
            <p>{!usuario ? 'Inicia sesión para ver las respuestas a tus solicitudes.' : atiende ? 'Aquí aparecen las solicitudes nuevas por atender y las respuestas a las tuyas.' : 'Cuando respondan una de tus solicitudes, aparece aquí.'}</p>
          </div>
        )}
        {usuario && (
          <p className="app-notifs__pie">
            <Link to="/mis-solicitudes" onClick={() => setNotifs(false)}>
              Ver todas mis solicitudes →
            </Link>
          </p>
        )}
      </div>
      )}
    </header>
  )
}
