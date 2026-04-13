#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/global-pulse}"
BACKUP_FILE="${BACKUP_FILE:-}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-global_pulse}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-global_pulse}"

RESTORE_DB_NAME="${RESTORE_DB_NAME:-global_pulse_restore_verify}"
DROP_RESTORE_DB="${DROP_RESTORE_DB:-1}"
MAINTENANCE_DB="${MAINTENANCE_DB:-postgres}"

if [[ "${RESTORE_DB_NAME}" == "${DB_NAME}" ]]; then
  echo "[RESTORE] RESTORE_DB_NAME must differ from DB_NAME" >&2
  exit 1
fi

if [[ ! "${DB_NAME}" =~ ^[a-zA-Z0-9_]+$ ]] || [[ ! "${RESTORE_DB_NAME}" =~ ^[a-zA-Z0-9_]+$ ]] || [[ ! "${MAINTENANCE_DB}" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "[RESTORE] invalid database name format" >&2
  exit 1
fi

if [[ -z "${BACKUP_FILE}" ]]; then
  BACKUP_FILE="$(ls -1t "${BACKUP_DIR}"/global_pulse_*.sql.gz 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "[RESTORE] no backup file found in ${BACKUP_DIR}" >&2
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "[RESTORE] backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

echo "[RESTORE] selected backup: ${BACKUP_FILE}"

EXISTS="$(
  PGPASSWORD="${DB_PASSWORD}" psql \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --dbname="${MAINTENANCE_DB}" \
    --tuples-only \
    --no-align \
    --command="select 1 from pg_database where datname = '${RESTORE_DB_NAME}' limit 1;" | tr -d '[:space:]'
)"

if [[ "${EXISTS}" == "1" ]]; then
  if [[ "${DROP_RESTORE_DB}" != "1" ]]; then
    echo "[RESTORE] restore DB already exists and DROP_RESTORE_DB is not 1: ${RESTORE_DB_NAME}" >&2
    exit 1
  fi

  echo "[RESTORE] dropping existing restore DB: ${RESTORE_DB_NAME}"
  PGPASSWORD="${DB_PASSWORD}" dropdb \
    --if-exists \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    "${RESTORE_DB_NAME}"
fi

echo "[RESTORE] creating restore DB: ${RESTORE_DB_NAME}"
PGPASSWORD="${DB_PASSWORD}" createdb \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  "${RESTORE_DB_NAME}"

echo "[RESTORE] loading backup into ${RESTORE_DB_NAME}"
gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${DB_PASSWORD}" psql \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --dbname="${RESTORE_DB_NAME}" \
  --set=ON_ERROR_STOP=1 \
  --quiet

echo "[RESTORE] row count smoke check"
PGPASSWORD="${DB_PASSWORD}" psql \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --dbname="${RESTORE_DB_NAME}" \
  --tuples-only \
  --no-align \
  --command="
    select 'regions=' || count(*)::text from regions
    union all
    select 'sources=' || count(*)::text from sources
    union all
    select 'raw_posts=' || count(*)::text from raw_posts
    union all
    select 'topics=' || count(*)::text from topics
    union all
    select 'global_topics=' || count(*)::text from global_topics;
  "

echo "[RESTORE] completed successfully"
