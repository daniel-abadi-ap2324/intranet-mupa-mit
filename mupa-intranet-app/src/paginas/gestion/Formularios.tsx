/**
 * Gestor de Solicitudes (/gestion/formularios): los formularios de la intranet.
 * Se editan en su propia pantalla (/gestion/formularios/:id), con el constructor.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'

import { api, type FormularioGestion } from '../../api'
import { useSitio } from '../../components/Proveedores'
import { Aviso, Dialogo } from '../../components/ui'
import { useDatos } from '../../datos'
import { fechaHora, mensaje, PaginaGestion } from './comun'

export function PaginaGestionFormularios() {
  return (
    <PaginaGestion
      titulo="Formularios"
      miga="Formularios"
      intro="Los formularios de solicitud. Mientras un formulario no «recibe solicitudes», el envío es de prueba; préndelo cuando su área lo apruebe."
      roles={['admin', 'gestorSolicitudes']}
      quien="el Gestor de Solicitudes"
    >
      <Lista />
    </PaginaGestion>
  )
}

function Lista() {
  const { avisar } = useSitio()
  const { recargar } = useDatos()
  const [lista, setLista] = useState<FormularioGestion[] | null>(null)
  const [error, setError] = useState('')
  const [borrando, setBorrando] = useState<FormularioGestion | null>(null)

  const cargar = useCallback(async () => {
    try {
      setLista(await api.formulariosGestion())
      setError('')
    } catch (e) {
      setError(mensaje(e))
      setLista((l) => l ?? [])
    }
  }, [])
  useEffect(() => {
    cargar()
  }, [cargar])

  const eliminar = async (f: FormularioGestion) => {
    setBorrando(null)
    try {
      await api.borrarFormulario(f.dbId)
      await cargar()
      await recargar()
      avisar('Formulario eliminado')
      document.querySelector<HTMLElement>('.gest-nuevo')?.focus()
    } catch (e) {
      avisar(mensaje(e))
    }
  }

  return (
    <>
      <div className="toolbar">
        <span className="count-note">{lista ? `${lista.length} formularios` : ''}</span>
        <Link className="ds-btn ds-btn--primary gest-nuevo" to="/gestion/formularios/nuevo">
          <span aria-hidden="true">＋</span> Nuevo formulario
        </Link>
      </div>
      {error && <Aviso tipo="warn">{error}</Aviso>}
      {lista === null ? (
        <p className="count-note" role="status">
          Cargando formularios…
        </p>
      ) : !lista.length ? (
        <p className="empty show">Todavía no hay formularios.</p>
      ) : (
        <div className="table-wrap">
          <table className="ds-table gest-tabla">
            <thead>
              <tr>
                <th scope="col">Formulario</th>
                <th scope="col">Área</th>
                <th scope="col">Solicitudes</th>
                <th scope="col">Estado</th>
                <th scope="col">Última edición</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((f) => (
                <tr key={f.dbId}>
                  <td>
                    <b>{f.title}</b>
                    <span className="gest-det">Form. {f.id}</span>
                  </td>
                  <td data-t="Área">{f.area}</td>
                  <td data-t="Solicitudes">
                    <span className={'tagline' + (f.recibe ? ' tagline--ok' : ' tagline--warn')}>{f.recibe ? 'Recibe' : f.aDefinir ? 'A definir con RRHH' : 'De prueba'}</span>
                  </td>
                  <td data-t="Estado">{f.publicado ? 'Publicado' : 'Oculto'}</td>
                  <td data-t="Editado">
                    {fechaHora(f.editado)}
                    {f.editadoPor && <span className="gest-det">{f.editadoPor}</span>}
                  </td>
                  <td className="gest-acts">
                    <div className="gest-acciones">
                      <Link className="ds-btn ds-btn--ghost" to={'/gestion/formularios/' + f.dbId} aria-label={'Editar «' + f.title + '»'}>
                        Editar
                      </Link>
                      {f.publicado && (
                        <Link className="ds-btn ds-btn--ghost" to={'/formularios/' + f.slug} aria-label={'Ver «' + f.title + '»'}>
                          Ver
                        </Link>
                      )}
                      <button type="button" className="ds-btn ds-btn--ghost gest-borrar" onClick={() => setBorrando(f)} aria-label={'Eliminar «' + f.title + '»'}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {borrando && (
        <Dialogo
          id="frmBorrar"
          titulo="Eliminar formulario"
          onCerrar={() => setBorrando(null)}
          pie={
            <div className="home-dlg__foot">
              <button type="button" className="ds-btn ds-btn--ghost" data-foco onClick={() => setBorrando(null)}>
                Cancelar
              </button>
              <button type="button" className="ds-btn ds-btn--primary gest-borrar--si" onClick={() => eliminar(borrando)}>
                Eliminar
              </button>
            </div>
          }
        >
          <div className="home-dlg__body">
            <p className="ds-body">Se borra «{borrando.title}». Si ya recibió solicitudes no se puede borrar: ocúltalo desde su edición.</p>
          </div>
        </Dialogo>
      )}
    </>
  )
}
