/**
 * Directorio institucional: extensiones clave, búsqueda por nombre o extensión y
 * filtro por dirección (en la dirección de la página: ?q= y ?dir=; el buscador del
 * Inicio llega con ?q=), y el organigrama. Los datos son los del directorio que
 * publica la intranet actual (ver data/directorio.ts); la API los compara con la central
 * telefónica y deja fuera las extensiones que ya no existen (si no responde, los fijos).
 */
import React from 'react'

import { CabeceraPagina, CampoBusqueda, Estadisticas, Extensiones } from '../components/ui'
import { api } from '../api'
import { DIRECTORIO as D, type PersonaDirectorio } from '../data/directorio'
import { norm } from '../lib/catalogo'
import { haceCuanto } from '../lib/directorio'
import { useFiltroUrl } from '../lib/useFiltroUrl'

/** Filas que se pintan de una vez; «Ver más» agrega otras tantas (la búsqueda y el filtro siempre recorren todo el directorio). */
const POR_PAGINA = 40
const MESA = D.extensionesClave.find((x) => x.ext === '1400')

const DIRECCIONES = [...D.direcciones].sort((a, b) => a.localeCompare(b, 'es'))
// Las oficinas (sin apellido) se ordenan por su nombre, entre las personas.
const clave = (p: { nombre: string; apellido: string }) => p.apellido || p.nombre
const ordenar = (ps: PersonaDirectorio[]) => [...ps].sort((a, b) => clave(a).localeCompare(clave(b), 'es') || a.nombre.localeCompare(b.nombre, 'es'))
const FIJAS = ordenar(D.personas)

export function PaginaDirectorio() {
  const [filtro, cambiar] = useFiltroUrl({ q: '', dir: '' })
  const t = norm(filtro.q.trim())
  const [mostrar, setMostrar] = React.useState(POR_PAGINA)
  // Mientras llega (o si la API no responde), los datos fijos.
  const [personas, setPersonas] = React.useState(FIJAS)
  const [actualizado, setActualizado] = React.useState<string | null>(null)
  React.useEffect(() => {
    let vivo = true
    api
      .directorio()
      .then((d) => {
        if (!vivo || !d.personas.length) return
        setPersonas(ordenar(d.personas))
        setActualizado(d.actualizadoEn)
      })
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [])
  // Al cambiar la búsqueda o la dirección se vuelve a la primera página.
  React.useEffect(() => setMostrar(POR_PAGINA), [filtro.q, filtro.dir])
  // Los equipos de la central (bocinas, paradas…) no van en la lista: salen solo al buscarlos.
  const enLista = personas.filter((p) => !p.soloBusqueda)
  const filas = (t ? personas : enLista).filter((p) => (!filtro.dir || p.direccion === filtro.dir) && (!t || norm([p.nombre, p.apellido, p.direccion, p.unidad, p.ext, p.ubicacion].join(' ')).includes(t)))

  return (
    <>
      <CabeceraPagina miga="Directorio" titulo="Directorio institucional" intro="Contactos y extensiones de las direcciones del Municipio de Panamá." />

      <div className="toolbar">
        <CampoBusqueda valor={filtro.q} onCambio={(q) => cambiar({ q })} etiqueta="Buscar en el directorio" placeholder="Nombre, apellido o extensión…" />
        <select className="ds-select" aria-label="Filtrar por dirección" value={filtro.dir} onChange={(e) => cambiar({ dir: e.target.value })}>
          <option value="">Todas las direcciones</option>
          {DIRECCIONES.map((d) => <option key={d}>{d}</option>)}
        </select>
        <span className="count-note" role="status" aria-live="polite">
          {filas.length ? `Mostrando ${Math.min(mostrar, filas.length)} de ${filas.length}${filas.length < enLista.length ? ` (${enLista.length} en total)` : ''} extensiones` : 'Sin resultados'}
        </span>
      </div>

      {MESA && (
        <p className="dir-mesa">
          <span>Mesa de Servicios</span> <b>ext. {MESA.ext}</b> <span className="dir-mesa__n">Central telefónica {D.central}</span>
        </p>
      )}

      <Estadisticas
        items={[
          { v: D.direcciones.length, k: 'Direcciones' },
          { v: D.central, k: 'Central telefónica' },
          { v: enLista.length, k: 'Extensiones' },
        ]}
      />

      {actualizado && (
        <p className="dir-actualizado" title={new Date(actualizado).toLocaleString('es-PA')}>
          Actualizado {haceCuanto(actualizado)} con la central telefónica.
        </p>
      )}

      <section className="section" aria-labelledby="h-ext">
        <header><h2 id="h-ext">Extensiones clave</h2></header>
        <Extensiones items={D.extensionesClave.map((x) => ({ v: x.ext, t: x.t }))} />
      </section>

      <div className="table-wrap" tabIndex={0} role="region" aria-label="Extensiones del directorio">
        <table className="ds-table">
          <thead>
            <tr><th scope="col">Nombre</th><th scope="col">Apellido</th><th scope="col">Dirección</th><th scope="col">Extensión</th><th scope="col">Ubicación</th></tr>
          </thead>
          <tbody>
            {filas.slice(0, mostrar).map((p, i) => (
              <tr key={p.ext + '-' + i}>
                <td>
                  <span className="who">
                    {p.apellido ? (
                      <span className="av" aria-hidden="true">{((p.nombre[0] ?? '') + (p.apellido[0] ?? '')).toUpperCase()}</span>
                    ) : (
                      <span className="av av--oficina" aria-hidden="true">▦</span>
                    )}
                    <b>{p.nombre}</b>
                  </span>
                </td>
                <td>{p.apellido ? <b>{p.apellido}</b> : <span className="tagline">Oficina</span>}</td>
                <td>
                  {p.direccion}
                  {p.unidad && <span className="dir-unidad">{p.unidad}</span>}
                </td>
                <td className="ext">{p.ext}</td>
                <td>{p.ubicacion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filas.length && <p className="empty show">No encontramos a nadie con esos datos.</p>}
      {filas.length > mostrar && (
        <p className="dir-mas">
          <button type="button" className="ds-btn" onClick={() => setMostrar((n) => n + POR_PAGINA)}>
            Ver más ({Math.min(POR_PAGINA, filas.length - mostrar)} de las {filas.length - mostrar} que faltan)
          </button>
        </p>
      )}

      <section className="section" style={{ marginTop: 28 }} aria-labelledby="h-org">
        <header><h2 id="h-org">Organigrama municipal</h2></header>
        <figure className="figure">
          <a href={D.organigrama} target="_blank" rel="noopener">
            <img src={D.organigrama} alt="Organigrama Municipal de la Alcaldía de Panamá" loading="lazy" width={2560} height={1111} />
          </a>
          <figcaption>Organigrama oficial. Ábrelo para verlo en tamaño completo.</figcaption>
        </figure>
      </section>
    </>
  )
}
