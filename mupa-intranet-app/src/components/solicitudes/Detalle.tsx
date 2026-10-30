/**
 * Una solicitud: lo que se pidió y su línea de tiempo (creada, cambios de estado
 * y respuestas del Gestor). Lo usan "Mis solicitudes" y la bandeja del Gestor.
 */
import React from 'react'

import { estadoDe, type SolicitudDetalle } from '../../lib/solicitudes'
import { fechaHora } from '../../paginas/gestion/comun'

export function Estado({ v }: { v: string }) {
  const e = estadoDe(v)
  return <span className={'tagline' + (e.tono ? ' tagline--' + e.tono : '')}>{e.t}</span>
}

export function DetalleSolicitud({ s, controles }: { s: SolicitudDetalle; controles?: React.ReactNode }) {
  return (
    <div className="sol-detalle">
      <div className="sol-cabecera">
        <div>
          <p className="ds-overline">
            {s.folio} · {s.area}
          </p>
          <h2>{s.formulario}</h2>
          <p className="ds-body-sm">
            Enviada el {fechaHora(s.creada)} por {s.persona}
            {s.correo ? ' (' + s.correo + ')' : ''}
            {s.departamento ? ' · ' + s.departamento : ''}
          </p>
        </div>
        <Estado v={s.estado} />
      </div>

      {controles}

      <section aria-labelledby="sol-historia">
        <h3 id="sol-historia">Seguimiento</h3>
        <ol className="sol-eventos">
          {s.eventos.map((e) => (
            <li key={e.id} className={'sol-evento' + (e.tipo === 'mensaje' ? ' sol-evento--mensaje' : '')}>
              <p className="sol-evento__meta">
                <b>{e.tipo === 'creada' ? 'Enviada' : e.tipo === 'estado' ? 'Cambió a «' + estadoDe(e.estado || '').t + '»' : 'Respuesta' + (e.autor ? ' de ' + e.autor : '')}</b> · {fechaHora(e.fecha)}
              </p>
              {e.texto && <p className="sol-evento__texto">{e.texto}</p>}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="sol-datos">
        <h3 id="sol-datos">Lo que se pidió</h3>
        <div className="f-review">
          {s.resumen.map((sec) => (
            <React.Fragment key={sec.titulo}>
              <h4>{sec.titulo}</h4>
              <dl>
                {sec.filas.map((x) => (
                  <div key={x.dt}>
                    <dt>{x.dt}</dt>
                    <dd style={{ whiteSpace: 'pre-line' }}>{x.dd}</dd>
                  </div>
                ))}
              </dl>
            </React.Fragment>
          ))}
        </div>
      </section>
    </div>
  )
}
