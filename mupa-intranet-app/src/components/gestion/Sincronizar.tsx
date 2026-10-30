/**
 * «Sincronizar ahora» de los paneles de boletines y noticias: trae de mupa.gob.pa lo nuevo
 * (la API ya lo hace sola cada hora; esto es para no esperar). Si la sincronización no está
 * encendida en el servidor (sin WP_SYNC_URL), no se muestra nada.
 */
import React, { useEffect, useState } from 'react'

import { api, type EstadoSincronizacion, type ResultadoSincronizacion, type SeccionSincronizacion } from '../../api'
import { fechaHora, mensaje } from '../../paginas/gestion/comun'
import { useSitio } from '../Proveedores'

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

const resumen = (r: ResultadoSincronizacion) => {
  const parte = (nombre: string, s: SeccionSincronizacion | null, uno: string, varios: string) =>
    s ? `${nombre}: ${s.nuevos ? plural(s.nuevos, uno, varios) : 'nada nuevo'}${s.errores.length ? ` (${plural(s.errores.length, 'error', 'errores')})` : ''}` : null
  return [parte('Noticias', r.noticias, 'nueva', 'nuevas'), parte('Boletines', r.boletines, 'nuevo', 'nuevos')].filter(Boolean).join(' · ')
}

export function BotonSincronizar({ onTerminado }: { onTerminado: () => Promise<unknown> | void }) {
  const { avisar } = useSitio()
  const [estado, setEstado] = useState<EstadoSincronizacion | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    api.estadoSincronizacion().then(setEstado, () => setEstado(null))
  }, [])

  if (!estado?.enabled) return null

  /** La pasada corre en la API (la primera puede tardar minutos): se pregunta cada 2 s hasta que termina. */
  const sincronizar = async () => {
    setOcupado(true)
    try {
      let e = await api.sincronizar()
      while (e.running) {
        await new Promise((r) => setTimeout(r, 2000))
        e = await api.estadoSincronizacion()
      }
      setEstado(e)
      await onTerminado()
      if (e.last) avisar(resumen(e.last))
    } catch (e) {
      avisar(mensaje(e))
    } finally {
      setOcupado(false)
    }
  }

  const errores = [...(estado.last?.noticias?.errores ?? []), ...(estado.last?.boletines.errores ?? [])]
  return (
    <div className="gest-sync">
      <button type="button" className="ds-btn ds-btn--ghost" disabled={ocupado} onClick={sincronizar}>
        {ocupado ? 'Sincronizando…' : 'Sincronizar ahora'}
      </button>
      <span className="count-note" role="status">
        {estado.last ? `Con mupa.gob.pa: ${fechaHora(estado.last.finishedAt)} · ${resumen(estado.last)}` : `Con mupa.gob.pa cada ${estado.intervalMinutes} min.`}
        {errores.length > 0 && ` · Falló: ${errores[0]}`}
      </span>
    </div>
  )
}
