#!/usr/bin/env bash
set -Eeuo pipefail

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-5}"

echo "[HEALTH] checking endpoint: ${HEALTH_URL}"
BODY="$(curl -fsS --max-time "${TIMEOUT_SECONDS}" "${HEALTH_URL}")"
echo "${BODY}"

if [[ "${BODY}" != *"\"status\":\"ok\""* ]] && [[ "${BODY}" != *"\"status\":\"degraded\""* ]]; then
  echo "[HEALTH] unexpected payload status" >&2
  exit 1
fi

for unit in \
  global-pulse-web.service \
  global-pulse-collector.timer \
  global-pulse-analyzer.timer \
  global-pulse-snapshot.timer \
  global-pulse-cleanup.timer \
  global-pulse-backup.timer
do
  if ! systemctl is-active --quiet "${unit}"; then
    echo "[HEALTH] unit is not active: ${unit}" >&2
    exit 1
  fi
done

echo "[HEALTH] all checks passed"
