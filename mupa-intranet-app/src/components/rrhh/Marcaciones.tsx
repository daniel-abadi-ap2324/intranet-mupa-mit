/**
 * Mis marcaciones: el mes en un calendario (de lunes a domingo) con el color de cada
 * día, el resumen del mes y el detalle del día elegido. En el teléfono, una lista.
 */
import React, { useState } from 'react'

import { api } from '../../api'
import { diaLargo, hoyIso } from '../../lib/fechas'
import { duracion, moverMes, nombreMes, semanasDelMes, tipoDia, type DiaMarcacion } from '../../lib/rrhh'
import { FilaKpi, Kpi } from '../gestion/Piezas'
import { Cargando, Datos, ErrorCarga, useRrhh } from './comun'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function Detalle({ fecha, d }: { fecha: string; d: DiaMarcacion | null }) {
  const { tipo, etiqueta } = tipoDia(d)
  const hora = (h: string | null) => (h && h !== '00:00' ? h : null)
  const tiempo = (h: string | null) => (h && h !== '00:00' ? duracion(h) : null)
  return (
    <div className="rh-dia-detalle" aria-live="polite">
      <h3>{diaLargo(fecha)}</h3>
      <p>
        <span className={'rh-estado rh-estado--' + tipo}>{etiqueta}</span>
      </p>
      {d && (
        <Datos
          filas={[
            ['Entrada', hora(d.entrada)],
            ['Salida', hora(d.salida)],
            ['Horas trabajadas', tiempo(d.horas)],
            ['Tardanza', tiempo(d.tardanza)],
            ['Llegó antes', tiempo(d.entradaAntes)],
            ['Salió antes', tiempo(d.salidaAnticipada)],
            ['Sobretiempo', tiempo(d.sobretiempo)],
          ]}
        />
      )}
    </div>
  )
}

export function Marcaciones({ alDesconectar }: { alDesconectar: () => void }) {
  const hoy = hoyIso()
  const [mes, setMes] = useState(() => ({ anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)) }))
  const [elegido, setElegido] = useState<string | null>(null)
  const { datos: respuesta, error, recargar } = useRrhh(() => api.rrhhMarcaciones(mes.anio, mes.mes), alDesconectar, [mes.anio, mes.mes])
  // Mientras llega el mes nuevo no se muestra el anterior: con el título ya cambiado, un clic caería en otro día.
  const datos = respuesta && respuesta.anio === mes.anio && respuesta.mes === mes.mes ? respuesta : null
  const esMesActual = mes.anio === Number(hoy.slice(0, 4)) && mes.mes === Number(hoy.slice(5, 7))

  function ir(delta: number) {
    setMes((m) => moverMes(m.anio, m.mes, delta))
    setElegido(null)
  }

  const semanas = datos ? semanasDelMes(datos.anio, datos.mes, datos.dias) : []
  const delMes = semanas.flat().filter((c) => c !== null)
  const sel = elegido ? delMes.find((c) => c.fecha === elegido) : undefined

  return (
    <div className="rh-marc">
      <div className="rh-mes-nav">
        <button type="button" className="ds-btn ds-btn--ghost" onClick={() => ir(-1)} aria-label="Mes anterior">
          ‹ Anterior
        </button>
        <h3 aria-live="polite">{nombreMes(mes.anio, mes.mes)}</h3>
        <button type="button" className="ds-btn ds-btn--ghost" onClick={() => ir(1)} disabled={esMesActual} aria-label="Mes siguiente">
          Siguiente ›
        </button>
      </div>

      {!datos && !error && <Cargando t="Cargando tus marcaciones…" />}
      {error && <ErrorCarga t={error} reintentar={recargar} />}
      {datos && (
        <>
          <FilaKpi etiqueta={'Resumen de ' + nombreMes(datos.anio, datos.mes)}>
            <Kpi tono="verde" icono="listo" valor={datos.resumen.presentes} etiqueta="A tiempo" />
            <Kpi tono="ambar" icono="reloj" valor={datos.resumen.tardanzas} etiqueta="Con tardanza" />
            <Kpi tono="rojo" icono="alerta" valor={datos.resumen.ausencias} etiqueta="Ausencias" />
            <Kpi tono="gris" icono="calendario" valor={datos.resumen.libres} etiqueta="Días libres" />
          </FilaKpi>
          {datos.horario && <p className="rh-nota">Tu horario: {datos.horario}</p>}

          <div className="rh-cal-wrap">
            <table className="rh-cal" aria-label={'Marcaciones de ' + nombreMes(datos.anio, datos.mes)}>
              <thead>
                <tr>
                  {DIAS.map((d) => (
                    <th key={d} scope="col">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {semanas.map((s, i) => (
                  <tr key={i}>
                    {s.map((c, j) => {
                      if (!c) return <td key={j} className="rh-cal__vacio" />
                      const futuro = c.fecha > hoy
                      const { tipo, etiqueta } = futuro ? { tipo: 'futuro', etiqueta: 'Todavía no' } : tipoDia(c.dato)
                      return (
                        <td key={j}>
                          <button
                            type="button"
                            className={'rh-cal__dia rh-cal__dia--' + tipo + (c.fecha === elegido ? ' is-elegido' : '') + (c.fecha === hoy ? ' is-hoy' : '')}
                            onClick={() => setElegido(c.fecha)}
                            disabled={futuro}
                            aria-pressed={c.fecha === elegido}
                            aria-label={diaLargo(c.fecha) + ': ' + etiqueta}
                          >
                            <span className="n">{c.dia}</span>
                            {!futuro && c.dato?.entrada && c.dato.entrada !== '00:00' && (
                              <span className="h">
                                {c.dato.entrada}
                                {c.dato.salida && c.dato.salida !== c.dato.entrada ? '–' + c.dato.salida : ''}
                              </span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="rh-leyenda" aria-label="Qué significa cada color">
            {[
              ['presente', 'A tiempo'],
              ['tardanza', 'Tardanza'],
              ['incompleta', 'Falta una marcación'],
              ['ausencia', 'Ausencia'],
              ['justificada', 'Justificada'],
              ['feriado', 'Feriado'],
              ['libre', 'Día libre'],
            ].map(([t, e]) => (
              <li key={t}>
                <span className={'rh-punto rh-punto--' + t} aria-hidden="true" />
                {e}
              </li>
            ))}
          </ul>

          {sel ? <Detalle fecha={sel.fecha} d={sel.dato} /> : <p className="rh-nota">Elige un día para ver sus marcaciones.</p>}
        </>
      )}
    </div>
  )
}
