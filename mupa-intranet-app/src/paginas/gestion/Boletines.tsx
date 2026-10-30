/** Comunicación (/gestion/boletines): los boletines "Alcaldía al día", con su PDF. */
import React from 'react'

import { api } from '../../api'
import { BotonSincronizar } from '../../components/gestion/Sincronizar'
import { Dialogo } from '../../components/ui'
import { useDatos } from '../../datos'
import type { BoletinGestion } from '../../lib/contenido'
import { fechaCorta, hoyIso } from '../../lib/fechas'
import { revisarUrl } from '../../lib/url'
import { ListaGestion, PieEditor, useEditor, type PropsEditor } from './Coleccion'
import { PaginaGestion, SubirArchivo } from './comun'

export function PaginaGestionBoletines() {
  const { recargar } = useDatos()
  return (
    <PaginaGestion
      titulo="Boletines"
      miga="Boletines"
      intro="Los boletines «Alcaldía al día». Sube el PDF de cada edición: se ve en Boletines, en Documentos y en el Inicio."
      roles={['admin', 'comunicacion']}
      quien="el equipo de Comunicación"
    >
      <ListaGestion<BoletinGestion>
        cargar={api.boletinesGestion}
        columnas={[
          { t: 'Boletín', celda: (b) => <b>{fechaCorta(b.fecha)}</b> },
          {
            t: 'PDF',
            celda: (b) =>
              b.pdf ? (
                <a href={b.pdf} target="_blank" rel="noopener">
                  Abrir ↗
                </a>
              ) : (
                <span className="tagline tagline--warn">Sin PDF</span>
              ),
          },
          { t: 'Portada', celda: (b) => (b.portada ? <img className="bol-thumb bol-thumb--chico" src={b.portada} alt="" loading="lazy" width={28} height={36} /> : '—') },
          { t: 'Nota', celda: (b) => b.nota || '—' },
        ]}
        nombre={(b) => 'Boletín del ' + fechaCorta(b.fecha)}
        nuevo="Nuevo boletín"
        vacio="Todavía no hay boletines."
        estados={{ publicados: 'Publicados', ocultos: 'Ocultos', publicado: 'Publicado', oculto: 'Oculto' }}
        alternar={async (b) => {
          await api.guardarBoletin(b.id, { published: !b.publicado })
          await recargar()
        }}
        borrar={async (b) => {
          await api.borrarBoletin(b.id)
          await recargar()
        }}
        Editor={Editor}
        acciones={(cargar) => (
          <BotonSincronizar
            onTerminado={async () => {
              await recargar()
              await cargar()
            }}
          />
        )}
      />
    </PaginaGestion>
  )
}

function Editor({ item, onCerrar, onGuardado }: PropsEditor<BoletinGestion>) {
  // Los boletines se cargan al abrir el sitio (contador del menú): se vuelven a pedir al guardar.
  const { recargar } = useDatos()
  const f = useEditor({ date: item?.fecha ?? hoyIso(), pdfUrl: item?.pdf ?? '', flipbookUrl: item?.flipbook ?? '', note: item?.nota ?? '', published: item?.publicado ?? true })
  const { d } = f

  const guardar = () =>
    f.enviar(
      {
        date: d.date ? '' : 'Elige la fecha del boletín.',
        pdfUrl: revisarUrl(d.pdfUrl).error,
        flipbookUrl: revisarUrl(d.flipbookUrl).error,
      },
      async () => {
        const b = await api.guardarBoletin(item?.id ?? null, { date: d.date, pdfUrl: d.pdfUrl.trim() || null, flipbookUrl: d.flipbookUrl.trim() || null, note: d.note.trim(), published: d.published })
        await recargar()
        onGuardado(b)
      },
    )

  return (
    <Dialogo id="bolEditor" titulo={item ? 'Editar boletín' : 'Nuevo boletín'} onCerrar={onCerrar}>
      <form
        ref={f.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          guardar()
        }}
      >
        <div className="home-dlg__body gest-form">
          <div className={f.cls('date')}>
            <label htmlFor="ed-date">Fecha del boletín</label>
            <input className="ds-input" type="date" {...f.campo('date')} value={d.date} onChange={(e) => f.poner('date', e.target.value)} />
            {f.error('date')}
          </div>
          <div className={f.cls('pdfUrl', ' f-wide')}>
            <label htmlFor="ed-pdfUrl">PDF</label>
            <div className="gest-url">
              <input className="ds-input" {...f.campo('pdfUrl')} value={d.pdfUrl} onChange={(e) => f.poner('pdfUrl', e.target.value)} placeholder="Sube el PDF o pega su dirección" />
              <SubirArchivo acepta="application/pdf" etiqueta="Subir PDF" onSubido={(url) => f.poner('pdfUrl', url)} />
            </div>
            <span className="f-hint">Hasta 10 MB. Sin PDF, el boletín aparece como «PDF no disponible».</span>
            {f.error('pdfUrl')}
          </div>
          <div className={f.cls('flipbookUrl', ' f-wide')}>
            <label htmlFor="ed-flipbookUrl">Flipbook (opcional)</label>
            <input className="ds-input" {...f.campo('flipbookUrl')} value={d.flipbookUrl} onChange={(e) => f.poner('flipbookUrl', e.target.value)} placeholder="https://…" />
            {f.error('flipbookUrl')}
          </div>
          <div className={f.cls('note', ' f-wide')}>
            <label htmlFor="ed-note">Nota (opcional)</label>
            <input className="ds-input" {...f.campo('note')} value={d.note} maxLength={200} onChange={(e) => f.poner('note', e.target.value)} />
            {f.error('note')}
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
