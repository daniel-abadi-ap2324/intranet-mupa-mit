# Intranet MUPA — API

Backend de la intranet de la Alcaldía de Panamá: **Node + Express 5 + TypeScript + Drizzle ORM + Zod + PostgreSQL**, organizado por features. Las convenciones (capas, DTOs, errores) están en [CONVENTIONS.md](CONVENTIONS.md) y se siguen siempre.

La SPA (`../mupa-intranet-app`) lo consume en `/api`. En producción la imagen de Docker trae la SPA compilada en `/app/public` (`PUBLIC_DIR`) y **esta misma API la sirve** en la raíz del sitio (`shared/middlewares/static-site.middleware.ts`: archivos con su caché, la SPA para las rutas sin extensión, nunca `/api/…`), con las cabeceras de seguridad de `security-headers.middleware.ts`. Todo va por el mismo origen y no hace falta CORS. Sin `PUBLIC_DIR` (en `npm run dev`) solo responde `/api`. `TRUST_PROXY` = cuántos proxies hay delante (0 por defecto: no se confía en `X-Forwarded-For`).

## Correr en local (sin Docker)

Se necesita Node 22.18 o más nuevo.

```bash
cp .env.example .env
npm install
npm run dev
```

La API queda en <http://localhost:3000/api>.

Sin `DATABASE_URL` se usa **PGlite**: un PostgreSQL real compilado a WASM que guarda en `./.data/pglite`, con las mismas migraciones que en Docker. Con `DB_AUTO_SETUP=true`, `SEED_DEMO_USERS=true` y `LOCAL_LOGIN_ENABLED=true` (ya vienen en `.env.example`), la base se prepara sola al arrancar e incluye las cuentas **ficticias**, con las que se puede entrar sin Identity Central:

| Cuenta | Rol | Contraseña |
|---|---|---|
| admin@ejemplo.test | admin | password |
| comunicacion@ejemplo.test | comunicacion | password |
| gestor@ejemplo.test | gestorSolicitudes | password |
| prueba1@ejemplo.test | funcionario | password |
| prueba2@ejemplo.test | funcionario | password |

Para usar un PostgreSQL de verdad, pon `DATABASE_URL=postgres://usuario:clave@servidor:5432/base`.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | API con recarga automática. Node ejecuta los `.ts` directamente. |
| `npm test` | Pruebas con Vitest y supertest contra la app real y un PostgreSQL en memoria (PGlite). |
| `npm run typecheck` | Revisa los tipos con TypeScript. |
| `npm run build` / `npm start` | Compila a `dist/` (con las migraciones y los datos iniciales) y lo ejecuta. |
| `npm run db:generate` | Después de cambiar `src/database/schema`, escribe la migración nueva en `src/database/migrations`. |
| `npm run db:migrate` | Aplica las migraciones pendientes. |
| `npm run db:seed` | Carga los datos iniciales que falten: catálogo (76 aplicaciones), contenido del Inicio y, con `SEED_DEMO_USERS=true`, las cuentas de prueba. |
| `npm run e2e:serve` | API con base en memoria para las pruebas de punta a punta del frontend. |

## Migraciones

1. Cambia el esquema en `src/database/schema/*.ts`.
2. Corre `npm run db:generate -- --name que-cambia`. Revisa el SQL generado y haz commit junto con el cambio.
3. Se aplican con `npm run db:migrate` o, en Docker, en el próximo `docker compose up --build`: el servicio `migrate` corre antes que la API.

Drizzle lleva el registro de las migraciones aplicadas en `drizzle.__drizzle_migrations`. No se edita una migración que ya se aplicó en algún lado: se crea otra.

## Docker

La imagen (`Dockerfile`) compila TypeScript y queda con dependencias de producción, sin root. La misma imagen sirve para dos cosas:
- `node dist/server.js` (la API, comando por defecto);
- `node dist/database/migrate.js && node dist/database/seed.js` (el servicio `migrate`).

Todo se levanta junto con `../docker-compose.yml`: PostgreSQL, migrate, api y web. Las instrucciones están en `../README.md`.

## Estructura

```text
src/
├── app.ts, server.ts
├── config/          env.ts (variables validadas con Zod), database.ts (Postgres o PGlite)
├── database/        schema/, migrations/, migrator.ts + migrate.ts, seeder.ts + seed.ts, seed-data/
├── shared/          errors/, middlewares/ (validate, error-handler), roles.ts, dtos/url.dto.ts (regla de enlaces),
│                    services/ (hash, token, identity-central: HTTP al central, identity-token: verificar JWT,
│                    llm: servidor de inferencia, event-bus: eventos en proceso), middlewares/rate-limit
└── features/
    ├── auth/          login, refresh, logout, sesión (cookie HttpOnly), middlewares authenticate (cookie o Bearer) / requireAuth / requireRole
    ├── users/         cuentas (lo usa auth) y su gestión por administración
    ├── departments/   departamentos (los asigna administración)
    ├── applications/  catálogo de aplicaciones
    ├── tags/          etiquetas del catálogo
    ├── home/          contenido y diseños del Inicio
    ├── announcements/ anuncios del Inicio (los gestiona Comunicación)
    ├── assistant/     asistente de búsqueda (solo lectura, con el servidor de inferencia)
    ├── notifications/ avisos en vivo (SSE) de solicitudes nuevas
    ├── audit/         auditoría de los eventos del bus (tabla event_audit)
    └── health/        chequeo de salud
```

## API

Todo cuelga de `/api`. Las respuestas no van envueltas y los errores siempre tienen esta forma:

```json
{ "error": "CODIGO", "message": "Texto para la persona", "fields": [{ "field": "email", "message": "…" }] }
```

`fields` solo aparece en `VALIDATION_ERROR` (400) y trae **todos** los campos inválidos. Un 500 responde siempre `INTERNAL_ERROR` sin detalles; el detalle queda en el log.

**Edición (`EDICION`).**
- `completa` (por defecto) monta todo.
- `publicacion` es la versión publicada: **no monta** `/announcements`, `/news`, `/videos`, `/forms`, `/requests` ni `/notifications` (responden 404, también para leer) y el seed no carga el contenido de muestra de lo que no existe (los formularios sí se cargan en la base, aunque no se vean). En el Centro de Gestión no trae cifras de solicitudes (`requests`). Boletines (`/bulletins` y `/files`) sí van, como en la intranet actual.
- Los formularios internos, las solicitudes y los avisos están apagados en `publicacion`; se reactivan sacándolos de `APAGADAS_EN_PUBLICACION` (`src/lib/edicion.ts` de la web) y con `EDICION=completa`.
- Tiene que coincidir con `VITE_EDICION` de la web. `docker-compose.yml` pasa la misma a las dos.
- Lo prueba el proyecto `publicacion` de vitest (`tests/publicacion/`).

### Sesión (`auth`) e Identity Central

El login es el de **Identity Central**, el login unificado de la Alcaldía (.NET + OpenIddict). La guía de integración es `GUIA_INTEGRACION_IDENTITY_PASSWORD.md` y la pide el equipo de Identity Central. Este backend hace de intermediario:
- la SPA manda usuario y contraseña;
- el backend pide los tokens con su `client_id` y `client_secret`;
- el navegador recibe solo la cuenta y la cookie `mupa_sesion` (HttpOnly, SameSite=Lax).

Los tokens del central y el secret **nunca llegan al navegador**.

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `POST /auth/login` `{ username, password }` | cualquiera | 200: la cuenta, y pone la cookie. |
| `POST /auth/refresh` | con sesión | 200: la cuenta con los datos al día (renueva contra el central). |
| `POST /auth/logout` | cualquiera | 204: borra la sesión y la cookie, y revoca el refresh token en el central. |
| `GET /auth/session` | cualquiera | La cuenta `{ id, email, emailVerified, firstName, lastName, roles, departmentId, tourSeenAt }`, o `null` sin sesión. `email` puede ser `null`. |
| `POST /auth/register` | cualquiera | 201: crea la cuenta en el central, abre la sesión y pone la cookie (ver abajo). |
| `POST /me/email/code` | con sesión | 200 `{ maskedEmail, expiresInMinutes }`: el central manda un código al correo **de la cuenta** (no acepta otro). Máx. 3 cada 10 min. |
| `POST /me/email/verify` `{ code }` | con sesión | 200: la cuenta con `emailVerified: true`. 400 `INVALID_EMAIL_CODE` si el código no sirve. |

