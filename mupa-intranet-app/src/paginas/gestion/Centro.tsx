/**
 * Centro de Gestión (/gestion): una sola página para quienes gestionan. Arriba,
 * las cifras de cada área; en «Solicitudes» y «Recursos Humanos», la bandeja con
 * la solicitud abierta al lado para responder sin cambiar de página. Por ahora
 * todos los gestores ven todo (lib/gestion.ts). Las cifras salen de
 * GET /api/gestion/panel; las acciones, de las mismas rutas de siempre.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { api, type FormularioGestion } from '../../api'
import { ControlesSolicitud, useBandeja, useSolicitud } from '../../components/gestion/Atender'
import { IconoGestion, type NombreIcono } from '../../components/gestion/Iconos'
import { PanelesGestion, type CifraPanel } from '../../components/gestion/Paneles'
import { Avance, BarrasDiarias, Dona, FilaKpi, Kpi, Tarjeta } from '../../components/gestion/Piezas'
import { DetalleSolicitud, Estado } from '../../components/solicitudes/Detalle'
import { Aviso, CampoBusqueda, Chips, plural } from '../../components/ui'
import { useDatos } from '../../datos'
import { activa } from '../../lib/edicion'
import { AREAS_GESTION, duracion, GESTORES, veArea, type AreaGestion, type PanelGestion } from '../../lib/gestion'
import { GRUPOS_GESTION, type GrupoGestion } from '../../lib/menu'
import { tieneRol } from '../../lib/roles'
import { abierta, ESTADOS_SOLICITUD, estadoDe } from '../../lib/solicitudes'
import { useFiltroUrl } from '../../lib/useFiltroUrl'
import { fechaHora, mensaje, PaginaGestion } from './comun'

type Filtro = { area: string; id: string; estado: string; q: string; formulario: string }
type Cambiar = (c: Partial<Filtro>) => void

export function PaginaCentroGestion() {
  return (
    <PaginaGestion
      titulo="Panel de gestión"
      miga="Centro de Gestión"
      intro={activa('bandeja') ? 'Las cifras de todas las áreas y la bandeja para responder las solicitudes sin cambiar de página.' : 'Las cifras de las áreas que tienes a tu cargo.'}
      roles={GESTORES}
      quien="quienes gestionan Comunicación, Solicitudes, Recursos Humanos o la administración"
    >
      <Centro />
    </PaginaGestion>
  )
}

/** Carga las cifras; se actualizan solas cada 2 minutos y cuando llega o se atiende una solicitud. */
function usePanel(): { panel: PanelGestion | null; error: string; cargando: boolean; recargar: () => void } {
  const [panel, setPanel] = useState<PanelGestion | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const recargar = useCallback(() => {
    setCargando(true)
    api
      .panelGestion()
      .then((p) => {
        setPanel(p)
        setError('')
      })
      .catch((e) => setError(mensaje(e)))
      .finally(() => setCargando(false))
  }, [])
  useEffect(() => {
    recargar()
    const t = setInterval(recargar, 120_000)
    window.addEventListener('mupa:solicitudes', recargar)
    return () => {
      clearInterval(t)
      window.removeEventListener('mupa:solicitudes', recargar)
    }
  }, [recargar])
  return { panel, error, cargando, recargar }
}

