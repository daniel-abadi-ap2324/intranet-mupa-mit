import { z } from 'zod'

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

/**
 * Enlace que se publica en la intranet. Regla del proyecto: nunca una IP ni un
 * nombre interno (solo nombres con dominio). Vacío = sin enlace (null). También
 * se acepta una página de la intranet que empiece con "/".
 */
function linkDto({ allowHttp, allowInternal = false }: { allowHttp: boolean; allowInternal?: boolean }) {
  return z
    .string()
    .trim()
    .max(500)
    .superRefine((url, ctx) => {
      // El navegador lee "/\otro-sitio" como "//otro-sitio": saldría de la intranet sin pasar por las reglas de abajo.
      if (url.includes('\\')) {
        ctx.addIssue({ code: 'custom', message: 'La dirección no puede tener barras invertidas (\\).' })
        return
      }
      if (!url || (url.startsWith('/') && !url.startsWith('//'))) return
      let u: URL
      try {
        u = new URL(url)
      } catch {
        ctx.addIssue({ code: 'custom', message: 'La dirección debe empezar con https:// (o ser una página de la intranet, empezando con /).' })
        return
      }
      const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
      if (u.protocol !== 'https:' && !(allowHttp && u.protocol === 'http:')) {
        ctx.addIssue({ code: 'custom', message: allowHttp ? 'Solo se aceptan direcciones http:// o https://.' : 'La dirección debe empezar con https://.' })
      } else if (allowInternal) {
        // Aplicaciones «Solo red interna»: pueden llevar una IP o un nombre interno (el servicio exige ese estado).
      } else if (IPV4.test(host) || host.includes(':')) {
        ctx.addIssue({ code: 'custom', message: 'No se permiten direcciones IP. Usa el nombre del sistema (por ejemplo sistema.mupa.gob.pa).' })
      } else if (host === 'localhost' || !host.includes('.') || host.endsWith('.') || host.endsWith('.local')) {
        ctx.addIssue({ code: 'custom', message: 'Esa dirección es un nombre interno. Usa el nombre completo del sistema (por ejemplo sistema.mupa.gob.pa).' })
      }
    })
    .transform((url) => url || null)
}

/** Catálogo: acepta http porque algunos sistemas de la Alcaldía todavía no tienen https (p. ej. cdr). */
export const urlDto = linkDto({ allowHttp: true })

/**
 * Aplicaciones del catálogo: además admite una IP o un nombre interno, pero solo para las marcadas
 * «Solo red interna» (que solo abren dentro de la Alcaldía): ApplicationsService lo exige.
 */
export const appUrlDto = linkDto({ allowHttp: true, allowInternal: true })

/** ¿La dirección apunta a una IP o a un nombre interno (sin dominio, localhost, .local)? Las rutas de la intranet («/…») no. */
export function isInternalAddress(url: string): boolean {
  if (!url || url.startsWith('/')) return false
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '')
    return IPV4.test(host) || host.includes(':') || host === 'localhost' || !host.includes('.') || host.endsWith('.') || host.endsWith('.local')
  } catch {
    return false
  }
}

/** Anuncios: los ve todo el personal, así que solo https. */
export const httpsUrlDto = linkDto({ allowHttp: false })
