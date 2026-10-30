/**
 * Guía rápida de uso del logo (/comunicacion/guia-del-logo): los mismos cuatro temas de la
 * «Guía rápida de uso del logotipo» de Comunicación (qué logo usar, el fondo, tamaño y proporciones,
 * errores frecuentes), armados aquí con los logos oficiales. Los ejemplos de «no hacer» se construyen
 * con CSS sobre el logo oficial solo para mostrar el error; nunca se ofrecen para descargar.
 * La guía no fija una medida mínima: se dice, sin inventarla.
 */
import React from 'react'

import { GUIA_PDF, LOGOS, rutaLogo } from '../data/marca'
import { CabeceraPagina } from '../components/ui'
import { activa } from '../lib/edicion'

const L = (archivo: string) => rutaLogo(archivo, 'svg')
const NORMAL = 'logo-azul-sobre-blanco-horizontal'
const BLANCO_AZUL = 'logo-blanco-sobre-azul-horizontal'
const BLANCO_NAVY = 'logo-blanco-sobre-azul-navy-horizontal'

/** Un ejemplo: la imagen, si es correcto o no y qué dice. El estado se dice con texto, no solo con color. */
function Ejemplo({ ok, titulo, children, clase }: { ok: boolean; titulo: string; children: React.ReactNode; clase?: string }) {
  return (
    <figure className={'gl-ej ' + (ok ? 'is-ok' : 'is-mal')}>
      <div className={'gl-ej__vista ' + (clase ?? '')}>{children}</div>
      <figcaption>
        <b>{ok ? '✔ Correcto' : '✘ No hacer'}</b>
        <span>{titulo}</span>
      </figcaption>
    </figure>
  )
}

const Img = ({ f, alt, style }: { f: string; alt: string; style?: React.CSSProperties }) => <img src={L(f)} alt={alt} style={style} decoding="async" />

