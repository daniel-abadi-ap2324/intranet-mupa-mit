import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { defineConfig } from 'vitest/config'

/** Puertos libres (distintos) para los servidores falsos de tests/identity, tests/assistant, tests/rrhh y tests/wordpress-sync. */
async function freePorts(n: number): Promise<number[]> {
  const servers = await Promise.all(
    Array.from(
      { length: n },
      () =>
        new Promise<net.Server>((resolve, reject) => {
          const s = net.createServer()
          s.on('error', reject)
          s.listen(0, '127.0.0.1', () => resolve(s))
        }),
    ),
  )
  const ports = servers.map((s) => (s.address() as net.AddressInfo).port)
  await Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve))))
  return ports
}

/**
 * Pruebas contra la app real (supertest) y un PostgreSQL real en memoria
 * (PGlite): cada archivo de prueba tiene su propia base, con las migraciones
 * aplicadas por tests/setup.ts. No hace falta Docker ni un servidor.
 *
 * Varios proyectos, porque la configuración se lee al arrancar:
 *  - api:       solo cuentas locales (LOCAL_LOGIN_ENABLED), sin Identity Central ni asistente.
 *  - identity:  además, Identity Central apuntando a un servidor falso
 *               (tests/identity/fake-identity.ts) que levanta la propia prueba.
 *  - assistant: el asistente apuntando a un servidor de inferencia falso (tests/assistant/fake-llm.ts) y a un MCP falso (fake-mcp.ts).
 *  - rrhh:      RRHH Express apuntando a un RH Link falso (tests/rrhh/fake-rhlink.ts).
 *  - wordpress: la sincronización con mupa.gob.pa apuntando a un WordPress falso (tests/wordpress-sync/fake-wordpress.ts).
 */