`register`, `login`, `refresh` y `logout` no pasan por el middleware `authenticate`: sirven para obtener, renovar o cerrar la sesión. Todas las demás rutas sí.

**Verificación de funcionarios (RH Link).** Con `RRHH_API_USER` y `RRHH_API_PASSWORD` (más `RRHH_API_URL`), entrar y registrarse exigen que la cédula sea de un funcionario **ACTIVO** en RH Link (6-oct-2026, decisión de Daniel). La API entra a RH Link con esa cuenta de AD (`POST /api/login`, token reutilizado hasta que vence) y consulta `GET /empleados/cedula/:cedula`: 404 o estado distinto de `ACTIVA` → 403 `NOT_FUNCIONARIO`; de la ficha no se lee ni se guarda nada más que ese estado. Detalles:
- Solo en **Identity Central** y solo **al entrar** (renovar la sesión no vuelve a preguntar). Las cuentas locales de prueba no pasan por RH Link.
- La cédula sale de lo que la persona escribió o, si entró con el correo, del claim `identity_number` del token (nunca se guarda ni se escribe en logs). Si no hay forma de saberla: 403 `CEDULA_REQUIRED`.
- Se verifica **antes** de crear la cuenta o la sesión, y si se niega el paso se revoca el refresh token que el central acababa de emitir.
- **Falla cerrado:** si RH Link no responde (503 `RRHH_UNAVAILABLE`) o da error (502 `RRHH_ERROR`), nadie entra mientras tanto.
- En el registro se verifica antes de crear la cuenta en el central.
- **El departamento sale de RH Link:** de la ficha se toma el código de ubicación (`ubicacion_codigo`) y, si coincide con el `rrhhCode` de uno de los departamentos de la intranet (las 62 direcciones), la cuenta queda con ese departamento en cada ingreso (RH Link manda: si lo cambian de dirección, se actualiza solo). Por eso el registro ya no lo pide. Si el código no coincide con ninguno (o no hay verificación), no se toca y la intranet se lo pide a la persona al entrar (`PUT /me/department`, una sola vez).
- Sin `RRHH_API_USER`/`RRHH_API_PASSWORD` no se verifica y se entra como antes.
- Ojo: RH Link solo conoce a quien ya está en su planilla (una persona recién contratada puede tardar semanas en aparecer): hasta entonces no entra.

**Cédula de la persona (8-oct-2026, decisión de Daniel).** En cada ingreso por Identity Central se guarda en `users.cedula`, en texto, la cédula con que entró (o el claim `identity_number`). Es para administración: solo sale en `GET /api/users/:id` (rol admin) y sirve para buscar en `GET /api/users?q=`; nunca en la lista, en `/api/auth/me` ni en los logs. Las cuentas de prueba no tienen. «Borrar» la quita (`anonymize`) y «Reiniciar perfil» borra la fila. Las consultas por cédula a la Clínica y a códigos de llamada siguen usando SOLO la de la sesión (`sessions.cedula`, cifrada con la cookie), nunca esta columna.

**Registro (`/registro` en la web).** Sin aprobación. RH Link se usa para verificar la cédula (arriba) y después, para que cada persona conecte su cuenta de RRHH Express (ver `rrhh`).
- Body: `identityNumber` (cédula con guiones) y `password` (mín. 8) obligatorios, más `email` mientras el central lo exija; `firstName` y `lastName` son opcionales: con la verificación de RH Link salen de ahí (si RH Link no los trae o no hay verificación, 400 con esos campos y la web los pide). El orden del nombre de RH Link se configura con `RRHH_NOMBRE_ORDEN` (`nombres-primero` por defecto, o `apellidos-primero`); `email`, `mobile`, `phone`, `jobTitle`, `departmentId` opcionales (el departamento ya no se pide: sale de RH Link). Un opcional vacío (`""`) cuenta como no escrito.
- Llama a `POST /api/auth/register` del central con `applicationId` = `IDENTITY_CLIENT_ID` (así queda con el rol por defecto de la intranet), entra con la cédula y guarda aquí nombre, apellido, `phone`, `jobTitle` y `departmentId`. El celular va al central como `phoneNumber`.
- La cédula queda en `users.cedula` (como en cada ingreso; ver «Cédula de la persona») y nunca se escribe en logs.
- Los errores de validación del central vuelven como `VALIDATION_ERROR` con los campos de este body. Cédula o correo ya registrados → 409 `ALREADY_REGISTERED`. Departamento que no existe → 400 `DEPARTMENT_NOT_FOUND`, antes de crear nada en el central. Máx. 20 registros por hora por IP.
- Medido el 2026-09-29: el central todavía **exige el correo** ("El email es requerido"). Aquí es opcional para que, cuando el central lo deje opcional, solo cambie la web (`CORREO_OBLIGATORIO` en `src/paginas/Registro.tsx`).
- Sin `IDENTITY_URL`: 503 `REGISTRATION_UNAVAILABLE`.

**Cómo funciona:**
- **Login.** `username` es el usuario de Identity Central.
  - Con `LOCAL_LOGIN_ENABLED=true`, si coincide con el correo de una cuenta local (las ficticias), entra con esa cuenta. En ese caso hay bloqueo de 10 min después de 5 intentos fallidos.
  - El access token que devuelve el central se verifica antes de abrir la sesión.
- **Cuenta local.** Se enlaza por el `sub` del token (UUID) y se crea la primera vez que se ve.
  - El correo y el nombre se fusionan: nunca se borran porque un token no los traiga.
  - `identity_number` (puede ser la cédula) no se guarda.
  - El nombre y el apellido no se pisan si el nombre completo del token es el mismo: el central solo guarda el nombre completo y lo partiría distinto ("Juan" + "Carlos Pérez").
- **Roles.** Salen del `app_role`, nunca del `role` global. La tabla está en `src/shared/roles.ts` y **hay que acordar esos nombres con el equipo de Identity Central**:
  - `Admin` → `admin`;
  - `Comunicacion` → `comunicacion`;
  - `GestorSolicitudes` → `gestorSolicitudes`;
  - `User` → `funcionario`;
  - cualquier otro → `funcionario`.
- **Sesión.** Dura `SESSION_TTL_HOURS`. Guarda el refresh token del central, cifrado con AES-256-GCM y una clave que sale de la cookie.
  - Cuando vence el access token (1 h), la siguiente petición renueva sola: el refresh token rota y los roles se actualizan.
  - Si el central ya no la acepta, la sesión se cierra. Si no responde, esa petición va sin sesión y se reintenta en la siguiente.
- **Logout.** Un 4xx del central al revocar cuenta como salida exitosa. Si no responde, la sesión local igual se cierra.

**`Authorization: Bearer`** (Postman, otras aplicaciones de la Alcaldía): cualquier ruta acepta un access token de Identity Central en vez de la cookie.
- Se verifica en cada petición:
  - firma RS256 (fijado) contra el JWKS, cacheado 10 minutos;
  - `iss` exacto, con la barra final;
  - `typ` at+jwt;
  - `exp`;
  - que `client_id` esté en `ALLOWED_CLIENT_IDS`.
- **No** se valida `aud`: el access token no lo trae.
- El `app_role` solo cuenta si el token es de la propia intranet. El de otra app permitida es su rol en esa app: identifica, pero no da permisos.

**Errores del login y del Bearer:**

| Situación | Respuesta |
|---|---|
| Faltan campos | 400 `VALIDATION_ERROR` |
| Usuario o contraseña incorrectos | 401 `INVALID_CREDENTIALS` |
| Sin rol en la intranet | 403 `APP_ACCESS_DENIED` |
| `client_id`/secret/scopes mal configurados, o un token recién emitido que no valida | 500 `INTERNAL_ERROR` (la pista queda en el log) |
| Error interno del central, o respuesta que no es JSON | 502 `IDENTITY_ERROR` |
| El central no responde | 503 `IDENTITY_UNAVAILABLE` |
| Sesión vencida o revocada (refresh) | 401 `SESSION_EXPIRED` |
| Bearer inválido o vencido | 401 `INVALID_TOKEN` / `TOKEN_EXPIRED` |
| Bearer de una app no permitida | 403 `CLIENT_NOT_ALLOWED` |

