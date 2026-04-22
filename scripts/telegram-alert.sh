#!/usr/bin/env bash

set -euo pipefail

MESSAGE="${1:-}"
if [ -z "$MESSAGE" ]; then
  exit 0
fi

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-${API_TOKEN:-}}"
CHAT_ID="${TELEGRAM_TARGET_CHAT_ID:-${TELEGRAM_CHAT_ID:-${CHATID:-}}}"

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ]; then
  echo "[telegram-alert] skipped: TELEGRAM_BOT_TOKEN/API_TOKEN or TELEGRAM_TARGET_CHAT_ID/TELEGRAM_CHAT_ID/CHATID is missing"
  exit 0
fi

curl -fsS --retry 2 --retry-delay 1 --max-time 20 \
  -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT_ID}" \
  --data-urlencode "text=${MESSAGE}" \
  --data-urlencode "disable_web_page_preview=true" \
  >/dev/null
