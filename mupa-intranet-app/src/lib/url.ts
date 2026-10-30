/**
 * Revisión de direcciones del catálogo. Regla del proyecto: nunca una IP ni un
 * nombre interno (solo nombres públicos con dominio). Se usa en el panel
 * (validate del campo) y en el seed.
 */

export type RevisionUrl = { error: string; aviso: string }

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

/** soloHttps: para lo que ve todo el personal (anuncios). El catálogo acepta http con un aviso, porque hay sistemas sin https. */
export function revisarUrl(entrada: string | null | undefined, { soloHttps = false } = {}): RevisionUrl {
  const url = String(entrada ?? '').trim()
  const r: RevisionUrl = { error: '', aviso: '' }
  // El navegador lee "/\otro-sitio" como "//otro-sitio": saldría de la intranet sin pasar por las reglas de abajo.
  if (url.includes('\\')) {
    r.error = 'La dirección no puede tener barras invertidas (\\).'
    return r
  }
  // Sin enlace, o una página de esta intranet (empieza con "/").
  if (!url || (url.startsWith('/') && !url.startsWith('//'))) return r

  let u: URL
  try {
    u = new URL(url)
  } catch {
    r.error = 'La dirección debe empezar con https:// (o ser una página de la intranet, empezando con /).'
    return r
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (u.protocol !== 'https:' && !(!soloHttps && u.protocol === 'http:')) {
    r.error = soloHttps ? 'La dirección debe empezar con https://.' : 'Solo se aceptan direcciones http:// o https://.'
  } else if (IPV4.test(host) || host.includes(':')) {
    r.error = 'No se permiten direcciones IP. Usa el nombre del sistema (por ejemplo sistema.mupa.gob.pa).'
  } else if (host === 'localhost' || !host.includes('.') || host.endsWith('.') || host.endsWith('.local')) {
    r.error = 'Esa dirección es un nombre interno. Usa el nombre completo del sistema (por ejemplo sistema.mupa.gob.pa).'
  } else if (u.protocol === 'http:') {
    r.aviso = 'La dirección usa http (sin cifrado). Si el sistema tiene https, conviene usarlo.'
  }
  return r
}

/** true si el enlace sale de la intranet (se abre en otra pestaña). */
export function esExterna(h: string | null | undefined): boolean {
  return /^https?:\/\//i.test(String(h ?? ''))
}

/** true si la ruta apunta a un archivo (.pdf, .png…): se abre con el navegador, no con el router de la SPA. */
/**
 * Miniatura WebP de una imagen de /sitio/ (scripts/generar-miniaturas-web.py): la que se ve en la
 * rejilla; el original sigue en su lugar. Ej.: /sitio/2023/02/foto.jpg -> /sitio/miniaturas-web/2023/02/foto.webp
 */
export function miniaturaWeb(ruta: string): string {
  return ruta.replace(/^\/sitio\//, '/sitio/miniaturas-web/').replace(/\.[a-z]+$/i, '.webp')
}

export function esArchivo(h: string | null | undefined): boolean {
  return /\.[a-z0-9]{2,5}$/i.test(String(h ?? '').split(/[?#]/)[0])
}

/** Solo http/https; devuelve la dirección normalizada o null. */
export function urlSegura(entrada: unknown): string | null {
  try {
    const u = new URL(String(entrada ?? '').trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

/**
 * A dónde volver después de iniciar sesión: solo una página de esta intranet
 * ("/…", nunca "//otro-sitio" ni el propio /entrar). Si no sirve, al Inicio.
 */
export function destinoSeguro(volver: unknown): string {
  if (typeof volver !== 'string' || !volver.startsWith('/') || volver.startsWith('//') || volver.startsWith('/\\')) return '/'
  return volver.split(/[?#]/)[0] === '/entrar' ? '/' : volver
}
