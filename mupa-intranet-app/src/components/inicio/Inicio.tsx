/**
 * Inicio personalizable (cuadrícula bento de 12 columnas).
 * - Arrastrar y soltar directo con el asa ⠿ (@dnd-kit: mouse, táctil manteniendo
 *   presionado, teclado con Espacio + flechas). Fuera de "Personalizar" se guarda
 *   solo y ofrece Deshacer.
 * - "Personalizar": agregar, quitar, tamaño (⅓, ½, ⅔, completo) y configurar.
 * - Con sesión se guarda en la cuenta (api.guardarInicio; el backend lo valida).
 *   Sin sesión, en este navegador. Administración puede guardar el diseño por
 *   defecto para todos (api.guardarInicioDefecto).
 */
import {
  closestCenter,
  DndContext,
  pointerWithin,
  type CollisionDetection,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable } from '@dnd-kit/sortable'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { api, ErrorApi } from '../../api'
import {
  ANCHO_TEXTO,
  ANCHOS,
  BLOQUES,
  conResumen,
  disenoPorDefecto,
  GRUPOS,
  limpiarCfg,
  limpiarDiseno,
  MAX_BLOQUES,
  mismosBloques,
  nuevoItem,
  type Ancho,
  type CfgElegir,
  type CfgEnlaces,
  type CfgFiltro,
  type Diseno,
  type Item,
} from '../../lib/bloques'
import { urlSegura } from '../../lib/url'
import { LS, useSitio } from '../Proveedores'
import { Dialogo } from '../ui'
import { opcionesElegibles, opcionesFiltro, RENDER, tituloFiltro, type DatosInicio } from './bloques'

type Props = {
  datos: DatosInicio
  disenoUsuario: unknown
  disenoDefecto: unknown
  sesion: { id: string | number } | null
  puedeDefecto: boolean
  personalizar?: boolean
  /** Va arriba de los bloques y no se personaliza (la franja de gestión de cada rol). */
  encabezado?: React.ReactNode
  /** El saludo y la búsqueda: primer bloque de la cuadrícula; no se mueve ni se quita, pero cambia de tamaño. */
  buscador?: React.ReactNode
  /** «Tu día» en línea (pantallas angostas): va justo bajo el buscador; fuera de «Personalizar». */
  dia?: React.ReactNode
}

/** Se guarda en este navegador que la persona quitó «Mi resumen» (ver conResumen). */
const LS_RESUMEN_QUITADO = 'mupa_resumen_quitado'
const clonar = <T,>(o: T): T => JSON.parse(JSON.stringify(o))
const orden = (l: Diseno) => l.items.map((x) => x.uid).join()
const sesionVencio = (e: unknown) => e instanceof ErrorApi && e.estado === 401

