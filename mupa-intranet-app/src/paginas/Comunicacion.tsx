/**
 * Identidad visual y comunicación (/comunicacion): logos oficiales, paleta, tipografías, texturas,
 * manual y guía del logo, plantillas, redes oficiales y a quién contactar. Los archivos y datos están
 * en data/marca.ts (paquete de la Dirección de Comunicación). Lo que el paquete no trae se ve
 * «Pendiente de Comunicación». Comunicación NO quiere formulario de solicitudes: la página solo dice
 * a quién llamar. No hay secciones de comunicación escrita ni de preguntas frecuentes (no hay texto).
 */
import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router'

import { Logos } from '../components/marca/Logos'
import { Paleta } from '../components/marca/Paleta'
import { ManualYGuia, Plantillas, RedesOficiales, Texturas, Tipografias } from '../components/marca/Resto'
import { CabeceraPagina } from '../components/ui'
import { CONTACTOS_POR_EXT, DIRECCION_COMUNICACION } from '../data/comunicacion'
import { DIRECTORIO } from '../data/directorio'

const PERSONAS_COM = DIRECTORIO.personas.filter((p) => p.direccion === DIRECCION_COMUNICACION)
// Las oficinas a las que se llama (del directorio publicado), en el orden de CONTACTOS_POR_EXT.
const CONTACTOS = CONTACTOS_POR_EXT.flatMap((ext) => PERSONAS_COM.filter((p) => p.ext === ext))
const UBICACIONES_CONTACTOS = [...new Set(CONTACTOS.map((p) => p.ubicacion).filter(Boolean))]
// Recepción (sin apellido repetido) se muestra con su nombre; las demás, nombre y apellido.
const nombreOficina = (p: { nombre: string; apellido: string }) => (p.apellido && p.apellido !== p.nombre ? p.nombre + ' ' + p.apellido : p.nombre)

const SECCIONES = [
  ['logos', 'Logos'],
  ['paleta', 'Paleta'],
  ['tipografias', 'Tipografías'],
  ['texturas', 'Texturas'],
  ['manual', 'Manual y guía'],
  ['plantillas', 'Plantillas'],
  ['redes', 'Redes sociales'],
  ['contacto', 'A quién contactar'],
] as const

function Seccion({ id, t, intro, children }: { id: string; t: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="cm-sec" id={id} aria-labelledby={'h-cm-' + id}>
      <h2 id={'h-cm-' + id}>{t}</h2>
      {intro && <p className="cm-sec__intro">{intro}</p>}
      {children}
    </section>
  )
}

export function PaginaComunicacion() {
  // Desde otra página (el Inicio) la dirección trae un ancla (#paleta): se baja hasta ahí, después de que la navegación suba al título.
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView(), 80)
    return () => clearTimeout(t)
  }, [hash])

  return (
    <>
      <CabeceraPagina
        miga="Identidad visual"
        titulo="Identidad visual y comunicación"
        intro="Logos, colores, tipografías, plantillas y la guía de uso de la marca de la Alcaldía, y a quién contactar en Comunicación."
      />

      <nav className="cm-indice" aria-label="En esta página">
        {SECCIONES.map(([id, t]) => (
          <a key={id} href={'#' + id}>
            {t}
          </a>
        ))}
      </nav>

      <Seccion id="logos" t="Logos" intro="Versiones oficiales del logo. Usa siempre una de estas: no cambies sus colores ni crees combinaciones nuevas.">
        <Logos />
        <p className="cm-nota">
          ¿Dudas sobre cuál usar? Mira la <Link to="/comunicacion/guia-del-logo">guía rápida de uso del logo</Link>. Si la versión que necesitas no está, no la recrees: consulta con Comunicación.
        </p>
      </Seccion>

      <Seccion id="paleta" t="Paleta de colores">
        <Paleta />
      </Seccion>

      <Seccion id="tipografias" t="Tipografías" intro="Las fuentes de la marca y cuándo usar cada una. En esta intranet, los títulos van en Noka y los textos en Montserrat.">
        <Tipografias />
      </Seccion>

      <Seccion id="texturas" t="Texturas" intro="Las tramas de la marca, para fondos de piezas.">
        <Texturas />
      </Seccion>

      <Seccion id="manual" t="Manual de marca y guía rápida">
        <ManualYGuia />
      </Seccion>

      <Seccion id="plantillas" t="Plantillas" intro="Firma digital, fondos de videollamada y wallpapers.">
        <Plantillas />
      </Seccion>

      <Seccion id="redes" t="Redes sociales" intro="Cuentas oficiales. Se abren en una pestaña nueva.">
        <RedesOficiales />
      </Seccion>

      <section className="cm-contactar" id="contacto" aria-labelledby="h-cm-contactar">
        <div className="cm-contactar__tx">
          <h2 id="h-cm-contactar">A quién contactar</h2>
          <p>Para cualquier solicitud a Comunicación (un arte, fotos, la cobertura de un evento, una revisión de marca o una campaña), llama a la Dirección de Comunicaciones.</p>
          <p className="cm-contactar__donde">{UBICACIONES_CONTACTOS.join(' · ')}</p>
        </div>
        <ul className="cm-contactar__lista">
          {CONTACTOS.map((p) => (
            <li key={p.ext}>
              <b>{'ext. ' + p.ext}</b>
              <span>{nombreOficina(p)}</span>
            </li>
          ))}
        </ul>
        <Link className="ds-btn ds-btn--ghost" to={'/directorio?dir=' + encodeURIComponent(DIRECCION_COMUNICACION)}>
          Ver las {PERSONAS_COM.length} extensiones de Comunicaciones
        </Link>
      </section>
    </>
  )
}
