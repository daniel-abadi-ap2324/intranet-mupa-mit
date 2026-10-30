import { env } from '../../config/env.ts'

/**
 * Lo que el asistente sabe de la intranet además del catálogo de aplicaciones: sus páginas
 * (para mandar a la persona a la correcta) y datos confirmados. Solo va aquí lo que ya está
 * publicado y verificado en el proyecto: nada inventado. Si algo cambia en la web (una página
 * nueva, un teléfono), se actualiza aquí.
 */
export type KnowledgePage = {
  path: string
  title: string
  about: string
  /** Solo existe en la edición completa (en publicación su ruta da 404). */
  completeOnly?: boolean
}

// En la edición publicación no existen los formularios internos ni sus solicitudes:
// el asistente no debe mandar a ellos ni mencionarlos. `completa` es la edición con todo.
const completa = env.EDICION === 'completa'

const PAGES: KnowledgePage[] = [
  { path: '/aplicaciones', title: 'Aplicaciones', about: 'Todos los sistemas y servicios de la Alcaldía (correo, Mesa de Servicios, trámites…), con buscador.' },
  { path: '/directorio', title: 'Directorio', about: 'Extensiones telefónicas y personas por dirección; la central y las extensiones clave. Sale de la central telefónica, se actualiza cada hora y dice cuándo.' },
  { path: '/documentos', title: 'Documentos', about: 'Reglamentos, manuales, procedimientos y permisos en PDF, boletines y videos.' },
  { path: '/manuales', title: 'Manuales', about: 'Manuales e instructivos en PDF.' },
  { path: '/boletines', title: 'Boletines · Alcaldía al día', about: 'Los boletines informativos «Alcaldía al día» en PDF.' },
  { path: '/videos', title: 'Videos', about: 'Videos instructivos (por ejemplo, restablecer el usuario de máquina).', completeOnly: true },
  { path: '/noticias', title: 'Noticias', about: 'Noticias y comunicados institucionales (llegan solas de mupa.gob.pa).' },
  { path: '/formularios', title: 'Formularios de solicitud', about: 'Formularios en línea de accesos y otros trámites. Los trámites de Recursos Humanos (carta de trabajo, certificación, vacaciones, permisos) no van aquí: se piden en Recursos Humanos.', completeOnly: true },
  { path: '/mis-solicitudes', title: 'Mis solicitudes', about: completa ? 'Seguimiento de las solicitudes que hizo la persona: las de los formularios, sus citas de la Clínica, sus solicitudes de código de llamada y sus tickets de la Mesa de Ayuda (GLPI).' : 'Seguimiento de las citas de la Clínica de la persona, sus solicitudes de código de llamada y sus tickets de la Mesa de Ayuda (GLPI), con su estado. Solo de consulta.' },
  { path: '/recursos-humanos', title: 'Recursos Humanos', about: (completa ? 'Documentos (Reglamento Interno, Código de Ética, Bienestar, Equiparación de Oportunidades)' : 'Documentos (Reglamento Interno, Código de Ética)') + ', Cómo solicitar cada trámite (en línea en RRHH Express: talonario de pago y tiempo compensatorio; en persona en RRHH: carta de trabajo, certificación laboral, vacaciones, permiso personal y corrección de marcación), el formato del ACH y contacto de RRHH.' },
  {
    path: '/recursos-humanos?seccion=marcaciones',
    title: 'Mis marcaciones',
    about: 'Calendario del mes con la entrada y salida de cada día, tardanzas, ausencias y feriados. Se ve al conectar la cuenta de RRHH Express.',
  },
  {
    path: '/recursos-humanos?seccion=compensatorio',
    title: 'Tiempo compensatorio',
    about: 'Saldo de tiempo compensatorio y sus solicitudes; desde ahí se pide acreditar un día trabajado de más o usar tiempo. Requiere la cuenta de RRHH Express.',
  },
  {
    path: '/recursos-humanos?seccion=comprobantes',
    title: 'Comprobantes de pago',
    about: 'Talonario: comprobantes de pago, salario, descuentos y resumen del año. Requiere la cuenta de RRHH Express.',
  },
  { path: '/recursos-humanos?seccion=expediente', title: 'Mi expediente', about: 'Datos laborales y personales, formación y dependientes de la persona. Requiere la cuenta de RRHH Express.' },
  { path: '/asistente', title: 'Asistente', about: 'La página del asistente: se le pregunta con las propias palabras y lleva a la página, la aplicación, el boletín' + (completa ? ', la noticia o el formulario' : ' o el documento') + ' que se necesita.' },
  { path: '/clinica', title: 'Clínica Municipal', about: 'Servicios, especialidades y días de atención de la Clínica; cómo pedir cita.' },
  { path: '/clinica-recetas', title: 'Recetas de la Clínica', about: 'Cómo solicitar recetas de medicamentos crónicos.' },
  { path: '/clinica-medicamentos', title: 'Medicamentos de la Clínica', about: 'Listado de medicamentos de la farmacia de la Clínica.' },
  { path: '/comunicacion', title: 'Identidad visual y comunicación', about: 'Logos oficiales (SVG, PNG y PDF), paleta de colores con HEX, RGB y CMYK, tipografías, texturas, manual de marca, plantillas (firma digital, fondos de videollamada y wallpapers), redes sociales oficiales y a quién contactar en Comunicación.' },
  { path: '/comunicacion/guia-del-logo', title: 'Guía rápida de uso del logo', about: 'Qué logo usar, el fondo, tamaños y proporciones, y los errores frecuentes al usar el logo de la Alcaldía.' },
  { path: '/mesa-servicios', title: 'Mesa de Servicios', about: 'Soporte técnico (ext. 1400): solicitudes en línea (código de llamadas, red WIFI), video en 3 partes para restablecer el usuario de máquina, otras extensiones de Tecnología y pedidos de accesos, correo o impresión.' },
  { path: '/configuracion', title: 'Configuración', about: 'La cuenta de la persona, su pantalla de inicio y las cuentas conectadas (RRHH Express). También tiene el botón Cerrar sesión.' },
  {
    path: '/sitio/2020/06/Reglamento-Interno-de-Personal-Decreto-024-2019.pdf',
    title: 'Reglamento Interno de Personal',
    about: 'El Reglamento Interno de Personal (Decreto Alcaldicio N.º 024-2019), en PDF. Su vigencia está confirmada.',
  },
  { path: '/sitio/2023/01/CODIGO-DE-ETICA01.pdf', title: 'Código de Ética', about: 'El Código de Ética de la Alcaldía, en PDF.' },
]

