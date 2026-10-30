/**
 * Franja "Tu panel de gestión" del Inicio: accesos a las pantallas de gestión de
 * la persona según su rol, con sus pendientes. No se personaliza ni se quita:
 * así cada rol siempre encuentra sus herramientas en su Inicio. Sí se pliega
 * (se recuerda por persona en este navegador): plegado deja una línea con lo pendiente.
 */
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { api, type Resumen, type Usuario } from '../../api'
import { gestionDe } from '../../lib/menu'
import { IconoGestion } from '../gestion/Iconos'
import { LS } from '../Proveedores'
import { ROL_ETIQUETA, type Rol } from '../../lib/roles'

/** Qué cifra mostrar en cada acceso (si el backend la mandó). `pendiente`: hay algo que atender. */
function cifra(id: string, r: Resumen | null): { t: string; pendiente: boolean } | null {
  if (!r) return null
  if (id === 'gestion-anuncios' && r.activeAnnouncements !== undefined) {
    const t = r.activeAnnouncements + (r.activeAnnouncements === 1 ? ' vigente' : ' vigentes') + (r.draftAnnouncements ? ` · ${r.draftAnnouncements} en borrador` : '')
    return { t, pendiente: false }
  }
  if (id === 'gestion-usuarios' && r.usersWithoutDepartment) return { t: r.usersWithoutDepartment + ' sin departamento', pendiente: true }
  if (id === 'gestion-solicitudes' && r.newRequests) return { t: r.newRequests + (r.newRequests === 1 ? ' nueva' : ' nuevas'), pendiente: true }
  return null
}

export function PanelGestion({ usuario }: { usuario: Usuario | null }) {
  const grupos = gestionDe(usuario)
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const hay = grupos.length > 0
  const clave = 'mupa_gestion_plegado_' + (usuario?.id ?? '')
  // Plegado por defecto (oct-2026): el Inicio de un gestor empieza por lo mismo que el de cualquiera.
  const [plegado, setPlegado] = useState<boolean>(() => LS.get(clave, true))
  const alternar = () => {
    setPlegado(!plegado)
    LS.set(clave, !plegado)
  }
  useEffect(() => {
    if (!hay) return
    let vivo = true
    const cargar = () =>
      api
        .resumen()
        .catch(() => ({}))
        .then((r) => vivo && setResumen(r))
    cargar()
    // Llega una solicitud en vivo: se actualiza "N nuevas".
    window.addEventListener('mupa:solicitudes', cargar)
    return () => {
      vivo = false
      window.removeEventListener('mupa:solicitudes', cargar)
    }
  }, [hay, usuario?.id])

  if (!hay || !usuario) return null
  const roles = usuario.roles
    .filter((r) => r !== 'funcionario')
    .map((r) => ROL_ETIQUETA[r as Rol] ?? r)
    .join(' · ')
  const pendientes = grupos.flatMap((g) => g.items.map((it) => cifra(it.id, resumen))).filter((n) => n?.pendiente).map((n) => n!.t)
  return (
    <section className={'gest-panel' + (plegado ? ' is-plegado' : '')} aria-labelledby="gest-panel-t">
      <div className="gest-panel__head">
        <h2 id="gest-panel-t">Tu panel de gestión</h2>
        <span className="tagline tagline--brand">{roles}</span>
        {plegado && pendientes.length > 0 && <span className="gest-panel__pend">{pendientes.join(' · ')}</span>}
        <button type="button" className="ds-btn ds-btn--ghost gest-panel__btn" aria-expanded={!plegado} aria-controls="gest-panel-grid" onClick={alternar}>
          {plegado ? 'Mostrar' : 'Ocultar'}
        </button>
      </div>
      <div className="gest-panel__grid" id="gest-panel-grid" hidden={plegado}>
        {grupos.flatMap((g) =>
          g.items.map((it) => {
            const n = cifra(it.id, resumen)
            return (
              <Link key={it.id} className="gest-tile" to={it.h}>
                <span className="ic" aria-hidden="true">
                  <IconoGestion nombre={it.icono} />
                </span>
                <span className="tx">
                  <b>{it.t}</b>
                  <span>{it.d}</span>
                  {n && <span className={'gest-tile__n' + (n.pendiente ? ' is-pendiente' : '')}>{n.t}</span>}
                </span>
              </Link>
            )
          }),
        )}
      </div>
    </section>
  )
}