> Medido en el servidor de desarrollo el 2026-09-24: una contraseña mala o un usuario inexistente dan **401** con el formato propio del central (`{ statusCode, message }`), no `400 invalid_grant` como dice la guía. Se aceptan los dos. Solo el mensaje "No tienes acceso a esta aplicación" distingue la falta de acceso.

**Variables (en `.env`, nunca en git):**

| Variable | Qué es |
|---|---|
| `IDENTITY_URL` | Base para llamar al central. Es independiente del issuer: en producción el central está detrás de un proxy con prefijo (§7.6). |
| `IDENTITY_CLIENT_ID` | El `client_id` de la intranet. |
| `IDENTITY_CLIENT_SECRET` | El secret del cliente. |
| `IDENTITY_SCOPES` | Por defecto `openid profile email offline_access roles`. Nunca `phone` ni `address`. |
| `IDENTITY_TIMEOUT_MS` | Espera máxima por respuesta del central (10 s por defecto). |
| `JWT_ISSUER` | Issuer esperado en los tokens, con la barra final. |
| `JWT_JWKS_URI` | Dirección del JWKS. |
| `ALLOWED_CLIENT_IDS` | `client_id` aceptados. Debe incluir el propio. |
| `LOCAL_LOGIN_ENABLED` | `true` = también entran las cuentas locales ficticias. Nunca en el servidor real. |

Al arrancar se valida la configuración: issuer sin la barra final, whitelist sin el `client_id` propio, scopes `phone`/`address`, o sin ninguna forma de entrar → el proceso no arranca y dice qué falla.

**Pruebas.** `npm test` incluye el proyecto `identity`, contra un Identity Central falso (`tests/identity/fake-identity.ts`). Ese falso imita el comportamiento medido del real: tokens, rotación, claims de menos en el refresh y formatos de error. No hace falta estar en la red de la Alcaldía.

### Catálogo (`applications`, `tags`)

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /applications` | cualquiera | Lista de aplicaciones que esa persona puede ver (ver abajo). |
| `GET /applications?includeDrafts=true` | admin | Incluye los borradores. Para cualquier otra persona, 403. |
| `GET /applications/:id` | cualquiera | Una aplicación. 404 `APPLICATION_NOT_FOUND` si no existe o no la puede ver. |
| `POST /applications` | admin | 201. Campos: `name`, `description` (máx. 160), `area`, `url?`, `icon?`, `tagIds?`, `access?`, `status?`, `external?`, `pdf?`, `featured?`, `confirmed?`, `keywords?`, `note?`, `published?`. El `slug` se genera del nombre y no cambia. |
| `PATCH /applications/:id` | admin | 200. Los mismos campos, todos opcionales (al menos uno). `tagIds` reemplaza las etiquetas. |
| `DELETE /applications/:id` | admin | 204. |
| `GET /tags` | cualquiera | `[{ id, name, audience }]` |

Reglas del catálogo:
- **Sin sesión** se ven solo las publicadas y sin las de acceso `sesion` (los paneles de administración).
- **Con sesión** se ven todas las publicadas.
- **Por departamento:** una aplicación con departamentos (`departmentIds`) solo la ven las personas de esos departamentos y administración, tampoco por id (404). Sin sesión nunca se ve. Sin departamentos, la ven todos según `access`. Solo administración recibe `departments` en la respuesta.
- Administración puede pedir `GET /applications?department=ID`: lo que ve una persona de ese departamento. Para cualquier otra persona, 403.
- Las de acceso `red-interna` salen con `url: null` para quien no edita el catálogo. Una aplicación que **sí** debe mostrar su enlace pero solo abre dentro de la Alcaldía (SIGEX, Legal y Justicia) lleva acceso `todos` y estado `solo-red-interna`: la tarjeta muestra la etiqueta «Solo red interna» y el enlace. La nota interna (`note`) solo la ve quien lo edita.
- La `url` debe empezar con `https://`/`http://` o ser una ruta de la intranet (`/…`). Se acepta `http` porque hay sistemas que todavía no tienen https. **No se aceptan barras invertidas** (`/\…` el navegador lo lee como `//…`; 400 con el campo `url`). Una **IP o un nombre interno** (sin dominio, `localhost`, `.local`) solo se acepta si la aplicación queda en estado `solo-red-interna`; si no, 400 `INTERNAL_LINK_NOT_ALLOWED` (también al cambiar el estado de una que ya la tiene).
- Dos aplicaciones no pueden tener la misma URL (409 `URL_ALREADY_USED`). Una etiqueta que no existe da 400 `TAG_NOT_FOUND`.
- Valores posibles:
  - `area`: Trámites, Soporte, Personal, Atención, Finanzas u Operaciones;
  - `access`: todos, sesion o red-interna;
  - `status`: publicado, pendiente o solo-red-interna.

### Departamentos y personas (`departments`, `users`)

Todo es solo de administración (`admin`), salvo `GET /departments/options`.

| Método y ruta | Respuesta |
|---|---|
| `GET /departments/options` | Pública: `[{ id, name }]` por nombre, para elegir el propio al registrarse. |
| `GET /departments` | `[{ id, name, users, applications }]`: cuántas personas y cuántas aplicaciones restringidas tiene cada uno. |
| `POST /departments` | 201. `{ name }`. 409 `DEPARTMENT_NAME_TAKEN` si ya existe. |
| `PATCH /departments/:id` | 200. `{ name }`. |
| `DELETE /departments/:id` | 204. 409 `DEPARTMENT_IN_USE` si tiene personas o aplicaciones: primero hay que cambiarlas. |
| `GET /users?department=&withoutDepartment=true&q=` | Personas que ya entraron alguna vez: `{ id, email, firstName, lastName, roles, departmentId, departmentName, source (identity o local), lastLoginAt, createdAt }`. `q` busca en nombre, apellido, correo y cédula (la cédula no sale en la lista). |
| `GET /users/:id` | admin. La ficha completa, todo menos la contraseña: lo de la lista más `cedula`, `identitySub`, `emailVerified`, `phone`, `jobTitle`, `failedLoginAttempts`, `lockedUntil`, `tourSeenAt`, `updatedAt`, `activeSessions`, `requests`, `openRequests` y `rrhh` (consulta en vivo a RH Link con su cédula, nada se guarda: `status` = `found` con `active`, `fullName`, `locationCode` y `locationDepartment`, o `unconfigured`, `no-cedula`, `not-found`, `error`; si RH Link cae, la ficha sale igual). 404 `USER_NOT_FOUND`. |
| `PATCH /users/:id` | 200. Solo `{ departmentId }` (o `null`). 400 `DEPARTMENT_NOT_FOUND` si no existe. Los roles no se cambian aquí: vienen de Identity Central. |
| `POST /users/:id/suspend`, `POST /users/:id/reactivate` | admin. 200 con la persona (`suspendedAt`). Suspendida: no entra y se cierran sus sesiones (403 `ACCOUNT_SUSPENDED`). 409 `CANNOT_MODIFY_SELF` con la propia cuenta. |
| `DELETE /users/:id` | admin. 204. Borra la cuenta y sus solicitudes (las citas de la Clínica no, viven en su sistema). Cuenta local de prueba: se borra del todo. Cuenta de Identity Central: con `IDENTITY_ADMIN_USER` e `IDENTITY_ADMIN_PASSWORD` (cuenta de servicio de la API) se le quita el acceso a la intranet allá (`POST /api/user-applications/revoke`, con `applicationId` = `IDENTITY_CLIENT_ID`; si falla, 502 `IDENTITY_ADMIN_FAILED` y no se borra nada aquí) y queda un registro mínimo bloqueado (`deletedAt`; el `sub`, sin datos) para que no se recree al entrar (403 «cuenta eliminada»). Sin la cuenta de servicio, solo el bloqueo local. |

