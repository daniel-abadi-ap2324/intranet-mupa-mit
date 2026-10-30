/**
 * Recursos Humanos: tus datos de RRHH Express (marcaciones, tiempo compensatorio,
 * comprobantes y expediente) cuando conectas tu cuenta, y dos bloques: «Información»
 * (para leer) y «Cómo solicitar» (dónde se pide cada trámite: RRHH ya los maneja como
 * siempre), más el contacto. Lo que no existe se ve «Próximamente» y sin enlace (data/rrhh.ts).
 * La Clínica Municipal tiene su propia pestaña y no se muestra aquí.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { api } from '../api'
import { Compensatorio } from '../components/rrhh/Compensatorio'
import { Comprobantes } from '../components/rrhh/Comprobantes'
import { Cargando, useRrhh } from '../components/rrhh/comun'
import { Conectar } from '../components/rrhh/Conectar'
import { Expediente } from '../components/rrhh/Expediente'
import { Marcaciones } from '../components/rrhh/Marcaciones'
import { SinLlave } from '../components/SinLlave'
import { Aviso, CabeceraPagina, Enlace, Ic } from '../components/ui'
import { COMO_SOLICITAR_RRHH, DATOS_LABORALES, INFORMACION_RRHH, SE_SOLICITAN_EN_RRHH, SECCIONES_RRHH, type SeccionRrhh } from '../data/rrhh'
import { useDatos } from '../datos'
import { color } from '../lib/colores'
import { activa } from '../lib/edicion'
import { antiguedad, minutosAHoras, moneda, type ConexionRrhh } from '../lib/rrhh'
import { esExterna } from '../lib/url'

const Pronto = () => <span className="rh-pronto">Próximamente</span>

/** Los datos laborales sin RRHH Express en este servidor: vacíos y «Próximamente». */
function DatosSinRrhh() {
  return (
    <section className="rh-datos" aria-labelledby="h-rh-datos">
      <h2 id="h-rh-datos" className="rh-sub">
        Tus datos laborales
      </h2>
      <div className="rh-datos__grid">
        {DATOS_LABORALES.map((t) => (
          <div className="rh-dato" key={t}>
            <span className="k">{t}</span>
            <span className="v" aria-label="Sin datos todavía">
              —
            </span>
            <Pronto />
          </div>
        ))}
      </div>
      <SinLlave que="Ver tus datos de RRHH Express (RH Link)" />
    </section>
  )
}

const esSeccion = (v: string | null): v is SeccionRrhh => SECCIONES_RRHH.some((s) => s.v === v)

