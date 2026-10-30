import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { api } from '../api'
import { Encabezado } from '../components/inicio/Encabezado'
import { Inicio } from '../components/inicio/Inicio'
import { PanelGestion } from '../components/inicio/PanelGestion'
import { TuDia } from '../components/inicio/TuDia'
import { LS } from '../components/Proveedores'
import type { DatosInicio } from '../components/inicio/bloques'
import { useDatos } from '../datos'
import type { Anuncio } from '../lib/anuncios'
import type { Noticia } from '../lib/contenido'
import { activa } from '../lib/edicion'
import { claseEstadoCodigo, codigoAbierto, diaDe, tituloCodigo, type SolicitudCodigo } from '../lib/codigosLlamada'
import { claseEstadoTicket, diaTicket, estadoTicket, ticketAbierto, type TicketGlpi } from '../lib/glpi'
import { citaAbierta, claseEstadoCita, estadoCita, horaCita, tituloCita, type CitaClinica } from '../lib/clinica'
import { debeMostrarse, LS_RECORRIDO } from '../lib/recorrido'
import { abrirRecorrido } from '../lib/recorridoControl'
import { abierta, estadoDe, type SolicitudMia } from '../lib/solicitudes'
import { fechaCorta, fechaLarga, hoyIso } from '../lib/fechas'
import { nombreMes } from '../lib/rrhh'
import { CARGANDO, comoFuente, vencimientoPronto, type Fuente, type ResumenRrhh } from '../lib/tuDia'
import { tieneRol } from '../lib/roles'
import { useIndiceBusqueda } from '../lib/useIndiceBusqueda'
import { useTitulo } from './titulo'

const ANCHO_DIA = '(min-width: 1280px)'

/** ¿Cabe la columna de «Tu día»? Se vuelve a calcular al cambiar el tamaño de la ventana. */
function useAncho(): boolean {
  const [si, setSi] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(ANCHO_DIA).matches)
  useEffect(() => {
    const m = window.matchMedia(ANCHO_DIA)
    const cambio = () => setSi(m.matches)
    m.addEventListener('change', cambio)
    return () => m.removeEventListener('change', cambio)
  }, [])
  return si
}

