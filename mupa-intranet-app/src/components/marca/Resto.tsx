/** Tipografías, texturas, manual, plantillas y redes oficiales de la página de identidad visual. Datos en data/marca.ts. */
import React from 'react'
import { Link } from 'react-router'

import { FIRMA, GUIA_PDF, MANUAL, REDES_OFICIALES, TEXTURAS, TIPOGRAFIAS, VIDEOLLAMADA, WALLPAPERS } from '../../data/marca'
import { MarcaExterna } from '../ui'

export function Tipografias() {
  return (
    <ul className="cm-tipos">
      {TIPOGRAFIAS.map((t) => (
        <li key={t.nombre} className="cm-tipo">
          <b className="cm-tipo__nombre" style={{ fontFamily: `"${t.familia}", "Montserrat", sans-serif` }}>
            {t.nombre}
          </b>
          <span className="cm-tipo__pesos">{t.pesos}</span>
          <p className="cm-tipo__muestra" style={{ fontFamily: `"${t.familia}", "Montserrat", sans-serif` }} aria-hidden="true">
            ABCDEFG abcdefg 12345
          </p>
          <p>{t.uso}</p>
          <p className="cm-tipo__lic">{t.licencia}</p>
          {t.descarga ? (
            <a className="cm-dl" href={t.descarga.archivo} download>
              Descargar · {t.descarga.formato}
            </a>
          ) : (
            <span className="cm-tipo__lic">Tiene licencia: no incluida en esta copia.</span>
          )}
        </li>
      ))}
    </ul>
  )
}

export function Texturas() {
  return (
    <>
      <ul className="cm-texturas">
        {TEXTURAS.vistas.map((v) => (
          <li key={v.n}>
            <img src={v.mini} width={640} height={360} alt={`Trama de la marca número ${v.n}: franjas azules en dos tonos`} loading="lazy" decoding="async" />
            <span>Trama {v.n}</span>
          </li>
        ))}
      </ul>
      <p className="cm-nota">Según el manual, las tramas se usan cuando se habla de los pilares:</p>
      <ul className="cm-pilares">
        {TEXTURAS.pilares.map((p) => (
          <li key={p.t}>
            <b>{p.t}</b> <span>{p.d}</span>
          </li>
        ))}
      </ul>
      <div className="cm-acciones">
        <a className="cm-dl" href={TEXTURAS.pdf} download>
          Texturas · PDF
        </a>
        <a className="cm-dl" href={TEXTURAS.editable} download>
          Texturas · editable (.ai)
        </a>
      </div>
    </>
  )
}

export function ManualYGuia() {
  return (
    <ul className="cm-grid">
      <li>
        <a className="cm-desc" href={MANUAL.archivo} target="_blank" rel="noopener noreferrer">
          <span className="cm-desc__fmt">PDF · {MANUAL.tam} · se abre en otra pestaña</span>
          <b>Manual de marca</b>
          <span className="cm-desc__d">El manual completo de identidad visual: logo, colores, tipografías, tramas y aplicaciones.</span>
          <span className="cm-desc__accion">Abrir <MarcaExterna /></span>
        </a>
      </li>
      <li>
        <Link className="cm-desc" to="/comunicacion/guia-del-logo">
          <span className="cm-desc__fmt">Guía en esta página</span>
          <b>Guía rápida de uso del logo</b>
          <span className="cm-desc__d">Qué logo usar, tamaños y proporciones, y los errores frecuentes, con ejemplos.</span>
          <span className="cm-desc__accion">Ver la guía →</span>
        </Link>
      </li>
      <li>
        <a className="cm-desc" href={GUIA_PDF.archivo} target="_blank" rel="noopener noreferrer">
          <span className="cm-desc__fmt">PDF · {GUIA_PDF.tam} · se abre en otra pestaña</span>
          <b>Guía rápida (PDF original)</b>
          <span className="cm-desc__d">La guía tal como la entregó Comunicación.</span>
          <span className="cm-desc__accion">Abrir <MarcaExterna /></span>
        </a>
      </li>
    </ul>
  )
}

export function Plantillas() {
  return (
    <>
      <ul className="cm-grid">
        <li>
          <a className="cm-desc" href={FIRMA.archivo} download>
            <span className="cm-desc__fmt">{FIRMA.formato}</span>
            <b>{FIRMA.t}</b>
            <span className="cm-desc__d">{FIRMA.d}</span>
            <span className="cm-desc__accion">Descargar</span>
          </a>
        </li>
        <li>
          <div className="cm-desc cm-desc--sin-enlace">
            <span className="cm-desc__fmt">Fondo de videollamada</span>
            <img className="cm-desc__img" src={VIDEOLLAMADA.png.mini} width={800} height={450} alt="Fondo de videollamada: azul institucional con franjas y el logo I★PTY arriba a la derecha" loading="lazy" decoding="async" />
            <div className="cm-acciones">
              <a className="cm-dl" href={VIDEOLLAMADA.png.archivo} download>
                PNG
              </a>
              <a className="cm-dl" href={VIDEOLLAMADA.editable.archivo} download>
                Editable (.ai)
              </a>
            </div>
          </div>
        </li>
      </ul>
      <h3 className="cm-sub">Wallpapers</h3>
      <ul className="cm-wallpapers">
        {WALLPAPERS.map((w) => (
          <li key={w.n}>
            <a href={w.src} download aria-label={`Descargar el wallpaper ${w.n}`}>
              <img src={w.mini} width={640} height={360} alt={`Wallpaper ${w.n} de la marca`} loading="lazy" decoding="async" />
              <span>Wallpaper {w.n}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="cm-acciones">
        <a className="cm-dl" href={VIDEOLLAMADA.editable.archivo} download>
          Todos los wallpapers · editable (.ai)
        </a>
      </div>
    </>
  )
}

export function RedesOficiales() {
  return (
    <ul className="cm-cuentas">
      {REDES_OFICIALES.map((c) => (
        <li key={c.cuenta} className="cm-cuenta">
          <b>{c.cuenta}</b>
          <ul>
            {c.redes.map((r) => (
              <li key={r.red}>
                <a href={r.h} target="_blank" rel="noopener noreferrer" aria-label={`${c.cuenta} en ${r.red} (se abre en otra pestaña)`}>
                  {r.red} <MarcaExterna />
                </a>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
