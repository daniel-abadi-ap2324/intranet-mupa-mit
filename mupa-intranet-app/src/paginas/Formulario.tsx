/**
 * Un formulario de solicitud (/formularios/:slug). Un solo componente para todos
 * (los arma el Gestor de Solicitudes): secciones numeradas, errores en cada
 * campo y un resumen con enlaces, y un panel con el progreso y el destino.
 *
 * Si el formulario todavía no recibe solicitudes, el envío es SIMULADO: se
 * muestra lo que se mandaría y no se transmite nada.
 */
import React, { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'

import { api, ErrorApi } from '../api'
import { Campos, FormCtx } from '../components/formulario/Campo'
import { Aviso, CabeceraPagina, EnlaceEntrar } from '../components/ui'
import { useDatos } from '../datos'
import { errores, esDeRrhh, estadoInicial, idCampo, progreso, resumen, rutaSeccion, seccionesVisibles, type Estado, type Formulario as TFormulario } from '../lib/formularios'
import { NoEncontrada } from './NoEncontrada'

export function PaginaFormulario() {
  const { slug } = useParams()
  const f = useDatos().formularios.find((x) => x.slug === slug)
  if (!f) return <NoEncontrada />
  return <Formulario key={f.slug} f={f} />
}

const ID_FORM = 'form-solicitud'

function Formulario({ f }: { f: TFormulario }) {
  const { usuario } = useDatos()
  const perfil = useMemo(() => (usuario ? { nombreCompleto: usuario.nombre, correo: usuario.correo } : {}), [usuario])
  const [estado, setEstado] = useState<Estado>(() => estadoInicial(f, perfil))
  const [intentado, setIntentado] = useState(false)
  const [enviado, setEnviado] = useState(false)
  /** Solicitud real ya enviada (con su folio). */
  const [folio, setFolio] = useState<{ id: number; folio: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')
  /** Errores que encontró el servidor (se borran al cambiar algo). */
  const [delServidor, setDelServidor] = useState<{ ruta: string; msg: string }[]>([])
  const cajaErrores = useRef<HTMLDivElement>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const area = { t: f.area, dest: f.destino }

  const propios = errores(f, estado)
  const lista = [...propios, ...delServidor.filter((x) => !propios.some((p) => p.ruta === x.ruta))]
  const visibles = intentado ? Object.fromEntries(lista.map((x) => [x.ruta, x.msg])) : {}
  const prog = progreso(f, estado)
  const pct = prog.total ? Math.round((prog.ok / prog.total) * 100) : 100
  const ctx = {
    estado,
    cambiar: (fn: (e: Estado) => Estado) => {
      setEstado(fn)
      setDelServidor([])
    },
    errores: visibles,
  }

  const mostrarErrores = () =>
    requestAnimationFrame(() => {
      cajaErrores.current?.focus()
      cajaErrores.current?.scrollIntoView({ block: 'center' })
    })
  const listo = () => {
    setEnviado(true)
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0 })
      titulo.current?.focus()
    })
  }
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setIntentado(true)
    setErrorEnvio('')
    if (lista.length) return mostrarErrores()
    if (!f.recibe) return listo()
    if (!usuario) return setErrorEnvio('Inicia sesión para enviar la solicitud.')
    setEnviando(true)
    try {
      const r = await api.enviarSolicitud(f.slug, estado)
      setFolio({ id: r.id, folio: r.folio })
      listo()
    } catch (err) {
      const campos = err instanceof ErrorApi ? err.campos.filter((c) => c.field.startsWith('respuestas.')) : []
      if (campos.length) {
        setDelServidor(campos.map((c) => ({ ruta: c.field.slice('respuestas.'.length), msg: c.message })))
        mostrarErrores()
      } else setErrorEnvio(err instanceof ErrorApi ? err.message : 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setEnviando(false)
    }
  }
  const irA = (ruta: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    const el = document.getElementById(idCampo(ruta))
    el?.scrollIntoView({ block: 'center' })
    el?.focus({ preventScroll: true })
  }
  const limpiar = () => {
    setEstado(estadoInicial(f, perfil))
    setIntentado(false)
  }
  const corregir = () => {
    setEnviado(false)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`#${ID_FORM} input, #${ID_FORM} textarea, #${ID_FORM} select`)?.focus())
  }

  return (
    <>
      <CabeceraPagina
        titulo={f.title}
        padres={
          // Como en el menú: los de RRHH cuelgan de Recursos Humanos; los demás, de la Mesa de Servicios.
          esDeRrhh(f.area)
            ? [{ t: 'Recursos Humanos', h: '/recursos-humanos' }]
            : [
                { t: 'Aplicaciones', h: '/aplicaciones' },
                { t: 'Mesa de Servicios', h: '/mesa-servicios' },
                { t: 'Formularios de solicitud', h: '/formularios' },
              ]
        }
        intro={
          <>
            {f.intro} <span className="tagline tagline--brand">Form. {f.id}</span> <span className="tagline">{area.t}</span>
          </>
        }
        acciones={<Link className="ds-btn ds-btn--subtle" to="/formularios">← Todos los formularios</Link>}
      />

      <div className="f-layout">
        <div className="f-main">
          {f.aDefinir && <Aviso tipo="warn">Este trámite se gestionará en el nuevo sistema de planilla. Más información próximamente.</Aviso>}
          {(f.notes || []).map((n) => <Aviso key={n} tipo="warn">{n}</Aviso>)}
          {estado.auto.length > 0 && usuario ? (
            <div className="f-perfil">
              <span className="av" aria-hidden="true">{usuario.iniciales}</span>
              <p>
                Completamos <b>{estado.auto.length === 1 ? '1 dato' : estado.auto.length + ' datos'}</b> con tu perfil ({usuario.nombre}). Revísalos antes de enviar.
              </p>
            </div>
          ) : (
            !usuario &&
            (f.recibe ? (
              <Aviso tipo="warn">
                Para enviar esta solicitud tienes que <EnlaceEntrar>iniciar sesión</EnlaceEntrar>.
              </Aviso>
            ) : (
              <Aviso>
                Si <EnlaceEntrar>inicias sesión</EnlaceEntrar>, completamos tu nombre y tu correo.
              </Aviso>
            ))
          )}

          {enviado ? (
            <div className="f-done">
              <div className="f-done__head">
                <span className="ic" aria-hidden="true">✓</span>
                {folio ? (
                  <div>
                    <h2 tabIndex={-1} ref={titulo}>
                      Solicitud enviada · {folio.folio}
                    </h2>
                    <p>
                      Llegó a {area.dest}
                      {f.plazo ? '; el plazo de respuesta es ' + f.plazo : ''}. Te avisamos en «Mis solicitudes» cuando la respondan.
                    </p>
                  </div>
                ) : (
                  <div>
                    <h2 tabIndex={-1} ref={titulo}>Solicitud lista (simulación)</h2>
                    <p>
                      Cuando se habilite el envío llegaría a {area.dest}
                      {f.plazo ? ' y tardaría ' + f.plazo : ''}. Por ahora no se envió nada.
                    </p>
                  </div>
                )}
              </div>
              <div className="f-review">
                {resumen(f, estado).map((s) => (
                  <React.Fragment key={s.titulo}>
                    <h3>{s.titulo}</h3>
                    <dl>
                      {s.filas.map((x) => (
                        <div key={x.dt}>
                          <dt>{x.dt}</dt>
                          <dd style={{ whiteSpace: 'pre-line' }}>{x.dd}</dd>
                        </div>
                      ))}
                    </dl>
                  </React.Fragment>
                ))}
              </div>
              <div className="f-actions">
                {folio ? (
                  <Link className="ds-btn ds-btn--primary" to={'/mis-solicitudes/' + folio.id}>
                    Ver en Mis solicitudes
                  </Link>
                ) : (
                  <button type="button" className="ds-btn ds-btn--ghost" onClick={corregir}>← Corregir algo</button>
                )}
                <Link className="ds-btn ds-btn--subtle" to="/formularios">Ver otros formularios</Link>
              </div>
            </div>
          ) : (
            <>
              {intentado && lista.length > 0 && (
                <div className="f-errs" role="alert" tabIndex={-1} ref={cajaErrores}>
                  <b>Revisa {lista.length === 1 ? '1 dato' : lista.length + ' datos'} antes de enviar</b>
                  <ul>
                    {lista.map((x) => (
                      <li key={x.ruta}>
                        <a href={'#' + idCampo(x.ruta)} onClick={irA(x.ruta)}>{x.msg}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <FormCtx.Provider value={ctx}>
                <form id={ID_FORM} noValidate onSubmit={enviar}>
                  {seccionesVisibles(f, estado).map(({ i, n, s }) => (
                    <section className="f-section" id={'sec-' + i} key={i} aria-labelledby={'sec-' + i + '-t'}>
                      <header>
                        <span className="f-num" aria-hidden="true">{n}</span>
                        <div>
                          <h2 id={'sec-' + i + '-t'}>{s.title}</h2>
                          {s.desc && <p>{s.desc}</p>}
                        </div>
                      </header>
                      <Campos campos={s.fields} base={rutaSeccion(i)} />
                    </section>
                  ))}
                  {errorEnvio && (
                    <p className="f-err" role="alert">
                      {errorEnvio}
                    </p>
                  )}
                  <div className="f-actions">
                    <button type="submit" className="ds-btn ds-btn--primary" disabled={enviando}>
                      {enviando ? 'Enviando…' : f.recibe ? 'Enviar solicitud' : 'Revisar y enviar'}
                    </button>
                    <button type="button" className="ds-btn ds-btn--ghost" onClick={limpiar}>Limpiar</button>
                    <span className="hint">
                      Los campos con <span className="f-req">*</span> son obligatorios
                      {f.recibe ? '.' : ' · Por ahora el envío es de prueba: no se manda nada.'}
                    </span>
                  </div>
                </form>
              </FormCtx.Provider>
            </>
          )}

          {f.cambios && f.cambios.length > 0 && (
            <details className="f-cambios">
              <summary>Qué cambia respecto al formulario del sitio actual</summary>
              <ul>{f.cambios.map((c) => <li key={c}>{c}</li>)}</ul>
              <p>Son cambios propuestos: los aprueban DITI o Recursos Humanos.</p>
            </details>
          )}
        </div>

        <aside className="f-aside" aria-label="Resumen de la solicitud">
          <div className="f-sum">
            <p className="f-sum__k">Form. {f.id} · {area.t}</p>
            <div className="f-prog">
              <div className="f-prog__bar" role="progressbar" aria-label="Datos obligatorios completos" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.ok}>
                <span style={{ width: pct + '%' }} />
              </div>
              <p><b>{prog.ok} de {prog.total}</b> datos obligatorios</p>
            </div>
            <ol className="f-steps">
              {prog.pasos.map((p) => (
                <li key={p.i} className={p.hecho ? 'is-done' : undefined}>
                  <a href={'#sec-' + p.i}>
                    <span className="dot" aria-hidden="true">{p.hecho ? '✓' : ''}</span>
                    {p.titulo}
                  </a>
                  {p.hecho && <span className="sr-only"> (completo)</span>}
                </li>
              ))}
            </ol>
            <dl className="f-meta">
              <div><dt>La recibe</dt><dd>{area.dest}</dd></div>
              {f.plazo && <div><dt>Tiempo de respuesta</dt><dd>{f.plazo}</dd></div>}
            </dl>
            {!enviado && (
              <button type="submit" form={ID_FORM} className="ds-btn ds-btn--primary f-sum__send" disabled={enviando}>
                {f.recibe ? 'Enviar solicitud' : 'Revisar y enviar'}
              </button>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
