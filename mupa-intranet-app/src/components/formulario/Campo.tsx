/**
 * Un campo del formulario de solicitud (recursivo: las casillas pueden abrir
 * sub-campos y las listas que crecen repiten sus campos). Mismo marcado que el
 * prototipo (pages/formulario.css). El estado vive en paginas/Formulario.tsx.
 */
import React, { createContext, useContext } from 'react'

import { agregarItem, alternarCasilla, claves, conValor, idCampo, normalizarCedula, quitarItem, type Campo as TCampo, type Estado } from '../../lib/formularios'

type Ctx = {
  estado: Estado
  cambiar: (fn: (e: Estado) => Estado) => void
  /** Errores visibles (solo después del primer intento de enviar). */
  errores: Record<string, string>
}
export const FormCtx = createContext<Ctx | null>(null)
const useForm = () => useContext(FormCtx)!

/** Mueve el foco a un elemento cuando React ya lo pintó. */
const enfocar = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus())

const Req = ({ c }: { c: TCampo }) => (c.r ? <> <span className="f-req" aria-hidden="true">*</span></> : null)

const Pista = ({ c, id }: { c: TCampo; id: string }) => (c.hint ? <p className="f-hint" id={id + '-h'}>{c.hint}</p> : null)
const MsgError = ({ id, err }: { id: string; err?: string }) => (err ? <p className="f-err" id={id + '-e'}>{err}</p> : null)
const describe = (c: TCampo, id: string, err?: string) => [c.hint && id + '-h', err && id + '-e'].filter(Boolean).join(' ') || undefined

// Autocompletar solo en los datos propios (los de "Quién solicita").
const AUTOCOMPLETAR: Record<string, string> = { nombreCompleto: 'name', correo: 'email', extension: 'tel-extension' }

export function Campos({ campos, base }: { campos: TCampo[]; base: string }) {
  return (
    <div className="f-grid">
      {claves(campos).map((clave, n) => (
        <Campo key={clave} c={campos[n]} ruta={base + '_' + clave} />
      ))}
    </div>
  )
}