function Centro() {
  const { usuario } = useDatos()
  const [f, cambiar] = useFiltroUrl<Filtro>({ area: 'resumen', id: '', estado: 'abiertas', q: '', formulario: '' })
  const { panel, error, cargando, recargar } = usePanel()
  const areas = AREAS_GESTION.filter((a) => veArea(usuario, a.v))
  const area = (areas.some((a) => a.v === f.area) ? f.area : 'resumen') as AreaGestion
  const ir = (a: AreaGestion, extra: Partial<Filtro> = {}) => cambiar({ area: a, id: '', ...extra })

  // En el teléfono las pestañas se desplazan: la elegida queda a la vista.
  const tabs = useRef<HTMLDivElement>(null)
  // Al llegar las cifras las pestañas cambian de ancho (los contadores); se vuelve a ubicar solo esa vez.
  const cargado = !!panel
  const [hayMas, setHayMas] = useState(false)
  const medirTabs = useCallback(() => {
    const t = tabs.current
    setHayMas(!!t && t.scrollLeft + t.clientWidth < t.scrollWidth - 4)
  }, [])
  useEffect(() => {
    const t = tabs.current
    const sel = t?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (t && sel) {
      // Solo se desplaza la fila de pestañas (no la página), con aire para el borde desvanecido.
      const a = t.getBoundingClientRect()
      const b = sel.getBoundingClientRect()
      if (b.right > a.right - 48) t.scrollLeft += b.right - a.right + 56
      else if (b.left < a.left) t.scrollLeft -= a.left - b.left + 8
    }
    medirTabs()
    window.addEventListener('resize', medirTabs)
    return () => window.removeEventListener('resize', medirTabs)
  }, [area, areas.length, medirTabs, cargado])

  const r = panel?.requests
  const abiertasRrhh = r?.byArea.filter((a) => a.rrhh).reduce((s, a) => s + a.open, 0) ?? 0
  const cuenta: Partial<Record<AreaGestion, number>> = { solicitudes: r?.open, rrhh: abiertasRrhh || undefined }

  return (
    <div className="cg">
      <div className="cg-barra">
        <div className="cg-tabs" role="tablist" aria-label="Áreas" ref={tabs} onScroll={medirTabs} data-mas={hayMas ? '' : undefined}>
          {areas.map((a) => (
            <button key={a.v} type="button" role="tab" id={'cg-tab-' + a.v} aria-selected={a.v === area} aria-controls="cg-area" className={'cg-tab' + (a.v === area ? ' is-activa' : '')} onClick={() => ir(a.v)}>
              {a.t}
              {!!cuenta[a.v] && <span className="cg-tab__n">{cuenta[a.v]}</span>}
            </button>
          ))}
        </div>
        <div className="cg-actualizar">
          {panel && <span>Actualizado a las {new Date(panel.generatedAt).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}</span>}
          <button type="button" className="ds-btn ds-btn--ghost" onClick={recargar} disabled={cargando} aria-label="Actualizar las cifras">
            <IconoGestion nombre="actualizar" className={cargando ? 'cg-gira' : undefined} />
            Actualizar
          </button>
        </div>
      </div>
      {error && <Aviso tipo="warn">{error}</Aviso>}

      <div id="cg-area" role="tabpanel" aria-labelledby={'cg-tab-' + area} className="cg-area">
        <PanelesGestion grupos={GRUPOS_DE[area]} excluir={['gestion-centro', 'gestion-solicitudes']} cifras={panel ? cifrasPaneles(panel) : undefined} />
        {!panel ? (
          !error && (
            <p className="count-note" role="status">
              Cargando cifras…
            </p>
          )
        ) : area === 'resumen' ? (
          <Resumen p={panel} ir={ir} />
        ) : area === 'solicitudes' ? (
          <Solicitudes p={panel} f={f} cambiar={cambiar} />
        ) : area === 'rrhh' ? (
          <Solicitudes p={panel} f={f} cambiar={cambiar} rrhh />
        ) : area === 'comunicacion' ? (
          <Comunicacion p={panel} />
        ) : (
          <Administracion p={panel} ir={ir} />
        )}
      </div>
    </div>
  )
}

/** Qué pantallas de gestión van en la barra de cada pestaña. */
const GRUPOS_DE: Record<AreaGestion, readonly GrupoGestion[]> = {
  resumen: GRUPOS_GESTION,
  solicitudes: ['Solicitudes'],
  rrhh: ['Solicitudes'],
  comunicacion: ['Contenido'],
  administracion: ['Administración'],
}

/** La cifra corta de cada pantalla en la barra de paneles (sale del mismo panel, sin pedir nada más). */
function cifrasPaneles(p: PanelGestion): Partial<Record<string, CifraPanel>> {
  const c = p.communication
  const a = p.administration
  const out: Partial<Record<string, CifraPanel>> = {}
  const an = c?.announcements
  if (an) out['gestion-anuncios'] = an.expiring.length ? { t: `${an.expiring.length} por vencer`, pendiente: true } : { t: `${an.vigente} ${an.vigente === 1 ? 'vigente' : 'vigentes'}` }
  if (c?.news) out['gestion-noticias'] = { t: String(c.news.published) }
  if (c) out['gestion-boletines'] = { t: String(c.bulletins.published) }
  if (c?.videos) out['gestion-videos'] = { t: String(c.videos.published) }
  if (a) {
    out['gestion-usuarios'] = a.users.withoutDepartment ? { t: `${a.users.withoutDepartment} sin depto.`, pendiente: true } : { t: a.users.total.toLocaleString('es-PA') }
    out['gestion-departamentos'] = { t: String(a.departments) }
    out['gestion-aplicaciones'] = a.applications.drafts ? { t: `${a.applications.drafts} en borrador` } : { t: String(a.applications.published) }
  }
  return out
}

