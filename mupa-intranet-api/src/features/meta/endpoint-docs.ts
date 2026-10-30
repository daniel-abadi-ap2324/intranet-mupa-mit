/**
 * Descripción, en español, de cada endpoint de la API: para qué sirve y a qué página de la intranet
 * corresponde. El catálogo (meta.service.ts) lo une a lo que se averigua solo de las rutas (método,
 * ruta, roles, qué recibe). Lo lee el servidor MCP (mupa-intranet-mcp) para que el asistente
 * entienda qué puede hacer la intranet y mande a la persona a la página correcta.
 *
 * Una prueba (tests/meta.test.ts) exige que TODA ruta montada tenga su entrada aquí y que ninguna
 * entrada sobre: al agregar o quitar un endpoint, se actualiza este archivo en el mismo cambio.
 * Solo lo que el endpoint hace de verdad: nada inventado.
 */
export type EndpointDoc = {
  /** Qué hace, en una frase. */
  summary: string
  /** Grupo para ordenar y filtrar. */
  area: string
  /** Quién puede usarlo, si lo que se averigua solo de la ruta no lo dice todo. */
  access?: string
  /** Página de la intranet donde la persona ve o usa esto (la ruta de la web). */
  page?: string
  /** Palabras con las que la gente lo pide (para encontrarlo al buscar). */
  keywords?: string[]
}

const RRHH = 'Cuenta de RRHH Express conectada'

