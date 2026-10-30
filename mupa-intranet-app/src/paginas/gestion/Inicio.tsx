/**
 * Comunicación (/gestion/inicio): las secciones del Inicio que no tienen panel
 * propio. Cada sección se guarda por separado y el backend la valida.
 */
import React, { useEffect, useState } from 'react'

import { api, ErrorApi, type SeccionInicio } from '../../api'
import { useSitio } from '../../components/Proveedores'
import { Aviso, Chips } from '../../components/ui'
import { useDatos } from '../../datos'
import { OPCIONES_COLOR } from '../../lib/colores'
import { revisarUrl } from '../../lib/url'
import { useFiltroUrl } from '../../lib/useFiltroUrl'
import { mensaje, PaginaGestion, SubirArchivo } from './comun'

type Col = { k: string; t: string; tipo?: 'texto' | 'enlace' | 'color' | 'check' | 'imagen'; max?: number; requerido?: boolean; corto?: boolean }
type Def = { id: SeccionInicio; t: string; d: string } & ({ tipo: 'texto' } | { tipo: 'lista'; raiz: boolean; nota: boolean; cols: Col[]; max: number })

const TITULO: Col = { k: 't', t: 'Título', max: 80, requerido: true }
const META: Col = { k: 'meta', t: 'Detalle', max: 160 }
const ICONO: Col = { k: 'g', t: 'Símbolo', max: 4, corto: true }
const COLOR: Col = { k: 'color', t: 'Color', tipo: 'color', corto: true }
const ENLACE: Col = { k: 'h', t: 'Enlace', tipo: 'enlace' }

const SECCIONES: Def[] = [
  { id: 'enlaces', t: 'Enlaces institucionales', d: 'Portales del Estado. Un enlace sin dirección no se muestra en el Inicio.', tipo: 'lista', raiz: true, nota: false, cols: [TITULO, ICONO, ENLACE], max: 20 },
  {
    id: 'frecuentes',
    t: 'Trámites frecuentes',
    d: 'Atajos a lo que más se pide, con su plazo.',
    tipo: 'lista',
    raiz: false,
    nota: true,
    cols: [TITULO, META, ICONO, COLOR, { k: 'sla', t: 'Plazo', max: 40, corto: true }, ENLACE],
    max: 12,
  },
  {
    id: 'campanas',
    t: 'Campañas',
    d: 'Las imágenes del carrusel de campañas (se recomiendan 1280 × 403 px).',
    tipo: 'lista',
    raiz: false,
    nota: true,
    cols: [
      { k: 'src', t: 'Imagen', tipo: 'imagen', requerido: true },
      { k: 'alt', t: 'Descripción de la imagen', max: 160, requerido: true },
      ENLACE,
    ],
    max: 12,
  },
]

export function PaginaGestionInicio() {
  return (
    <PaginaGestion
      titulo="Contenido del Inicio"
      miga="Contenido del Inicio"
      intro="Las secciones del Inicio que no tienen panel propio. Los anuncios, noticias, boletines y videos se publican en sus pantallas."
      roles={['admin', 'comunicacion']}
      quien="el equipo de Comunicación"
    >
      <Editor />
    </PaginaGestion>
  )
}

type Fila = Record<string, string | boolean>
type Valor = { texto: string; nota: string; filas: Fila[] }

function leer(def: Def, contenido: Record<string, unknown>): Valor {
  const v = contenido[def.id] as unknown
  if (def.tipo === 'texto') return { texto: typeof v === 'string' ? v : '', nota: '', filas: [] }
  const o = (v ?? {}) as { nota?: string; items?: Fila[] }
  const filas = (def.raiz ? (Array.isArray(v) ? v : []) : o.items || []) as Fila[]
  return { texto: '', nota: def.raiz ? '' : o.nota || '', filas: filas.map((f) => ({ ...f })) }
}

