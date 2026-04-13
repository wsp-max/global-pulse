#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/global-pulse}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-global_pulse}"
DB_USER="${DB_USER:-global_pulse}"
DB_PASSWORD="${DB_PASSWORD:-}"

TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
OUTPUT_FILE="${BACKUP_DIR}/global_pulse_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[BACKUP] creating ${OUTPUT_FILE}"
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --dbname="${DB_NAME}" \
  --format=plain \
  --no-owner \
  --no-privileges | gzip -9 > "${OUTPUT_FILE}"

echo "[BACKUP] pruning backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -type f -name "global_pulse_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "[BACKUP] done"