export default defineConfig(async () => {
  const [identityPort, llmPort, rrhhPort, wpPort, mcpPort, identityPort2, rrhhPort2, identityPort3, clinicPort, identityPort4, callCodePort, identityPort5, glpiPort] = await freePorts(13)
  const central = `http://127.0.0.1:${identityPort}`
  // El proyecto «funcionario» tiene sus propios servidores falsos: los proyectos corren en paralelo.
  const central2 = `http://127.0.0.1:${identityPort2}`
  const central3 = `http://127.0.0.1:${identityPort3}`
  const central4 = `http://127.0.0.1:${identityPort4}`
  const central5 = `http://127.0.0.1:${identityPort5}`
  const base = { NODE_ENV: 'test', RRHH_MANTENIMIENTO: 'false', PGLITE_DATA_DIR: 'memory://', LOCAL_LOGIN_ENABLED: 'true', CLINIC_URL: 'http://127.0.0.1:9', CLINIC_TIMEOUT_MS: '500', MCP_INTERNAL_KEY: 'llave-interna-de-prueba-1234', UPLOADS_DIR: path.join(os.tmpdir(), 'mupa-intranet-pruebas-archivos') }

  return {
    test: {
      environment: 'node',
      setupFiles: ['tests/setup.ts'],
      testTimeout: 20_000,
      hookTimeout: 60_000,
      projects: [
        {
          extends: true,
          test: { name: 'api', include: ['tests/**/*.test.ts'], exclude: ['tests/identity/**', 'tests/funcionario/**', 'tests/clinic-citas/**', 'tests/call-codes/**', 'tests/glpi/**', 'tests/assistant/**', 'tests/publicacion/**', 'tests/rrhh/**', 'tests/rrhh-mantenimiento/**', 'tests/wordpress-sync/**'], env: base },
        },
        {
          extends: true,
          test: { name: 'publicacion', include: ['tests/publicacion/**/*.test.ts'], env: { ...base, EDICION: 'publicacion' } },
        },
        {
          extends: true,
          test: {
            name: 'identity',
            include: ['tests/identity/**/*.test.ts'],
            env: {
              ...base,
              IDENTITY_URL: central,
              IDENTITY_CLIENT_ID: 'intranet_prueba',
              IDENTITY_CLIENT_SECRET: 'secreto-de-prueba-no-real',
              JWT_ISSUER: `${central}/`,
              JWT_JWKS_URI: `${central}/.well-known/jwks`,
              ALLOWED_CLIENT_IDS: 'intranet_prueba,otra_app_permitida',
              IDENTITY_TIMEOUT_MS: '3000',
              IDENTITY_ADMIN_USER: 'servicio@alcaldia.test',
              IDENTITY_ADMIN_PASSWORD: 'clave-del-servicio',
            },
          },
        },
        {
          // Entrar y registrarse exigen ser funcionario activo en RH Link (RRHH_API_USER): Identity Central falso + RH Link falso.
          extends: true,
          test: {
            name: 'funcionario',
            include: ['tests/funcionario/**/*.test.ts'],
            env: {
              ...base,
              IDENTITY_URL: central2,
              IDENTITY_CLIENT_ID: 'intranet_prueba',
              IDENTITY_CLIENT_SECRET: 'secreto-de-prueba-no-real',
              JWT_ISSUER: `${central2}/`,
              JWT_JWKS_URI: `${central2}/.well-known/jwks`,
              ALLOWED_CLIENT_IDS: 'intranet_prueba',
              IDENTITY_TIMEOUT_MS: '3000',
              RRHH_API_URL: `http://127.0.0.1:${rrhhPort2}`,
              RRHH_TIMEOUT_MS: '1500',
              RRHH_API_USER: 'cuenta.api',
              RRHH_API_PASSWORD: 'clave-ad-de-prueba',
            },
          },
        },
        {
          // «Mis citas»: la cédula sale de la sesión (Identity Central falso) y las citas, de la API de la Clínica (falsa).
          extends: true,
          test: {
            name: 'clinic-citas',
            include: ['tests/clinic-citas/**/*.test.ts'],
            env: {
              ...base,
              IDENTITY_URL: central3,
              IDENTITY_CLIENT_ID: 'intranet_prueba',
              IDENTITY_CLIENT_SECRET: 'secreto-de-prueba-no-real',
              JWT_ISSUER: `${central3}/`,
              JWT_JWKS_URI: `${central3}/.well-known/jwks`,
              ALLOWED_CLIENT_IDS: 'intranet_prueba',
              IDENTITY_TIMEOUT_MS: '3000',
              CLINIC_API_URL: `http://127.0.0.1:${clinicPort}`,
              CLINIC_API_KEY: 'llave-de-prueba-de-la-clinica',
              CLINIC_TIMEOUT_MS: '1500',
            },
          },
        },
        {
          // Solicitudes de código de llamada: la cédula sale de la sesión (Identity Central falso) y las solicitudes, de la API de códigos de llamada (falsa).
          extends: true,
          test: {
            name: 'call-codes',
            include: ['tests/call-codes/**/*.test.ts'],
            env: {
              ...base,
              IDENTITY_URL: central4,
              IDENTITY_CLIENT_ID: 'intranet_prueba',
              IDENTITY_CLIENT_SECRET: 'secreto-de-prueba-no-real',
              JWT_ISSUER: `${central4}/`,
              JWT_JWKS_URI: `${central4}/.well-known/jwks`,
              ALLOWED_CLIENT_IDS: 'intranet_prueba',
              IDENTITY_TIMEOUT_MS: '3000',
              CALLCODE_API_URL: `http://127.0.0.1:${callCodePort}`,
              CALLCODE_API_KEY: 'llave-de-prueba-de-codigos',
              CALLCODE_TIMEOUT_MS: '1500',
            },
          },
        },
        {
          // Tickets de la Mesa de Ayuda: la cédula sale de la sesión (Identity Central falso) y los tickets, de un GLPI falso.
          extends: true,
          test: {
            name: 'glpi',
            include: ['tests/glpi/**/*.test.ts'],
            env: {
              ...base,
              IDENTITY_URL: central5,
              IDENTITY_CLIENT_ID: 'intranet_prueba',
              IDENTITY_CLIENT_SECRET: 'secreto-de-prueba-no-real',
              JWT_ISSUER: `${central5}/`,
              JWT_JWKS_URI: `${central5}/.well-known/jwks`,
              ALLOWED_CLIENT_IDS: 'intranet_prueba',
              IDENTITY_TIMEOUT_MS: '3000',
              GLPI_API_URL: `http://127.0.0.1:${glpiPort}/apirest.php`,
              GLPI_APP_TOKEN: 'llave-de-aplicacion-de-prueba',
              GLPI_USER_ID: 'consulta-prueba',
              GLPI_USER_PASS: 'clave-de-prueba-no-real',
              GLPI_TIMEOUT_MS: '1500',
            },
          },
        },
        {
          extends: true,
          test: {
            name: 'assistant',
            include: ['tests/assistant/**/*.test.ts'],
            env: { ...base, LLM_URL: `http://127.0.0.1:${llmPort}`, LLM_TIMEOUT_MS: '1500', MCP_URL: `http://127.0.0.1:${mcpPort}/mcp`, MCP_TIMEOUT_MS: '700' },
          },
        },
        {
          extends: true,
          test: {
            name: 'rrhh',
            include: ['tests/rrhh/**/*.test.ts'],
            env: { ...base, RRHH_API_URL: `http://127.0.0.1:${rrhhPort}`, RRHH_TIMEOUT_MS: '1500' },
          },
        },
        {
          extends: true,
          test: {
            name: 'rrhh-mantenimiento',
            include: ['tests/rrhh-mantenimiento/**/*.test.ts'],
            // Nadie escucha en el puerto 9: si la API le preguntara a RH Link, fallaría distinto de 503.
            env: { ...base, RRHH_API_URL: 'http://127.0.0.1:9', RRHH_TIMEOUT_MS: '500', RRHH_MANTENIMIENTO: 'true' },
          },
        },
        {
          extends: true,
          test: {
            name: 'wordpress',
            include: ['tests/wordpress-sync/**/*.test.ts'],
            env: { ...base, WP_SYNC_URL: `http://127.0.0.1:${wpPort}`, WP_SYNC_WINDOW_DAYS: '30', WP_SYNC_TIMEOUT_MS: '1500' },
          },
        },
      ],
    },
  }
})