- Los departamentos son las 62 direcciones de RRHH (cabeceras activas de `MUNICIPIO.dbo.ubicaciones`), en `seed-data/departamentos.json` con su `codigoRrhh`. El seed las carga una sola vez; después los maneja administración. Para regenerar la lista (y la de cargos de la web): `RRHH_MIGRACION_URL=http://… node scripts/importar-rrhh.mjs` (la URL es interna: nunca en el repo). Esas tablas están desactualizadas: **no se usan para validar cédulas**.
- La migración `0012` borró los 35 departamentos del directorio viejo que nadie usaba.
- La sesión (`/auth/session`, `/auth/login`) trae `departmentId`.

### Inicio (`home`)

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /home/content` | cualquiera | Contenido del Inicio (noticias, enlaces…). Los anuncios van aparte: `/announcements`. |
| `GET /home/layout` | cualquiera | `{ personal, default }`: el diseño propio (null sin sesión o si no personalizó) y el de todos (null = el de la propuesta). |
| `PUT /home/layout` `{ layout }` | con sesión | Guarda el diseño propio; `null` vuelve al de todos. |
| `PUT /home/default-layout` `{ layout }` | admin | Diseño por defecto para todos; `null` vuelve al de la propuesta. |

Un diseño tiene la forma `{ v: 1, items: [{ id, uid, ancho, cfg? }] }`:
- hasta 30 bloques, sin `uid` repetidos;
- `ancho` es tercio, media, dos-tercios o completa;
- textos cortos y sin `<` ni `>`;
- enlaces de `cfg.links` solo `http`/`https`.

El catálogo de bloques lo define el frontend (`src/lib/bloques.ts`), que al leer descarta los que ya no existen.

### Recorrido para usuarios nuevos (`me/tour`)

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `PUT /me/tour` | con sesión | 204. Marca que la persona vio (o saltó) el recorrido del Inicio. Se guarda la primera fecha (`users.tour_seen_at`). |

La cuenta (`/auth/session` y el login) trae `tourSeenAt`: `null` mientras no lo haya visto. Sin sesión, el Inicio lo recuerda en el navegador (`mupa_recorrido`).

### Clínica (`clinic`)

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /clinic` | cualquiera | `{ services, specialties, closedWeekdays, bookingWindow: { minDays, maxDays }, source, updatedAt }` |

- Lee el **catálogo público** del sistema de citas de la Clínica (`CLINIC_URL`, por defecto `https://clinica.mupa.gob.pa`): servicios, especialidades, días sin atención (0 = domingo) y con cuántos días de anticipación se puede reservar. Nunca consulta pacientes ni citas.
- La lectura se guarda **1 hora** en memoria. Si la Clínica no responde, se sigue mostrando la última lectura buena (`source: clinic`, con su `updatedAt`); si nunca respondió, la copia de respaldo de `clinic.constants.ts` (`source: fallback`), y no se reintenta hasta dentro de 5 minutos.
- Variables: `CLINIC_URL` y `CLINIC_TIMEOUT_MS` (5 s por defecto). En las pruebas apuntan a una dirección sin servidor, así que nunca salen a internet.

### Anuncios (`announcements`)

Los anuncios institucionales del Inicio. Los publica Comunicación desde el panel de la intranet (`/gestion/anuncios`).

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /announcements` | cualquiera | Los vigentes hoy, urgentes primero: `[{ id, title, body, level, link, publishFrom, publishUntil }]`. |
| `GET /announcements/manage` | admin, comunicacion | Todos, con `status`, `state` (vigente, programado, vencido, borrador o retirado), `updatedAt` y `updatedByName`. |
| `POST /announcements` | admin, comunicacion | 201. Campos: `title` (máx. 120), `body?` (máx. 500), `level?`, `link?`, `status?`, `publishFrom?`, `publishUntil?`. |
| `PATCH /announcements/:id` | admin, comunicacion | 200. Los mismos campos, todos opcionales (al menos uno). |
| `DELETE /announcements/:id` | admin, comunicacion | 204. 404 `ANNOUNCEMENT_NOT_FOUND` si no existe. |

Reglas:
- **Solo texto.** No se acepta HTML y el frontend nunca lo interpreta.
- **Vigente** = `status: publicado` y hoy está entre `publishFrom` y `publishUntil`, las dos inclusive. "Hoy" es la fecha de Panamá, aunque el servidor esté en UTC.
- **Fechas:** son `AAAA-MM-DD`, sin hora. Sin `publishFrom` empieza hoy; sin `publishUntil` no vence. Si la final es anterior a la de inicio, da 400 `INVALID_DATES`.
- **Retirar** (`status: retirado`) lo saca del Inicio sin borrarlo.
- El `link` sigue la regla del catálogo, pero **solo `https://`** (lo ve todo el personal): `https://…` o una ruta `/…`, sin IPs, nombres internos ni barras invertidas.
- Valores posibles:
  - `level`: urgente, importante o normal (por defecto normal);
  - `status`: borrador, publicado o retirado (por defecto borrador).

### Contenido de Comunicación (`bulletins`, `news`, `videos`, `files`, secciones del Inicio)

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /bulletins`, `/news`, `/videos` | cualquiera | Lo publicado. Boletines y noticias del más nuevo al más viejo; videos: instructivos, canal y otros. |
| `GET /{bulletins,news,videos}/manage` | admin, comunicacion | Todo, con `published` (o `status` en noticias), `updatedAt` y `updatedByName`. |
| `POST`, `PATCH /:id`, `DELETE /:id` | admin, comunicacion | Boletín: `date`, `pdfUrl?`, `flipbookUrl?`, `note?`, `published?`. Noticia: `title`, `summary?`, `type` (noticia o tip), `date`, `link?`, `imageUrl?`, `status` (borrador o publicado). Video: `title`, `url`, `category` (instructivo, canal u otro), `description?`, `date?`, `published?`. Los enlaces siguen la regla del catálogo. |
| `POST /files` | admin, comunicacion | 201 `{ id, url, originalName, mimeType, size }`. El cuerpo es el archivo tal cual (`Content-Type: application/octet-stream`) y el nombre va en `X-File-Name` (codificado). Solo PDF, JPG, PNG o WebP, reconocidos por sus primeros bytes (400 `FILE_TYPE_NOT_ALLOWED`); hasta 10 MB (413). |
| `GET /files/:id/:nombre` | cualquiera | El archivo, con su tipo y `X-Content-Type-Options: nosniff`. |
| `PUT /home/content/{intro,frecuentes,campanas,enlaces}` | admin, comunicacion | `{ value }` con la forma de esa sección; reemplaza solo esa sección. |

- En una base nueva se cargan los 35 boletines, 16 noticias y 24 videos del sitio actual (`seed-data/`). Después los maneja Comunicación.
- Los archivos se guardan en `UPLOADS_DIR` (por defecto `./.data/uploads`; en Docker, el volumen `uploads`). Hay que respaldarlos junto con la base.

### Formularios (`forms`)

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /forms` | cualquiera | Los publicados, por área y número: `{ slug, number, title, area, destination, deadline, intro, notes, changes, sections, accepting }`. |
| `GET /forms/:slug` | cualquiera | Uno publicado. 404 `FORM_NOT_FOUND`. |
| `GET /forms/manage` | admin, gestorSolicitudes | Todos, con `id`, `published`, `updatedAt` y `updatedByName`. |
| `POST /forms`, `PATCH /forms/:id`, `DELETE /forms/:id` | admin, gestorSolicitudes | Campos: `title`, `number?` (sin número, el siguiente libre), `area`, `destination?`, `deadline?`, `intro?`, `notes?`, `sections`, `accepting?`, `published?`. El slug sale del título y no cambia. |

- `sections` es la definición completa (el formato de `mupa-intranet-app/src/lib/formularios.ts`) y se valida entera: tipos conocidos, opciones en listas y opción única, casillas y listas con contenido, claves en minúsculas.
- Una sección con `show` tiene que depender de una opción única (con esa `k` y esa opción) de una sección anterior: si no, 400 `INVALID_FORM_CONDITION`.
- **`accepting`** es el interruptor "Recibe solicitudes". No se puede prender si el formulario pide cédula (409 `FORM_HAS_CEDULA`): la intranet no guarda cédulas.
- En una base nueva se cargan los 10 formularios del sitio actual (`seed-data/formularios.json`), sin recibir solicitudes.

