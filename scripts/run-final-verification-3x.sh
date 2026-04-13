#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/projects/project2/global-pulse}"
ROUNDS="${ROUNDS:-1}"
SLEEP_SECONDS="${SLEEP_SECONDS:-300}"
SOURCE_ID="${SOURCE_ID:-reddit_worldnews}"
RUN_BACKUP_RESTORE_FIRST_ROUND="${RUN_BACKUP_RESTORE_FIRST_ROUND:-1}"
RUN_BACKUP_RESTORE_OTHER_ROUNDS="${RUN_BACKUP_RESTORE_OTHER_ROUNDS:-0}"

if [[ ! "${ROUNDS}" =~ ^[0-9]+$ ]] || [[ "${ROUNDS}" -lt 1 ]]; then
  echo "[VERIFY3] invalid ROUNDS value: ${ROUNDS}" >&2
  exit 1
fi

TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
RUN_DIR="${APP_DIR}/docs/evidence/final-verification/${TIMESTAMP}"
SUMMARY_FILE="${RUN_DIR}/summary.txt"

mkdir -p "${RUN_DIR}"

if [[ ! -d "${APP_DIR}" ]]; then
  echo "[VERIFY3] APP_DIR not found: ${APP_DIR}" >&2
  exit 1
fi

cd "${APP_DIR}"

echo "Global Pulse Final Verification" >"${SUMMARY_FILE}"
echo "timestamp=${TIMESTAMP}" >>"${SUMMARY_FILE}"
echo "app_dir=${APP_DIR}" >>"${SUMMARY_FILE}"
echo "rounds=${ROUNDS}" >>"${SUMMARY_FILE}"
echo "sleep_seconds=${SLEEP_SECONDS}" >>"${SUMMARY_FILE}"
echo "source_id=${SOURCE_ID}" >>"${SUMMARY_FILE}"
echo >>"${SUMMARY_FILE}"

FAILURES=0

parse_output_dir_from_capture_log() {
  local log_file="$1"
  grep -E '^output_dir=' "${log_file}" | tail -n1 | sed 's/^output_dir=//' || true
}

parse_failures_from_summary() {
  local summary_file="$1"
  if [[ ! -f "${summary_file}" ]]; then
    echo ""
    return
  fi
  grep -E '^failures=' "${summary_file}" | tail -n1 | sed 's/^failures=//' || true
}

for round in $(seq 1 "${ROUNDS}"); do
  ROUND_PREFIX="round${round}"
  CAPTURE_LOG="${RUN_DIR}/${ROUND_PREFIX}_capture.log"
  REPORT_LOG="${RUN_DIR}/${ROUND_PREFIX}_report.log"

  if [[ "${round}" -eq 1 ]]; then
    RUN_BACKUP_RESTORE="${RUN_BACKUP_RESTORE_FIRST_ROUND}"
  else
    RUN_BACKUP_RESTORE="${RUN_BACKUP_RESTORE_OTHER_ROUNDS}"
  fi

  echo "[VERIFY3] round ${round}/${ROUNDS} start (backup_restore=${RUN_BACKUP_RESTORE})" | tee -a "${SUMMARY_FILE}"

  CAPTURE_STATUS=0
  if ! SOURCE_ID="${SOURCE_ID}" RUN_BACKUP_RESTORE="${RUN_BACKUP_RESTORE}" bash scripts/capture-cutover-evidence.sh >"${CAPTURE_LOG}" 2>&1; then
    CAPTURE_STATUS=$?
  fi

  CUTOVER_DIR="$(parse_output_dir_from_capture_log "${CAPTURE_LOG}")"
  if [[ -z "${CUTOVER_DIR}" ]]; then
    echo "[VERIFY3] round ${round}: unable to detect cutover output dir" | tee -a "${SUMMARY_FILE}"
    FAILURES=$((FAILURES + 1))
    continue
  fi

  REPORT_STATUS=0
  if ! npm run ops:evidence:report -- --dir "${CUTOVER_DIR}" >"${REPORT_LOG}" 2>&1; then
    REPORT_STATUS=$?
  fi

  ROUND_FAILURES="$(parse_failures_from_summary "${CUTOVER_DIR}/summary.txt")"
  if [[ -z "${ROUND_FAILURES}" ]]; then
    ROUND_FAILURES=-1
  fi

  echo "${ROUND_PREFIX}_cutover_dir=${CUTOVER_DIR}" >>"${SUMMARY_FILE}"
  echo "${ROUND_PREFIX}_capture_status=${CAPTURE_STATUS}" >>"${SUMMARY_FILE}"
  echo "${ROUND_PREFIX}_report_status=${REPORT_STATUS}" >>"${SUMMARY_FILE}"
  echo "${ROUND_PREFIX}_script_failures=${ROUND_FAILURES}" >>"${SUMMARY_FILE}"

  if [[ "${CAPTURE_STATUS}" -ne 0 ]] || [[ "${REPORT_STATUS}" -ne 0 ]] || [[ "${ROUND_FAILURES}" -ne 0 ]]; then
    echo "[VERIFY3] round ${round} FAIL" | tee -a "${SUMMARY_FILE}"
    FAILURES=$((FAILURES + 1))
  else
    echo "[VERIFY3] round ${round} OK" | tee -a "${SUMMARY_FILE}"
  fi

  if [[ "${round}" -lt "${ROUNDS}" ]]; then
    echo "[VERIFY3] sleeping ${SLEEP_SECONDS}s before next round" | tee -a "${SUMMARY_FILE}"
    sleep "${SLEEP_SECONDS}"
  fi
done

echo >>"${SUMMARY_FILE}"
echo "failures=${FAILURES}" | tee -a "${SUMMARY_FILE}"
echo "run_dir=${RUN_DIR}" | tee -a "${SUMMARY_FILE}"

if [[ "${FAILURES}" -gt 0 ]]; then
  echo "[VERIFY3] completed with failures=${FAILURES}" >&2
  exit 1
fi

echo "[VERIFY3] completed successfully: ${RUN_DIR}"
