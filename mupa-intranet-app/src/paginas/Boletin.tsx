/**
 * Leer un boletín «Alcaldía al día» dentro de la intranet (/boletines/:id): su PDF va en la misma
 * página, con el visor del navegador. nginx deja enmarcar solo los archivos propios (/api/files/ y
 * /sitio/, nginx/seguridad-archivos.conf); en el celular muchos navegadores no muestran el PDF
 * incrustado, por eso «Abrir PDF» y «Descargar» siempre están a la vista.
 */
import React from 'react'
import { Link, useParams } from 'react-router'

import { Aviso, CabeceraPagina } from '../components/ui'
import { useDatos } from '../datos'
import { diaLargo, fechaCorta, mayuscula } from '../lib/fechas'
import { NoEncontrada } from './NoEncontrada'

export function PaginaBoletin() {
  const { id } = useParams()
  // Del más nuevo al más viejo: el siguiente de la lista es el anterior en el tiempo.
  const { boletines: L } = useDatos()
  const i = L.findIndex((b) => String(b.id) === id)
  if (i < 0) return <NoEncontrada />
  const b = L[i]
  const masNuevo = L[i - 1]
  const masViejo = L[i + 1]
  const titulo = 'Alcaldía al día · ' + mayuscula(diaLargo(b.fecha))

  return (
    <>
      <CabeceraPagina
        miga={'Boletín del ' + fechaCorta(b.fecha)}
        titulo={titulo}
        padres={[
          { t: 'Documentos', h: '/documentos' },
          { t: 'Boletines', h: '/boletines' },
        ]}
        acciones={
          b.pdf ? (
            <>
              <a className="ds-btn ds-btn--ghost" href={b.pdf} target="_blank" rel="noopener" aria-label={'Abrir el PDF del ' + fechaCorta(b.fecha) + ' en una pestaña nueva'}>
                Abrir PDF ↗
              </a>
              <a className="ds-btn ds-btn--ghost" href={b.pdf} download>
                Descargar
              </a>
            </>
          ) : undefined
        }
      />

      {b.resumen && <p className="bol-resumen">{b.resumen}</p>}
      {b.palabras.length > 0 && (
        <p className="bol-claves bol-claves--lector" aria-label="Palabras clave">
          {b.palabras.map((p) => (
            <Link key={p} className="bol-clave" to={'/boletines?q=' + encodeURIComponent(p)}>
              {p}
            </Link>
          ))}
        </p>
      )}

      <nav className="bol-nav" aria-label="Otros boletines">
        {masViejo ? (
          <Link className="ds-btn ds-btn--subtle" to={'/boletines/' + masViejo.id} rel="prev">
            ← {fechaCorta(masViejo.fecha)}
          </Link>
        ) : (
          <span />
        )}
        <Link className="ds-btn ds-btn--subtle" to="/boletines">
          Todos los boletines
        </Link>
        {masNuevo ? (
          <Link className="ds-btn ds-btn--subtle" to={'/boletines/' + masNuevo.id} rel="next">
            {fechaCorta(masNuevo.fecha)} →
          </Link>
        ) : (
          <span />
        )}
      </nav>

      {b.pdf ? (
        <>
          {/* key: al pasar de un boletín a otro, el visor se carga de nuevo. */}
          <iframe key={b.id} className="bol-lector" src={b.pdf} title={titulo} />
          <Aviso>Si el PDF no se ve en tu dispositivo, usa «Abrir PDF» o «Descargar».</Aviso>
        </>
      ) : (
        <p className="empty show">Este boletín no tiene PDF disponible.</p>
      )}
    </>
  )
}
