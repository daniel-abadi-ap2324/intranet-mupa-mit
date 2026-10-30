/** Logos oficiales: vista previa y descarga en SVG, PNG y PDF, por orientación. Datos en data/marca.ts. */
import React, { useState } from 'react'

import { LOGOS, rutaLogo, type LogoVariante, type Orientacion } from '../../data/marca'
import { activa } from '../../lib/edicion'
import { Chips } from '../ui'

type Filtro = 'todos' | Orientacion

function Tarjeta({ l }: { l: LogoVariante }) {
  const descripcion = `Logo de la Alcaldía de Panamá, ${l.nombre.toLowerCase()}, versión ${l.orientacion}`
  return (
    <article className="cm-logo" aria-label={l.nombre + ', ' + l.orientacion}>
      {/* Las versiones «blanco sobre …» traen su fondo: se ven enteras, sin recuadro propio. */}
      <div className={'cm-logo__vista cm-logo__vista--' + l.fondo}>
        <img src={rutaLogo(l.archivo, 'svg')} alt={descripcion} loading="lazy" decoding="async" />
      </div>
      <div className="cm-logo__tx">
        <b>{l.nombre}</b>
        <span>
          {l.orientacion === 'horizontal' ? 'Horizontal' : 'Vertical'} · {l.hex}
        </span>
      </div>
      <div className="cm-logo__dl">
        {(['svg', 'png', 'pdf'] as const).map((f) =>
          l.formatos[f] ? (
            <a key={f} className="cm-dl" href={rutaLogo(l.archivo, f)} download aria-label={`Descargar ${l.nombre}, ${l.orientacion}, en ${f.toUpperCase()}`}>
              {f.toUpperCase()}
            </a>
          ) : !activa('proximamente') ? null : (
            <span key={f} className="cm-dl is-pendiente" title="Este formato no vino en el paquete de Comunicación">
              {f.toUpperCase()} · pendiente
            </span>
          ),
        )}
      </div>
    </article>
  )
}

export function Logos() {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const lista = LOGOS.filter((l) => filtro === 'todos' || l.orientacion === filtro)
  const claros = lista.filter((l) => l.fondo === 'claro')
  const color = lista.filter((l) => l.fondo === 'color')
  return (
    <>
      <div className="toolbar">
        <Chips<Filtro>
          etiqueta="Filtrar logos por orientación"
          opciones={[
            { v: 'todos', t: 'Todos', n: LOGOS.length },
            { v: 'horizontal', t: 'Horizontal', n: LOGOS.filter((l) => l.orientacion === 'horizontal').length },
            { v: 'vertical', t: 'Vertical', n: LOGOS.filter((l) => l.orientacion === 'vertical').length },
          ]}
          valor={filtro}
          onCambio={setFiltro}
        />
      </div>
      <h3 className="cm-sub">Para fondo claro</h3>
      <div className="cm-logos">
        {claros.map((l) => (
          <Tarjeta key={l.archivo} l={l} />
        ))}
      </div>
      <h3 className="cm-sub">Para fondo de color (traen su propio fondo)</h3>
      <div className="cm-logos">
        {color.map((l) => (
          <Tarjeta key={l.archivo} l={l} />
        ))}
      </div>
    </>
  )
}