export const ENDPOINT_DOCS: Record<string, EndpointDoc> = {
  // ---------- Salud y sesión ----------
  'GET /api/health': { area: 'Salud', summary: 'Dice si la API y la base de datos responden (lo usa Docker para saber si está viva).', keywords: ['estado', 'salud', 'funciona'] },
  'POST /api/auth/register': { area: 'Sesión', summary: 'Crea una cuenta nueva con la cédula (la cuenta vive en Identity Central; la cédula no se guarda en la intranet).', page: '/registro', keywords: ['registrarme', 'crear cuenta', 'registro'] },
  'POST /api/auth/login': { area: 'Sesión', summary: 'Inicia sesión con usuario y contraseña y deja la cookie de sesión.', page: '/entrar', keywords: ['entrar', 'iniciar sesión', 'login', 'contraseña'] },
  'POST /api/auth/refresh': { area: 'Sesión', summary: 'Renueva la sesión antes de que venza.', keywords: ['renovar sesión'] },
  'POST /api/auth/logout': { area: 'Sesión', summary: 'Cierra la sesión.', keywords: ['salir', 'cerrar sesión'] },
  'GET /api/auth/session': { area: 'Sesión', summary: 'Devuelve quién es la persona con sesión (nombre, roles, departamento) o null si no ha entrado.', keywords: ['quién soy', 'mi sesión'] },

  // ---------- Aplicaciones y etiquetas ----------
  'GET /api/applications': { area: 'Aplicaciones', summary: 'Lista el catálogo de aplicaciones y servicios de la Alcaldía que esa persona puede ver, con búsqueda y filtros por área y etiqueta.', page: '/aplicaciones', access: 'Cualquiera; lo que ve depende de su sesión y departamento', keywords: ['sistemas', 'aplicaciones', 'catálogo', 'servicios', 'correo'] },
  'GET /api/applications/:id': { area: 'Aplicaciones', summary: 'Una aplicación del catálogo con su descripción, enlace, área y etiquetas.', page: '/aplicaciones', access: 'Cualquiera; lo que ve depende de su sesión y departamento' },
  'POST /api/applications': { area: 'Aplicaciones', summary: 'Agrega una aplicación al catálogo.', page: '/gestion/aplicaciones', keywords: ['nueva aplicación'] },
  'PUT /api/applications/departments': { area: 'Aplicaciones', summary: 'Cambia de una vez qué departamentos ven cada aplicación del catálogo (lista vacía = todas las personas). Todo o nada.', page: '/gestion/aplicaciones', access: 'Solo administración', keywords: ['visibilidad', 'direcciones', 'clasificar'] },
  'PATCH /api/applications/:id': { area: 'Aplicaciones', summary: 'Cambia los datos de una aplicación del catálogo (nombre, enlace, estado, quién la ve).', page: '/gestion/aplicaciones' },
  'DELETE /api/applications/:id': { area: 'Aplicaciones', summary: 'Quita una aplicación del catálogo.', page: '/gestion/aplicaciones' },
  'GET /api/tags': { area: 'Aplicaciones', summary: 'Lista las etiquetas con las que se agrupan las aplicaciones.', page: '/aplicaciones', access: 'Cualquiera' },

  // ---------- Inicio ----------
  'GET /api/home/content': { area: 'Inicio', summary: 'El contenido editable del Inicio: bienvenida, enlaces, trámites frecuentes, campañas y enlaces institucionales.', page: '/', access: 'Cualquiera', keywords: ['inicio', 'trámites frecuentes', 'enlaces institucionales'] },
  'PUT /api/home/content/intro': { area: 'Inicio', summary: 'Cambia el texto de bienvenida del Inicio.', page: '/gestion/inicio' },
  'PUT /api/home/content/frecuentes': { area: 'Inicio', summary: 'Cambia la lista de trámites frecuentes del Inicio.', page: '/gestion/inicio' },
  'PUT /api/home/content/campanas': { area: 'Inicio', summary: 'Cambia las campañas y avisos (carrusel) del Inicio.', page: '/gestion/inicio' },
  'PUT /api/home/content/enlaces': { area: 'Inicio', summary: 'Cambia los enlaces institucionales del Inicio.', page: '/gestion/inicio' },
  'GET /api/home/layout': { area: 'Inicio', summary: 'El orden y el tamaño de los bloques del Inicio de esa persona (o el de todos si no ha personalizado el suyo).', page: '/', access: 'Cualquiera', keywords: ['personalizar inicio', 'bloques'] },
  'PUT /api/home/layout': { area: 'Inicio', summary: 'Guarda el diseño del Inicio de esa persona (qué bloques ve y en qué orden).', page: '/', keywords: ['personalizar inicio'] },
  'PUT /api/home/default-layout': { area: 'Inicio', summary: 'Guarda el diseño del Inicio que ve todo el que no personalizó el suyo.', page: '/' },

  // ---------- Asistente ----------
  'GET /api/assistant/status': { area: 'Asistente', summary: 'Dice si el asistente (chatbot) está disponible. No consulta al modelo.', access: 'Cualquiera', keywords: ['chatbot', 'asistente'] },
  'POST /api/assistant/ask': { area: 'Asistente', summary: 'Hace una pregunta al asistente: responde en texto y propone páginas de la intranet y aplicaciones del catálogo a las que ir.', access: 'Cualquiera (máx. 15 preguntas cada 10 minutos)', keywords: ['preguntar', 'ayuda', 'chatbot', 'dónde encuentro'] },

  // ---------- Departamentos y usuarios ----------
  'GET /api/departments/options': { area: 'Departamentos', summary: 'La lista corta de departamentos (para elegirlos en un formulario).', access: 'Cualquiera' },
  'GET /api/departments': { area: 'Departamentos', summary: 'Lista completa de departamentos con cuántas personas y aplicaciones tiene cada uno.', page: '/gestion/departamentos' },
  'POST /api/departments': { area: 'Departamentos', summary: 'Crea un departamento.', page: '/gestion/departamentos' },
  'PATCH /api/departments/:id': { area: 'Departamentos', summary: 'Cambia el nombre de un departamento.', page: '/gestion/departamentos' },
  'DELETE /api/departments/:id': { area: 'Departamentos', summary: 'Borra un departamento.', page: '/gestion/departamentos' },
  'GET /api/directory': { area: 'Directorio', summary: 'El directorio telefónico (nombre, dirección, extensión y ubicación) con la fecha de la última copia de la central telefónica; sin copia, los datos fijos. Nunca llama a la central.', page: '/directorio', access: 'Cualquiera', keywords: ['extensiones', 'teléfonos', 'central', 'actualizado'] },
  'GET /api/directory/comparison': { area: 'Directorio', summary: 'Compara la central telefónica con el Directorio: extensiones nuevas en la central, las que ya no existen y los nombres distintos, más el estado de la sincronización. Nada se publica solo.', access: 'Solo administración', keywords: ['central', 'comparación', 'extensiones nuevas'] },
  'GET /api/users': { area: 'Usuarios', summary: 'Lista las personas con cuenta, con búsqueda por nombre, correo o cédula; administración les asigna su departamento.', page: '/gestion/usuarios', keywords: ['usuarios', 'asignar departamento'] },
  'GET /api/users/:id': { area: 'Usuarios', summary: 'La ficha completa de una persona (administración): sus datos menos la contraseña, con su cédula, sesiones, solicitudes y su estado en RH Link.', page: '/gestion/usuarios', keywords: ['ficha', 'cédula'] },
  'POST /api/users/:id/suspend': { area: 'Usuarios', summary: 'Suspende una cuenta: no puede entrar y se cierran sus sesiones (administración).', page: '/gestion/usuarios' },
  'POST /api/users/:id/reactivate': { area: 'Usuarios', summary: 'Reactiva una cuenta suspendida (administración).', page: '/gestion/usuarios' },
  'POST /api/users/:id/reset': { area: 'Usuarios', summary: 'Reinicia el perfil local de Identity Central y elimina sesiones, preferencias y solicitudes; permite recrearlo al ingresar, sin corregir datos ni revocar acceso en el central (administración).', page: '/gestion/usuarios', keywords: ['reiniciar perfil'] },
  'DELETE /api/users/:id': { area: 'Usuarios', summary: 'Borra una cuenta y sus solicitudes (administración).', page: '/gestion/usuarios' },
  'PATCH /api/users/:id': { area: 'Usuarios', summary: 'Cambia el departamento de una persona (y con eso, qué aplicaciones del catálogo ve).', page: '/gestion/usuarios' },

  // ---------- Mi cuenta ----------
  'GET /api/me/summary': { area: 'Mi cuenta', summary: 'Las cifras de la franja «Gestión» del Inicio: solicitudes sin leer y, según el rol, solicitudes nuevas, usuarios sin departamento y anuncios vigentes o en borrador.', page: '/', keywords: ['mi resumen'] },
  'PUT /api/me/department': { area: 'Mi cuenta', summary: 'La persona sin departamento elige el suyo (es obligatorio al entrar; después solo administración lo cambia).', page: '/entrar', keywords: ['departamento'] },
  'PUT /api/me/tour': { area: 'Mi cuenta', summary: 'Marca que ya vio el recorrido para usuarios nuevos.', page: '/' },
  'POST /api/me/email/code': { area: 'Mi cuenta', summary: 'Pide que Identity Central mande un código de confirmación al correo de la cuenta.', page: '/configuracion', keywords: ['confirmar correo', 'código'] },
  'POST /api/me/email/verify': { area: 'Mi cuenta', summary: 'Confirma el correo con el código recibido.', page: '/configuracion', keywords: ['confirmar correo', 'código'] },

  // ---------- Clínica ----------
  'GET /api/glpi/tickets': { area: 'Solicitudes', summary: 'Los tickets de la Mesa de Ayuda (GLPI) donde la persona con sesión es solicitante, buscada por la cédula con la que entró en el campo «Teléfono» de su usuario de GLPI: número, título, estado y fechas. Nunca la descripción. Si su cédula no está en «Teléfono», no salen (userFound: false).', page: '/mis-solicitudes', access: 'Con sesión', keywords: ['glpi', 'mesa de ayuda', 'ticket', 'soporte', 'mis solicitudes'] },
  'GET /api/call-codes/requests': { area: 'Solicitudes', summary: 'Las solicitudes de código de llamada de la persona con sesión (sistema de códigos de llamada, por la cédula con la que entró): número, estado, tipo de línea, extensión, motivo de rechazo e historial. Nunca trae el código (PIN).', page: '/mis-solicitudes', access: 'Con sesión', keywords: ['código de llamada', 'pin', 'línea', 'extensión', 'mis solicitudes'] },
  'GET /api/clinic/appointments': { area: 'Clínica', summary: 'Las citas médicas de la persona con sesión (historial de la Clínica por la cédula con la que entró): fecha, hora, especialidad, médico y estado.', page: '/clinica', access: 'Con sesión', keywords: ['mis citas', 'cita médica', 'historial'] },
  'GET /api/clinic': { area: 'Clínica', summary: 'Servicios, especialidades y días de atención de la Clínica Municipal (del sistema de citas; si no responde, la copia de respaldo).', page: '/clinica', access: 'Cualquiera', keywords: ['clínica', 'cita médica', 'especialidades', 'médico'] },

  // ---------- Archivos ----------
  'POST /api/files': { area: 'Archivos', summary: 'Sube un PDF o una imagen (hasta 10 MB) y devuelve su dirección para usarla en un boletín o una noticia.', page: '/gestion/boletines', keywords: ['subir pdf', 'subir archivo'] },
  'GET /api/files/:id{/:name}': { area: 'Archivos', summary: 'Descarga o muestra un archivo subido (PDF o imagen).', access: 'Cualquiera', keywords: ['descargar pdf'] },

  // ---------- Boletines ----------
  'GET /api/bulletins': { area: 'Boletines', summary: 'Los boletines «Alcaldía al día» publicados, del más nuevo al más viejo, con su descripción corta y palabras clave. Con ?q busca por tema, palabra o fecha.', page: '/boletines', access: 'Cualquiera', keywords: ['boletín', 'alcaldía al día', 'buscar boletín', 'boletines'] },
  'GET /api/bulletins/manage': { area: 'Boletines', summary: 'Todos los boletines, también los ocultos, con quién los editó.', page: '/gestion/boletines' },
  'POST /api/bulletins': { area: 'Boletines', summary: 'Publica un boletín (fecha y PDF); su descripción y palabras clave salen solas del PDF.', page: '/gestion/boletines' },
  'PATCH /api/bulletins/:id': { area: 'Boletines', summary: 'Cambia un boletín (fecha, PDF, nota) o lo oculta o publica.', page: '/gestion/boletines' },
  'DELETE /api/bulletins/:id': { area: 'Boletines', summary: 'Borra un boletín.', page: '/gestion/boletines' },

  // ---------- Auditoría y gestión ----------
  'GET /api/audit/events': { area: 'Auditoría', summary: 'El registro de eventos del sistema (p. ej. solicitudes creadas), los más nuevos primero, con filtro por tipo y por sobre qué fue.', page: '/gestion' },
  'GET /api/gestion/panel': { area: 'Centro de Gestión', summary: 'Las cifras del Centro de Gestión: solicitudes por estado y atrasadas, contenido publicado y actividad reciente.', page: '/gestion', keywords: ['centro de gestión', 'cifras', 'panel'] },

  // ---------- Recursos Humanos (RRHH Express) ----------
  'GET /api/rrhh/conexion': { area: 'Recursos Humanos', summary: 'Dice si este servidor tiene RRHH Express, si la persona ya conectó su cuenta (con sesión o como invitado) y si su sesión ya conoce su cédula (knownCedula: entonces solo se pide el número de cargo).', page: '/recursos-humanos', access: 'Cualquiera', keywords: ['rrhh express', 'conectar cuenta'] },
  'POST /api/rrhh/conexion': { area: 'Recursos Humanos', summary: 'Conecta la cuenta de RRHH Express con el número de cargo. Con sesión que conoce la cédula solo se escribe el número de cargo; sin sesión (conexión de invitado, dura unos minutos) o sin cédula conocida, también la cédula. Nada se guarda: solo el token de RH Link, cifrado. Pocos intentos fallidos por cédula y por IP (429).', page: '/recursos-humanos', access: 'Cualquiera (con o sin sesión)', keywords: ['conectar rrhh express', 'número de cargo', 'cédula'] },
  'DELETE /api/rrhh/conexion': { area: 'Recursos Humanos', summary: 'Desconecta la cuenta de RRHH Express (la de la sesión o la de invitado).', page: '/recursos-humanos', access: RRHH },
  'GET /api/rrhh/marcaciones': { area: 'Recursos Humanos', summary: 'Las marcaciones de un mes: entrada y salida de cada día, tardanzas, ausencias y feriados.', page: '/recursos-humanos?seccion=marcaciones', access: RRHH, keywords: ['marcaciones', 'asistencia', 'tardanza', 'ausencia', 'entrada', 'salida', 'horario'] },
  'GET /api/rrhh/comprobantes': { area: 'Recursos Humanos', summary: 'Los comprobantes de pago (talonario), por páginas.', page: '/recursos-humanos?seccion=comprobantes', access: RRHH, keywords: ['comprobante de pago', 'talonario', 'salario', 'sueldo', 'pago'] },
  'GET /api/rrhh/comprobantes/resumen/:year': { area: 'Recursos Humanos', summary: 'El resumen de un año de pagos: bruto, descuentos y neto.', page: '/recursos-humanos?seccion=comprobantes', access: RRHH, keywords: ['resumen anual', 'salario del año'] },
  'GET /api/rrhh/comprobantes/detalle': { area: 'Recursos Humanos', summary: 'El detalle de un comprobante: los descuentos directos línea por línea.', page: '/recursos-humanos?seccion=comprobantes', access: RRHH, keywords: ['descuentos', 'detalle de pago'] },
  'GET /api/rrhh/expediente': { area: 'Recursos Humanos', summary: 'El expediente: datos del puesto, personales, formación, evaluaciones, sanciones y dependientes (con datos sensibles enmascarados).', page: '/recursos-humanos?seccion=expediente', access: RRHH, keywords: ['expediente', 'datos personales', 'dependientes', 'cargo', 'puesto'] },
  'GET /api/rrhh/compensatorio': { area: 'Recursos Humanos', summary: 'El saldo de tiempo compensatorio, lo que vence pronto y las solicitudes hechas.', page: '/recursos-humanos?seccion=compensatorio', access: RRHH, keywords: ['tiempo compensatorio', 'compensatorio', 'saldo', 'horas extra'] },
  'GET /api/rrhh/compensatorio/candidatos': { area: 'Recursos Humanos', summary: 'Los días trabajados de más que se pueden reclamar como tiempo compensatorio en un rango de fechas.', page: '/recursos-humanos?seccion=compensatorio', access: RRHH },
  'POST /api/rrhh/compensatorio/acreditacion': { area: 'Recursos Humanos', summary: 'Pide acreditar tiempo compensatorio por un día trabajado de más.', page: '/recursos-humanos?seccion=compensatorio', access: RRHH, keywords: ['acreditar tiempo'] },
  'POST /api/rrhh/compensatorio/uso': { area: 'Recursos Humanos', summary: 'Pide usar tiempo compensatorio acumulado.', page: '/recursos-humanos?seccion=compensatorio', access: RRHH, keywords: ['usar tiempo compensatorio', 'tomar día libre'] },
  'PATCH /api/rrhh/compensatorio/solicitudes/:id/cancelar': { area: 'Recursos Humanos', summary: 'Cancela una solicitud de tiempo compensatorio.', page: '/recursos-humanos?seccion=compensatorio', access: RRHH },

  // ---------- Sincronización con mupa.gob.pa ----------
  'GET /api/wordpress-sync/status': { area: 'Sincronización', summary: 'Si la sincronización con mupa.gob.pa está encendida y cómo le fue la última vez.', page: '/gestion/boletines' },
  'POST /api/wordpress-sync/run': { area: 'Sincronización', summary: 'Trae ahora las noticias y boletines nuevos de mupa.gob.pa (sigue en segundo plano; se pregunta el estado).', page: '/gestion/boletines', keywords: ['sincronizar', 'mupa.gob.pa'] },

  // ---------- Anuncios ----------
  'GET /api/announcements': { area: 'Anuncios', summary: 'Los anuncios vigentes de la Alcaldía, marcados por urgencia.', page: '/', access: 'Cualquiera', keywords: ['anuncios', 'avisos'] },
  'GET /api/announcements/manage': { area: 'Anuncios', summary: 'Todos los anuncios, también los vencidos y los borradores.', page: '/gestion/anuncios' },
  'POST /api/announcements': { area: 'Anuncios', summary: 'Publica un anuncio.', page: '/gestion/anuncios' },
  'PATCH /api/announcements/:id': { area: 'Anuncios', summary: 'Cambia un anuncio o lo oculta o publica.', page: '/gestion/anuncios' },
  'DELETE /api/announcements/:id': { area: 'Anuncios', summary: 'Borra un anuncio.', page: '/gestion/anuncios' },

  // ---------- Noticias ----------
  'GET /api/news': { area: 'Noticias', summary: 'Las noticias publicadas, de la más nueva a la más vieja (título, resumen, foto, enlace y si se puede leer completa dentro de la intranet).', page: '/noticias', access: 'Cualquiera', keywords: ['noticias', 'comunicados', 'novedades'] },
  'GET /api/news/manage': { area: 'Noticias', summary: 'Todas las noticias, también los borradores.', page: '/gestion/noticias' },
  'GET /api/news/:id': { area: 'Noticias', summary: 'Una noticia publicada con su texto completo, para leerla dentro de la intranet.', page: '/noticias', access: 'Cualquiera', keywords: ['leer noticia'] },
  'POST /api/news': { area: 'Noticias', summary: 'Publica una noticia.', page: '/gestion/noticias' },
  'PATCH /api/news/:id': { area: 'Noticias', summary: 'Cambia una noticia o la oculta o publica.', page: '/gestion/noticias' },
  'DELETE /api/news/:id': { area: 'Noticias', summary: 'Borra una noticia.', page: '/gestion/noticias' },

  // ---------- Videos ----------
  'GET /api/videos': { area: 'Videos', summary: 'Los videos publicados (instructivos de la Mesa de Servicios, canal y otros).', page: '/videos', access: 'Cualquiera', keywords: ['videos', 'instructivos', 'tutoriales'] },
  'GET /api/videos/manage': { area: 'Videos', summary: 'Todos los videos, también los ocultos.', page: '/gestion/videos' },
  'POST /api/videos': { area: 'Videos', summary: 'Agrega un video.', page: '/gestion/videos' },
  'PATCH /api/videos/:id': { area: 'Videos', summary: 'Cambia un video o lo oculta o publica.', page: '/gestion/videos' },
  'DELETE /api/videos/:id': { area: 'Videos', summary: 'Borra un video.', page: '/gestion/videos' },

  // ---------- Formularios y solicitudes ----------
  'GET /api/forms': { area: 'Formularios', summary: 'Los formularios de solicitud publicados (accesos, trámites de Tecnología y Recursos Humanos).', page: '/formularios', access: 'Cualquiera', keywords: ['formularios', 'solicitar', 'trámite'] },
  'GET /api/forms/:slug': { area: 'Formularios', summary: 'Un formulario con sus campos y si ya recibe solicitudes reales.', page: '/formularios', access: 'Cualquiera' },
  'GET /api/forms/manage': { area: 'Formularios', summary: 'Todos los formularios, también los ocultos, para el constructor.', page: '/gestion/formularios' },
  'POST /api/forms': { area: 'Formularios', summary: 'Crea un formulario de solicitud.', page: '/gestion/formularios' },
  'PATCH /api/forms/:id': { area: 'Formularios', summary: 'Cambia un formulario (campos, área, si recibe solicitudes).', page: '/gestion/formularios' },
  'DELETE /api/forms/:id': { area: 'Formularios', summary: 'Borra un formulario.', page: '/gestion/formularios' },
  'POST /api/requests': { area: 'Solicitudes', summary: 'Envía una solicitud con un formulario; queda guardada y la atienden los gestores.', page: '/formularios', keywords: ['enviar solicitud', 'pedir', 'solicitud'] },
  'GET /api/requests/mine': { area: 'Solicitudes', summary: 'Las solicitudes que hizo la persona, con su estado.', page: '/mis-solicitudes', keywords: ['mis solicitudes', 'estado de mi solicitud', 'seguimiento'] },
  'GET /api/requests/manage': { area: 'Solicitudes', summary: 'La bandeja de los gestores: todas las solicitudes, con filtros (estado, área, atrasadas).', page: '/gestion', keywords: ['bandeja', 'atender solicitudes'] },
  'PATCH /api/requests/:id': { area: 'Solicitudes', summary: 'Cambia el estado de una solicitud (en atención, cerrada…).', page: '/gestion' },
  'POST /api/requests/:id/messages': { area: 'Solicitudes', summary: 'Responde una solicitud: el mensaje lo ve la persona que la hizo.', page: '/gestion' },
  'GET /api/requests/:id': { area: 'Solicitudes', summary: 'Una solicitud de la persona con su historial y las respuestas.', page: '/mis-solicitudes' },
  'GET /api/notifications': { area: 'Notificaciones', summary: 'Las solicitudes por atender (la campana de los gestores).', page: '/gestion' },
  'GET /api/notifications/stream': { area: 'Notificaciones', summary: 'Aviso en vivo (SSE) cuando llega una solicitud nueva, para los gestores.', page: '/gestion' },

  // ---------- Catálogo de endpoints (MCP) ----------
  'GET /api/meta/content': { area: 'Catálogo', summary: 'Boletines, noticias y formularios publicados que coinciden con una pregunta, con su ruta en la intranet. Solo con la llave interna del servidor MCP.', access: 'Servicio interno (cabecera X-Internal-Key)', keywords: ['buscar contenido', 'mcp'] },
  'GET /api/meta/site-search': { area: 'Catálogo', summary: 'Personas del directorio telefónico y textos públicos de mupa.gob.pa (alcalde, vicealcalde, directores con su correo, noticias) que coinciden con una pregunta. Solo con la llave interna del servidor MCP.', access: 'Servicio interno (cabecera X-Internal-Key)', keywords: ['directorio', 'mupa.gob.pa', 'alcalde', 'directores', 'mcp'] },
  'GET /api/meta/catalog': { area: 'Catálogo', summary: 'Este catálogo: los endpoints de la API con su descripción, y las páginas de la intranet. Solo con la llave interna del servidor MCP.', access: 'Servicio interno (cabecera X-Internal-Key)', keywords: ['endpoints', 'catálogo', 'mcp'] },
}