export function Campo({ c, ruta }: { c: TCampo; ruta: string }) {
  const { estado, cambiar, errores } = useForm()
  const id = idCampo(ruta)
  const err = errores[ruta]
  const clase = (extra: string) => 'f-field' + extra + (err ? ' is-invalid' : '')

  if (c.t === 'radio') {
    const v = estado.v[ruta] || ''
    return (
      <fieldset className={clase(' f-wide')}>
        <legend>{c.l}<Req c={c} /></legend>
        <Pista c={c} id={id} />
        <div className="f-opts" role="radiogroup" aria-describedby={describe(c, id, err)} aria-required={c.r || undefined}>
          {(c.opts || []).map((o, j) => (
            <label className="f-opt" key={o}>
              <input type="radio" id={j === 0 ? id : undefined} name={id} value={o} checked={v === o} onChange={() => cambiar((e) => conValor(e, ruta, o))} /> <span>{o}</span>
            </label>
          ))}
        </div>
        <MsgError id={id} err={err} />
      </fieldset>
    )
  }

  if (c.t === 'checks') {
    const marcadas = estado.c[ruta] || []
    return (
      <fieldset className={clase(' f-wide')}>
        <legend>{c.l}<Req c={c} /></legend>
        <Pista c={c} id={id} />
        <div className="f-checks" aria-describedby={describe(c, id, err)}>
          {(c.items || []).map((it, j) => {
            const on = marcadas.includes(j)
            const sub = id + '_c' + j + '-sub'
            return (
              <div key={j} className={'f-check' + (it.sub ? ' has-sub' : '') + (it.sub && on ? ' is-open' : '')}>
                <label className="f-opt">
                  <input
                    type="checkbox"
                    id={j === 0 ? id : undefined}
                    checked={on}
                    aria-controls={it.sub ? sub : undefined}
                    aria-expanded={it.sub ? on : undefined}
                    onChange={() => cambiar((e) => alternarCasilla(e, ruta, j))}
                  />{' '}
                  <span>{it.l}</span>
                </label>
                {it.sub && (
                  <div className="f-sub" id={sub} hidden={!on}>
                    {on && <Campos campos={it.sub} base={ruta + '_c' + j} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <MsgError id={id} err={err} />
      </fieldset>
    )
  }

  if (c.t === 'repeat') {
    const ids = estado.i[ruta] || []
    const min = c.min || 0
    const max = c.max || 5
    const nombre = (c.item || 'Elemento').toLowerCase()
    const agregar = () =>
      cambiar((e) => {
        const r = agregarItem(e, c, ruta)
        if (r.id !== null) enfocar(idCampo(ruta + '_i' + r.id + '_' + claves(c.fields || [])[0]))
        return r.estado
      })
    const quitar = (itemId: number, k: number) =>
      cambiar((e) => {
        const sig = ids[k + 1] ?? ids[k - 1]
        enfocar(sig !== undefined ? idCampo(ruta + '_i' + sig + '_' + claves(c.fields || [])[0]) : id)
        return quitarItem(e, ruta, itemId)
      })
    return (
      <div className={clase(' f-wide f-repeat')}>
        <div className="f-items">
          {ids.map((itemId, k) => (
            <div className="f-item" key={itemId}>
              <div className="f-item__head">
                <b>{(c.item || 'Elemento') + ' ' + (k + 1)}</b>
                {ids.length > min && (
                  <button type="button" className="f-item__del" aria-label={'Quitar ' + nombre + ' ' + (k + 1)} onClick={() => quitar(itemId, k)}>
                    ✕
                  </button>
                )}
              </div>
              <Campos campos={c.fields || []} base={ruta + '_i' + itemId} />
            </div>
          ))}
        </div>
        {ids.length < max && (
          <button type="button" id={id} className="ds-btn ds-btn--ghost f-add" onClick={agregar}>
            <span aria-hidden="true">＋</span> {c.add || 'Agregar'}
          </button>
        )}
        <MsgError id={id} err={err} />
      </div>
    )
  }

  // Texto, correo, teléfono, cédula, número, texto largo o lista.
  const v = estado.v[ruta] ?? ''
  const auto = estado.auto.includes(ruta)
  const comun = {
    id,
    name: id,
    className: 'ds-input',
    value: v,
    'aria-describedby': describe(c, id, err),
    'aria-invalid': err ? true : undefined,
    'aria-required': c.r || undefined,
  }
  const alCambiar = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const valor = e.target.value
    cambiar((s) => conValor(s, ruta, valor))
  }
  let control: React.ReactNode
  if (c.t === 'textarea') control = <textarea {...comun} rows={3} onChange={alCambiar} />
  else if (c.t === 'select') {
    control = (
      <select {...comun} onChange={alCambiar}>
        <option value="">Elige una opción…</option>
        {(c.opts || []).map((o) => <option key={o}>{o}</option>)}
      </select>
    )
  } else {
    control = (
      <input
        {...comun}
        type={c.t === 'email' ? 'email' : c.t === 'number' ? 'number' : 'text'}
        inputMode={c.t === 'tel' || c.t === 'number' ? 'numeric' : undefined}
        min={c.t === 'number' ? c.min || 0 : undefined}
        max={c.t === 'number' ? c.max : undefined}
        step={c.t === 'number' ? 1 : undefined}
        autoComplete={(c.auto && AUTOCOMPLETAR[c.auto]) || 'off'}
        spellCheck={c.t === 'cedula' ? false : undefined}
        onChange={alCambiar}
        onBlur={c.t === 'cedula' ? () => cambiar((s) => conValor(s, ruta, normalizarCedula(s.v[ruta] || ''))) : undefined}
      />
    )
  }
  return (
    <div className={clase((c.t === 'textarea' ? ' f-wide' : '') + (auto ? ' is-auto' : ''))}>
      <label htmlFor={id}>
        {c.l}
        <Req c={c} />
        {auto && <span className="f-chip">Del perfil</span>}
      </label>
      <Pista c={c} id={id} />
      {control}
      <MsgError id={id} err={err} />
    </div>
  )
}
