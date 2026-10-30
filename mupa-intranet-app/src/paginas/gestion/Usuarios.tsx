/**
 * Administración (/gestion/usuarios): las personas que ya entraron a la intranet
 * y su departamento. El rol no se cambia aquí: viene de Identity Central.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'

import { api, type Departamento, type FichaPersona, type PersonaGestion } from '../../api'
import { useSitio } from '../../components/Proveedores'
import { Aviso, CampoBusqueda, Dialogo } from '../../components/ui'
import { ROL_ETIQUETA, type Rol } from '../../lib/roles'
import { useFiltroUrl } from '../../lib/useFiltroUrl'
import { fechaHora, mensaje, PaginaGestion } from './comun'

export function PaginaGestionUsuarios() {
  return (
    <PaginaGestion
      titulo="Usuarios"
      miga="Usuarios"
      intro="Las personas que ya entraron alguna vez a la intranet. Asígnale a cada una su departamento: de eso depende qué aplicaciones ve."
      roles={['admin']}
      quien="administración"
    >
      <Gestion />
    </PaginaGestion>
  )
}

const SIN = 'sin'
const nombreDe = (p: PersonaGestion) => [p.firstName, p.lastName].filter(Boolean).join(' ')

function Gestion() {
  const { avisar } = useSitio()
  const [f, cambiar] = useFiltroUrl({ q: '', departamento: '' })
  const [lista, setLista] = useState<PersonaGestion[] | null>(null)
  const [deps, setDeps] = useState<Departamento[]>([])
  const [errorCarga, setErrorCarga] = useState('')
  const [editando, setEditando] = useState<PersonaGestion | null>(null)
  const [viendo, setViendo] = useState<PersonaGestion | null>(null)
  const [accion, setAccion] = useState<{ tipo: 'suspender' | 'reactivar' | 'borrar' | 'reiniciar'; persona: PersonaGestion } | null>(null)

  useEffect(() => {
    api
      .departamentos()
      .then(setDeps)
      .catch(() => setDeps([]))
  }, [])

  const cargar = useCallback(async () => {
    try {
      const departamento = f.departamento && f.departamento !== SIN ? Number(f.departamento) : undefined
      setLista(await api.personas({ q: f.q, departamento, sinDepartamento: f.departamento === SIN }))
      setErrorCarga('')
    } catch (e) {
      setErrorCarga(mensaje(e))
      setLista((l) => l ?? [])
    }
  }, [f.q, f.departamento])
  useEffect(() => {
    // Espera un momento mientras se escribe en la búsqueda.
    const t = setTimeout(cargar, 250)
    return () => clearTimeout(t)
  }, [cargar])

  return (
    <>
      <div className="toolbar">
        <CampoBusqueda valor={f.q} onCambio={(q) => cambiar({ q })} etiqueta="Buscar persona" placeholder="Buscar por nombre, correo o cédula…" />
        <label className="gest-select">
          <span>Departamento</span>
          <select className="ds-input" value={f.departamento} onChange={(e) => cambiar({ departamento: e.target.value })}>
            <option value="">Todos</option>
            <option value={SIN}>Sin departamento</option>
            {deps.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        {lista && (
          <span className="count-note" aria-live="polite">
            {lista.length} {lista.length === 1 ? 'persona' : 'personas'}
          </span>
        )}
      </div>

      <Aviso>
        Una persona aparece aquí después de su primer ingreso a la intranet. Los roles (Administración, Comunicación, Gestor de Solicitudes) se asignan en Identity
        Central; aquí solo se ven.
      </Aviso>
      {!deps.length && (
        <Aviso tipo="warn">
          No hay departamentos. Créalos en <Link to="/gestion/departamentos">Departamentos</Link>.
        </Aviso>
      )}
      {errorCarga && <Aviso tipo="warn">{errorCarga}</Aviso>}

      {lista === null ? (
        <p className="count-note" role="status">Cargando personas…</p>
      ) : !lista.length ? (
        <p className="empty show">Ninguna persona coincide con los filtros.</p>
      ) : (
        <div className="table-wrap">
          <table className="ds-table gest-tabla">
            <thead>
              <tr>
                <th scope="col">Persona</th>
                <th scope="col">Rol</th>
                <th scope="col">Departamento</th>
                <th scope="col">Último ingreso</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{nombreDe(p)}</b>
                    <span className="gest-det">
                      {p.email ?? 'Sin correo'}
                      {p.source === 'local' ? ' · cuenta de prueba' : ''}
                    </span>
                  </td>
                  <td data-t="Rol">{p.roles.map((r) => ROL_ETIQUETA[r as Rol] ?? r).join(', ')}</td>
                  <td data-t="Depto.">
                    {p.departmentName ?? <span className="tagline tagline--warn">Sin departamento</span>}
                    {p.suspendedAt && <span className="tagline tagline--warn">Suspendida</span>}
                  </td>
                  <td data-t="Ingreso">{fechaHora(p.lastLoginAt)}</td>
                  <td className="gest-acts">
                    <div className="gest-acciones">
                      <button type="button" className="ds-btn ds-btn--ghost" onClick={() => setViendo(p)} aria-label={'Ver la ficha de ' + nombreDe(p)}>
                        Ver ficha
                      </button>
                      <button type="button" className="ds-btn ds-btn--ghost" onClick={() => setEditando(p)} aria-label={'Cambiar el departamento de ' + nombreDe(p)}>
                        Cambiar departamento
                      </button>
                      <button
                        type="button"
                        className="ds-btn ds-btn--ghost"
                        onClick={() => setAccion({ tipo: p.suspendedAt ? 'reactivar' : 'suspender', persona: p })}
                        aria-label={(p.suspendedAt ? 'Reactivar la cuenta de ' : 'Suspender la cuenta de ') + nombreDe(p)}
                      >
                        {p.suspendedAt ? 'Reactivar' : 'Suspender'}
                      </button>
                      {p.source === 'identity' && (
                        <button type="button" className="ds-btn ds-btn--ghost" onClick={() => setAccion({ tipo: 'reiniciar', persona: p })} aria-label={'Reiniciar el perfil de ' + nombreDe(p)}>
                          Reiniciar perfil
                        </button>
                      )}
                      <button type="button" className="ds-btn ds-btn--ghost" onClick={() => setAccion({ tipo: 'borrar', persona: p })} aria-label={'Borrar la cuenta de ' + nombreDe(p)}>
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viendo && <Ficha persona={viendo} onCerrar={() => setViendo(null)} />}
      {editando && (
        <CambiarDepartamento
          persona={editando}
          deps={deps}
          onCerrar={() => setEditando(null)}
          onGuardado={async (p) => {
            setEditando(null)
            await cargar()
            avisar(p.departmentName ? nombreDe(p) + ' ahora es de ' + p.departmentName : nombreDe(p) + ' quedó sin departamento')
          }}
        />
      )}
      {accion && (
        <ConfirmarCuenta
          {...accion}
          onCerrar={() => setAccion(null)}
          onHecho={async (texto) => {
            setAccion(null)
            await cargar()
            avisar(texto)
          }}
        />
      )}
    </>
  )
}

const siNo = (v: boolean | null) => (v === null ? 'No se sabe' : v ? 'Sí' : 'No')

const RRHH_SIN_DATOS = {
  unconfigured: 'La intranet no tiene conexión con RH Link',
  'no-cedula': 'Sin cédula: no se puede consultar',
  'not-found': 'Esa cédula no aparece en RH Link',
  error: 'RH Link no respondió; intenta de nuevo más tarde',
}

function textoRrhh(r: FichaPersona['rrhh']): string {
  if (r.status !== 'found') return RRHH_SIN_DATOS[r.status]
  return r.active ? 'Funcionario activo' : 'No está activo'
}

/** La ficha completa de una persona: todo lo que tiene la intranet (menos la contraseña) y lo que dice RH Link. */
function Ficha(props: { persona: PersonaGestion; onCerrar: () => void }) {
  const { persona } = props
  const [ficha, setFicha] = useState<FichaPersona | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .fichaPersona(persona.id)
      .then(setFicha)
      .catch((e) => setError(mensaje(e)))
  }, [persona.id])

  const filas: [string, React.ReactNode][] = ficha
    ? [
        ['Cédula', ficha.cedula ?? (ficha.source === 'local' ? 'Cuenta de prueba (sin cédula)' : 'Se verá en su próximo ingreso')],
        ['Nombre', nombreDe(ficha)],
        ['Correo', ficha.email ?? 'Sin correo'],
        ['Correo confirmado', siNo(ficha.emailVerified)],
        ['Teléfono', ficha.phone ?? '—'],
        ['Cargo', ficha.jobTitle ?? '—'],
        ['Rol', ficha.roles.map((r) => ROL_ETIQUETA[r as Rol] ?? r).join(', ')],
        ['Departamento', ficha.departmentName ?? 'Sin departamento'],
        ['Tipo de cuenta', ficha.source === 'identity' ? 'Identity Central (login de la Alcaldía)' : 'Cuenta de prueba (local)'],
        ['ID en Identity Central', ficha.identitySub ?? '—'],
        ['Estado', ficha.suspendedAt ? 'Suspendida desde ' + fechaHora(ficha.suspendedAt) : 'Activa'],
        ['Intentos fallidos de ingreso', String(ficha.failedLoginAttempts) + (ficha.lockedUntil ? ' (bloqueada hasta ' + fechaHora(ficha.lockedUntil) + ')' : '')],
        ['Sesiones abiertas', String(ficha.activeSessions)],
        ['Solicitudes', ficha.requests + (ficha.openRequests ? ' (' + ficha.openRequests + ' abiertas)' : '')],
        ['Vio el recorrido', ficha.tourSeenAt ? fechaHora(ficha.tourSeenAt) : 'Todavía no'],
        ['Primer ingreso', fechaHora(ficha.createdAt)],
        ['Último ingreso', fechaHora(ficha.lastLoginAt)],
        ['Última modificación', fechaHora(ficha.updatedAt)],
      ]
    : []
  const rh = ficha?.rrhh

  return (
    <Dialogo id="usrFicha" titulo={'Ficha de ' + nombreDe(persona)} onCerrar={props.onCerrar}>
      <div className="home-dlg__body">
        {error ? (
          <p className="f-err" role="alert">
            {error}
          </p>
        ) : !ficha ? (
          <p className="count-note" role="status">Cargando ficha…</p>
        ) : (
          <>
            <dl className="usr-ficha">
              {filas.map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </React.Fragment>
              ))}
            </dl>
            <h3 className="usr-ficha__sub">Según RH Link</h3>
            <dl className="usr-ficha">
              <dt>Estado</dt>
              <dd>{textoRrhh(rh!)}</dd>
              {rh?.status === 'found' && (
                <>
                  <dt>Nombre en planilla</dt>
                  <dd>{rh.fullName ?? '—'}</dd>
                  <dt>Ubicación</dt>
                  <dd>{rh.locationCode == null ? '—' : rh.locationCode + (rh.locationDepartment ? ' · ' + rh.locationDepartment : ' · ninguna dirección de la intranet')}</dd>
                </>
              )}
            </dl>
          </>
        )}
      </div>
      <div className="home-dlg__foot">
        <button type="button" className="ds-btn ds-btn--primary" onClick={props.onCerrar}>
          Cerrar
        </button>
      </div>
    </Dialogo>
  )
}

