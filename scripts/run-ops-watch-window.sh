#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/projects/project2/global-pulse}"
HOURS="${HOURS:-24}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-3600}"
MAX_FAILURES="${MAX_FAILURES:-3}"

if [[ ! "${HOURS}" =~ ^[0-9]+$ ]] || [[ "${HOURS}" -le 0 ]]; then
  echo "[OPS-WATCH] HOURS must be a positive integer." >&2
  exit 1
fi

if [[ ! "${INTERVAL_SECONDS}" =~ ^[0-9]+$ ]] || [[ "${INTERVAL_SECONDS}" -lt 0 ]]; then
  echo "[OPS-WATCH] INTERVAL_SECONDS must be a non-negative integer." >&2
  exit 1
fi

if [[ ! "${MAX_FAILURES}" =~ ^[0-9]+$ ]] || [[ "${MAX_FAILURES}" -lt 0 ]]; then
  echo "[OPS-WATCH] MAX_FAILURES must be a non-negative integer." >&2
  exit 1
fi

if [[ ! -d "${APP_DIR}" ]]; then
  echo "[OPS-WATCH] APP_DIR not found: ${APP_DIR}" >&2
  exit 1
fi

STAMP="$(date +'%Y%m%d_%H%M%S')"
WATCH_DIR="${APP_DIR}/docs/evidence/ops-monitoring/watch_${STAMP}"
SUMMARY_FILE="${WATCH_DIR}/watch-summary.txt"

mkdir -p "${WATCH_DIR}"
cd "${APP_DIR}"

{
  echo "Global Pulse Ops Watch Window"
  echo "timestamp=${STAMP}"
  echo "app_dir=${APP_DIR}"
  echo "hours=${HOURS}"
  echo "interval_seconds=${INTERVAL_SECONDS}"
  echo "max_failures=${MAX_FAILURES}"
  echo
} >"${SUMMARY_FILE}"

FAILURES=0

for ((i = 1; i <= HOURS; i += 1)); do
  NOW="$(date -Iseconds)"
  echo "[RUN] hour=${i} at ${NOW}" | tee -a "${SUMMARY_FILE}"

  if bash scripts/capture-ops-snapshot.sh >>"${SUMMARY_FILE}" 2>&1; then
    echo "[OK] hour=${i}" | tee -a "${SUMMARY_FILE}"
  else
    FAILURES=$((FAILURES + 1))
    echo "[FAIL] hour=${i} failures=${FAILURES}" | tee -a "${SUMMARY_FILE}"
  fi

  if [[ "${FAILURES}" -ge "${MAX_FAILURES}" ]]; then
    echo "[STOP] reached MAX_FAILURES=${MAX_FAILURES}" | tee -a "${SUMMARY_FILE}"
    break
  fi

  if [[ "${i}" -lt "${HOURS}" ]] && [[ "${INTERVAL_SECONDS}" -gt 0 ]]; then
    sleep "${INTERVAL_SECONDS}"
  fi
done

echo >>"${SUMMARY_FILE}"
echo "failures=${FAILURES}" | tee -a "${SUMMARY_FILE}"
echo "watch_dir=${WATCH_DIR}" | tee -a "${SUMMARY_FILE}"

if [[ "${FAILURES}" -gt 0 ]]; then
  echo "[OPS-WATCH] completed with failures. See ${SUMMARY_FILE}" >&2
  exit 1
fi

echo "[OPS-WATCH] completed successfully: ${WATCH_DIR}"
