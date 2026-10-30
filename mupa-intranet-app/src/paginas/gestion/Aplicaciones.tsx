/**
 * Administración (/gestion/aplicaciones): el catálogo de aplicaciones, con sus
 * borradores, y qué departamentos ve cada una. El filtro "Visible para" muestra
 * lo mismo que ve una persona de ese departamento.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { api, ErrorApi, type AppGestion, type DatosApp, type Departamento, type Etiqueta } from '../../api'
import { useSitio } from '../../components/Proveedores'
import { Aviso, CampoBusqueda, Chips, Dialogo } from '../../components/ui'
import { ACCESOS, AREAS, ESTADOS, norm } from '../../lib/catalogo'
import { revisarUrl } from '../../lib/url'
import { useFiltroUrl } from '../../lib/useFiltroUrl'
import { mensaje, PaginaGestion } from './comun'
import { Visibilidad, type Cambios } from './VisibilidadApps'

export function PaginaGestionAplicaciones() {
  return (
    <PaginaGestion
      titulo="Aplicaciones del catálogo"
      miga="Aplicaciones"
      intro="Agrega, edita o retira aplicaciones del catálogo, y decide qué direcciones ven cada una: de a una en «Lista» o varias a la vez en «Visibilidad». Una aplicación sin direcciones la ven todas las personas."
      roles={['admin']}
      quien="administración"
    >
      <Gestion />
    </PaginaGestion>
  )
}

type Estado = 'todas' | 'publicadas' | 'borradores'

function Gestion() {
  const { avisar } = useSitio()
  const [f, cambiar] = useFiltroUrl({ q: '', visible: '', estado: 'todas', vista: 'lista' })
  const [lista, setLista] = useState<AppGestion[] | null>(null)
  const [deps, setDeps] = useState<Departamento[]>([])
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [errorCarga, setErrorCarga] = useState('')
  // undefined = cerrado; null = una nueva.
  const [editando, setEditando] = useState<AppGestion | null | undefined>(undefined)
  const [borrando, setBorrando] = useState<AppGestion | null>(null)
  const [ocupado, setOcupado] = useState(false)
  // Clasificación en bloque sin guardar (se conserva al cambiar de vista).
  const [cambios, setCambios] = useState<Cambios>({})
  const [version, setVersion] = useState(0)

  useEffect(() => {
    api.departamentos().then(setDeps).catch(() => setDeps([]))
    api.etiquetas().then(setEtiquetas).catch(() => setEtiquetas([]))
  }, [])

  const cargar = useCallback(async () => {
    try {
      setLista(await api.appsGestion(f.visible ? Number(f.visible) : undefined))
      setErrorCarga('')
    } catch (e) {
      setErrorCarga(mensaje(e))
      setLista((l) => l ?? [])
    }
  }, [f.visible])
  useEffect(() => {
    cargar()
  }, [cargar])

  const estado = (['todas', 'publicadas', 'borradores'].includes(f.estado) ? f.estado : 'todas') as Estado
  const buscar = norm(f.q.trim())
  const visibles = useMemo(
    () =>
      (lista ?? []).filter(
        (a) =>
          (estado === 'todas' || (estado === 'publicadas') === a.published) &&
          (!buscar || norm([a.name, a.description, a.area, a.slug].join(' ')).includes(buscar)),
      ),
    [lista, estado, buscar],
  )
  const cuantas = (e: Estado) => (lista ?? []).filter((a) => e === 'todas' || (e === 'publicadas') === a.published).length

  const eliminar = async (a: AppGestion) => {
    setOcupado(true)
    try {
      await api.borrarApp(a.id)
      setBorrando(null)
      await cargar()
      document.querySelector<HTMLElement>('.gest-nuevo')?.focus()
      avisar('Aplicación eliminada')
    } catch (e) {
      avisar(mensaje(e))
    } finally {
      setOcupado(false)
    }
  }

  const depNombre = f.visible ? deps.find((d) => String(d.id) === f.visible)?.name : ''

  const vista = f.vista === 'visibilidad' ? 'visibilidad' : 'lista'
  const selector = (
    <div className="toolbar">
      <Chips<'lista' | 'visibilidad'>
        etiqueta="Vista"
        opciones={[
          { v: 'lista', t: 'Lista' },
          { v: 'visibilidad', t: 'Visibilidad', n: Object.keys(cambios).length || undefined },
        ]}
        valor={vista}
        onCambio={(v) => cambiar({ vista: v })}
      />
    </div>
  )

  if (vista === 'visibilidad') {
    return (
      <>
        {selector}
        <Visibilidad
          deps={deps}
          cambios={cambios}
          setCambios={setCambios}
          version={version}
          onGuardado={() => {
            setVersion((v) => v + 1)
            cargar()
          }}
        />
      </>
    )
  }

  return (
    <>
      {selector}
      <div className="toolbar">
        <CampoBusqueda valor={f.q} onCambio={(q) => cambiar({ q })} etiqueta="Buscar aplicación" placeholder="Buscar por nombre o descripción…" />
        <label className="gest-select">
          <span>Visible para</span>
          <select className="ds-input" value={f.visible} onChange={(e) => cambiar({ visible: e.target.value })}>
            <option value="">Todo el catálogo</option>
            {deps.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="ds-btn ds-btn--primary gest-nuevo" onClick={() => setEditando(null)}>
          <span aria-hidden="true">＋</span> Nueva aplicación
        </button>
      </div>
      <div className="toolbar">
        <Chips<Estado>
          etiqueta="Filtrar por estado"
          opciones={[
            { v: 'todas', t: 'Todas', n: cuantas('todas') },
            { v: 'publicadas', t: 'Publicadas', n: cuantas('publicadas') },
            { v: 'borradores', t: 'Borradores', n: cuantas('borradores') },
          ]}
          valor={estado}
          onCambio={(v) => cambiar({ estado: v })}
        />
      </div>

      {depNombre && <Aviso>Así ve el catálogo una persona de «{depNombre}» con la sesión iniciada: las aplicaciones abiertas a todos y las limitadas a su departamento.</Aviso>}
      {errorCarga && <Aviso tipo="warn">{errorCarga}</Aviso>}

      {lista === null ? (
        <p className="count-note" role="status">Cargando el catálogo…</p>
      ) : !visibles.length ? (
        <p className="empty show">Ninguna aplicación coincide con los filtros.</p>
      ) : (
        <div className="table-wrap">
          <table className="ds-table gest-tabla">
            <thead>
              <tr>
                <th scope="col">Aplicación</th>
                <th scope="col">Área</th>
                <th scope="col">Visible para</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => (
                <tr key={a.id}>
                  <td>
                    <b>
                      <span aria-hidden="true">{a.icon} </span>
                      {a.name}
                    </b>
                    <span className="gest-det">{a.description}</span>
                  </td>
                  <td data-t="Área">{a.area}</td>
                  <td data-t="Visible">
                    {a.departments?.length ? a.departments.map((d) => d.name).join(', ') : 'Todas las personas'}
                    {a.access !== 'todos' && <span className="gest-det">{ACCESOS.find((x) => x.value === a.access)?.label}</span>}
                  </td>
                  <td data-t="Estado">
                    <span className={'tagline' + (a.published ? ' tagline--ok' : ' tagline--warn')}>{a.published ? 'Publicada' : 'Borrador'}</span>
                  </td>
                  <td className="gest-acts">
                    <div className="gest-acciones">
                      <button type="button" className="ds-btn ds-btn--ghost" disabled={ocupado} onClick={() => setEditando(a)} aria-label={'Editar «' + a.name + '»'}>
                        Editar
                      </button>
                      <button type="button" className="ds-btn ds-btn--ghost gest-borrar" disabled={ocupado} onClick={() => setBorrando(a)} aria-label={'Eliminar «' + a.name + '»'}>
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
          app={editando}
          deps={deps}
          etiquetas={etiquetas}
          onCerrar={() => setEditando(undefined)}
          onGuardado={async (a) => {
            setEditando(undefined)
            await cargar()
            avisar(a.published ? '«' + a.name + '» guardada y publicada' : '«' + a.name + '» guardada como borrador')
          }}
        />
      )}

      {borrando && (
        <Dialogo
          id="appBorrar"
          titulo="Eliminar aplicación"
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
              Se borra «{borrando.name}» del catálogo y de los accesos rápidos de quien la tenga. Si solo quieres ocultarla, edítala y quita «Publicada».
            </p>
          </div>
        </Dialogo>
      )}
    </>
  )
}

type Borrador = {
  name: string
  description: string
  url: string
  area: string
  icon: string
  access: string
  status: string
  keywords: string
  note: string
  published: boolean
  featured: boolean
  confirmed: boolean
  external: boolean
  pdf: boolean
  tagIds: number[]
  departmentIds: number[]
}
type Errores = Partial<Record<keyof Borrador, string>>

function inicial(a: AppGestion | null): Borrador {
  return {
    name: a?.name ?? '',
    description: a?.description ?? '',
    url: a?.url ?? '',
    area: a?.area ?? AREAS[0],
    icon: a?.icon ?? '▦',
    access: a?.access ?? 'todos',
    status: a?.status ?? 'publicado',
    keywords: a?.keywords ?? '',
    note: a?.note ?? '',
    published: a?.published ?? false,
    featured: a?.featured ?? false,
    confirmed: a?.confirmed ?? false,
    external: a?.external ?? false,
    pdf: a?.pdf ?? false,
    tagIds: a?.tags.map((t) => t.id) ?? [],
    departmentIds: a?.departments?.map((d) => d.id) ?? [],
  }
}

function revisar(d: Borrador): Errores {
  const e: Errores = {}
  if (!d.name.trim()) e.name = 'Escribe el nombre.'
  const url = revisarUrl(d.url)
  if (url.error) e.url = url.error
  if (!d.icon.trim()) e.icon = 'Pon un símbolo (por ejemplo ▦).'
  return e
}

function Editor(props: { app: AppGestion | null; deps: Departamento[]; etiquetas: Etiqueta[]; onCerrar: () => void; onGuardado: (a: AppGestion) => void }) {
  const { app } = props
  const [d, setD] = useState<Borrador>(() => inicial(app))
  const [errores, setErrores] = useState<Errores>({})
  const [general, setGeneral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [buscarDep, setBuscarDep] = useState('')
  const form = useRef<HTMLFormElement>(null)

  const poner = <K extends keyof Borrador>(k: K, v: Borrador[K]) => {
    setD((x) => ({ ...x, [k]: v }))
    setErrores((e) => ({ ...e, [k]: undefined }))
  }
  const alternar = (k: 'tagIds' | 'departmentIds', id: number) => poner(k, d[k].includes(id) ? d[k].filter((x) => x !== id) : [...d[k], id])

  const guardar = async () => {
    const e = revisar(d)
    setGeneral('')
    if (Object.keys(e).length) {
      setErrores(e)
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    const datos: DatosApp = {
      ...d,
      name: d.name.trim(),
      description: d.description.trim(),
      url: d.url.trim() || null,
      icon: d.icon.trim(),
      keywords: d.keywords.trim(),
      note: d.note.trim(),
    }
    setEnviando(true)
    try {
      props.onGuardado(app ? await api.editarApp(app.id, datos) : await api.crearApp(datos))
    } catch (err) {
      if (err instanceof ErrorApi && err.campos.length) {
        const porCampo: Errores = {}
        for (const c of err.campos) {
          if (c.field in d) porCampo[c.field as keyof Borrador] = c.message
          else setGeneral(c.message)
        }
        setErrores(porCampo)
      } else if (err instanceof ErrorApi && err.codigo === 'URL_ALREADY_USED') {
        setErrores({ url: err.message })
      } else {
        setGeneral(mensaje(err))
      }
    } finally {
      setEnviando(false)
    }
  }

  const campo = (k: keyof Borrador) => ({
    id: 'app-' + k,
    'aria-invalid': errores[k] ? true : undefined,
    'aria-describedby': errores[k] ? 'app-' + k + '-err' : undefined,
  })
  const error = (k: keyof Borrador) =>
    errores[k] ? (
      <p className="f-err" id={'app-' + k + '-err'}>
        {errores[k]}
      </p>
    ) : null
  const cls = (k: keyof Borrador, extra = '') => 'f-field' + extra + (errores[k] ? ' is-invalid' : '')
  const aviso = revisarUrl(d.url).aviso
  const depsVisibles = props.deps.filter((x) => !buscarDep.trim() || norm(x.name).includes(norm(buscarDep.trim())) || d.departmentIds.includes(x.id))

  return (
    <Dialogo id="appEditor" titulo={app ? 'Editar aplicación' : 'Nueva aplicación'} onCerrar={props.onCerrar}>
      <form
        ref={form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          guardar()
        }}
      >
        <div className="home-dlg__body gest-form">
          <div className={cls('name', ' f-wide')}>
            <label htmlFor="app-name">Nombre</label>
            <input className="ds-input" {...campo('name')} value={d.name} maxLength={80} onChange={(e) => poner('name', e.target.value)} />
            {error('name')}
          </div>
          <div className={cls('description', ' f-wide')}>
            <label htmlFor="app-description">Descripción (opcional)</label>
            <input className="ds-input" {...campo('description')} value={d.description} maxLength={160} onChange={(e) => poner('description', e.target.value)} />
            <span className="f-hint">{d.description.length} de 160 caracteres. Déjala vacía si no se sabe para qué sirve.</span>
            {error('description')}
          </div>
          <div className={cls('url', ' f-wide')}>
            <label htmlFor="app-url">Dirección (opcional)</label>
            <input className="ds-input" {...campo('url')} value={d.url} inputMode="url" onChange={(e) => poner('url', e.target.value)} placeholder="https://sistema.mupa.gob.pa o /pagina-de-la-intranet" />
            {aviso && !errores.url && <span className="f-hint">{aviso}</span>}
            {error('url')}
          </div>
          <div className={cls('area')}>
            <label htmlFor="app-area">Área</label>
            <select className="ds-input" {...campo('area')} value={d.area} onChange={(e) => poner('area', e.target.value)}>
              {AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className={cls('icon')}>
            <label htmlFor="app-icon">Símbolo</label>
            <input className="ds-input" {...campo('icon')} value={d.icon} maxLength={4} onChange={(e) => poner('icon', e.target.value)} />
            {error('icon')}
          </div>
          <div className={cls('access')}>
            <label htmlFor="app-access">Acceso</label>
            <select className="ds-input" {...campo('access')} value={d.access} onChange={(e) => poner('access', e.target.value)}>
              {ACCESOS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className={cls('status')}>
            <label htmlFor="app-status">Estado del sistema</label>
            <select className="ds-input" {...campo('status')} value={d.status} onChange={(e) => poner('status', e.target.value)}>
              {ESTADOS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <fieldset className={cls('departmentIds', ' f-wide')}>
            <legend>Visible para</legend>
            <span className="f-hint">
              {d.departmentIds.length
                ? `Solo ${d.departmentIds.length === 1 ? 'el departamento marcado' : `los ${d.departmentIds.length} departamentos marcados`} (y administración). Sin sesión no se ve.`
                : 'Todas las personas (según el acceso de arriba). Marca departamentos para limitarla.'}
            </span>
            {props.deps.length > 8 && (
              <input
                type="search"
                className="ds-input"
                value={buscarDep}
                onChange={(e) => setBuscarDep(e.target.value)}
                aria-label="Buscar departamento"
                placeholder="Buscar departamento…"
                autoComplete="off"
              />
            )}
            <div className="gest-checks">
              {depsVisibles.map((x) => (
                <label key={x.id}>
                  <input type="checkbox" checked={d.departmentIds.includes(x.id)} onChange={() => alternar('departmentIds', x.id)} /> {x.name}
                </label>
              ))}
              {!props.deps.length && <span className="f-hint">No hay departamentos: créalos en Departamentos.</span>}
            </div>
            {error('departmentIds')}
          </fieldset>

          <fieldset className="f-field f-wide">
            <legend>Etiquetas</legend>
            <div className="gest-checks">
              {props.etiquetas.map((t) => (
                <label key={t.id}>
                  <input type="checkbox" checked={d.tagIds.includes(t.id)} onChange={() => alternar('tagIds', t.id)} /> {t.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className={cls('keywords', ' f-wide')}>
            <label htmlFor="app-keywords">Palabras para el buscador (opcional)</label>
            <input className="ds-input" {...campo('keywords')} value={d.keywords} maxLength={300} onChange={(e) => poner('keywords', e.target.value)} placeholder="planilla salario pago" />
          </div>
          <div className={cls('note', ' f-wide')}>
            <label htmlFor="app-note">Nota interna (opcional)</label>
            <textarea className="ds-input" {...campo('note')} value={d.note} maxLength={500} rows={2} onChange={(e) => poner('note', e.target.value)} />
            <span className="f-hint">Solo la ve administración.</span>
          </div>

          <fieldset className="f-field f-wide">
            <legend>Opciones</legend>
            <div className="gest-checks gest-checks--fila">
              <label>
                <input type="checkbox" checked={d.published} onChange={(e) => poner('published', e.target.checked)} /> Publicada (sin marcar: borrador)
              </label>
              <label>
                <input type="checkbox" checked={d.featured} onChange={(e) => poner('featured', e.target.checked)} /> Acceso rápido por defecto
              </label>
              <label>
                <input type="checkbox" checked={d.confirmed} onChange={(e) => poner('confirmed', e.target.checked)} /> Datos confirmados por DITI
              </label>
              <label>
                <input type="checkbox" checked={d.external} onChange={(e) => poner('external', e.target.checked)} /> Se abre en otra pestaña
              </label>
              <label>
                <input type="checkbox" checked={d.pdf} onChange={(e) => poner('pdf', e.target.checked)} /> Es un PDF
              </label>
            </div>
          </fieldset>

          {general && (
            <p className="f-err f-wide" role="alert">
              {general}
            </p>
          )}
        </div>
        <div className="home-dlg__foot gest-pie">
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
