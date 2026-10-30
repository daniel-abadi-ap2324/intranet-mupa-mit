/** Requisitos para solicitar recetas en la Clínica Municipal. */
import React from 'react'
import { Link } from 'react-router'

import { PestanasClinica } from '../components/clinica/Pestanas'
import { CabeceraPagina, Extensiones } from '../components/ui'
import { URL_CITAS } from '../lib/menu'
import { BotonCita } from './Clinica'

export function PaginaClinicaRecetas() {
  return (
    <>
      <CabeceraPagina
        miga="Solicitar recetas"
        titulo="Requisitos para solicitar recetas médicas"
        padres={[{ t: 'Clínica Municipal', h: '/clinica' }]}
        icono="✚"
        pestanas={<PestanasClinica actual="recetas" />}
        intro="Consulta de receta para funcionarios con expediente clínico y enfermedad crónica registrada."
        acciones={
          <>
            <a className="ds-btn ds-btn--primary" href={URL_CITAS} target="_blank" rel="noopener">
              Solicitar medicamentos en línea ↗
            </a>
            <BotonCita />
          </>
        }
      />

      <div className="two-col">
        <div className="prose">
          <ol>
            <li>Solo funcionarios <b>con expediente clínico</b>. Si no lo tiene, solicite una consulta de medicina general.</li>
            <li>Enfermedades crónicas registradas: hipertensión (HTA), diabetes tipo 2, tiroides, grasas, salud mental, osteomuscular, asma, gastritis crónica, próstata, migraña, epilepsia y alergias.</li>
            <li>Indique el <b>medicamento y la dosis</b>; nombre completo, cédula y extensión.</li>
            <li><b>Hasta las 11:00 a.m., martes, miércoles y jueves</b>, en línea en el sistema de citas (opción «Solicitud de medicamentos»), en ventanilla o vía telefónica (personal externo). Presente su cédula en farmacia el día del retiro.</li>
            <li>Tras <b>4 emisiones mensuales</b>, debe sacar cita en medicina general.</li>
            <li>Si un especialista de la CSS, del MINSA o particular ajusta el tratamiento, saque cita para actualizar el expediente.</li>
          </ol>
        </div>
        <div>
          <section className="panel" aria-labelledby="h-horario">
            <header>
              <span className="ic" aria-hidden="true">◷</span>
              <h2 id="h-horario">Horario de recetas</h2>
            </header>
            <div className="body">
              <Extensiones
                items={[
                  { v: '11:00 a.m.', t: 'Hora límite' },
                  { v: <span style={{ fontSize: 16 }}>Mar · Mié · Jue</span>, t: 'Días de atención' },
                ]}
              />
              <p className="ds-body-sm" style={{ margin: '14px 0 0' }}>
                Mira el <Link to="/clinica-medicamentos">listado de medicamentos</Link> disponibles por especialidad.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