### Solicitudes (`requests`)

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `POST /requests` | con sesión | 201. `{ form: slug, respuestas: { v, c, i } }` (lo que arma la web). 409 `FORM_NOT_ACCEPTING` si el formulario no recibe solicitudes; 400 con `fields` (`respuestas.<ruta>`) si algo no cumple; 429 `TOO_MANY_REQUESTS` pasadas 10 en una hora. |
| `GET /requests/mine` | con sesión | Las de la persona, con `unread` (el Gestor respondió o cambió el estado y todavía no la abrió). |
| `GET /requests/:id` | quien la envió, o un gestor | Detalle: `summary` (lo que se pidió) y `events` (creada, estado, mensaje). Si la abre quien la envió, queda leída. |
| `GET /requests/manage?form=&status=&area=&q=&overdue=` | gestores | La bandeja, con la persona y su departamento. `q` busca por folio, persona, correo o formulario; `area=rrhh`, solo las de formularios de Recursos Humanos; `overdue=true`, solo las atrasadas (abiertas y sin movimiento en 3 días, como en el Centro de Gestión). |
| `PATCH /requests/:id` | gestores | `{ status }`: recibida, en_revision, resuelta o rechazada. Queda en la línea de tiempo. |
| `POST /requests/:id/messages` | gestores | `{ body }` (solo texto, hasta 2000): la respuesta a la persona. |

- **Gestores** = `admin`, `comunicacion` y `gestorSolicitudes` (`GESTORES` en `shared/roles.ts`): por ahora todos atienden todas las solicitudes (`TODOS_VEN_TODO`). Los formularios los siguen creando solo admin y gestorSolicitudes.
- Las respuestas se revisan en el servidor con la definición del formulario (`requests.validation.ts`, la misma lógica y los mismos mensajes que `mupa-intranet-app/src/lib/formularios.ts`). Lo de secciones ocultas no se guarda; el nombre y el correo salen de la sesión.
- Cada solicitud guarda una copia del formulario tal como estaba al enviarla. Un formulario con solicitudes no se puede borrar (409 `FORM_HAS_REQUESTS`): se oculta.
- El folio es `SOL-AAAA-NNNNNN`. Todavía no se manda correo: la respuesta le llega a la persona en la intranet ("Mis solicitudes" y la campana).
- Al guardarse una solicitud (después del commit) se emite el evento `solicitud.creada` en el bus. Un envío de prueba (409) no emite nada.

### Centro de Gestión (`gestion`)

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /gestion/panel` | gestores | Las cifras del Centro de Gestión (`/gestion` en la web): `requests` (por estado, abiertas, atrasadas, horas hasta la primera respuesta, recibidas y resueltas en el periodo, serie por día, por área y por formulario, las atrasadas más viejas), `communication` (anuncios por estado y los que vencen en 7 días, noticias, videos, boletines), `administration` (usuarios, aplicaciones, departamentos) y `activity` (lo último que pasó). |

- Periodo: 30 días. Atrasada = abierta (recibida o en revisión) y sin respuesta ni cambio de estado del personal en 3 días. Constantes en `gestion.service.ts`.
- Cada sección se arma con el servicio de su feature. En la edición `publicacion` no vienen `requests`, anuncios, noticias ni videos.
- Áreas: `AREAS_GESTION` en `shared/roles.ts` dice qué roles ven cada área (solicitudes, rrhh, comunicacion, administracion). Por ahora `TODOS_VEN_TODO`: cualquier gestor ve todo. RRHH son los formularios con área «Recursos Humanos» o «RRHH».

### Bus de eventos (`shared/services/event-bus.service.ts`)

Eventos **dentro del proceso** (`node:events`), sin Redis ni colas: quien emite no conoce a quien escucha.
- `eventBus.emit(tipo, datos, actorId)` entrega en el siguiente tick (`setImmediate`): quien emite no espera. Cada evento va en un sobre `{ id (uuid), tipo, actorId, fecha, datos }`.
- `on(tipo, fn)` escucha un tipo; `onAny(fn)` todos (lo usa la auditoría). Los dos devuelven la función para dejar de escuchar. Si un listener falla, se registra en el log y no afecta a los demás ni a quien emitió.
- Eventos y quién los escucha:

| Evento | Lo emite | Lo escuchan |
|---|---|---|
| `solicitud.creada` `{ id, folio, formulario, area, solicitante, fecha }` | `requests` (al guardar) | `notifications` (aviso en vivo), `audit` |
| `usuario.ficha_vista` `{ userId }` | `users` (al abrir `GET /api/users/:id`; el actor es quien la abrió) | `audit` (queda como `user:<id>`: `GET /api/audit/events?subject=user:7`). Nunca lleva la cédula. |
| `aplicacion.visibilidad_cambiada` `{ applicationIds }` | `applications` (al guardar `PUT /api/applications/departments`; el actor es el administrador) | `audit` (sin sujeto; solo ids de aplicaciones). |
| `rrhh.conectado` `{ tipo: 'sesion' \| 'invitado' }` | `rrhh` (al conectar RRHH Express; el actor es la persona si hay sesión) | `audit` (sin sujeto). Nunca lleva cédula, nombre ni contraseña. |

- **Límite:** solo sirve con **una** instancia de la API. Con varias réplicas, cada una vería solo sus propios eventos y sus propias conexiones; ahí sí haría falta algo como Redis.

### Notificaciones en vivo (`notifications`)

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /notifications/stream` | gestores | Server-Sent Events (`text/event-stream`). 401 sin sesión, 403 con otro rol y 429 `TOO_MANY_STREAMS` pasadas 5 conexiones de la misma persona, en JSON y antes de abrir el stream. |

- Mensajes: `event: solicitud.creada` con `data:` `{ id, folio, formulario, area, solicitante, fecha }`. Nunca van las respuestas del formulario. Quien envió la solicitud no recibe su propio aviso.
- Empieza con `retry: 5000`. Manda un latido (`: ping`) cada 25 s y cierra el stream a los 15 min: el navegador reconecta solo y vuelve a pasar por la autenticación, así un logout o un cambio de rol dejan de recibir en como mucho 15 min.
- Solo en vivo, sin historial: quien no estaba conectado ve las nuevas en `/me/summary` (`newRequests`).
- La respuesta lleva `X-Accel-Buffering: no`, por si un nginx la publica (el del servidor): así no retiene los avisos. Al apagar, `server.ts` cierra los streams antes de `server.close()`.
- Solo en la edición `completa`. Constantes en `notifications.constants.ts`.

### Auditoría de eventos (`audit`)