// ---------- Resumen ----------

function Resumen({ p, ir }: { p: PanelGestion; ir: (a: AreaGestion, extra?: Partial<Filtro>) => void }) {
  const r = p.requests
  const c = p.communication
  const a = p.administration
  return (
    <>
      <FilaKpi etiqueta="Cifras principales">
        {r && (
          <>
            <Kpi tono="azul" icono="bandeja" valor={r.byStatus.recibida} etiqueta="Nuevas" detalle="sin atender" onClick={() => ir('solicitudes', { estado: 'recibida' })} />
            <Kpi tono="ambar" icono="revision" valor={r.byStatus.en_revision} etiqueta="En revisión" onClick={() => ir('solicitudes', { estado: 'en_revision' })} />
            <Kpi tono="rojo" icono="alerta" valor={r.overdue} etiqueta="Atrasadas" detalle={`más de ${p.overdueDays} días`} alerta={r.overdue > 0} onClick={() => ir('solicitudes', { estado: 'atrasadas' })} />
            <Kpi tono="morado" icono="reloj" valor={duracion(r.firstResponseHours)} etiqueta="Primera respuesta" detalle={`prom. ${p.periodDays} días`} />
            <Kpi tono="verde" icono="listo" valor={r.resolved} etiqueta="Resueltas" detalle={`en ${p.periodDays} días`} onClick={() => ir('solicitudes', { estado: 'resuelta' })} />
          </>
        )}
        {c?.announcements ? (
          <Kpi tono="cian" icono="megafono" valor={c.announcements.vigente} etiqueta="Anuncios vigentes" detalle={c.announcements.expiring.length ? `${c.announcements.expiring.length} vencen pronto` : undefined} onClick={() => ir('comunicacion')} />
        ) : (
          c && <Kpi tono="cian" icono="documento" valor={c.bulletins.published} etiqueta="Boletines" detalle={c.bulletins.latest ? 'último: ' + fecha(c.bulletins.latest) : undefined} onClick={() => ir('comunicacion')} />
        )}
        {/* Con solicitudes ya son 6 cifras: las de administración quedan en su pestaña. */}
        {a && !r && (
          <>
            <Kpi tono="gris" icono="personas" valor={a.users.active} etiqueta="Usuarios activos" detalle={`de ${a.users.total.toLocaleString('es-PA')} · ${p.periodDays} días`} onClick={() => ir('administracion')} />
            <Kpi tono="rojo" icono="sinDepartamento" valor={a.users.withoutDepartment} etiqueta="Sin departamento" alerta={a.users.withoutDepartment > 0} onClick={() => ir('administracion')} />
            <Kpi tono="verde" icono="apps" valor={a.applications.published} etiqueta="Aplicaciones" detalle={`${a.applications.drafts} en borrador`} onClick={() => ir('administracion')} />
          </>
        )}
      </FilaKpi>

      {/* Como el panel de referencia: lo grande a la izquierda y, a la derecha, lo pendiente y lo último que pasó. */}
      <div className="cg-grid cg-grid--2-1">
        <div className="cg-col">
          {r ? (
            <>
              <TablaFormularios r={r} />
              <div className="cg-grid cg-grid--2">
                <Tarjeta id="diario" titulo="Recibidas por día" icono="barras" extra={`${r.received} en ${p.periodDays} días`}>
                  <BarrasDiarias datos={r.daily} etiqueta="Solicitudes recibidas por día" />
                </Tarjeta>
                <Tarjeta id="estados" titulo="Por estado" icono="dona">
                  <DonaEstados r={r} />
                </Tarjeta>
              </div>
            </>
          ) : (
            a && <Adopcion p={p} />
          )}
        </div>
        <div className="cg-col">
          <Atencion p={p} ir={ir} />
          <Actividad p={p} ir={ir} max={r ? 8 : 12} />
        </div>
      </div>
    </>
  )
}

const TONO_ESTADO: Record<string, string> = {
  recibida: 'var(--color-primary-500)',
  en_revision: 'var(--color-warning-500)',
  resuelta: 'var(--color-success-700)',
  rechazada: 'var(--color-neutral-300)',
}

function DonaEstados({ r }: { r: NonNullable<PanelGestion['requests']> }) {
  return <Dona etiqueta="Solicitudes por estado" centro="solicitudes" partes={ESTADOS_SOLICITUD.map((e) => ({ k: e.v, t: e.t, n: r.byStatus[e.v], color: TONO_ESTADO[e.v] }))} />
}

