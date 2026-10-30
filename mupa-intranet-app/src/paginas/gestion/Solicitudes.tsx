/**
 * Gestor de Solicitudes (/gestion/solicitudes): la bandeja de todas las
 * solicitudes, con filtros, y el detalle (/gestion/solicitudes/:id) para cambiar
 * el estado y responderle a la persona. La respuesta le llega en "Mis solicitudes".
 */
import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { api, type FormularioGestion } from '../../api'
import { ControlesSolicitud, useBandeja, useSolicitud } from '../../components/gestion/Atender'
import { DetalleSolicitud, Estado } from '../../components/solicitudes/Detalle'
import { Aviso, CampoBusqueda, Chips } from '../../components/ui'
import { ATIENDEN_SOLICITUDES } from '../../lib/gestion'
import { ESTADOS_SOLICITUD } from '../../lib/solicitudes'
import { useFiltroUrl } from '../../lib/useFiltroUrl'
import { fechaHora, PaginaGestion } from './comun'

export function PaginaGestionSolicitudes() {
  return (
    <PaginaGestion
      titulo="Solicitudes"
      miga="Solicitudes"
      intro="Todas las solicitudes que llegaron por los formularios. Ábrelas para cambiar su estado y responderle a la persona."
      roles={ATIENDEN_SOLICITUDES}
      quien="quien atiende las solicitudes"
    >
      <Bandeja />
    </PaginaGestion>
  )
}

function Bandeja() {
  const [f, cambiar] = useFiltroUrl({ estado: 'recibida', formulario: '', q: '' })
  const { lista, error } = useBandeja(f)
  const [formularios, setFormularios] = useState<FormularioGestion[]>([])

  useEffect(() => {
    api
      .formulariosGestion()
      .then((L) => setFormularios(L.filter((x) => x.recibe || x.requests > 0)))
      .catch(() => setFormularios([]))
  }, [])

  return (
    <>
      <div className="toolbar">
        <Chips
          etiqueta="Estado"
          opciones={[{ v: 'todas', t: 'Todas' }, ...ESTADOS_SOLICITUD.map((e) => ({ v: e.v, t: e.t }))]}
          valor={f.estado}
          onCambio={(estado) => cambiar({ estado })}
        />
      </div>
      <div className="toolbar">
        <CampoBusqueda valor={f.q} onCambio={(q) => cambiar({ q })} etiqueta="Buscar solicitud" placeholder="Folio, persona o formulario…" />
        <label className="gest-select">
          <span>Formulario</span>
          <select className="ds-input" value={f.formulario} onChange={(e) => cambiar({ formulario: e.target.value })}>
            <option value="">Todos</option>
            {formularios.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
        {lista && <span className="count-note">{lista.length === 1 ? '1 solicitud' : lista.length + ' solicitudes'}</span>}
      </div>
      {!formularios.some((x) => x.recibe) && (
        <Aviso>
          Ningún formulario recibe solicitudes todavía. Préndelo en <Link to="/gestion/formularios">Formularios</Link> cuando su área lo apruebe.
        </Aviso>
      )}
      {error && <Aviso tipo="warn">{error}</Aviso>}

      {lista === null ? (
        <p className="count-note" role="status">
          Cargando…
        </p>
      ) : !lista.length ? (
        <p className="empty show">No hay solicitudes con esos filtros.</p>
      ) : (
        <div className="table-wrap">
          <table className="ds-table gest-tabla">
            <thead>
              <tr>
                <th scope="col">Solicitud</th>
                <th scope="col">Persona</th>
                <th scope="col">Enviada</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.formulario}</b>
                    <span className="gest-det">{s.folio}</span>
                  </td>
                  <td data-t="Persona">
                    {s.persona}
                    <span className="gest-det">{[s.departamento, s.correo].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td data-t="Enviada">{fechaHora(s.creada)}</td>
                  <td data-t="Estado">
                    <Estado v={s.estado} />
                  </td>
                  <td className="gest-acts">
                    <div className="gest-acciones">
                      <Link className="ds-btn ds-btn--ghost" to={'/gestion/solicitudes/' + s.id} aria-label={'Abrir ' + s.folio}>
                        Abrir
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export function PaginaGestionSolicitud() {
  const { id } = useParams()
  return (
    <PaginaGestion titulo="Solicitud" miga="Solicitud" intro="Cambia el estado y responde: la persona lo ve en «Mis solicitudes»." roles={ATIENDEN_SOLICITUDES} quien="quien atiende las solicitudes">
      <Atender id={Number(id)} />
    </PaginaGestion>
  )
}

function Atender({ id }: { id: number }) {
  const { s, setS, error } = useSolicitud(id)
  if (error) return <Aviso tipo="warn">{error}</Aviso>
  if (!s)
    return (
      <p className="count-note" role="status">
        Cargando…
      </p>
    )
  return (
    <>
      <p>
        <Link to="/gestion/solicitudes">← Volver a la bandeja</Link>
      </p>
      <DetalleSolicitud s={s} controles={<ControlesSolicitud s={s} onCambio={setS} />} />
    </>
  )
}
