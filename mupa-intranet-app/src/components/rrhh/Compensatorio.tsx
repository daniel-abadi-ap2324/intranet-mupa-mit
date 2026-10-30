/**
 * Tiempo compensatorio (RRHH Express): saldo por bolsa (entrada anticipada y sobretiempo),
 * lo que vence pronto y las solicitudes. Desde aquí se pide acreditar un día trabajado de
 * más o usar tiempo; lo aprueba el supervisor en RH Link.
 */
import React, { useEffect, useState } from 'react'

import { api, ErrorApi } from '../../api'
import { fechaCorta, hoyIso } from '../../lib/fechas'
import { BOLSA, ESTADO_SOLICITUD, minutosAHoras, type Bolsa, type Compensatorio as Datos, type DiaReclamable, type SolicitudCompensatorio } from '../../lib/rrhh'
import { Avance } from '../gestion/Piezas'
import { Aviso, Dialogo } from '../ui'
import { Cargando, ErrorCarga, esDesconexion, mensajeRrhh } from './comun'

type Props = { datos: Datos | null; error: string | null; cargando: boolean; recargar: () => void; alDesconectar: () => void }

function cantidad(s: SolicitudCompensatorio): string {
  if (s.unidad === 'DIAS' && s.dias) return s.dias + (s.dias === 1 ? ' día' : ' días')
  return s.minutos !== null ? minutosAHoras(s.minutos) : '—'
}

function fechas(s: SolicitudCompensatorio): string {
  if (s.clase === 'ACREDITACION') return s.fechaTrabajada ? 'Trabajado el ' + fechaCorta(s.fechaTrabajada) : '—'
  if (!s.desde) return '—'
  return s.hasta && s.hasta !== s.desde ? fechaCorta(s.desde) + ' al ' + fechaCorta(s.hasta) : fechaCorta(s.desde)
}

/** Errores del formulario: los de RRHH (saldo insuficiente…) y los de validación. */
function useEnvio(alDesconectar: () => void, alTerminar: (mensaje: string) => void) {
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  async function enviar(fn: () => Promise<string | null>, exito: string) {
    setEnviando(true)
    setError(null)
    try {
      alTerminar((await fn()) || exito)
    } catch (e) {
      setEnviando(false)
      if (esDesconexion(e)) return alDesconectar()
      setError(e instanceof ErrorApi && e.campos.length ? e.campos.map((c) => c.message).join(' ') : mensajeRrhh(e))
    }
  }
  return { error, enviando, enviar }
}

