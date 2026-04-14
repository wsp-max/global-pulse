#!/usr/bin/env bash
set -Eeuo pipefail

APP_HOST="${APP_HOST:-http://127.0.0.1:3100}"
RAW_BASE_PATH="${APP_BASE_PATH:-${NEXT_BASE_PATH:-/pulse}}"
APP_DIR="${APP_DIR:-/srv/projects/project2/global-pulse}"
OUTPUT_ROOT="${OUTPUT_ROOT:-${APP_DIR}/docs/evidence/ui-smoke}"

normalize_base_path() {
  local raw="${1:-}"
  if [[ -z "${raw}" || "${raw}" == "/" ]]; then
    echo ""
    return
  fi

  local with_leading="/${raw#/}"
  echo "${with_leading%/}"
}

BASE_PATH="$(normalize_base_path "${RAW_BASE_PATH}")"
STAMP="$(date +'%Y%m%d_%H%M%S')"
OUT_DIR="${OUTPUT_ROOT}/${STAMP}"
SUMMARY_FILE="${OUT_DIR}/summary.txt"

mkdir -p "${OUT_DIR}"

MOBILE_UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"

{
  echo "Global Pulse UI Smoke Check"
  echo "timestamp=${STAMP}"
  echo "app_host=${APP_HOST}"
  echo "base_path=${BASE_PATH:-/}"
  echo "output_dir=${OUT_DIR}"
  echo
} >"${SUMMARY_FILE}"

FAILURES=0

run_http_check() {
  local name="$1"
  local url="$2"
  local expected_csv="$3"
  local body_file="${OUT_DIR}/${name}.body.html"
  local header_file="${OUT_DIR}/${name}.headers.txt"
  local expect_pattern="${4:-}"

  echo "[RUN] ${name}: GET ${url} (expect: ${expected_csv})" | tee -a "${SUMMARY_FILE}"

  local http_code
  if ! http_code="$(curl -sS -L -A "${MOBILE_UA}" -D "${header_file}" -o "${body_file}" -w "%{http_code}" "${url}")"; then
    echo "[FAIL] ${name}: curl failed" | tee -a "${SUMMARY_FILE}"
    FAILURES=$((FAILURES + 1))
    return
  fi

  if [[ ",${expected_csv}," != *",${http_code},"* ]]; then
    echo "[FAIL] ${name}: http=${http_code}" | tee -a "${SUMMARY_FILE}"
    FAILURES=$((FAILURES + 1))
    return
  fi

  if [[ -n "${expect_pattern}" ]]; then
    if grep -qF "${expect_pattern}" "${body_file}"; then
      echo "[OK] ${name}: http=${http_code}, pattern='${expect_pattern}'" | tee -a "${SUMMARY_FILE}"
    else
      echo "[FAIL] ${name}: http=${http_code}, pattern not found='${expect_pattern}'" | tee -a "${SUMMARY_FILE}"
      FAILURES=$((FAILURES + 1))
      return
    fi
  else
    echo "[OK] ${name}: http=${http_code}" | tee -a "${SUMMARY_FILE}"
  fi
}

ROOT_URL="${APP_HOST}${BASE_PATH}"

# Mobile-route smoke checks
run_http_check "home" "${ROOT_URL}" "200" "GLOBAL PULSE"
run_http_check "global_issues" "${ROOT_URL}/global-issues" "200" "Global Issues"
run_http_check "timeline" "${ROOT_URL}/timeline" "200" "토픽 확산 타임라인"
run_http_check "search" "${ROOT_URL}/search" "200" "Search Topics"
run_http_check "region_kr" "${ROOT_URL}/region/kr" "200" "Top Topics"

# API and error-state checks
run_http_check "api_health" "${ROOT_URL}/api/health" "200"
run_http_check "api_stats" "${ROOT_URL}/api/stats" "200"
run_http_check "api_topic_invalid" "${ROOT_URL}/api/topic/not-a-number" "400"
run_http_check "api_not_found" "${ROOT_URL}/api/not-found" "404"
run_http_check "page_not_found" "${ROOT_URL}/not-found-page" "404"

echo >>"${SUMMARY_FILE}"
echo "failures=${FAILURES}" | tee -a "${SUMMARY_FILE}"
echo "out_dir=${OUT_DIR}" | tee -a "${SUMMARY_FILE}"

if [[ "${FAILURES}" -gt 0 ]]; then
  echo "[UI-SMOKE] completed with ${FAILURES} failure(s). See ${SUMMARY_FILE}" >&2
  exit 1
fi

echo "[UI-SMOKE] completed successfully: ${OUT_DIR}"

