#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/projects/project2/global-pulse}"

if [[ ! -d "${APP_DIR}" ]]; then
  echo "[CLOSURE] APP_DIR not found: ${APP_DIR}" >&2
  exit 1
fi

cd "${APP_DIR}"

echo "[CLOSURE] running preflight"
npm run ops:closure:preflight

echo "[CLOSURE] running final verification (ROUNDS=${ROUNDS:-1})"
npm run ops:verify3

echo "[CLOSURE] generating final verification report"
npm run ops:verify3:report

echo "[CLOSURE] applying final report to patch/docs"
npm run ops:verify3:apply

echo "[CLOSURE] checking closure consistency"
npm run ops:verify3:check

echo "[CLOSURE] done"
