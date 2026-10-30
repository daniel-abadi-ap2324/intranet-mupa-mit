/**
 * «Tu día»: lo que la persona tiene hoy, en tarjetas pequeñas (solicitudes abiertas, próxima cita, gestión y último
 * boletín). Va solo en el Inicio: en una columna a la derecha (≥1280 px) o, en pantallas angostas, dentro de la página
 * (`enLinea`). No hace consultas: recibe las del Inicio (paginas/PaginaInicio.tsx), que las pide una sola vez (los
 * sistemas de la Clínica, los códigos y la Mesa de Ayuda limitan las consultas seguidas). Lo que no está conectado no se
 * muestra y lo que falló lo dice; nada se inventa.
 */
import React from 'react'
import { Link } from 'react-router'

import type { Boletin } from '../../lib/contenido'
import { activa } from '../../lib/edicion'
import { diaLargo, hoyIso, mayuscula, mesCorto } from '../../lib/fechas'
import { duracion } from '../../lib/gestion'
import { horaCita } from '../../lib/clinica'
import type { SolicitudMia } from '../../lib/solicitudes'
import type { SolicitudCodigo } from '../../lib/codigosLlamada'
import type { TicketGlpi } from '../../lib/glpi'
import type { CitaClinica } from '../../lib/clinica'
import { abiertasDeLaPersona, fechaDeHoy, nombreCita, proximaCita, textoAbiertas, type Fuente } from '../../lib/tuDia'
import { Icono } from '../shell/Iconos'
import { EnlaceEntrar } from '../ui'

type Props = {
  enLinea: boolean
  usuario: boolean
  boletin: Boletin | null
  solicitudes: Fuente<SolicitudMia[]>
  tickets: Fuente<TicketGlpi[]>
  codigos: Fuente<SolicitudCodigo[]>
  citas: Fuente<CitaClinica[]>
  gestion: { abiertas: number; atrasadas: number; primeraH: number | null } | null
}

export function TuDia({ enLinea, usuario, boletin, solicitudes, tickets, codigos, citas, gestion }: Props) {
  const hoy = hoyIso(new Date())
  const a = abiertasDeLaPersona({ solicitudes, tickets, codigos })
  const aviso = textoAbiertas(a)
  const cita = citas.estado === 'ok' ? proximaCita(citas.datos, hoy) : null

  return (
    <aside className={'dia' + (enLinea ? ' dia--linea' : '')} aria-labelledby="dia-t" data-testid="tu-dia">
      <header className="dia__head">
        <h2 id="dia-t">Tu día</h2>
        <p>{fechaDeHoy(hoy)}</p>
      </header>

      {!usuario ? (
        // Sin sesión: la misma tarjeta que las demás (ícono y título) para que el aviso sea lo secundario, no lo principal.
        <section className="dia__card" aria-labelledby="dia-anon">
          <div className="dia__fila">
            <span className="dia__ic" aria-hidden="true">
              <Icono nombre="bandeja" />
            </span>
            <h3 id="dia-anon">Solicitudes y citas</h3>
          </div>
          <p className="dia__vacio">
            <EnlaceEntrar>Inicia sesión</EnlaceEntrar> para ver aquí tus solicitudes abiertas y tu próxima cita.
          </p>
        </section>
      ) : (
        <>
          {a.conectada && (
            <section className="dia__card" aria-labelledby="dia-sol">
              <div className="dia__fila">
                <span className="dia__ic" aria-hidden="true">
                  <Icono nombre="bandeja" />
                </span>
                <h3 id="dia-sol">Solicitudes abiertas</h3>
                <span className={'dia__n' + (a.total ? ' is-on' : '')} aria-label={a.cargando ? 'Cargando' : a.incompleto && !a.total ? 'Sin datos' : a.total + (a.total === 1 ? ' abierta' : ' abiertas')}>
                  {a.cargando && !a.total ? '…' : a.incompleto && !a.total ? '—' : a.total}
                </span>
              </div>
              {a.items.length > 0 && (
                <ul className="dia__lista">
                  {a.items.map((s) => (
                    <li key={s.clave}>
                      <Link to={s.h}>
                        <b>{s.titulo}</b>
                        <span>
                          {s.meta}
                          {s.nueva ? ' · respuesta nueva' : ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {aviso && <p className="dia__vacio">{aviso}</p>}
              <Link className="dia__mas" to="/mis-solicitudes">
                Ver mis solicitudes
              </Link>
            </section>
          )}

          {citas.estado === 'ok' && (
            <section className="dia__card" aria-labelledby="dia-cita">
              <div className="dia__fila">
                <span className="dia__ic dia__ic--cita" aria-hidden="true">
                  <Icono nombre="calendario" />
                </span>
                <h3 id="dia-cita">Próxima cita</h3>
              </div>
              {cita ? (
                <Link className="dia__cita" to="/clinica">
                  <span className="dia__fecha" aria-hidden="true">
                    <b>{Number(cita.fecha.slice(8, 10))}</b>
                    <span>{mesCorto(cita.fecha)}</span>
                  </span>
                  <span className="dia__cita-tx">
                    <b>{nombreCita(cita)}</b>
                    <span>
                      {mayuscula(diaLargo(cita.fecha))}
                      {horaCita(cita.hora) ? ', ' + horaCita(cita.hora) : ''}
                    </span>
                  </span>
                </Link>
              ) : (
                <p className="dia__vacio">Sin citas agendadas en la Clínica.</p>
              )}
            </section>
          )}
          {citas.estado === 'error' && (
            <section className="dia__card" aria-labelledby="dia-cita">
              <div className="dia__fila">
                <span className="dia__ic dia__ic--cita" aria-hidden="true">
                  <Icono nombre="calendario" />
                </span>
                <h3 id="dia-cita">Próxima cita</h3>
              </div>
              <p className="dia__vacio">No se pudo consultar ahora.</p>
            </section>
          )}

          {gestion && activa('bandeja') && (
            <section className="dia__card" aria-labelledby="dia-gest">
              <div className="dia__fila">
                <span className="dia__ic dia__ic--gest" aria-hidden="true">
                  <Icono nombre="panel" />
                </span>
                <h3 id="dia-gest">Gestión</h3>
              </div>
              <dl className="dia__cifras">
                <div>
                  <dt>Abiertas</dt>
                  <dd>{gestion.abiertas}</dd>
                </div>
                <div className={gestion.atrasadas ? 'is-alerta' : ''}>
                  <dt>Atrasadas</dt>
                  <dd>{gestion.atrasadas}</dd>
                </div>
                <div>
                  <dt>1.ª respuesta</dt>
                  <dd>{duracion(gestion.primeraH)}</dd>
                </div>
              </dl>
            </section>
          )}
        </>
      )}

      {boletin && (
        <section className="dia__card" aria-labelledby="dia-bol">
          <div className="dia__fila">
            <span className="dia__ic dia__ic--bol" aria-hidden="true">
              <Icono nombre="noticias" />
            </span>
            <h3 id="dia-bol">Último boletín</h3>
          </div>
          <Link className="dia__bol" to={'/boletines/' + boletin.id}>
            {boletin.portada && <img src={boletin.portada} alt="" loading="lazy" />}
            <span className="dia__bol-tx">
              <b>Alcaldía al día</b>
              <span>{mayuscula(diaLargo(boletin.fecha))}</span>
            </span>
          </Link>
        </section>
      )}
    </aside>
  )
}
