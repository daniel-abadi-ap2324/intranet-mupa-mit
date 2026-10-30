/**
 * Recorrido para usuarios nuevos: qué pasos se muestran y cuándo aparece solo.
 * Lógica pura; la pantalla está en components/recorrido/Recorrido.tsx.
 * Corto, un paso a la vez sobre las partes reales de la pantalla, como recomiendan NN/g y Fluent 2.
 * Si una parte no está a la vista, su paso se salta. El tramo del asistente lleva de verdad a /asistente,
 * escribe una pregunta de ejemplo y la envía; si el asistente no está disponible, ese tramo se omite.
 */
import { activa } from './edicion'


/** Clave en el navegador: la fecha en que se vio (o se saltó) el recorrido. */
export const LS_RECORRIDO = 'mupa_recorrido'

export type Paso = {
  id: string
  /** Selector de la parte que se resalta; null = tarjeta al centro (la bienvenida). */
  objetivo: string | null
  titulo: string
  texto: string
  /** Página donde ocurre el paso (por defecto el Inicio, '/'). El recorrido navega solo hasta ahí. */
  ruta?: string
  /** 'asistente-escribir': la persona usa el ejemplo o escribe la suya. 'asistente-respuesta': tarjeta abajo, sin oscurecer. */
  tipo?: 'probar' | 'asistente-escribir' | 'asistente-respuesta'
}

/** Pregunta de ejemplo: está en el conocimiento confirmado del asistente y no lleva datos personales. */
export const PREGUNTA_EJEMPLO = '¿Cuál es la extensión de la Mesa de Servicios?'
export const RUTA_ASISTENTE = '/asistente'

export type ContextoRecorrido = {
  conSesion: boolean
  /** Tiene un panel de gestión (admin, Comunicación o Gestor de Solicitudes). */
  gestion: boolean
  /** Pantalla angosta: el menú lateral no se ve y se llega a él con "Más". */
  movil: boolean
  /** El asistente está disponible (hay modelo). Si no, se omite su tramo. */
  asistente: boolean
}

// Las secciones del menú (lib/menu.ts), según lo que esta edición muestra.
const SECCIONES = activa('noticias')
  ? 'los sistemas (Aplicaciones), el Directorio con teléfonos y extensiones, Documentos, Noticias, Recursos Humanos y la Clínica Municipal'
  : 'los sistemas (Aplicaciones), el Directorio con teléfonos y extensiones, Documentos, Recursos Humanos y la Clínica Municipal'

export function pasosRecorrido(c: ContextoRecorrido): Paso[] {
  const pasos: (Paso | false)[] = [
    {
      id: 'bienvenida',
      objetivo: null,
      titulo: 'Te damos la bienvenida a la nueva intranet',
      texto: 'Aquí encuentras los sistemas, trámites, teléfonos y documentos de la Alcaldía. Te lo mostramos en un minuto; puedes saltarlo y verlo después desde «Ayuda».',
    },
    {
      id: 'buscar',
      objetivo: '.home-search__fila',
      titulo: 'Busca lo que necesitas',
      texto: `Escribe lo que buscas: sistemas, ${activa('formularios') ? 'formularios, ' : ''}personas o documentos. Los resultados salen aquí debajo mientras escribes.`,
    },
    c.asistente
      ? {
          id: 'asistente',
          objetivo: '#topbar a[href="/asistente"]',
          titulo: '¿No sabes qué sistema usar?',
          texto: 'Pregúntale al asistente con tus palabras y te lleva a la página o la aplicación que necesitas. Vamos a probarlo.',
          tipo: 'probar',
        }
      : {
          id: 'asistente',
          objetivo: '#topbar a[href="/asistente"]',
          titulo: 'El asistente',
          texto: 'Aquí le preguntas con tus palabras qué sistema o página usar. Ahora no está disponible; mientras tanto, usa el buscador o llama a la Mesa de Servicios (ext. 1400).',
        },
    c.asistente && {
      id: 'asistente-escribir',
      objetivo: '.asis__caja',
      ruta: RUTA_ASISTENTE,
      titulo: 'Así le preguntas',
      texto: 'Escribe como hablas, sin palabras clave. Usa nuestro ejemplo o escribe tu propia pregunta (sin cédulas ni contraseñas).',
      tipo: 'asistente-escribir',
    },
    c.asistente && {
      id: 'asistente-respuesta',
      objetivo: null,
      ruta: RUTA_ASISTENTE,
      titulo: 'Esta es su respuesta',
      texto: 'Cada respuesta puede traer enlaces a la página, la aplicación o el documento que necesitas: púlsalos para ir directo.',
      tipo: 'asistente-respuesta',
    },
    c.movil
      ? { id: 'menu', objetivo: '.app-menubtn', titulo: 'Todas las secciones', texto: `En «Más» están ${SECCIONES}.` }
      : { id: 'menu', objetivo: '#sidebar .app-nav', titulo: 'Todas las secciones', texto: `Aquí están ${SECCIONES}.` },
    c.conSesion
      ? (activa('formularios') || activa('bandeja')) && { id: 'avisos', objetivo: '.app-notifbtn', titulo: 'Avisos de tus solicitudes', texto: 'La campana te avisa cuando respondan tus solicitudes. Todas están en «Mis solicitudes».' }
      : { id: 'entrar', objetivo: '#topbar .app-entrar', titulo: 'Inicia sesión', texto: `Con tu cédula o tu correo institucional. Así tu Inicio se guarda en tu cuenta${activa('formularios') ? ' y puedes enviar solicitudes' : ''}.` },
    c.gestion && { id: 'gestion', objetivo: '.gest-panel', titulo: 'Tu panel de gestión', texto: 'Desde aquí administras lo que te toca publicar o atender.' },
    {
      id: 'ayuda',
      objetivo: '#ayuda-btn',
      titulo: '¿Te perdiste?',
      texto: 'En «Ayuda» está la Mesa de Servicios (ext. 1400) y puedes repetir este recorrido cuando quieras.',
    },
  ]
  return pasos.filter((p): p is Paso => !!p)
}

/**
 * ¿Aparece solo al abrir el Inicio? Solo si nunca se vio: con sesión, ni en la
 * cuenta ni en este navegador; sin sesión, en este navegador.
 */
export function debeMostrarse(e: { conSesion: boolean; vistoEnCuenta: boolean; vistoEnNavegador: boolean }): boolean {
  if (e.vistoEnNavegador) return false
  return !(e.conSesion && e.vistoEnCuenta)
}
