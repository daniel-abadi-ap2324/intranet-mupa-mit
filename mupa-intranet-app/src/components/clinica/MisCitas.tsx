/**
 * «Mis citas» en la página de la Clínica: las citas de la persona con sesión, leídas del sistema de la
 * Clínica por la cédula con la que entró (la API la saca de la sesión: aquí nunca se escribe ni se manda).
 * Sin conexión con la Clínica en este servidor no se muestra nada.
 */
import React, { useEffect, useState } from 'react'

import { api, ErrorApi } from '../../api'
import { useDatos } from '../../datos'
import { estadoCita, horaCita, separarCitas, tituloCita, type CitaClinica, type MisCitas as Datos } from '../../lib/clinica'
import { fechaLarga } from '../../lib/fechas'
import { SinLlave } from '../SinLlave'
import { EnlaceEntrar } from '../ui'

/** YYYY-MM-DD de hoy en hora de Panamá. */
const hoyPanama = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Panama' })

function Fila({ c }: { c: CitaClinica }) {
  const e = estadoCita(c.estado)
  const hora = horaCita(c.hora)
  const detalle = c.medico
  return (
    <li className="clin-cita">
      <div className="clin-cita__cuando">
        <b>{fechaLarga(c.fecha)}</b>
        {hora && <span>{hora}</span>}
      </div>
      <div className="clin-cita__que">
        <span>{tituloCita(c)}</span>
        {detalle && <span className="clin-cita__det">{detalle}</span>}
      </div>
      <span className={'clin-cita__estado is-' + e.tono}>{e.texto}</span>
    </li>
  )
}

export function MisCitas() {
  const { usuario } = useDatos()
  const idUsuario = usuario?.id
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (idUsuario === undefined) {
      setDatos(null)
      setError('')
      return
    }
    let vivo = true
    setCargando(true)
    setError('')
    api
      .misCitas()
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar tus citas. Inténtalo en unos minutos.'))
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [idUsuario])

  if (!usuario) {
    return (
      <section className="section" aria-labelledby="h-mis-citas">
        <header>
          <h2 id="h-mis-citas">Mis citas</h2>
        </header>
        <p className="clin-nota">
          <EnlaceEntrar>Inicia sesión</EnlaceEntrar> con tu cédula para ver tus citas.
        </p>
      </section>
    )
  }
  // Este servidor no tiene conectada la Clínica: la sección solo lo dice.
  if (datos && !datos.disponible)
    return (
      <section className="section" aria-labelledby="h-mis-citas">
        <header>
          <h2 id="h-mis-citas">Mis citas</h2>
        </header>
        <SinLlave que="Ver tus citas (sistema de la Clínica)" />
      </section>
    )

  const { proximas, historial } = datos ? separarCitas(datos.citas, hoyPanama()) : { proximas: [], historial: [] }
  return (
    <section className="section" aria-labelledby="h-mis-citas" aria-busy={cargando}>
      <header>
        <h2 id="h-mis-citas">Mis citas</h2>
        {datos?.esPaciente && <span className="n">{datos.total} en total</span>}
      </header>
      {cargando && !datos ? (
        <p className="clin-nota">Cargando tus citas…</p>
      ) : error ? (
        <p className="clin-nota" role="alert">
          {error}
        </p>
      ) : datos && !datos.cedulaConocida ? (
        <p className="clin-nota">No sabemos tu cédula en esta sesión. Cierra sesión y entra escribiéndola.</p>
      ) : datos && !datos.esPaciente ? (
        <p className="clin-nota">La Clínica todavía no tiene un expediente a tu nombre; se abre con tu primera cita.</p>
      ) : datos && !datos.citas.length ? (
        <p className="clin-nota">No tienes citas registradas.</p>
      ) : datos ? (
        <>
          <h3 className="cm-sub">Próximas</h3>
          {proximas.length ? (
            <ul className="clin-citas">
              {proximas.map((c) => (
                <Fila key={c.id} c={c} />
              ))}
            </ul>
          ) : (
            <p className="clin-nota">No tienes citas próximas.</p>
          )}
          {historial.length > 0 && (
            <>
              <h3 className="cm-sub">Historial</h3>
              <ul className="clin-citas">
                {historial.map((c) => (
                  <Fila key={c.id} c={c} />
                ))}
              </ul>
            </>
          )}
        </>
      ) : null}
    </section>
  )
}
