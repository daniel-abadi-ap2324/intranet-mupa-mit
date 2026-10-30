/**
 * Administración (/gestion/aplicaciones, vista «Visibilidad»): clasificar de una vez
 * qué direcciones (departamentos) ven qué aplicaciones. Tres formas de mirarlo:
 * por aplicación, por dirección y un resumen de solo lectura. Los cambios se
 * acumulan y se guardan juntos (PUT /api/applications/departments, todo o nada).
 * La regla de fondo: sin departamentos, la aplicación la ve todo el mundo.
 */
import React, { useEffect, useMemo, useState } from 'react'

import { api, type AppGestion, type Departamento } from '../../api'
import { useSitio } from '../../components/Proveedores'
import { Aviso, CampoBusqueda, Chips } from '../../components/ui'
import { AREAS, norm } from '../../lib/catalogo'
import { agrupar, cuantasVen, GRUPOS, grupoDe, igualesIds, laVe, normalizar, paraTodas, poner, ponerGrupo } from '../../lib/visibilidad'
import { mensaje } from './comun'

/** Cambios sin guardar: aplicación → departamentos que la verán (vacío = todas las direcciones). */
export type Cambios = Record<number, number[]>

type Modo = 'app' | 'dir' | 'resumen'

const idsDe = (a: AppGestion) => a.departments?.map((d) => d.id) ?? []

/** Publicadas primero, luego por nombre. */
const ordenar = (lista: AppGestion[]) => [...lista].sort((a, b) => Number(b.published) - Number(a.published) || a.name.localeCompare(b.name, 'es'))

