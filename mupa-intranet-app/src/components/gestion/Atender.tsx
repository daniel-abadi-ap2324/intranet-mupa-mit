/**
 * Atender solicitudes: cargar la bandeja (con los filtros y en vivo) y los
 * controles para cambiar el estado y responder. Los usan /gestion/solicitudes y
 * la bandeja del Centro de Gestión. La respuesta le llega a la persona en «Mis solicitudes».
 */
import React, { useEffect, useState } from 'react'

import { api, ErrorApi } from '../../api'
import { avisarCambioSolicitudes, RESPUESTAS_RAPIDAS } from '../../lib/gestion'
import { abierta, ESTADOS_SOLICITUD, type EstadoSolicitud, type SolicitudDetalle, type SolicitudGestion } from '../../lib/solicitudes'
import { mensaje } from '../../paginas/gestion/comun'
import { useSitio } from '../Proveedores'

export type FiltroBandeja = { estado: string; formulario: string; q: string; area?: 'rrhh' }

/** Carga la bandeja con esos filtros (estado: uno de la API, «todas», «abiertas» o «atrasadas») (con una pausa al escribir) y la vuelve a cargar si llega o se atiende una. */
export function useBandeja(f: FiltroBandeja): { lista: SolicitudGestion[] | null; error: string } {
  const [lista, setLista] = useState<SolicitudGestion[] | null>(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const otra = () => setTick((n) => n + 1)
    window.addEventListener('mupa:solicitudes', otra)
    return () => window.removeEventListener('mupa:solicitudes', otra)
  }, [])
  useEffect(() => {
    const t = setTimeout(() => {
      api
        .solicitudesGestion({
          // «Todas», «Abiertas» y «Atrasadas» no son estados de la API: las atrasadas las filtra el servidor (mismo criterio que la cifra).
          estado: ['todas', 'abiertas', 'atrasadas'].includes(f.estado) ? undefined : f.estado,
          atrasadas: f.estado === 'atrasadas',
          formulario: f.formulario || undefined,
          area: f.area,
          q: f.q,
        })
        .then((L) => {
          // "Abiertas" (recibidas y en revisión) se filtra aquí.
          setLista(f.estado === 'abiertas' ? L.filter((x) => abierta(x.estado)) : L)
          setError('')
        })
        .catch((e) => {
          setError(mensaje(e))
          setLista([])
        })
    }, 250)
    return () => clearTimeout(t)
  }, [f.estado, f.formulario, f.area, f.q, tick])
  return { lista, error }
}

/** Carga una solicitud. `setS` la reemplaza con lo que devuelve la API al atenderla. */
export function useSolicitud(id: number | null): { s: SolicitudDetalle | null; setS: (s: SolicitudDetalle) => void; error: string } {
  const [s, setS] = useState<SolicitudDetalle | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setS(null)
    setError('')
    if (!id) return
    let vivo = true
    api
      .solicitud(id)
      .then((r) => vivo && setS(r))
      .catch((e) => vivo && setError(e instanceof ErrorApi && e.estado === 404 ? 'Esa solicitud no existe.' : mensaje(e)))
    return () => {
      vivo = false
    }
  }, [id])
  return { s, setS, error }
}

/** El estado, las respuestas rápidas y la respuesta. Con «Enviar y marcar resuelta» se cierra en un solo paso. */
export function ControlesSolicitud({ s, onCambio }: { s: SolicitudDetalle; onCambio: (s: SolicitudDetalle) => void }) {
  const { avisar } = useSitio()
  const [texto, setTexto] = useState('')
  const [errorTexto, setErrorTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  // Otra solicitud: el borrador no se arrastra.
  useEffect(() => {
    setTexto('')
    setErrorTexto('')
  }, [s.id])

  const estado = async (v: EstadoSolicitud) => {
    setOcupado(true)
    try {
      onCambio(await api.cambiarEstadoSolicitud(s.id, v))
      avisarCambioSolicitudes()
      avisar('Estado cambiado: la persona lo verá en «Mis solicitudes»')
    } catch (e) {
      avisar(mensaje(e))
    } finally {
      setOcupado(false)
    }
  }
  const responder = async (cerrar: boolean) => {
    if (!texto.trim()) {
      setErrorTexto('Escribe la respuesta.')
      document.getElementById('sol-texto')?.focus()
      return
    }
    setOcupado(true)
    try {
      let r = await api.responderSolicitud(s.id, texto.trim())
      if (cerrar && r.estado !== 'resuelta') r = await api.cambiarEstadoSolicitud(s.id, 'resuelta')
      onCambio(r)
      setTexto('')
      avisarCambioSolicitudes()
      avisar(cerrar ? 'Respuesta enviada y solicitud resuelta' : 'Respuesta enviada')
    } catch (err) {
      setErrorTexto(mensaje(err))
    } finally {
      setOcupado(false)
    }
  }
  const usar = (i: number) => {
    const r = RESPUESTAS_RAPIDAS[i]
    setTexto(r.texto)
    setErrorTexto('')
    const campo = document.getElementById('sol-texto') as HTMLTextAreaElement | null
    campo?.focus()
    // El cursor al final, para completar la frase.
    requestAnimationFrame(() => campo?.setSelectionRange(r.texto.length, r.texto.length))
  }

  return (
    <div className="sol-controles">
      <label className="gest-select">
        <span>Estado</span>
        <select className="ds-input" value={s.estado} disabled={ocupado} onChange={(e) => estado(e.target.value as EstadoSolicitud)}>
          {ESTADOS_SOLICITUD.map((x) => (
            <option key={x.v} value={x.v}>
              {x.t}
            </option>
          ))}
        </select>
      </label>
      <form
        className="sol-responder"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          responder(false)
        }}
      >
        <div className="cg-rapidas" role="group" aria-label="Respuestas rápidas">
          <span>Respuestas rápidas:</span>
          {RESPUESTAS_RAPIDAS.map((r, i) => (
            <button key={r.t} type="button" className="chip-btn" onClick={() => usar(i)}>
              {r.t}
            </button>
          ))}
        </div>
        <div className={'f-field' + (errorTexto ? ' is-invalid' : '')}>
          <label htmlFor="sol-texto">Responder a {s.persona}</label>
          <textarea
            id="sol-texto"
            className="ds-input"
            rows={3}
            maxLength={2000}
            value={texto}
            aria-invalid={errorTexto ? true : undefined}
            aria-describedby={errorTexto ? 'sol-texto-err' : undefined}
            onChange={(e) => {
              setTexto(e.target.value)
              setErrorTexto('')
            }}
            onKeyDown={(e) => {
              // Ctrl/⌘ + Enter envía.
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                responder(false)
              }
            }}
            placeholder="Lo que la persona tiene que saber: qué se hizo, qué falta o qué debe hacer."
          />
          {errorTexto && (
            <p className="f-err" id="sol-texto-err">
              {errorTexto}
            </p>
          )}
        </div>
        <div className="cg-botones">
          <button type="submit" className="ds-btn ds-btn--primary" disabled={ocupado}>
            Enviar respuesta
          </button>
          {s.estado !== 'resuelta' && (
            <button type="button" className="ds-btn ds-btn--subtle" disabled={ocupado} onClick={() => responder(true)}>
              Enviar y marcar resuelta
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
