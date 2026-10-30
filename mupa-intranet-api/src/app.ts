import express, { Router } from 'express'

import { env } from './config/env.ts'
import { announcementsRoutes } from './features/announcements/announcements.routes.ts'
import { applicationsRoutes } from './features/applications/applications.routes.ts'
import { auditRoutes } from './features/audit/audit.routes.ts'
import { assistantRoutes } from './features/assistant/assistant.routes.ts'
import { authenticate } from './features/auth/auth.middleware.ts'
import { authRoutes } from './features/auth/auth.routes.ts'
import { bulletinsRoutes } from './features/bulletins/bulletins.routes.ts'
import { callCodesRoutes } from './features/call-codes/call-codes.routes.ts'
import { clinicRoutes } from './features/clinic/clinic.routes.ts'
import { departmentsRoutes } from './features/departments/departments.routes.ts'
import { directoryRoutes } from './features/directory/directory.routes.ts'
import { filesRoutes } from './features/files/files.routes.ts'
import { formsRoutes } from './features/forms/forms.routes.ts'
import { gestionRoutes } from './features/gestion/gestion.routes.ts'
import { healthRoutes } from './features/health/health.routes.ts'
import { homeRoutes } from './features/home/home.routes.ts'
import { metaRoutes } from './features/meta/meta.routes.ts'
import { newsRoutes } from './features/news/news.routes.ts'
import { notificationsRoutes } from './features/notifications/notifications.routes.ts'
import { registrationRoutes } from './features/registration/registration.routes.ts'
import { requestsRoutes } from './features/requests/requests.routes.ts'
import { rrhhRoutes } from './features/rrhh/rrhh.routes.ts'
import { summaryRoutes } from './features/summary/summary.routes.ts'
import { tagsRoutes } from './features/tags/tags.routes.ts'
import { meRoutes, usersRoutes } from './features/users/users.routes.ts'
import { videosRoutes } from './features/videos/videos.routes.ts'
import { wordpressSyncRoutes } from './features/wordpress-sync/wordpress-sync.routes.ts'
import { glpiRoutes } from './features/glpi/glpi.routes.ts'
import { DomainError } from './shared/errors/domain-error.ts'
import { registerMount } from './shared/route-registry.ts'
import { errorHandler } from './shared/middlewares/error-handler.middleware.ts'
import { securityHeaders } from './shared/middlewares/security-headers.middleware.ts'
import { staticSite } from './shared/middlewares/static-site.middleware.ts'

/**
 * API de la intranet. Todo cuelga de /api. En producción la misma API sirve también la web (la SPA compilada, en
 * `publicDir`: PUBLIC_DIR, que pone la imagen de Docker): mismo origen, sin CORS. Sin esa carpeta (`npm run dev`, las
 * pruebas) solo responde /api.
 */
export function createApp(options: { publicDir?: string } = { publicDir: env.PUBLIC_DIR }) {
  const app = express()
  app.disable('x-powered-by')
  // Solo si hay un proxy delante (el nginx del servidor): entonces la IP y el protocolo reales vienen en X-Forwarded-*.
  // Sin proxy, confiar en esas cabeceras dejaría que cualquiera cambie su IP y se salte los límites por IP del login.
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY)
  app.use(securityHeaders)
  app.use(express.json({ limit: '100kb' }))

  const api = Router()
  // Montar un router y dejarlo anotado en el registro (lo lee features/meta para describir los endpoints).
  const mount = (path: string, router: Router) => {
    registerMount('/api' + path, router)
    api.use(path, router)
  }
  // Las respuestas llevan datos de la persona: nunca en caché.
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  mount('/health', healthRoutes)
  // Antes de `authenticate`: registro, login, refresh y logout no la llevan (cada ruta de auth decide).
  mount('/auth/register', registrationRoutes)
  mount('/auth', authRoutes)
  // Desde aquí, todas las rutas saben quién pide (req.user), con cookie o con Bearer.
  api.use(authenticate)
  mount('/applications', applicationsRoutes)
  mount('/tags', tagsRoutes)
  mount('/home', homeRoutes)
  mount('/assistant', assistantRoutes)
  mount('/departments', departmentsRoutes)
  mount('/directory', directoryRoutes)
  mount('/users', usersRoutes)
  mount('/me/summary', summaryRoutes)
  mount('/me', meRoutes)
  mount('/clinic', clinicRoutes)
  // Solicitudes de código de llamada de la propia persona (sistema independiente, por su cédula): en las dos ediciones.
  mount('/call-codes', callCodesRoutes)
  // Tickets de la Mesa de Ayuda (GLPI) de la propia persona (por su cédula en «Teléfono»): en las dos ediciones.
  mount('/glpi', glpiRoutes)
  // Boletines (y los archivos donde Comunicación sube sus PDF): también en la edición publicación.
  mount('/files', filesRoutes)
  mount('/bulletins', bulletinsRoutes)
  // Auditoría de eventos: en las dos ediciones (guardar eventos no depende de lo que se ve).
  mount('/audit', auditRoutes)
  // Centro de Gestión: en las dos ediciones (en publicación trae solo lo que está encendido).
  mount('/gestion', gestionRoutes)
  // RRHH Express (marcaciones, comprobantes, expediente, compensatorio de la propia persona): en las dos ediciones.
  mount('/rrhh', rrhhRoutes)
  // Noticias (en las dos ediciones: llegan solas de mupa.gob.pa) y su sincronización, con la de los boletines.
  mount('/news', newsRoutes)
  mount('/wordpress-sync', wordpressSyncRoutes)
  // Catálogo de endpoints para el servidor MCP (llave interna; sin MCP_INTERNAL_KEY no existe).
  mount('/meta', metaRoutes)
  // Lo que todavía nadie alimenta o no está conectado a un sistema real: en la edición publicación no existe (404), ni para leer.
  if (env.EDICION === 'completa') {
    // Formularios y solicitudes internas (se llenan y se guardan en la intranet) con su bandeja de gestión, y los avisos en
    // vivo (SSE) de las solicitudes nuevas. Apagados en la edición publicación; se reactivan en src/lib/edicion.ts de la web y con EDICION=completa.
    mount('/forms', formsRoutes)
    mount('/requests', requestsRoutes)
    mount('/notifications', notificationsRoutes)
    mount('/announcements', announcementsRoutes)
    mount('/videos', videosRoutes)
  }
  app.use('/api', api)

  // La web: archivos en la raíz del sitio y la SPA para las demás rutas (nunca /api/…).
  const site = staticSite(options.publicDir)
  if (site) app.use(site)

  app.use((_req, _res, next) => next(new DomainError('La ruta no existe.', 404, 'ROUTE_NOT_FOUND')))
  app.use(errorHandler)
  return app
}

export const app = createApp()