function PedirAcreditacion({ onCerrar, alDesconectar, alTerminar }: { onCerrar: () => void; alDesconectar: () => void; alTerminar: (m: string) => void }) {
  const [dias, setDias] = useState<DiaReclamable[] | null>(null)
  const [cargaError, setCargaError] = useState<string | null>(null)
  const [elegido, setElegido] = useState('')
  const [motivo, setMotivo] = useState('')
  const { error, enviando, enviar } = useEnvio(alDesconectar, alTerminar)

  useEffect(() => {
    const hasta = hoyIso()
    const d = new Date()
    d.setDate(d.getDate() - 90)
    api
      .rrhhReclamables(hoyIso(d), hasta)
      .then(setDias)
      .catch((e) => (esDesconexion(e) ? alDesconectar() : setCargaError(mensajeRrhh(e))))
  }, [alDesconectar])

  const dia = dias?.find((x) => x.fecha + '|' + x.bolsa === elegido)
  return (
    <Dialogo
      id="rh-acreditar"
      titulo="Pedir acreditación"
      onCerrar={onCerrar}
      pie={
        <div className="home-dlg__foot">
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            disabled={!dia || enviando}
            onClick={() => dia && enviar(() => api.rrhhAcreditar({ bolsa: dia.bolsa as Bolsa, fecha: dia.fecha, motivo }), 'Solicitud de acreditación enviada.')}
          >
            {enviando ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      }
    >
      <div className="home-dlg__body rh-form">
        <p className="rh-nota">Los días de los últimos 90 en que tu marcación registró tiempo de más. Tu supervisor aprueba la solicitud en RRHH.</p>
        {cargaError && <Aviso tipo="warn">{cargaError}</Aviso>}
        {!dias && !cargaError && <Cargando t="Buscando días…" />}
        {dias && !dias.length && <p className="rh-vacio">No tienes días con tiempo de más por reclamar.</p>}
        {dias && dias.length > 0 && (
          <fieldset className="rh-opciones">
            <legend>Día trabajado</legend>
            {dias.map((x) => {
              const v = x.fecha + '|' + x.bolsa
              return (
                <label key={v} className="rh-opcion">
                  <input type="radio" name="rh-dia" value={v} checked={elegido === v} onChange={() => setElegido(v)} />
                  <span>
                    <b>{fechaCorta(x.fecha)}</b> · {BOLSA[x.bolsa as Bolsa] ?? x.bolsa} · {minutosAHoras(x.minutos)}
                  </span>
                </label>
              )
            })}
          </fieldset>
        )}
        <div className="f-field">
          <label htmlFor="rh-acr-motivo">Motivo (opcional)</label>
          <textarea id="rh-acr-motivo" className="ds-input" rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        {error && (
          <div className="login__error" role="alert">
            <span className="ic" aria-hidden="true">!</span>
            <p>{error}</p>
          </div>
        )}
      </div>
    </Dialogo>
  )
}

function UsarTiempo({ datos, onCerrar, alDesconectar, alTerminar }: { datos: Datos; onCerrar: () => void; alDesconectar: () => void; alTerminar: (m: string) => void }) {
  const [bolsa, setBolsa] = useState<Bolsa>(datos.bolsas.DESPUES.disponible >= datos.bolsas.ANTES.disponible ? 'DESPUES' : 'ANTES')
  const [unidad, setUnidad] = useState<'HORAS' | 'DIAS'>('HORAS')
  const [cant, setCant] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [motivo, setMotivo] = useState('')
  const { error, enviando, enviar } = useEnvio(alDesconectar, alTerminar)
  const n = Number(cant.replace(',', '.'))
  const valido = n > 0 && !!desde && (!hasta || hasta >= desde)

  return (
    <Dialogo
      id="rh-usar"
      titulo="Usar tiempo compensatorio"
      onCerrar={onCerrar}
      pie={
        <div className="home-dlg__foot">
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            disabled={!valido || enviando}
            onClick={() => enviar(() => api.rrhhUsar({ bolsa, unidad, cantidad: n, desde, hasta: unidad === 'DIAS' ? hasta : undefined, motivo }), 'Solicitud enviada.')}
          >
            {enviando ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      }
    >
      <div className="home-dlg__body rh-form">
        <div className="f-field">
          <label htmlFor="rh-uso-bolsa">De qué tiempo</label>
          <select id="rh-uso-bolsa" className="ds-input" value={bolsa} onChange={(e) => setBolsa(e.target.value as Bolsa)}>
            {(['DESPUES', 'ANTES'] as Bolsa[]).map((b) => (
              <option key={b} value={b}>
                {BOLSA[b]} · disponible {minutosAHoras(datos.bolsas[b].disponible)}
              </option>
            ))}
          </select>
        </div>
        <div className="rh-form__fila">
          <div className="f-field">
            <label htmlFor="rh-uso-unidad">En</label>
            <select id="rh-uso-unidad" className="ds-input" value={unidad} onChange={(e) => setUnidad(e.target.value as 'HORAS' | 'DIAS')}>
              <option value="HORAS">Horas</option>
              <option value="DIAS">Días</option>
            </select>
          </div>
          <div className="f-field">
            <label htmlFor="rh-uso-cant">Cantidad</label>
            <input id="rh-uso-cant" className="ds-input" type="number" inputMode="decimal" min={unidad === 'HORAS' ? 0.5 : 1} step={unidad === 'HORAS' ? 0.5 : 1} value={cant} onChange={(e) => setCant(e.target.value)} />
          </div>
        </div>
        {unidad === 'DIAS' && datos.jornadaMin && <p className="rh-nota">Un día de tu jornada son {minutosAHoras(datos.jornadaMin)}.</p>}
        <div className="rh-form__fila">
          <div className="f-field">
            <label htmlFor="rh-uso-desde">{unidad === 'DIAS' ? 'Desde' : 'Fecha'}</label>
            <input id="rh-uso-desde" className="ds-input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          {unidad === 'DIAS' && (
            <div className="f-field">
              <label htmlFor="rh-uso-hasta">Hasta (opcional)</label>
              <input id="rh-uso-hasta" className="ds-input" type="date" min={desde || undefined} value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          )}
        </div>
        <div className="f-field">
          <label htmlFor="rh-uso-motivo">Motivo (opcional)</label>
          <textarea id="rh-uso-motivo" className="ds-input" rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        {error && (
          <div className="login__error" role="alert">
            <span className="ic" aria-hidden="true">!</span>
            <p>{error}</p>
          </div>
        )}
      </div>
    </Dialogo>
  )
}

