/**
 * Cascarón de la SPA: menú, barra superior, pie y las rutas. Los datos
 * compartidos (sesión, catálogo, contenido) vienen de <ProveedorDatos>.
 */
import React, { Suspense, useEffect, useRef } from 'react'
import { Navigate, Route, Routes, matchPath, useLocation, useNavigate } from 'react-router'

import { Proveedores } from './components/Proveedores'
import { RecorridoRaiz } from './components/recorrido/Recorrido'
import { BarraInferior, Sidebar } from './components/shell/Menu'
import { Pie } from './components/shell/Pie'
import { Topbar } from './components/shell/Topbar'
import { EnlaceEntrar } from './components/ui'
import { ProveedorDatos, useDatos } from './datos'
import { rutaVisible } from './lib/edicion'
import { limpiarMarcaDeRecarga, perezosa } from './lib/perezosa'
import { useIndiceBusqueda } from './lib/useIndiceBusqueda'
import { esArchivo } from './lib/url'
import { Aplicaciones } from './paginas/Aplicaciones'
import { PaginaDirectorio } from './paginas/Directorio'
import { Entrar } from './paginas/Entrar'
import { NoEncontrada } from './paginas/NoEncontrada'
import { PaginaInicio } from './paginas/PaginaInicio'
import { Registro } from './paginas/Registro'

/**
 * Carga por rutas: el armazón, el Inicio, Aplicaciones, Directorio y el login van en el
 * paquete principal; el resto (gestión y su constructor con dnd-kit, Identidad visual,
 * Clínica, Recursos Humanos, Documentos...) se baja al visitarlo.
 */
const Shell = perezosa(() => import('./components/gestion/Shell'), 'GestionShell')
const Anuncios = perezosa(() => import('./paginas/gestion/Anuncios'), 'PaginaGestionAnuncios')
const Centro = perezosa(() => import('./paginas/gestion/Centro'), 'PaginaCentroGestion')
const GAplicaciones = perezosa(() => import('./paginas/gestion/Aplicaciones'), 'PaginaGestionAplicaciones')
const GBoletines = perezosa(() => import('./paginas/gestion/Boletines'), 'PaginaGestionBoletines')
const Constructor = perezosa(() => import('./paginas/gestion/Constructor'), 'PaginaConstructor')
const GDepartamentos = perezosa(() => import('./paginas/gestion/Departamentos'), 'PaginaGestionDepartamentos')
const GFormularios = perezosa(() => import('./paginas/gestion/Formularios'), 'PaginaGestionFormularios')
const GInicio = perezosa(() => import('./paginas/gestion/Inicio'), 'PaginaGestionInicio')
const GNoticias = perezosa(() => import('./paginas/gestion/Noticias'), 'PaginaGestionNoticias')
const GSolicitudes = perezosa(() => import('./paginas/gestion/Solicitudes'), 'PaginaGestionSolicitudes')
const GSolicitud = perezosa(() => import('./paginas/gestion/Solicitudes'), 'PaginaGestionSolicitud')
const GUsuarios = perezosa(() => import('./paginas/gestion/Usuarios'), 'PaginaGestionUsuarios')
const GVideos = perezosa(() => import('./paginas/gestion/Videos'), 'PaginaGestionVideos')
const Boletin = perezosa(() => import('./paginas/Boletin'), 'PaginaBoletin')
const Boletines = perezosa(() => import('./paginas/Boletines'), 'PaginaBoletines')
const Clinica = perezosa(() => import('./paginas/Clinica'), 'PaginaClinica')
const ClinicaMedicamentos = perezosa(() => import('./paginas/ClinicaMedicamentos'), 'PaginaClinicaMedicamentos')
const ClinicaRecetas = perezosa(() => import('./paginas/ClinicaRecetas'), 'PaginaClinicaRecetas')
const Config = perezosa(() => import('./paginas/Configuracion'), 'Configuracion')
const Comunicacion = perezosa(() => import('./paginas/Comunicacion'), 'PaginaComunicacion')
const GuiaLogo = perezosa(() => import('./paginas/GuiaLogo'), 'PaginaGuiaLogo')
const Documentos = perezosa(() => import('./paginas/Documentos'), 'PaginaDocumentos')
const Formulario = perezosa(() => import('./paginas/Formulario'), 'PaginaFormulario')
const Formularios = perezosa(() => import('./paginas/Formularios'), 'PaginaFormularios')
const MiSolicitud = perezosa(() => import('./paginas/MisSolicitudes'), 'PaginaMiSolicitud')
const MisSolicitudes = perezosa(() => import('./paginas/MisSolicitudes'), 'PaginaMisSolicitudes')
const Manuales = perezosa(() => import('./paginas/Manuales'), 'PaginaManuales')
const MesaServicios = perezosa(() => import('./paginas/MesaServicios'), 'PaginaMesaServicios')
const Noticia = perezosa(() => import('./paginas/Noticia'), 'PaginaNoticia')
const Noticias = perezosa(() => import('./paginas/Noticias'), 'PaginaNoticias')
const Asistente = perezosa(() => import('./paginas/Asistente'), 'PaginaAsistente')
const RecursosHumanos = perezosa(() => import('./paginas/RecursosHumanos'), 'PaginaRecursosHumanos')
const SapIstmo = perezosa(() => import('./paginas/SapIstmo'), 'PaginaSapIstmo')
const Videos = perezosa(() => import('./paginas/Videos'), 'PaginaVideos')

