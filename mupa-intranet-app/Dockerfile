# syntax=docker/dockerfile:1
#
# Intranet MUPA — web servida con nginx, APARTE de la API. Ya no es la de producción: docker-compose.yml no la usa
# (la imagen de la API compila la web y la sirve; ver ../mupa-intranet-api/Dockerfile). Queda por si se quiere servirla sola.
#   1) Node compila la SPA (Vite) → dist/
#   2) nginx sirve dist/ como archivos estáticos y reenvía /api/ al backend.
#
# El backend NO va en esta imagen. Se indica al arrancar:
#   docker build -t mupa-intranet-web .
#   docker run -p 8080:8080 -e API_UPSTREAM=http://<backend>:<puerto> mupa-intranet-web
#
# La API de prueba (mock/) solo existe en `npm run dev`; no llega a dist/.

# ---------- 1) Compilar ----------
FROM node:22-alpine AS build
WORKDIR /app

# Primero solo las dependencias: se reutiliza la capa mientras no cambie el lockfile.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY . .
# Edición (src/lib/edicion.ts): "publicacion" = sin lo que todavía nadie alimenta (anuncios,
# noticias, boletines, videos, formularios, solicitudes). "completa" = todo. Debe coincidir
# con EDICION de la API: docker-compose.yml pasa la misma a las dos.
ARG VITE_EDICION=publicacion
ENV VITE_EDICION=$VITE_EDICION
# typecheck + vite build → /app/dist
RUN npm run build

# ---------- 2) Servir ----------
# nginx sin root: escucha en 8080 y corre con el usuario nginx (uid 101).
FROM nginxinc/nginx-unprivileged:stable-alpine
# Parches de seguridad del sistema (la imagen base puede traer paquetes con arreglo ya publicado).
USER root
RUN apk upgrade --no-cache
USER 101

# Solo se sustituyen variables que empiecen con API_ en la plantilla.
ENV API_UPSTREAM=http://api:3000 \
    NGINX_ENVSUBST_FILTER=^API_

COPY nginx/seguridad.conf /etc/nginx/snippets/seguridad.conf
COPY nginx/seguridad-archivos.conf /etc/nginx/snippets/seguridad-archivos.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/salud || exit 1