export function PaginaGuiaLogo() {
  const claros = LOGOS.filter((l) => l.fondo === 'claro')
  const color = LOGOS.filter((l) => l.fondo === 'color')
  return (
    <>
      <CabeceraPagina
        miga="Guía del logo"
        titulo="Guía rápida de uso del logo"
        padres={[{ t: 'Identidad visual', h: '/comunicacion' }]}
        intro="Todo lo que necesitas para usar correctamente el logotipo institucional. Tomado de la guía de Comunicación."
        acciones={
          <a className="ds-btn ds-btn--ghost" href={GUIA_PDF.archivo} target="_blank" rel="noopener noreferrer">
            Abrir el PDF original ({GUIA_PDF.tam}) ↗
          </a>
        }
      />

      <section className="cm-sec" aria-labelledby="h-gl-1">
        <h2 id="h-gl-1">¿Qué logo debo usar?</h2>
        <p className="cm-sec__intro">Utiliza siempre una de las versiones oficiales disponibles. No cambies los colores ni crees nuevas combinaciones.</p>
        <h3 className="cm-sub">Fondo claro</h3>
        <ul className="gl-fila">
          {claros.map((l) => (
            <li key={l.archivo}>
              <img src={L(l.archivo)} alt={`${l.nombre}, ${l.orientacion}`} loading="lazy" decoding="async" />
              <span>{l.nombre} · {l.orientacion}</span>
            </li>
          ))}
        </ul>
        <h3 className="cm-sub">Fondo institucional (de color)</h3>
        <ul className="gl-fila">
          {color.map((l) => (
            <li key={l.archivo}>
              <img src={L(l.archivo)} alt={`${l.nombre}, ${l.orientacion}`} loading="lazy" decoding="async" />
              <span>{l.nombre} · {l.orientacion}</span>
            </li>
          ))}
        </ul>
        <p className="cm-nota">
          Cuando utilices una versión con fondo de color, ese mismo color debe continuar en el fondo de la pieza para que el logotipo se integre de forma uniforme.
        </p>
        <div className="gl-ejs">
          <Ejemplo ok titulo="El fondo de la pieza es del mismo color que el de la versión del logo." clase="gl-fondo-azul">
            <Img f={BLANCO_AZUL} alt="Logo blanco sobre azul en una pieza del mismo azul: se ve como una sola superficie" />
          </Ejemplo>
          <Ejemplo ok titulo="Fondo gris oscuro con la versión de logo blanco sobre gris." clase="gl-fondo-gris">
            <Img f="logo-blanco-sobre-gris-horizontal" alt="Logo blanco sobre gris en una pieza del mismo gris" />
          </Ejemplo>
          <Ejemplo ok={false} titulo="El recuadro del logo se nota sobre otro color de fondo." clase="gl-fondo-navy">
            <Img f={BLANCO_AZUL} alt="Logo blanco sobre azul puesto sobre un fondo azul navy: queda un recuadro visible" style={{ width: '70%' }} />
          </Ejemplo>
          <Ejemplo ok={false} titulo="Un recuadro blanco alrededor de una versión para fondo de color." clase="gl-fondo-gris-claro">
            <span className="gl-recuadro-blanco">
              <Img f={NORMAL} alt="Logo azul sobre blanco dentro de un recuadro blanco sobre fondo gris claro" style={{ width: '100%' }} />
            </span>
          </Ejemplo>
        </div>
      </section>

      <section className="cm-sec" aria-labelledby="h-gl-2">
        <h2 id="h-gl-2">Tamaño mínimo y proporciones</h2>
        <p className="cm-sec__intro">El logotipo debe mantenerse siempre legible y conservar sus proporciones originales. No estirar, no comprimir.</p>
        <div className="gl-ejs">
          <Ejemplo ok titulo="Proporciones originales y tamaño que se lee bien.">
            <Img f={NORMAL} alt="Logo azul sobre blanco con sus proporciones originales" style={{ width: '62%' }} />
          </Ejemplo>
          <Ejemplo ok={false} titulo="Demasiado pequeño: el nombre ya no se lee.">
            <Img f={NORMAL} alt="Logo azul sobre blanco muy pequeño" style={{ width: '22%' }} />
          </Ejemplo>
          <Ejemplo ok={false} titulo="Estirado a lo ancho.">
            <Img f={NORMAL} alt="Logo azul sobre blanco estirado a lo ancho" style={{ width: '62%', transform: 'scaleX(1.5)' }} />
          </Ejemplo>
          <Ejemplo ok={false} titulo="Comprimido a lo ancho.">
            <Img f={NORMAL} alt="Logo azul sobre blanco comprimido a lo ancho" style={{ width: '62%', transform: 'scaleX(0.6)' }} />
          </Ejemplo>
        </div>
        {activa('proximamente') && <p className="cm-nota">
          <span className="cm-pendiente">Pendiente de Comunicación</span> La guía muestra estos ejemplos pero no fija una medida mínima (en píxeles o milímetros) ni una zona libre alrededor del logo.
        </p>}
      </section>

      <section className="cm-sec" aria-labelledby="h-gl-3">
        <h2 id="h-gl-3">Errores frecuentes</h2>
        <div className="gl-ejs">
          <Ejemplo ok={false} titulo="Inventar tonos: usa solo los colores oficiales del manual.">
            <Img f={NORMAL} alt="Logo en un celeste que no es oficial" style={{ width: '62%', filter: 'hue-rotate(-30deg) saturate(2) brightness(1.5)' }} />
          </Ejemplo>
          <Ejemplo ok={false} titulo="Deformar: no inclinar ni girar el logo.">
            <Img f={NORMAL} alt="Logo azul sobre blanco inclinado y girado" style={{ width: '60%', transform: 'rotate(-8deg) skewX(-14deg)' }} />
          </Ejemplo>
          <Ejemplo ok={false} titulo="Fondos incompatibles: un fondo cian con el logo azul." clase="gl-fondo-cian">
            <Img f={NORMAL} alt="Logo azul sobre un fondo cian chillón: casi no se distingue" style={{ width: '62%' }} />
          </Ejemplo>
          <Ejemplo ok titulo="Usar una versión oficial: aquí, blanco sobre azul navy en una pieza navy." clase="gl-fondo-navy">
            <Img f={BLANCO_NAVY} alt="Logo blanco sobre azul navy" />
          </Ejemplo>
        </div>
        <p className="cm-nota">
          Si la versión que necesitas no está disponible, no la recrees ni la modifiques. Consulta con la Dirección de Comunicación y Relaciones Públicas.
        </p>
      </section>
    </>
  )
}
