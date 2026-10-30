/**
 * AppTile: icono en el color del área, nombre, descripción, estados y ★.
 * Mismo marcado que el prototipo (mupa-apps.js), así usa el mismo CSS.
 */
import React from 'react'

import { TINTES, type App } from '../lib/catalogo'
import { useSitio } from './Proveedores'

/** Una descripción corta y completa: la primera frase (antes de «:» o «·») o, si sigue larga, hasta una palabra entera. */
export function descripcionCorta(d: string, max = 70): string {
  const primera = d.split(/\s*[:·]\s*|\.\s/)[0].trim()
  if (primera.length <= max) return primera
  const corte = primera.slice(0, max)
  return corte.slice(0, Math.max(corte.lastIndexOf(' '), 0) || max).replace(/[\s,;:·–-]+$/, '')
}

export function AppTile({ app: a, corta }: { app: App; corta?: boolean }) {
  const { esFav, alternarFav } = useSitio()
  const fav = esFav(a.id)
  const c = TINTES[a.cat] || TINTES.Soporte
  const marcas = [
    a.status && <span key="s" className="tagline tagline--warn">{a.status}</span>,
    a.acceso === 'sesion' && <span key="a" className="tagline">Requiere sesión</span>,
    a.confirmado === false && <span key="c" className="tagline tagline--warn" title="Descripción deducida del nombre: falta que DITI la confirme">Por confirmar</span>,
    a.pdf && <span key="p" className="tagline">PDF</span>,
  ].filter(Boolean)

  const cuerpo = (
    <>
      <span className="app-tile__ic" aria-hidden="true" style={{ background: c.tint, color: c.color }}>{a.g}</span>
      <span className="app-tile__tx">
        <b>{a.name}</b>
        <span>{corta ? descripcionCorta(a.desc) : a.desc}</span>
        {marcas.length > 0 && <span className="app-tile__meta">{marcas}</span>}
      </span>
      {a.ext && <span className="ext-mark" aria-label="abre en pestaña nueva">↗</span>}
    </>
  )

  return (
    <div className={'app-tile' + (a.h ? '' : ' is-disabled')} data-app={a.id} data-cat={a.cat}>
      {a.h ? (
        <a className={'app-tile__link' + (a.ext ? ' no-ext' : '')} href={a.h} {...(a.ext ? { target: '_blank', rel: 'noopener' } : {})}>
          {cuerpo}
        </a>
      ) : (
        <span className="app-tile__link is-disabled" aria-disabled="true" title={a.status || 'Sin enlace'}>{cuerpo}</span>
      )}
      <button
        className="app-tile__fav"
        type="button"
        aria-pressed={fav}
        aria-label={(fav ? 'Quitar de favoritos' : 'Marcar como favorito') + ': ' + a.name}
        title="Favorito"
        onClick={() => alternarFav(a.id)}
      >
        ★
      </button>
    </div>
  )
}