Cada evento del bus queda en la tabla **`event_audit`**: `id` (el del sobre), `type`, `actor_id` (quién lo provocó), `subject_type` + `subject_id` (por ejemplo `request` + id de la solicitud), `payload` (los datos del evento, sin cédula ni respuestas del formulario), `delivered_count` (a cuántas personas se les entregó en vivo) y `created_at`.

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /audit/events?type=&subject=request:123&limit=` | admin | Los eventos, del más nuevo al más viejo (`limit` hasta 500, 100 por defecto). |

- La fila del evento y el conteo de entregas son upserts por `id`: no importa cuál se escribe primero.
- Si escribir la auditoría falla, queda en el log y no rompe ni el envío ni el aviso.
- Se monta en las dos ediciones. Todavía no tiene pantalla.

### Asistente de búsqueda (`assistant`)

Buscador en lenguaje natural, **de solo lectura**. La persona pregunta, por ejemplo "¿dónde pido vacaciones?", y recibe un texto corto más las aplicaciones del catálogo que le sirven. Nunca escribe datos ni hace nada a nombre de la persona.

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `POST /assistant/ask` `{ question }` (2 a 300 caracteres) | cualquiera | `{ answer, applications }`. `applications` es una lista de hasta 5 slugs del catálogo. |
| `GET /assistant/status` | cualquiera | `{ available }`: si hay servidor de inferencia configurado (`LLM_URL`). No lo consulta. El Inicio lo usa para ofrecer o no "Preguntar al asistente". |

**Cómo funciona:**
- El modelo corre en el **servidor de inferencia de la Alcaldía** (vLLM, API compatible con OpenAI). Solo responde desde la red interna y no tiene autenticación propia.
  - El navegador nunca lo ve: esta API hace de intermediaria.
  - Su dirección va solo en `.env`.
- A cada pregunta se le manda el catálogo que **esa persona** puede ver, el mismo de `GET /applications`:
  - sin sesión, sin las de acceso `sesion`;
  - nunca borradores.
  - ~80 aplicaciones caben de sobra en el contexto del modelo, así que no hace falta búsqueda vectorial.
- La salida se pide con `response_format: json_schema`: el servidor restringe la generación a ese schema. Al llegar se vuelve a validar con Zod.
- **El modelo solo propone.** Se quitan los slugs que no existen en ese catálogo y los repetidos. Nunca llega al navegador un enlace inventado.
- **Límite:** 15 preguntas cada 10 minutos por persona (por cuenta, o por IP sin sesión). El contador vive en memoria del proceso: con varias réplicas de la API haría falta un almacén compartido.
- **Logs:** nunca se registra el texto de las preguntas ni de las respuestas.

**Errores:**

| Situación | Respuesta |
|---|---|
| Pregunta vacía, muy corta o muy larga | 400 `VALIDATION_ERROR` |
| Más de 15 preguntas en 10 minutos | 429 `RATE_LIMITED`, con `Retry-After` |
| `LLM_URL` no configurada | 503 `ASSISTANT_UNAVAILABLE` |
| El servidor de inferencia no responde, o tarda más de `LLM_TIMEOUT_MS` | 503 `LLM_UNAVAILABLE` |
| Error del servidor de inferencia, o respuesta que no es JSON con la forma pedida | 502 `LLM_ERROR` |

**Variables (en `.env`):**

| Variable | Qué es |
|---|---|
| `LLM_URL` | Base del servidor de inferencia. Vacía = asistente apagado; el resto de la intranet funciona igual. |
| `LLM_MODEL` | Opcional. Sin ella se usa el único modelo cargado en el servidor. |
| `LLM_TIMEOUT_MS` | Espera máxima por respuesta del modelo (30 s por defecto). |

**Pruebas.** `npm test` incluye el proyecto `assistant`, que usa un servidor de inferencia falso (`tests/assistant/fake-llm.ts`).

### Catálogo de endpoints para el MCP (`meta`)

Describe la propia API —sus endpoints y las páginas de la intranet— para el servidor MCP (`../mupa-intranet-mcp`, Python), que se lo ofrece al asistente. **No es para personas**: `GET /api/meta/catalog` pide la cabecera `X-Internal-Key` con `MCP_INTERNAL_KEY` (sin esa variable, la ruta no existe: 404; nginx tampoco la deja pasar desde afuera).

- Las rutas se averiguan **solas**: `app.ts` monta cada router con `mount()` (queda en `shared/route-registry.ts`) y `requireRole` / `requireAuth` / `validate` se dejan marcados (`requiredRoles`, `requiresSession`, `validates`), así que los roles y lo que recibe cada endpoint (los DTO como JSON Schema) salen del código, sin repetirlos a mano.
- La descripción en español de cada endpoint, su área, a qué página de la intranet corresponde y sus palabras clave están en `src/features/meta/endpoint-docs.ts`. `tests/meta.test.ts` exige que **toda ruta montada tenga su entrada y que ninguna sobre**: al agregar o quitar un endpoint, se actualiza ese archivo en el mismo cambio.
- Lleva también las páginas y los datos confirmados del asistente (`assistant.knowledge.ts`), según la edición que corre (en `publicacion` no salen las noticias, formularios, etc.).
- `npm run catalogo:exportar` escribe el catálogo en `../mupa-intranet-mcp/catalog.snapshot.json` (la copia de respaldo del MCP); una prueba avisa si quedó atrás.
- El asistente le pide pistas al MCP antes de preguntarle al modelo (`MCP_URL`, `shared/services/mcp-client.service.ts`): si el MCP no responde, contesta igual.

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /meta/catalog` | servicio interno (`X-Internal-Key`) | 200 `{ version, generatedAt, edition, endpoints: [{ id, method, path, area, summary, accessLevel, roles, access, page, keywords, request: { params, query, body } }], pages, facts }`. 401 `INVALID_INTERNAL_KEY`; 404 si no hay `MCP_INTERNAL_KEY`. |

### Sincronización con mupa.gob.pa (`wordpress-sync`)

Trae solos, de las páginas **públicas** de mupa.gob.pa (WordPress; solo lee, nunca escribe), las **noticias** (en las dos ediciones) y los **boletines «AlcalDía»** (en las dos ediciones). Apagada sin `WP_SYNC_URL`.

