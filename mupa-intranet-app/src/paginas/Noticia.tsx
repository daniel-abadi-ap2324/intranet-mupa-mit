/**
 * Leer una noticia dentro de la intranet (/noticias/:id): su foto y su texto, sin salir. El texto viene
 * de la sincronización con mupa.gob.pa (solo texto, sin HTML); el enlace a la publicación original
 * queda al pie. Una noticia sin texto no tiene esta página: su fila lleva directo a su enlace.
 */
import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { api, ErrorApi } from '../api'
import { Aviso, CabeceraPagina } from '../components/ui'
import type { NoticiaLectura } from '../lib/contenido'
import { fechaLarga } from '../lib/fechas'
import { NoEncontrada } from './NoEncontrada'

export function PaginaNoticia() {
  const { id } = useParams()
  const [n, setN] = useState<NoticiaLectura | null>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'no-existe' | 'error'>('cargando')

  useEffect(() => {
    setEstado('cargando')
    setN(null)
    api
      .noticia(Number(id))
      .then((x) => {
        setN(x)
        setEstado('listo')
      })
      .catch((e) => setEstado(e instanceof ErrorApi && e.estado === 404 ? 'no-existe' : 'error'))
  }, [id])

  if (estado === 'no-existe') return <NoEncontrada />
  if (estado === 'error') {
    return (
      <>
        <CabeceraPagina titulo="Noticia" padres={[{ t: 'Noticias', h: '/noticias' }]} />
        <Aviso tipo="warn">No se pudo cargar la noticia. Vuelve a intentarlo en un momento.</Aviso>
      </>
    )
  }
  if (!n) {
    return (
      <>
        <CabeceraPagina titulo="Noticia" padres={[{ t: 'Noticias', h: '/noticias' }]} />
        <p className="count-note" role="status">
          Cargando…
        </p>
      </>
    )
  }

  return (
    <article className="lector-noticia">
      <CabeceraPagina miga={n.t.length > 60 ? n.t.slice(0, 57) + '…' : n.t} titulo={n.t} padres={[{ t: 'Noticias', h: '/noticias' }]} />
      <p className="meta">
        <time dateTime={n.fecha}>{fechaLarga(n.fecha)}</time>
        <span className={'tagline' + (n.tipo === 'noticia' ? ' tagline--brand' : '')}>{n.tipo}</span>
      </p>
      {n.img && <img className="lector-noticia__foto" src={n.img} alt="" />}
      <div className="lector-noticia__texto">
        {n.cuerpo.split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="lector-noticia__pie">
        <Link className="ds-btn ds-btn--subtle" to="/noticias">
          ← Todas las noticias
        </Link>
        {n.fuente && (
          <a className="ds-btn ds-btn--ghost" href={n.fuente} target="_blank" rel="noopener">
            Ver la publicación original ↗
          </a>
        )}
      </div>
    </article>
  )
}
