/** Formularios de solicitud, por área. Los arma el Gestor de Solicitudes (/gestion/formularios). */
import React from 'react'

import { Aviso, CabeceraPagina, TarjetaSistema } from '../components/ui'
import { AREA_SISTEMAS, SISTEMAS_SOLICITUD } from '../data/sistemas-solicitud'
import { useDatos } from '../datos'
import { areasDe, contarCampos } from '../lib/formularios'

const COLORES = ['azul', 'morado', 'cian', 'lima', 'cafe', 'coral']

export function PaginaFormularios() {
  const { formularios } = useDatos()
  const dePrueba = formularios.filter((f) => !f.recibe).length

  return (
    <>
      <CabeceraPagina
        titulo="Formularios de solicitud"
        padres={[{ t: 'Aplicaciones', h: '/aplicaciones' }, { t: 'Mesa de Servicios', h: '/mesa-servicios' }]}
        intro={`Los ${formularios.length} formularios de la intranet. Todos siguen el mismo orden: quién solicita → para quién es → qué se pide → comentarios.`}
      />
      {dePrueba > 0 && (
        <Aviso>
          {dePrueba === formularios.length ? (
            <>
              <b>Por ahora el envío es de prueba:</b> al enviar ves el resumen de tu solicitud, pero no se manda nada.
            </>
          ) : (
            <>
              Los formularios marcados <b>«De prueba»</b> todavía no envían nada: al enviar ves el resumen, pero no llega a nadie.
            </>
          )}{' '}
          El envío real se habilita cuando cada área confirma su formulario.
        </Aviso>
      )}
      {/* Tecnología siempre aparece: ahí van también las solicitudes que tienen su propio sistema. */}
      {[...new Set([...areasDe(formularios), AREA_SISTEMAS])].map((area) => {
        const L = formularios.filter((f) => f.area === area)
        const sistemas = area === AREA_SISTEMAS ? SISTEMAS_SOLICITUD : []
        return (
          <section className="section" key={area} aria-labelledby={'f-' + area}>
            <header>
              <h2 id={'f-' + area}>{area}</h2>
              <span className="n">{L.length + sistemas.length}</span>
            </header>
            <div className="sys-grid">
              {L.map((f, i) => (
                <TarjetaSistema
                  key={f.slug}
                  h={'/formularios/' + f.slug}
                  g="▤"
                  color={COLORES[i % COLORES.length]}
                  t={f.title}
                  p={f.intro}
                  meta={
                    <>
                      <span className="tagline">{contarCampos(f)} campos</span>
                      <span className="tagline tagline--brand">Form. {f.id}</span>
                      {f.aDefinir ? <span className="tagline tagline--warn">A definir con RRHH</span> : !f.recibe && <span className="tagline tagline--warn">De prueba</span>}
                    </>
                  }
                />
              ))}
              {sistemas.map((s) => (
                <TarjetaSistema key={s.h} h={s.h} g={s.g} color={s.color} t={s.t} p={s.p} meta={<span className="tagline">Sistema propio</span>} />
              ))}
            </div>
            {area === 'Recursos Humanos' && (
              <p className="ds-body-sm" style={{ margin: '12px 0 0' }}>
                Consultas sobre trámites de RRHH: <b>506-9692, Ext. 9171/9172</b>.
              </p>
            )}
          </section>
        )
      })}
    </>
  )
}