- Noticias: la REST API del sitio (`/wp-json/wp/v2/posts`, filtrada por `after` y, si se quiere, `categories`). Entran **publicadas**, con título, resumen (sin HTML), fecha, enlace a la noticia en mupa.gob.pa y la foto copiada a la intranet (`/api/files/…`: la CSP no deja cargarla desde otro sitio). No se importa el contenido, el autor ni las etiquetas.
- Boletines: los flipbooks no están en la REST API y sus PDF salen ocultos en `/media`, así que se leen el RSS `/3d-flip-book/feed/` (5 por página) y la página de cada boletín (el bloque `FB3D_CLIENT_DATA` del plugin 3D FlipBook trae la URL del PDF). Se baja el PDF (solo de `/wp-content/uploads/` del mismo sitio, máx. 10 MB, validado por sus primeros bytes) y se dibuja su página 1 como portada (`pdfjs-dist` + `@napi-rs/canvas`). La fecha sale del título («30 de septiembre. 2026»); si no se entiende o difiere más de 45 días de la publicación, la de publicación (hora de Panamá). Si ya hay un boletín con esa fecha (cargado a mano o de la intranet anterior), se omite.
- Solo **agrega**: cada elemento guarda su `source_id` (`wp-post-<id>`, `wp-flipbook:<slug>`) y no se vuelve a importar ni se pisa lo que Comunicación edite u oculte. Si Comunicación **elimina** uno, la siguiente pasada lo trae de nuevo mientras esté dentro de la ventana: para quitarlo, «Ocultar».
- Cada `WP_SYNC_INTERVAL_MINUTES` mira los últimos `WP_SYNC_WINDOW_DAYS` días (un temporizador en la API, sin colas: **una sola instancia**). Un elemento malo (PDF falso, página sin datos) se anota en `errores` y no frena a los demás; sin portada es un `aviso`.

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /wordpress-sync/status` | admin, comunicacion | 200 `{ enabled, running, intervalMinutes, windowDays, last }` (`last`: la última pasada). |
| `POST /wordpress-sync/run` | admin, comunicacion | 202 con el estado (`running: true`): la pasada sigue **en segundo plano** (la primera puede tardar minutos, más que el límite de nginx). Se pregunta `GET /status` hasta `running: false`; `last` = `{ startedAt, finishedAt, noticias, boletines }`, cada sección `{ nuevos, omitidos, avisos, errores }` (`noticias: null` en publicación). 503 `WP_SYNC_DISABLED`; 409 `WP_SYNC_RUNNING`. |

**Pruebas.** `npm test` incluye el proyecto `wordpress`, que usa un WordPress falso (`tests/wordpress-sync/fake-wordpress.ts`).

### Directorio y central telefónica (`directory`)

`GET /api/directory` (cualquiera) devuelve el directorio telefónico (`personas`: nombre, apellido, dirección, extensión y ubicación), `actualizadoEn` y `fuente`. Las visitas leen la última copia guardada en la base; **nunca llaman a la central**.

- Con `UCM_URL`, `UCM_USER` y `UCM_PASSWORD` (los de *Integraciones > Configuración de API* de la central Grandstream UCM; solo en el `.env`), la API copia las extensiones al arrancar y cada `UCM_SYNC_MINUTOS` (60; 0 = nunca sola). Solo lectura: `challenge`, `login` (MD5 del challenge + contraseña), `listAccount` por páginas y `logout`.
- **Ley 81**: de cada cuenta se guarda solo la extensión y el nombre (`directorio_extensiones`); lo demás que devuelve la central (IP, correo, MAC, secretos SIP…) se descarta antes de guardar.
- Se publica lo que dice la central (decisión de Daniel, 27-oct-2026): cada extensión con nombre, con el nombre de la central (de MAYÚSCULAS a nombre normal; la primera palabra es el nombre y el resto el apellido). La central no sabe la dirección ni la ubicación: salen del directorio fijo (`mupa-intranet-app/src/data/directorio-personas.json`) para esa extensión, y una extensión nueva sale sin dirección. Si la persona es la misma del directorio fijo (primer nombre y primer apellido), queda su fila con tildes. Las cuentas sin nombre no salen. Si la copia cubre menos de la mitad del directorio fijo (respuesta incompleta), se muestra el fijo.
- Si una pasada falla o llega vacía, la copia anterior se queda y se reintenta en la siguiente. Si la central rechaza el usuario o la contraseña (estado -37), **no se reintenta hasta reiniciar la API**: cada intento fallido acerca el bloqueo de la cuenta de la central.
- `UCM_TLS_VERIFICAR=false` acepta el certificado autofirmado de la central solo en ese cliente (su propio agente HTTPS); el resto de la API sigue verificando TLS.
- `GET /api/directory/comparison` (solo administración): extensiones nuevas en la central, las del directorio que ya no están en la central, los nombres distintos y el estado de la sincronización (última buena, último intento, error). Sirve para ver qué cambió respecto de la intranet vieja.

### Clínica: «Mis citas» (`clinic`)

`GET /clinic/appointments?from=&to=` (con sesión): las citas de la persona en el sistema de la Clínica (`GET /recepcion/integracion/historial/:cedula`, llave en `X-Api-Key`). Con `CLINIC_API_URL` y `CLINIC_API_KEY` (juntas; sin ellas `available: false`). La cédula **sale siempre de la sesión** (la que usó para entrar o el claim `identity_number`), cifrada con la cookie en `sessions.cedula` y borrada con la sesión; no hay forma de pasar otra (400 si se manda `cedula`). Respuesta `{ available, knownCedula, patientFound, total, appointments: [{ id, date, time, type, specialty, doctor, status, attended, cancelled }] }`; `status` es AGENDADA, EN_ESPERA, ATENDIDA, ASISTIO, NO_ASISTIO, VENCIDA o CANCELADA. Errores: 503 `CLINIC_UNAVAILABLE`/`CLINIC_BUSY`, 502 `CLINIC_ERROR`/`CLINIC_REJECTED`. Máx. 30 consultas cada 5 minutos por cuenta. Con Bearer (otra app) o con una cuenta de prueba: `knownCedula: false`. Nunca se registran la llave, la cédula ni la respuesta.

### Códigos de llamada: solicitudes de PIN (`call-codes`)

`GET /call-codes/requests` (con sesión, sin parámetros): las solicitudes de código de llamada de la persona en el sistema de códigos de llamada (`GET /api/external/pin-requests?identityNumber=`, llave en `X-Api-Key`; solo lectura). Con `CALLCODE_API_URL` (dirección base, sin la ruta) y `CALLCODE_API_KEY` (juntas; sin ellas `available: false`). La cédula **sale siempre de la sesión** (con guiones, como la pide el servicio), igual que en la Clínica; no hay forma de pasar otra (400 si se manda un parámetro). Respuesta `{ available, knownCedula, total, requests: [{ number, statusId, status, createdAt, updatedAt, location, lineType, extension, rejectionReason, history: [{ action, date }] }] }`, de la más reciente a la más antigua; `statusId` 1 a 3 pendientes, 4 aprobado, 5 rechazado (con `rejectionReason`), 6 procesado, 7 anulado. Las fechas vienen en hora de Panamá, sin zona. El PIN nunca viene. Errores: 503 `CALLCODE_UNAVAILABLE`, 502 `CALLCODE_ERROR`/`CALLCODE_REJECTED`. Máx. 30 consultas cada 5 minutos por cuenta. Con Bearer (otra app) o con una cuenta de prueba: `knownCedula: false`. Nunca se registran la llave, la cédula ni la respuesta.

`GET /glpi/tickets` (con sesión, sin parámetros): los tickets de la Mesa de Ayuda (GLPI) donde la persona es solicitante. La API abre una sesión en la API REST de GLPI con la cuenta de consulta (`initSession` con `App-Token` y `GLPI_USER_TOKEN`, o `GLPI_USER_ID`/`GLPI_USER_PASS` por Basic), busca los usuarios de GLPI cuyo campo **«Teléfono»** (campo 6) es exactamente la cédula de la sesión (así la guarda la Alcaldía al sincronizar con el AD; con guiones), trae sus tickets como solicitante (campo 4; si hay cuentas repetidas con la misma cédula, se juntan) y cierra la sesión (`killSession`). Solo pide número, título, estado y fechas: **nunca la descripción** (campo 21), que trae datos personales. Respuesta `{ available, knownCedula, userFound, total, tickets: [{ id, title, status, openedAt, updatedAt }] }`, del más reciente al más antiguo (máx. 100); `status` 1 nuevo, 2 en curso (asignado), 3 en curso (planificado), 4 en espera, 5 resuelto, 6 cerrado. `userFound: false` = ninguna cuenta de GLPI tiene esa cédula en «Teléfono» (la web lo explica). Errores: 503 `GLPI_UNAVAILABLE`, 502 `GLPI_ERROR` (llave o cuenta rechazada, o formato inesperado). Máx. 30 consultas cada 5 minutos por cuenta. Con Bearer o con una cuenta de prueba: `knownCedula: false`. Nunca se registran las llaves, la sesión, la cédula ni la respuesta.

### Recursos Humanos: RRHH Express (`rrhh`)

Cada persona conecta su cuenta de **RRHH Express** (el autoservicio de RRHH, servido por RH Link) y ve sus datos en la pestaña Recursos Humanos. En las dos ediciones.

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /rrhh/conexion` | cualquiera | 200 `{ available, connected, knownCedula, guest, name, expiresAt }`. `available`: si este servidor tiene RH Link (`RRHH_API_URL`). `knownCedula`: la sesión ya conoce la cédula (entró con Identity Central): la web solo pide el número de cargo. `guest`: la conexión es de invitado. Sin sesión ni cookie de invitado, `connected: false`. |
| `POST /rrhh/conexion` `{ cedula?, password }` | cualquiera (con o sin sesión) | 200 como el anterior, ya conectada. `password` es el **número de cargo** o, si la persona ya cambió su clave, su contraseña de RRHH Express. Con sesión que conoce la cédula se usa esa y, si el cuerpo trae `cedula`, 400 `RRHH_CEDULA_CONOCIDA`; con sesión sin cédula conocida (cuenta de prueba) o sin sesión, `cedula` es obligatoria (400 `RRHH_CEDULA_REQUERIDA`). Sin sesión abre una conexión de invitado y pone la cookie `mupa_invitado`. 401 `RRHH_CREDENCIALES` (un solo mensaje: no dice si falló la cédula o el cargo). 429 `RRHH_DEMASIADOS_INTENTOS`. |
| `DELETE /rrhh/conexion` | sesión o invitado | 204 (y borra la cookie de invitado). |
| `GET /rrhh/marcaciones?year&month` | conectada (sesión o invitado) | 200 `{ year, month, schedule, summary: { present, late, absent, daysOff }, days: [...] }`. |
| `GET /rrhh/comprobantes?page` | conectada | 200 `{ page, pages, total, items }` (12 por página). |
| `GET /rrhh/comprobantes/resumen/:year` | conectada | 200 `{ year, totals: { gross, deductions, net }, items }`. |
| `GET /rrhh/comprobantes/detalle?payroll` | conectada | 200 `{ payroll, lines: [{ code, type, amount, balance }] }` (descuentos directos). |
| `GET /rrhh/expediente` | conectada | 200 `{ job, personal, education, evaluations, sanctions, dependents }`. |
| `GET /rrhh/compensatorio` | conectada | 200 `{ workdayMinutes, totalAvailable, balances: { before, after }, expiring, requests }`. |
| `GET /rrhh/compensatorio/candidatos?from&to` | conectada | 200 `[{ date, type, minutes }]`: días que se pueden reclamar. |
| `POST /rrhh/compensatorio/acreditacion` `{ type, workedDate, reason? }` | conectada | 201 `{ id, minutes, message }`. |
| `POST /rrhh/compensatorio/uso` `{ type, unit: HORAS\|DIAS, amount, from, to?, reason? }` | conectada | 201. Las horas se mandan a RH Link en minutos. 409 `RRHH_RECHAZADO` si no alcanza el saldo. |
| `PATCH /rrhh/compensatorio/solicitudes/:id/cancelar` | conectada | 204. |