function TablaFormularios({ r, soloRrhh }: { r: NonNullable<PanelGestion['requests']>; soloRrhh?: boolean }) {
  const filas = r.byForm.filter((x) => !soloRrhh || x.rrhh)
  const total = filas.reduce((s, x) => s + x.total, 0)
  const abiertas = filas.reduce((s, x) => s + x.open, 0)
  return (
    <Tarjeta id={'formularios' + (soloRrhh ? '-rrhh' : '')} titulo="Solicitudes por formulario" icono="capas" extra={plural(filas.length, 'formulario', 'formularios')}>
      {!filas.length ? (
        <p className="cg-vacio">Todavía no llegó ninguna solicitud{soloRrhh ? ' de Recursos Humanos' : ''}.</p>
      ) : (
        <div className="cg-tabla-wrap">
          <table className="cg-tabla">
            <thead>
              <tr>
                <th scope="col" className="cg-num-col">
                  #
                </th>
                <th scope="col">Formulario</th>
                {!soloRrhh && (
                  <th scope="col" className="cg-col-area">
                    Área
                  </th>
                )}
                <th scope="col" className="cg-n">
                  Total
                </th>
                <th scope="col" className="cg-n">
                  Abiertas
                </th>
                <th scope="col" className="cg-n">
                  Cerradas
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((x, i) => (
                <tr key={x.area + x.form}>
                  <td className="cg-num-col">{i + 1}</td>
                  <td>
                    {x.form}
                    {!soloRrhh && <span className="cg-tabla__sub">{x.area}</span>}
                  </td>
                  {!soloRrhh && <td className="cg-sec cg-col-area">{x.area}</td>}
                  <td className="cg-n cg-n--azul">{x.total}</td>
                  <td className={'cg-n' + (x.open ? ' cg-n--ambar' : '')}>{x.open}</td>
                  <td className="cg-n cg-n--verde">{x.total - x.open}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="cg-num-col">Σ</td>
                <td>Total</td>
                {!soloRrhh && <td className="cg-col-area" />}
                <td className="cg-n">{total}</td>
                <td className="cg-n">{abiertas}</td>
                <td className="cg-n">{total - abiertas}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Tarjeta>
  )
}

const ICONO_TIPO: Record<PanelGestion['activity'][number]['kind'], NombreIcono> = { solicitud: 'bandeja', anuncio: 'megafono', noticia: 'noticia', boletin: 'documento', video: 'video' }
// Con su concordancia: «Noticia editada», «Boletín editado».
const EDITADO = { anuncio: 'Anuncio editado', noticia: 'Noticia editada', boletin: 'Boletín editado', video: 'Video editado' } as const

function Actividad({ p, ir, soloContenido, max = 12 }: { p: PanelGestion; ir: (a: AreaGestion, extra?: Partial<Filtro>) => void; soloContenido?: boolean; max?: number }) {
  const items = p.activity.filter((x) => !soloContenido || x.kind !== 'solicitud').slice(0, max)
  return (
    <Tarjeta id={'actividad' + (soloContenido ? '-c' : '')} titulo="Últimos movimientos" icono="actividad" cls="cg-card--lista">
      {!items.length ? (
        <p className="cg-vacio">Sin movimientos en los últimos {p.periodDays} días.</p>
      ) : (
        <ul className="cg-feed">
          {items.map((x, i) => {
            const que =
              x.kind !== 'solicitud'
                ? EDITADO[x.kind]
                : x.action === 'creada'
                  ? 'Nueva solicitud'
                  : x.action === 'estado'
                    ? 'Cambió a «' + estadoDe(x.status || '').t + '»'
                    : 'Respuesta enviada'
            const cuerpo = (
              <>
                <span className={'cg-feed__ic cg-feed__ic--' + x.kind}>
                  <IconoGestion nombre={x.action === 'mensaje' ? 'mensaje' : ICONO_TIPO[x.kind]} />
                </span>
                <span className="cg-feed__tx">
                  <b>{x.title}</b>
                  <span>
                    {que}
                    {x.who ? ' · ' + x.who : ''}
                  </span>
                </span>
                <time dateTime={x.at} title={fechaHora(x.at)}>
                  {hace(x.at)}
                </time>
              </>
            )
            return (
              <li key={x.kind + x.at + i}>
                {x.requestId ? (
                  <button type="button" className="cg-feed__item" onClick={() => ir('solicitudes', { id: String(x.requestId), estado: 'todas' })}>
                    {cuerpo}
                  </button>
                ) : (
                  <div className="cg-feed__item">{cuerpo}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Tarjeta>
  )
}

/** Lo que hay que atender primero: atrasadas, anuncios por vencer y personas sin departamento. */
function Atencion({ p, ir, soloAdministracion }: { p: PanelGestion; ir: (a: AreaGestion, extra?: Partial<Filtro>) => void; soloAdministracion?: boolean }) {
  const r = soloAdministracion ? undefined : p.requests
  const vencen = soloAdministracion ? [] : (p.communication?.announcements?.expiring ?? [])
  const a = p.administration
  const nada = !r?.overdueList.length && !vencen.length && !a?.users.withoutDepartment && !a?.users.unverifiedEmail
  return (
    <Tarjeta id={'atencion' + (soloAdministracion ? '-adm' : '')} titulo="Requiere atención" icono="alerta" cls="cg-card--lista">
      {nada ? (
        <p className="cg-vacio cg-vacio--ok">
          <IconoGestion nombre="listo" /> Todo al día.
        </p>
      ) : (
        <ul className="cg-feed">
          {r?.overdueList.map((s) => (
            <li key={'s' + s.id}>
              <button type="button" className="cg-feed__item" onClick={() => ir('solicitudes', { id: String(s.id), estado: 'abiertas' })}>
                <span className="cg-feed__ic cg-feed__ic--alerta">
                  <IconoGestion nombre="alerta" />
                </span>
                <span className="cg-feed__tx">
                  <b>
                    {s.folio} · {s.formTitle}
                  </b>
                  <span>
                    {s.ownerName} · {estadoDe(s.status).t}
                  </span>
                </span>
                <time dateTime={s.createdAt} title={fechaHora(s.createdAt)}>
                  {hace(s.createdAt)}
                </time>
              </button>
            </li>
          ))}
          {vencen.map((x) => (
            <li key={'a' + x.id}>
              <Link className="cg-feed__item" to="/gestion/anuncios">
                <span className="cg-feed__ic cg-feed__ic--aviso">
                  <IconoGestion nombre="calendario" />
                </span>
                <span className="cg-feed__tx">
                  <b>{x.title}</b>
                  <span>Anuncio que deja de verse</span>
                </span>
                <time dateTime={x.publishUntil}>{fecha(x.publishUntil)}</time>
              </Link>
            </li>
          ))}
          {!!a?.users.withoutDepartment && (
            <li>
              <Link className="cg-feed__item" to="/gestion/usuarios">
                <span className="cg-feed__ic cg-feed__ic--aviso">
                  <IconoGestion nombre="sinDepartamento" />
                </span>
                <span className="cg-feed__tx">
                  <b>{plural(a.users.withoutDepartment, 'persona sin departamento', 'personas sin departamento')}</b>
                  <span>No ven las aplicaciones de su área</span>
                </span>
              </Link>
            </li>
          )}
          {!!a?.users.unverifiedEmail && (
            <li>
              <div className="cg-feed__item">
                <span className="cg-feed__ic cg-feed__ic--aviso">
                  <IconoGestion nombre="correo" />
                </span>
                <span className="cg-feed__tx">
                  <b>{plural(a.users.unverifiedEmail, 'correo sin confirmar', 'correos sin confirmar')}</b>
                  <span>Cada persona lo confirma en Configuración</span>
                </span>
              </div>
            </li>
          )}
        </ul>
      )}
      {r && r.overdueList.length < r.overdue && (
        <button type="button" className="cg-mas" onClick={() => ir('solicitudes', { estado: 'atrasadas' })}>
          Ver las {r.overdue} atrasadas →
        </button>
      )}
    </Tarjeta>
  )
}

// ---------- Solicitudes (y RRHH) ----------

function Solicitudes({ p, f, cambiar, rrhh }: { p: PanelGestion; f: Filtro; cambiar: Cambiar; rrhh?: boolean }) {
  const r = p.requests
  if (!r) return null
  const areas = r.byArea.filter((a) => !rrhh || a.rrhh)
  const total = areas.reduce((s, a) => s + a.total, 0)
  const abiertas = areas.reduce((s, a) => s + a.open, 0)
  return (
    <>
      <FilaKpi etiqueta={rrhh ? 'Cifras de Recursos Humanos' : 'Cifras de solicitudes'}>
        {rrhh ? (
          <>
            <Kpi tono="azul" icono="bandeja" valor={total} etiqueta="Recibidas" detalle="en total" onClick={() => cambiar({ estado: 'todas', id: '' })} />
            <Kpi tono="ambar" icono="revision" valor={abiertas} etiqueta="Abiertas" onClick={() => cambiar({ estado: 'abiertas', id: '' })} />
            <Kpi tono="verde" icono="listo" valor={total - abiertas} etiqueta="Cerradas" onClick={() => cambiar({ estado: 'resuelta', id: '' })} />
          </>
        ) : (
          <>
            <Kpi tono="azul" icono="bandeja" valor={r.byStatus.recibida} etiqueta="Nuevas" onClick={() => cambiar({ estado: 'recibida', id: '' })} />
            <Kpi tono="ambar" icono="revision" valor={r.byStatus.en_revision} etiqueta="En revisión" onClick={() => cambiar({ estado: 'en_revision', id: '' })} />
            <Kpi tono="rojo" icono="alerta" valor={r.overdue} etiqueta="Atrasadas" detalle={`más de ${p.overdueDays} días`} alerta={r.overdue > 0} onClick={() => cambiar({ estado: 'atrasadas', id: '' })} />
            <Kpi tono="morado" icono="reloj" valor={duracion(r.firstResponseHours)} etiqueta="Primera respuesta" detalle="promedio" />
            <Kpi tono="verde" icono="listo" valor={r.resolved} etiqueta="Resueltas" detalle={`últimos ${p.periodDays} días`} onClick={() => cambiar({ estado: 'resuelta', id: '' })} />
          </>
        )}
      </FilaKpi>
      <BandejaRapida f={f} cambiar={cambiar} rrhh={rrhh} diasAtraso={p.overdueDays} />
      {rrhh && (
        <div className="cg-grid cg-grid--2-1">
          <TablaFormularios r={r} soloRrhh />
          <Tarjeta id="rrhh-roles" titulo="Quién atiende" icono="personas">
            <p className="cg-nota">Por ahora todos los gestores ven y responden las solicitudes de Recursos Humanos. Cuando exista el rol de Gestor de RRHH, esta pestaña será solo suya.</p>
          </Tarjeta>
        </div>
      )}
    </>
  )
}

const ESTADOS_BANDEJA = [{ v: 'abiertas', t: 'Abiertas' }, { v: 'atrasadas', t: 'Atrasadas' }, ...ESTADOS_SOLICITUD.map((e) => ({ v: e.v as string, t: e.t })), { v: 'todas', t: 'Todas' }]
const ancho = () => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1100px)').matches

/** La lista a la izquierda y la solicitud elegida a la derecha. Atajos: j / k para moverse, r para responder. */
function BandejaRapida({ f, cambiar, rrhh, diasAtraso }: { f: Filtro; cambiar: Cambiar; rrhh?: boolean; diasAtraso: number }) {
  const { lista, error } = useBandeja({ estado: f.estado, formulario: f.formulario, q: f.q, area: rrhh ? 'rrhh' : undefined })
  const [formularios, setFormularios] = useState<FormularioGestion[]>([])
  const id = Number(f.id) || null
  const { s, setS, error: errorDetalle } = useSolicitud(id)
  const { usuario } = useDatos()

  // Crear formularios sigue siendo de admin y del Gestor: los demás no reciben la lista (y no se muestra el filtro).
  const veFormularios = tieneRol(usuario, 'admin', 'gestorSolicitudes')
  useEffect(() => {
    if (!veFormularios) return
    api
      .formulariosGestion()
      .then((L) => setFormularios(L.filter((x) => x.requests > 0 && (!rrhh || /^(recursos humanos|rrhh)$/i.test(x.area)))))
      .catch(() => setFormularios([]))
  }, [veFormularios, rrhh])

  // En pantalla ancha se abre la primera, para empezar a responder de una vez.
  useEffect(() => {
    if (!id && lista?.length && ancho()) cambiar({ id: String(lista[0].id) })
  }, [id, lista, cambiar])

  // Atajos de teclado (fuera de los campos de texto).
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || !lista?.length) return
      const i = lista.findIndex((x) => x.id === id)
      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault()
        const j = e.key === 'j' ? Math.min(lista.length - 1, i + 1) : Math.max(0, i - 1)
        cambiar({ id: String(lista[j].id) })
        document.getElementById('cg-sol-' + lista[j].id)?.scrollIntoView({ block: 'nearest' })
      } else if (e.key === 'r' && id) {
        e.preventDefault()
        document.getElementById('sol-texto')?.focus()
      }
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [lista, id, cambiar])

  const limite = Date.now() - diasAtraso * 86_400_000
  return (
    <div className={'cg-bandeja' + (id ? ' con-detalle' : '')}>
      <section className="cg-bandeja__lista" aria-label={rrhh ? 'Bandeja de Recursos Humanos' : 'Bandeja de solicitudes'}>
        <div className="cg-bandeja__filtros">
          <Chips etiqueta="Qué solicitudes mostrar" opciones={ESTADOS_BANDEJA} valor={f.estado} onCambio={(estado) => cambiar({ estado, id: '' })} />
          <div className="cg-bandeja__busca">
            <CampoBusqueda valor={f.q} onCambio={(q) => cambiar({ q, id: '' })} etiqueta="Buscar solicitud" placeholder="Folio, persona o formulario…" />
            {formularios.length > 0 && (
              <select className="ds-input" aria-label="Formulario" value={f.formulario} onChange={(e) => cambiar({ formulario: e.target.value, id: '' })}>
                <option value="">Todos los formularios</option>
                {formularios.map((x) => (
                  <option key={x.slug} value={x.slug}>
                    {x.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          {lista && (
            <p className="cg-bandeja__n" role="status">
              {plural(lista.length, 'solicitud', 'solicitudes')}
              <span className="cg-atajos" aria-hidden="true">
                <kbd>j</kbd> <kbd>k</kbd> moverse · <kbd>r</kbd> responder
              </span>
            </p>
          )}
        </div>
        {error && <Aviso tipo="warn">{error}</Aviso>}
        {lista === null ? (
          <p className="count-note" role="status">
            Cargando…
          </p>
        ) : !lista.length ? (
          <p className="cg-vacio">No hay solicitudes con esos filtros.</p>
        ) : (
          <ul className="cg-sols">
            {lista.map((x) => {
              const atrasada = abierta(x.estado) && Date.parse(x.actualizada) < limite
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    id={'cg-sol-' + x.id}
                    className={'cg-sol' + (x.id === id ? ' is-activa' : '') + (x.estado === 'recibida' ? ' is-nueva' : '')}
                    aria-current={x.id === id ? 'true' : undefined}
                    onClick={() => cambiar({ id: String(x.id) })}
                  >
                    <span className="cg-sol__fila">
                      <span className="cg-sol__folio">{x.folio}</span>
                      <time dateTime={x.creada} title={fechaHora(x.creada)}>
                        {hace(x.creada)}
                      </time>
                    </span>
                    <b>{x.formulario}</b>
                    <span className="cg-sol__persona">{[x.persona, x.departamento].filter(Boolean).join(' · ')}</span>
                    <span className="cg-sol__fila">
                      <Estado v={x.estado} />
                      {atrasada && <span className="cg-atrasada">Atrasada</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="cg-bandeja__detalle" aria-label="Solicitud abierta">
        {!id ? (
          <div className="cg-vacio cg-vacio--grande">
            <IconoGestion nombre="bandeja" />
            <p>Elige una solicitud de la lista para ver lo que se pidió y responder.</p>
          </div>
        ) : errorDetalle ? (
          <Aviso tipo="warn">{errorDetalle}</Aviso>
        ) : !s ? (
          <p className="count-note" role="status">
            Cargando…
          </p>
        ) : (
          <>
            <button type="button" className="ds-btn ds-btn--ghost cg-volver" onClick={() => cambiar({ id: '' })}>
              ← Volver a la lista
            </button>
            <DetalleSolicitud s={s} controles={<ControlesSolicitud s={s} onCambio={setS} />} />
          </>
        )}
      </section>
    </div>
  )
}

// ---------- Comunicación ----------

function Comunicacion({ p }: { p: PanelGestion }) {
  const c = p.communication
  if (!c) return null
  const an = c.announcements
  return (
    <>
      <FilaKpi etiqueta="Cifras de Comunicación">
        {an && (
          <>
            <Kpi tono="cian" icono="megafono" valor={an.vigente} etiqueta="Anuncios vigentes" to="/gestion/anuncios" />
            <Kpi tono="rojo" icono="calendario" valor={an.expiring.length} etiqueta="Vencen pronto" detalle="en 7 días" alerta={an.expiring.length > 0} to="/gestion/anuncios" />
            <Kpi tono="azul" icono="reloj" valor={an.programado} etiqueta="Programados" to="/gestion/anuncios" />
            <Kpi tono="gris" icono="documento" valor={an.borrador} etiqueta="Borradores" to="/gestion/anuncios" />
          </>
        )}
        {c.news && <Kpi tono="morado" icono="noticia" valor={c.news.published} etiqueta="Noticias" detalle={`${c.news.recent} en ${p.periodDays} días · ${c.news.drafts} en borrador`} to="/gestion/noticias" />}
        <Kpi tono="verde" icono="documento" valor={c.bulletins.published} etiqueta="Boletines" detalle={c.bulletins.latest ? 'último: ' + fecha(c.bulletins.latest) : undefined} to="/gestion/boletines" />
        {c.videos && <Kpi tono="ambar" icono="video" valor={c.videos.published} etiqueta="Videos" detalle={`${c.videos.total - c.videos.published} ocultos`} to="/gestion/videos" />}
      </FilaKpi>
      <div className={'cg-grid' + (an ? ' cg-grid--2' : '')}>
        {an && (
          <Tarjeta id="anuncios-estado" titulo="Anuncios por estado" icono="dona">
            <Dona
              etiqueta="Anuncios por estado"
              centro="anuncios"
              partes={[
                { k: 'vigente', t: 'Vigentes', n: an.vigente, color: 'var(--color-success-700)' },
                { k: 'programado', t: 'Programados', n: an.programado, color: 'var(--color-primary-500)' },
                { k: 'borrador', t: 'Borradores', n: an.borrador, color: 'var(--color-warning-500)' },
                { k: 'vencido', t: 'Vencidos', n: an.vencido, color: 'var(--color-neutral-300)' },
                { k: 'retirado', t: 'Retirados', n: an.retirado, color: 'var(--color-neutral-500)' },
              ]}
            />
          </Tarjeta>
        )}
        <Actividad p={p} ir={() => undefined} soloContenido />
      </div>
    </>
  )
}

// ---------- Administración ----------

function Administracion({ p, ir }: { p: PanelGestion; ir: (a: AreaGestion, extra?: Partial<Filtro>) => void }) {
  const a = p.administration
  if (!a) return null
  return (
    <>
      <FilaKpi etiqueta="Cifras de administración">
        <Kpi tono="azul" icono="personas" valor={a.users.total} etiqueta="Usuarios" to="/gestion/usuarios" />
        <Kpi tono="verde" icono="actividad" valor={a.users.active} etiqueta="Activos" detalle={`entraron en ${p.periodDays} días`} />
        <Kpi tono="cian" icono="personaNueva" valor={a.users.created} etiqueta="Cuentas nuevas" detalle={`últimos ${p.periodDays} días`} />
        <Kpi tono="rojo" icono="sinDepartamento" valor={a.users.withoutDepartment} etiqueta="Sin departamento" alerta={a.users.withoutDepartment > 0} to="/gestion/usuarios" />
        <Kpi tono="ambar" icono="correo" valor={a.users.unverifiedEmail} etiqueta="Correo sin confirmar" />
        <Kpi tono="morado" icono="apps" valor={a.applications.published} etiqueta="Aplicaciones" detalle={`${a.applications.drafts} en borrador`} to="/gestion/aplicaciones" />
        <Kpi tono="gris" icono="edificio" valor={a.departments} etiqueta="Departamentos" to="/gestion/departamentos" />
      </FilaKpi>
      <div className="cg-grid cg-grid--2-1">
        <Adopcion p={p} />
        <Atencion p={p} ir={ir} soloAdministracion />
      </div>
    </>
  )
}

function Adopcion({ p }: { p: PanelGestion }) {
  const a = p.administration
  if (!a) return null
  const u = a.users
  return (
    <Tarjeta id="adopcion" titulo="Uso de la intranet" icono="barras">
      <div className="cg-avances">
        <Avance t={`Entraron en los últimos ${p.periodDays} días`} n={u.active} de={u.total} tono="verde" />
        <Avance t="Tienen departamento asignado" n={u.total - u.withoutDepartment} de={u.total} tono="azul" detalle={u.withoutDepartment ? plural(u.withoutDepartment, 'persona espera', 'personas esperan') + ' su departamento' : undefined} />
        <Avance t="Aplicaciones publicadas del catálogo" n={a.applications.published} de={a.applications.published + a.applications.drafts} tono="morado" />
      </div>
    </Tarjeta>
  )
}

// ---------- Fechas ----------

/** "hace 5 min", "hace 3 h", "ayer", o la fecha. */
function hace(iso: string): string {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  if (min < 24 * 60) return `hace ${Math.round(min / 60)} h`
  if (min < 48 * 60) return 'ayer'
  return fecha(iso)
}

/** "28 sep" (o "28 sep 2025" si no es de este año). Acepta "AAAA-MM-DD". */
function fecha(v: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T12:00:00-05:00') : new Date(v)
  const esteAno = d.getFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', day: 'numeric', month: 'short', ...(esteAno ? {} : { year: 'numeric' }) }).format(d)
}
