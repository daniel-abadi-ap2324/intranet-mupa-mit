import type { NextFunction, Request, Response } from 'express'

/**
 * Cabeceras de seguridad de la intranet, para TODAS las respuestas (la SPA, sus archivos y la API). Antes las ponía
 * nginx (mupa-intranet-app/nginx/seguridad.conf, que sigue usando `npm run preview`): si cambias una, cambia las dos.
 *
 * CSP: todo sale del propio sitio. 'unsafe-inline' en estilos solo por atributos style="" de algunos componentes.
 * HSTS no va aquí: lo pone quien termine HTTPS (el proxy de IT).
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

/**
 * Lo que cambia para los ARCHIVOS que la intranet muestra dentro de sus propias páginas (el lector de boletines pone
 * el PDF en un <iframe>): /api/files/… y los PDF de /sitio/. Solo la propia intranet puede enmarcarlos, y sin
 * default-src ni object-src (el visor de PDF del navegador es un plugin y esa política lo bloquea). Es seguro porque
 * esas rutas solo sirven PDF e imágenes, con nosniff.
 */
export const FILE_FRAME_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "frame-ancestors 'self'",
  'X-Frame-Options': 'SAMEORIGIN',
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.set(SECURITY_HEADERS)
  next()
}
