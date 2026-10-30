import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import zlib from 'node:zlib'

import express, { Router, type Response } from 'express'

import { FILE_FRAME_HEADERS } from './security-headers.middleware.ts'

const brotli = promisify(zlib.brotliCompress)
const gzip = promisify(zlib.gzip)

/** Texto que se sirve comprimido (JS, CSS, SVG…): el sitio pesa un tercio y los logos SVG, la mitad de la mitad. */
const COMPRIMIBLES = new Set(['.js', '.mjs', '.css', '.svg', '.json', '.txt', '.xml', '.webmanifest'])
const TIPOS: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

/**
 * La web (la SPA compilada por Vite) servida por la propia API, como hacía nginx: los archivos de `publicDir` en la
 * raíz del sitio y, para cualquier otra ruta sin extensión, index.html (el router de React decide qué mostrar,
 * incluida «Página no encontrada»). Nunca toca /api/… (sus 404 siguen siendo JSON).
 *
 * Devuelve null si la carpeta no existe (en `npm run dev` y en las pruebas la web la sirve Vite).
 */
export function staticSite(publicDir: string | undefined): Router | null {
  if (!publicDir) return null
  const root = path.resolve(publicDir)
  const index = path.join(root, 'index.html')
  if (!fs.existsSync(index)) return null

  const serveFiles = express.static(root, {
    index: false,
    redirect: false,
    // Nunca archivos ocultos (.env, .git…), aunque se colaran en la imagen.
    dotfiles: 'ignore',
    setHeaders: (res: Response, file: string) => {
      const rel = '/' + path.relative(root, file).split(path.sep).join('/')
      if (rel === '/index.html') res.set('Cache-Control', 'no-cache')
      // JS y CSS de Vite: llevan hash en el nombre, no cambian nunca.
      else if (rel.startsWith('/assets/')) res.set('Cache-Control', 'public, max-age=31536000, immutable')
      else res.set('Cache-Control', 'public, max-age=86400')
      // Los PDF de /sitio/ (boletines y manuales) también se leen dentro de la intranet.
      if (rel.toLowerCase().endsWith('.pdf')) res.set(FILE_FRAME_HEADERS)
    },
  })

  // Cada archivo se comprime una sola vez (brotli y gzip) y se guarda en memoria mientras no cambie en disco.
  const comprimidos = new Map<string, { clave: string; br: Promise<Buffer>; gz: Promise<Buffer> }>()
  const cabecerasDe = (res: Response, rel: string) => {
    if (rel.startsWith('/assets/')) res.set('Cache-Control', 'public, max-age=31536000, immutable')
    else res.set('Cache-Control', 'public, max-age=86400')
  }
  const servirComprimido = async (req: express.Request, res: Response, next: express.NextFunction) => {
    try {
      const ext = path.extname(req.path).toLowerCase()
      if ((req.method !== 'GET' && req.method !== 'HEAD') || !COMPRIMIBLES.has(ext) || req.path.split('/').some((s) => s.startsWith('.'))) return next()
      const acepta = String(req.headers['accept-encoding'] ?? '')
      const codificacion = /\bbr\b/.test(acepta) ? 'br' : /\bgzip\b/.test(acepta) ? 'gzip' : null
      if (!codificacion) return next()
      const archivo = path.join(root, decodeURIComponent(req.path))
      if (!archivo.startsWith(root + path.sep)) return next()
      const st = await fs.promises.stat(archivo).catch(() => null)
      if (!st?.isFile()) return next()
      const clave = `${st.mtimeMs}-${st.size}`
      let c = comprimidos.get(archivo)
      if (!c || c.clave !== clave) {
        const datos = fs.promises.readFile(archivo)
        c = { clave, br: datos.then((d) => brotli(d, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } })), gz: datos.then((d) => gzip(d, { level: 9 })) }
        comprimidos.set(archivo, c)
      }
      const etag = `W/"${clave}-${codificacion}"`
      res.set({ 'Content-Type': TIPOS[ext], 'Content-Encoding': codificacion, Vary: 'Accept-Encoding', ETag: etag })
      cabecerasDe(res, '/' + path.relative(root, archivo).split(path.sep).join('/'))
      if (req.headers['if-none-match'] === etag) return void res.status(304).end()
      const cuerpo = await (codificacion === 'br' ? c.br : c.gz)
      res.set('Content-Length', String(cuerpo.length))
      res.status(200).end(req.method === 'HEAD' ? undefined : cuerpo)
    } catch (e) {
      next(e)
    }
  }

  const isApi = (p: string) => p === '/api' || p.startsWith('/api/')
  // /.env, /.git/…: 404, ni el archivo ni la SPA.
  const isHidden = (p: string) => p.split('/').some((s) => s.startsWith('.'))
  const router = Router()

  router.use((req, res, next) => (isApi(req.path) ? next() : void servirComprimido(req, res, (e?: unknown) => (e ? next(e) : serveFiles(req, res, next)))))

  // Lo que no es un archivo: GET/HEAD de una ruta sin extensión → la SPA. Con extensión y sin archivo → 404 de verdad.
  router.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || isApi(req.path) || isHidden(req.path) || path.extname(req.path)) return next()
    // index.html siempre se revalida: así cada despliegue se ve de inmediato.
    res.set('Cache-Control', 'no-cache')
    res.sendFile(index)
  })

  return router
}
