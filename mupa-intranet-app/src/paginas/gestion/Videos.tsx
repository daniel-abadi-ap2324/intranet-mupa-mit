/** Comunicación (/gestion/videos): instructivos, videos del canal de YouTube y otros. */
import React from 'react'

import { api } from '../../api'
import { Dialogo } from '../../components/ui'
import { CATEGORIAS_VIDEO, type CategoriaVideo, type VideoGestion } from '../../lib/contenido'
import { revisarUrl } from '../../lib/url'
import { ListaGestion, PieEditor, useEditor, type PropsEditor } from './Coleccion'
import { PaginaGestion } from './comun'

export function PaginaGestionVideos() {
  return (
    <PaginaGestion
      titulo="Videos"
      miga="Videos"
      intro="Los videos de la sección Videos. Los instructivos también salen en Documentos y en el Inicio. Se abren en una pestaña nueva."
      roles={['admin', 'comunicacion']}
      quien="el equipo de Comunicación"
    >
      <ListaGestion<VideoGestion>
        cargar={api.videosGestion}
        columnas={[
          {
            t: 'Video',
            celda: (v) => (
              <>
                <b>{v.t}</b>
                {v.meta && <span className="gest-det">{v.meta}</span>}
              </>
            ),
          },
          { t: 'Categoría', celda: (v) => CATEGORIAS_VIDEO.find((c) => c.v === v.categoria)?.t ?? v.categoria },
          {
            t: 'Dirección',
            celda: (v) => (
              <a href={v.h} target="_blank" rel="noopener">
                Abrir ↗
              </a>
            ),
          },
        ]}
        nombre={(v) => v.t}
        nuevo="Nuevo video"
        vacio="Todavía no hay videos."
        estados={{ publicados: 'Publicados', ocultos: 'Ocultos', publicado: 'Publicado', oculto: 'Oculto' }}
        alternar={(v) => api.guardarVideo(v.id, { published: !v.publicado })}
        borrar={(v) => api.borrarVideo(v.id)}
        Editor={Editor}
      />
    </PaginaGestion>
  )
}

function Editor({ item, onCerrar, onGuardado }: PropsEditor<VideoGestion>) {
  const f = useEditor({
    title: item?.t ?? '',
    url: item?.h ?? '',
    category: (item?.categoria ?? 'instructivo') as CategoriaVideo,
    description: item?.meta ?? '',
    date: item?.fecha ?? '',
    published: item?.publicado ?? true,
  })
  const { d } = f

  const guardar = () =>
    f.enviar(
      {
        title: d.title.trim() ? '' : 'Escribe el título.',
        url: !d.url.trim() ? 'Escribe la dirección del video.' : revisarUrl(d.url).error,
      },
      async () => {
        onGuardado(
          await api.guardarVideo(item?.id ?? null, {
            title: d.title.trim(),
            url: d.url.trim(),
            category: d.category,
            description: d.description.trim(),
            date: d.date || null,
            published: d.published,
          }),
        )
      },
    )

  return (
    <Dialogo id="vidEditor" titulo={item ? 'Editar video' : 'Nuevo video'} onCerrar={onCerrar}>
      <form
        ref={f.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          guardar()
        }}
      >
        <div className="home-dlg__body gest-form">
          <div className={f.cls('title', ' f-wide')}>
            <label htmlFor="ed-title">Título</label>
            <input className="ds-input" {...f.campo('title')} value={d.title} maxLength={160} onChange={(e) => f.poner('title', e.target.value)} />
            {f.error('title')}
          </div>
          <div className={f.cls('url', ' f-wide')}>
            <label htmlFor="ed-url">Dirección del video</label>
            <input className="ds-input" {...f.campo('url')} value={d.url} onChange={(e) => f.poner('url', e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
            <span className="f-hint">Un enlace de YouTube o de un MP4. La intranet no los reproduce dentro de la página: se abren en otra pestaña.</span>
            {f.error('url')}
          </div>
          <div className={f.cls('category')}>
            <label htmlFor="ed-category">Categoría</label>
            <select className="ds-input" {...f.campo('category')} value={d.category} onChange={(e) => f.poner('category', e.target.value as CategoriaVideo)}>
              {CATEGORIAS_VIDEO.map((c) => (
                <option key={c.v} value={c.v}>
                  {c.t}
                </option>
              ))}
            </select>
          </div>
          <div className={f.cls('date')}>
            <label htmlFor="ed-date">Fecha (opcional)</label>
            <input className="ds-input" type="date" {...f.campo('date')} value={d.date} onChange={(e) => f.poner('date', e.target.value)} />
          </div>
          <div className={f.cls('description', ' f-wide')}>
            <label htmlFor="ed-description">Descripción corta (opcional)</label>
            <input className="ds-input" {...f.campo('description')} value={d.description} maxLength={160} onChange={(e) => f.poner('description', e.target.value)} />
            {f.error('description')}
          </div>
          <label className="check-inline f-wide">
            <input type="checkbox" checked={d.published} onChange={(e) => f.poner('published', e.target.checked)} /> Publicado
          </label>
          {f.general && (
            <p className="f-err f-wide" role="alert">
              {f.general}
            </p>
          )}
        </div>
        <PieEditor onCerrar={onCerrar} enviando={f.enviando} />
      </form>
    </Dialogo>
  )
}
