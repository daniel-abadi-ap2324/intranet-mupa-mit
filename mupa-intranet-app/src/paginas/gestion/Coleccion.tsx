/**
 * Lo común de los paneles de contenido de Comunicación (boletines, noticias,
 * videos): la tabla con filtro por estado, publicar u ocultar, eliminar con
 * confirmación, y el formulario del editor con sus errores por campo.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { ErrorApi } from '../../api'
import { useSitio } from '../../components/Proveedores'
import { Aviso, Chips, Dialogo } from '../../components/ui'
import { fechaHora, mensaje } from './comun'

type Base = { id: number; publicado: boolean; editado: string; editadoPor: string | null }
type Filtro = 'todos' | 'publicados' | 'ocultos'

export type PropsEditor<T> = { item: T | null; onCerrar: () => void; onGuardado: (x: T) => void }

export function ListaGestion<T extends Base>(p: {
  cargar: () => Promise<T[]>
  /** La primera columna es la principal (título). */
  columnas: { t: string; celda: (x: T) => React.ReactNode }[]
  nombre: (x: T) => string
  nuevo: string
  vacio: string
  /** Cómo se llama cada estado, en plural (filtros) y en singular (tabla). */
  estados: { publicados: string; ocultos: string; publicado: string; oculto: string }
  alternar: (x: T) => Promise<unknown>
  borrar: (x: T) => Promise<void>
  Editor: (props: PropsEditor<T>) => React.ReactElement
  /** Botones extra de la barra (p. ej. «Sincronizar ahora»); reciben cómo volver a pedir la lista. */
  acciones?: (recargar: () => Promise<void>) => React.ReactNode
}) {
  const { avisar } = useSitio()
  const [lista, setLista] = useState<T[] | null>(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  // undefined = cerrado; null = uno nuevo.
  const [editando, setEditando] = useState<T | null | undefined>(undefined)
  const [borrando, setBorrando] = useState<T | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const { cargar: pedir } = p

  const cargar = useCallback(async () => {
    try {
      setLista(await pedir())
      setErrorCarga('')
    } catch (e) {
      setErrorCarga(mensaje(e))
      setLista((l) => l ?? [])
    }
  }, [pedir])
  useEffect(() => {
    cargar()
  }, [cargar])

  const n = (f: Filtro) => (lista ?? []).filter((x) => f === 'todos' || (f === 'publicados') === x.publicado).length
  const visibles = (lista ?? []).filter((x) => filtro === 'todos' || (filtro === 'publicados') === x.publicado)

  const accion = async (fn: () => Promise<unknown>, ok: string) => {
    setOcupado(true)
    try {
      await fn()
      await cargar()
      avisar(ok)
    } catch (e) {
      avisar(mensaje(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <div className="toolbar">
        <Chips<Filtro>
          etiqueta="Filtrar por estado"
          opciones={[
            { v: 'todos', t: 'Todos', n: n('todos') },
            { v: 'publicados', t: p.estados.publicados, n: n('publicados') },
            { v: 'ocultos', t: p.estados.ocultos, n: n('ocultos') },
          ]}
          valor={filtro}
          onCambio={setFiltro}
        />
        {p.acciones?.(cargar)}
        <button type="button" className="ds-btn ds-btn--primary gest-nuevo" onClick={() => setEditando(null)}>
          <span aria-hidden="true">＋</span> {p.nuevo}
        </button>
      </div>

      {errorCarga && <Aviso tipo="warn">{errorCarga}</Aviso>}

      {lista === null ? (
        <p className="count-note" role="status">
          Cargando…
        </p>
      ) : !visibles.length ? (
        <p className="empty show">{lista.length ? 'No hay elementos con ese estado.' : p.vacio}</p>
      ) : (
        <div className="table-wrap">
          <table className="ds-table gest-tabla">
            <thead>
              <tr>
                {p.columnas.map((c) => (
                  <th key={c.t} scope="col">
                    {c.t}
                  </th>
                ))}
                <th scope="col">Estado</th>
                <th scope="col">Última edición</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((x) => (
                <tr key={x.id}>
                  {p.columnas.map((c, i) => (
                    <td key={c.t} data-t={i ? c.t : undefined}>
                      {c.celda(x)}
                    </td>
                  ))}
                  <td data-t="Estado">
                    <span className={'tagline' + (x.publicado ? ' tagline--ok' : ' tagline--warn')}>{x.publicado ? p.estados.publicado : p.estados.oculto}</span>
                  </td>
                  <td data-t="Editado">
                    {fechaHora(x.editado)}
                    {x.editadoPor && <span className="gest-det">{x.editadoPor}</span>}
                  </td>
                  <td className="gest-acts">
                    <div className="gest-acciones">
                      <button type="button" className="ds-btn ds-btn--ghost" disabled={ocupado} onClick={() => setEditando(x)} aria-label={'Editar «' + p.nombre(x) + '»'}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="ds-btn ds-btn--ghost"
                        disabled={ocupado}
                        onClick={() => accion(() => p.alternar(x), x.publicado ? 'Ya no se ve en la intranet' : 'Publicado')}
                        aria-label={(x.publicado ? 'Ocultar «' : 'Publicar «') + p.nombre(x) + '»'}
                      >
                        {x.publicado ? 'Ocultar' : 'Publicar'}
                      </button>
                      <button type="button" className="ds-btn ds-btn--ghost gest-borrar" disabled={ocupado} onClick={() => setBorrando(x)} aria-label={'Eliminar «' + p.nombre(x) + '»'}>
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
        <p.Editor
          item={editando}
          onCerrar={() => setEditando(undefined)}
          onGuardado={async (x) => {
            setEditando(undefined)
            await cargar()
            avisar(x.publicado ? 'Guardado y publicado' : 'Guardado sin publicar')
          }}
        />
      )}

      {borrando && (
        <Dialogo
          id="colBorrar"
          titulo="Eliminar"
          onCerrar={() => setBorrando(null)}
          pie={
            <div className="home-dlg__foot">
              <button type="button" className="ds-btn ds-btn--ghost" data-foco onClick={() => setBorrando(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="ds-btn ds-btn--primary gest-borrar--si"
                disabled={ocupado}
                onClick={async () => {
                  const x = borrando
                  setBorrando(null)
                  await accion(() => p.borrar(x), 'Eliminado')
                  document.querySelector<HTMLElement>('.gest-nuevo')?.focus()
                }}
              >
                Eliminar
              </button>
            </div>
          }
        >
          <div className="home-dlg__body">
            <p className="ds-body">Se borra «{p.nombre(borrando)}» y no se puede recuperar. Si solo quieres sacarlo de la intranet, usa «Ocultar».</p>
          </div>
        </Dialogo>
      )}
    </>
  )
}

/** Estado y ayudas del formulario de un editor: campos, errores por campo (propios y del backend) y envío. */
export function useEditor<B extends Record<string, unknown>>(inicial: B) {
  const [d, setD] = useState<B>(inicial)
  const [errores, setErrores] = useState<Partial<Record<keyof B, string>>>({})
  const [general, setGeneral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const form = useRef<HTMLFormElement>(null)

  const poner = <K extends keyof B>(k: K, v: B[K]) => {
    setD((x) => ({ ...x, [k]: v }))
    setErrores((e) => ({ ...e, [k]: undefined }))
  }

  /** Revisa, envía y reparte los errores del backend (sus campos se llaman igual que los del borrador). */
  const enviar = async (locales: Partial<Record<keyof B, string>>, fn: () => Promise<void>) => {
    setGeneral('')
    if (Object.values(locales).some(Boolean)) {
      setErrores(locales)
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setEnviando(true)
    try {
      await fn()
    } catch (err) {
      if (err instanceof ErrorApi && err.campos.length) {
        const porCampo: Partial<Record<keyof B, string>> = {}
        for (const c of err.campos) {
          if (c.field in d) porCampo[c.field as keyof B] = c.message
          else setGeneral(c.message)
        }
        setErrores(porCampo)
      } else {
        setGeneral(mensaje(err))
      }
    } finally {
      setEnviando(false)
    }
  }

  const campo = (k: keyof B) => ({
    id: 'ed-' + String(k),
    'aria-invalid': errores[k] ? true : undefined,
    'aria-describedby': errores[k] ? 'ed-' + String(k) + '-err' : undefined,
  })
  const error = (k: keyof B) =>
    errores[k] ? (
      <p className="f-err" id={'ed-' + String(k) + '-err'}>
        {errores[k]}
      </p>
    ) : null
  const cls = (k: keyof B, extra = '') => 'f-field' + extra + (errores[k] ? ' is-invalid' : '')

  return { d, poner, enviar, enviando, general, form, campo, error, cls }
}

/** Pie del editor: Cancelar y Guardar. */
export function PieEditor({ onCerrar, enviando }: { onCerrar: () => void; enviando: boolean }) {
  return (
    <div className="home-dlg__foot gest-pie">
      <button type="button" className="ds-btn ds-btn--ghost" onClick={onCerrar}>
        Cancelar
      </button>
      <button type="submit" className="ds-btn ds-btn--primary" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  )
}
