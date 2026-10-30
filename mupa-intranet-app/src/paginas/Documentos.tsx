/**
 * Documentos: solo documentos para leer o descargar (reglamentos, manuales y
 * procedimientos, con búsqueda y filtro por categoría en la dirección), permisos
 * de uso interno, los boletines más recientes y los videos instructivos. Los
 * formularios en línea no van aquí: están en la Mesa de Servicios y en RRHH.
 */
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { api } from '../api'
import { CabeceraPagina, CampoBusqueda, Chips, Enlace, MarcaExterna, SelectorVista } from '../components/ui'
import { DOCUMENTOS } from '../data/documentos'
import { INSTRUCTIVOS } from '../data/instructivos'
import { useDatos } from '../datos'
import { activa } from '../lib/edicion'
import type { Video } from '../lib/contenido'
import { norm } from '../lib/catalogo'
import { fechaLarga } from '../lib/fechas'
import { miniaturaPdf } from '../lib/miniaturas'
import { esExterna } from '../lib/url'
import { useFiltroUrl } from '../lib/useFiltroUrl'
import { useVista } from '../lib/vista'

// Tinte e icono por categoría, como el color de pilar de la propuesta de diseño.
const CAT: Record<string, { tint: string; c: string; g: string }> = {
  Reglamentos: { tint: 'var(--action-subtle)', c: 'var(--action)', g: '▣' },
  Manuales: { tint: 'var(--color-purple-100)', c: 'var(--color-purple-400)', g: '◧' },
  Procedimientos: { tint: 'var(--color-cyan-100)', c: 'var(--color-cyan-400)', g: '◈' },
  'Equiparación de Oportunidades': { tint: 'var(--color-lime-100)', c: 'var(--color-lime-400)', g: '◧' },
}
// Sin los «Próximamente» (documentos sin archivo) cuando la edición los apaga (lib/edicion.ts: `proximamente`).
const DOCS = DOCUMENTOS.filter((d) => d.cat !== 'Permisos' && (activa('proximamente') || d.h))
const CATEGORIAS = ['Todos', ...Object.keys(CAT).filter((c) => DOCS.some((d) => d.cat === c))]
const PERMISOS = DOCUMENTOS.filter((d) => d.cat === 'Permisos')

