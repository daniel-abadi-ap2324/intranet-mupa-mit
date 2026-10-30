/** Medicamentos que dispensa la Clínica Municipal, por especialidad, con búsqueda (?q=). */
import React from 'react'
import { Link } from 'react-router'

import { PestanasClinica } from '../components/clinica/Pestanas'
import { Aviso, CabeceraPagina, CampoBusqueda } from '../components/ui'
import { MEDICAMENTOS } from '../data/clinica'
import { norm } from '../lib/catalogo'
import { useFiltroUrl } from '../lib/useFiltroUrl'
import { BotonCita } from './Clinica'

const TOTAL = MEDICAMENTOS.reduce((n, g) => n + g.items.length, 0)

export function PaginaClinicaMedicamentos() {
  const [filtro, cambiar] = useFiltroUrl({ q: '' })
  const t = norm(filtro.q.trim())
  const grupos = MEDICAMENTOS.map((g) => ({ ...g, items: g.items.filter((m) => !t || norm(m).includes(t)) })).filter((g) => g.items.length)
  const vistos = grupos.reduce((n, g) => n + g.items.length, 0)

  return (
    <>
      <CabeceraPagina
        miga="Medicamentos"
        titulo="Listado de medicamentos"
        padres={[{ t: 'Clínica Municipal', h: '/clinica' }]}
        icono="✚"
        pestanas={<PestanasClinica actual="medicamentos" />}
        intro="Medicamentos que dispensa la Clínica Municipal, agrupados por especialidad."
        acciones={
          <>
            <Link className="ds-btn ds-btn--subtle" to="/clinica-recetas">Requisitos para recetas</Link>
            <BotonCita />
          </>
        }
      />

      <Aviso>
        <b>Recetas de crónicos:</b> se solicitan hasta las <b>11:00 a.m., martes, miércoles y jueves</b>, en ventanilla o por teléfono. Solo para funcionarios con expediente clínico.{' '}
        <Link to="/clinica-recetas">Ver los 6 requisitos →</Link>
      </Aviso>

      <div className="toolbar">
        <CampoBusqueda valor={filtro.q} onCambio={(q) => cambiar({ q })} etiqueta="Buscar medicamento" placeholder="Buscar un medicamento…" />
        <span className="count-note" aria-live="polite">{vistos} de {TOTAL} medicamentos · {MEDICAMENTOS.length} especialidades</span>
      </div>

      {grupos.map((g, i) => (
        // Con búsqueda se abren todos los grupos que coinciden; sin ella, solo el primero.
        <details className="acc" key={g.grupo + '|' + t} open={!!t || i === 0}>
          <summary>
            {g.grupo}
            <span className="n">{g.items.length}</span>
          </summary>
          <div className="acc-body">
            <ul>{g.items.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        </details>
      ))}
      {!vistos && <p className="empty show">Ningún medicamento coincide con la búsqueda.</p>}
    </>
  )
}