export function Visibilidad(props: { deps: Departamento[]; cambios: Cambios; setCambios: React.Dispatch<React.SetStateAction<Cambios>>; version: number; onGuardado: () => void }) {
  const { deps, cambios, setCambios } = props
  const { avisar } = useSitio()
  const [apps, setApps] = useState<AppGestion[] | null>(null)
  const [error, setError] = useState('')
  const [modo, setModo] = useState<Modo>('app')
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')

  useEffect(() => {
    let vivo = true
    api
      .appsGestion()
      .then((l) => vivo && (setApps(ordenar(l)), setError('')))
      .catch((e) => vivo && (setError(mensaje(e)), setApps((l) => l ?? [])))
    return () => {
      vivo = false
    }
  }, [props.version])

  const todas = useMemo(() => deps.map((d) => d.id), [deps])
  const porId = useMemo(() => new Map((apps ?? []).map((a) => [a.id, a])), [apps])
  const actual = (a: AppGestion) => cambios[a.id] ?? idsDe(a)

  const fijar = (a: AppGestion, ids: number[]) =>
    setCambios((c) => {
      const { [a.id]: _antes, ...resto } = c
      return igualesIds(ids, idsDe(a)) ? resto : { ...resto, [a.id]: ids }
    })

  // Avisa al cerrar o recargar la pestaña con cambios sin guardar.
  const pendientes = Object.keys(cambios).length
  useEffect(() => {
    if (!pendientes) return
    const f = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', f)
    return () => window.removeEventListener('beforeunload', f)
  }, [pendientes])

  const guardar = async () => {
    setGuardando(true)
    setErrorGuardar('')
    try {
      const r = await api.visibilidadApps(Object.entries(cambios).map(([id, departmentIds]) => ({ applicationId: Number(id), departmentIds })))
      setCambios({})
      props.onGuardado()
      avisar(r.updated === 1 ? 'Se guardó la visibilidad de 1 aplicación' : `Se guardó la visibilidad de ${r.updated} aplicaciones`)
    } catch (e) {
      setErrorGuardar(mensaje(e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="vis">
      <Aviso>
        <b>Sin direcciones marcadas, la aplicación la ve todo el mundo.</b> Con direcciones marcadas, la ven solo esas (y administración). Ocultar no protege: quien tenga el enlace puede abrir la aplicación; la protección real la da cada
        sistema.
      </Aviso>
      {error && <Aviso tipo="warn">{error}</Aviso>}

      <div className="toolbar">
        <Chips<Modo>
          etiqueta="Cómo clasificar"
          opciones={[
            { v: 'app', t: 'Por aplicación' },
            { v: 'dir', t: 'Por dirección' },
            { v: 'resumen', t: 'Resumen' },
          ]}
          valor={modo}
          onCambio={setModo}
        />
      </div>

      {apps === null ? (
        <p className="count-note" role="status">Cargando el catálogo…</p>
      ) : !apps.length || !deps.length ? (
        <p className="empty show">{!apps.length ? 'No hay aplicaciones en el catálogo.' : 'No hay departamentos: créalos en Departamentos.'}</p>
      ) : modo === 'app' ? (
        <PorAplicacion apps={apps} deps={deps} actual={actual} fijar={fijar} />
      ) : modo === 'dir' ? (
        <PorDireccion apps={apps} deps={deps} todas={todas} actual={actual} fijar={fijar} cambios={cambios} />
      ) : (
        <Resumen apps={apps} deps={deps} actual={actual} />
      )}

      {pendientes > 0 && (
        <div className="vis-barra" role="region" aria-label="Cambios sin guardar">
          <div className="vis-barra__txt">
            <b role="status" aria-live="polite">
              {pendientes === 1 ? '1 aplicación modificada' : `${pendientes} aplicaciones modificadas`}
            </b>
            <details>
              <summary>Ver cambios</summary>
              <ul>
                {Object.entries(cambios).map(([id, ids]) => {
                  const a = porId.get(Number(id))
                  return a ? (
                    <li key={id}>
                      «{a.name}»: {resumenCorto(idsDe(a), todas.length)} → <b>{resumenCorto(ids, todas.length)}</b>
                    </li>
                  ) : null
                })}
              </ul>
            </details>
            {errorGuardar && (
              <p className="f-err" role="alert">
                {errorGuardar}
              </p>
            )}
          </div>
          <div className="vis-barra__acc">
            <button type="button" className="ds-btn ds-btn--ghost" disabled={guardando} onClick={() => (setCambios({}), setErrorGuardar(''))}>
              Descartar
            </button>
            <button type="button" className="ds-btn ds-btn--primary" disabled={guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const resumenCorto = (ids: number[], total: number) => (paraTodas(ids) ? 'todas las direcciones' : `${ids.length} de ${total} direcciones`)

/** Etiqueta «Borrador» o «Publicada» con texto (no solo color). */
function Estado({ a }: { a: AppGestion }) {
  return <span className={'tagline' + (a.published ? ' tagline--ok' : ' tagline--warn')}>{a.published ? 'Publicada' : 'Borrador'}</span>
}

const AVISO_BORRADOR = 'Borrador: no se muestra a nadie aunque se clasifique.'

/** Búsqueda por nombre y filtro por área, comunes a las dos vistas con lista de aplicaciones. */
function filtrar(apps: AppGestion[], q: string, area: string) {
  const b = norm(q.trim())
  return apps.filter((a) => (!area || a.area === area) && (!b || norm([a.name, a.description, a.area].join(' ')).includes(b)))
}

function FiltroArea(props: { valor: string; onCambio: (v: string) => void }) {
  return (
    <label className="gest-select">
      <span>Área</span>
      <select className="ds-input" value={props.valor} onChange={(e) => props.onCambio(e.target.value)}>
        <option value="">Todas</option>
        {AREAS.map((a) => (
          <option key={a}>{a}</option>
        ))}
      </select>
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* Por aplicación                                                      */
/* ------------------------------------------------------------------ */

type Comun = { apps: AppGestion[]; deps: Departamento[]; actual: (a: AppGestion) => number[]; fijar: (a: AppGestion, ids: number[]) => void }

function PorAplicacion({ apps, deps, actual, fijar }: Comun) {
  const [q, setQ] = useState('')
  const [area, setArea] = useState('')
  const [selId, setSelId] = useState<number | null>(apps[0]?.id ?? null)
  const visibles = useMemo(() => filtrar(apps, q, area), [apps, q, area])
  const sel = apps.find((a) => a.id === selId) ?? null

  return (
    <div className="vis-doble">
      <section className="vis-col" aria-labelledby="vis-apps-t">
        <h2 className="vis-t" id="vis-apps-t">
          Aplicaciones
        </h2>
        <div className="vis-filtros">
          <CampoBusqueda valor={q} onCambio={setQ} etiqueta="Buscar aplicación" placeholder="Buscar aplicación…" />
          <FiltroArea valor={area} onCambio={setArea} />
        </div>
        <p className="count-note" role="status">
          {visibles.length} de {apps.length} aplicaciones
        </p>
        <ul className="vis-lista">
          {visibles.map((a) => {
            const ids = actual(a)
            return (
              <li key={a.id}>
                <button type="button" className={'vis-item' + (a.id === selId ? ' is-sel' : '')} aria-current={a.id === selId ? 'true' : undefined} onClick={() => setSelId(a.id)}>
                  <span className="vis-item__n">
                    <span aria-hidden="true">{a.icon} </span>
                    {a.name}
                  </span>
                  <span className="vis-item__d">
                    {a.published ? '' : 'Borrador · '}
                    {a.area} · {paraTodas(ids) ? 'todas las direcciones' : `${ids.length} de ${deps.length}`}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {!visibles.length && <p className="empty show">Ninguna aplicación coincide.</p>}
      </section>

      <section className="vis-col vis-panel" aria-live="polite">
        {sel ? <PanelApp key={sel.id} app={sel} apps={apps} deps={deps} ids={actual(sel)} fijar={(ids) => fijar(sel, ids)} actual={actual} /> : <p className="empty show">Elige una aplicación.</p>}
      </section>
    </div>
  )
}

function PanelApp(props: { app: AppGestion; apps: AppGestion[]; deps: Departamento[]; ids: number[]; fijar: (ids: number[]) => void; actual: (a: AppGestion) => number[] }) {
  const { app, deps, ids, fijar } = props
  const [soloVacio, setSoloVacio] = useState(false)
  const [buscar, setBuscar] = useState('')
  const [origen, setOrigen] = useState('')
  const todas = useMemo(() => deps.map((d) => d.id), [deps])
  const solo = ids.length > 0 || soloVacio
  const b = norm(buscar.trim())
  const grupos = useMemo(() => agrupar(deps), [deps])

  const marcar = (id: number) => {
    const nuevo = ids.includes(id) ? ids.filter((x) => x !== id) : normalizar([...ids, id], todas)
    if (!nuevo.length) setSoloVacio(true)
    fijar(nuevo)
  }
  const grupo = (g: number[], marcado: boolean) => {
    const nuevo = ponerGrupo(ids, g, marcado)
    if (!nuevo.length) setSoloVacio(true)
    fijar(normalizar(nuevo, todas))
  }
  const copiar = () => {
    const o = props.apps.find((x) => String(x.id) === origen)
    if (!o) return
    const otros = props.actual(o)
    setSoloVacio(false)
    fijar(otros)
  }

  return (
    <>
      <h2 className="vis-t">
        <span aria-hidden="true">{app.icon} </span>
        {app.name}
      </h2>
      <p className="vis-estado">
        <Estado a={app} /> <span className="gest-det vis-det">{app.area}</span>
      </p>
      {!app.published && <Aviso tipo="warn">{AVISO_BORRADOR} Cuando la publiques, se aplicará lo que dejes aquí.</Aviso>}

      <fieldset className="vis-modo">
        <legend>¿Quién la ve?</legend>
        <label className="vis-radio">
          <input
            type="radio"
            name={'modo-' + app.id}
            checked={!solo}
            onChange={() => {
              setSoloVacio(false)
              fijar([])
            }}
          />
          <span>
            <b>Todas las direcciones</b>
            <span className="gest-det vis-det">Sin límite: la ve cualquier persona con acceso al catálogo.</span>
          </span>
        </label>
        <label className="vis-radio">
          <input type="radio" name={'modo-' + app.id} checked={solo} onChange={() => setSoloVacio(true)} />
          <span>
            <b>Solo estas direcciones…</b>
            <span className="gest-det vis-det">Solo las que marques (y administración). Sin sesión no se ve.</span>
          </span>
        </label>
      </fieldset>

      <div className="vis-copiar">
        <label className="gest-select">
          <span>Copiar de otra aplicación</span>
          <select className="ds-input" value={origen} onChange={(e) => setOrigen(e.target.value)}>
            <option value="">Elige una…</option>
            {props.apps
              .filter((x) => x.id !== app.id)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {x.published ? '' : ' (borrador)'}
                </option>
              ))}
          </select>
        </label>
        <button type="button" className="ds-btn ds-btn--ghost" disabled={!origen} onClick={copiar}>
          Copiar
        </button>
      </div>

      {!solo ? (
        <p className="vis-resumen">
          <b>Visible para {deps.length} de {deps.length} direcciones.</b> Elige «Solo estas direcciones…» para limitarla.
        </p>
      ) : (
        <>
          <p className="vis-resumen" role="status">
            <b>
              Visible para {cuantasVen(ids, deps.length)} de {deps.length} direcciones.
            </b>
            {!ids.length && ' Marca al menos una: sin ninguna marcada, la ven todas las personas.'}
          </p>
          <CampoBusqueda valor={buscar} onCambio={setBuscar} etiqueta="Buscar dirección" placeholder="Buscar dirección…" />
          <div className="vis-grupos">
            {grupos.map((g) => {
              const delGrupo = g.unidades.map((u) => u.id)
              const marcadas = delGrupo.filter((id) => ids.includes(id)).length
              const lista = g.unidades.filter((u) => !b || norm(u.name).includes(b) || ids.includes(u.id))
              if (b && !lista.length) return null
              return (
                <fieldset key={g.id} className="vis-grupo">
                  <legend>
                    {g.t} <span className="vis-cuenta">{marcadas} de {g.unidades.length}</span>
                  </legend>
                  <div className="vis-grupo__acc">
                    <button type="button" className="ds-btn ds-btn--ghost" disabled={marcadas === delGrupo.length} onClick={() => grupo(delGrupo, true)} aria-label={`Marcar todas: ${g.t}`}>
                      Marcar todas
                    </button>
                    <button type="button" className="ds-btn ds-btn--ghost" disabled={!marcadas} onClick={() => grupo(delGrupo, false)} aria-label={`Quitar todas: ${g.t}`}>
                      Quitar todas
                    </button>
                  </div>
                  <div className="vis-checks">
                    {lista.map((u) => (
                      <label key={u.id} className="vis-check">
                        <input type="checkbox" checked={ids.includes(u.id)} onChange={() => marcar(u.id)} /> <span>{u.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Por dirección                                                       */
/* ------------------------------------------------------------------ */

type Ver = 'todas' | 'ven' | 'noven'

function PorDireccion({ apps, deps, todas, actual, fijar, cambios }: Comun & { todas: number[]; cambios: Cambios }) {
  const { avisar } = useSitio()
  const [dep, setDep] = useState<number>(deps[0]?.id ?? 0)
  const [q, setQ] = useState('')
  const [area, setArea] = useState('')
  const [ver, setVer] = useState<Ver>('todas')
  const nombre = deps.find((d) => d.id === dep)?.name ?? ''
  const grupos = useMemo(() => agrupar(deps), [deps])

  const filas = useMemo(
    () => filtrar(apps, q, area).filter((a) => ver === 'todas' || (ver === 'ven') === laVe(actual(a), dep)),
    // `actual` cambia en cada render: lo que importa son las clasificaciones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apps, q, area, ver, dep, cambios],
  )
  const ven = apps.filter((a) => laVe(actual(a), dep)).length

  const cambiar = (a: AppGestion, ve: boolean): boolean => {
    const r = poner(actual(a), dep, ve, todas)
    if ('bloqueado' in r) return false
    fijar(a, r.ids)
    return true
  }
  const masivo = (ve: boolean) => {
    let hechas = 0
    let bloqueadas = 0
    for (const a of filas) {
      if (laVe(actual(a), dep) === ve) continue
      if (cambiar(a, ve)) hechas++
      else bloqueadas++
    }
    avisar(`${hechas} ${hechas === 1 ? 'aplicación cambiada' : 'aplicaciones cambiadas'}` + (bloqueadas ? `; ${bloqueadas} no se pudo quitar (es la única dirección que la ve)` : ''))
  }

  return (
    <section aria-label="Aplicaciones de una dirección">
      <div className="vis-filtros vis-filtros--dir">
        <label className="gest-select vis-dep">
          <span>Dirección</span>
          <select className="ds-input" aria-label="Dirección" value={dep} onChange={(e) => setDep(Number(e.target.value))}>
            {grupos.map((g) => (
              <optgroup key={g.id} label={g.t}>
                {g.unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <CampoBusqueda valor={q} onCambio={setQ} etiqueta="Buscar aplicación" placeholder="Buscar aplicación…" />
        <FiltroArea valor={area} onCambio={setArea} />
      </div>
      <div className="toolbar">
        <Chips<Ver>
          etiqueta="Mostrar"
          opciones={[
            { v: 'todas', t: 'Todas' },
            { v: 'ven', t: 'Las que ve' },
            { v: 'noven', t: 'Las que no ve' },
          ]}
          valor={ver}
          onCambio={setVer}
        />
      </div>
      <p className="vis-resumen" role="status">
        <b>
          «{nombre}» ve {ven} de {apps.length} aplicaciones.
        </b>{' '}
        <span className="gest-det vis-det">Marcada = la ve. Quitarla en una aplicación abierta a todas la limita a las demás direcciones.</span>
      </p>
      <div className="vis-masivo">
        <button type="button" className="ds-btn ds-btn--ghost" disabled={!filas.length} onClick={() => masivo(true)}>
          Que la vea en las {filas.length} que se muestran
        </button>
        <button type="button" className="ds-btn ds-btn--ghost" disabled={!filas.length} onClick={() => masivo(false)}>
          Quitarla de las {filas.length} que se muestran
        </button>
      </div>

      {!filas.length ? (
        <p className="empty show">Ninguna aplicación coincide con los filtros.</p>
      ) : (
        <ul className="vis-filas">
          {filas.map((a) => {
            const ids = actual(a)
            const ve = laVe(ids, dep)
            const bloqueada = ve && ids.length === 1 && ids[0] === dep
            const base = a.departments?.map((d) => d.id) ?? []
            const cambiada = a.id in cambios
            const alcance = paraTodas(ids) ? 'Abierta a todas las direcciones' : `Solo ${ids.length} de ${deps.length} direcciones`
            const nota = cambiada && paraTodas(base) && ids.length ? `Cambio pendiente: antes la veían todas las direcciones.` : cambiada ? 'Cambio pendiente.' : ''
            return (
              <li key={a.id} className={'vis-fila' + (cambiada ? ' is-cambio' : '')}>
                <label className="vis-fila__l">
                  <input type="checkbox" checked={ve} disabled={bloqueada} aria-describedby={'vf-' + a.id} onChange={(e) => cambiar(a, e.target.checked)} />
                  <span className="vis-fila__t">
                    <b>
                      <span aria-hidden="true">{a.icon} </span>
                      {a.name}
                    </b>
                    <span id={'vf-' + a.id} className="gest-det vis-det">
                      {a.area} · {alcance}
                      {!a.published && ` · ${AVISO_BORRADOR}`}
                      {bloqueada && ' · Es la única dirección que la ve: quitarla la abriría a todas. Para que no la vea nadie, déjala como borrador.'}
                      {nota && ` · ${nota}`}
                    </span>
                  </span>
                </label>
                <Estado a={a} />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Resumen (solo lectura)                                              */
/* ------------------------------------------------------------------ */

function Resumen({ apps, deps, actual }: Omit<Comun, 'fijar'>) {
  const grupos = useMemo(() => agrupar(deps), [deps])
  const celda = (ids: number[], g: (typeof GRUPOS)[number]['id']) => {
    const total = deps.filter((d) => grupoDe(d.name) === g).length
    if (paraTodas(ids)) return 'Todas'
    const n = deps.filter((d) => grupoDe(d.name) === g && ids.includes(d.id)).length
    return n === total ? 'Todas' : n ? `${n} de ${total}` : 'Ninguna'
  }
  return (
    <section aria-label="Resumen de visibilidad">
      <p className="count-note">Solo lectura: cuántas direcciones de cada tipo ven cada aplicación, con lo que tengas sin guardar.</p>
      <div className="table-wrap vis-resumen-t" tabIndex={0} role="region" aria-label="Tabla de visibilidad (se desplaza)">
        <table className="ds-table vis-tabla">
          <thead>
            <tr>
              <th scope="col">Aplicación</th>
              <th scope="col">Alcance</th>
              {grupos.map((g) => (
                <th scope="col" key={g.id}>
                  {g.t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => {
              const ids = actual(a)
              return (
                <tr key={a.id}>
                  <th scope="row">
                    <span aria-hidden="true">{a.icon} </span>
                    {a.name}
                    {!a.published && <span className="gest-det vis-det">Borrador</span>}
                  </th>
                  <td>{paraTodas(ids) ? 'Todas las direcciones' : `${ids.length} de ${deps.length}`}</td>
                  {grupos.map((g) => (
                    <td key={g.id}>{celda(ids, g.id)}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