export function Compensatorio({ datos, error, cargando, recargar, alDesconectar }: Props) {
  const [dialogo, setDialogo] = useState<'acreditar' | 'usar' | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState<number | null>(null)

  function terminar(m: string) {
    setDialogo(null)
    setAviso(m)
    recargar()
  }

  async function cancelar(s: SolicitudCompensatorio) {
    if (!window.confirm('¿Cancelar esta solicitud?')) return
    setCancelando(s.id)
    try {
      await api.rrhhCancelar(s.id)
      setAviso('Solicitud cancelada.')
      recargar()
    } catch (e) {
      if (esDesconexion(e)) alDesconectar()
      else setAviso(mensajeRrhh(e))
    } finally {
      setCancelando(null)
    }
  }

  if (cargando && !datos) return <Cargando t="Cargando tu tiempo compensatorio…" />
  if (error && !datos) return <ErrorCarga t={error} reintentar={recargar} />
  if (!datos) return null

  const bolsa = (b: Bolsa) => {
    const s = datos.bolsas[b]
    const total = s.disponible + s.usado + s.vencido + s.pendiente
    return (
      <Avance
        key={b}
        t={BOLSA[b]}
        n={s.disponible}
        de={total}
        tono={b === 'DESPUES' ? 'azul' : 'cian'}
        detalle={`Disponible ${minutosAHoras(s.disponible)} · en trámite ${minutosAHoras(s.pendiente)} · usado ${minutosAHoras(s.usado)}` + (s.vencido ? ` · vencido ${minutosAHoras(s.vencido)}` : '')}
      />
    )
  }

  return (
    <div className="rh-comp">
      {aviso && (
        <div role="status">
          <Aviso ic="✓">{aviso}</Aviso>
        </div>
      )}
      <div className="rh-comp__top">
        <div className="rh-comp__total">
          <span className="k">Disponible</span>
          <span className="v">{minutosAHoras(datos.totalDisponible)}</span>
          {datos.jornadaMin ? <span className="d">Tu jornada: {minutosAHoras(datos.jornadaMin)} al día</span> : null}
        </div>
        <div className="rh-comp__acciones">
          <button type="button" className="ds-btn ds-btn--primary" onClick={() => (setAviso(null), setDialogo('usar'))} disabled={datos.totalDisponible <= 0}>
            Usar tiempo
          </button>
          <button type="button" className="ds-btn ds-btn--ghost" onClick={() => (setAviso(null), setDialogo('acreditar'))}>
            Pedir acreditación
          </button>
        </div>
      </div>

      <div className="rh-comp__bolsas">{(['DESPUES', 'ANTES'] as Bolsa[]).map(bolsa)}</div>

      {datos.vencimientos.length > 0 && (
        <>
          <h3 className="rh-sub">Vence pronto</h3>
          <ul className="rh-venc">
            {datos.vencimientos.map((v, i) => (
              <li key={i}>
                <b>{minutosAHoras(v.minutos)}</b> de {BOLSA[v.bolsa as Bolsa]?.toLowerCase() ?? v.bolsa} vence{v.fecha ? ' el ' + fechaCorta(v.fecha) : ''}
                {v.diasRestantes !== null && <span className={'rh-venc__d' + (v.diasRestantes <= 30 ? ' is-pronto' : '')}> (en {v.diasRestantes} días)</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="rh-sub">Tus solicitudes</h3>
      {!datos.solicitudes.length ? (
        <p className="rh-vacio">Todavía no has hecho solicitudes de tiempo compensatorio.</p>
      ) : (
        <div className="rh-tabla-wrap">
          <table className="ds-table rh-tabla">
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Fecha</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {datos.solicitudes.map((s) => {
                const e = ESTADO_SOLICITUD[s.estado ?? ''] ?? { t: s.estado ?? '—', tono: null }
                return (
                  <tr key={s.id}>
                    <td>
                      {s.clase === 'ACREDITACION' ? 'Acreditación' : 'Uso'}
                      <span className="rh-tabla__sub">{BOLSA[s.bolsa as Bolsa] ?? s.bolsa}</span>
                    </td>
                    <td>{cantidad(s)}</td>
                    <td>{fechas(s)}</td>
                    <td>
                      <span className={'tagline' + (e.tono ? ' tagline--' + e.tono : '')}>{e.t}</span>
                      {s.motivoRechazo && <span className="rh-tabla__sub">{s.motivoRechazo}</span>}
                    </td>
                    <td>
                      {s.estado === 'PENDIENTE' && (
                        <button type="button" className="ds-btn ds-btn--ghost rh-btn-sm" onClick={() => cancelar(s)} disabled={cancelando === s.id}>
                          {cancelando === s.id ? 'Cancelando…' : 'Cancelar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialogo === 'acreditar' && <PedirAcreditacion onCerrar={() => setDialogo(null)} alDesconectar={alDesconectar} alTerminar={terminar} />}
      {dialogo === 'usar' && <UsarTiempo datos={datos} onCerrar={() => setDialogo(null)} alDesconectar={alDesconectar} alTerminar={terminar} />}
    </div>
  )
}
