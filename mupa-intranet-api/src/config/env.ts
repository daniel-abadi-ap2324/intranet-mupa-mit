/**
 * Variables de entorno, validadas al arrancar. Si falta algo, el proceso se
 * detiene diciendo QUÉ variable falla (nunca imprime sus valores).
 */
import { z } from 'zod'

const bool = z.stringbool()
const list = z.string().transform((s) => s.split(/[\s,]+/).filter(Boolean))
// Vacío = sin definir: docker compose pasa "" cuando la variable no está en el .env.
const unset = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === '' ? undefined : v), schema)

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),

    // PostgreSQL: postgres://usuario:clave@servidor:5432/base
    // Sin DATABASE_URL (solo fuera de producción) se usa PGlite: Postgres en un
    // archivo local, para trabajar sin Docker. "memory://" = en memoria (pruebas).
    DATABASE_URL: z.string().min(1).optional(),
    PGLITE_DATA_DIR: z.string().default('./.data/pglite'),
    // Archivos que sube Comunicación (PDF de boletines, imágenes). En Docker, un volumen.
    UPLOADS_DIR: z.string().default('./.data/uploads'),
    // La web compilada (dist/ de mupa-intranet-app) que la API sirve en la raíz del sitio. La pone la imagen de Docker
    // (/app/public); sin ella, o si la carpeta no tiene index.html, la API solo responde /api (en desarrollo la web es Vite).
    PUBLIC_DIR: unset(z.string().optional()),
    // Cuántos proxies hay delante (p. ej. 1 con el nginx del servidor) para leer la IP real de X-Forwarded-For.
    // 0 (por defecto) = la API recibe las conexiones directamente y no confía en esas cabeceras.
    TRUST_PROXY: unset(z.coerce.number().int().min(0).max(5).default(0)),

    // Sesión: duración y si la cookie exige HTTPS (sí por defecto en producción).
    SESSION_TTL_HOURS: z.coerce.number().positive().max(24 * 30).default(8),
    COOKIE_SECURE: bool.optional(),

    // "publicacion" = la versión publicada, sin las funciones que todavía nadie alimenta
    // (anuncios, videos, formularios y solicitudes internas): sus rutas no existen. Noticias y boletines sí van.
    // "completa" = todo (desarrollo y pruebas). Debe coincidir con VITE_EDICION de la web.
    EDICION: unset(z.enum(['completa', 'publicacion']).default('completa')),

    // Al arrancar: aplicar migraciones y cargar el contenido inicial (útil con PGlite).
    DB_AUTO_SETUP: bool.default(false),
    // El seed también crea las cuentas FICTICIAS de prueba (contraseña "password").
    SEED_DEMO_USERS: bool.default(false),
    // Entrar con cuentas locales (las ficticias de prueba). Nunca en el servidor real.
    LOCAL_LOGIN_ENABLED: bool.default(false),

    // Identity Central (login unificado de la Alcaldía). Guía: GUIA_INTEGRACION_IDENTITY_PASSWORD.md.
    // IDENTITY_URL es la base para llamarlo; NO se deriva del issuer (en producción no coinciden, §7.6).
    IDENTITY_URL: unset(z.url().optional()),
    IDENTITY_CLIENT_ID: unset(z.string().min(1).optional()),
    IDENTITY_CLIENT_SECRET: unset(z.string().min(1).optional()),
    IDENTITY_SCOPES: unset(list.default(['openid', 'profile', 'email', 'offline_access', 'roles'])),
    IDENTITY_TIMEOUT_MS: unset(z.coerce.number().int().positive().default(10_000)),
    // Cuenta de servicio de la API en Identity Central: con ella, al borrar a alguien se le quita el acceso a la intranet allá.
    IDENTITY_ADMIN_USER: unset(z.string().min(1).optional()),
    IDENTITY_ADMIN_PASSWORD: unset(z.string().min(1).optional()),
    // Validación de los access tokens (RS256 contra el JWKS).
    JWT_ISSUER: unset(z.url().optional()),
    JWT_JWKS_URI: unset(z.url().optional()),
    // client_id cuyos tokens acepta esta API. Debe incluir IDENTITY_CLIENT_ID.
    ALLOWED_CLIENT_IDS: unset(list.optional()),

    // Servidor de inferencia de la Alcaldía (vLLM, API compatible con OpenAI) para el asistente
    // de búsqueda. Opcional: sin LLM_URL el asistente responde 503 y el resto funciona igual.
    LLM_URL: unset(z.url().optional()),
    // Sin LLM_MODEL, vLLM usa el único modelo que tiene cargado.
    LLM_MODEL: unset(z.string().min(1).optional()),
    LLM_TIMEOUT_MS: unset(z.coerce.number().int().positive().default(30_000)),

    // Sistema de citas de la Clínica Municipal: la intranet lee su catálogo público
    // (servicios, especialidades, días de atención). Si no responde, se muestra la copia de respaldo.
    CLINIC_URL: unset(z.url().default('https://clinica.mupa.gob.pa')),
    CLINIC_TIMEOUT_MS: unset(z.coerce.number().int().positive().default(5_000)),
    // API de la Clínica para otros sistemas (historial de citas por cédula, con llave en X-Api-Key). Dirección interna
    // y llave: solo en el .env, nunca en git. Sin ellas «Mis citas» no aparece.
    CLINIC_API_URL: unset(z.url().optional()),
    CLINIC_API_KEY: unset(z.string().min(8).optional()),

    // Sistema de códigos de llamada (solicitudes de PIN de línea): consulta por cédula, solo lectura, con llave en X-Api-Key
    // (GET /api/external/pin-requests). CALLCODE_API_URL es la dirección base (sin la ruta). Dirección interna y llave:
    // solo en el .env, nunca en git. Sin ellas las solicitudes de códigos de llamada no aparecen.
    CALLCODE_API_URL: unset(z.url().optional()),
    CALLCODE_API_KEY: unset(z.string().min(8).optional()),
    CALLCODE_TIMEOUT_MS: unset(z.coerce.number().int().positive().default(8_000)),

    // Mesa de Ayuda (GLPI): los tickets de cada persona en «Mis solicitudes», solo lectura. GLPI_API_URL es la dirección de
    // la API REST (termina en /apirest.php). La cuenta de consulta entra con su token de API (GLPI_USER_TOKEN, lo recomendado)
    // o con su usuario y contraseña (GLPI_USER_ID es el usuario, no el número). Todo solo en el .env, nunca en git.
    // La persona se busca por su cédula en el campo «Teléfono» de su usuario de GLPI (viene del AD). Sin ellas no aparecen.
    GLPI_API_URL: unset(z.url().optional()),
    GLPI_APP_TOKEN: unset(z.string().min(8).optional()),
    GLPI_USER_TOKEN: unset(z.string().min(8).optional()),
    GLPI_USER_ID: unset(z.string().optional()),
    GLPI_USER_PASS: unset(z.string().optional()),
    GLPI_TIMEOUT_MS: unset(z.coerce.number().int().positive().default(8_000)),

    // RH Link (backend de RRHH): la pestaña Recursos Humanos muestra los datos de RRHH Express
    // de quien conecta su cuenta (cédula + contraseña). Opcional: sin RRHH_API_URL, esa parte no aparece.
    // Solo existe por http en la red interna: no se le exige https (la contraseña viaja de servidor a servidor).
    RRHH_API_URL: unset(z.url().optional()),
    RRHH_TIMEOUT_MS: unset(z.coerce.number().int().positive().default(10_000)),
    // RRHH Express en mantenimiento: con true la pestaña lo dice y la API no entrega ni conecta nada de RRHH Express
    // (la verificación de funcionarios al entrar no cambia). En esta copia no hay RH Link, así que va en false por defecto;
    // en el servidor de la Alcaldía está en true.
    RRHH_MANTENIMIENTO: unset(bool.default(false)),
    // Cuenta de AD con la que la API le pregunta a RH Link si una cédula es de un funcionario ACTIVO
    // (GET empleados/cedula/:cedula). Con las dos, entrar y registrarse exige estar en RH Link; sin ellas no se verifica.
    // Intentos de login por IP cada 10 minutos (por defecto 100). Solo se sube en la pila de pruebas e2e, que entra muchas veces seguidas.
    LOGIN_RATE_LIMIT: unset(z.coerce.number().int().positive().default(100)),
    // Cómo viene el nombre en RH Link («NOMBRES APELLIDOS» o «APELLIDOS NOMBRES»): para separar nombre y apellido al registrarse.
    RRHH_NOMBRE_ORDEN: unset(z.enum(['nombres-primero', 'apellidos-primero']).default('nombres-primero')),
    RRHH_API_USER: unset(z.string().optional()),
    RRHH_API_PASSWORD: unset(z.string().optional()),

    // Dominios de correo institucional (sin @). El registro solo acepta correos de estos dominios: nadie crea
    // una cuenta de Identity Central desde la intranet con un correo personal (gmail, outlook…).
    CORREO_DOMINIOS: unset(list.default(['pty.gob.pa'])),

    // Sincronización con mupa.gob.pa (WordPress): trae las noticias y los boletines «AlcalDía» nuevos.
    // Solo lee páginas públicas. Opcional: sin WP_SYNC_URL está apagada.
    WP_SYNC_URL: unset(z.url().optional()),
    WP_SYNC_INTERVAL_MINUTES: unset(z.coerce.number().int().min(5).default(60)),
    // Cuántos días hacia atrás mira en cada pasada (las ya importadas se saltan solas).
    WP_SYNC_WINDOW_DAYS: unset(z.coerce.number().int().min(1).max(3650).default(90)),
    // IDs de categorías de WordPress para las noticias. Vacío = todas.
    WP_SYNC_CATEGORIES: unset(list.default([])),
    WP_SYNC_TIMEOUT_MS: unset(z.coerce.number().int().positive().default(15_000)),

    // Central telefónica (Grandstream UCM, API HTTPS): el Directorio se compara con sus extensiones. Solo lectura.
    // Dirección, usuario y contraseña (los de «Integraciones > Configuración de API» de la central): solo en el .env.
    // Se sincroniza al arrancar y cada UCM_SYNC_MINUTOS (0 = nunca sola). Las visitas leen la copia de la base.
    UCM_URL: unset(z.url().optional()),
    UCM_USER: unset(z.string().min(1).optional()),
    UCM_PASSWORD: unset(z.string().min(1).optional()),
    UCM_SYNC_MINUTOS: unset(z.coerce.number().int().min(0).default(60)),
    // false = acepta el certificado autofirmado de la central. Solo para este cliente: el resto sigue verificando TLS.
    UCM_TLS_VERIFICAR: unset(bool.default(true)),
    UCM_TIMEOUT_MS: unset(z.coerce.number().int().positive().default(15_000)),

    // Servidor MCP (mupa-intranet-mcp, Python): describe los endpoints y las páginas de la intranet para el asistente.
    // MCP_INTERNAL_KEY: llave compartida; con ella el MCP lee GET /api/meta/catalog (sin ella esa ruta no existe).
    // MCP_URL: dónde está el MCP (…/mcp); con él, el asistente le pide pistas antes de responder. Ambos son opcionales.
    MCP_INTERNAL_KEY: unset(z.string().min(16, 'usa al menos 16 caracteres').optional()),
    MCP_URL: unset(z.url().optional()),
    MCP_TIMEOUT_MS: unset(z.coerce.number().int().positive().default(2_000)),
  })
  .superRefine((e, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })

    if (e.NODE_ENV === 'production') {
      if (!e.DATABASE_URL) issue('DATABASE_URL', 'es obligatoria en producción')
      // Las cuentas ficticias usan la contraseña "password" y una es admin. Para probar en Docker local: NODE_ENV=development.
      for (const name of ['LOCAL_LOGIN_ENABLED', 'SEED_DEMO_USERS'] as const) {
        if (e[name]) issue(name, 'las cuentas de prueba no se permiten en producción (para probar en Docker local, usa NODE_ENV=development)')
      }
      // Por http, alguien en la red podría ver las contraseñas o cambiar las llaves del JWKS y falsificar tokens.
      for (const name of ['IDENTITY_URL', 'JWT_ISSUER', 'JWT_JWKS_URI'] as const) {
        if (e[name] && !e[name].startsWith('https://')) issue(name, 'debe usar https:// en producción')
      }
    }

    if (Boolean(e.CLINIC_API_URL) !== Boolean(e.CLINIC_API_KEY)) issue('CLINIC_API_URL', 'CLINIC_API_URL y CLINIC_API_KEY van juntas')
    if (Boolean(e.CALLCODE_API_URL) !== Boolean(e.CALLCODE_API_KEY)) issue('CALLCODE_API_URL', 'CALLCODE_API_URL y CALLCODE_API_KEY van juntas')
    // Con GLPI_API_URL sin llave o sin cuenta no se cae: GLPI queda apagado (p. ej. un .env que solo trae la dirección).
    if (Boolean(e.GLPI_USER_ID) !== Boolean(e.GLPI_USER_PASS)) issue('GLPI_USER_ID', 'GLPI_USER_ID y GLPI_USER_PASS van juntas')
    if (Boolean(e.RRHH_API_USER) !== Boolean(e.RRHH_API_PASSWORD)) issue('RRHH_API_USER', 'RRHH_API_USER y RRHH_API_PASSWORD van juntas')

    if (e.UCM_URL && !(e.UCM_USER && e.UCM_PASSWORD)) issue('UCM_URL', 'UCM_URL, UCM_USER y UCM_PASSWORD van juntas')
    if (Boolean(e.IDENTITY_ADMIN_USER) !== Boolean(e.IDENTITY_ADMIN_PASSWORD)) issue('IDENTITY_ADMIN_USER', 'IDENTITY_ADMIN_USER y IDENTITY_ADMIN_PASSWORD van juntas')

    // (Que haya al menos una forma de entrar lo revisa server.ts: las migraciones no la necesitan.)
    if (!e.IDENTITY_URL) return
    for (const name of ['IDENTITY_CLIENT_ID', 'IDENTITY_CLIENT_SECRET', 'JWT_ISSUER', 'JWT_JWKS_URI', 'ALLOWED_CLIENT_IDS'] as const) {
      if (!e[name]?.length) issue(name, 'es obligatoria cuando se configura IDENTITY_URL')
    }
    // El iss del token se compara carácter por carácter y OpenIddict lo emite con barra final (§7.5).
    if (e.JWT_ISSUER && !e.JWT_ISSUER.endsWith('/')) issue('JWT_ISSUER', 'debe terminar en "/" (el iss del token lleva la barra final)')
    if (e.IDENTITY_CLIENT_ID && e.ALLOWED_CLIENT_IDS && !e.ALLOWED_CLIENT_IDS.includes(e.IDENTITY_CLIENT_ID)) {
      issue('ALLOWED_CLIENT_IDS', 'debe incluir IDENTITY_CLIENT_ID; si no, se rechazan los tokens que emite la propia intranet')
    }
    // phone y address aparecen en el portal pero no existen en el servidor: rompen todo login (§2).
    for (const s of ['phone', 'address']) if (e.IDENTITY_SCOPES.includes(s)) issue('IDENTITY_SCOPES', `no pidas el scope "${s}": invalid_scope`)
    // Sin offline_access no hay refresh token; sin roles no viene app_role.
    for (const s of ['offline_access', 'roles']) if (!e.IDENTITY_SCOPES.includes(s)) issue('IDENTITY_SCOPES', `falta el scope "${s}"`)
  })

