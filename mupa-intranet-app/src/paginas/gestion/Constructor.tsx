/**
 * Constructor de formularios (/gestion/formularios/:id o /nuevo) del Gestor de
 * Solicitudes: datos generales, secciones y campos (con casillas que abren
 * sub-campos y listas que crecen), y una vista previa con el mismo componente
 * que llena la gente. El backend valida la definición completa al guardar.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { api, ErrorApi, type FormularioGestion } from '../../api'
import { Campos, FormCtx } from '../../components/formulario/Campo'
import { useSitio } from '../../components/Proveedores'
import { Aviso, Chips } from '../../components/ui'
import { useDatos } from '../../datos'
import { estadoInicial, rutaSeccion, seccionesVisibles, type Campo, type Estado, type Formulario, type Seccion, type Tipo } from '../../lib/formularios'
import { useFiltroUrl } from '../../lib/useFiltroUrl'
import { mensaje, PaginaGestion } from './comun'

const TIPOS: { v: Tipo; t: string }[] = [
  { v: 'text', t: 'Texto corto' },
  { v: 'textarea', t: 'Texto largo' },
  { v: 'email', t: 'Correo' },
  { v: 'tel', t: 'Teléfono o extensión' },
  { v: 'number', t: 'Número' },
  { v: 'select', t: 'Lista desplegable' },
  { v: 'radio', t: 'Opción única' },
  { v: 'checks', t: 'Casillas (varias)' },
  { v: 'repeat', t: 'Lista que crece' },
]
const PERFIL = [
  { v: '', t: 'No' },
  { v: 'nombreCompleto', t: 'Nombre completo' },
  { v: 'correo', t: 'Correo' },
  { v: 'cargo', t: 'Cargo' },
  { v: 'direccion', t: 'Dirección' },
  { v: 'extension', t: 'Extensión' },
]

type Borrador = {
  title: string
  number: string
  area: string
  destination: string
  deadline: string
  intro: string
  notes: string
  accepting: boolean
  pendingDefinition: boolean
  published: boolean
  sections: Seccion[]
}

const nuevaSeccion = (): Seccion => ({ title: 'Nueva sección', fields: [{ l: 'Nuevo campo', t: 'text' }] })

function inicial(f?: FormularioGestion): Borrador {
  return {
    title: f?.title ?? '',
    number: f ? String(f.id) : '',
    area: f?.area ?? '',
    destination: f?.destino ?? '',
    deadline: f?.plazo ?? '',
    intro: f?.intro ?? '',
    notes: (f?.notes ?? []).join('\n'),
    accepting: f?.recibe ?? false,
    pendingDefinition: f?.aDefinir ?? false,
    published: f?.publicado ?? true,
    sections: f ? structuredClone(f.sections) : [{ title: 'Quién solicita', fields: [{ k: 'nombre', l: 'Nombre completo', t: 'text', r: true, auto: 'nombreCompleto' }] }],
  }
}

const lineas = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)

/** "sections.0.fields.1.opts" → "Sección 1 · Campo 2 · Opciones". */
const NOMBRES: Record<string, string> = {
  title: 'Título',
  number: 'Número',
  area: 'Área',
  destination: 'A quién llega',
  deadline: 'Plazo',
  intro: 'Descripción',
  notes: 'Avisos',
  l: 'Etiqueta',
  k: 'Clave',
  opts: 'Opciones',
  items: 'Casillas',
  fields: 'Campos',
  min: 'Mínimo',
  max: 'Máximo',
  desc: 'Descripción de la sección',
  show: 'Condición',
}
function donde(campo: string): string {
  const p = campo.split('.')
  const out: string[] = []
  for (let i = 0; i < p.length; i++) {
    const n = Number(p[i + 1])
    const indice = { sections: 'Sección', fields: 'Campo', sub: 'Campo', items: 'Casilla' }[p[i]]
    if (indice && !isNaN(n)) {
      out.push(indice + ' ' + (n + 1))
      i++
    } else out.push(NOMBRES[p[i]] ?? p[i])
  }
  return out.join(' · ')
}

