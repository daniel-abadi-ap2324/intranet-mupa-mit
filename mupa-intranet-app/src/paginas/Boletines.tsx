/**
 * Boletines "Alcaldía al día": por fecha real, agrupados por mes, con buscador (descripción, palabras
 * clave, texto del PDF y fecha; lo resuelve la API) y filtro por año. Los publica Comunicación
 * (/gestion/boletines). «Leer» abre el boletín dentro de la intranet (/boletines/:id).
 */
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { api } from '../api'
import { useSitio } from '../components/Proveedores'
import { Aviso, CabeceraPagina, CampoBusqueda, Chips, Estadisticas, SelectorVista } from '../components/ui'
import { useDatos } from '../datos'
import type { Boletin } from '../lib/contenido'
import { diaLargo, fechaCorta, mayuscula, mesAnio, mesCorto, partes } from '../lib/fechas'
import { useFiltroUrl } from '../lib/useFiltroUrl'
import { useVista } from '../lib/vista'

const archivo = (h: string) => decodeURIComponent(h.split('/').pop() || '')

export function PaginaBoletines() {
  const { boletines: L } = useDatos()
  const ANIOS = [...new Set(L.map((b) => b.fecha.slice(0, 4)))]
  const SIN_PDF = L.filter((b) => !b.pdf).length
  const { marcarBoletines } = useSitio()
  // Al abrir la página, todos quedan vistos (el contador del menú vuelve a cero).
  useEffect(() => marcarBoletines(), [marcarBoletines])

  const [filtro, cambiar] = useFiltroUrl({ anio: 'todos', q: '' })
  const [vista, setVista] = useVista()
  // El campo guarda lo que se escribe; la búsqueda (y la dirección) se actualizan al dejar de escribir.
  const [texto, setTexto] = useState(filtro.q)
  useEffect(() => setTexto(filtro.q), [filtro.q])
  useEffect(() => {
    if (texto === filtro.q) return
    const t = setTimeout(() => cambiar({ q: texto }), 300)
    return () => clearTimeout(t)
  }, [texto, filtro.q, cambiar])
  const buscarPor = (q: string) => {
    setTexto(q)
    cambiar({ q })
  }

  // La API busca (sin tildes ni mayúsculas, todas las palabras); sin búsqueda se usa la lista que ya está cargada.
  const q = filtro.q.trim()
  const [resultado, setResultado] = useState<{ q: string; lista: Boletin[] } | null>(null)
  useEffect(() => {
    if (!q) return
    let vigente = true
    api
      .boletines(q)
      .then((lista) => vigente && setResultado({ q, lista }))
      .catch(() => vigente && setResultado({ q, lista: [] }))
    return () => {
      vigente = false
    }
  }, [q])
  const buscando = !!q && resultado?.q !== q
  const base = !q ? L : resultado?.q === q ? resultado.lista : []

  const filas = base.filter((b) => filtro.anio === 'todos' || b.fecha.startsWith(filtro.anio))
  const meses: { mes: string; lista: Boletin[] }[] = []
  for (const b of filas) {
    const mes = mesAnio(b.fecha)
    if (meses.at(-1)?.mes === mes) meses.at(-1)!.lista.push(b)
    else meses.push({ mes, lista: [b] })
  }

  const fila = (b: Boletin) => (
    <div className="bol-row" key={b.id}>
      <div className="bol-date" aria-hidden="true">
        <b>{partes(b.fecha).dia}</b>
        <span>{mesCorto(b.fecha)}</span>
      </div>
      {b.portada ? (
        // La portada también abre el boletín (con el ratón; el teclado y los lectores usan «Leer»).
        b.pdf ? (
          <Link className="bol-portada" to={'/boletines/' + b.id} tabIndex={-1} aria-hidden="true">
            <img className="bol-thumb" src={b.portada} alt="" loading="lazy" width={52} height={64} />
          </Link>
        ) : (
          <img className="bol-thumb" src={b.portada} alt="" loading="lazy" width={52} height={64} />
        )
      ) : (
        vista === 'bloques' && (
          <span className="bol-thumb bol-thumb--vacia" aria-hidden="true">
            Alcaldía al día
          </span>
        )
      )}
      <div className="tx">
        <b>Boletín informativo · {mayuscula(diaLargo(b.fecha))}</b>
        {b.resumen && <span className="bol-desc">{b.resumen}</span>}
        <span>{[!b.resumen && b.pdf && archivo(b.pdf), b.nota].filter(Boolean).join(' · ')}</span>
        {b.palabras.length > 0 && (
          <span className="bol-claves" role="group" aria-label="Palabras clave: tocar una busca boletines con ella">
            {b.palabras.slice(0, vista === 'bloques' ? 3 : 6).map((p) => (
              <button type="button" key={p} className="bol-clave" onClick={() => buscarPor(p)}>
                {p}
              </button>
            ))}
          </span>
        )}
      </div>
      <div className="acts">
        {b.pdf ? (
          <>
            <Link className="ds-btn ds-btn--primary" to={'/boletines/' + b.id} aria-label={'Leer el boletín del ' + fechaCorta(b.fecha)}>
              Leer
            </Link>
            <a className="ds-btn ds-btn--ghost" href={b.pdf} target="_blank" rel="noopener" aria-label={'Abrir el PDF del ' + fechaCorta(b.fecha) + ' (pestaña nueva)'}>
              Abrir PDF ↗
            </a>
          </>
        ) : (
          <span className="count-note">PDF no disponible</span>
        )}
        {b.flipbook && b.pdf && (
          <a className="ds-btn ds-btn--ghost" href={b.flipbook} target="_blank" rel="noopener" aria-label={'Flipbook del ' + fechaCorta(b.fecha) + ' (pestaña nueva)'}>
            Flipbook ↗
          </a>
        )}
      </div>
    </div>
  )

  return (
    <>
      <CabeceraPagina
        miga="Boletines"
        titulo="Alcaldía al día"
        padres={[{ t: 'Documentos', h: '/documentos' }]}
        intro={`Boletín informativo del Municipio: los ${L.length} publicados en la intranet, ordenados por su fecha real${SIN_PDF ? ` (${SIN_PDF} sin PDF disponible)` : ''}.`}
      />

      <Estadisticas
        items={[
          { v: L.length, k: 'Boletines publicados' },
          { v: L.length ? fechaCorta(L[0].fecha) : '—', k: 'Más reciente' },
          { v: L.length ? fechaCorta(L[L.length - 1].fecha) : '—', k: 'Primero' },
          { v: 'PDF', k: 'Formato' },
        ]}
      />

      <div className="toolbar">
        <CampoBusqueda valor={texto} onCambio={setTexto} etiqueta="Buscar en los boletines" placeholder="Buscar un tema, una palabra o un mes" />
        <Chips
          etiqueta="Filtrar por año"
          opciones={[{ v: 'todos', t: 'Todos', n: base.length }, ...ANIOS.map((a) => ({ v: a, t: a, n: base.filter((b) => b.fecha.startsWith(a)).length }))]}
          valor={filtro.anio}
          onCambio={(anio) => cambiar({ anio })}
        />
        <span className="count-note" aria-live="polite">
          {buscando ? 'Buscando…' : q ? `${filas.length} ${filas.length === 1 ? 'boletín encontrado' : 'boletines encontrados'} de ${L.length}` : `${filas.length} de ${L.length} boletines`}
        </span>
        <SelectorVista valor={vista} onCambio={setVista} />
      </div>

      {!buscando && !filas.length && (
        <p className="empty show">
          {q ? (
            <>
              No hay boletines con «{q}». Prueba con otra palabra, un tema (por ejemplo «reciclaje») o un mes.{' '}
              <button type="button" className="ds-btn ds-btn--subtle" onClick={() => buscarPor('')}>
                Ver todos
              </button>
            </>
          ) : (
            'No hay boletines de ese año.'
          )}
        </p>
      )}

      {meses.map(({ mes, lista }) => (
        <section className="section" key={mes} aria-label={mayuscula(mes)}>
          <header><h2>{mayuscula(mes)}</h2></header>
          {vista === 'bloques' ? (
            <div className="bol-lista vista-bloques">{lista.map(fila)}</div>
          ) : (
            <div className="panel">
              <div className="body" style={{ paddingTop: 2 }}>
                {lista.map(fila)}
              </div>
            </div>
          )}
        </section>
      ))}

      <div style={{ marginTop: 20 }}>
        <Aviso>
          «Leer» abre el boletín aquí mismo; «Abrir PDF» lo abre en una pestaña nueva. Cada PDF está guardado en esta intranet. La descripción y las palabras clave salen del texto de cada boletín.
        </Aviso>
      </div>
    </>
  )
}