export function PaginaDocumentos() {
  const [filtro, cambiar] = useFiltroUrl({ q: '', cat: 'Todos' })
  const [vista, setVista] = useVista()
  const { boletines, noticias } = useDatos()
  // Con la sección Videos apagada, los instructivos salen de la copia local.
  const [instructivos, setInstructivos] = useState<Pick<Video, 'id' | 't' | 'meta' | 'h'>[]>(activa('videos') ? [] : INSTRUCTIVOS)
  useEffect(() => {
    if (!activa('videos')) return
    api
      .videos()
      .then((v) => setInstructivos(v.filter((x) => x.categoria === 'instructivo')))
      .catch(() => setInstructivos([]))
  }, [])
  const t = norm(filtro.q.trim())
  const filas = DOCS.filter((d) => (filtro.cat === 'Todos' || d.cat === filtro.cat) && (!t || norm(d.title + ' ' + d.meta + ' ' + d.cat).includes(t)))

  return (
    <>
      <CabeceraPagina
        miga="Documentos"
        titulo="Documentos"
        intro={
          activa('boletines')
            ? 'Manuales, formatos y reglamentos, permisos de uso interno, boletines informativos y videos instructivos.'
            : 'Manuales, formatos y reglamentos, permisos de uso interno y videos instructivos.'
        }
      />

      <div className="docs-bar toolbar">
        <CampoBusqueda valor={filtro.q} onCambio={(q) => cambiar({ q })} etiqueta="Buscar documento" placeholder="Buscar documento" />
        <Chips
          etiqueta="Filtrar por categoría"
          opciones={CATEGORIAS.map((c) => ({ v: c, t: c, n: c === 'Todos' ? DOCS.length : DOCS.filter((d) => d.cat === c).length }))}
          valor={filtro.cat}
          onCambio={(cat) => cambiar({ cat })}
        />
        <span className="count-note" aria-live="polite">{filas.length} de {DOCS.length} documentos</span>
        <SelectorVista valor={vista} onCambio={setVista} />
      </div>

      {filas.length ? (
        <div className={'doc-grid' + (vista === 'bloques' ? ' vista-bloques' : '')}>
          {filas.map((d) => {
            const k = CAT[d.cat] || CAT.Manuales
            const ext = !!d.h && esExterna(d.h)
            const mini = vista === 'bloques' ? miniaturaPdf(d.h) : null
            // En bloques, «PDF» es texto que hay que leer: el color de la categoría queda en el fondo (contraste).
            return (
              <article className="doc-card" key={d.title}>
                <div className="top">
                  {mini ? (
                    <span className="ic ic--img" aria-hidden="true">
                      <img src={mini} alt="" loading="lazy" />
                    </span>
                  ) : (
                    <span className="ic" aria-hidden="true" style={{ background: k.tint, color: vista === 'bloques' && d.pdf ? 'var(--fg-strong)' : k.c }}>{vista === 'bloques' && d.pdf ? 'PDF' : k.g}</span>
                  )}
                  <div className="tx">
                    <b>{d.title}</b>
                    <span className="meta">{d.meta}</span>
                    <span className="tagline">{d.cat}</span>
                  </div>
                </div>
                <div className="acts">
                  {d.h ? (
                    <>
                      <Enlace h={d.h} className="ds-btn ds-btn--primary">{ext ? 'Abrir ↗' : 'Abrir'}</Enlace>
                      {d.pdf && (
                        <a className="dl" href={d.h} target="_blank" rel="noopener" download aria-label={'Descargar ' + d.title} title="Descargar PDF">↓</a>
                      )}
                    </>
                  ) : (
                    <span className="rh-pronto">Próximamente</span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="docs-empty show" role="status">
          <b>Aún no hay documentos con ese criterio</b>
          <p>Cambia el filtro o solicita la publicación del formato a tu enlace de Transparencia.</p>
          <button className="ds-btn ds-btn--subtle" type="button" onClick={() => cambiar({ q: '', cat: 'Todos' })}>Ver todos los documentos</button>
        </div>
      )}

      <section className="permits" aria-label="Permisos para actividades">
        <span className="ic" aria-hidden="true">▤</span>
        <div>
          <p>Permisos para actividades organizadas por la Alcaldía (uso interno), en PDF.</p>
          <div className="home-list">
            {PERMISOS.map((d) => (
              <a className="list-row" key={d.title} href={d.h!} target="_blank" rel="noopener">
                <span className="ic" aria-hidden="true" style={{ background: 'var(--color-error-100)', color: 'var(--color-error-700)', font: '700 13px/1 var(--font-body)' }}>PDF</span>
                <span className="tx">
                  <b>{d.title}</b>
                  <span>{d.meta}</span>
                </span>
                <MarcaExterna />
              </a>
            ))}
          </div>
        </div>
      </section>

      {activa('boletines') && (
      <section className="card-sec" aria-labelledby="h-bol">
        <header>
          <span className="ic" aria-hidden="true">◫</span>
          <h2 id="h-bol">Boletines informativos</h2>
          <Link to="/boletines">Ver los {boletines.length} →</Link>
        </header>
        <p>Las ediciones de "Alcaldía al día" publicadas en la intranet, ordenadas por fecha.</p>
        <div className="bol-grid">
          {boletines.slice(0, 4).map((b) => (
            <Link className="bol-tile" key={b.id} to={b.pdf ? '/boletines/' + b.id : '/boletines'}>
              <span className={'th' + (b.portada ? ' th--portada' : '')} style={b.portada ? { backgroundImage: `url(${b.portada})` } : undefined} role={b.portada ? 'img' : undefined} aria-label={b.portada ? 'Portada del boletín' : undefined}>
                {b.portada ? '' : 'Alcaldía al día'}
              </span>
              <span className="tx">
                <b>{fechaLarga(b.fecha)}</b>
                <span>Boletín informativo · Leer →</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
      )}

      {activa('noticias') && noticias.length > 0 && (
        <section className="card-sec" aria-labelledby="h-not">
          <header>
            <span className="ic" aria-hidden="true">◫</span>
            <h2 id="h-not">Noticias</h2>
            <Link to="/noticias">Ver las {noticias.length} →</Link>
          </header>
          <p>Lo más reciente de la Alcaldía.</p>
          <div className="bol-grid">
            {noticias.slice(0, 4).map((n) => (
              <Enlace className="bol-tile" key={n.id} h={n.h || '/noticias'}>
                <span className={'th' + (n.img ? ' th--portada th--foto' : '')} style={n.img ? { backgroundImage: `url(${n.img})` } : undefined}>
                  {n.img ? '' : 'Noticia'}
                </span>
                <span className="tx">
                  <b>{n.t}</b>
                  <span>{fechaLarga(n.fecha)}</span>
                </span>
              </Enlace>
            ))}
          </div>
        </section>
      )}

      <section className="card-sec" aria-labelledby="h-vid">
        <header>
          <span className="ic" aria-hidden="true">▶</span>
          <h2 id="h-vid">Videos instructivos</h2>
          {activa('videos') && <Link to="/videos">Todos los videos →</Link>}
        </header>
        <p>Paso a paso para restablecer el usuario de máquina (Mesa de Servicios).</p>
        <div className="video-grid">
          {instructivos.map((v) => (
            <a className="video-card" key={v.id} href={v.h} target="_blank" rel="noopener">
              <span className="th"><span className="play" aria-hidden="true">▶</span></span>
              <span className="tx"><b>{v.t}</b><span>{v.meta} ↗</span></span>
            </a>
          ))}
        </div>
      </section>
    </>
  )
}
