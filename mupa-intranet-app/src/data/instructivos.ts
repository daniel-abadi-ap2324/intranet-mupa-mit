/**
 * Videos instructivos de la Mesa de Servicios, copiados al sitio (public/sitio/2024/08/).
 * Se muestran en la Mesa de Servicios y en Documentos aunque la sección Videos
 * (que maneja Comunicación) esté apagada en esta edición.
 */
// Título y duración reales de cada parte (la duración se midió sobre los MP4).
const PARTES = [
  { titulo: 'Iniciar sesión como administrador', duracion: '1:10' },
  { titulo: 'Restablecer la contraseña', duracion: '1:01' },
  { titulo: 'Verificar el acceso', duracion: '0:54' },
]

export const INSTRUCTIVOS = [1, 2, 3].map((n) => ({
  id: n,
  /** «Parte n» (la lista del video en 3 partes de la Mesa de Servicios). */
  parte: 'Parte ' + n,
  /** Lo que se hace en esta parte y lo que dura (m:ss). */
  titulo: PARTES[n - 1].titulo,
  duracion: PARTES[n - 1].duracion,
  t: 'Restablecer usuario de máquina — Parte ' + n,
  meta: 'Mesa de Servicios · MP4',
  h: `/sitio/2024/08/parte${n}.mp4`,
  /** Fotograma de portada en WebP (scripts/generar-miniaturas-web.py). */
  portada: `/sitio/miniaturas-web/2024/08/parte${n}.webp`,
}))