/** Mientras baja la página: corto y anunciado a lectores de pantalla (no tapa el menú ni la barra). */
function Cargando() {
  return (
    <p className="count-note" role="status">
      Cargando…
    </p>
  )
}

/**
 * Los enlaces internos escritos como <a href="/…"> (tarjetas, buscador, barra
 * superior) navegan dentro de la SPA en vez de recargar la página. Se dejan
 * pasar: otra pestaña, descargas, archivos (.pdf, .png…), /api y anclas (#).
 */
function useEnlacesInternos() {
  const navegar = useNavigate()
  useEffect(() => {
    const alClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const u = new URL(a.href, location.href)
      if (u.origin !== location.origin || u.pathname.startsWith('/api/') || esArchivo(u.pathname)) return
      if (u.pathname === location.pathname && u.search === location.search && u.hash) return
      e.preventDefault()
      navegar(u.pathname + u.search + u.hash)
    }
    document.addEventListener('click', alClic)
    return () => document.removeEventListener('click', alClic)
  }, [navegar])
}

/**
 * Al cambiar de página se vuelve arriba y el foco pasa al título, como al cargar
 * una página nueva: así un lector de pantalla anuncia dónde se está. Al abrir el
 * sitio no se mueve (el navegador ya empieza arriba).
 */
function useArribaAlNavegar() {
  const { pathname } = useLocation()
  const primera = useRef(true)
  useEffect(() => {
    window.scrollTo(0, 0)
    if (primera.current) {
      primera.current = false
      return
    }
    // Algunas páginas pintan el título un momento después (esperan datos): se reintenta un rato.
    let intentos = 0
    let t: ReturnType<typeof setTimeout>
    const enfocar = () => {
      const h1 = document.querySelector<HTMLElement>('#contenido h1')
      if (h1) {
        h1.tabIndex = -1
        h1.focus({ preventScroll: true })
      } else if (intentos++ < 20) t = setTimeout(enfocar, 50)
    }
    enfocar()
    return () => clearTimeout(t)
  }, [pathname])
}

