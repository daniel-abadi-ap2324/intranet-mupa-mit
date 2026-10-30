/** Mis solicitudes (/mis-solicitudes): las que envió la persona, su estado y las respuestas del Gestor. */
import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { api, ErrorApi } from '../api'
import { DetalleSolicitud, Estado } from '../components/solicitudes/Detalle'
import { SinLlave } from '../components/SinLlave'
import { Aviso, CabeceraPagina, Chips, EnlaceEntrar } from '../components/ui'
import { useDatos } from '../datos'
import { citaAbierta, claseEstadoCita, estadoCita, horaCita, tituloCita, type CitaClinica } from '../lib/clinica'
import { claseEstadoCodigo, codigoAbierto, diaDe, horaDe, textoAccion, tituloCodigo, type SolicitudCodigo } from '../lib/codigosLlamada'
import { activa } from '../lib/edicion'
import { fechaLarga } from '../lib/fechas'
import { claseEstadoTicket, diaTicket, estadoTicket, horaTicket, ticketAbierto, type TicketGlpi } from '../lib/glpi'
import { abierta, type SolicitudDetalle, type SolicitudMia } from '../lib/solicitudes'
import { useFiltroUrl } from '../lib/useFiltroUrl'
import { fechaHora } from './gestion/comun'

function ConSesion({ children }: { children: React.ReactNode }) {
  const { usuario } = useDatos()
  if (!usuario)
    return (
      <Aviso>
        Inicia sesión para ver tus solicitudes. <EnlaceEntrar />
      </Aviso>
    )
  return <>{children}</>
}

export function PaginaMisSolicitudes() {
  return (
    <>
      <CabeceraPagina
        titulo="Mis solicitudes"
        intro={
          activa('formularios')
            ? 'Las solicitudes que enviaste con los formularios de la intranet, tus citas de la Clínica, tus códigos de llamada y tus tickets de la Mesa de Ayuda: en qué estado están y qué te respondieron.'
            : 'Tus citas de la Clínica, tus códigos de llamada y tus tickets de la Mesa de Ayuda: en qué estado están.'
        }
      />
      <ConSesion>
        <Lista />
      </ConSesion>
    </>
  )
}

type Filtro = 'abiertas' | 'cerradas' | 'todas'

const SISTEMAS = ['las citas de la Clínica', 'los códigos de llamada', 'los tickets de la Mesa de Ayuda (GLPI)']
/** Siempre en el mismo orden, sin importar cuál respondió primero. */
const ordenar = (xs: string[]) => SISTEMAS.filter((s) => xs.includes(s))
/** «a, b y c». */
const enFrase = (xs: string[]) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1])

/** YYYY-MM-DD de hoy en hora de Panamá. */
const hoyPanama = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Panama' })