/** Con la cuenta de RRHH Express conectada: el resumen y las cuatro pestañas. */
function Conectado({ alDesconectar }: { alDesconectar: () => void }) {
  const [params, setParams] = useSearchParams()
  const pedida = params.get('seccion')
  const seccion: SeccionRrhh = esSeccion(pedida) ? pedida : 'marcaciones'
  const tabs = useRef<HTMLDivElement>(null)
  const exp = useRrhh(() => api.rrhhExpediente(), alDesconectar, [])
  const comp = useRrhh(() => api.rrhhCompensatorio(), alDesconectar, [])
  const pagos = useRrhh(() => api.rrhhComprobantes(1), alDesconectar, [])

  // Si se llegó con ?seccion= (desde «Solicitudes frecuentes»), las pestañas quedan a la vista.
  useEffect(() => {
    if (pedida) tabs.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [pedida])

  function ir(v: SeccionRrhh) {
    setParams((p) => (p.set('seccion', v), p), { replace: true })
  }
  function teclas(e: React.KeyboardEvent, i: number) {
    const n = SECCIONES_RRHH.length
    const destino = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
    if (destino < 0) return
    e.preventDefault()
    ir(SECCIONES_RRHH[destino].v)
    document.getElementById('rh-tab-' + SECCIONES_RRHH[destino].v)?.focus()
  }

  const l = exp.datos?.laboral
  const ultimo = pagos.datos?.items[0]
  const datos: [string, string | null | undefined][] = [
    ['Cargo', l?.cargo],
    ['Dirección', l?.direccion],
    ['Antigüedad', l?.inicio ? antiguedad(l.inicio) : null],
    ['Último pago neto', ultimo ? moneda(ultimo.neto) : null],
    ['Tiempo compensatorio', comp.datos ? minutosAHoras(comp.datos.totalDisponible) : null],
  ]

  return (
    <>
      <section className="rh-datos" aria-labelledby="h-rh-datos">
        <h2 id="h-rh-datos" className="rh-sub">
          Tus datos laborales
        </h2>
        <div className="rh-datos__grid">
          {datos.map(([k, v]) => (
            <div className="rh-dato" key={k}>
              <span className="k">{k}</span>
              <span className={'v' + (v && v.length > 14 ? ' v--largo' : '')}>{v ?? '…'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rh-express" aria-label="Tus datos de RRHH Express">
        <div className="rh-tabs" role="tablist" aria-label="Datos de RRHH Express" ref={tabs}>
          {SECCIONES_RRHH.map((s, i) => (
            <button
              key={s.v}
              type="button"
              role="tab"
              id={'rh-tab-' + s.v}
              aria-selected={s.v === seccion}
              aria-controls="rh-panel"
              tabIndex={s.v === seccion ? 0 : -1}
              className={'rh-tab' + (s.v === seccion ? ' is-activa' : '')}
              onClick={() => ir(s.v)}
              onKeyDown={(e) => teclas(e, i)}
            >
              {s.t}
            </button>
          ))}
        </div>
        <div id="rh-panel" role="tabpanel" aria-labelledby={'rh-tab-' + seccion} className="rh-panel">
          {seccion === 'marcaciones' && <Marcaciones alDesconectar={alDesconectar} />}
          {seccion === 'compensatorio' && <Compensatorio {...comp} alDesconectar={alDesconectar} />}
          {seccion === 'comprobantes' && <Comprobantes alDesconectar={alDesconectar} />}
          {seccion === 'expediente' && <Expediente {...exp} />}
        </div>
      </section>
    </>
  )
}

/** «a, b y c». */
function lista(xs: string[]): string {
  return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]
}

export function PaginaRecursosHumanos() {
  const { usuario } = useDatos()
  const [conexion, setConexion] = useState<ConexionRrhh | null>(null)
  const [vencida, setVencida] = useState(false)
  const [saliendo, setSaliendo] = useState(false)

  useEffect(() => {
    let vigente = true
    setConexion(null)
    api.rrhhConexion().then((c) => vigente && setConexion(c))
    return () => {
      vigente = false
    }
  }, [usuario?.id])

  const alDesconectar = useCallback(() => {
    setConexion((c) => c && { ...c, conectada: false, nombre: null, vence: null })
    setVencida(true)
  }, [])

  async function desconectar() {
    setSaliendo(true)
    await api.rrhhDesconectar().catch(() => undefined)
    setSaliendo(false)
    setVencida(false)
    setConexion((c) => c && { ...c, conectada: false, nombre: null, vence: null })
  }

  // RRHH Express en mantenimiento (RRHH_MANTENIMIENTO en la API): la pestaña entera lo dice, sin datos ni documentos.
  if (conexion?.mantenimiento) {
    return (
      <>
        <CabeceraPagina titulo="Recursos Humanos" />
        <div className="rh-mantenimiento">
          <Aviso tipo="warn">Esta sección está en mantenimiento. Volverá a estar disponible pronto.</Aviso>
          <p>
            Para cualquier trámite, comunícate con Recursos Humanos: <a href="tel:+5075069692">506-9692</a>, ext. 9171 o 9172.
          </p>
        </div>
      </>
    )
  }

  const disponible = !!conexion?.disponible
  // Conectada con su sesión de la intranet o como invitado (sin cuenta): las dos ven sus datos.
  const conectada = !!conexion?.conectada
  // Talonario y compensatorio abren su pestaña si hay RRHH Express; si no, solo dicen dónde se ven (o no salen).
  const tramites = COMO_SOLICITAR_RRHH.filter((s) => disponible || !s.soloConRrhh).map((s) => (s.seccion && disponible ? { ...s, h: '/recursos-humanos?seccion=' + s.seccion } : s))

  // Documentos para leer o bajar: «Información» y los formatos descargables (solo lo que lleva a algún lado).
  const documentos = [...INFORMACION_RRHH, ...COMO_SOLICITAR_RRHH.filter((s) => s.h && !s.seccion)].filter((s) => s.h)
  // Dentro de RRHH Express: Talonario y compensatorio abren su pestaña.
  const enExpress = tramites.filter((s) => s.seccion && s.h)

  return (
    <>
      <CabeceraPagina
        titulo="Recursos Humanos"
        acciones={
          conectada ? (
            <div className="rh-cuenta">
              <span>
                RRHH Express: <b>{conexion?.nombre ?? 'conectado'}</b>
                {conexion?.invitado && <span className="rh-cuenta__nota"> · Se cierra en unos minutos sin uso</span>}
              </span>
              <button type="button" className="ds-btn ds-btn--ghost" onClick={desconectar} disabled={saliendo}>
                {saliendo ? 'Desconectando…' : 'Desconectar'}
              </button>
            </div>
          ) : disponible ? (
            <span className="rh-pastilla"><span aria-hidden="true" />RRHH Express sin conectar</span>
          ) : undefined
        }
      />

      <div className="rh-grid">
        <div className="rh-main">
          {!conexion ? (
            <Cargando />
          ) : !disponible ? (
            activa('proximamente') ? <DatosSinRrhh /> : null
          ) : conectada ? (
            <Conectado alDesconectar={alDesconectar} />
          ) : (
            <Conectar
              vencida={vencida}
              cedulaConocida={conexion.cedulaConocida}
              conSesion={!!usuario}
              alConectar={(c) => {
                setVencida(false)
                setConexion(c)
              }}
            />
          )}

          {/* Sin RRHH Express conectado no se muestra: sin conexión no hay nada que pedir ahí. */}
          {conectada && (
            <details className="rh-como">
              <summary>Cómo solicitar</summary>
              {enExpress.length > 0 && <p>En RRHH Express: {lista(enExpress.map((s) => s.t.toLowerCase()))}.</p>}
              <p>
                En Recursos Humanos: {lista(SE_SOLICITAN_EN_RRHH.map((t) => t.toLowerCase()))}. Teléfono 506-9692, ext. 9171 o 9172.
              </p>
            </details>
          )}
        </div>

        <aside className="rh-lado" aria-label="Documentos y contacto">
          <section className="rh-docs" aria-labelledby="h-rh-docs">
            <h2 id="h-rh-docs">Documentos y formatos</h2>
            <ul>
              {documentos.map((s) => {
                const c = color(s.color)
                const archivo = !!s.h && /\.pdf$/i.test(s.h)
                return (
                  <li key={s.t}>
                    <Enlace h={s.h} className="rh-doc">
                      <Ic g={s.g} tint={c.tint} c={c.color} />
                      <span className="tx"><b>{s.t}</b><span>{s.meta}</span></span>
                      <span className="rh-doc__go" aria-hidden="true">{archivo ? '⤓' : esExterna(s.h!) ? '↗' : '›'}</span>
                    </Enlace>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="rh-contacto" aria-labelledby="h-rh-contacto">
            <h2 id="h-rh-contacto"><span aria-hidden="true">☏</span> Contacto RRHH</h2>
            <span><a href="tel:+5075069692">506-9692</a></span>
            <span className="rh-contacto__ext">Ext. <b>9171 / 9172</b></span>
          </section>
        </aside>
      </div>
    </>
  )
}
