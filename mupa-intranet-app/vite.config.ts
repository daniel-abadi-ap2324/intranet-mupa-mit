import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite'

const aqui = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/** Cabeceras de seguridad de nginx (nginx/seguridad.conf): `npm run preview` sirve dist/ con las mismas. */
function cabecerasNginx(): Record<string, string> {
  const txt = fs.readFileSync(aqui('./nginx/seguridad.conf'), 'utf8')
  return Object.fromEntries([...txt.matchAll(/^\s*add_header\s+([\w-]+)\s+"([^"]*)"/gm)].map((m) => [m[1], m[2]]))
}

/** Las de nginx/seguridad-archivos.conf (PDF e imágenes que se enmarcan en la propia intranet). */
function cabecerasArchivos(): Record<string, string> {
  const txt = fs.readFileSync(aqui('./nginx/seguridad-archivos.conf'), 'utf8')
  return Object.fromEntries([...txt.matchAll(/^\s*add_header\s+([\w-]+)\s+"([^"]*)"/gm)].map((m) => [m[1], m[2]]))
}

/** `npm run preview`: a /api/files/… y a los PDF les pone las cabeceras de archivos, como hace nginx. */
const cabecerasDeArchivos: Plugin = {
  name: 'cabeceras-de-archivos',
  configurePreviewServer(server) {
    const archivos = cabecerasArchivos()
    server.middlewares.use((req, res, next) => {
      if (/^\/api\/files\//.test(req.url ?? '') || /\.pdf(\?|$)/i.test(req.url ?? '')) {
        const writeHead = res.writeHead.bind(res)
        res.writeHead = ((...args: Parameters<typeof res.writeHead>) => {
          for (const [k, v] of Object.entries(archivos)) res.setHeader(k, v)
          return writeHead(...args)
        }) as typeof res.writeHead
      }
      next()
    })
  },
}

/**
 * - `npm run dev`: SPA en http://localhost:5173.
 * - /api se reenvía al backend (../mupa-intranet-api, `npm run dev` ahí), igual
 *   que hace nginx en producción. Otro backend: API_URL=http://… en .env.local.
 */
export default defineConfig(({ mode }) => {
  const API_URL = process.env.API_URL || loadEnv(mode, process.cwd(), '').API_URL || 'http://localhost:3000'
  const proxy: Record<string, ProxyOptions> = { '/api': { target: API_URL, changeOrigin: true } }
  return {
    plugins: [react(), cabecerasDeArchivos],
    resolve: { alias: { '@': aqui('./src') } },
    server: { port: 5173, strictPort: true, proxy },
    preview: { port: 4173, strictPort: true, proxy, headers: cabecerasNginx() },
    build: { outDir: 'dist', sourcemap: false },
  }
})