/** Datos confirmados (los mismos que muestra la intranet). Otros datos de contacto solo del directorio o de mupa.gob.pa (assistant.service.ts). */
const FACTS = [
  'Administración ve la ficha completa de cada persona en Gestión > Usuarios («Ver ficha»): sus datos, su cédula, sus sesiones y solicitudes y su estado en RH Link; nunca la contraseña, que no la tiene la intranet (se cambia en Identity Central). La lista se puede buscar por nombre, correo o cédula.',
  'Administración puede reiniciar un perfil de Identity Central en Gestión > Usuarios: elimina perfil local, sesiones, preferencias y solicitudes, y permite recrearlo al entrar. No cambia la cédula en Identity Central ni revoca el acceso central. Borrar conserva el bloqueo permanente local.',
  'Recursos Humanos: teléfono 506-9692, extensiones 9171 y 9172 (consultas de trámites).',
  'Carta de trabajo, certificación laboral, vacaciones, permiso personal y corrección de marcación no se piden en la intranet: se solicitan directamente en Recursos Humanos (506-9692, extensiones 9171 y 9172). La afiliación a pagos por ACH tiene su formato en PDF en la pestaña Recursos Humanos. No hay formularios en línea para esos trámites ni plazos publicados en la intranet.',
  ...(completa ? ['Bienestar y los formularios de Equiparación de Oportunidades todavía no están publicados en la intranet.'] : []),
  'Mesa de Servicios (soporte técnico de Tecnología): extensión 1400.',
  'Central telefónica de la Alcaldía: 524-8900.',
  'Dirección de Comunicaciones (Torre B, piso 4): Recepción ext. 4300, Redes Sociales ext. 4310, Producción Audio Visual ext. 4314. Su correo todavía no está publicado.',
  'Identidad visual: los logos oficiales, la paleta, el manual de marca, la guía del logo, las plantillas y las redes oficiales se descargan en Identidad visual y comunicación. Las tipografías de la marca (Noka, Prometo y Montserrat) también se descargan ahí. La medida mínima del logo todavía no está definida por Comunicación.',
  'Inicio: a la derecha (o, en pantallas angostas, debajo del buscador) está «Tu día»: tus solicitudes abiertas (citas, códigos de llamada y tickets de la Mesa de Ayuda), tu próxima cita de la Clínica y el último boletín; solo muestra lo que está conectado con tu cédula. Quien tiene RRHH Express conectado ve además el bloque «Mi resumen»: su tiempo compensatorio, las tardanzas y ausencias del mes y la fecha de su último comprobante de pago, cada cifra con enlace a su pestaña de Recursos Humanos. Si RRHH Express no está conectado, ese bloque no aparece (se conecta en Recursos Humanos).',
  'Códigos de llamada: quien entró con su cédula ve sus solicitudes de código de llamada en «Mis solicitudes» (y en el bloque del Inicio) con su número, estado (pendiente de aprobación, aprobado, rechazado con su motivo, procesado o anulado), tipo de línea, extensión e historial. Son solo de consulta: la solicitud se hace en el sistema de códigos de llamada y el código (PIN) nunca se muestra en la intranet.',
  'Tickets de la Mesa de Ayuda (GLPI): quien entró con su cédula ve en «Mis solicitudes» los tickets de GLPI donde figura como solicitante, con su número, título, estado (nuevo, en curso, en espera, resuelto o cerrado) y fechas. Solo de consulta: el ticket se abre y se atiende en la Mesa de Servicios. La persona se encuentra en GLPI por su cédula guardada en el campo «Teléfono» de su usuario: si no la tiene ahí, sus tickets no salen y tiene que pedirle a la Mesa de Servicios (ext. 1400) que la registre.',
  'Clínica Municipal: Torre C, Edificio Hatillo; consulta médica sin costo. Quien entró con su cédula ve sus propias citas (fecha, hora, especialidad, médico y estado) en «Mis citas», dentro de la página de la Clínica; las citas nuevas se agendan en el sistema de la Clínica (enlace en esa página).',
  env.rrhhMaintenance
    ? 'La sección de Recursos Humanos y RRHH Express (marcaciones, tiempo compensatorio, comprobantes de pago y expediente) no están disponibles por ahora en la intranet. Para cualquier trámite, Recursos Humanos: 506-9692, ext. 9171 o 9172.'
    : 'Marcaciones, tiempo compensatorio, comprobantes de pago y expediente se ven en Recursos Humanos después de conectar RRHH Express. Con tu cuenta de la intranet (si entraste con Identity Central) solo escribes tu número de cargo; sin cuenta, tu cédula y tu número de cargo, y la conexión dura unos minutos. El número de cargo es la posición que dice abajo de tu carnet, debajo del código QR.',
  'Para entrar a la intranet (y para crear la cuenta) la cédula tiene que aparecer como funcionario activo en Recursos Humanos; si no aparece, no se puede entrar y hay que comunicarse con Recursos Humanos (506-9692, ext. 9171 o 9172).',
  'Cerrar sesión: con la sesión iniciada, arriba a la derecha está el botón con tu nombre (en el teléfono, el círculo con tus iniciales); al tocarlo se abre un panel con tu nombre, tu correo, el enlace a tu cuenta y «Cerrar sesión». En el Centro de Gestión el botón «Cerrar sesión» está en la barra superior. También se puede cerrar desde Configuración. En las pantallas de contraseña (entrar, crear cuenta y conectar RRHH Express) el ojito dentro del campo muestra u oculta lo que escribes; en RRHH Express el campo es el número de cargo.',
  'Crear cuenta (en /registro, desde «Crear cuenta» en la pantalla de entrar): se pide la cédula, el correo institucional (@pty.gob.pa) y una contraseña. No se aceptan correos personales (gmail, outlook u otros). Solo pueden crear cuenta los funcionarios activos en Recursos Humanos.',
  'Para entrar a la intranet hace falta tener un departamento: normalmente sale solo de Recursos Humanos; si no se pudo saber, se elige al iniciar sesión (es obligatorio). Si se eligió mal, lo corrige administración.',
  'Para encontrar a una persona o una extensión que no esté aquí ni en «Personas del directorio», usar el Directorio. El alcalde, el vicealcalde y los directores (con su correo) están en mupa.gob.pa.',
  'El Directorio sale de la central telefónica y se actualiza cada hora (arriba dice «Actualizado hace …»): muestra quién tiene hoy cada extensión. La dirección y la ubicación salen del directorio anterior, así que una extensión nueva puede salir sin dirección.',
]

/** Las páginas de esta edición (las de solo edición completa no existen en publicación). */
// La página de Recursos Humanos está quitada de la edición publicación (29-oct-2026, `recursosHumanos` en lib/edicion.ts de la web).
const sinRrhh = (p: KnowledgePage) => env.EDICION === 'completa' || !p.path.startsWith('/recursos-humanos')
export const knowledgePages = (): KnowledgePage[] => PAGES.filter((p) => (!p.completeOnly || env.EDICION === 'completa') && sinRrhh(p))

/** Los datos confirmados (los mismos que ve el asistente), para el catálogo del MCP. */
export const knowledgeFacts = (): readonly string[] => FACTS

/** Texto para el prompt: páginas (ruta | título | para qué) y datos confirmados. */
export function knowledgePrompt(): string {
  const pages = knowledgePages().map((p) => `${p.path} | ${p.title} | ${p.about}`)
  return `Páginas de la intranet (ruta | título | para qué sirve):\n${pages.join('\n')}\n\nDatos confirmados:\n${FACTS.map((f) => '- ' + f).join('\n')}`
}