const TEXTOS = {
  reiniciar: {
    boton: 'Reiniciar perfil',
    cuerpo: 'Se eliminarán de forma irreversible el perfil de la intranet, sus sesiones, preferencias y todas sus solicitudes (las citas ya agendadas en la Clínica no se cancelan). La cuenta de Identity Central conserva su acceso: al volver a entrar se creará un perfil nuevo. Si la cédula registrada en Identity Central es incorrecta, primero debe corregirse allí; este reinicio no la cambia.',
    hecho: ' fue reiniciada; podrá crear un perfil nuevo al volver a entrar',
  },
  suspender: { boton: 'Suspender cuenta', cuerpo: 'No podrá entrar a la intranet y se cerrarán sus sesiones abiertas. Puedes reactivarla cuando quieras.', hecho: ' fue suspendida' },
  reactivar: { boton: 'Reactivar cuenta', cuerpo: 'Podrá volver a entrar a la intranet.', hecho: ' fue reactivada' },
  borrar: {
    boton: 'Borrar cuenta',
    cuerpo: 'Se borra la cuenta junto con todas sus solicitudes y no se puede deshacer. Si solo quieres que no pueda entrar, suspéndela. La persona ya no podrá entrar a la intranet.',
    hecho: ' fue borrada',
  },
}

