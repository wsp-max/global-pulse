#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/projects/project2/global-pulse}"
ARCHIVE_ROOT="${ARCHIVE_ROOT:-/var/backups/global-pulse/evidence}"
PRUNE="${PRUNE:-0}"
EVIDENCE_REL_DIRS=(
  "docs/evidence/ops-monitoring"
  "docs/evidence/ui-smoke"
  "docs/evidence/final-verification"
  "docs/evidence/cutover"
)

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "[ERROR] required command not found: ${cmd}" >&2
    exit 1
  fi
}

require_command "tar"
require_command "realpath"
require_command "find"
require_command "grep"

if [[ ! -d "${APP_DIR}" ]]; then
  echo "[ERROR] app directory not found: ${APP_DIR}" >&2
  exit 1
fi

APP_DIR_REAL="$(realpath "${APP_DIR}")"

STAMP="$(date +'%Y%m%d_%H%M%S')"
TARGET_DIR="${ARCHIVE_ROOT}/${STAMP}"
SUMMARY_FILE="${TARGET_DIR}/summary.txt"

mkdir -p "${TARGET_DIR}"

cat >"${SUMMARY_FILE}" <<EOF
Global Pulse Runtime Evidence Rotation
timestamp=${STAMP}
app_dir=${APP_DIR_REAL}
archive_dir=${TARGET_DIR}
prune=${PRUNE}
EOF

log_summary() {
  echo "$1" | tee -a "${SUMMARY_FILE}"
}

safe_prune_evidence_dir() {
  local source_dir="$1"
  local source_real
  local evidence_root_prefix="${APP_DIR_REAL}/docs/evidence/"

  source_real="$(realpath "${source_dir}")"
  if [[ "${source_real}/" != "${evidence_root_prefix}"* ]]; then
    log_summary "[WARN] skip prune outside evidence root: ${source_real}"
    return 1
  fi

  find "${source_real}" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  log_summary "[OK] pruned evidence directory: ${source_real}"
}

archive_evidence_dir() {
  local relative_dir="$1"
  local source_dir="${APP_DIR_REAL}/${relative_dir}"
  local archive_name
  local archive_file

  archive_name="${relative_dir//\//_}"
  archive_file="${TARGET_DIR}/${archive_name}_${STAMP}.tar.gz"

  if [[ ! -d "${source_dir}" ]]; then
    log_summary "[SKIP] directory not found: ${source_dir}"
    return 0
  fi

  if ! find "${source_dir}" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
    log_summary "[SKIP] directory is empty: ${source_dir}"
    return 0
  fi

  tar -czf "${archive_file}" -C "${source_dir}" .
  log_summary "[OK] archived ${source_dir} -> ${archive_file}"

  if [[ "${PRUNE}" == "1" ]]; then
    safe_prune_evidence_dir "${source_dir}" || true
  fi
}

for relative_dir in "${EVIDENCE_REL_DIRS[@]}"; do
  archive_evidence_dir "${relative_dir}"
done

log_summary "[DONE] summary=${SUMMARY_FILE}"
