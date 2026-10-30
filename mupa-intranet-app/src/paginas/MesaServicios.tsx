/**
 * Mesa de Servicios: solicitar en línea (los formularios si están activos en esta
 * edición, más los sistemas de solicitud que ya existen), el video en 3 partes para
 * restablecer el usuario de máquina, recursos y, al lado, el contacto y las extensiones.
 * Diseño de la propuesta de la jefatura: tarjetas blancas compactas y un panel azul para el video.
 */
import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router'

import { Aviso, CabeceraPagina, Enlace, MarcaExterna, tonoTarjeta } from '../components/ui'
import { INSTRUCTIVOS } from '../data/instructivos'
import { SISTEMAS_SOLICITUD as SISTEMAS } from '../data/sistemas-solicitud'
import { useDatos } from '../datos'
import { activa } from '../lib/edicion'
import { esDeRrhh } from '../lib/formularios'
import { esExterna } from '../lib/url'

// Descripción e ícono de los formularios de Tecnología conocidos. La lista sale de los
// formularios cargados (los que crea o apaga el Gestor de Solicitudes); uno nuevo usa su intro.
const TARJETA: Record<string, { p: string; g: string; color: string }> = Object.fromEntries(
  [
    { slug: 'nuevo-funcionario', p: 'Correo, Office, códigos y accesos en una sola solicitud.', g: '▣', color: 'azul' },
    { slug: 'carpetas-compartidas', p: 'Carpeta en red con permisos de lectura, modificación o control total.', g: '▤', color: 'cafe' },
    { slug: 'acceso-paginas-web', p: 'Habilitar sitios bloqueados por la red institucional.', g: '◈', color: 'morado' },
    { slug: 'acceso-ari', p: 'Cuenta y permisos por departamento tributario.', g: '◉', color: 'lima' },
    { slug: 'lista-de-difusion', p: 'Crear o actualizar una lista de distribución.', g: '✉', color: 'coral' },
    { slug: 'codigo-de-impresion', p: 'Código personal para las impresoras de red.', g: '▥', color: 'gris' },
    { slug: 'internet-proveedores', p: 'Acceso temporal a internet para visitantes en un salón de reuniones.', g: '◈', color: 'azul' },
  ].map(({ slug, ...x }) => [slug, x]),
)


const EXTENSIONES = [
  ['Recepción', '1600'],
  ['Telefonía', '1614'],
  ['Cuarto de Servidores', '1621'],
  ['Administración DTI', '1657'],
  ['Desarrollo', '1670'],
] as const

/** Tarjeta «Solicitar»: ícono en cuadro de color, título, descripción y el enlace en azul abajo. */
function TarjetaSolicitar({ h, g, color, t, p }: { h: string; g: string; color?: string | null; t: string; p?: React.ReactNode }) {
  const c = tonoTarjeta(color)
  return (
    <Enlace h={h} className="msv-sol">
      <span className="msv-sol__ic" style={{ background: c.tint, color: c.color }} aria-hidden="true">{g}</span>
      <span className="msv-sol__tx">
        <b>{t}</b>
        {p && <span>{p}</span>}
      </span>
      <span className="msv-sol__go">
        Solicitar <span aria-hidden="true">→</span>
        {esExterna(h) && <MarcaExterna />}
      </span>
    </Enlace>
  )
}

