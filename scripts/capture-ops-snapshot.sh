#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/projects/project2/global-pulse}"
OUTPUT_ROOT="${OUTPUT_ROOT:-${APP_DIR}/docs/evidence/ops-monitoring}"
ENV_FILE="${ENV_FILE:-/etc/global-pulse/global-pulse.env}"

TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
OUT_DIR="${OUTPUT_ROOT}/${TIMESTAMP}"
SUMMARY_FILE="${OUT_DIR}/summary.txt"

mkdir -p "${OUT_DIR}"

if [[ ! -d "${APP_DIR}" ]]; then
  echo "[OPS] APP_DIR not found: ${APP_DIR}" >&2
  exit 1
fi

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

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
  echo "Global Pulse Ops Snapshot"
  echo "timestamp=${TIMESTAMP}"
  echo "host=$(hostname)"
  echo "app_dir=${APP_DIR}"
  echo "env_file=${ENV_FILE}"
  echo "postgres_config_mode=${POSTGRES_MODE}"
  echo
} >"${SUMMARY_FILE}"

cd "${APP_DIR}"

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

run_capture "systemctl_list_timers" systemctl list-timers "global-pulse-*" --all --no-pager || FAILURES=$((FAILURES + 1))

if systemctl list-unit-files | grep -q "^global-pulse-web.service"; then
  run_capture "systemctl_web" systemctl status global-pulse-web.service --no-pager || FAILURES=$((FAILURES + 1))
  run_capture "systemctl_collector_timer" systemctl status global-pulse-collector.timer --no-pager || FAILURES=$((FAILURES + 1))
  run_capture "systemctl_analyzer_timer" systemctl status global-pulse-analyzer.timer --no-pager || FAILURES=$((FAILURES + 1))
  run_capture "systemctl_snapshot_timer" systemctl status global-pulse-snapshot.timer --no-pager || FAILURES=$((FAILURES + 1))
  run_capture "systemctl_cleanup_timer" systemctl status global-pulse-cleanup.timer --no-pager || FAILURES=$((FAILURES + 1))
  run_capture "systemctl_backup_timer" systemctl status global-pulse-backup.timer --no-pager || FAILURES=$((FAILURES + 1))
else
  echo "[SKIP] global-pulse systemd units not installed on this host" | tee -a "${SUMMARY_FILE}"
fi

run_capture "api_health" curl -sS -i http://127.0.0.1:3000/api/health || FAILURES=$((FAILURES + 1))
run_capture "api_stats" curl -sS -i http://127.0.0.1:3000/api/stats || FAILURES=$((FAILURES + 1))
run_capture "api_topics" curl -sS -i "http://127.0.0.1:3000/api/topics?region=kr&limit=5" || FAILURES=$((FAILURES + 1))

run_capture "journal_web" journalctl -u global-pulse-web.service -n 200 --no-pager || FAILURES=$((FAILURES + 1))
run_capture "journal_collector" journalctl -u global-pulse-collector.service -n 200 --no-pager || FAILURES=$((FAILURES + 1))
run_capture "journal_analyzer" journalctl -u global-pulse-analyzer.service -n 200 --no-pager || FAILURES=$((FAILURES + 1))
run_capture "journal_snapshot" journalctl -u global-pulse-snapshot.service -n 200 --no-pager || FAILURES=$((FAILURES + 1))
run_capture "journal_cleanup" journalctl -u global-pulse-cleanup.service -n 200 --no-pager || FAILURES=$((FAILURES + 1))
run_capture "journal_backup" journalctl -u global-pulse-backup.service -n 200 --no-pager || FAILURES=$((FAILURES + 1))

if command -v psql >/dev/null 2>&1 && [[ "${POSTGRES_MODE}" != "unset" ]]; then
  if [[ "${POSTGRES_MODE}" == "database_url" ]]; then
    run_capture "db_table_counts" \
      psql "${DATABASE_URL}" -Atc "select 'raw_posts',count(*) from raw_posts union all select 'topics',count(*) from topics union all select 'global_topics',count(*) from global_topics union all select 'heat_history',count(*) from heat_history union all select 'region_snapshots',count(*) from region_snapshots;" || FAILURES=$((FAILURES + 1))
  else
    run_capture "db_table_counts" \
      env PGPASSWORD="${DB_PASSWORD}" psql \
        --host "${DB_HOST}" \
        --port "${DB_PORT}" \
        --username "${DB_USER}" \
        --dbname "${DB_NAME}" \
        -Atc "select 'raw_posts',count(*) from raw_posts union all select 'topics',count(*) from topics union all select 'global_topics',count(*) from global_topics union all select 'heat_history',count(*) from heat_history union all select 'region_snapshots',count(*) from region_snapshots;" || FAILURES=$((FAILURES + 1))
  fi
else
  echo "[SKIP] db_table_counts (psql missing or postgres env unset)" | tee -a "${SUMMARY_FILE}"
fi

echo >>"${SUMMARY_FILE}"
echo "failures=${FAILURES}" | tee -a "${SUMMARY_FILE}"
echo "output_dir=${OUT_DIR}" | tee -a "${SUMMARY_FILE}"

if [[ "${FAILURES}" -gt 0 ]]; then
  echo "[OPS] snapshot completed with ${FAILURES} failure(s). Review ${SUMMARY_FILE}" >&2
  exit 1
fi

echo "[OPS] snapshot completed successfully: ${OUT_DIR}"
