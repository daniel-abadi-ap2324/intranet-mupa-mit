/** Noticias: las publica Comunicación (/gestion/noticias). Filtro por tipo (?tipo=). */
import React, { useEffect, useState } from 'react'

import { api } from '../api'
import { Aviso, CabeceraPagina, Chips, Enlace, MarcaExterna, SelectorVista } from '../components/ui'
import type { Noticia } from '../lib/contenido'
import { hoyIso, mesAnio, partes } from '../lib/fechas'
import { esExterna } from '../lib/url'
import { useFiltroUrl } from '../lib/useFiltroUrl'
import { useVista } from '../lib/vista'

const TIPOS = [
  { v: 'todas', t: 'Todas' },
  { v: 'noticia', t: 'Noticias' },
  { v: 'tip', t: 'Consejos (tips)' },
]
const fecha = (iso: string) => {
  const { anio, mes, dia } = partes(iso)
  return String(dia).padStart(2, '0') + '/' + String(mes).padStart(2, '0') + '/' + anio
}
/** Cuántas entradas se muestran de entrada y cuántas más con «Ver más». */
const POR_PAGINA = 30
/** Días entre una fecha "AAAA-MM-DD" y hoy. */
const diasDesde = (iso: string) => (Date.parse(hoyIso() + 'T00:00:00Z') - Date.parse(iso + 'T00:00:00Z')) / 86_400_000

export function PaginaNoticias() {
  const [filtro, cambiar] = useFiltroUrl({ tipo: 'todas' })
  const [lista, setLista] = useState<Noticia[] | null>(null)
  const [error, setError] = useState(false)
  const [cuantas, setCuantas] = useState(POR_PAGINA)
  const [vista, setVista] = useVista()
  useEffect(() => {
    api
      .noticias()
      .then(setLista)
      .catch(() => {
        setError(true)
        setLista([])
      })
  }, [])

  const todas = lista ?? []
  const filas = todas.filter((n) => filtro.tipo === 'todas' || n.tipo === filtro.tipo)
  const visibles = filas.slice(0, cuantas)
  const ultima = todas[0]?.fecha
  // Un tipo sin entradas no se ofrece (salvo «Todas» o el que ya está elegido por la dirección).
  const opciones = TIPOS.map((x) => ({ ...x, n: x.v === 'todas' ? todas.length : todas.filter((n) => n.tipo === x.v).length })).filter(
    (x) => x.v === 'todas' || x.n > 0 || x.v === filtro.tipo,
  )
  // Separadores por mes: la lista viene de la más nueva a la más vieja.
  const grupos: { mes: string; items: Noticia[] }[] = []
  for (const n of visibles) {
    const mes = mesAnio(n.fecha)
    if (grupos.at(-1)?.mes === mes) grupos.at(-1)!.items.push(n)
    else grupos.push({ mes, items: [n] })
  }

  const fila = (n: Noticia) => (
    <Enlace key={n.id} h={n.h} className="doc-row">
      {n.img ? (
        <img className="not-thumb" src={n.img} alt="" loading="lazy" />
      ) : (
        <span className="ic ic--off" aria-hidden="true">◫</span>
      )}
      <span className="tx">
        <b>{n.t}</b>
        <span>{[fecha(n.fecha), n.meta].filter(Boolean).join(' · ')}</span>
      </span>
      <span className={'tagline' + (n.tipo === 'noticia' ? ' tagline--brand' : '')}>{n.tipo}</span>
      {n.h && esExterna(n.h) && <MarcaExterna />}
    </Enlace>
  )

  return (
    <>
      <CabeceraPagina titulo="Noticias" intro={lista ? `Las ${todas.length} entradas publicadas en la intranet, de la más nueva a la más vieja.` : 'Noticias y consejos de la Alcaldía.'} />

      {error && <Aviso tipo="warn">No se pudieron cargar las noticias. Vuelve a intentarlo en un momento.</Aviso>}
      {ultima && diasDesde(ultima) > 90 && (
        <div className="empty-state" style={{ margin: '0 0 20px' }}>
          <b>Sin noticias nuevas desde {fecha(ultima)}</b>
          <p>Las noticias nuevas aparecerán aquí primero.</p>
        </div>
      )}

      <div className="toolbar">
        {opciones.length > 2 && (
        <Chips
          etiqueta="Filtrar por tipo"
          opciones={opciones}
          valor={filtro.tipo}
          onCambio={(tipo) => {
            cambiar({ tipo })
            setCuantas(POR_PAGINA)
          }}
        />
        )}
        <span className="count-note" aria-live="polite">
          {lista ? `${visibles.length} de ${filas.length} entradas` : 'Cargando…'}
        </span>
        <SelectorVista valor={vista} onCambio={setVista} />
      </div>

      {grupos.map((g) => (
        <section className="section" aria-label={'Entradas de ' + g.mes} key={g.mes}>
          <h2 className="not-mes">{g.mes.charAt(0).toUpperCase() + g.mes.slice(1)}</h2>
          {vista === 'bloques' ? (
            <div className="doc-list vista-bloques">{g.items.map(fila)}</div>
          ) : (
            <div className="panel">
              <div className="body" style={{ paddingTop: 2 }}>
                <div className="doc-list">{g.items.map(fila)}</div>
              </div>
            </div>
          )}
        </section>
      ))}
      {visibles.length < filas.length && (
        <p className="not-mas">
          <button type="button" className="ds-btn ds-btn--subtle" onClick={() => setCuantas((c) => c + POR_PAGINA)}>
            Ver {Math.min(POR_PAGINA, filas.length - visibles.length)} más
          </button>
        </p>
      )}
      {lista && !filas.length && <p className="empty show">No hay entradas de ese tipo.</p>}
    </>
  )
}
