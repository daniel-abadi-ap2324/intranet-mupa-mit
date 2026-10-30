/**
 * Videos: los publica Comunicación (/gestion/videos). Instructivos, el canal de
 * YouTube y otros. Se abren en una pestaña nueva (la CSP de la intranet no
 * permite reproducir ni traer miniaturas de otros sitios).
 */
import React, { useEffect, useState } from 'react'

import { api } from '../api'
import { Aviso, CabeceraPagina, FilaDoc } from '../components/ui'
import { CANAL_YOUTUBE, type Video } from '../lib/contenido'

function Tarjeta({ v }: { v: Video }) {
  return (
    <a className="video-card" href={v.h} target="_blank" rel="noopener">
      <span className="th">
        <span className="play" aria-hidden="true">▶</span>
      </span>
      <span className="tx">
        <b>{v.t}</b>
        <span>{v.meta} ↗</span>
      </span>
    </a>
  )
}

export function PaginaVideos() {
  const [lista, setLista] = useState<Video[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    api
      .videos()
      .then(setLista)
      .catch(() => {
        setError(true)
        setLista([])
      })
  }, [])
  const de = (c: Video['categoria']) => (lista ?? []).filter((v) => v.categoria === c)
  const instructivos = de('instructivo')
  const canal = de('canal')
  const otros = de('otro')

  return (
    <>
      <CabeceraPagina
        titulo="Videos"
        padres={[{ t: 'Documentos', h: '/documentos' }]}
        intro="Los videos publicados en la intranet. Todos se abren en una pestaña nueva."
        acciones={
          <a className="ds-btn ds-btn--primary" href={CANAL_YOUTUBE} target="_blank" rel="noopener">
            Ver canal de YouTube ↗
          </a>
        }
      />

      {error && <Aviso tipo="warn">No se pudieron cargar los videos. Vuelve a intentarlo en un momento.</Aviso>}
      {lista === null && (
        <p className="count-note" role="status">
          Cargando videos…
        </p>
      )}

      {instructivos.length > 0 && (
        <section className="section" aria-labelledby="h-instr">
          <header>
            <h2 id="h-instr">Instructivos</h2>
            <span className="n">{instructivos.length}</span>
          </header>
          <div className="video-grid">
            {instructivos.map((v) => (
              <Tarjeta key={v.id} v={v} />
            ))}
          </div>
        </section>
      )}

      {canal.length > 0 && (
        <section className="section" aria-labelledby="h-yt">
          <header>
            <h2 id="h-yt">Canal del Municipio en YouTube</h2>
            <span className="n">{canal.length} videos</span>
          </header>
          <div className="video-grid">
            {canal.map((v) => (
              <Tarjeta key={v.id} v={v} />
            ))}
          </div>
        </section>
      )}

      {otros.length > 0 && (
        <section className="section" aria-labelledby="h-mp4">
          <header>
            <h2 id="h-mp4">Otros videos</h2>
            <span className="n">{otros.length}</span>
          </header>
          <div className="panel">
            <div className="body" style={{ paddingTop: 2 }}>
              <div className="doc-list">
                {otros.map((v) => (
                  <FilaDoc key={v.id} x={{ t: v.t, meta: v.meta, h: v.h }} ic="ic--vid" g="▶" />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
      {lista && !lista.length && !error && <p className="empty show">Todavía no hay videos publicados.</p>}
    </>
  )
}
