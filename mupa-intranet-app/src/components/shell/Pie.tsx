/** Pie del sitio: dirección, redes, enlaces de interés y portales ciudadanos (datos del sitio actual). */
import React from 'react'

import { REDES_OFICIALES } from '../../data/marca'

/**
 * Redes de la Alcaldía en el pie: las cuentas oficiales que entregó Comunicación (data/marca.ts, 5-oct-2026),
 * en este orden. X se conserva del sitio anterior: Comunicación no entregó una cuenta de X.
 */
const OFICIALES = REDES_OFICIALES[0].redes.map((r) => [r.red, r.h] as [string, string])
export const REDES: [string, string][] = [OFICIALES[1], ['X', 'https://x.com/panamaalcaldia'], OFICIALES[0], OFICIALES[2], OFICIALES[3]]
const INTERES = [
  ['SIACAP', 'https://www.siacap.gob.pa/'],
  ['SIPE · CSS', 'http://www.css.gob.pa/sipe/'],
  ['Gaceta Oficial', 'https://www.gacetaoficial.gob.pa'],
  ['PanamaCompra', 'https://www.panamacompra.gob.pa/Inicio/#!/'],
  ['Municipio de Panamá', 'https://mupa.gob.pa/'],
]

const Lista = ({ items }: { items: string[][] }) => (
  <ul className="ft-links">
    {items.map(([t, h]) => (
      <li key={t}>
        <a className="ext" href={h} target="_blank" rel="noopener">{t}</a>
      </li>
    ))}
  </ul>
)

export function Pie() {
  return (
    <footer className="app-footer">
      <div className="ft-col ft-brand">
        <img src="/marca/logos/svg/logo-azul-navy-sobre-blanco-horizontal.svg" alt="Alcaldía de Panamá" width={200} height={104} />
        <p>Ave. Justo Arosemena y Cuba y entre calles 35 y 36 Este, Corregimiento de Calidonia. República de Panamá.</p>
        <p>Tel: <a href="tel:+5075248900">524-8900</a></p>
      </div>
      <div className="ft-col">
        <p className="ds-overline">Redes de la Alcaldía</p>
        <Lista items={REDES} />
      </div>
      <div className="ft-col">
        <p className="ds-overline">Enlaces de interés</p>
        <Lista items={INTERES} />
      </div>
      <div className="ft-col ft-portals">
        <p className="ds-overline">Portales ciudadanos</p>
        <a href="https://311.gob.pa/" className="no-ext" target="_blank" rel="noopener">
          <img src="/sitio/2021/02/311-logo.png" alt="Centro de Atención Ciudadana 311" height={44} />
        </a>
        <a href="https://www.panamatramita.gob.pa/" className="no-ext" target="_blank" rel="noopener">
          <img src="/sitio/2021/02/panama-tramita-logo.png" alt="Panamá Tramita" height={44} />
        </a>
      </div>
    </footer>
  )
}