function Lista() {
  const [lista, setLista] = useState<SolicitudMia[] | null>(null)
  // Las citas de la Clínica (por la cédula de la sesión): si no hay conexión con la Clínica o no se conoce la cédula, no salen.
  const [citas, setCitas] = useState<CitaClinica[]>([])
  const [errorCitas, setErrorCitas] = useState('')
  // Las solicitudes de código de llamada (por la cédula de la sesión): igual, si no hay conexión o no se conoce la cédula, no salen.
  const [codigos, setCodigos] = useState<SolicitudCodigo[]>([])
  const [errorCodigos, setErrorCodigos] = useState('')
  // Los tickets de la Mesa de Ayuda (GLPI): GLPI encuentra a la persona por su cédula en el campo «Teléfono» de su usuario.
  // null = GLPI no está conectado o no se conoce la cédula (no se dice nada).
  const [glpi, setGlpi] = useState<{ encontrado: boolean; tickets: TicketGlpi[] } | null>(null)
  const [errorTickets, setErrorTickets] = useState('')
  const [error, setError] = useState('')
  // Los sistemas que no están conectados en esta instalación (sin su llave): se dicen en un aviso.
  const [sinConexion, setSinConexion] = useState<string[]>([])
  const noConectado = (s: string) => setSinConexion((xs) => (xs.includes(s) ? xs : [...xs, s]))
  const [f, cambiar] = useFiltroUrl({ ver: 'todas' })
  useEffect(() => {
    // Las solicitudes internas (formularios de la intranet) solo existen si la edición las tiene: si no, la ruta no existe en la API.
    if (!activa('formularios')) {
      setLista([])
      return
    }
    api
      .misSolicitudes()
      .then(setLista)
      .catch(() => {
        setError('No se pudieron cargar tus solicitudes. Vuelve a intentarlo en un momento.')
        setLista([])
      })
  }, [])
  useEffect(() => {
    api
      .misCitas()
      .then((c) => {
        if (!c.disponible) noConectado('las citas de la Clínica')
        setCitas(c.disponible && c.cedulaConocida ? c.citas : [])
      })
      .catch((e) => setErrorCitas(e instanceof ErrorApi ? e.message : 'No se pudieron cargar tus citas de la Clínica.'))
  }, [])
  useEffect(() => {
    api
      .misCodigosLlamada()
      .then((c) => {
        if (!c.disponible) noConectado('los códigos de llamada')
        setCodigos(c.disponible && c.cedulaConocida ? c.solicitudes : [])
      })
      .catch((e) => setErrorCodigos(e instanceof ErrorApi ? e.message : 'No se pudieron cargar tus solicitudes de códigos de llamada.'))
  }, [])
  useEffect(() => {
    api
      .misTicketsGlpi()
      .then((t) => {
        if (!t.disponible) noConectado('los tickets de la Mesa de Ayuda (GLPI)')
        setGlpi(t.disponible && t.cedulaConocida ? { encontrado: t.usuarioEncontrado, tickets: t.tickets } : null)
      })
      .catch((e) => setErrorTickets(e instanceof ErrorApi ? e.message : 'No se pudieron cargar tus tickets de la Mesa de Ayuda.'))
  }, [])
  const ver = (['abiertas', 'cerradas', 'todas'].includes(f.ver) ? f.ver : 'todas') as Filtro
  const hoy = hoyPanama()
  const de = (v: Filtro) => (lista ?? []).filter((s) => v === 'todas' || (v === 'abiertas') === abierta(s.estado))
  const deCitas = (v: Filtro) => citas.filter((c) => v === 'todas' || (v === 'abiertas') === citaAbierta(c, hoy))
  const filas = de(ver)
  const filasCitas = deCitas(ver).sort((a, b) => (a.fecha + (a.hora ?? '')).localeCompare(b.fecha + (b.hora ?? '')) * (ver === 'cerradas' ? -1 : 1))
  // Ya vienen de la más reciente a la más antigua.
  const deCodigos = (v: Filtro) => codigos.filter((s) => v === 'todas' || (v === 'abiertas') === codigoAbierto(s))
  const filasCodigos = deCodigos(ver)
  const tickets = glpi?.tickets ?? []
  const deTickets = (v: Filtro) => tickets.filter((t) => v === 'todas' || (v === 'abiertas') === ticketAbierto(t))
  const filasTickets = deTickets(ver)
  const cuantas = (v: Filtro) => de(v).length + deCitas(v).length + deCodigos(v).length + deTickets(v).length

  return (
    <>
      <div className="toolbar">
        <Chips<Filtro>
          etiqueta="Filtrar solicitudes"
          opciones={[
            { v: 'todas', t: 'Todas', n: cuantas('todas') },
            { v: 'abiertas', t: 'Abiertas', n: cuantas('abiertas') },
            { v: 'cerradas', t: 'Cerradas', n: cuantas('cerradas') },
          ]}
          valor={ver}
          onCambio={(v) => cambiar({ ver: v })}
        />
        {activa('formularios') && (
          <Link className="ds-btn ds-btn--primary gest-nuevo" to="/formularios">
            <span aria-hidden="true">＋</span> Nueva solicitud
          </Link>
        )}
      </div>
      {error && <Aviso tipo="warn">{error}</Aviso>}
      {sinConexion.length > 0 && <SinLlave que={'Ver aquí ' + enFrase(ordenar(sinConexion))} />}
      {errorCitas && <Aviso tipo="warn">{errorCitas}</Aviso>}
      {errorCodigos && <Aviso tipo="warn">{errorCodigos}</Aviso>}
      {errorTickets && <Aviso tipo="warn">{errorTickets}</Aviso>}
      {glpi && !glpi.encontrado && (
        <Aviso>
          No vemos tus tickets de la Mesa de Ayuda: no encontramos tu cédula en el campo «Teléfono» de tu usuario de GLPI. Pide a la Mesa de Servicios (ext. 1400) que la registre ahí.
        </Aviso>
      )}
      {lista === null ? (
        <p className="count-note" role="status">
          Cargando…
        </p>
      ) : !filas.length && !filasCitas.length && !filasCodigos.length && !filasTickets.length ? (
        <div className="empty-state">
          <b>{lista.length || citas.length || codigos.length || tickets.length ? 'No hay solicitudes en esta vista' : activa('formularios') ? 'Todavía no enviaste solicitudes' : 'Todavía no tienes solicitudes'}</b>
          <p>
            {activa('formularios') ? 'Las solicitudes que envíes con un formulario, tus' : 'Tus'} citas de la Clínica, tus solicitudes de código de llamada y tus tickets de la Mesa de Ayuda aparecen aquí con su estado.
          </p>
        </div>
      ) : (
        <ul className="sol-lista">
          {filas.map((s) => (
            <li key={s.id}>
              <Link className={'sol-item' + (s.sinLeer ? ' is-nueva' : '')} to={'/mis-solicitudes/' + s.id}>
                <span className="tx">
                  <span className="sol-item__folio">{s.folio}</span>
                  <b>{s.formulario}</b>
                  <span>
                    {s.area} · actualizada {fechaHora(s.actualizada)}
                  </span>
                </span>
                {s.sinLeer && <span className="tagline tagline--brand">Nueva respuesta</span>}
                <Estado v={s.estado} />
              </Link>
            </li>
          ))}
          {filasCitas.map((c) => {
            const e = estadoCita(c.estado)
            const hora = horaCita(c.hora)
            return (
              <li key={'cita-' + c.id}>
                <Link className="sol-item sol-item--cita" to="/clinica">
                  <span className="tx">
                    <span className="sol-item__folio">Cita · Clínica</span>
                    <b>{tituloCita(c)}</b>
                    <span>
                      {fechaLarga(c.fecha)}
                      {hora ? ', ' + hora : ''}
                      {c.medico ? ' · ' + c.medico : ''}
                    </span>
                  </span>
                  <span className={'st st--' + claseEstadoCita(c.estado)}>{e.texto}</span>
                </Link>
              </li>
            )
          })}
          {filasCodigos.map((s) => (
            <li key={'codigo-' + s.numero}>
              <FilaCodigo s={s} />
            </li>
          ))}
          {filasTickets.map((t) => (
            <li key={'glpi-' + t.numero}>
              <FilaTicket t={t} />
            </li>
          ))}
        </ul>
      )}
      {glpi?.encontrado && (
        <p className="count-note">
          Los tickets de la Mesa de Ayuda salen solo si tu cédula está registrada en el campo «Teléfono» de tu usuario de GLPI y figuras como solicitante. Si falta alguno, llama a la Mesa de Servicios (ext. 1400).
        </p>
      )}
    </>
  )
}