// Las de funciones apagadas en esta edición (lib/edicion.ts) no se declaran: dan la página 404.
// El tercer valor, si lo hay, baja la página por adelantado (ver usePrecargaDePaginas).
const RUTAS: [string, React.ComponentType, (() => void)?][] = [
  ['/', PaginaInicio],
  ['/aplicaciones', Aplicaciones],
  ['/mesa-servicios', MesaServicios.Pagina, MesaServicios.precargar],
  ['/sap-istmo', SapIstmo.Pagina, SapIstmo.precargar],
  ['/directorio', PaginaDirectorio],
  ['/noticias', Noticias.Pagina, Noticias.precargar],
  ['/noticias/:id', Noticia.Pagina, Noticia.precargar],
  ['/configuracion', Config.Pagina, Config.precargar],
  ['/documentos', Documentos.Pagina, Documentos.precargar],
  ['/comunicacion', Comunicacion.Pagina, Comunicacion.precargar],
  ['/comunicacion/guia-del-logo', GuiaLogo.Pagina, GuiaLogo.precargar],
  ['/formularios', Formularios.Pagina, Formularios.precargar],
  ['/formularios/:slug', Formulario.Pagina, Formulario.precargar],
  ['/manuales', Manuales.Pagina, Manuales.precargar],
  ['/boletines', Boletines.Pagina, Boletines.precargar],
  ['/boletines/:id', Boletin.Pagina, Boletin.precargar],
  ['/videos', Videos.Pagina, Videos.precargar],
  ['/recursos-humanos', RecursosHumanos.Pagina, RecursosHumanos.precargar],
  ['/clinica', Clinica.Pagina, Clinica.precargar],
  ['/clinica-recetas', ClinicaRecetas.Pagina, ClinicaRecetas.precargar],
  ['/clinica-medicamentos', ClinicaMedicamentos.Pagina, ClinicaMedicamentos.precargar],
  ['/gestion', Centro.Pagina, Centro.precargar],
  ['/gestion/anuncios', Anuncios.Pagina, Anuncios.precargar],
  ['/gestion/noticias', GNoticias.Pagina, GNoticias.precargar],
  ['/gestion/boletines', GBoletines.Pagina, GBoletines.precargar],
  ['/gestion/videos', GVideos.Pagina, GVideos.precargar],
  ['/gestion/inicio', GInicio.Pagina, GInicio.precargar],
  ['/mis-solicitudes', MisSolicitudes.Pagina, MisSolicitudes.precargar],
  ['/mis-solicitudes/:id', MiSolicitud.Pagina, MiSolicitud.precargar],
  ['/gestion/solicitudes', GSolicitudes.Pagina, GSolicitudes.precargar],
  ['/gestion/solicitudes/:id', GSolicitud.Pagina, GSolicitud.precargar],
  ['/gestion/formularios', GFormularios.Pagina, GFormularios.precargar],
  ['/gestion/formularios/:id', Constructor.Pagina, Constructor.precargar],
  ['/gestion/usuarios', GUsuarios.Pagina, GUsuarios.precargar],
  ['/gestion/departamentos', GDepartamentos.Pagina, GDepartamentos.precargar],
  ['/gestion/aplicaciones', GAplicaciones.Pagina, GAplicaciones.precargar],
]

/** Al pasar el mouse o el foco por un enlace a una página que se baja al visitarla, se pide ya. */
function usePrecargaDePaginas() {
  useEffect(() => {
    const pedir = (e: Event) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="/"]') as HTMLAnchorElement | null
      if (!a) return
      RUTAS.find(([patron, , precargar]) => precargar && matchPath(patron, a.pathname))?.[2]?.()
      if (a.pathname === '/asistente') Asistente.precargar()
      else if (a.pathname.startsWith('/gestion')) Shell.precargar()
    }
    document.addEventListener('pointerover', pedir, { passive: true })
    document.addEventListener('focusin', pedir)
    return () => {
      document.removeEventListener('pointerover', pedir)
      document.removeEventListener('focusin', pedir)
    }
  }, [])
}