function ConfirmarCuenta(props: { tipo: 'suspender' | 'reactivar' | 'borrar' | 'reiniciar'; persona: PersonaGestion; onCerrar: () => void; onHecho: (texto: string) => void }) {
  const { tipo, persona } = props
  const t = TEXTOS[tipo]
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const confirmar = async () => {
    setEnviando(true)
    try {
      if (tipo === 'suspender') await api.suspenderPersona(persona.id)
      else if (tipo === 'reactivar') await api.reactivarPersona(persona.id)
      else if (tipo === 'reiniciar') await api.reiniciarPersona(persona.id)
      else await api.borrarPersona(persona.id)
      props.onHecho('La cuenta de ' + nombreDe(persona) + t.hecho)
    } catch (e) {
      setError(mensaje(e))
      setEnviando(false)
    }
  }

  return (
    <Dialogo id="usrCuenta" titulo={t.boton + ': ' + nombreDe(persona)} onCerrar={props.onCerrar}>
      <div className="home-dlg__body">
        <p>{t.cuerpo}</p>
        {error && (
          <p className="f-err" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="home-dlg__foot">
        <button type="button" className="ds-btn ds-btn--ghost" onClick={props.onCerrar}>
          Cancelar
        </button>
        <button type="button" className="ds-btn ds-btn--primary" disabled={enviando} onClick={confirmar}>
          {enviando ? 'Procesando…' : t.boton}
        </button>
      </div>
    </Dialogo>
  )
}

function CambiarDepartamento(props: { persona: PersonaGestion; deps: Departamento[]; onCerrar: () => void; onGuardado: (p: PersonaGestion) => void }) {
  const { persona, deps } = props
  const [valor, setValor] = useState(persona.departmentId ? String(persona.departmentId) : '')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const guardar = async () => {
    setEnviando(true)
    try {
      props.onGuardado(await api.asignarDepartamento(persona.id, valor ? Number(valor) : null))
    } catch (e) {
      setError(mensaje(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo id="usrDepto" titulo={'Departamento de ' + nombreDe(persona)} onCerrar={props.onCerrar}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          guardar()
        }}
      >
        <div className="home-dlg__body">
          <div className="f-field">
            <label htmlFor="usr-depto">Departamento</label>
            <select id="usr-depto" className="ds-input" value={valor} onChange={(e) => setValor(e.target.value)}>
              <option value="">Sin departamento</option>
              {deps.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <span className="f-hint">Verá las aplicaciones abiertas a todos y las que estén limitadas a este departamento.</span>
          </div>
          {error && (
            <p className="f-err" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="home-dlg__foot">
          <button type="button" className="ds-btn ds-btn--ghost" onClick={props.onCerrar}>
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
