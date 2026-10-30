/**
 * Panel de Comunicación (/gestion/anuncios): publicar, editar, retirar y
 * eliminar los anuncios del Inicio. Lo usan admin y comunicacion. La pantalla
 * solo decide qué mostrar; quien permite o niega es el backend (/api/announcements).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { api, ErrorApi } from '../../api'
import { PanelesGestion } from '../../components/gestion/Paneles'
import { FilaAnuncio } from '../../components/inicio/bloques'
import { useSitio } from '../../components/Proveedores'
import { Aviso, CabeceraPagina, Chips, Dialogo, EnlaceEntrar } from '../../components/ui'
import { useDatos } from '../../datos'
import {
  CAMPO_DEL_BACKEND,
  ESTADOS,
  MAX_DETALLE,
  MAX_TITULO,
  NIVEL_TEXTO,
  NIVELES,
  revisarAnuncio,
  textoFechas,
  type AnuncioGestion,
  type DatosAnuncio,
  type ErroresAnuncio,
  type EstadoAnuncio,
  type Nivel,
  type Publicacion,
} from '../../lib/anuncios'
import { fechaCorta, hoyIso } from '../../lib/fechas'
import { tieneRol } from '../../lib/roles'
import { revisarUrl } from '../../lib/url'
import { useFiltroUrl } from '../../lib/useFiltroUrl'

const mensaje = (e: unknown) => (e instanceof ErrorApi ? e.message : 'No se pudo conectar con el servidor. Inténtalo de nuevo.')

/** Qué pasó al guardar, según el estado que devuelve el backend (un "publicado" puede quedar vencido por sus fechas). */
function resultado(a: AnuncioGestion): string {
  if (a.publicacion === 'borrador') return 'Guardado como borrador'
  if (a.publicacion === 'retirado') return 'Guardado; sigue retirado del Inicio'
  if (a.estado === 'vigente') return 'Publicado: ya se ve en el Inicio'
  if (a.estado === 'programado') return 'Programado: se verá desde el ' + fechaCorta(a.desde)
  return 'Guardado, pero su fecha final ya pasó: no se ve en el Inicio'
}

export function PaginaGestionAnuncios() {
  const { usuario } = useDatos()
  const cabecera = (
    <CabeceraPagina
      titulo="Anuncios del Inicio"
      miga="Anuncios"
      padres={[{ t: 'Centro de Gestión', h: '/gestion' }]}
      intro="Lo que se publica aquí aparece en el bloque «Anuncios institucionales» del Inicio de todo el personal, en las fechas que elijas."
    />
  )
  if (!usuario) {
    return (
      <>
        {cabecera}
        <Aviso>
          Inicia sesión para gestionar los anuncios. <EnlaceEntrar />
        </Aviso>
      </>
    )
  }
  if (!tieneRol(usuario, 'admin', 'comunicacion')) {
    return (
      <>
        {cabecera}
        <Aviso tipo="warn">No tienes permiso para gestionar anuncios. Esta sección es para el equipo de Comunicación.</Aviso>
      </>
    )
  }
  return (
    <>
      {cabecera}
      <PanelesGestion grupos={['Contenido']} actual="gestion-anuncios" volver />
      <Gestion />
    </>
  )
}

type Filtro = 'todos' | EstadoAnuncio

