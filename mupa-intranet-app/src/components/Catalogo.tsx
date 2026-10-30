/**
 * Página Aplicaciones, como en el rediseño: una sola caja que filtra las
 * aplicaciones mientras se escribe y, con el mismo texto, le pregunta al asistente
 * (si está disponible); debajo, las áreas y la grilla. Los filtros viven en la URL
 * (?q=&area=&etiqueta=a,b) para que el buscador global y el Inicio puedan enlazarlos:
 * la etiqueta ya no se elige aquí, pero si llega en la dirección se muestra y se quita.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { api } from '../api'
import { AREA_DESCRIPCION, AREAS, etiquetas, norm, rangoApp, slug, type App } from '../lib/catalogo'
import { useFiltroUrl } from '../lib/useFiltroUrl'
import { useConversacion } from './asistente/conversacion'
import { MESA, TarjetaAsistente } from './asistente/TarjetaAsistente'
import { AppTile } from './AppTile'
import { Icono } from './shell/Iconos'

export function Catalogo({ apps }: { apps: App[] }) {
  const porSlug = useMemo(() => Object.fromEntries(etiquetas(apps).map((t) => [t.slug, t])), [apps])

  // En la dirección, y se vuelve a leer si cambia desde afuera (p. ej. un resultado del buscador estando ya aquí).
  const [f, cambiar] = useFiltroUrl({ q: '', area: 'Todas', etiqueta: '' })
  const { q, area } = f
  const tags = useMemo(() => f.etiqueta.split(',').filter((s) => porSlug[s]), [f.etiqueta, porSlug])

  const conv = useConversacion()
  const [disponible, setDisponible] = useState(false)
  const [aviso, setAviso] = useState('')
  useEffect(() => {
    let vivo = true
    api.estadoAsistente().then((d) => vivo && setDisponible(d))
    return () => {
      vivo = false
    }
  }, [])

  function preguntar() {
    const p = q.trim()
    if (p.length < 2) {
      setAviso('Escribe en la caja qué necesitas y vuelve a pulsar «Preguntar al asistente».')
      return
    }
    setAviso('')
    conv.preguntar(p)
  }

  const t = norm(q.trim())
  const coincide = (a: App) => !t || norm([a.name, a.desc, a.cat, a.k, ...a.tags].join(' ')).includes(t)
  const conTags = (a: App) => tags.every((s) => a.tags.map(slug).includes(s))
  // Las más usadas arriba y los paneles de administración al final; dentro de cada grupo, por nombre (ya vienen así).
  const visibles = apps
    .filter((a) => (area === 'Todas' || a.cat === area) && coincide(a) && conTags(a))
    .map((a, i) => [a, i] as const)
    .sort((x, y) => rangoApp(x[0]) - rangoApp(y[0]) || x[1] - y[1])
    .map(([a]) => a)
  const quitarTag = (s: string) => cambiar({ etiqueta: tags.filter((x) => x !== s).join(',') })

  return (
    <>
      <form
        className="app-busca"
        role="search"
        aria-label="Buscar aplicaciones"
        onSubmit={(e) => {
          e.preventDefault()
          if (disponible && !visibles.length) preguntar()
        }}
      >
        <div className="app-busca__fila">
          <Icono nombre="buscar" className="app-busca__ic" />
          <input
            className="app-busca__input"
            type="search"
            value={q}
            onChange={(e) => {
              cambiar({ q: e.target.value })
              setAviso('')
            }}
            placeholder={disponible ? 'Busca una aplicación o dile al asistente qué necesitas' : 'Busca una aplicación por nombre o función'}
            aria-label="Buscar aplicación"
            autoComplete="off"
            maxLength={300}
          />
          {disponible && (
            <button type="button" className="ds-btn ds-btn--primary app-busca__preguntar" disabled={conv.pensando} onClick={preguntar}>
              <Icono nombre="asistente" /> Preguntar al asistente
            </button>
          )}
        </div>
        {aviso && (
          <p className="app-busca__aviso" role="status">
            {aviso}
          </p>
        )}
      </form>

      {conv.turnos.length > 0 && (
        <div className="app-busca__respuesta">
          <TarjetaAsistente conv={conv} apps={apps} />
        </div>
      )}

      <div className="app-filters" role="group" aria-label="Filtrar por área">
        {['Todas', ...AREAS].map((c) => (
          <button key={c} className="chip-btn" type="button" aria-pressed={c === area} title={AREA_DESCRIPCION[c]} onClick={() => cambiar({ area: c })}>
            {c}
          </button>
        ))}
      </div>

      {tags.length > 0 && (
        <div className="tag-active">
          <span>Filtrando por:</span>
          {tags.map((s) => (
            <button key={s} type="button" className="tag-btn" aria-pressed="true" aria-label={'Quitar etiqueta ' + porSlug[s]?.name} onClick={() => quitarTag(s)}>
              {porSlug[s]?.name} ✕
            </button>
          ))}
          <button type="button" className="tag-clear" onClick={() => cambiar({ etiqueta: '' })}>
            Quitar filtros
          </button>
        </div>
      )}

      <section aria-labelledby="catalog-title">
        <div className="app-busca__cuenta">
          <h2 id="catalog-title" className="sr-only">
            Aplicaciones
          </h2>
          <span className="count-note" aria-live="polite">
            {visibles.length} de {apps.length}
          </span>
        </div>
        <div className="app-catalog">{visibles.map((a) => <AppTile key={a.id} app={a} />)}</div>
        {/* Con la respuesta del asistente en pantalla, el «no encontramos» (y su segundo botón) sobra. */}
        {!visibles.length && !conv.turnos.length && (
          <div className="empty-state">
            <b>{t ? `No encontramos «${q.trim()}»` : 'No hay aplicaciones en esta área'}</b>
            <p>Prueba con otras palabras (por ejemplo, para qué la necesitas) o:</p>
            <div className="app-busca__salidas">
              {disponible && t && (
                <button type="button" className="ds-btn ds-btn--primary" disabled={conv.pensando} onClick={preguntar}>
                  Preguntarle al asistente
                </button>
              )}
              <Link className="ds-btn ds-btn--subtle" to="/mesa-servicios">
                {MESA}
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
