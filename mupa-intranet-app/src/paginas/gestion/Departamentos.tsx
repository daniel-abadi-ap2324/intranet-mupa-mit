/**
 * Administración (/gestion/departamentos): los departamentos de la Alcaldía. Se
 * asignan a cada persona en /gestion/usuarios y deciden qué aplicaciones ve.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { api, type Departamento } from '../../api'
import { useSitio } from '../../components/Proveedores'
import { Aviso, CampoBusqueda, Dialogo } from '../../components/ui'
import { norm } from '../../lib/catalogo'
import { mensaje, PaginaGestion } from './comun'

export function PaginaGestionDepartamentos() {
  return (
    <PaginaGestion
      titulo="Departamentos"
      miga="Departamentos"
      intro="Las direcciones de la Alcaldía. A cada persona se le asigna una en «Usuarios», y cada aplicación del catálogo se puede limitar a ciertos departamentos."
      roles={['admin']}
      quien="administración"
    >
      <Gestion />
    </PaginaGestion>
  )
}

function Gestion() {
  const { avisar } = useSitio()
  const [lista, setLista] = useState<Departamento[] | null>(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [q, setQ] = useState('')
  // undefined = cerrado; null = uno nuevo.
  const [editando, setEditando] = useState<Departamento | null | undefined>(undefined)
  const [borrando, setBorrando] = useState<Departamento | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setLista(await api.departamentos())
      setErrorCarga('')
    } catch (e) {
      setErrorCarga(mensaje(e))
      setLista((l) => l ?? [])
    }
  }, [])
  useEffect(() => {
    cargar()
  }, [cargar])

  const visibles = (lista ?? []).filter((d) => !q.trim() || norm(d.name).includes(norm(q.trim())))

  const eliminar = async (d: Departamento) => {
    setOcupado(true)
    try {
      await api.borrarDepartamento(d.id)
      setBorrando(null)
      await cargar()
      document.querySelector<HTMLElement>('.gest-nuevo')?.focus()
      avisar('Departamento eliminado')
    } catch (e) {
      setBorrando(null)
      avisar(mensaje(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <div className="toolbar">
        <CampoBusqueda valor={q} onCambio={setQ} etiqueta="Buscar departamento" placeholder="Buscar departamento…" />
        <button type="button" className="ds-btn ds-btn--primary gest-nuevo" onClick={() => setEditando(null)}>
          <span aria-hidden="true">＋</span> Nuevo departamento
        </button>
      </div>

      {errorCarga && <Aviso tipo="warn">{errorCarga}</Aviso>}

      {lista === null ? (
        <p className="count-note" role="status">Cargando departamentos…</p>
      ) : !visibles.length ? (
        <p className="empty show">{lista.length ? 'Ningún departamento coincide con la búsqueda.' : 'Todavía no hay departamentos.'}</p>
      ) : (
        <div className="table-wrap">
          <table className="ds-table gest-tabla">
            <thead>
              <tr>
                <th scope="col">Departamento</th>
                <th scope="col">Personas</th>
                <th scope="col">Aplicaciones</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((d) => (
                <tr key={d.id}>
                  <td>
                    <b>{d.name}</b>
                  </td>
                  <td data-t="Personas">
                    {d.users ? <Link to={'/gestion/usuarios?departamento=' + d.id}>{d.users}</Link> : 0}
                  </td>
                  <td data-t="Apps">
                    {d.applications ? <Link to={'/gestion/aplicaciones?visible=' + d.id}>{d.applications} restringida(s)</Link> : '—'}
                  </td>
                  <td className="gest-acts">
                    <div className="gest-acciones">
                      <button type="button" className="ds-btn ds-btn--ghost" disabled={ocupado} onClick={() => setEditando(d)} aria-label={'Renombrar «' + d.name + '»'}>
                        Renombrar
                      </button>
                      <button type="button" className="ds-btn ds-btn--ghost gest-borrar" disabled={ocupado} onClick={() => setBorrando(d)} aria-label={'Eliminar «' + d.name + '»'}>
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

      {editando !== undefined && (
        <Editor
          dep={editando}
          onCerrar={() => setEditando(undefined)}
          onGuardado={async (d) => {
            setEditando(undefined)
            await cargar()
            avisar(editando ? 'Departamento renombrado' : '«' + d.name + '» creado')
          }}
        />
      )}

      {borrando && (
        <Dialogo
          id="depBorrar"
          titulo="Eliminar departamento"
          onCerrar={() => setBorrando(null)}
          pie={
            <div className="home-dlg__foot">
              <button type="button" className="ds-btn ds-btn--ghost" data-foco onClick={() => setBorrando(null)}>
                Cancelar
              </button>
              <button type="button" className="ds-btn ds-btn--primary gest-borrar--si" disabled={ocupado} onClick={() => eliminar(borrando)}>
                Eliminar
              </button>
            </div>
          }
        >
          <div className="home-dlg__body">
            <p className="ds-body">
              Se elimina «{borrando.name}». Solo se puede si no tiene personas ni aplicaciones asignadas
              {borrando.users || borrando.applications ? ` (hoy tiene ${borrando.users} persona(s) y ${borrando.applications} aplicación(es))` : ''}.
            </p>
          </div>
        </Dialogo>
      )}
    </>
  )
}

function Editor({ dep, onCerrar, onGuardado }: { dep: Departamento | null; onCerrar: () => void; onGuardado: (d: Departamento) => void }) {
  const [nombre, setNombre] = useState(dep?.name ?? '')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const campo = useRef<HTMLInputElement>(null)

  const guardar = async () => {
    if (!nombre.trim()) {
      setError('Escribe el nombre del departamento.')
      campo.current?.focus()
      return
    }
    setEnviando(true)
    try {
      onGuardado(dep ? await api.renombrarDepartamento(dep.id, nombre.trim()) : await api.crearDepartamento(nombre.trim()))
    } catch (e) {
      setError(mensaje(e))
      campo.current?.focus()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo id="depEditor" titulo={dep ? 'Renombrar departamento' : 'Nuevo departamento'} onCerrar={onCerrar}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          guardar()
        }}
      >
        <div className="home-dlg__body">
          <div className={'f-field' + (error ? ' is-invalid' : '')}>
            <label htmlFor="dep-nombre">Nombre</label>
            <input
              ref={campo}
              id="dep-nombre"
              className="ds-input"
              value={nombre}
              maxLength={80}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'dep-nombre-err' : undefined}
              onChange={(e) => {
                setNombre(e.target.value)
                setError('')
              }}
              placeholder="Ej.: Tecnología"
            />
            {error && (
              <p className="f-err" id="dep-nombre-err">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="home-dlg__foot">
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="ds-btn ds-btn--primary" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}
