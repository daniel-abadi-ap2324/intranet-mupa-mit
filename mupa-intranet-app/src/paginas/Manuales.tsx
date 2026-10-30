/** Manuales y documentos institucionales publicados (PDF guardados en esta intranet). */
import React from 'react'

import { CabeceraPagina, FilaDoc, SelectorVista } from '../components/ui'
import { DOCUMENTOS_INSTITUCIONALES, MANUALES, type Documento } from '../data/manuales'
import { miniaturaPdf } from '../lib/miniaturas'
import { useVista, type Vista } from '../lib/vista'

function Lista({ id, titulo, docs, vista }: { id: string; titulo: string; docs: Documento[]; vista: Vista }) {
  const filas = docs.map((d) => <FilaDoc key={d.h} x={{ t: d.t, meta: d.meta, h: d.h, g: 'PDF', img: miniaturaPdf(d.h) }} ic="" />)
  return (
    <section className="section" aria-labelledby={id}>
      <header>
        <h2 id={id}>{titulo}</h2>
        <span className="n">{docs.length}</span>
      </header>
      {vista === 'bloques' ? (
        <div className="doc-list vista-bloques">{filas}</div>
      ) : (
        <div className="panel">
          <div className="body" style={{ paddingTop: 2 }}>
            <div className="doc-list">{filas}</div>
          </div>
        </div>
      )}
    </section>
  )
}

export function PaginaManuales() {
  const [vista, setVista] = useVista()
  return (
    <>
      <CabeceraPagina
        miga="Manuales"
        titulo="Manuales y documentos"
        padres={[{ t: 'Documentos', h: '/documentos' }]}
        intro="Manuales de las áreas y documentos institucionales, en PDF guardados en esta intranet."
      />
      <div className="toolbar">
        <SelectorVista valor={vista} onCambio={setVista} />
      </div>
      <Lista id="h-manuales" titulo="Manuales" docs={MANUALES} vista={vista} />
      <Lista id="h-inst" titulo="Documentos institucionales" docs={DOCUMENTOS_INSTITUCIONALES} vista={vista} />
    </>
  )
}