export function PaginaConstructor() {
  const { id } = useParams()
  const nuevo = id === 'nuevo'
  return (
    <PaginaGestion
      titulo={nuevo ? 'Nuevo formulario' : 'Editar formulario'}
      miga="Formulario"
      intro="Arma el formulario por secciones. La vista previa muestra lo que verá la gente."
      roles={['admin', 'gestorSolicitudes']}
      quien="el Gestor de Solicitudes"
    >
      <Cargar id={nuevo ? null : Number(id)} />
    </PaginaGestion>
  )
}

function Cargar({ id }: { id: number | null }) {
  const [f, setF] = useState<FormularioGestion | null | undefined>(id === null ? null : undefined)
  const [error, setError] = useState('')
  const [areas, setAreas] = useState<string[]>([])
  useEffect(() => {
    api
      .formulariosGestion()
      .then((L) => {
        setAreas([...new Set(L.map((x) => x.area))])
        if (id !== null) {
          const x = L.find((y) => y.dbId === id)
          if (x) setF(x)
          else setError('Ese formulario no existe.')
        }
      })
      .catch((e) => setError(mensaje(e)))
  }, [id])
  if (error) return <Aviso tipo="warn">{error}</Aviso>
  if (f === undefined)
    return (
      <p className="count-note" role="status">
        Cargando…
      </p>
    )
  return <Editor f={f ?? undefined} areas={areas} />
}