function Sitio() {
  const { usuario, favoritos, sinConexion, sesionVencida } = useDatos()
  const indice = useIndiceBusqueda()
  useEnlacesInternos()
  useArribaAlNavegar()
  usePrecargaDePaginas()
  useEffect(limpiarMarcaDeRecarga, [])
  const { pathname, search } = useLocation()
  // Sin departamento no se entra a la intranet: se vuelve al login, que se lo pide (obligatorio).
  if (usuario && usuario.departamentoId == null && pathname !== '/entrar' && pathname !== '/registro') {
    return <Navigate to="/entrar" replace state={{ volver: pathname + search }} />
  }
  // El login y el registro son páginas propias, sin menú ni barra: lo único a la vista es entrar o crear la cuenta.
  if (pathname === '/entrar') return <Entrar />
  if (pathname === '/registro') return <Registro />
  // El asistente ocupa la pantalla entera, como un chat: sin menú ni barra (tiene su propio «Volver»).
  if (pathname === '/asistente') {
    return (
      <Proveedores key={String(usuario?.id ?? 'anonimo')} favoritosDefecto={favoritos}>
        <Suspense fallback={<Cargando />}>
          <Asistente.Pagina />
        </Suspense>
      </Proveedores>
    )
  }

  // La gestión es otra página, como el asistente: su propia barra azul con todas las secciones (components/gestion/Shell).
  if (pathname === '/gestion' || pathname.startsWith('/gestion/')) {
    return (
      <Proveedores key={String(usuario?.id ?? 'anonimo')} favoritosDefecto={favoritos}>
        <Suspense fallback={<Cargando />}>
          <Shell.Pagina usuario={usuario} sinConexion={sinConexion} sesionVencida={sesionVencida}>
            <Suspense fallback={<Cargando />}>
              <Routes>
                {RUTAS.filter(([ruta]) => ruta.startsWith('/gestion') && rutaVisible(ruta)).map(([ruta, Pagina]) => (
                  <Route key={ruta} path={ruta} element={<Pagina />} />
                ))}
                <Route path="*" element={<NoEncontrada />} />
              </Routes>
            </Suspense>
          </Shell.Pagina>
        </Suspense>
      </Proveedores>
    )
  }

  return (
    <>
      <a className="sr-only" href="#contenido">Saltar al contenido</a>
      <Proveedores key={String(usuario?.id ?? 'anonimo')} favoritosDefecto={favoritos}>
        <div className="app-shell">
          <Sidebar usuario={usuario} />
          <div className="app-main">
            <Topbar indice={indice} usuario={usuario} />
            <main className="app-content" id="contenido">
              {sinConexion && (
                <div className="notice notice--warn" role="alert">
                  <span className="ic" aria-hidden="true">⚠</span>
                  <p>No se pudo conectar con el servidor de la intranet. Algunas secciones pueden verse vacías; inténtalo de nuevo en unos minutos.</p>
                </div>
              )}
              {sesionVencida && (
                <div className="notice notice--warn" role="alert">
                  <span className="ic" aria-hidden="true">⚠</span>
                  <p>
                    Tu sesión venció y el último cambio no se guardó. <EnlaceEntrar>Vuelve a iniciar sesión</EnlaceEntrar> para seguir.
                  </p>
                </div>
              )}
              {/* La página crece y empuja el pie hasta abajo, aunque tenga poco contenido. */}
              <div className="app-content__pagina">
                <Suspense fallback={<Cargando />}>
                  <Routes>
                    {RUTAS.filter(([ruta]) => rutaVisible(ruta)).map(([ruta, Pagina]) => (
                      <Route key={ruta} path={ruta} element={<Pagina />} />
                    ))}
                    <Route path="*" element={<NoEncontrada />} />
                  </Routes>
                </Suspense>
              </div>
              <Pie />
            </main>
          </div>
        </div>
        <BarraInferior />
      </Proveedores>
    </>
  )
}

export function App() {
  return (
    <ProveedorDatos>
      <Sitio />
      <RecorridoRaiz />
    </ProveedorDatos>
  )
}
