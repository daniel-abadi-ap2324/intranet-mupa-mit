/** Paleta oficial: cada color con HEX, RGB y CMYK (donde lo trae el paquete) y botón para copiar. Datos en data/marca.ts. */
import React from 'react'

import { AZULES, BLANCO, GRISES, IMPRENTA, rgbDeHex, type ColorMarca } from '../../data/marca'
import { useSitio } from '../Proveedores'

/** Copia al portapapeles (si el navegador no deja, con un campo temporal). */
async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    const campo = document.createElement('textarea')
    campo.value = texto
    campo.setAttribute('readonly', '')
    campo.style.position = 'fixed'
    campo.style.opacity = '0'
    document.body.appendChild(campo)
    campo.select()
    try {
      return document.execCommand('copy')
    } finally {
      campo.remove()
    }
  }
}

function Muestra({ c }: { c: ColorMarca }) {
  const { avisar } = useSitio()
  const [r, g, b] = rgbDeHex(c.hex)
  const rgb = `${r}, ${g}, ${b}`
  const alCopiar = async (texto: string, que: string) => avisar((await copiar(texto)) ? `${que} copiado: ${texto}` : 'No se pudo copiar. Selecciona el código y cópialo a mano.')
  return (
    <li className={'cm-color' + (c.principal ? ' is-principal' : '')}>
      <span className="cm-color__muestra" style={{ background: c.hex }} role="img" aria-label={`Muestra del color ${c.nombre}, ${c.hex}`} />
      <div className="cm-color__tx">
        <b>{c.nombre}</b>
        <dl>
          <div>
            <dt>HEX</dt>
            <dd>{c.hex}</dd>
          </div>
          <div>
            <dt>RGB</dt>
            <dd>{rgb}</dd>
          </div>
          {c.cmyk && (
            <div>
              <dt>CMYK</dt>
              <dd>{c.cmyk.join(', ')}</dd>
            </div>
          )}
        </dl>
        <div className="cm-color__acts">
          <button type="button" className="cm-dl" onClick={() => alCopiar(c.hex, 'HEX')} aria-label={`Copiar el HEX de ${c.nombre}: ${c.hex}`}>
            Copiar HEX
          </button>
          <button type="button" className="cm-dl" onClick={() => alCopiar(rgb, 'RGB')} aria-label={`Copiar el RGB de ${c.nombre}: ${rgb}`}>
            Copiar RGB
          </button>
        </div>
      </div>
    </li>
  )
}

export function Paleta() {
  return (
    <>
      <p className="cm-sec__intro">
        Los colores del logo van marcados. El RGB se calcula del HEX del manual.
      </p>
      <h3 className="cm-sub">Azules</h3>
      <ul className="cm-colores">
        {AZULES.map((c) => (
          <Muestra key={c.hex} c={c} />
        ))}
      </ul>
      <h3 className="cm-sub">Grises y blanco</h3>
      <ul className="cm-colores">
        {[...GRISES, BLANCO].map((c) => (
          <Muestra key={c.hex} c={c} />
        ))}
      </ul>
      <p className="cm-nota">
        Para imprenta: {IMPRENTA.nombre} ({IMPRENTA.hex}), según el Manual de marca.
      </p>
    </>
  )
}
