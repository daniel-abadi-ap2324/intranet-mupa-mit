/** Pestañas de la Clínica: las tres páginas de la sección, bajo el encabezado. */
import React from 'react'
import { Link } from 'react-router'

const PESTANAS = [
  { id: 'general', t: 'General', h: '/clinica' },
  { id: 'recetas', t: 'Solicitar recetas', h: '/clinica-recetas' },
  { id: 'medicamentos', t: 'Medicamentos', h: '/clinica-medicamentos' },
] as const

export function PestanasClinica({ actual }: { actual: (typeof PESTANAS)[number]['id'] }) {
  return (
    <nav className="page-tabs" aria-label="Páginas de la Clínica">
      {PESTANAS.map((p) => (
        <Link key={p.id} to={p.h} className={'page-tabs__tab' + (p.id === actual ? ' is-active' : '')} aria-current={p.id === actual ? 'page' : undefined}>
          {p.t}
        </Link>
      ))}
    </nav>
  )
}
