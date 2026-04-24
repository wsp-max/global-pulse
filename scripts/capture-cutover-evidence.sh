#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/projects/project2/global-pulse}"
OUTPUT_ROOT="${OUTPUT_ROOT:-${APP_DIR}/docs/evidence/cutover}"
SOURCE_ID="${SOURCE_ID:-hackernews}"
RUN_BACKUP_RESTORE="${RUN_BACKUP_RESTORE:-1}"

TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
OUT_DIR="${OUTPUT_ROOT}/${TIMESTAMP}"
SUMMARY_FILE="${OUT_DIR}/summary.txt"

mkdir -p "${OUT_DIR}"

if [[ ! -d "${APP_DIR}" ]]; then
  echo "[EVIDENCE] APP_DIR not found: ${APP_DIR}" >&2
  exit 1
fi

cd "${APP_DIR}"

detect_postgres_mode() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "database_url"
    return
  fi

  if [[ -n "${DB_HOST:-}" && -n "${DB_PORT:-}" && -n "${DB_NAME:-}" && -n "${DB_USER:-}" && -n "${DB_PASSWORD:-}" ]]; then
    echo "discrete_env"
    return
  fi

  echo "unset"
}

POSTGRES_MODE="$(detect_postgres_mode)"

{
  echo "Global Pulse Cutover Evidence"
  echo "timestamp=${TIMESTAMP}"
  echo "app_dir=${APP_DIR}"
  echo "source_id=${SOURCE_ID}"
  echo "run_backup_restore=${RUN_BACKUP_RESTORE}"
  echo "postgres_config_mode=${POSTGRES_MODE}"
  echo
} >"${SUMMARY_FILE}"

run_capture() {
  local name="$1"
  shift
  local logfile="${OUT_DIR}/${name}.log"

  echo "[RUN] ${name}: $*" | tee -a "${SUMMARY_FILE}"
  if "$@" >"${logfile}" 2>&1; then
    echo "[OK] ${name}" | tee -a "${SUMMARY_FILE}"
    return 0
  else
    local status=$?
    echo "[FAIL:${status}] ${name} (see ${logfile})" | tee -a "${SUMMARY_FILE}"
    return "${status}"
  fi
}

FAILURES=0

run_capture "db_init" npm run db:init || FAILURES=$((FAILURES + 1))
run_capture "verify_postgres" npm run verify:postgres -- --source "${SOURCE_ID}" || FAILURES=$((FAILURES + 1))

run_capture "systemctl_backup_timer" systemctl status global-pulse-backup.timer --no-pager || FAILURES=$((FAILURES + 1))
run_capture "systemctl_web" systemctl status global-pulse-web.service --no-pager || FAILURES=$((FAILURES + 1))

run_capture "api_health" curl -sS -i http://127.0.0.1:3000/api/health || FAILURES=$((FAILURES + 1))
run_capture "api_stats" curl -sS -i http://127.0.0.1:3000/api/stats || FAILURES=$((FAILURES + 1))
run_capture "api_topics" curl -sS -i "http://127.0.0.1:3000/api/topics?region=kr&limit=5" || FAILURES=$((FAILURES + 1))

run_capture "journal_web" journalctl -u global-pulse-web.service -n 200 --no-pager || FAILURES=$((FAILURES + 1))
run_capture "journal_collector" journalctl -u global-pulse-collector.service -n 200 --no-pager || FAILURES=$((FAILURES + 1))
run_capture "journal_analyzer" journalctl -u global-pulse-analyzer.service -n 200 --no-pager || FAILURES=$((FAILURES + 1))

if [[ "${RUN_BACKUP_RESTORE}" == "1" ]]; then
  run_capture "backup_db" bash scripts/backup-db.sh || FAILURES=$((FAILURES + 1))
  run_capture "restore_db" bash scripts/restore-db.sh || FAILURES=$((FAILURES + 1))
else
  echo "[SKIP] backup/restore by RUN_BACKUP_RESTORE=${RUN_BACKUP_RESTORE}" | tee -a "${SUMMARY_FILE}"
fi

echo >>"${SUMMARY_FILE}"
echo "failures=${FAILURES}" | tee -a "${SUMMARY_FILE}"
echo "output_dir=${OUT_DIR}" | tee -a "${SUMMARY_FILE}"

if [[ "${FAILURES}" -gt 0 ]]; then
  echo "[EVIDENCE] completed with ${FAILURES} failure(s). Review ${SUMMARY_FILE}" >&2
  exit 1
fi

echo "[EVIDENCE] completed successfully: ${OUT_DIR}"