export function Inicio({ datos, disenoUsuario, disenoDefecto, sesion, puedeDefecto, personalizar, encabezado, buscador, dia }: Props) {
  const { avisar } = useSitio()
  const defecto = useMemo(() => limpiarDiseno(disenoDefecto) || disenoPorDefecto(), [disenoDefecto])
  const [layout, setLayout] = useState<Diseno>(() => (sesion ? limpiarDiseno(disenoUsuario) : null) || defecto)
  const [editando, setEditando] = useState(false)
  const [antes, setAntes] = useState<Diseno | null>(null)
  const [sucio, setSucio] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [activo, setActivo] = useState<string | null>(null)
  const [aviso, setAviso] = useState('') // lector de pantalla
  const [biblio, setBiblio] = useState(false)
  const [config, setConfig] = useState<{ uid: string; nuevo: boolean } | null>(null)
  const previo = useRef<Diseno | null>(null)
  const ultimoMov = useRef(0)
  const ultimoSobre = useRef<string | null>(null) // último bloque "de abajo" ya aplicado al arrastrar

  const titulo = useCallback((it: Item) => (it.id === 'apps-filtro' ? tituloFiltro(it.cfg as CfgFiltro, datos.apps) : it.id === 'mis-enlaces' ? (it.cfg as CfgEnlaces)?.titulo || 'Mis enlaces' : BLOQUES[it.id].t), [datos.apps])
  const anunciar = (m: string) => {
    setAviso('')
    setTimeout(() => setAviso(m), 30)
  }

  // Sin sesión: el diseño vive en este navegador (y se respetan las preferencias antiguas).
  useEffect(() => {
    if (sesion) return
    const g = limpiarDiseno(LS.get('mupa_inicio', null))
    if (g) return setLayout(g)
    const p = LS.get<Record<string, boolean>>('mupa_prefs', {}) || {}
    if (p.anuncios === false || p.resumen === false) {
      setLayout((l) => ({ ...l, items: l.items.filter((it) => !((it.id === 'anuncios' && p.anuncios === false) || (it.id === 'indicadores' && p.resumen === false))) }))
    }
  }, [sesion])
  useEffect(() => {
    if (personalizar) entrar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalizar])
  // «Mi resumen» sale solo con RRHH Express conectado: se agrega al diseño sin guardarlo, salvo que la persona lo quitara.
  const rrhhConectado = !!datos.rrhh?.conectada
  useEffect(() => {
    if (rrhhConectado) setLayout((l) => conResumen(l, !!LS.get(LS_RESUMEN_QUITADO, false)))
  }, [rrhhConectado])
  useEffect(() => {
    const salirAviso = (e: BeforeUnloadEvent) => {
      if (editando && sucio) e.preventDefault()
    }
    window.addEventListener('beforeunload', salirAviso)
    return () => window.removeEventListener('beforeunload', salirAviso)
  }, [editando, sucio])

  // ---------- Guardar ----------
  const persistir = useCallback(
    async (l: Diseno): Promise<'cuenta' | 'navegador'> => {
      const datosG = mismosBloques(l, defecto) ? null : l
      if (sesion) {
        await api.guardarInicio(datosG)
        return 'cuenta'
      }
      if (datosG ? !LS.set('mupa_inicio', datosG) : (LS.del('mupa_inicio'), false)) throw new Error('sin almacenamiento')
      return 'navegador'
    },
    [defecto, sesion],
  )
  const autoguardar = useCallback(
    (nuevo: Diseno, prev: Diseno, msg: string) => {
      persistir(nuevo)
        .then(() =>
          avisar(msg, {
            t: 'Deshacer',
            fn: () => {
              setLayout(prev)
              persistir(prev).then(() => anunciar('Se deshizo el cambio.')).catch(() => undefined)
            },
          }),
        )
        .catch((e) => avisar(sesionVencio(e) ? 'Tu sesión venció: el cambio no se guardó.' : 'No se pudo guardar el cambio. Revisa tu conexión.'))
    },
    [avisar, persistir],
  )

  // ---------- Entrar / salir de Personalizar ----------
  function entrar() {
    setAntes(clonar(layout))
    setSucio(false)
    setEditando(true)
    setTimeout(() => document.getElementById('homeBarT')?.focus(), 50)
  }
  function salir() {
    setEditando(false)
    setSucio(false)
    setAntes(null)
    setTimeout(() => document.querySelector<HTMLElement>('[data-home="editar"]')?.focus(), 50)
  }
  async function guardar() {
    setOcupado(true)
    try {
      const donde = await persistir(layout)
      // Si la persona quitó «Mi resumen» (con RRHH Express conectado), se recuerda para no volver a agregarlo solo.
      if (rrhhConectado) {
        if (layout.items.some((x) => x.id === 'resumen')) LS.del(LS_RESUMEN_QUITADO)
        else LS.set(LS_RESUMEN_QUITADO, true)
      }
      salir()
      avisar(donde === 'cuenta' ? 'Tu inicio se guardó en tu cuenta' : 'Tu inicio se guardó en este navegador')
    } catch (e) {
      avisar(
        (e as Error).message === 'sin almacenamiento'
          ? 'Este navegador no permite guardar (¿ventana privada?).'
          : sesionVencio(e)
            ? 'Tu sesión venció: el diseño no se guardó.'
            : 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.',
      )
    } finally {
      setOcupado(false)
    }
  }
  async function guardarParaTodos() {
    if (!window.confirm('¿Usar este diseño como el inicio por defecto? Lo verán todas las personas que no han personalizado su inicio.')) return
    setOcupado(true)
    try {
      // null = volver al de fábrica. Solo si coincide del todo: un cambio de tamaño también cuenta.
      await api.guardarInicioDefecto(mismosBloques(layout, disenoPorDefecto()) ? null : layout)
      avisar('Diseño por defecto actualizado para todos')
    } catch {
      avisar('No se pudo guardar el diseño por defecto.')
    } finally {
      setOcupado(false)
    }
  }

  // ---------- Cambios sobre el diseño ----------
  const cambiar = (fn: (items: Item[]) => Item[]) => setLayout((l) => ({ ...l, items: fn(l.items) }))
  function mover(uid: string, d: -1 | 1) {
    const i = layout.items.findIndex((x) => x.uid === uid)
    const j = i + d
    const it = layout.items[i]
    if (j < 0 || j >= layout.items.length) return anunciar(`«${titulo(it)}» ya está ${d < 0 ? 'al principio' : 'al final'}.`)
    const prev = clonar(layout)
    const nuevo = { ...layout, items: arrayMove(layout.items, i, j) }
    setLayout(nuevo)
    anunciar(`«${titulo(it)}»: posición ${j + 1} de ${nuevo.items.length}.`)
    if (editando) setSucio(true)
    else autoguardar(nuevo, prev, 'Orden guardado')
  }
  function quitar(uid: string) {
    const it = layout.items.find((x) => x.uid === uid)!
    cambiar((items) => items.filter((x) => x.uid !== uid))
    setSucio(true)
    anunciar(`Se quitó «${titulo(it)}». Puedes volver a agregarlo con Agregar bloque.`)
  }
  function tamano(uid: string, ancho: Ancho) {
    cambiar((items) => items.map((x) => (x.uid === uid ? { ...x, ancho } : x)))
    setSucio(true)
    anunciar(ANCHO_TEXTO[ancho] + '.')
  }
  function tamanoBuscador(ancho: Ancho) {
    setLayout((l) => {
      const { buscador: _, ...resto } = l
      return ancho === 'completa' ? resto : { ...resto, buscador: ancho }
    })
    setSucio(true)
    anunciar(ANCHO_TEXTO[ancho] + '.')
  }
  function agregar(id: string) {
    if (layout.items.length >= MAX_BLOQUES) return anunciar(`Tu inicio ya tiene el máximo de ${MAX_BLOQUES} bloques.`)
    const it = nuevoItem(id)
    cambiar((items) => [...items, it])
    setSucio(true)
    setBiblio(false)
    anunciar(`Se agregó «${BLOQUES[id].t}» al final.` + (BLOQUES[id].pausa ? ' Ojo: por ahora no está funcionando.' : ''))
    if (BLOQUES[id].configurable) setConfig({ uid: it.uid, nuevo: true })
    setTimeout(() => document.querySelector<HTMLElement>(`[data-uid="${it.uid}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 80)
  }

  // ---------- Arrastrar y soltar ----------
  // Con mouse o dedo manda el bloque que está bajo el puntero (los bloques son de tamaños muy distintos,
  // así que "centro con centro" elige mal); con teclado no hay puntero y se usa el centro.
  const colision = useCallback<CollisionDetection>((args) => {
    const bajo = pointerWithin(args)
    return bajo.length ? bajo : closestCenter(args)
  }, [])
  // Teclado: en una cuadrícula la gente espera ir en orden de lectura, no por geometría:
  // ← ↑ lleva al bloque anterior y → ↓ al siguiente (aunque esté en otra fila).
  const ordenRef = useRef<string[]>([])
  ordenRef.current = layout.items.map((x) => x.uid)
  const porTeclado = useCallback<KeyboardCoordinateGetter>((event, { context, currentCoordinates }) => {
    const d = ({ ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 } as Record<string, number>)[event.code]
    const { active, droppableRects, collisionRect } = context
    if (!d || !active || !collisionRect) return undefined
    event.preventDefault()
    const destino = ordenRef.current[ordenRef.current.indexOf(String(active.id)) + d]
    const r = destino && droppableRects.get(destino)
    if (!r) return undefined
    return {
      x: currentCoordinates.x + (r.left + r.width / 2) - (collisionRect.left + collisionRect.width / 2),
      y: currentCoordinates.y + (r.top + r.height / 2) - (collisionRect.top + collisionRect.height / 2),
    }
  }, [])
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 240, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: porTeclado }),
  )
  const nombre = (id: string | number) => {
    const it = layout.items.find((x) => x.uid === String(id))
    return it ? '«' + titulo(it) + '»' : 'el bloque'
  }
  const pos = (id: string | number) => layout.items.findIndex((x) => x.uid === String(id)) + 1
  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Moviendo ${nombre(active.id)}. Usa las flechas y suelta con Espacio; Escape cancela.`,
    onDragOver: ({ active, over }) => (over ? `${nombre(active.id)} en la posición ${pos(over.id)} de ${layout.items.length}.` : ''),
    onDragEnd: ({ active }) => `Se soltó ${nombre(active.id)} en la posición ${pos(active.id)}.`,
    onDragCancel: ({ active }) => `Se canceló. ${nombre(active.id)} volvió a su lugar.`,
  }
  const alEmpezar = (e: DragStartEvent) => {
    setActivo(String(e.active.id))
    previo.current = clonar(layout)
    ultimoSobre.current = null
  }
  // Se reordena mientras se arrastra: la cuadrícula real se acomoda (tamaños distintos) y el hueco marca dónde caerá.
  const moverA = (l: Diseno, activoId: string, sobreId: string): Diseno => {
    const i = l.items.findIndex((x) => x.uid === activoId)
    const j = l.items.findIndex((x) => x.uid === sobreId)
    return i < 0 || j < 0 ? l : { ...l, items: arrayMove(l.items, i, j) }
  }
  const alPasar = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id || Date.now() - ultimoMov.current < 90) return
    ultimoMov.current = Date.now()
    ultimoSobre.current = String(over.id)
    setLayout((l) => moverA(l, String(active.id), String(over.id)))
  }
  const alSoltar = (e: DragEndEvent) => {
    setActivo(null)
    const prev = previo.current
    previo.current = null
    // dnd-kit avisa del bloque de abajo solo cuando cambia; si ese aviso llegó dentro de
    // los 90 ms del límite, no se aplicó: al soltar se aplica el destino final.
    let final = layout
    const { active, over } = e
    if (over && active.id !== over.id && String(over.id) !== ultimoSobre.current) {
      final = moverA(layout, String(active.id), String(over.id))
      setLayout(final)
    }
    ultimoSobre.current = null
    if (!prev || orden(prev) === orden(final)) return
    if (editando) setSucio(true)
    else autoguardar(final, prev, 'Orden guardado')
  }
  const alCancelar = () => {
    setActivo(null)
    if (previo.current) setLayout(previo.current)
    previo.current = null
  }

  // Animación FLIP: al cambiar el orden o el tamaño, los bloques se deslizan de su lugar anterior.
  const grid = useRef<HTMLDivElement>(null)
  const rects = useRef(new Map<string, DOMRect>())
  useLayoutEffect(() => {
    const g = grid.current
    if (!g) return
    const els = Array.from(g.querySelectorAll<HTMLElement>(':scope > .home-w'))
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // Posiciones relativas a la cuadrícula (no a la ventana): si la persona desplazó la
    // página entre dos renders, eso no es un movimiento del bloque y no se anima.
    const origen = g.getBoundingClientRect()
    els.forEach((el) => {
      const uid = el.dataset.uid!
      const r = el.getBoundingClientRect()
      const b = new DOMRect(r.left - origen.left, r.top - origen.top, r.width, r.height)
      const a = rects.current.get(uid)
      if (a && !reducido && uid !== activo) {
        const dx = a.left - b.left, dy = a.top - b.top
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' })
      }
      rects.current.set(uid, b)
    })
  })

  const itemActivo = activo ? layout.items.find((x) => x.uid === activo) : null
  // En el teléfono lo secundario va plegado bajo «Más» (nada se quita; solo se lee al abrirlo).
  const telefono = useTelefono()
  const plegar = telefono && !editando && !activo
  // Los bloques condicionales (Mi resumen) sin su conexión no ocupan lugar; en «Personalizar» sí se ven, con su aviso.
  const visibles = editando || activo ? layout.items : layout.items.filter((it) => !(BLOQUES[it.id].condicional === 'rrhh' && !rrhhConectado))
  const secundarios = plegar ? visibles.filter((it) => SECUNDARIOS.includes(it.id)) : []
  const rango = (id: string) => {
    const i = PRIORIDAD_TELEFONO.indexOf(id)
    return i < 0 ? PRIORIDAD_TELEFONO.length : i
  }
  const principales = plegar ? [...visibles].filter((it) => !SECUNDARIOS.includes(it.id)).sort((a, b) => rango(a.id) - rango(b.id)) : visibles
  const pintar = (it: Item) => (
    <Bloque
      key={it.uid}
      it={it}
      titulo={titulo(it)}
      editando={editando}
      arrastrando={activo === it.uid}
      datos={datos}
      onMover={mover}
      onQuitar={quitar}
      onTamano={tamano}
      onConfig={(uid) => setConfig({ uid, nuevo: false })}
    />
  )

  return (
    <>
      {/* El título es el saludo del bloque del buscador. */}
      {!buscador && <h1 className="sr-only">Inicio</h1>}
      <div className={'home' + (editando ? ' is-editing' : '') + (activo ? ' is-dragging' : '')} id="home">
        {!editando && encabezado}
        <BarraSuperior
          editando={editando}
          ocupado={ocupado}
          puedeDefecto={puedeDefecto}
          onEditar={() => {
            entrar()
            if (!layout.items.length) setBiblio(true)
          }}
          onAgregar={() => setBiblio(true)}
          onRestablecer={() => {
            setLayout(clonar(defecto))
            setSucio(true)
            avisar('Diseño original restablecido: pulsa Guardar para conservarlo')
          }}
          onCancelar={() => {
            if (antes) setLayout(antes)
            salir()
            anunciar('Se descartaron los cambios.')
          }}
          onGuardar={guardar}
          onDefecto={guardarParaTodos}
        />
        <DndContext id="inicio-dnd" sensors={sensores} collisionDetection={colision} onDragStart={alEmpezar} onDragOver={alPasar} onDragEnd={alSoltar} onDragCancel={alCancelar} accessibility={{ announcements: anuncios, screenReaderInstructions: { draggable: 'Para mover el bloque, pulsa Espacio o Enter, usa las flechas y vuelve a pulsar Espacio para soltarlo. Escape cancela.' } }}>
          <SortableContext items={layout.items.map((x) => x.uid)} strategy={() => null}>
            <div className="home-grid" id="homeGrid" ref={grid}>
              {buscador && <BloqueBuscador ancho={layout.buscador ?? 'completa'} editando={editando} onTamano={tamanoBuscador}>{buscador}</BloqueBuscador>}
              {dia && !editando && <div className="home-dia">{dia}</div>}
              {principales.map(pintar)}
              {secundarios.length > 0 && (
                <details className="home-mas">
                  <summary>Ver más del Inicio ({secundarios.length})</summary>
                  <div className="home-mas__grid">{secundarios.map(pintar)}</div>
                </details>
              )}
              {!layout.items.length && (
                <div className="home-vacio empty-state">
                  <b>Tu inicio está vacío</b>
                  <p>Agrega los bloques que quieras ver al abrir la intranet.</p>
                  <button type="button" className="ds-btn ds-btn--primary" onClick={() => (editando ? setBiblio(true) : (entrar(), setBiblio(true)))}>＋ Agregar bloques</button>
                </div>
              )}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
            {itemActivo ? (
              <div className="home-w is-lifted-overlay" data-ancho={itemActivo.ancho}>
                <div className="home-w__body">{RENDER[itemActivo.id]({ uid: itemActivo.uid + '-arrastre', cfg: itemActivo.cfg, editando, datos })}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        <p className="sr-only" aria-live="polite">{aviso}</p>
      </div>

      {biblio && <Biblioteca layout={layout} onAgregar={agregar} onCerrar={() => setBiblio(false)} />}
      {config && (() => {
        const it = layout.items.find((x) => x.uid === config.uid)
        if (!it) return null
        const aplicar = (cfg: unknown) => {
          cambiar((items) => items.map((x) => (x.uid === it.uid ? { ...x, cfg: limpiarCfg(it.id, cfg) } : x)))
          setSucio(true)
          setConfig(null)
          anunciar('Se actualizó el bloque.')
        }
        if (BLOQUES[it.id].elegible) return <Elegir it={it} titulo={titulo(it)} datos={datos} onCerrar={() => setConfig(null)} onAplicar={aplicar} />
        return (
          <Configurar
            it={it}
            nuevo={config.nuevo}
            titulo={titulo(it)}
            datos={datos}
            onCerrar={() => setConfig(null)}
            onAplicar={aplicar}
          />
        )
      })()}
    </>
  )
}

// ---------- Un bloque (con su asa, o su barra en modo Personalizar) ----------
/** Bloques que en el teléfono se pliegan bajo «Más». */
const SECUNDARIOS = ['noticias', 'boletines', 'frecuentes', 'enlaces', 'marca', 'campanas']
/** Orden de lo que queda a la vista en el teléfono: lo que más se usa, primero. */
const PRIORIDAD_TELEFONO = ['resumen', 'accesos', 'mesa', 'clinica', 'solicitudes', 'directorio']

function useTelefono() {
  const [t, setT] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 767px)').matches)
  useEffect(() => {
    const m = window.matchMedia?.('(max-width: 767px)')
    if (!m) return
    const f = () => setT(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return t
}

function Bloque(p: {
  it: Item
  titulo: string
  editando: boolean
  arrastrando: boolean
  datos: DatosInicio
  onMover: (uid: string, d: -1 | 1) => void
  onQuitar: (uid: string) => void
  onTamano: (uid: string, a: Ancho) => void
  onConfig: (uid: string) => void
}) {
  const { it, titulo: t, editando } = p
  const { setNodeRef, setActivatorNodeRef, attributes, listeners } = useSortable({ id: it.uid })
  const asa = {
    ref: setActivatorNodeRef,
    ...attributes,
    ...listeners,
    'aria-roledescription': 'bloque movible',
    'aria-label': `Mover «${t}»: pulsa Espacio y usa las flechas`,
    title: 'Arrastra para mover',
  }
  return (
    <div ref={setNodeRef} className={'home-w' + (p.arrastrando ? ' is-placeholder' : '')} data-widget={it.id} data-uid={it.uid} data-ancho={it.ancho}>
      {editando ? (
        <div className="home-w__bar">
          <button type="button" className="home-w__drag" {...asa}><span aria-hidden="true">⠿</span></button>
          <span className="home-w__name">{t}</span>
          <label className="sr-only" htmlFor={'sz-' + it.uid}>Tamaño de «{t}»</label>
          <select className="home-w__size" id={'sz-' + it.uid} value={it.ancho} onChange={(e) => p.onTamano(it.uid, e.target.value as Ancho)}>
            {ANCHOS.map((a) => <option key={a} value={a}>{ANCHO_TEXTO[a]}</option>)}
          </select>
          <span className="home-w__acts">
            <button type="button" data-act="up" aria-label={`Subir «${t}»`} title={`Subir «${t}»`} onClick={() => p.onMover(it.uid, -1)}><span aria-hidden="true">↑</span></button>
            <button type="button" data-act="down" aria-label={`Bajar «${t}»`} title={`Bajar «${t}»`} onClick={() => p.onMover(it.uid, 1)}><span aria-hidden="true">↓</span></button>
            {BLOQUES[it.id].configurable && <button type="button" data-act="cfg" aria-label={`Configurar «${t}»`} title={`Configurar «${t}»`} onClick={() => p.onConfig(it.uid)}><span aria-hidden="true">⚙</span></button>}
            {BLOQUES[it.id].elegible && <button type="button" data-act="cfg" aria-label={`Elegir qué mostrar en «${t}»`} title={`Elegir qué mostrar en «${t}»`} onClick={() => p.onConfig(it.uid)}><span aria-hidden="true">⚙</span></button>}
            <button type="button" data-act="quitar" aria-label={`Quitar «${t}»`} title={`Quitar «${t}»`} onClick={() => p.onQuitar(it.uid)}><span aria-hidden="true">✕</span></button>
          </span>
        </div>
      ) : null}
      <div className="home-w__body" inert={editando || undefined}>
        {RENDER[it.id]({ uid: it.uid, cfg: it.cfg, editando, datos: p.datos })}
      </div>
      {!editando && <button type="button" className="home-w__grip" {...asa}><span aria-hidden="true">⠿</span></button>}
    </div>
  )
}

// ---------- El bloque fijo del saludo y la búsqueda: solo cambia de tamaño ----------
function BloqueBuscador(p: { ancho: Ancho; editando: boolean; onTamano: (a: Ancho) => void; children: React.ReactNode }) {
  const t = 'Saludo y búsqueda'
  return (
    <div className="home-w home-w--buscador" data-widget="buscador" data-uid="buscador" data-ancho={p.ancho}>
      {p.editando && (
        <div className="home-w__bar">
          <span className="home-w__name">{t}</span>
          <label className="sr-only" htmlFor="sz-buscador">Tamaño de «{t}»</label>
          <select className="home-w__size" id="sz-buscador" value={p.ancho} onChange={(e) => p.onTamano(e.target.value as Ancho)}>
            {ANCHOS.map((a) => <option key={a} value={a}>{ANCHO_TEXTO[a]}</option>)}
          </select>
          <span className="home-w__fijo">Fijo</span>
        </div>
      )}
      <div className="home-w__body" inert={p.editando || undefined}>{p.children}</div>
    </div>
  )
}

// ---------- Barra superior: Personalizar / Guardar ----------
function BarraSuperior(p: { editando: boolean; ocupado: boolean; puedeDefecto: boolean; onEditar: () => void; onAgregar: () => void; onRestablecer: () => void; onCancelar: () => void; onGuardar: () => void; onDefecto: () => void }) {
  const [tactil, setTactil] = useState(false)
  useEffect(() => setTactil(!!window.matchMedia?.('(hover: none)').matches), [])
  if (!p.editando) {
    return (
      <div className="home-bar">
        <p className="home-bar__tip">{tactil ? 'Mantén presionado' : 'Arrastra'} <span aria-hidden="true">⠿</span> en cualquier bloque para ordenar tu inicio</p>
        <button type="button" className="ds-btn ds-btn--subtle home-bar__edit" data-home="editar" onClick={p.onEditar}><span aria-hidden="true">✎</span> Personalizar</button>
      </div>
    )
  }
  return (
    <div className="home-bar is-editing" role="region" aria-labelledby="homeBarT">
      <div className="home-bar__tx">
        <b id="homeBarT" tabIndex={-1}>Personalizando tu inicio</b>
        <span>Arrastra, cambia el tamaño o quita bloques. Se aplica al pulsar Guardar.</span>
      </div>
      <div className="home-bar__acts">
        <button type="button" className="ds-btn ds-btn--subtle" disabled={p.ocupado} onClick={p.onAgregar}><span aria-hidden="true">＋</span> Agregar bloque</button>
        <button type="button" className="ds-btn ds-btn--ghost" disabled={p.ocupado} onClick={p.onRestablecer}>Restablecer</button>
        {p.puedeDefecto && <button type="button" className="ds-btn ds-btn--ghost" disabled={p.ocupado} onClick={p.onDefecto} title="Lo verán quienes no han personalizado su inicio">Guardar para todos</button>}
        <button type="button" className="ds-btn ds-btn--ghost" disabled={p.ocupado} onClick={p.onCancelar}>Cancelar</button>
        <button type="button" className="ds-btn ds-btn--primary" disabled={p.ocupado} onClick={p.onGuardar}>Guardar</button>
      </div>
    </div>
  )
}

// ---------- Diálogos ----------
function Biblioteca({ layout, onAgregar, onCerrar }: { layout: Diseno; onAgregar: (id: string) => void; onCerrar: () => void }) {
  const usados: Record<string, number> = {}
  layout.items.forEach((x) => (usados[x.id] = (usados[x.id] || 0) + 1))
  const enUso = Object.keys(BLOQUES).filter((k) => usados[k] && !BLOQUES[k].multi)
  return (
    <Dialogo id="homeLib" titulo="Agregar un bloque" onCerrar={onCerrar}>
      <div className="home-dlg__body">
        <p className="ds-body-sm">Los bloques nuevos se agregan al final; luego puedes moverlos.</p>
        {GRUPOS.map((g) => {
          const ids = Object.keys(BLOQUES).filter((k) => BLOQUES[k].grupo === g.id && !enUso.includes(k))
          if (!ids.length) return null
          return (
            <section key={g.id} className="home-lib__group" aria-labelledby={'lib-' + g.id}>
              <h3 id={'lib-' + g.id}>{g.t}</h3>
              <ul className="home-lib__list">
                {ids.map((k) => (
                  <li key={k} className="home-lib__item">
                    <span className="ic" aria-hidden="true">{BLOQUES[k].g}</span>
                    <span className="tx">
                      <b>{BLOQUES[k].t}</b>
                      <span>{BLOQUES[k].d}</span>
                      {BLOQUES[k].pausa ? <span className="home-lib__n">No está funcionando por ahora</span> : null}
                      {BLOQUES[k].multi && usados[k] ? <span className="home-lib__n">Tienes {usados[k]}</span> : null}
                    </span>
                    <button type="button" className="ds-btn ds-btn--subtle" data-add={k} aria-label={'Agregar ' + BLOQUES[k].t} onClick={() => onAgregar(k)}>Agregar</button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        {enUso.length > 0 && (
          <section className="home-lib__group" aria-labelledby="lib-en-uso">
            <h3 id="lib-en-uso">Ya están en tu inicio</h3>
            <ul className="home-lib__usados">{enUso.map((k) => <li key={k}>{BLOQUES[k].t}</li>)}</ul>
          </section>
        )}
      </div>
    </Dialogo>
  )
}

/** "Elegir qué mostrar": casillas con los ítems del bloque; se guarda lo que se desmarca. */
function Elegir({ it, titulo, datos, onCerrar, onAplicar }: { it: Item; titulo: string; datos: DatosInicio; onCerrar: () => void; onAplicar: (cfg: unknown) => void }) {
  const opciones = opcionesElegibles(it.id, datos)
  const [ocultos, setOcultos] = useState<string[]>(() => ((it.cfg as CfgElegir | undefined)?.ocultos ?? []).filter((k) => opciones.some((o) => o.k === k)))
  const alternar = (k: string) => setOcultos((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]))
  const ninguno = opciones.length > 0 && ocultos.length >= opciones.length
  return (
    <Dialogo id="homeElegir" titulo={'Elegir qué mostrar: ' + titulo} onCerrar={onCerrar}>
      <form
        className="home-cfg"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (!ninguno) onAplicar({ ocultos })
        }}
      >
        <div className="home-dlg__body">
          <p className="ds-body-sm">Desmarca lo que no usas. Lo que se agregue más adelante aparece solo.</p>
          <fieldset className="cfg-elegir">
            <legend className="sr-only">{titulo}</legend>
            {opciones.map((o) => (
              <label key={o.k} className="cfg-elegir__op">
                <input type="checkbox" checked={!ocultos.includes(o.k)} onChange={() => alternar(o.k)} />
                <span>{o.t}</span>
              </label>
            ))}
          </fieldset>
          {ninguno && <p className="home-cfg__err" role="alert">Deja al menos uno marcado. Si no quieres ver este bloque, quítalo con ✕.</p>}
        </div>
        <div className="home-dlg__foot">
          <button type="button" className="ds-btn ds-btn--ghost" onClick={() => setOcultos([])}>Marcar todos</button>
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="ds-btn ds-btn--primary" disabled={ninguno}>Aplicar</button>
        </div>
      </form>
    </Dialogo>
  )
}

function Configurar({ it, nuevo, titulo, datos, onCerrar, onAplicar }: { it: Item; nuevo: boolean; titulo: string; datos: DatosInicio; onCerrar: () => void; onAplicar: (cfg: unknown) => void }) {
  const [error, setError] = useState('')
  const filtro = it.cfg as CfgFiltro | undefined
  const enl = it.cfg as CfgEnlaces | undefined
  const [filas, setFilas] = useState(() => (enl?.links?.length ? enl.links : [{ t: '', h: '' }]).map((l, i) => ({ ...l, k: i })))
  const o = opcionesFiltro(datos.apps)

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    if (it.id === 'apps-filtro') {
      const v = String(f.get('filtro') || '')
      if (!v) return setError('Elige un área o una etiqueta.')
      const i = v.indexOf(':')
      return onAplicar({ tipo: v.slice(0, i), valor: v.slice(i + 1), cantidad: Number(f.get('cantidad')), titulo: f.get('titulo') })
    }
    const links: { t: string; h: string }[] = []
    for (const fila of filas) {
      const t = String(f.get('t-' + fila.k) || '').trim()
      const h = String(f.get('h-' + fila.k) || '').trim()
      if (!t && !h) continue
      const ok = urlSegura(h)
      if (!ok) return setError(`Revisa la dirección "${h || t}": debe empezar con https:// o http://.`)
      links.push({ t, h: ok })
    }
    onAplicar({ titulo: f.get('titulo'), links })
  }

  return (
    <Dialogo id="homeCfg" titulo={nuevo ? 'Configura el bloque nuevo' : 'Configurar: ' + titulo} onCerrar={onCerrar}>
      <form className="home-cfg" noValidate onSubmit={enviar}>
        <div className="home-dlg__body">
          {it.id === 'apps-filtro' ? (
            <>
              <div className="f-field">
                <label htmlFor="cfg-filtro">Mostrar aplicaciones de</label>
                <select className="ds-input" id="cfg-filtro" name="filtro" defaultValue={filtro?.valor ? filtro.tipo + ':' + filtro.valor : ''} aria-invalid={!!error || undefined}>
                  <option value="">Elige un área o una etiqueta…</option>
                  <optgroup label="Áreas">{o.areas.map((x) => <option key={x.v} value={x.v}>{x.t} ({x.n})</option>)}</optgroup>
                  <optgroup label="Etiquetas">{o.tags.map((x) => <option key={x.v} value={x.v}>{x.t} ({x.n})</option>)}</optgroup>
                </select>
              </div>
              <div className="f-field">
                <label htmlFor="cfg-cantidad">Cuántas mostrar</label>
                <select className="ds-input" id="cfg-cantidad" name="cantidad" defaultValue={filtro?.cantidad || 6}>
                  {[4, 6, 8, 12].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="f-field">
                <label htmlFor="cfg-titulo">Título (opcional)</label>
                <input className="ds-input" id="cfg-titulo" name="titulo" maxLength={60} defaultValue={filtro?.titulo || ''} placeholder="Se usa el nombre del área o etiqueta" />
              </div>
            </>
          ) : (
            <>
              <div className="f-field">
                <label htmlFor="cfg-titulo">Título del bloque</label>
                <input className="ds-input" id="cfg-titulo" name="titulo" maxLength={60} defaultValue={enl?.titulo || 'Mis enlaces'} />
              </div>
              <fieldset className="cfg-links">
                <legend>Enlaces (hasta 8)</legend>
                <div data-filas>
                  {filas.map((fila, i) => (
                    <div className="cfg-link" key={fila.k}>
                      <div className="f-field">
                        <label htmlFor={'cfg-t-' + fila.k}>Nombre</label>
                        <input className="ds-input" id={'cfg-t-' + fila.k} name={'t-' + fila.k} maxLength={60} defaultValue={fila.t} placeholder="Ej.: Correo institucional" />
                      </div>
                      <div className="f-field">
                        <label htmlFor={'cfg-h-' + fila.k}>Dirección (URL)</label>
                        <input className="ds-input" id={'cfg-h-' + fila.k} name={'h-' + fila.k} type="url" inputMode="url" defaultValue={fila.h} placeholder="https://…" />
                      </div>
                      <button type="button" className="cfg-link__del" aria-label={'Quitar el enlace ' + (i + 1)} onClick={() => setFilas((F) => (F.length > 1 ? F.filter((x) => x.k !== fila.k) : [{ t: '', h: '', k: Date.now() }]))}>✕</button>
                    </div>
                  ))}
                </div>
                {filas.length < 8 && <button type="button" className="ds-btn ds-btn--ghost cfg-add" onClick={() => setFilas((F) => [...F, { t: '', h: '', k: Date.now() }])}>＋ Agregar enlace</button>}
              </fieldset>
            </>
          )}
          {error && <p className="home-cfg__err" role="alert">{error}</p>}
        </div>
        <div className="home-dlg__foot">
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="ds-btn ds-btn--primary">Aplicar</button>
        </div>
      </form>
    </Dialogo>
  )
}
