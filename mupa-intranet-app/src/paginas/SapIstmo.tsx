/**
 * Soporte ISTMO (SAP del MEF): cómo pedir ayuda, el video de capacitación del portal,
 * las guías en PDF y el contacto. Mismo contenido que la página del sitio actual
 * (sap-istmo). ISTMO no es de la Alcaldía.
 */
import React from 'react'

import { Aviso, CabeceraPagina, FilaDoc } from '../components/ui'

const PORTAL = 'https://caudnc.mef.gob.pa'
const CORREO = 'CAUdnc@mef.gob.pa'
// Las guías y el video ya están copiados a local (public/sitio/), como las imágenes.
const UP = '/sitio/'
const GUIA_RAPIDA = UP + 'Guia-Rapida-Portal-Mesa-de-Ayuda-290420-1.pdf'
const GUIA_USUARIO = UP + 'Comunicado-DNC-0006-29ABR20-Portal-Mesa-de-Ayuda-Centro-de-Atencion-.pdf'

/** Lo que cubre el video (su índice). */
const TEMAS = [
  '¿Qué es el Centro de Atención al Usuario (CAU) de ISTMO?',
  'Acuerdos de nivel de servicio: impacto, urgencia y tiempos de atención',
  'Crear usuario, registrarse en el portal y configuración básica',
  'Cómo crear y dar seguimiento a un incidente',
  'Buscar respuestas en la base de conocimiento',
]

export function PaginaSapIstmo() {
  return (
    <>
      <CabeceraPagina
        miga="Soporte ISTMO (MEF)"
        titulo="Soporte ISTMO (MEF)"
        padres={[{ t: 'Aplicaciones', h: '/aplicaciones' }, { t: 'Mesa de Servicios', h: '/mesa-servicios' }]}
        intro="Cómo pedir ayuda con el sistema ISTMO (SAP) en el portal de Mesa de Ayuda del Ministerio de Economía y Finanzas."
        acciones={
          <a className="ds-btn ds-btn--primary" href={PORTAL} target="_blank" rel="noopener">
            Ir al portal de Mesa de Ayuda del MEF ↗
          </a>
        }
      />

      <div className="two-col">
        <div>
          <section className="panel" aria-labelledby="h-pasos">
            <header><span className="ic" aria-hidden="true">✓</span><h2 id="h-pasos">Cómo pedir ayuda</h2></header>
            <div className="body prose">
              <ol>
                <li>
                  Entra al <a href={PORTAL} target="_blank" rel="noopener">portal de Mesa de Ayuda del MEF ↗</a> con tu usuario de ISTMO.
                </li>
                <li>
                  Crea un incidente y describe el problema. Paso a paso en la <a href={GUIA_RAPIDA} target="_blank" rel="noopener">guía rápida (PDF)</a>.
                </li>
                <li>
                  ¿No tienes usuario o no puedes entrar? Escribe a <a href={'mailto:' + CORREO}>{CORREO}</a> (ver la <a href={GUIA_USUARIO} target="_blank" rel="noopener">guía de usuarios, PDF</a>). Si el portal da un error, adjunta una captura de pantalla.
                </li>
              </ol>
            </div>
          </section>

          <div style={{ height: 16 }} />
          <section className="panel" aria-labelledby="h-video">
            <header><span className="ic" aria-hidden="true">▶</span><h2 id="h-video">Capacitación: uso del portal de soporte de ISTMO</h2></header>
            <div className="body">
              <video className="video-player" src={UP + 'ISTMO-capacitacion.mp4'} poster={UP + 'ISTMO-capacitacion-poster.jpg'} controls preload="none" aria-describedby="istmo-temas">
                Tu navegador no puede reproducir el video. <a href={UP + 'ISTMO-capacitacion.mp4'}>Descárgalo aquí</a>.
              </video>
              <p className="ds-body-sm" style={{ margin: '12px 0 6px' }}>
                <b>42 minutos</b> · Lo que cubre:
              </p>
              <ul className="ds-body-sm" id="istmo-temas" style={{ margin: 0, paddingLeft: 20 }}>
                {TEMAS.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </section>

          <div style={{ height: 16 }} />
          <section className="panel" aria-labelledby="h-guias">
            <header><span className="ic" aria-hidden="true">▤</span><h2 id="h-guias">Guías en PDF</h2></header>
            <div className="body" style={{ paddingTop: 2 }}>
              <div className="doc-list">
                <FilaDoc x={{ t: 'Guía rápida: solicitar ayuda en el portal de Mesa de Ayuda MEF', meta: 'PDF · 29 de abril de 2020', h: GUIA_RAPIDA, g: 'PDF' }} ic="" />
                <FilaDoc x={{ t: 'Guía: problemas con el usuario o creación de un usuario nuevo de ISTMO', meta: 'Comunicado DNC-0006 · 29 de abril de 2020', h: GUIA_USUARIO, g: 'PDF' }} ic="" />
              </div>
            </div>
          </section>
        </div>

        <div>
          <section className="panel" aria-labelledby="h-cau">
            <header><span className="ic" aria-hidden="true">☏</span><h2 id="h-cau">Contacto</h2></header>
            <div className="body">
              <div className="ext-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="ext-tile"><b>506-6789</b><span>Atención al Usuario de la DNC-MEF</span></div>
                <div className="ext-tile">
                  <b style={{ fontSize: 16, wordBreak: 'break-all' }}>
                    <a href={'mailto:' + CORREO} style={{ color: 'inherit', textDecoration: 'none' }}>{CORREO}</a>
                  </b>
                  <span>Correo del Centro de Atención al Usuario</span>
                </div>
              </div>
            </div>
          </section>
          <div style={{ height: 16 }} />
          <Aviso>
            <b>ISTMO es externo:</b> lo opera la Dirección Nacional de Contabilidad (DNC) del Ministerio de Economía y Finanzas, no la Alcaldía. Su portal pide iniciar sesión.
          </Aviso>
        </div>
      </div>
    </>
  )
}