function Gestion() {
  const { avisar } = useSitio()
  const [lista, setLista] = useState<AnuncioGestion[] | null>(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [filtro, cambiar] = useFiltroUrl({ estado: 'todos' })
  // undefined = cerrado; null = uno nuevo.
  const [editando, setEditando] = useState<AnuncioGestion | null | undefined>(undefined)
  const [borrando, setBorrando] = useState<AnuncioGestion | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setLista(await api.anunciosGestion())
      setErrorCarga('')
    } catch (e) {
      setErrorCarga(mensaje(e))
      setLista((l) => l ?? [])
    }
  }, [])
  useEffect(() => {
    cargar()
  }, [cargar])

  const cuantos = useMemo(() => {
    const n: Record<string, number> = { todos: lista?.length ?? 0 }
    for (const a of lista ?? []) n[a.estado] = (n[a.estado] || 0) + 1
    return n
  }, [lista])
  const estado = (ESTADOS.some((e) => e.v === filtro.estado) ? filtro.estado : 'todos') as Filtro
  const visibles = (lista ?? []).filter((a) => estado === 'todos' || a.estado === estado)

  const publicar = async (a: AnuncioGestion, publicacion: Publicacion) => {
    setOcupado(true)
    try {
      const nuevo = await api.editarAnuncio(a.id, { publicacion })
      await cargar()
      const antes = a.publicacion
      avisar(publicacion === 'retirado' ? 'Anuncio retirado del Inicio' : resultado(nuevo), { t: 'Deshacer', fn: () => publicar({ ...a, publicacion }, antes) })
    } catch (e) {
      avisar(mensaje(e))
    } finally {
      setOcupado(false)
    }
  }

  const eliminar = async (a: AnuncioGestion) => {
    setOcupado(true)
    try {
      await api.borrarAnuncio(a.id)
      setBorrando(null)
      await cargar()
      document.querySelector<HTMLElement>('.gest-nuevo')?.focus()
      avisar('Anuncio eliminado')
    } catch (e) {
      avisar(mensaje(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <div className="toolbar">
        <Chips<Filtro>
          etiqueta="Filtrar por estado"
          opciones={[{ v: 'todos', t: 'Todos', n: cuantos.todos }, ...ESTADOS.map((e) => ({ v: e.v, t: e.t, n: cuantos[e.v] || 0 }))]}
          valor={estado}
          onCambio={(v) => cambiar({ estado: v })}
        />
        <button type="button" className="ds-btn ds-btn--primary gest-nuevo" onClick={() => setEditando(null)}>
          <span aria-hidden="true">＋</span> Nuevo anuncio
        </button>
      </div>

      {errorCarga && <Aviso tipo="warn">{errorCarga}</Aviso>}

      {lista === null ? (
        <p className="count-note" role="status">Cargando anuncios…</p>
      ) : !lista.length ? (
        <div className="empty-state">
          <b>Todavía no hay anuncios</b>
          <p>Crea el primero con «Nuevo anuncio». Puedes guardarlo como borrador y publicarlo después.</p>
        </div>
      ) : !visibles.length ? (
        <p className="empty show">No hay anuncios en «{ESTADOS.find((e) => e.v === estado)?.t}».</p>
      ) : (
        <div className="table-wrap">
          <table className="ds-table gest-tabla">
            <thead>
              <tr>
                <th scope="col">Anuncio</th>
                <th scope="col">Nivel</th>
                <th scope="col">Fechas</th>
                <th scope="col">Estado</th>
                <th scope="col">Última edición</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => {
                const e = ESTADOS.find((x) => x.v === a.estado)
                return (
                  <tr key={a.id}>
                    <td>
                      <b>{a.titulo}</b>
                      {a.detalle && <span className="gest-det">{a.detalle}</span>}
                    </td>
                    <td data-t="Nivel">
                      <span className={'ann-nivel ann-nivel--' + a.nivel}>{NIVEL_TEXTO[a.nivel]}</span>
                    </td>
                    <td data-t="Fechas">{textoFechas(a.desde, a.hasta)}</td>
                    <td data-t="Estado">
                      <span className={'tagline' + (e?.tono ? ' tagline--' + e.tono : '')}>{e?.t ?? a.estado}</span>
                    </td>
                    <td data-t="Editado">
                      {fechaCorta(hoyIso(new Date(a.editado)))}
                      {a.editadoPor && <span className="gest-det">{a.editadoPor}</span>}
                    </td>
                    <td className="gest-acts">
                      <div className="gest-acciones">
                        <button type="button" className="ds-btn ds-btn--ghost" disabled={ocupado} onClick={() => setEditando(a)} aria-label={'Editar «' + a.titulo + '»'}>
                          Editar
                        </button>
                        {(a.estado === 'vigente' || a.estado === 'programado') && (
                          <button type="button" className="ds-btn ds-btn--ghost" disabled={ocupado} onClick={() => publicar(a, 'retirado')} aria-label={'Retirar «' + a.titulo + '»'}>
                            Retirar
                          </button>
                        )}
                        {(a.estado === 'borrador' || a.estado === 'retirado') && (
                          <button type="button" className="ds-btn ds-btn--ghost" disabled={ocupado} onClick={() => publicar(a, 'publicado')} aria-label={'Publicar «' + a.titulo + '»'}>
                            {a.estado === 'retirado' ? 'Volver a publicar' : 'Publicar'}
                          </button>
                        )}
                        <button type="button" className="ds-btn ds-btn--ghost gest-borrar" disabled={ocupado} onClick={() => setBorrando(a)} aria-label={'Eliminar «' + a.titulo + '»'}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editando !== undefined && (
        <Editor
          anuncio={editando}
          onCerrar={() => setEditando(undefined)}
          onGuardado={async (a) => {
            setEditando(undefined)
            await cargar()
            avisar(resultado(a))
          }}
        />
      )}

      {borrando && (
        <Dialogo
          id="annBorrar"
          titulo="Eliminar anuncio"
          onCerrar={() => setBorrando(null)}
          pie={
            <div className="home-dlg__foot">
              <button type="button" className="ds-btn ds-btn--ghost" data-foco onClick={() => setBorrando(null)}>
                Cancelar
              </button>
              <button type="button" className="ds-btn ds-btn--primary gest-borrar--si" disabled={ocupado} onClick={() => eliminar(borrando)}>
                Eliminar
              </button>
            </div>
          }
        >
          <div className="home-dlg__body">
            <p className="ds-body">
              Se borra «{borrando.titulo}» y no se puede recuperar. Si solo quieres sacarlo del Inicio, usa <b>Retirar</b>: se puede volver a publicar.
            </p>
          </div>
        </Dialogo>
      )}
    </>
  )
}

type Borrador = { titulo: string; detalle: string; nivel: Nivel; enlace: string; desde: string; hasta: string }

function Editor({ anuncio, onCerrar, onGuardado }: { anuncio: AnuncioGestion | null; onCerrar: () => void; onGuardado: (a: AnuncioGestion) => void }) {
  const [d, setD] = useState<Borrador>(() =>
    anuncio
      ? { titulo: anuncio.titulo, detalle: anuncio.detalle ?? '', nivel: anuncio.nivel, enlace: anuncio.enlace ?? '', desde: anuncio.desde, hasta: anuncio.hasta ?? '' }
      : { titulo: '', detalle: '', nivel: 'normal', enlace: '', desde: hoyIso(), hasta: '' },
  )
  const [errores, setErrores] = useState<ErroresAnuncio>({})
  const [general, setGeneral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const form = useRef<HTMLFormElement>(null)

  const poner = <K extends keyof Borrador>(k: K, v: Borrador[K]) => {
    setD((x) => ({ ...x, [k]: v }))
    setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const guardar = async (publicacion: Publicacion) => {
    const datos: DatosAnuncio = {
      titulo: d.titulo.trim(),
      detalle: d.detalle.trim() || null,
      nivel: d.nivel,
      enlace: d.enlace.trim() || null,
      desde: d.desde,
      hasta: d.hasta || null,
      publicacion,
    }
    const e = revisarAnuncio(datos)
    setGeneral('')
    if (Object.keys(e).length) {
      setErrores(e)
      // El foco va al primer campo con error (en el orden del formulario).
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setEnviando(true)
    try {
      onGuardado(anuncio ? await api.editarAnuncio(anuncio.id, datos) : await api.crearAnuncio(datos))
    } catch (err) {
      if (err instanceof ErrorApi && err.campos.length) {
        const porCampo: ErroresAnuncio = {}
        for (const c of err.campos) {
          const k = CAMPO_DEL_BACKEND[c.field]
          if (k && k !== 'publicacion') porCampo[k] = c.message
          else setGeneral(c.message)
        }
        setErrores(porCampo)
      } else if (err instanceof ErrorApi && err.codigo === 'INVALID_DATES') {
        setErrores({ hasta: err.message })
      } else {
        setGeneral(mensaje(err))
      }
    } finally {
      setEnviando(false)
    }
  }

  const principal = !anuncio || anuncio.publicacion === 'borrador' ? 'Publicar' : anuncio.publicacion === 'retirado' ? 'Guardar y volver a publicar' : 'Guardar cambios'
  // Botón secundario: guarda sin publicar. Un anuncio publicado no tiene: editarlo no lo saca del Inicio (para eso está "Retirar").
  const secundario: { t: string; p: Publicacion } | null =
    !anuncio || anuncio.publicacion === 'borrador' ? { t: 'Guardar borrador', p: 'borrador' } : anuncio.publicacion === 'retirado' ? { t: 'Guardar sin publicar', p: 'retirado' } : null
  const campo = (k: keyof Borrador) => ({
    id: 'ann-' + k,
    'aria-invalid': errores[k] ? true : undefined,
    'aria-describedby': [errores[k] && 'ann-' + k + '-err', 'ann-' + k + '-hint'].filter(Boolean).join(' ') || undefined,
  })
  const error = (k: keyof Borrador) =>
    errores[k] ? (
      <p className="f-err" id={'ann-' + k + '-err'}>
        {errores[k]}
      </p>
    ) : null
  const cls = (k: keyof Borrador, extra = '') => 'f-field' + extra + (errores[k] ? ' is-invalid' : '')

  return (
    <Dialogo id="annEditor" titulo={anuncio ? 'Editar anuncio' : 'Nuevo anuncio'} onCerrar={onCerrar}>
      <form
        ref={form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          guardar('publicado')
        }}
      >
        <div className="home-dlg__body gest-form">
          <div className={cls('titulo', ' f-wide')}>
            <label htmlFor="ann-titulo">Título</label>
            <input className="ds-input" {...campo('titulo')} value={d.titulo} maxLength={MAX_TITULO} onChange={(e) => poner('titulo', e.target.value)} placeholder="Ej.: Mantenimiento del correo el sábado" />
            <span className="f-hint" id="ann-titulo-hint">
              {d.titulo.length} de {MAX_TITULO} caracteres
            </span>
            {error('titulo')}
          </div>
          <div className={cls('detalle', ' f-wide')}>
            <label htmlFor="ann-detalle">Detalle (opcional)</label>
            <textarea className="ds-input" {...campo('detalle')} value={d.detalle} maxLength={MAX_DETALLE} rows={3} onChange={(e) => poner('detalle', e.target.value)} placeholder="Horario, a quién afecta, qué hacer…" />
            <span className="f-hint" id="ann-detalle-hint">
              {d.detalle.length} de {MAX_DETALLE} caracteres. Solo texto.
            </span>
            {error('detalle')}
          </div>
          <div className={cls('nivel')}>
            <label htmlFor="ann-nivel">Nivel</label>
            <select className="ds-input" {...campo('nivel')} value={d.nivel} onChange={(e) => poner('nivel', e.target.value as Nivel)}>
              {NIVELES.map((n) => (
                <option key={n.v} value={n.v}>
                  {n.t}
                </option>
              ))}
            </select>
            <span className="f-hint" id="ann-nivel-hint">
              {NIVELES.find((n) => n.v === d.nivel)?.d}
            </span>
          </div>
          <div className={cls('enlace')}>
            <label htmlFor="ann-enlace">Enlace (opcional)</label>
            <input className="ds-input" {...campo('enlace')} value={d.enlace} inputMode="url" onChange={(e) => poner('enlace', e.target.value)} placeholder="https://… o /formularios" />
            <span className="f-hint" id="ann-enlace-hint">
              Una dirección con https:// o una página de la intranet.
            </span>
            {error('enlace')}
          </div>
          <div className={cls('desde')}>
            <label htmlFor="ann-desde">Se muestra desde</label>
            <input className="ds-input" type="date" {...campo('desde')} value={d.desde} onChange={(e) => poner('desde', e.target.value)} />
            <span className="f-hint" id="ann-desde-hint">
              Si es una fecha futura, queda programado.
            </span>
            {error('desde')}
          </div>
          <div className={cls('hasta')}>
            <label htmlFor="ann-hasta">Hasta (opcional)</label>
            <input className="ds-input" type="date" {...campo('hasta')} value={d.hasta} min={d.desde || undefined} onChange={(e) => poner('hasta', e.target.value)} />
            <span className="f-hint" id="ann-hasta-hint">
              Incluye ese día. Vacío: no vence.
            </span>
            {error('hasta')}
          </div>
          <div className="f-wide ann-previa">
            <p className="ds-overline">Así se verá en el Inicio</p>
            {/* inert: el enlace de la vista previa no se activa (se perdería lo escrito). Una dirección inválida no se muestra como enlace. */}
            <div inert>
              <FilaAnuncio
                a={{ titulo: d.titulo.trim() || 'Título del anuncio', detalle: d.detalle.trim() || null, nivel: d.nivel, enlace: d.enlace.trim() && !revisarUrl(d.enlace, { soloHttps: true }).error ? d.enlace.trim() : null }}
              />
            </div>
          </div>
          {general && (
            <p className="f-err f-wide" role="alert">
              {general}
            </p>
          )}
        </div>
        <div className="home-dlg__foot gest-pie">
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onCerrar}>
            Cancelar
          </button>
          {secundario && (
            <button type="button" className="ds-btn ds-btn--subtle" disabled={enviando} onClick={() => guardar(secundario.p)}>
              {secundario.t}
            </button>
          )}
          <button type="submit" className="ds-btn ds-btn--primary" disabled={enviando}>
            {enviando ? 'Guardando…' : principal}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}