export function PaginaInicio() {
  useTitulo()
  const { usuario, apps, contenido: c, boletines, formularios } = useDatos()
  const indice = useIndiceBusqueda()
  const [sp, setSp] = useSearchParams()
  // Se piden al abrir la página (no se reutiliza lo cargado al inicio): así un
  // cambio guardado hace un rato, el nuevo diseño para todos o un anuncio recién
  // publicado siempre se ven. null = sin diseño guardado.
  const [disenos, setDisenos] = useState<{ defecto: unknown; propio: unknown } | null>(null)
  const [anuncios, setAnuncios] = useState<{ items: Anuncio[] | null; error: boolean }>({ items: null, error: false })
  const [noticias, setNoticias] = useState<Noticia[]>([])
  // Cada consulta de la persona guarda si cargó, no está conectada, falló o trajo datos (lib/tuDia.ts): «Tu día» no
  // dice «Nada pendiente» si no pudo saberlo. Se piden una sola vez aquí y se comparten con los bloques.
  const [fSolicitudes, setFSolicitudes] = useState<Fuente<SolicitudMia[]>>(CARGANDO)
  const [fCitas, setFCitas] = useState<Fuente<CitaClinica[]>>(CARGANDO)
  const [fCodigos, setFCodigos] = useState<Fuente<SolicitudCodigo[]>>(CARGANDO)
  const [fTickets, setFTickets] = useState<Fuente<TicketGlpi[]>>(CARGANDO)
  const [gestion, setGestion] = useState<{ abiertas: number; atrasadas: number; primeraH: number | null } | null>(null)
  // «Mi resumen»: null = todavía no se sabe o RRHH Express no está en este servidor (el bloque no se muestra).
  const [rrhh, setRrhh] = useState<ResumenRrhh | null>(null)
  useEffect(() => {
    let vivo = true
    api
      .disenosInicio()
      .then((d) => ({ defecto: d.default, propio: d.personal }))
      .catch(() => ({ defecto: null, propio: null }))
      .then((d) => vivo && setDisenos(d))
    // Lo que esta edición apaga no se pide: su ruta no existe en la API (404).
    if (activa('anuncios'))
      api
        .anuncios()
        .then((items) => ({ items, error: false }))
        .catch(() => ({ items: [], error: true }))
        .then((a) => vivo && setAnuncios(a))
    if (activa('noticias'))
      api
        .noticias()
        .catch(() => [])
        .then((n) => vivo && setNoticias(n.slice(0, 4)))
    const NO = { estado: 'no' } as const
    const ERROR = { estado: 'error' } as const
    if (usuario && activa('solicitudes')) {
      // Las solicitudes internas (formularios de la intranet) solo existen si la edición las tiene.
      if (activa('formularios'))
        api
          .misSolicitudes()
          .then((s) => ({ estado: 'ok', datos: s }) as const)
          .catch(() => ERROR)
          .then((f) => vivo && setFSolicitudes(f))
      else setFSolicitudes(NO)
      // Las citas de la Clínica también son «solicitudes» de la persona (si hay conexión y se conoce su cédula).
      api
        .misCitas()
        .then((c) => comoFuente(c, c.citas))
        .catch(() => ERROR)
        .then((f) => vivo && setFCitas(f))
      // Y las solicitudes de código de llamada.
      api
        .misCodigosLlamada()
        .then((c) => comoFuente(c, c.solicitudes))
        .catch(() => ERROR)
        .then((f) => vivo && setFCodigos(f))
      // Y los tickets de la Mesa de Ayuda (GLPI).
      api
        .misTicketsGlpi()
        .then((t) => comoFuente(t, t.tickets))
        .catch(() => ERROR)
        .then((f) => vivo && setFTickets(f))
    } else {
      setFSolicitudes(NO)
      setFCitas(NO)
      setFCodigos(NO)
      setFTickets(NO)
    }
    // Las cifras de gestión de «Tu día»: solo quien atiende solicitudes y solo si la edición tiene la bandeja.
    const cargarGestion = () =>
      api
        .panelGestion()
        .then((p) => p.requests)
        .then((r) => vivo && r && setGestion({ abiertas: r.open, atrasadas: r.overdue, primeraH: r.firstResponseHours }))
        .catch(() => undefined)
    const conGestion = !!usuario && activa('bandeja') && tieneRol(usuario, 'admin', 'comunicacion', 'gestorSolicitudes')
    if (conGestion) {
      cargarGestion()
      window.addEventListener('mupa:solicitudes', cargarGestion)
    }
    // «Mi resumen»: solo con RRHH Express conectado. Primero se pregunta por la conexión; los datos (compensatorio,
    // marcaciones del mes y último comprobante) solo se piden si hay conexión.
    if (usuario)
      api.rrhhConexion().then(async (cx) => {
        if (!vivo || !cx.disponible || !cx.conectada) return
        const hoy = new Date()
        const [comp, marc, comprobantes] = await Promise.allSettled([api.rrhhCompensatorio(), api.rrhhMarcaciones(hoy.getFullYear(), hoy.getMonth() + 1), api.rrhhComprobantes(1)])
        if (!vivo) return
        const m = marc.status === 'fulfilled' ? marc.value : null
        const ultimo = comprobantes.status === 'fulfilled' ? [...comprobantes.value.items].filter((x) => x.fecha).sort((x, y) => y.fecha!.localeCompare(x.fecha!))[0] : null
        setRrhh({
          conectada: true,
          compensatorioMin: comp.status === 'fulfilled' ? comp.value.totalDisponible : null,
          vence: comp.status === 'fulfilled' ? vencimientoPronto(comp.value.vencimientos) : null,
          marcaciones: m ? { mes: nombreMes(m.anio, m.mes).split(' ')[0].toLowerCase(), presentes: m.resumen.presentes, tardanzas: m.resumen.tardanzas, ausencias: m.resumen.ausencias } : null,
          comprobante:
            comprobantes.status !== 'fulfilled' ? null : ultimo ? { fecha: ultimo.fecha!, periodo: ultimo.periodo.anio && ultimo.periodo.mes ? nombreMes(ultimo.periodo.anio, ultimo.periodo.mes) : '' } : 'sin',
        })
      })
    return () => {
      vivo = false
      window.removeEventListener('mupa:solicitudes', cargarGestion)
    }
  }, [usuario])
  const lista = <T,>(f: Fuente<T[]>): T[] => (f.estado === 'ok' ? f.datos : [])
  const solicitudes = lista(fSolicitudes)
  const citas = lista(fCitas)
  const codigos = lista(fCodigos)
  const tickets = lista(fTickets)

  const datos = useMemo<DatosInicio>(
    () => ({
      usuario: usuario ? { corto: usuario.corto } : null,
      anuncios: { ...anuncios, gestionar: tieneRol(usuario, 'admin', 'comunicacion') },
      solicitudes: usuario
        ? {
            items: solicitudes.map((s) => ({
              code: s.folio + (s.sinLeer ? ' · Nueva respuesta' : ''),
              t: s.formulario,
              m: s.area + ' · ' + fechaCorta(hoyIso(new Date(s.creada))),
              st: estadoDe(s.estado).t,
              c: estadoDe(s.estado).st,
              open: abierta(s.estado),
              h: '/mis-solicitudes/' + s.id,
            })).concat(
              // Las citas de la Clínica, como filas de solo lectura que llevan a la Clínica.
              citas.map((x) => ({
                code: 'Cita · Clínica',
                t: tituloCita(x),
                m: fechaLarga(x.fecha) + (horaCita(x.hora) ? ', ' + horaCita(x.hora) : ''),
                st: estadoCita(x.estado).texto,
                c: claseEstadoCita(x.estado),
                open: citaAbierta(x, hoyIso(new Date())),
                h: '/clinica',
              })),
            ).concat(
              // Las de código de llamada, también de solo lectura: llevan a Mis solicitudes, donde se abre su historial.
              codigos.map((x) => ({
                code: 'Código de llamada · N.º ' + x.numero,
                t: tituloCodigo(x),
                m: fechaLarga(diaDe(x.actualizada)),
                st: x.estado,
                c: claseEstadoCodigo(x.estadoId),
                open: codigoAbierto(x),
                h: '/mis-solicitudes',
              })),
            ).concat(
              // Los tickets de la Mesa de Ayuda, de solo lectura: llevan a Mis solicitudes.
              tickets.map((x) => ({
                code: 'Mesa de Ayuda · Ticket N.º ' + x.numero,
                t: x.titulo,
                m: fechaLarga(diaTicket(x.actualizado)),
                st: estadoTicket(x.estadoId),
                c: claseEstadoTicket(x.estadoId),
                open: ticketAbierto(x),
                h: '/mis-solicitudes',
              })),
            ),
          }
        : { nota: 'Inicia sesión para ver tus solicitudes.', items: [] },
      noticias: { items: noticias.map((n) => ({ t: n.t, meta: fechaCorta(n.fecha) + (n.meta ? ' · ' + n.meta : ''), h: n.h, img: n.img, tag: n.tipo })) },
      directorio: { nota: c.directorio?.nota, personas: c.directorio?.personas || [] },
      frecuentes: { nota: c.frecuentes?.nota, items: c.frecuentes?.items || [] },
      campanas: { nota: c.campanas?.nota, items: c.campanas?.items || [] },
      clinica: { intro: c.clinica?.intro, items: c.clinica?.items || [] },
      mesa: c.mesa || {},
      enlaces: c.enlaces || [],
      apps,
      boletines,
      rrhh,
      formularios: formularios.map((f) => ({
        t: f.title,
        meta: f.area + ' · Form. ' + f.id,
        h: '/formularios/' + f.slug,
        area: f.area,
      })),
    }),
    [usuario, apps, c, anuncios, noticias, boletines, formularios, solicitudes, citas, codigos, tickets, rrhh],
  )

  // Recorrido para usuarios nuevos: solo la primera vez (en la cuenta o en este navegador), o
  // cuando se pide desde Ayuda o Configuración (/?recorrido=1). Nunca mientras se personaliza.
  const pedido = sp.get('recorrido') === '1'
  useEffect(() => {
    if (!disenos || sp.get('personalizar') === '1') return
    const vistoEnNavegador = LS.get<string | null>(LS_RECORRIDO, null) !== null
    const vistoEnCuenta = !!usuario?.recorridoVisto
    // Lo que se vio en un lado cuenta en el otro: no se repite al entrar ni en otro equipo.
    if (usuario && vistoEnNavegador && !vistoEnCuenta) api.marcarRecorrido().catch(() => undefined)
    if (vistoEnCuenta && !vistoEnNavegador) LS.set(LS_RECORRIDO, hoyIso())
    if (!pedido && !debeMostrarse({ conSesion: !!usuario, vistoEnCuenta, vistoEnNavegador })) return
    // Un momento para que el encabezado y la barra ya estén en pantalla. El recorrido vive en App
    // (components/recorrido/Recorrido.tsx, RecorridoRaiz): aquí solo se pide, porque lleva a /asistente y vuelve.
    const t = setTimeout(() => {
      abrirRecorrido()
      if (pedido)
        setSp(
          (p) => {
            p.delete('recorrido')
            return p
          },
          { replace: true },
        )
    }, 600)
    return () => clearTimeout(t)
  }, [disenos, usuario, pedido, sp, setSp])

  // «Tu día»: una columna a la derecha (≥1280 px) o, en pantallas angostas, dentro del Inicio, justo bajo el buscador.
  // Solo se monta una de las dos versiones a la vez.
  const ancho = useAncho()
  const dia = (
    <TuDia
      enLinea={!ancho}
      usuario={!!usuario}
      boletin={activa('boletines') ? boletines.find((b) => b.pdf) ?? null : null}
      solicitudes={fSolicitudes}
      tickets={fTickets}
      codigos={fCodigos}
      citas={fCitas}
      gestion={gestion}
    />
  )

  if (!disenos) return null
  return (
    <div className={'inicio-cols' + (ancho ? ' inicio-cols--dia' : '')}>
      <div className="inicio-cols__main">
      <Inicio
        key={String(usuario?.id ?? 'anonimo')}
        datos={datos}
        disenoUsuario={disenos.propio}
        disenoDefecto={disenos.defecto}
        sesion={usuario ? { id: usuario.id } : null}
        puedeDefecto={tieneRol(usuario, 'admin')}
        personalizar={sp.get('personalizar') === '1'}
        encabezado={<PanelGestion usuario={usuario} />}
        buscador={<Encabezado nombre={usuario?.corto ?? null} indice={indice} />}
        dia={ancho ? null : dia}
      />
      </div>
      {ancho && dia}
    </div>
  )
}