const r = envSchema.safeParse(process.env)
if (!r.success) {
  console.error('Configuración inválida:\n' + r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'))
  process.exit(1)
}

const e = r.data

export type IdentityConfig = {
  url: string
  clientId: string
  clientSecret: string
  scopes: string[]
  timeoutMs: number
  issuer: string
  jwksUri: string
  allowedClientIds: string[]
  /** Cuenta de servicio para quitar el acceso de una persona a la intranet; null = no configurada. */
  admin: { user: string; password: string } | null
}

export type LlmConfig = { url: string; model?: string; timeoutMs: number }

export type ClinicConfig = { url: string; timeoutMs: number }

export type ClinicApiConfig = { url: string; apiKey: string; timeoutMs: number }

export type CallCodeApiConfig = { url: string; apiKey: string; timeoutMs: number }

/** Cuenta de consulta de GLPI: con token de API o, si no hay, con usuario y contraseña. */
export type GlpiConfig = { url: string; appToken: string; auth: { userToken: string } | { login: string; password: string }; timeoutMs: number }

export type RrhhConfig = { url: string; timeoutMs: number }

/** Cuenta de AD de la API para consultar a RH Link quién es funcionario. */
export type RrhhVerification = { user: string; password: string }

export type McpConfig = { url: string; timeoutMs: number }

/** Central telefónica (Grandstream UCM) para comparar el Directorio. */
export type UcmConfig = { url: string; user: string; password: string; syncMinutes: number; tlsVerify: boolean; timeoutMs: number }

export type WpSyncConfig = { url: string; intervalMinutes: number; windowDays: number; categories: number[]; timeoutMs: number }

export const env = {
  ...e,
  COOKIE_SECURE: e.COOKIE_SECURE ?? e.NODE_ENV === 'production',
  /** Servidor de inferencia, o null si no está configurado (el asistente queda apagado). */
  llm: (e.LLM_URL ? { url: e.LLM_URL.replace(/\/+$/, ''), model: e.LLM_MODEL, timeoutMs: e.LLM_TIMEOUT_MS } : null) as LlmConfig | null,
  /** Catálogo público del sistema de citas de la Clínica. */
  clinic: { url: e.CLINIC_URL.replace(/\/+$/, ''), timeoutMs: e.CLINIC_TIMEOUT_MS } as ClinicConfig,
  /** API de la Clínica para consultar citas por cédula, o null si no está configurada. */
  clinicApi: (e.CLINIC_API_URL && e.CLINIC_API_KEY ? { url: e.CLINIC_API_URL.replace(/\/+$/, ''), apiKey: e.CLINIC_API_KEY, timeoutMs: e.CLINIC_TIMEOUT_MS } : null) as ClinicApiConfig | null,
  /** API de códigos de llamada para consultar las solicitudes por cédula, o null si no está configurada. */
  callCodeApi: (e.CALLCODE_API_URL && e.CALLCODE_API_KEY ? { url: e.CALLCODE_API_URL.replace(/\/+$/, ''), apiKey: e.CALLCODE_API_KEY, timeoutMs: e.CALLCODE_TIMEOUT_MS } : null) as CallCodeApiConfig | null,
  /** GLPI (Mesa de Ayuda) para consultar los tickets por cédula, o null si no está configurado. */
  glpi: (e.GLPI_API_URL && e.GLPI_APP_TOKEN && (e.GLPI_USER_TOKEN || (e.GLPI_USER_ID && e.GLPI_USER_PASS))
    ? {
        url: e.GLPI_API_URL.replace(/\/+$/, ''),
        appToken: e.GLPI_APP_TOKEN,
        auth: e.GLPI_USER_TOKEN ? { userToken: e.GLPI_USER_TOKEN } : { login: e.GLPI_USER_ID!, password: e.GLPI_USER_PASS! },
        timeoutMs: e.GLPI_TIMEOUT_MS,
      }
    : null) as GlpiConfig | null,
  /** RH Link (RRHH Express), o null si no está configurado. */
  rrhh: (e.RRHH_API_URL ? { url: e.RRHH_API_URL.replace(/\/+$/, ''), timeoutMs: e.RRHH_TIMEOUT_MS } : null) as RrhhConfig | null,
  /** RRHH Express en mantenimiento: la API no entrega ni conecta nada de RRHH Express. */
  rrhhMaintenance: e.RRHH_MANTENIMIENTO,
  /** Verificación de funcionarios contra RH Link al entrar, o null si no está configurada (no se verifica). */
  rrhhVerification: (e.RRHH_API_URL && e.RRHH_API_USER && e.RRHH_API_PASSWORD ? { user: e.RRHH_API_USER, password: e.RRHH_API_PASSWORD } : null) as RrhhVerification | null,
  /** Servidor MCP al que el asistente le pide pistas, o null si no está configurado. */
  mcp: (e.MCP_URL ? { url: e.MCP_URL, timeoutMs: e.MCP_TIMEOUT_MS } : null) as McpConfig | null,
  /** Sincronización con mupa.gob.pa, o null si no está configurada. */
  wpSync: (e.WP_SYNC_URL
    ? {
        url: e.WP_SYNC_URL.replace(/\/+$/, ''),
        intervalMinutes: e.WP_SYNC_INTERVAL_MINUTES,
        windowDays: e.WP_SYNC_WINDOW_DAYS,
        categories: e.WP_SYNC_CATEGORIES.map(Number).filter((n) => Number.isInteger(n) && n > 0),
        timeoutMs: e.WP_SYNC_TIMEOUT_MS,
      }
    : null) as WpSyncConfig | null,
  /** Central telefónica, o null si no está configurada (el Directorio muestra sus datos fijos). */
  ucm: (e.UCM_URL && e.UCM_USER && e.UCM_PASSWORD
    ? { url: e.UCM_URL.replace(/\/+$/, ''), user: e.UCM_USER, password: e.UCM_PASSWORD, syncMinutes: e.UCM_SYNC_MINUTOS, tlsVerify: e.UCM_TLS_VERIFICAR, timeoutMs: e.UCM_TIMEOUT_MS }
    : null) as UcmConfig | null,
  /** Identity Central, o null si no está configurado (solo cuentas locales). */
  identity: (e.IDENTITY_URL
    ? {
        url: e.IDENTITY_URL.replace(/\/+$/, ''),
        clientId: e.IDENTITY_CLIENT_ID,
        clientSecret: e.IDENTITY_CLIENT_SECRET,
        scopes: e.IDENTITY_SCOPES,
        timeoutMs: e.IDENTITY_TIMEOUT_MS,
        issuer: e.JWT_ISSUER,
        jwksUri: e.JWT_JWKS_URI,
        allowedClientIds: e.ALLOWED_CLIENT_IDS,
        admin: e.IDENTITY_ADMIN_USER && e.IDENTITY_ADMIN_PASSWORD ? { user: e.IDENTITY_ADMIN_USER, password: e.IDENTITY_ADMIN_PASSWORD } : null,
      }
    : null) as IdentityConfig | null,
}