/** Video en 3 partes: panel azul de la parte activa (abre el MP4 en otra pestaña) y la lista numerada. */
function VideoEnPartes() {
  const [actual, setActual] = useState(0)
  const v = INSTRUCTIVOS[actual]
  return (
    <div className="msv-video">
      <a className="msv-video__panel" href={v.h} target="_blank" rel="noopener" aria-label={`Reproducir ${v.parte.toLowerCase()}: ${v.titulo} (se abre en una pestaña nueva)`}>
        <span className="msv-video__play" aria-hidden="true">▶</span>
        <span className="msv-video__tit">{v.parte} · {v.titulo}</span>
      </a>
      <ol className="msv-video__partes" aria-label="Partes del video">
        {INSTRUCTIVOS.map((x, i) => (
          <li key={x.id}>
            <button type="button" className="msv-parte" aria-current={i === actual ? 'true' : undefined} onClick={() => setActual(i)}>
              <span className="msv-parte__n" aria-hidden="true">{x.id}</span>
              <span className="msv-parte__tx"><b>{x.parte}</b><span>{x.titulo} · {x.duracion}</span></span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

const MAS = [
  { t: 'Manuales', p: 'Manuales de sistemas y procedimientos', h: '/manuales', g: '▤' },
  { t: 'Soporte ISTMO (MEF)', p: 'Guías y portal de Mesa de Ayuda del MEF', h: '/sap-istmo', g: '◈' },
]

export function PaginaMesaServicios() {
  // Desde el Inicio se llega a /mesa-servicios#videos: se baja hasta los videos.
  const { hash } = useLocation()
  const formularios = useDatos().formularios.filter((f) => !esDeRrhh(f.area))
  useEffect(() => {
    if (hash === '#videos') setTimeout(() => document.getElementById('videos')?.scrollIntoView({ block: 'start' }), 60)
  }, [hash])
  const enLinea = activa('formularios')
  return (
    <>
      <CabeceraPagina
        miga="Mesa de Servicios"
        padres={[{ t: 'Aplicaciones', h: '/aplicaciones' }]}
        titulo="Mesa de Servicios"
        intro="Solicitudes, guías y contacto de soporte técnico."
        icono="⚙"
      />

      <div className="msv">
        <div className="msv-main">
          <section className="msv-sec msv-sec--sol" aria-labelledby="h-sol">
            <header className="msv-sec__cab"><h2 id="h-sol">Solicitar en línea</h2></header>
            <div className="msv-sol-grid">
              {enLinea && formularios.map((f) => {
                const x = TARJETA[f.slug]
                return <TarjetaSolicitar key={f.slug} h={'/formularios/' + f.slug} g={x?.g ?? '▤'} color={x?.color ?? 'azul'} t={f.title.replace(/^Solicitud (de |para )?/i, '')} p={x?.p ?? f.intro} />
              })}
              {/* Código de llamadas y WIFI se piden en su propio sistema (fuera de la intranet). */}
              {SISTEMAS.map((f) => <TarjetaSolicitar key={f.h} h={f.h} g={f.g} color={f.color} t={f.t} p={f.p} />)}
            </div>
            <p className="msv-otra">
              ¿Otra cosa? Accesos, carpetas compartidas, correo o impresión: llama a la ext. <b>1400</b> o escribe a <a href="mailto:mesadeayuda@pty.gob.pa">mesadeayuda@pty.gob.pa</a>.
            </p>
          </section>

          <section className="msv-sec msv-sec--video" aria-labelledby="h-videos" id="videos">
            <header className="msv-sec__cab"><h2 id="h-videos">Restablecer usuario de máquina</h2><span>Video en {INSTRUCTIVOS.length} partes</span></header>
            <VideoEnPartes />
          </section>

          <section className="msv-sec msv-sec--mas" aria-labelledby="h-mas">
            <header className="msv-sec__cab"><h2 id="h-mas">También en Tecnología</h2></header>
            <div className="msv-mas">
              {MAS.map((m) => (
                <Enlace key={m.h} h={m.h} className="msv-mas__it">
                  <span className="msv-mas__ic" aria-hidden="true">{m.g}</span>
                  <span className="msv-mas__tx"><b>{m.t}</b><span>{m.p}</span></span>
                  <span className="msv-mas__go" aria-hidden="true">›</span>
                </Enlace>
              ))}
            </div>
          </section>
        </div>

        <aside className="msv-lado" aria-label="Contacto y extensiones">
          <section className="msv-contacto" aria-labelledby="h-contacto">
            <h2 id="h-contacto" className="msv-contacto__tit">
              <span aria-hidden="true">☏</span> Mesa de ayuda · Ext. <b>1400</b>
            </h2>
            <a className="msv-contacto__correo" href="mailto:mesadeayuda@pty.gob.pa">mesadeayuda@pty.gob.pa</a>
          </section>
          <section className="msv-ext" aria-labelledby="h-ext">
            <h2 id="h-ext">Otras extensiones</h2>
            <dl>
              {EXTENSIONES.map(([t, n]) => (
                <div key={n}><dt>{t}</dt><dd>{n}</dd></div>
              ))}
            </dl>
          </section>
          {enLinea && (
            <Aviso>
              <b>Aprobaciones.</b> El formulario de acceso a páginas web requiere la aprobación del Director de la unidad solicitante.
            </Aviso>
          )}
        </aside>
      </div>
    </>
  )
}