**Cómo funciona:**
- RH Link comprueba la cédula y la contraseña (`POST /api/auth/login-cedula`) y devuelve un token (JWT, ~8 h) que **solo abre los datos de esa cédula**: lo controla RH Link en cada ruta.
- La intranet guarda solo ese token, en `rrhh_conexiones`, **cifrado con una clave que sale de la cookie de la sesión** (`TokenService`, propósito propio). Una copia de la base no sirve sin la cookie.
- La conexión va atada a la sesión (`session_id`, `ON DELETE CASCADE`): al salir o vencer la sesión, desaparece.
- Con sesión se usa la cookie de la intranet. Con un Bearer (otra app) no hay sesión donde guardar la conexión: 403 `RRHH_SOLO_SESION`.
- **Conexión de invitado (sin sesión en la intranet, 22-oct-2026; a pedido de la jefatura del proyecto):** cédula y número de cargo bastan. Se guarda en `rrhh_conexiones_invitado` (`id` = SHA-256 de la cookie `mupa_invitado`, token de RH Link cifrado con una clave que sale de esa cookie, propósito `rrhh-guest`, `expires_at`, `created_at`; ni cédula ni contraseña). La cookie es aleatoria, HttpOnly, SameSite=Lax, `Secure` según `COOKIE_SECURE` y solo viaja a `/api/rrhh`; cada conexión estrena cookie. **Vence a los 30 minutos sin uso** (cada consulta la renueva), nunca pasa de **2 horas** desde que se abrió ni de lo que dura el token de RH Link (`GUEST_IDLE_MINUTES`, `GUEST_MAX_MINUTES` en `rrhh.constants.ts`); se borra al desconectar, al vencer y las vencidas se purgan en cada conexión nueva (sin cron). Una sesión de la intranet manda sobre la cookie de invitado. Los endpoints de datos aceptan sesión o invitado (`authenticateOrGuest`).
- **Límite de intentos al conectar** (en memoria, una sola instancia): 5 fallos cada 15 minutos **por cédula** (sin importar IP, sesión ni cookie; la cédula se guarda solo como HMAC con una clave que nace al arrancar) y 20 fallos cada 15 minutos **por IP** (`CONNECT_LIMIT_CEDULA`, `CONNECT_LIMIT_IP`). Los aciertos y las caídas de RH Link no gastan cupo. Con `TRUST_PROXY=0` detrás de un proxy, `req.ip` es la del proxy y el tope por IP lo comparte todo el mundo: ponerlo en 1 si el nginx publica la intranet.
- **La contraseña y la cédula no se guardan en la conexión.** La cédula con la que se consulta sale siempre del token, nunca de lo que mande el navegador.
- Las respuestas son una lista blanca de campos:
  - la cédula de la persona nunca sale;
  - la cuenta bancaria va como `••••1234`;
  - el seguro social y las cédulas de los dependientes, con solo los últimos 3 dígitos;
  - la condición de salud del expediente no se trae.

**Logs.** Solo el método, la ruta sin cédulas ni números, y el estado. Nunca el token, la cédula ni la contraseña.

**Errores:**

| Situación | Respuesta |
|---|---|
| Sin `RRHH_API_URL` | 503 `RRHH_UNAVAILABLE` (y `available: false`) |
| RH Link no responde o se pasa del tiempo | 503 `RRHH_UNAVAILABLE` |
| RH Link responde 5xx o algo que no es JSON | 502 `RRHH_ERROR` |
| Sin conectar, conexión vencida o token que RH Link ya no acepta | 401 `RRHH_DESCONECTADO` (y se borra la conexión) |
| RH Link rechaza algo (saldo insuficiente, sin detalle, no es tuyo) | su estado (400, 403, 404, 409) con `RRHH_RECHAZADO` y su mensaje |

**Variables (en `.env`):**

| Variable | Para qué |
|---|---|
| `RRHH_API_URL` | Base de RH Link (interna, solo http: no se le exige https). Vacía = apagado. |
| `RRHH_TIMEOUT_MS` | Espera máxima por respuesta (10 s por defecto). |
| `CALLCODE_API_URL`, `CALLCODE_API_KEY`, `CALLCODE_TIMEOUT_MS` | API de códigos de llamada para consultar las solicitudes de PIN por cédula (en «Mis solicitudes»). La URL es la base, sin la ruta. Las dos primeras van juntas; sin ellas no aparecen. Espera por defecto: 8000 ms. Secretos: nunca en git. |
| `GLPI_API_URL`, `GLPI_APP_TOKEN`, `GLPI_USER_TOKEN`, `GLPI_USER_ID`, `GLPI_USER_PASS`, `GLPI_TIMEOUT_MS` | Mesa de Ayuda (GLPI) para los tickets de cada persona en «Mis solicitudes». La URL es la de la API REST (termina en `/apirest.php`). La cuenta de consulta entra con su token de API (`GLPI_USER_TOKEN`, recomendado) o con usuario (`GLPI_USER_ID`, el login, no el número) y contraseña. Sin URL, llave de aplicación o cuenta, no aparece. Espera por defecto: 8000 ms. Secretos: nunca en git. |
| `CLINIC_API_URL`, `CLINIC_API_KEY` | API de la Clínica para consultar las citas por cédula («Mis citas»). Van juntas; sin ellas la sección no aparece. Secretos: nunca en git. |
| `RRHH_API_USER`, `RRHH_API_PASSWORD` | Cuenta de AD de la API para verificar que quien entra es un funcionario activo (ver «Verificación de funcionarios»). Van juntas y piden `RRHH_API_URL`. Sin ellas no se verifica. Secretos: nunca en git. |
| `WP_SYNC_URL` | Sitio WordPress del que se traen noticias y boletines (`https://mupa.gob.pa`). Vacía = sincronización apagada. |
| `WP_SYNC_INTERVAL_MINUTES` | Cada cuánto corre sola (60 por defecto, mínimo 5). |
| `WP_SYNC_WINDOW_DAYS` | Cuántos días hacia atrás mira en cada pasada (90 por defecto); lo ya importado se salta. |
| `WP_SYNC_CATEGORIES` | IDs de categorías de WordPress para las noticias, separados por coma. Vacío = todas. |
| `WP_SYNC_TIMEOUT_MS` | Espera máxima por respuesta del sitio (15 s por defecto). |
| `MCP_INTERNAL_KEY` | Llave compartida con el servidor MCP (≥ 16 caracteres). Con ella existe `GET /api/meta/catalog`; sin ella no. |
| `MCP_URL` | Dónde está el MCP (`http://mcp:8000/mcp`). Con él, el asistente le pide pistas antes de responder; vacío = no. |
| `MCP_TIMEOUT_MS` | Espera máxima por respuesta del MCP (2 s por defecto). |

**Pruebas.** `npm test` incluye el proyecto `rrhh`, contra un RH Link falso (`tests/rrhh/fake-rhlink.ts`) con el mismo contrato que el real (código de RH Link, medido el 2026-10-01).

### Salud

`GET /health` responde `{ "status": "ok" }` si responde la base, o 503 `DATABASE_UNAVAILABLE`.

## Pendiente

- **Identity Central en producción:** pedir la URL base (va detrás de un proxy con prefijo) y acordar los nombres de los `app_role` de la intranet (ver arriba).
- **Límite de intentos por IP en el login:** hoy solo lo tienen las cuentas locales; el central aplica el suyo.
- **Pantallas de administración en la SPA:** catálogo (la API ya existe), el resto del contenido del Inicio (noticias, enlaces, campañas…) y usuarios y roles. Los anuncios ya tienen la suya (`/gestion/anuncios`).
