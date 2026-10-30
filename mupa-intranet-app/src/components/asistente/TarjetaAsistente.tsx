/**
 * Respuesta del asistente en la página (Inicio y Aplicaciones): la conversación,
 * "Seguir preguntando", la advertencia de verificar y la salida a la Mesa de Servicios.
 */
import React, { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'

import type { App } from '../../lib/catalogo'
import { Icono } from '../shell/Iconos'
import { Respuesta, useConversacion } from './conversacion'

export const MESA = 'Mesa de Servicios, ext. 1400'

export function TarjetaAsistente({ conv, apps }: { conv: ReturnType<typeof useConversacion>; apps: App[] }) {
  const id = useId()
  const [seguir, setSeguir] = useState('')
  const log = useRef<HTMLDivElement>(null)
  useEffect(() => {
    log.current?.lastElementChild?.scrollIntoView({ block: 'nearest' })
  }, [conv.turnos])

  return (
    <section className="home-asis" aria-labelledby={id + 't'}>
      <header>
        <span className="home-asis__ic ia-glow" aria-hidden="true">
          <Icono nombre="asistente" />
        </span>
        <h2 id={id + 't'}>Respuesta del asistente</h2>
        <button type="button" className="ds-btn ds-btn--ghost home-asis__nueva" disabled={conv.pensando} onClick={conv.reiniciar}>
          Nueva pregunta
        </button>
      </header>
      <div className="home-asis__log" ref={log} role="log" aria-live="polite" aria-busy={conv.pensando}>
        {conv.turnos.map((t) => (
          <Respuesta key={t.id} turno={t} apps={apps} />
        ))}
      </div>
      <form
        className="home-asis__form"
        onSubmit={async (e) => {
          e.preventDefault()
          const texto = seguir
          setSeguir('')
          if (!(await conv.preguntar(texto))) setSeguir(texto)
        }}
      >
        <label className="sr-only" htmlFor={id + 's'}>
          Seguir preguntando
        </label>
        <input
          id={id + 's'}
          className="ds-input"
          type="text"
          placeholder="Seguir preguntando…"
          maxLength={300}
          autoComplete="off"
          value={seguir}
          onChange={(e) => setSeguir(e.target.value)}
        />
        <button className="ds-btn ds-btn--primary" type="submit" disabled={conv.pensando || seguir.trim().length < 2}>
          Enviar
        </button>
      </form>
      <p className="home-asis__nota">
        Generado por IA en un servidor de la Alcaldía: verifica antes de actuar. No escribas cédulas, contraseñas ni datos personales. ¿No se resolvió?{' '}
        <Link to="/mesa-servicios">{MESA}</Link>.
      </p>
    </section>
  )
}
