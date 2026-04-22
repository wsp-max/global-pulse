#!/usr/bin/env bash

set -euo pipefail

MODE_RAW="${1:-${REPORT_MODE:-full}}"
MODE="$(echo "${MODE_RAW}" | tr '[:upper:]' '[:lower:]')"
if [ "$MODE" != "full" ] && [ "$MODE" != "snap" ]; then
  MODE="full"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

if ! message="$(REPORT_MODE="$MODE" npx tsx scripts/pulse-report-job.ts --mode="$MODE")"; then
  echo "[pulse-report] failed to build report message (mode=$MODE)"
  bash "$SCRIPT_DIR/telegram-alert.sh" "[GlobalPulse][PULSE][${MODE^^}] report build failed on $(hostname)" || true
  exit 1
fi

if [ -z "${message}" ]; then
  echo "[pulse-report] empty report message (mode=$MODE)"
  bash "$SCRIPT_DIR/telegram-alert.sh" "[GlobalPulse][PULSE][${MODE^^}] report skipped: empty message on $(hostname)" || true
  exit 1
fi

export TELEGRAM_TARGET_CHAT_ID="${TELEGRAM_PULSE_REPORT_CHAT_ID:-}"

if ! bash "$SCRIPT_DIR/telegram-alert.sh" "$message"; then
  echo "[pulse-report] first telegram send failed (mode=$MODE), retrying once"
  sleep 1
  if ! bash "$SCRIPT_DIR/telegram-alert.sh" "$message"; then
    echo "[pulse-report] telegram alert failed after retry (mode=$MODE)"
    unset TELEGRAM_TARGET_CHAT_ID
    bash "$SCRIPT_DIR/telegram-alert.sh" "[GlobalPulse][PULSE][${MODE^^}] telegram delivery failed after retry on $(hostname)" || true
    exit 1
  fi
fi

if [ "$MODE" = "snap" ]; then
  echo "[pulse-report] snapshot sent at $(date -Iseconds)"
else
  echo "[pulse-report] full report sent at $(date -Iseconds)"
fi
