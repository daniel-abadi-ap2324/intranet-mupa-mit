/**
 * Barra «Paneles de gestión»: los accesos a las pantallas de gestión (anuncios,
 * boletines, usuarios…) que esta persona puede usar. Va en el Centro de Gestión,
 * según la pestaña, y arriba de cada pantalla de gestión para saltar entre las
 * de su grupo. Reemplaza los enlaces de gestión del menú lateral.
 */
import React from 'react'
import { Link } from 'react-router'

import { useDatos } from '../../datos'
import { gestionDe, type GrupoGestion } from '../../lib/menu'
import { IconoGestion } from './Iconos'

export type CifraPanel = { t: string; pendiente?: boolean }

export function PanelesGestion(p: {
  grupos: readonly GrupoGestion[]
  /** Id de la pantalla abierta (queda marcada). */
  actual?: string | null
  /** Ids que no se muestran (el Centro no se muestra a sí mismo ni la bandeja, que ya es su pestaña). */
  excluir?: string[]
  /** Una cifra corta por pantalla: «2 vigentes», «5 sin depto.». */
  cifras?: Partial<Record<string, CifraPanel>>
  /** En las pantallas de gestión: primero, el enlace para volver al Centro. */
  volver?: boolean
}) {
  const { usuario } = useDatos()
  const fuera = p.excluir ?? ['gestion-centro']
  const grupos = gestionDe(usuario)
    .filter((g) => p.grupos.includes(g.grupo))
    .map((g) => ({ ...g, items: g.items.filter((it) => !fuera.includes(it.id)) }))
    .filter((g) => g.items.length)
  if (!grupos.length) return null
  const variosGrupos = grupos.length > 1
  return (
    <nav className="cg-paneles" aria-label="Paneles de gestión">
      {p.volver && (
        <Link className="cg-panel cg-panel--volver" to="/gestion">
          <span aria-hidden="true">←</span>
          <span className="cg-panel__t">Centro de Gestión</span>
        </Link>
      )}
      {grupos.map((g) => (
        <div key={g.grupo} className="cg-paneles__grupo" role="group" aria-label={g.grupo}>
          {variosGrupos && (
            <span className="cg-paneles__k" aria-hidden="true">
              {g.grupo}
            </span>
          )}
          {g.items.map((it) => {
            const n = p.cifras?.[it.id]
            const activo = it.id === p.actual
            return (
              <Link key={it.id} className={'cg-panel' + (activo ? ' is-activo' : '')} to={it.h} aria-current={activo ? 'page' : undefined} title={it.d}>
                <IconoGestion nombre={it.icono} className="cg-panel__ic" />
                <span className="cg-panel__t">{it.t}</span>
                {/* El espacio separa nombre y cifra en el nombre accesible («Boletines 34»); en el flex no se ve. */}
                {n && ' '}
                {n && <span className={'cg-panel__n' + (n.pendiente ? ' is-pendiente' : '')}>{n.t}</span>}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
