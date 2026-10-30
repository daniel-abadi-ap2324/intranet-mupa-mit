#!/bin/sh
# Respaldo de la intranet: la base (pg_dump) y los archivos que sube Comunicación (volumen uploads).
# Se corre en el servidor, desde la carpeta del repositorio, con la pila de docker-compose.yml levantada:
#
#   scripts/respaldo.sh                      # deja los respaldos en ./respaldos
#   RESPALDO_DIR=/srv/respaldos DIAS=30 scripts/respaldo.sh
#
# Cron sugerido (todos los días a las 2:30 a. m.):
#   30 2 * * * cd /ruta/al/repositorio && scripts/respaldo.sh >> respaldos/respaldo.log 2>&1
#
# La base guarda cédulas: los respaldos quedan solo para el dueño (permisos 600) y fuera de git.
# Restaurar (sobre una base vacía, con la pila levantada):
#   docker compose exec -T db sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < respaldos/base-AAAA-MM-DD_HHMM.dump
#   docker compose exec -T api tar xzf - -C /app < respaldos/archivos-AAAA-MM-DD_HHMM.tar.gz
set -eu

DIR="${RESPALDO_DIR:-respaldos}"
DIAS="${DIAS:-14}"
FECHA="$(date +%Y-%m-%d_%H%M)"

umask 077
mkdir -p "$DIR"

# Base: formato propio de PostgreSQL (comprimido; se restaura con pg_restore). Usuario y base salen del contenedor.
docker compose exec -T db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$DIR/base-$FECHA.dump.tmp"
mv "$DIR/base-$FECHA.dump.tmp" "$DIR/base-$FECHA.dump"

# Archivos subidos (boletines, imágenes de noticias…), desde el contenedor de la API.
docker compose exec -T api tar czf - -C /app uploads > "$DIR/archivos-$FECHA.tar.gz.tmp"
mv "$DIR/archivos-$FECHA.tar.gz.tmp" "$DIR/archivos-$FECHA.tar.gz"

# Solo se guardan los últimos $DIAS días.
find "$DIR" -maxdepth 1 -type f \( -name 'base-*.dump' -o -name 'archivos-*.tar.gz' \) -mtime +"$DIAS" -delete

echo "$(date '+%F %T') respaldo listo: $DIR/base-$FECHA.dump y $DIR/archivos-$FECHA.tar.gz"