/** Lo que se manda al backend: sin textos vacíos opcionales; enlaces vacíos como null. */
function escribir(def: Def, v: Valor): unknown {
  if (def.tipo === 'texto') return v.texto.trim()
  const filas = v.filas.map((f) => {
    const o: Record<string, unknown> = {}
    for (const c of def.cols) {
      const x = f[c.k]
      if (c.tipo === 'check') {
        if (x) o[c.k] = true
      } else if (c.tipo === 'enlace') o[c.k] = String(x ?? '').trim() || null
      else if (String(x ?? '').trim()) o[c.k] = String(x).trim()
    }
    return o
  })
  if (def.raiz) return filas
  return { ...(def.nota && v.nota.trim() ? { nota: v.nota.trim() } : {}), items: filas }
}

/** "value.items.2.h" → "Fila 3 · Enlace". */
function donde(def: Def, campo: string): string {
  const partes = campo.split('.').filter((x) => x !== 'value' && x !== 'items')
  if (def.tipo === 'texto' || !partes.length) return def.t
  const col = def.tipo === 'lista' ? def.cols.find((c) => c.k === partes[1]) : undefined
  return 'Fila ' + (Number(partes[0]) + 1) + (col ? ' · ' + col.t : '')
}

function Editor() {
  const { avisar } = useSitio()
  const { recargar } = useDatos()
  const [f, cambiar] = useFiltroUrl({ seccion: 'enlaces' })
  const def = SECCIONES.find((s) => s.id === f.seccion) ?? SECCIONES[0]
  const [contenido, setContenido] = useState<Record<string, unknown> | null>(null)
  const [v, setV] = useState<Valor>({ texto: '', nota: '', filas: [] })
  const [errores, setErrores] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [sucio, setSucio] = useState(false)

  useEffect(() => {
    api
      .contenidoInicio()
      .then(setContenido)
      .catch(() => setContenido({}))
  }, [])
  useEffect(() => {
    if (contenido) setV(leer(def, contenido))
    setErrores([])
    setSucio(false)
  }, [def, contenido])

  const cambiarFila = (i: number, k: string, x: string | boolean) => {
    setV((o) => ({ ...o, filas: o.filas.map((fila, j) => (j === i ? { ...fila, [k]: x } : fila)) }))
    setSucio(true)
  }
  const mover = (i: number, d: -1 | 1) => {
    setV((o) => {
      const filas = [...o.filas]
      ;[filas[i], filas[i + d]] = [filas[i + d], filas[i]]
      return { ...o, filas }
    })
    setSucio(true)
  }

  const guardar = async () => {
    // Lo mismo que revisa el backend, para avisar antes de enviar.
    const propios: string[] = []
    if (def.tipo === 'lista')
      v.filas.forEach((fila, i) => {
        for (const c of def.cols) {
          const x = String(fila[c.k] ?? '').trim()
          if (c.requerido && !x) propios.push(`Fila ${i + 1} · ${c.t}: falta completarlo.`)
          else if ((c.tipo === 'enlace' || c.tipo === 'imagen') && revisarUrl(x).error) propios.push(`Fila ${i + 1} · ${c.t}: ${revisarUrl(x).error}`)
        }
      })
    setErrores(propios)
    if (propios.length) return
    setEnviando(true)
    try {
      const nuevo = await api.guardarSeccion(def.id, escribir(def, v))
      setContenido(nuevo)
      await recargar()
      avisar('«' + def.t + '» guardado: ya se ve en el Inicio')
    } catch (e) {
      setErrores(e instanceof ErrorApi && e.campos.length ? e.campos.map((c) => donde(def, c.field) + ': ' + c.message) : [mensaje(e)])
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <div className="toolbar">
        <Chips<string>
          etiqueta="Sección"
          opciones={SECCIONES.map((s) => ({ v: s.id, t: s.t }))}
          valor={def.id}
          onCambio={(seccion) => {
            if (sucio && !window.confirm('Hay cambios sin guardar en «' + def.t + '». ¿Descartarlos?')) return
            cambiar({ seccion })
          }}
        />
      </div>
      <p className="ds-body-sm">{def.d}</p>

      {contenido === null ? (
        <p className="count-note" role="status">
          Cargando…
        </p>
      ) : (
        <form
          noValidate
          className="gest-seccion"
          onSubmit={(e) => {
            e.preventDefault()
            guardar()
          }}
        >
          {def.tipo === 'texto' ? (
            <div className="f-field">
              <label htmlFor="sec-texto">{def.t}</label>
              <textarea
                id="sec-texto"
                className="ds-input"
                rows={3}
                maxLength={300}
                value={v.texto}
                onChange={(e) => {
                  setV({ ...v, texto: e.target.value })
                  setSucio(true)
                }}
              />
              <span className="f-hint">{v.texto.length} de 300 caracteres</span>
            </div>
          ) : (
            <>
              {def.nota && (
                <div className="f-field">
                  <label htmlFor="sec-nota">Nota debajo de la sección (opcional)</label>
                  <input
                    id="sec-nota"
                    className="ds-input"
                    maxLength={300}
                    value={v.nota}
                    onChange={(e) => {
                      setV({ ...v, nota: e.target.value })
                      setSucio(true)
                    }}
                  />
                </div>
              )}
              <ol className="gest-filas">
                {v.filas.map((fila, i) => (
                  <li key={i} className="gest-fila">
                    <fieldset>
                      <legend>Fila {i + 1}</legend>
                      <div className="gest-fila__campos">
                        {def.cols.map((c) => {
                          const id = `f${i}-${c.k}`
                          const x = fila[c.k]
                          if (c.tipo === 'check')
                            return (
                              <label key={c.k} className="check-inline">
                                <input type="checkbox" checked={!!x} onChange={(e) => cambiarFila(i, c.k, e.target.checked)} /> {c.t}
                              </label>
                            )
                          return (
                            <div key={c.k} className={'f-field' + (c.corto ? ' gest-corto' : '')}>
                              <label htmlFor={id}>{c.t}</label>
                              {c.tipo === 'color' ? (
                                <select id={id} className="ds-input" value={String(x ?? '')} onChange={(e) => cambiarFila(i, c.k, e.target.value)}>
                                  <option value="">—</option>
                                  {OPCIONES_COLOR.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input id={id} className="ds-input" value={String(x ?? '')} maxLength={c.max} onChange={(e) => cambiarFila(i, c.k, e.target.value)} />
                              )}
                              {c.tipo === 'imagen' && <SubirArchivo acepta="image/png,image/jpeg,image/webp" etiqueta="Subir imagen" onSubido={(url) => cambiarFila(i, c.k, url)} />}
                            </div>
                          )
                        })}
                      </div>
                      <div className="gest-acciones">
                        <button type="button" className="ds-btn ds-btn--ghost" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={`Subir la fila ${i + 1}`}>
                          ↑
                        </button>
                        <button type="button" className="ds-btn ds-btn--ghost" disabled={i === v.filas.length - 1} onClick={() => mover(i, 1)} aria-label={`Bajar la fila ${i + 1}`}>
                          ↓
                        </button>
                        <button
                          type="button"
                          className="ds-btn ds-btn--ghost gest-borrar"
                          onClick={() => {
                            setV((o) => ({ ...o, filas: o.filas.filter((_, j) => j !== i) }))
                            setSucio(true)
                          }}
                          aria-label={`Quitar la fila ${i + 1}`}
                        >
                          Quitar
                        </button>
                      </div>
                    </fieldset>
                  </li>
                ))}
              </ol>
              {v.filas.length < def.max && (
                <button
                  type="button"
                  className="ds-btn ds-btn--subtle"
                  onClick={() => {
                    setV((o) => ({ ...o, filas: [...o.filas, {}] }))
                    setSucio(true)
                  }}
                >
                  <span aria-hidden="true">＋</span> Agregar fila
                </button>
              )}
            </>
          )}

          {errores.length > 0 && (
            <div className="f-errs" role="alert">
              <b>Revisa estos datos</b>
              <ul>
                {errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {sucio && <Aviso>Hay cambios sin guardar.</Aviso>}
          <div>
            <button type="submit" className="ds-btn ds-btn--primary" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar «' + def.t + '»'}
            </button>
          </div>
        </form>
      )}
    </>
  )
}
