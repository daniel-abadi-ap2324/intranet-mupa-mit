/** Comunicación (/gestion/noticias): noticias y consejos de la sección Noticias y del Inicio. */
import React from 'react'

import { api } from '../../api'
import { BotonSincronizar } from '../../components/gestion/Sincronizar'
import { Dialogo } from '../../components/ui'
import { TIPOS_NOTICIA, type NoticiaGestion, type TipoNoticia } from '../../lib/contenido'
import { fechaCorta, hoyIso } from '../../lib/fechas'
import { revisarUrl } from '../../lib/url'
import { ListaGestion, useEditor, type PropsEditor } from './Coleccion'
import { PaginaGestion, SubirArchivo } from './comun'

export function PaginaGestionNoticias() {
  return (
    <PaginaGestion
      titulo="Noticias"
      miga="Noticias"
      intro="Noticias y consejos de la intranet. Las publicadas se ven en la sección Noticias y, las cuatro más nuevas, en el Inicio."
      roles={['admin', 'comunicacion']}
      quien="el equipo de Comunicación"
    >
      <ListaGestion<NoticiaGestion>
        cargar={api.noticiasGestion}
        columnas={[
          {
            t: 'Noticia',
            celda: (n) => (
              <>
                <b>{n.t}</b>
                {n.meta && <span className="gest-det">{n.meta}</span>}
              </>
            ),
          },
          { t: 'Tipo', celda: (n) => TIPOS_NOTICIA.find((x) => x.v === n.tipo)?.t ?? n.tipo },
          { t: 'Fecha', celda: (n) => fechaCorta(n.fecha) },
        ]}
        nombre={(n) => n.t}
        nuevo="Nueva noticia"
        vacio="Todavía no hay noticias."
        estados={{ publicados: 'Publicadas', ocultos: 'Borradores', publicado: 'Publicada', oculto: 'Borrador' }}
        alternar={(n) => api.guardarNoticia(n.id, { status: n.publicado ? 'borrador' : 'publicado' })}
        borrar={(n) => api.borrarNoticia(n.id)}
        Editor={Editor}
        acciones={(cargar) => <BotonSincronizar onTerminado={cargar} />}
      />
    </PaginaGestion>
  )
}

function Editor({ item, onCerrar, onGuardado }: PropsEditor<NoticiaGestion>) {
  const f = useEditor({
    title: item?.t ?? '',
    summary: item?.meta ?? '',
    type: (item?.tipo ?? 'noticia') as TipoNoticia,
    date: item?.fecha ?? hoyIso(),
    link: item?.h ?? '',
    imageUrl: item?.img ?? '',
    status: item?.publicado ? 'publicado' : 'borrador',
  })
  const { d } = f

  const guardar = (status: 'borrador' | 'publicado') =>
    f.enviar(
      {
        title: d.title.trim() ? '' : 'Escribe el título.',
        date: d.date ? '' : 'Elige la fecha.',
        link: revisarUrl(d.link).error,
        imageUrl: revisarUrl(d.imageUrl).error,
      },
      async () => {
        onGuardado(
          await api.guardarNoticia(item?.id ?? null, {
            title: d.title.trim(),
            summary: d.summary.trim() || null,
            type: d.type,
            date: d.date,
            link: d.link.trim() || null,
            imageUrl: d.imageUrl.trim() || null,
            status,
          }),
        )
      },
    )

  return (
    <Dialogo id="notEditor" titulo={item ? 'Editar noticia' : 'Nueva noticia'} onCerrar={onCerrar}>
      <form
        ref={f.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          guardar('publicado')
        }}
      >
        <div className="home-dlg__body gest-form">
          <div className={f.cls('title', ' f-wide')}>
            <label htmlFor="ed-title">Título</label>
            <input className="ds-input" {...f.campo('title')} value={d.title} maxLength={160} onChange={(e) => f.poner('title', e.target.value)} />
            {f.error('title')}
          </div>
          <div className={f.cls('summary', ' f-wide')}>
            <label htmlFor="ed-summary">Resumen (opcional)</label>
            <textarea className="ds-input" {...f.campo('summary')} value={d.summary} maxLength={500} rows={3} onChange={(e) => f.poner('summary', e.target.value)} />
            <span className="f-hint">Solo texto. {d.summary.length} de 500 caracteres.</span>
            {f.error('summary')}
          </div>
          <div className={f.cls('type')}>
            <label htmlFor="ed-type">Tipo</label>
            <select className="ds-input" {...f.campo('type')} value={d.type} onChange={(e) => f.poner('type', e.target.value as TipoNoticia)}>
              {TIPOS_NOTICIA.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.t}
                </option>
              ))}
            </select>
          </div>
          <div className={f.cls('date')}>
            <label htmlFor="ed-date">Fecha</label>
            <input className="ds-input" type="date" {...f.campo('date')} value={d.date} onChange={(e) => f.poner('date', e.target.value)} />
            {f.error('date')}
          </div>
          <div className={f.cls('link', ' f-wide')}>
            <label htmlFor="ed-link">Enlace (opcional)</label>
            <input className="ds-input" {...f.campo('link')} value={d.link} onChange={(e) => f.poner('link', e.target.value)} placeholder="https://… o /pagina-de-la-intranet" />
            {f.error('link')}
          </div>
          <div className={f.cls('imageUrl', ' f-wide')}>
            <label htmlFor="ed-imageUrl">Imagen (opcional)</label>
            <div className="gest-url">
              <input className="ds-input" {...f.campo('imageUrl')} value={d.imageUrl} onChange={(e) => f.poner('imageUrl', e.target.value)} placeholder="Sube una imagen" />
              <SubirArchivo acepta="image/png,image/jpeg,image/webp" etiqueta="Subir imagen" onSubido={(url) => f.poner('imageUrl', url)} />
            </div>
            {f.error('imageUrl')}
          </div>
          {f.general && (
            <p className="f-err f-wide" role="alert">
              {f.general}
            </p>
          )}
        </div>
        <div className="home-dlg__foot gest-pie">
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="ds-btn ds-btn--subtle" disabled={f.enviando} onClick={() => guardar('borrador')}>
            Guardar como borrador
          </button>
          <button type="submit" className="ds-btn ds-btn--primary" disabled={f.enviando}>
            {f.enviando ? 'Guardando…' : 'Publicar'}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}
