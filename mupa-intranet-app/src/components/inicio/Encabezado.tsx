/**
 * Bloque fijo del Inicio (no se puede quitar ni mover, sí cambiar de tamaño): el
 * saludo y, lo más importante, UNA caja "¿Qué necesitas hoy?" que sirve para dos cosas:
 *  - Buscar: mientras se escribe, los resultados aparecen debajo, agrupados por tipo
 *    (aplicaciones, personas, documentos, páginas, enlaces; formularios y noticias si están activos).
 *  - «Pregúntale al asistente» (en los resultados): el mismo texto se abre en la página del asistente
 *    de los resultados, con la advertencia de verificar y la salida a la Mesa de Servicios.
 * Sigue lo que recomiendan NN/g y GOV.UK: caja visible y ancha, sugerencias que dan
 * resultados, resultados agrupados y una salida útil cuando no hay resultados.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { api } from '../../api'
import { agrupar, buscar, type Resultado } from '../../lib/busqueda'
import { MESA } from '../asistente/TarjetaAsistente'
import { Icono } from '../shell/Iconos'
import { MarcaExterna } from '../ui'

const POR_GRUPO = 4

type Props = { nombre: string | null; indice: Resultado[] }

export function Encabezado({ nombre, indice }: Props) {
  const [ahora, setAhora] = useState<Date | null>(null)
  useEffect(() => setAhora(new Date()), [])
  const h = ahora?.getHours() ?? 9
  const saludo = (h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches') + (nombre ? ', ' + nombre : '')
  const hoy = ahora ? ahora.toLocaleDateString('es-PA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ' '

  const [q, setQ] = useState('')
  const [aviso, setAviso] = useState('')
  const [disponible, setDisponible] = useState(false)
  const navegar = useNavigate()
  const entrada = useRef<HTMLInputElement>(null)
  const zona = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let vivo = true
    api.estadoAsistente().then((d) => vivo && setDisponible(d))
    return () => {
      vivo = false
    }
  }, [])

  // En el Inicio, Ctrl/⌘+K lleva a esta caja (la de la barra superior no se muestra aquí).
  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        entrada.current?.focus()
        entrada.current?.select()
      }
    }
    document.addEventListener('keydown', atajo)
    return () => document.removeEventListener('keydown', atajo)
  }, [])

  const texto = q.trim()
  const grupos = useMemo(() => (texto.length >= 2 ? agrupar(buscar(indice, texto, 'todo', 500).hits) : []), [indice, texto])
  const total = grupos.reduce((n, g) => n + g.items.length, 0)

  function preguntar(pregunta = q) {
    const p = pregunta.trim()
    if (p.length < 2) {
      setAviso('Escribe tu pregunta en la caja y vuelve a pulsar «Preguntar al asistente».')
      entrada.current?.focus()
      return
    }
    setAviso('')
    // La conversación sigue en la página del asistente (oct-2026): el Inicio queda corto y limpio.
    navegar('/asistente?q=' + encodeURIComponent(p))
  }

  const teclas = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && q) {
      e.preventDefault()
      setQ('')
    } else if (e.key === 'ArrowDown' && total) {
      e.preventDefault()
      zona.current?.querySelector<HTMLElement>('.home-res__grupo a')?.focus()
    }
  }

  // Flechas dentro de los resultados: de un enlace al siguiente.
  const flechas = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const enlaces = [...(zona.current?.querySelectorAll<HTMLElement>('.home-res__grupo a') ?? [])]
    const i = enlaces.indexOf(document.activeElement as HTMLElement)
    if (i < 0) return
    e.preventDefault()
    if (e.key === 'ArrowUp' && i === 0) return entrada.current?.focus()
    enlaces[Math.min(enlaces.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus()
  }

  const hayAlgo = texto.length >= 2

  return (
    <div className="home-encabezado">
      <section className="hero hero--buscar" aria-labelledby="inicio-t">
        <p className="date">{hoy}</p>
        <h1 id="inicio-t">{saludo}</h1>

        <form
          className="home-search"
          role="search"
          aria-label="Buscar en la intranet"
          onSubmit={(e) => {
            e.preventDefault()
            if (texto.length >= 2) zona.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          }}
        >
          <label className="home-search__label" htmlFor="inicio-q">
            ¿Qué necesitas hoy?
          </label>
          <div className="home-search__fila">
            <Icono nombre="buscar" className="home-search__ic" />
            <input
              ref={entrada}
              id="inicio-q"
              className="home-search__input"
              type="search"
              placeholder="Ej.: carta de trabajo, correo, agendar cita"
              autoComplete="off"
              maxLength={300}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setAviso('')
              }}
              onKeyDown={teclas}
              aria-controls="inicio-resultados"
            />
            <button type="submit" className="ds-btn home-search__buscar">
              Buscar
            </button>
          </div>
          {aviso && (
            <p className="home-search__aviso" role="status">
              {aviso}
            </p>
          )}
        </form>

      </section>

      <div className="home-resultados" id="inicio-resultados" ref={zona} hidden={!hayAlgo} onKeyDown={flechas}>
        {texto.length >= 2 && <Resultados q={texto} grupos={grupos} total={total} disponible={disponible} onPreguntar={() => preguntar()} />}
      </div>
      <p className="sr-only" aria-live="polite">
        {texto.length >= 2 ? (total ? `${total} ${total === 1 ? 'resultado' : 'resultados'} para ${texto}` : `Sin resultados para ${texto}`) : ''}
      </p>
    </div>
  )
}

function Resultados({ q, grupos, total, disponible, onPreguntar }: { q: string; grupos: ReturnType<typeof agrupar>; total: number; disponible: boolean; onPreguntar: () => void }) {
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})
  useEffect(() => setAbiertos({}), [q])

  if (!total) {
    return (
      <div className="home-res home-res--vacio">
        <b>No encontramos «{q}»</b>
        <p>Prueba con otras palabras (por ejemplo, el nombre del sistema o del trámite), o:</p>
        <ul>
          {disponible && (
            <li>
              <button type="button" className="home-res__link" onClick={onPreguntar}>
                Preguntarle al asistente
              </button>
            </li>
          )}
          <li>
            <Link to="/directorio">Buscar a una persona en el Directorio</Link>
          </li>
          <li>
            <Link to="/mesa-servicios">Pedir ayuda a la {MESA}</Link>
          </li>
        </ul>
      </div>
    )
  }

  return (
    <div className="home-res">
      {disponible && (
        <p className="home-res__asis">
          ¿No es lo que buscas?{' '}
          <button type="button" className="home-res__link" onClick={onPreguntar}>
            Pregúntale al asistente
          </button>
        </p>
      )}
      {grupos.map((g) => {
        const abierto = !!abiertos[g.id]
        const visibles = abierto ? g.items : g.items.slice(0, POR_GRUPO)
        return (
          <section key={g.id} className="home-res__grupo" aria-labelledby={'res-' + g.id}>
            <h2 id={'res-' + g.id}>
              {g.t} <span className="n">{g.items.length}</span>
            </h2>
            <ul>
              {visibles.map((r, i) => (
                <li key={r.kind + r.t + i}>
                  <a href={r.h} {...(r.ext ? { target: '_blank', rel: 'noopener' } : {})}>
                    <span className="home-res__ico" aria-hidden="true">
                      {r.g || '◦'}
                    </span>
                    <span className="home-res__tx">
                      <b>{r.t}</b>
                      {r.meta && <span>{r.meta}</span>}
                    </span>
                    {r.ext && <MarcaExterna />}
                  </a>
                </li>
              ))}
            </ul>
            {g.items.length > POR_GRUPO && (
              <button type="button" className="home-res__mas" aria-expanded={abierto} onClick={() => setAbiertos((x) => ({ ...x, [g.id]: !abierto }))}>
                {abierto ? 'Ver menos' : `Ver los ${g.items.length} de ${g.t}`}
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}
