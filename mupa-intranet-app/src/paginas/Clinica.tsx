/**
 * Clínica Municipal: encabezado con acciones y pestañas, las citas de la persona («Mis citas», leídas del
 * sistema de la Clínica por su cédula), cómo pedir cita o medicamentos (en su sistema de citas) y el personal;
 * al lado, datos rápidos (horario, recetas, especialidades y qué es la Clínica). Diseño de la Mesa de Servicios.
 */
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { api } from '../api'
import { MisCitas } from '../components/clinica/MisCitas'
import { PestanasClinica } from '../components/clinica/Pestanas'
import { Aviso, CabeceraPagina, Enlace, MarcaExterna, tonoTarjeta } from '../components/ui'
import { MEDICAMENTOS, PERSONAL } from '../data/clinica'
import { textoDiasAtencion, type InfoClinica } from '../lib/clinica'
import { rutaVisible } from '../lib/edicion'
import { INSTRUCTIVO_CLINICA, URL_CITAS } from '../lib/menu'
import { esExterna, miniaturaWeb } from '../lib/url'


export function BotonCita() {
  return (
    <a className="ds-btn ds-btn--primary" href={URL_CITAS} target="_blank" rel="noopener">
      <span aria-hidden="true">◷</span> Agendar cita ↗
    </a>
  )
}

/** "hoy a las 2:05 p. m." o "el 28 de septiembre de 2026", en hora de Panamá. */
function cuando(iso: string, fuente: InfoClinica['fuente']): string {
  const d = new Date(iso)
  const zona = { timeZone: 'America/Panama' } as const
  const dia = (x: Date) => x.toLocaleDateString('es-PA', zona)
  if (fuente === 'clinica' && dia(d) === dia(new Date())) return 'hoy a las ' + d.toLocaleTimeString('es-PA', { ...zona, hour: 'numeric', minute: '2-digit' })
  return 'el ' + d.toLocaleDateString('es-PA', { ...zona, day: 'numeric', month: 'long', year: 'numeric' })
}

/** Tarjeta «Solicitar»: ícono en cuadro de color, título, una línea y el enlace (como la Mesa de Servicios). */
function TarjetaPedir({ h, g, color, t, p, ir }: { h: string; g: string; color: string; t: string; p: string; ir: string }) {
  const c = tonoTarjeta(color)
  return (
    <Enlace h={h} className="cl-sol">
      <span className="cl-sol__ic" style={{ background: c.tint, color: c.color }} aria-hidden="true">{g}</span>
      <b>{t}</b>
      <span className="cl-sol__p">{p}</span>
      <span className="cl-sol__go">
        {ir} <span aria-hidden="true">→</span>
        {esExterna(h) && <MarcaExterna />}
      </span>
    </Enlace>
  )
}

