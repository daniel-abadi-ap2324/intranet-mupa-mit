/**
 * Mi expediente (RRHH Express), de solo lectura: datos laborales, personales y de
 * contacto, formación, evaluaciones, sanciones y dependientes. Para corregir algo,
 * se llama a Recursos Humanos.
 */
import React from 'react'

import { fechaCorta, fechaLarga } from '../../lib/fechas'
import { antiguedad, moneda, type Expediente as Datos } from '../../lib/rrhh'
import { Aviso } from '../ui'
import { Cargando, Datos as Lista, ErrorCarga } from './comun'

type Props = { datos: Datos | null; error: string | null; cargando: boolean; recargar: () => void }

const fecha = (f: string | null) => (f ? fechaLarga(f) : null)

function Bloque({ id, t, children }: { id: string; t: string; children: React.ReactNode }) {
  return (
    <section className="rh-exp__bloque" aria-labelledby={'h-rh-exp-' + id}>
      <h3 id={'h-rh-exp-' + id} className="rh-sub">
        {t}
      </h3>
      {children}
    </section>
  )
}

export function Expediente({ datos, error, cargando, recargar }: Props) {
  if (cargando && !datos) return <Cargando t="Cargando tu expediente…" />
  if (error && !datos) return <ErrorCarga t={error} reintentar={recargar} />
  if (!datos) return null
  const l = datos.laboral
  const p = datos.personal
  const residencia = [p.casa && 'Casa ' + p.casa, p.edificio, p.barriada, p.corregimiento, p.distrito, p.provincia].filter(Boolean).join(', ')

  return (
    <div className="rh-exp">
      <Aviso>Si algún dato no es correcto, llama a Recursos Humanos al 506-9692 para corregirlo.</Aviso>
      <div className="rh-exp__grid">
        <Bloque id="laboral" t="Datos laborales">
          <Lista
            filas={[
              ['Nombre', l.nombre],
              ['Cargo', l.cargo],
              ['Dirección', l.direccion],
              ['Posición', l.posicion],
              ['Planilla', l.planilla],
              ['Fecha de inicio', fecha(l.inicio)],
              ['Antigüedad', l.inicio ? antiguedad(l.inicio) : null],
              ['Fin de contrato', fecha(l.fin)],
              ['Estado', l.estado],
              ['Salario mensual', l.salarioMensual !== null ? moneda(l.salarioMensual) : null],
            ]}
          />
        </Bloque>
        <Bloque id="personal" t="Datos personales y de contacto">
          <Lista
            filas={[
              ['Fecha de nacimiento', fecha(p.nacimiento)],
              ['Estado civil', p.estadoCivil],
              ['Seguro Social', p.seguroSocial],
              ['Teléfono', p.telefono],
              ['Celular', p.celular],
              ['Correo', p.correo],
              ['Residencia', residencia],
              ['Contacto de emergencia', [p.contactoEmergencia, p.telefonoEmergencia].filter(Boolean).join(' · ')],
              ['Función', p.funcion],
              ['Área', p.area],
            ]}
          />
        </Bloque>
      </div>

      <Bloque id="formacion" t="Formación académica">
        {datos.formacion.length ? (
          <ul className="rh-exp__lista">
            {datos.formacion.map((f, i) => (
              <li key={i}>
                <b>{f.titulo ?? 'Título'}</b>
                <span>{[f.institucion, f.comentario].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rh-vacio">No hay formación registrada.</p>
        )}
      </Bloque>

      <Bloque id="evaluaciones" t="Evaluaciones de desempeño">
        {datos.evaluaciones.length ? (
          <ul className="rh-exp__lista">
            {datos.evaluaciones.map((e, i) => (
              <li key={i}>
                <b>
                  {e.categoria ?? 'Evaluación'}
                  {e.promedio !== null ? ' · promedio ' + e.promedio.toLocaleString('es-PA', { maximumFractionDigits: 2 }) : ''}
                </b>
                <span>{[e.fecha && fechaCorta(e.fecha), e.comentarios].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rh-vacio">No hay evaluaciones registradas.</p>
        )}
      </Bloque>

      <Bloque id="sanciones" t="Sanciones">
        {datos.sanciones.length ? (
          <ul className="rh-exp__lista">
            {datos.sanciones.map((s, i) => (
              <li key={i}>
                <b>{s.sancion ?? 'Sanción'}</b>
                <span>{[s.fecha && fechaCorta(s.fecha), s.comentario, s.remunerable ? 'remunerable' : null].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rh-vacio">No tienes sanciones registradas.</p>
        )}
      </Bloque>

      <Bloque id="dependientes" t="Dependientes">
        {datos.dependientes.length ? (
          <ul className="rh-exp__lista">
            {datos.dependientes.map((d, i) => (
              <li key={i}>
                <b>
                  {d.nombre}
                  {d.principal ? ' · principal' : ''}
                </b>
                <span>{[d.parentesco?.toLowerCase(), d.nacimiento && 'nació el ' + fechaCorta(d.nacimiento), d.cedula && 'cédula ' + d.cedula].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rh-vacio">No hay dependientes registrados.</p>
        )}
      </Bloque>
    </div>
  )
}