function Editor({ f, areas }: { f?: FormularioGestion; areas: string[] }) {
  const { avisar } = useSitio()
  const { recargar } = useDatos()
  const navegar = useNavigate()
  const [d, setD] = useState<Borrador>(() => inicial(f))
  const [errores, setErrores] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [pestana, cambiar] = useFiltroUrl({ ver: 'datos' })
  const poner = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setD((x) => ({ ...x, [k]: v }))
  const ponerSeccion = (i: number, s: Seccion | null) => poner('sections', s ? d.sections.map((x, j) => (j === i ? s : x)) : d.sections.filter((_, j) => j !== i))
  const moverSeccion = (i: number, dir: -1 | 1) => {
    const L = [...d.sections]
    ;[L[i], L[i + dir]] = [L[i + dir], L[i]]
    poner('sections', L)
  }
  const cedula = JSON.stringify(d.sections).includes('"t":"cedula"')

  const guardar = async () => {
    const propios = [!d.title.trim() && 'Escribe el título.', !d.area.trim() && 'Escribe el área.', d.number && !/^\d+$/.test(d.number) && 'El número tiene que ser un número.'].filter(Boolean) as string[]
    setErrores(propios)
    if (propios.length) return
    setEnviando(true)
    try {
      const datos = {
        title: d.title.trim(),
        ...(d.number ? { number: Number(d.number) } : {}),
        area: d.area.trim(),
        destination: d.destination.trim(),
        deadline: d.deadline.trim() || null,
        intro: d.intro.trim(),
        notes: lineas(d.notes),
        sections: d.sections,
        accepting: d.accepting && !d.pendingDefinition,
        pendingDefinition: d.pendingDefinition,
        published: d.published,
      }
      const guardado = await api.guardarFormulario(f?.dbId ?? null, datos)
      await recargar()
      avisar('Formulario guardado' + (guardado.recibe ? ': recibe solicitudes' : ''))
      if (!f) navegar('/gestion/formularios/' + guardado.dbId, { replace: true })
    } catch (e) {
      setErrores(e instanceof ErrorApi && e.campos.length ? e.campos.map((c) => donde(c.field) + ': ' + c.message) : [mensaje(e)])
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.f-errs')?.focus())
    } finally {
      setEnviando(false)
    }
  }

  const previa: Formulario = useMemo(
    () => ({ slug: 'previa', id: Number(d.number) || 0, area: d.area, destino: d.destination, plazo: d.deadline || null, title: d.title, intro: d.intro, notes: lineas(d.notes), sections: d.sections, recibe: d.accepting && !d.pendingDefinition, aDefinir: d.pendingDefinition }),
    [d],
  )

  return (
    <>
      <div className="toolbar">
        <Chips
          etiqueta="Parte del formulario"
          opciones={[
            { v: 'datos', t: 'Datos generales' },
            { v: 'secciones', t: 'Secciones y campos', n: d.sections.length },
            { v: 'previa', t: 'Vista previa' },
          ]}
          valor={pestana.ver}
          onCambio={(ver) => cambiar({ ver })}
        />
        <Link className="ds-btn ds-btn--ghost" to="/gestion/formularios">
          ← Todos los formularios
        </Link>
      </div>

      {errores.length > 0 && (
        <div className="f-errs" role="alert" tabIndex={-1}>
          <b>Revisa estos datos antes de guardar</b>
          <ul>
            {errores.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {cedula && <Aviso tipo="warn">Este formulario pide cédula. La intranet no guarda cédulas: cambia esos campos antes de que reciba solicitudes.</Aviso>}

      {pestana.ver === 'datos' && (
        <div className="gest-seccion">
          <div className="gest-form gest-form--pagina">
            <div className="f-field f-wide">
              <label htmlFor="frm-title">Título</label>
              <input id="frm-title" className="ds-input" value={d.title} maxLength={160} onChange={(e) => poner('title', e.target.value)} />
            </div>
            <div className="f-field">
              <label htmlFor="frm-area">Área</label>
              <input id="frm-area" className="ds-input" list="frm-areas" value={d.area} maxLength={60} onChange={(e) => poner('area', e.target.value)} placeholder="Tecnología" />
              <datalist id="frm-areas">
                {areas.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
            <div className="f-field">
              <label htmlFor="frm-number">Número (opcional)</label>
              <input id="frm-number" className="ds-input" inputMode="numeric" value={d.number} onChange={(e) => poner('number', e.target.value)} placeholder="El siguiente libre" />
            </div>
            <div className="f-field">
              <label htmlFor="frm-destination">A quién llega</label>
              <input id="frm-destination" className="ds-input" value={d.destination} maxLength={160} onChange={(e) => poner('destination', e.target.value)} placeholder="Mesa de Servicios de Tecnología (ext. 1400)" />
            </div>
            <div className="f-field">
              <label htmlFor="frm-deadline">Plazo de respuesta (opcional)</label>
              <input id="frm-deadline" className="ds-input" value={d.deadline} maxLength={60} onChange={(e) => poner('deadline', e.target.value)} placeholder="3 días hábiles" />
            </div>
            <div className="f-field f-wide">
              <label htmlFor="frm-intro">Descripción</label>
              <textarea id="frm-intro" className="ds-input" rows={2} value={d.intro} maxLength={500} onChange={(e) => poner('intro', e.target.value)} />
            </div>
            <div className="f-field f-wide">
              <label htmlFor="frm-notes">Avisos (opcional, uno por línea)</label>
              <textarea id="frm-notes" className="ds-input" rows={2} value={d.notes} onChange={(e) => poner('notes', e.target.value)} />
            </div>
            <label className="check-inline f-wide">
              <input type="checkbox" checked={d.published} onChange={(e) => poner('published', e.target.checked)} /> Publicado (se ve en Formularios)
            </label>
            <label className="check-inline f-wide">
              <input
                type="checkbox"
                checked={d.pendingDefinition}
                onChange={(e) => setD((x) => ({ ...x, pendingDefinition: e.target.checked, accepting: e.target.checked ? false : x.accepting }))}
              />{' '}
              A definir con RRHH (se gestionará en otro sistema)
            </label>
            <label className="check-inline f-wide">
              <input type="checkbox" checked={d.accepting && !d.pendingDefinition} disabled={d.pendingDefinition} onChange={(e) => poner('accepting', e.target.checked)} /> Recibe solicitudes
            </label>
            <p className="f-hint f-wide">
              {d.pendingDefinition
                ? 'Está «a definir con RRHH»: no puede recibir solicitudes. Quita esa marca cuando RRHH defina su alcance.'
                : d.accepting
                  ? 'Las solicitudes se guardan y llegan al Gestor de Solicitudes, que las responde desde «Solicitudes».'
                  : 'Apagado: el envío es de prueba y no se guarda nada. Préndelo cuando el área apruebe el formulario.'}
            </p>
          </div>
        </div>
      )}

      {pestana.ver === 'secciones' && (
        <div className="gest-seccion">
          <ol className="gest-filas">
            {d.sections.map((s, i) => (
              <li key={i} className="gest-fila">
                <EditorSeccion
                  s={s}
                  i={i}
                  anteriores={d.sections.slice(0, i)}
                  onCambio={(x) => ponerSeccion(i, x)}
                  acciones={
                    <div className="gest-acciones">
                      <button type="button" className="ds-btn ds-btn--ghost" disabled={i === 0} onClick={() => moverSeccion(i, -1)} aria-label={`Subir la sección ${i + 1}`}>
                        ↑
                      </button>
                      <button type="button" className="ds-btn ds-btn--ghost" disabled={i === d.sections.length - 1} onClick={() => moverSeccion(i, 1)} aria-label={`Bajar la sección ${i + 1}`}>
                        ↓
                      </button>
                      <button type="button" className="ds-btn ds-btn--ghost gest-borrar" disabled={d.sections.length === 1} onClick={() => ponerSeccion(i, null)} aria-label={`Quitar la sección ${i + 1}`}>
                        Quitar sección
                      </button>
                    </div>
                  }
                />
              </li>
            ))}
          </ol>
          <div>
            <button type="button" className="ds-btn ds-btn--subtle" onClick={() => poner('sections', [...d.sections, nuevaSeccion()])}>
              <span aria-hidden="true">＋</span> Agregar sección
            </button>
          </div>
        </div>
      )}

      {pestana.ver === 'previa' && <VistaPrevia key={JSON.stringify(d.sections)} f={previa} />}

      <div className="gest-guardar">
        <button type="button" className="ds-btn ds-btn--primary" disabled={enviando} onClick={guardar}>
          {enviando ? 'Guardando…' : 'Guardar formulario'}
        </button>
        {f?.publicado && (
          <Link className="ds-btn ds-btn--ghost" to={'/formularios/' + f.slug}>
            Ver publicado
          </Link>
        )}
      </div>
    </>
  )
}

/** Opciones únicas con clave de las secciones anteriores: de ellas puede depender una sección. */
function condiciones(anteriores: Seccion[]): { k: string; l: string; opts: string[] }[] {
  const out: { k: string; l: string; opts: string[] }[] = []
  const walk = (cs: Campo[]) => {
    for (const c of cs) {
      if (c.t === 'radio' && c.k && c.opts?.length) out.push({ k: c.k, l: c.l, opts: c.opts })
      for (const it of c.items || []) walk(it.sub || [])
      walk(c.fields || [])
    }
  }
  anteriores.forEach((s) => walk(s.fields))
  return out
}

function EditorSeccion({ s, i, anteriores, onCambio, acciones }: { s: Seccion; i: number; anteriores: Seccion[]; onCambio: (s: Seccion) => void; acciones: React.ReactNode }) {
  const conds = condiciones(anteriores)
  const valorCond = s.show ? s.show.k + '::' + s.show.v : ''
  return (
    <fieldset>
      <legend>Sección {i + 1}</legend>
      <div className="gest-fila__campos">
        <div className="f-field">
          <label htmlFor={`s${i}-title`}>Título de la sección</label>
          <input id={`s${i}-title`} className="ds-input" value={s.title} maxLength={160} onChange={(e) => onCambio({ ...s, title: e.target.value })} />
        </div>
        <div className="f-field">
          <label htmlFor={`s${i}-desc`}>Descripción (opcional)</label>
          <input id={`s${i}-desc`} className="ds-input" value={s.desc ?? ''} maxLength={300} onChange={(e) => onCambio({ ...s, desc: e.target.value || undefined })} />
        </div>
        <div className="f-field">
          <label htmlFor={`s${i}-show`}>Se muestra</label>
          <select
            id={`s${i}-show`}
            className="ds-input"
            value={valorCond}
            onChange={(e) => {
              const [k, v] = e.target.value.split('::')
              onCambio({ ...s, show: e.target.value ? { k, v } : undefined })
            }}
          >
            <option value="">Siempre</option>
            {conds.flatMap((c) =>
              c.opts.map((o) => (
                <option key={c.k + o} value={c.k + '::' + o}>
                  Si «{c.l}» es «{o}»
                </option>
              )),
            )}
          </select>
          {!conds.length && i > 0 && <span className="f-hint">Para que dependa de una respuesta, agrega antes una «Opción única» y ponle una clave.</span>}
        </div>
      </div>
      <ListaCampos campos={s.fields} onCambio={(fields) => onCambio({ ...s, fields })} ruta={`s${i}`} />
      {acciones}
    </fieldset>
  )
}

function ListaCampos({ campos, onCambio, ruta, nombre = 'campo' }: { campos: Campo[]; onCambio: (c: Campo[]) => void; ruta: string; nombre?: string }) {
  const poner = (n: number, c: Campo | null) => onCambio(c ? campos.map((x, j) => (j === n ? c : x)) : campos.filter((_, j) => j !== n))
  const mover = (n: number, dir: -1 | 1) => {
    const L = [...campos]
    ;[L[n], L[n + dir]] = [L[n + dir], L[n]]
    onCambio(L)
  }
  return (
    <div className="gest-campos">
      {campos.map((c, n) => (
        <EditorCampo
          key={n}
          c={c}
          id={`${ruta}-f${n}`}
          etiqueta={`${nombre[0].toUpperCase() + nombre.slice(1)} ${n + 1}`}
          onCambio={(x) => poner(n, x)}
          acciones={
            <>
              <button type="button" className="ds-btn ds-btn--ghost" disabled={n === 0} onClick={() => mover(n, -1)} aria-label={`Subir el ${nombre} ${n + 1}`}>
                ↑
              </button>
              <button type="button" className="ds-btn ds-btn--ghost" disabled={n === campos.length - 1} onClick={() => mover(n, 1)} aria-label={`Bajar el ${nombre} ${n + 1}`}>
                ↓
              </button>
              <button type="button" className="ds-btn ds-btn--ghost gest-borrar" onClick={() => poner(n, null)} aria-label={`Quitar el ${nombre} ${n + 1}`}>
                Quitar
              </button>
            </>
          }
        />
      ))}
      <div>
        <button type="button" className="ds-btn ds-btn--subtle" onClick={() => onCambio([...campos, { l: 'Nuevo campo', t: 'text' }])}>
          <span aria-hidden="true">＋</span> Agregar {nombre}
        </button>
      </div>
    </div>
  )
}

function EditorCampo({ c, id, etiqueta, onCambio, acciones }: { c: Campo; id: string; etiqueta: string; onCambio: (c: Campo) => void; acciones: React.ReactNode }) {
  const set = (cambio: Partial<Campo>) => {
    const x: Campo = { ...c, ...cambio }
    for (const k of Object.keys(x) as (keyof Campo)[]) if (x[k] === '' || x[k] === undefined) delete x[k]
    onCambio(x)
  }
  const tipos = c.t === 'cedula' ? [...TIPOS, { v: 'cedula' as Tipo, t: 'Cédula (no permitido)' }] : TIPOS
  return (
    <div className="gest-campo" role="group" aria-label={etiqueta}>
      <div className="gest-campo__fila">
        <div className="f-field">
          <label htmlFor={id + '-l'}>{etiqueta}: etiqueta</label>
          <input id={id + '-l'} className="ds-input" value={c.l} maxLength={160} onChange={(e) => set({ l: e.target.value })} />
        </div>
        <div className="f-field gest-corto">
          <label htmlFor={id + '-t'}>Tipo</label>
          <select id={id + '-t'} className="ds-input" value={c.t} onChange={(e) => set({ t: e.target.value as Tipo })}>
            {tipos.map((t) => (
              <option key={t.v} value={t.v}>
                {t.t}
              </option>
            ))}
          </select>
        </div>
        <label className="check-inline">
          <input type="checkbox" checked={!!c.r} onChange={(e) => set({ r: e.target.checked || undefined })} /> Obligatorio
        </label>
        <div className="gest-acciones">{acciones}</div>
      </div>
      {c.t === 'cedula' && <p className="f-err">La intranet no guarda cédulas: cambia el tipo de este campo.</p>}

      {(c.t === 'select' || c.t === 'radio') && (
        <div className="f-field">
          <label htmlFor={id + '-opts'}>Opciones (una por línea)</label>
          <textarea id={id + '-opts'} className="ds-input" rows={3} value={(c.opts || []).join('\n')} onChange={(e) => set({ opts: e.target.value.split('\n') })} onBlur={() => set({ opts: lineas((c.opts || []).join('\n')) })} />
        </div>
      )}
      {c.t === 'radio' && (
        <div className="f-field gest-corto">
          <label htmlFor={id + '-k'}>Clave (para condiciones)</label>
          <input id={id + '-k'} className="ds-input" value={c.k ?? ''} maxLength={40} onChange={(e) => set({ k: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="tipo" />
        </div>
      )}
      {c.t === 'checks' && <Casillas c={c} id={id} onCambio={onCambio} />}
      {c.t === 'repeat' && (
        <div className="gest-anidado">
          <div className="gest-fila__campos">
            <div className="f-field">
              <label htmlFor={id + '-item'}>Nombre de cada elemento</label>
              <input id={id + '-item'} className="ds-input" value={c.item ?? ''} maxLength={40} onChange={(e) => set({ item: e.target.value })} placeholder="Participante" />
            </div>
            <div className="f-field">
              <label htmlFor={id + '-add'}>Texto del botón para agregar</label>
              <input id={id + '-add'} className="ds-input" value={c.add ?? ''} maxLength={60} onChange={(e) => set({ add: e.target.value })} placeholder="Agregar participante" />
            </div>
            <div className="f-field gest-corto">
              <label htmlFor={id + '-max'}>Máximo</label>
              <input id={id + '-max'} className="ds-input" inputMode="numeric" value={c.max ?? ''} onChange={(e) => set({ max: e.target.value ? Number(e.target.value) || 0 : undefined })} placeholder="5" />
            </div>
          </div>
          <ListaCampos campos={c.fields || []} onCambio={(fields) => set({ fields })} ruta={id} nombre="campo del elemento" />
        </div>
      )}
      {c.t === 'number' && (
        <div className="gest-fila__campos">
          <div className="f-field gest-corto">
            <label htmlFor={id + '-min'}>Mínimo</label>
            <input id={id + '-min'} className="ds-input" inputMode="numeric" value={c.min ?? ''} onChange={(e) => set({ min: e.target.value ? Number(e.target.value) || 0 : undefined })} />
          </div>
          <div className="f-field gest-corto">
            <label htmlFor={id + '-nmax'}>Máximo</label>
            <input id={id + '-nmax'} className="ds-input" inputMode="numeric" value={c.max ?? ''} onChange={(e) => set({ max: e.target.value ? Number(e.target.value) || 0 : undefined })} />
          </div>
        </div>
      )}

      <details className="gest-mas">
        <summary>Más opciones</summary>
        <div className="gest-fila__campos">
          <div className="f-field">
            <label htmlFor={id + '-hint'}>Ayuda debajo del campo</label>
            <input id={id + '-hint'} className="ds-input" value={c.hint ?? ''} maxLength={300} onChange={(e) => set({ hint: e.target.value })} />
          </div>
          {c.t !== 'checks' && c.t !== 'repeat' && (
            <div className="f-field">
              <label htmlFor={id + '-auto'}>Completar con el perfil</label>
              <select id={id + '-auto'} className="ds-input" value={c.auto ?? ''} onChange={(e) => set({ auto: e.target.value })}>
                {PERFIL.map((p) => (
                  <option key={p.v} value={p.v}>
                    {p.t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}

function Casillas({ c, id, onCambio }: { c: Campo; id: string; onCambio: (c: Campo) => void }) {
  const items = c.items || []
  const poner = (j: number, it: { l: string; sub?: Campo[] } | null) => onCambio({ ...c, items: it ? items.map((x, n) => (n === j ? it : x)) : items.filter((_, n) => n !== j) })
  return (
    <div className="gest-anidado">
      {items.map((it, j) => (
        <div key={j} className="gest-casilla">
          <div className="gest-campo__fila">
            <div className="f-field">
              <label htmlFor={`${id}-i${j}`}>Casilla {j + 1}</label>
              <input id={`${id}-i${j}`} className="ds-input" value={it.l} maxLength={160} onChange={(e) => poner(j, { ...it, l: e.target.value })} />
            </div>
            <button type="button" className="ds-btn ds-btn--ghost" onClick={() => poner(j, { ...it, sub: it.sub ? undefined : [{ l: 'Nuevo campo', t: 'text' }] })}>
              {it.sub ? 'Quitar campos de esta casilla' : 'Pedir más datos al marcarla'}
            </button>
            <button type="button" className="ds-btn ds-btn--ghost gest-borrar" onClick={() => poner(j, null)} aria-label={`Quitar la casilla ${j + 1}`}>
              Quitar
            </button>
          </div>
          {it.sub && <ListaCampos campos={it.sub} onCambio={(sub) => poner(j, { ...it, sub })} ruta={`${id}-i${j}`} nombre="campo de la casilla" />}
        </div>
      ))}
      <div>
        <button type="button" className="ds-btn ds-btn--subtle" onClick={() => onCambio({ ...c, items: [...items, { l: 'Nueva casilla' }] })}>
          <span aria-hidden="true">＋</span> Agregar casilla
        </button>
      </div>
    </div>
  )
}

/** El formulario como lo verá la gente (sin enviar nada). */
function VistaPrevia({ f }: { f: Formulario }) {
  const [estado, setEstado] = useState<Estado>(() => estadoInicial(f))
  return (
    <div className="gest-previa">
      <Aviso>Vista previa: puedes llenarla para probar, pero no se envía nada.</Aviso>
      <h2 className="ds-h3">{f.title || 'Sin título'}</h2>
      {f.intro && <p className="ds-body-sm">{f.intro}</p>}
      <FormCtx.Provider value={{ estado, cambiar: setEstado, errores: {} }}>
        <form noValidate onSubmit={(e) => e.preventDefault()}>
          {seccionesVisibles(f, estado).map(({ i, n, s }) => (
            <section className="f-section" key={i} aria-label={s.title}>
              <header>
                <span className="f-num" aria-hidden="true">
                  {n}
                </span>
                <div>
                  <h3>{s.title}</h3>
                  {s.desc && <p>{s.desc}</p>}
                </div>
              </header>
              <Campos campos={s.fields} base={rutaSeccion(i)} />
            </section>
          ))}
        </form>
      </FormCtx.Provider>
    </div>
  )
}
