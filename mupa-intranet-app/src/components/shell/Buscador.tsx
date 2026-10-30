/**
 * Buscador global (Ctrl/⌘+K) con categorías: Todo, Aplicaciones, Formularios,
 * Documentos, Páginas y Enlaces. Sin texto, explora por área o por categoría.
 * Combobox accesible: flechas, Enter, Escape. Mismo comportamiento que app-shell.js.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { Link } from 'react-router'

import { api } from '../../api'
import { ALCANCES, buscar, type AlcanceId, type Resultado } from '../../lib/busqueda'
import { activa } from '../../lib/edicion'
import { MESA } from '../asistente/TarjetaAsistente'
import { Icono } from './Iconos'

export function Buscador({ indice }: { indice: Resultado[] }) {
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [alcance, setAlcance] = useState<AlcanceId>('todo')
  const [cursor, setCursor] = useState(-1)
  const [mod, setMod] = useState('Ctrl')
  const [asistente, setAsistente] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const items = useRef<(HTMLAnchorElement | null)[]>([])

  useEffect(() => {
    let vivo = true
    api.estadoAsistente().then((d) => vivo && setAsistente(d))
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || '')) setMod('⌘')
    const atajo = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    const fuera = (e: MouseEvent) => {
      if (caja.current && !e.composedPath().includes(caja.current)) setAbierto(false)
    }
    document.addEventListener('keydown', atajo)
    document.addEventListener('click', fuera)
    return () => {
      document.removeEventListener('keydown', atajo)
      document.removeEventListener('click', fuera)
    }
  }, [])

  const { hits, conteos } = useMemo(() => buscar(indice, q, alcance), [q, alcance, indice])

  const filas: Resultado[] = hits

  useEffect(() => setCursor(-1), [q, alcance])
  useEffect(() => {
    if (cursor >= 0) items.current[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAbierto(true)
      setCursor((c) => (filas.length ? (c + 1) % filas.length : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (filas.length ? (c - 1 + filas.length) % filas.length : -1))
    } else if (e.key === 'Enter') {
      const i = cursor >= 0 ? cursor : q.trim() ? 0 : -1
      if (i >= 0 && items.current[i]) {
        e.preventDefault()
        items.current[i]!.click()
      }
    } else if (e.key === 'Escape') {
      if (abierto) {
        e.preventDefault()
        setAbierto(false)
      } else {
        setQ('')
        input.current?.blur()
      }
    }
  }

  const listaId = 'search-results-list'
  items.current = []
  return (
    <div className="app-search" ref={caja}>
      <Icono nombre="buscar" className="app-search__ic" />
      <input
        ref={input}
        className="app-search__input"
        type="search"
        placeholder={activa('noticias') ? 'Buscar personas, sistemas, documentos o noticias…' : 'Buscar personas, sistemas o documentos…'}
        aria-label="Buscador global"
        autoComplete="off"
        role="combobox"
        aria-expanded={abierto}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={cursor >= 0 ? 'sr-' + cursor : undefined}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={teclas}
      />
      <span className="app-search__kbd" aria-hidden="true">
        <kbd>{mod}</kbd>
        <kbd>K</kbd>
      </span>
      <div className="app-search__results" hidden={!abierto}>
        <div className="app-search__scopes" role="group" aria-label="Buscar por categoría">
          {ALCANCES.map((a) =>
            a.id !== 'todo' && a.id !== alcance && !conteos[a.id] ? null : (
              <button
                key={a.id}
                type="button"
                className="app-search__scope"
                aria-pressed={a.id === alcance}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setAlcance(a.id)
                  input.current?.focus()
                }}
              >
                {a.t} <span className="n">{conteos[a.id]}</span>
              </button>
            ),
          )}
        </div>
        {!q.trim() && <p className="app-search__head">{alcance === 'todo' ? 'Explorar por área o elige una categoría' : 'Todo en ' + ALCANCES.find((a) => a.id === alcance)!.t}</p>}
        <div className="app-search__list" role="listbox" id={listaId} aria-label="Resultados de búsqueda">
          {q.trim() && !hits.length && (
            <div className="app-search__empty">
              <b>Sin resultados para “{q.trim()}”{alcance !== 'todo' ? ' en ' + ALCANCES.find((a) => a.id === alcance)!.t : ''}</b>
              <p>Prueba otra categoría o con el nombre de un sistema (ARI, TRANSDOC){activa('formularios') ? ', un formulario' : ''} o un área.</p>
              <p>
                {asistente && (
                  <>
                    <Link to={'/asistente?q=' + encodeURIComponent(q.trim())} onClick={() => setAbierto(false)}>
                      Preguntarle al asistente
                    </Link>
                    {' · '}
                  </>
                )}
                <Link to="/mesa-servicios" onClick={() => setAbierto(false)}>
                  {MESA}
                </Link>
              </p>
            </div>
          )}
          {filas.map((r, i) => (
            <a
              key={r.kind + r.t + i}
              ref={(el) => {
                items.current[i] = el
              }}
              className={'app-search__item' + (i === cursor ? ' is-active' : '')}
              role="option"
              id={'sr-' + i}
              aria-selected={i === cursor}
              href={r.h}
              {...(r.ext ? { target: '_blank', rel: 'noopener' } : {})}
              onMouseMove={() => setCursor(i)}
              onClick={() => setAbierto(false)}
            >
              <span className="app-search__ico" aria-hidden="true">{r.g || '◦'}</span>
              <span className="app-search__tx">
                <span className="t">{r.t}</span>
                <span className="m">{r.meta}</span>
                {r.tags && r.tags.length > 0 && (
                  <span className="app-search__tags">
                    {r.tags.map((t) => <span key={t}>{t}</span>)}
                  </span>
                )}
              </span>
              <span className="app-search__kind">
                {r.kind}
                {r.ext ? ' ↗' : ''}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
