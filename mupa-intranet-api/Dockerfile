# syntax=docker/dockerfile:1
#
# Intranet MUPA — la imagen de producción: la API y, en la misma imagen, la web (la SPA compilada), que la API
# sirve en la raíz del sitio desde /app/public. Se construye desde la RAÍZ del repositorio (ver ../docker-compose.yml):
#   docker build -f mupa-intranet-api/Dockerfile --build-arg VITE_EDICION=publicacion -t mupa-intranet-api .
# Lo que entra al contexto lo decide Dockerfile.dockerignore (al lado de este archivo).
#
# La misma imagen sirve para dos cosas:
#   - API + web:    node dist/server.js                       (CMD por defecto)
#   - migraciones:  node dist/database/migrate.js && node dist/database/seed.js
#
# Necesita DATABASE_URL=postgres://usuario:clave@servidor:5432/base

# ---------- 1) Web: compilar la SPA (Vite) → /web/dist ----------
FROM node:22-alpine AS web
WORKDIR /web
# Primero solo las dependencias: se reutiliza la capa mientras no cambie el lockfile.
COPY mupa-intranet-app/package.json mupa-intranet-app/package-lock.json mupa-intranet-app/.npmrc ./
RUN npm ci --no-audit --no-fund
COPY mupa-intranet-app/ ./
# Edición (src/lib/edicion.ts): "publicacion" o "completa". Debe coincidir con EDICION de la API:
# docker-compose.yml pasa la misma a las dos.
ARG VITE_EDICION=publicacion
ENV VITE_EDICION=$VITE_EDICION
# typecheck + vite build → /web/dist
RUN npm run build

# ---------- 2) API: compilar TypeScript → dist/ (con migraciones SQL y datos iniciales) ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY mupa-intranet-api/package.json mupa-intranet-api/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY mupa-intranet-api/tsconfig.json mupa-intranet-api/tsconfig.build.json ./
COPY mupa-intranet-api/scripts ./scripts
COPY mupa-intranet-api/src ./src
RUN npm run build

# ---------- 3) Solo dependencias de producción ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY mupa-intranet-api/package.json mupa-intranet-api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- 4) Imagen final ----------
FROM node:22-alpine
# Parches de seguridad del sistema y, como en producción solo corre `node dist/server.js`, sin npm, npx ni yarn:
# son los que traían paquetes vulnerables (brace-expansion, pacote, ip-address, picomatch…) y nadie los usa aquí.
RUN apk upgrade --no-cache  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-*
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY mupa-intranet-api/package.json ./
# El directorio telefónico de la web: el asistente busca ahí personas y extensiones (directory-search.service.ts).
COPY mupa-intranet-app/src/data/directorio-personas.json ./data/directorio-personas.json

# La web: la API la sirve desde aquí (PUBLIC_DIR), en la raíz del sitio.
COPY --from=web /web/dist ./public
ENV PUBLIC_DIR=/app/public

# Archivos que sube Comunicación: la carpeta es del usuario node (el volumen hereda el dueño).
ENV UPLOADS_DIR=/app/uploads
RUN mkdir -p /app/uploads && chown node:node /app/uploads

# Sin root.
USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/server.js"]
