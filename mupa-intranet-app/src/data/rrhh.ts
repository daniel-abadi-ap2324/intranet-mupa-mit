import { activa } from '../lib/edicion'

/**
 * Recursos Humanos: lo que muestra su pestaña. La Clínica Municipal no va aquí: tiene su propio lugar en el menú. Los datos de cada persona (marcaciones,
 * tiempo compensatorio, comprobantes, expediente) vienen de RRHH Express cuando conecta
 * su cuenta. Debajo van dos bloques: «Información» (solo para leer) y «Cómo solicitar»
 * (dónde se pide cada trámite). Lo que todavía no existe (sin archivo ni contenido) va con
 * `h: null` y se ve como «Próximamente»: nunca un enlace ni un texto inventado.
 */

/** Tus datos laborales cuando el servidor no tiene RRHH Express (RRHH_API_URL): sin datos. */
export const DATOS_LABORALES = ['Vacaciones disponibles', 'Próximo pago', 'Horas de capacitación', 'Antigüedad']

/** Las pestañas de RRHH Express, en el orden en que se ven (?seccion= en la dirección). */
export const SECCIONES_RRHH = [
  { v: 'marcaciones', t: 'Marcaciones' },
  { v: 'compensatorio', t: 'Tiempo compensatorio' },
  { v: 'comprobantes', t: 'Comprobantes de pago' },
  { v: 'expediente', t: 'Mi expediente' },
] as const
export type SeccionRrhh = (typeof SECCIONES_RRHH)[number]['v']

/**
 * Una fila de «Información» o de «Cómo solicitar». `h: null` = «Próximamente», sin enlace.
 * `seccion`: se abre en esa pestaña de RRHH Express; si el servidor no tiene RRHH Express,
 * queda «Próximamente» (o no se muestra, con `soloConRrhh`). `etiqueta`: aviso corto a la derecha.
 */
export type ItemRrhh = { t: string; accion?: string; meta: string; g: string; color?: string; h: string | null; etiqueta?: string; seccion?: SeccionRrhh; soloConRrhh?: boolean }

/** Solo para leer. Lo que aún no tiene archivo o contenido real queda en «Próximamente». */
const INFORMACION_COMPLETA: ItemRrhh[] = [
  // Vigencia confirmada por Daniel (21-oct-2026).
  {
    t: 'Reglamento Interno',
    meta: 'Decreto Alcaldicio N.° 024-2019',
    g: '▣',
    h: '/sitio/2020/06/Reglamento-Interno-de-Personal-Decreto-024-2019.pdf',
  },
  { t: 'Código de Ética', meta: '2023', g: '▣', color: 'morado', h: '/sitio/2023/01/CODIGO-DE-ETICA01.pdf' },
  { t: 'Bienestar', meta: 'Información de Bienestar', g: '✦', color: 'lima', h: null },
  { t: 'Equiparación de Oportunidades', meta: 'Formularios', g: '◧', color: 'cian', h: null },
]

/** Sin las filas «Próximamente» cuando la edición las apaga (lib/edicion.ts: `proximamente`). */
export const INFORMACION_RRHH: ItemRrhh[] = activa('proximamente') ? INFORMACION_COMPLETA : INFORMACION_COMPLETA.filter((s) => s.h)

/**
 * «Cómo solicitar»: RRHH ya maneja sus trámites como siempre y no quiere cambiarlos (5-oct-2026), así que
 * la intranet solo dice dónde se pide cada cosa. Con `h` o `seccion` la fila lleva a donde se hace; sin ellos
 * es solo información (no se inventan pasos, documentos ni plazos: para eso, el contacto de RRHH).
 */
/**
 * Trámites que no llevan a ninguna página: se piden directamente en RRHH. Van como texto simple (sin ícono ni recuadro),
 * no como filas que parecen enlaces. El contacto va debajo, en la página.
 */
export const SE_SOLICITAN_EN_RRHH = ['Carta de trabajo', 'Certificación laboral', 'Vacaciones', 'Permiso personal', 'Corrección de marcación']

/** Solo lo que de verdad lleva a algún lado: el PDF del ACH y las pestañas de RRHH Express (si el servidor las tiene). */
export const COMO_SOLICITAR_RRHH: ItemRrhh[] = [
  { t: 'Afiliación a pagos por ACH', meta: 'Formato para acreditar tu salario', g: '◧', color: 'lima', h: '/sitio/2023/01/Afiliacion_a_Pagos_por_ACH_Funcionarios.pdf' },
  { t: 'Talonario de pago', accion: 'Ver talonario de pago', meta: 'Tus comprobantes de pago, en RRHH Express', g: '▥', h: null, seccion: 'comprobantes', soloConRrhh: true },
  { t: 'Tiempo compensatorio', accion: 'Pedir tiempo compensatorio', meta: 'Tu saldo y tus solicitudes, en RRHH Express', g: '◷', color: 'cian', h: null, seccion: 'compensatorio', soloConRrhh: true },
]