/** Una solicitud de código de llamada: de solo consulta (la solicitud se hace en su sistema); al abrirla muestra su historial y, si la rechazaron, el motivo. */
function FilaCodigo({ s }: { s: SolicitudCodigo }) {
  const fecha = (f: string) => {
    const hora = horaDe(f) ? horaCita(horaDe(f)) : null
    return fechaLarga(diaDe(f)) + (hora ? ', ' + hora : '')
  }
  return (
    <details className="sol-item sol-item--codigo">
      <summary>
        <span className="tx">
          <span className="sol-item__folio">Código de llamada · N.º {s.numero}</span>
          <b>{tituloCodigo(s)}</b>
          <span>
            {s.ubicacion ? s.ubicacion + ' · ' : ''}actualizada {fecha(s.actualizada)}
          </span>
        </span>
        <span className={'st st--' + claseEstadoCodigo(s.estadoId)}>{s.estado}</span>
      </summary>
      <div className="sol-codigo__detalle">
        {s.motivoRechazo && (
          <p className="sol-codigo__rechazo">
            <b>Motivo del rechazo:</b> {s.motivoRechazo}
          </p>
        )}
        {s.historial.length > 0 && (
          <ol className="sol-eventos" aria-label={'Historial de la solicitud ' + s.numero}>
            {s.historial.map((h, i) => (
              <li key={i}>
                <p className="sol-evento__meta">
                  <b>{textoAccion(h.accion)}</b> · {fecha(h.fecha)}
                </p>
              </li>
            ))}
          </ol>
        )}
        <p className="sol-codigo__nota">Aquí solo se consulta el estado. Por seguridad, el código no se muestra en la intranet.</p>
      </div>
    </details>
  )
}

/** Un ticket de la Mesa de Ayuda (GLPI): de solo consulta (se atiende en GLPI). Nunca se muestra su descripción. */
function FilaTicket({ t }: { t: TicketGlpi }) {
  const hora = horaTicket(t.actualizado) ? horaCita(horaTicket(t.actualizado)) : null
  return (
    <div className="sol-item sol-item--ticket">
      <span className="tx">
        <span className="sol-item__folio">Mesa de Ayuda · Ticket N.º {t.numero}</span>
        <b>{t.titulo}</b>
        <span>
          actualizado {fechaLarga(diaTicket(t.actualizado))}
          {hora ? ', ' + hora : ''}
        </span>
      </span>
      <span className={'st st--' + claseEstadoTicket(t.estadoId)}>{estadoTicket(t.estadoId)}</span>
    </div>
  )
}

export function PaginaMiSolicitud() {
  const { id } = useParams()
  const [s, setS] = useState<SolicitudDetalle | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api
      .solicitud(Number(id))
      .then((x) => {
        setS(x)
        // Al abrirla queda leída: se vuelve a pedir el resumen (la campana).
        window.dispatchEvent(new Event('mupa:solicitudes'))
      })
      .catch((e) => setError(e instanceof ErrorApi && e.estado === 404 ? 'Esa solicitud no existe o no es tuya.' : 'No se pudo cargar la solicitud.'))
  }, [id])
  return (
    <>
      <CabeceraPagina titulo={s ? 'Solicitud ' + s.folio : 'Solicitud'} miga={s?.folio ?? 'Solicitud'} padres={[{ t: 'Mis solicitudes', h: '/mis-solicitudes' }]} />
      <ConSesion>
        {error ? (
          <Aviso tipo="warn">{error}</Aviso>
        ) : !s ? (
          <p className="count-note" role="status">
            Cargando…
          </p>
        ) : (
          <DetalleSolicitud s={s} />
        )}
      </ConSesion>
    </>
  )
}