/** Fila etiqueta / valor de las tarjetas del lado. */
function Dato({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Las iniciales del nombre, sin el título (Dr., Licda., Mgtr.…). */
const iniciales = (n: string) =>
  n
    .split(' ')
    .filter((w) => !w.endsWith('.'))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')

/** Personal: filas compactas con foto chica (o sus iniciales); los servicios, en un desplegable de solo texto. */
function Personal() {
  return (
    <section className="cl-sec" aria-labelledby="h-personal">
      <header className="cl-sec__cab">
        <h2 id="h-personal">Quién atiende</h2>
      </header>
      <div className="cl-staff">
        {PERSONAL.map((p) => (
          <article className="cl-per" key={p.nombre}>
            {p.foto ? (
              <img src={miniaturaWeb(p.foto)} alt={p.nombre} loading="lazy" decoding="async" width={68} height={68} />
            ) : (
              <span className="cl-per__ini" aria-hidden="true">{iniciales(p.nombre)}</span>
            )}
            <div className="cl-per__tx">
              <b>{p.nombre}</b>
              <span>{p.espec}</span>
              <details>
                <summary>Servicios ({p.servicios.length})</summary>
                <ul>
                  {p.servicios.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </details>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function PaginaClinica() {
  const total = MEDICAMENTOS.reduce((n, g) => n + g.items.length, 0)
  // null mientras carga; si nuestra API no responde, la página se ve igual, sin los datos en vivo.
  const [info, setInfo] = useState<InfoClinica | null>(null)
  const [sinDatos, setSinDatos] = useState(false)
  useEffect(() => {
    let vivo = true
    api
      .clinica()
      .then((i) => vivo && setInfo(i))
      .catch(() => vivo && setSinDatos(true))
    return () => {
      vivo = false
    }
  }, [])
  const dias = info ? textoDiasAtencion(info.diasCerrados) : 'de lunes a viernes'
  return (
    <>
      <CabeceraPagina
        titulo="Clínica Municipal"
        icono="✚"
        intro="Atención médica sin costo para los colaboradores."
        acciones={
          <>
            <BotonCita />
            <a className="ds-btn ds-btn--subtle" href={URL_CITAS} target="_blank" rel="noopener">
              Solicitar medicamentos ↗
            </a>
          </>
        }
        pestanas={<PestanasClinica actual="general" />}
      />

      <div className="cl">
        <div className="cl-main">
          <div className="cl-citas">
            <MisCitas />
          </div>

          <section className="cl-sec cl-pedir" aria-labelledby="h-citas">
            <header className="cl-sec__cab">
              <h2 id="h-citas">Pedir cita o medicamentos</h2>
            </header>
            <div className="cl-sol-grid">
              <TarjetaPedir h={URL_CITAS} g="◷" color="azul" t="Cita médica" p="Medicina General: consulta o resultados." ir="Solicitar" />
              <TarjetaPedir h={URL_CITAS} g="▥" color="lima" t="Medicamentos crónicos" p="Solo con diagnóstico crónico en tu expediente." ir="Solicitar" />
              <TarjetaPedir h={INSTRUCTIVO_CLINICA} g="▤" color="morado" t="Instructivo del sistema de la Clínica" p="Paso a paso, en PDF." ir="Abrir" />
            </div>
            <p className="cl-nota">Se piden en el sistema de la Clínica. La primera vez te piden datos básicos para abrir tu expediente.</p>
          </section>

          <Personal />
        </div>

        <aside className="cl-lado" aria-label="Datos rápidos de la Clínica">
          <section className="cl-card" aria-labelledby="h-horario">
            <h2 id="h-horario">Horario y ubicación</h2>
            <dl>
              <Dato k="Atiende">{dias.replace(/^de /, '')}</Dato>
              <Dato k="Reserva">{info ? `de ${info.anticipacion.minDias} a ${info.anticipacion.maxDias} días antes` : 'hasta 90 días antes'}</Dato>
              <Dato k="Lugar">Torre C, Edificio Hatillo</Dato>
            </dl>
          </section>

          <section className="cl-card" aria-labelledby="h-recetas">
            <h2 id="h-recetas">Recetas</h2>
            <dl>
              <Dato k="Retiro">martes a jueves, antes de las 11:00 a.m.</Dato>
              <Dato k="Llevar">tu cédula</Dato>
              <Dato k="Medicamentos">{total} en {MEDICAMENTOS.length} especialidades</Dato>
            </dl>
            <p className="cl-card__enl">
              <Link to="/clinica-recetas">Requisitos →</Link>
              <Link to="/clinica-medicamentos">Listado →</Link>
            </p>
          </section>

          {info ? (
            <section className="cl-card" aria-labelledby="h-esp">
              <h2 id="h-esp">
                Especialidades <span>{info.especialidades.length}</span>
              </h2>
              <ul className="clin-chips">
                {info.especialidades.map((e) => (
                  <li key={e.id} title={e.descripcion || undefined}>
                    {e.nombre}
                  </li>
                ))}
              </ul>
              <p className="cl-card__fuente">
                {info.fuente === 'clinica'
                  ? `Sistema de citas, consultado ${cuando(info.actualizado, info.fuente)}.`
                  : `Sin conexión con el sistema de citas: datos guardados ${cuando(info.actualizado, info.fuente)}.`}
              </p>
            </section>
          ) : sinDatos ? (
            <Aviso>No se pudo cargar la lista de especialidades.</Aviso>
          ) : null}

          <section className="cl-card" aria-labelledby="h-sobre">
            <h2 id="h-sobre">Sobre la Clínica</h2>
            <dl>
              <Dato k="Adscrita a">Bienestar y Salud Ocupacional (RR. HH.)</Dato>
              <Dato k="Atiende a">unos 5,092 servidores</Dato>
              <Dato k="Creada">1987 · Convenio MUPA-CSS (Odontología)</Dato>
            </dl>
            <details className="cl-mas">
              <summary>Más sobre la Clínica</summary>
              <img className="cl-mas__logo" src={miniaturaWeb('/sitio/2023/02/logoClinicaM.png')} alt="Logo de la Clínica Municipal" loading="lazy" decoding="async" width={480} height={321} />
              <p>
                <b>Objetivo.</b> Ofrecer un servicio integral y multidisciplinario de salud, sin costo, a los colaboradores municipales (población activa aproximada de 5,092 servidores).
              </p>
              <p>
                <b>Antecedentes.</b> La Clínica Médico-dental fue creada el 1 de julio de 1987 (Alcaldesa Gilma Noriega) y formalizada por el Acuerdo #58 del 17 de mayo de 1994 del Consejo Municipal. Hay un convenio MUPA-CSS para Odontología.
              </p>
              <p>
                <b>Adscripción.</b> Departamento de Bienestar y Salud Ocupacional de la Dirección de {rutaVisible('/recursos-humanos') ? <Link to="/recursos-humanos">Recursos Humanos</Link> : 'Recursos Humanos'}.
              </p>
              <p>
                <b>Ubicación.</b> Desde noviembre de 2008 en la Torre C del Edificio Hatillo (entre Ave. Justo Arosemena y Ave. Cuba, Calidonia).
              </p>
            </details>
          </section>
        </aside>
      </div>
    </>
  )
}
