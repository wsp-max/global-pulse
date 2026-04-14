#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/projects/project2/global-pulse}"
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-master}"
ENV_FILE="${ENV_FILE:-/etc/global-pulse/global-pulse.env}"
USE_PNPM="${USE_PNPM:-1}"
ROTATE_EVIDENCE_BEFORE_PULL="${ROTATE_EVIDENCE_BEFORE_PULL:-1}"
ROTATE_EVIDENCE_PRUNE="${ROTATE_EVIDENCE_PRUNE:-1}"
ALLOW_DIRTY_TRACKED="${ALLOW_DIRTY_TRACKED:-0}"

echo "[DEPLOY] app_dir=${APP_DIR} branch=${BRANCH}"
echo "[DEPLOY] override path with APP_DIR=/your/path when needed"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  if [[ -z "${REPO_URL}" ]]; then
    echo "[DEPLOY] REPO_URL is required for first-time deploy." >&2
    exit 1
  fi
  sudo mkdir -p "${APP_DIR}"
  sudo chown -R "$USER":"$USER" "${APP_DIR}"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"

if [[ "${ROTATE_EVIDENCE_BEFORE_PULL}" == "1" ]] && [[ -f scripts/rotate-runtime-evidence.sh ]]; then
  echo "[DEPLOY] rotating runtime evidence before pull (prune=${ROTATE_EVIDENCE_PRUNE})"
  APP_DIR="${APP_DIR}" PRUNE="${ROTATE_EVIDENCE_PRUNE}" bash scripts/rotate-runtime-evidence.sh || \
    echo "[DEPLOY] warning: evidence rotation failed; continuing deploy."
fi

DIRTY_TRACKED="$(git status --porcelain --untracked-files=no)"
if [[ -n "${DIRTY_TRACKED}" ]] && [[ "${ALLOW_DIRTY_TRACKED}" != "1" ]]; then
  echo "[DEPLOY] tracked local changes detected. aborting to avoid pull conflicts:"
  echo "${DIRTY_TRACKED}"
  echo "[DEPLOY] rerun with ALLOW_DIRTY_TRACKED=1 if this is intentional."
  exit 1
fi

git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

if [[ "${USE_PNPM}" == "1" ]] && command -v pnpm >/dev/null 2>&1; then
  corepack enable || true
  pnpm install --frozen-lockfile --prod=false || pnpm install --prod=false
else
  npm ci --include=dev --include-workspace-root || npm install --include=dev --include-workspace-root
fi

if [[ -f "${ENV_FILE}" ]]; then
  echo "[DEPLOY] loading env for build from ${ENV_FILE}"
  set -a
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
  set +a
else
  echo "[DEPLOY] warning: env file not found at ${ENV_FILE}; build-time NEXT_PUBLIC_* may be empty."
fi

if [[ "${USE_PNPM}" == "1" ]] && command -v pnpm >/dev/null 2>&1; then
  pnpm run build
else
  npm run build
fi

sudo mkdir -p /etc/global-pulse

sudo install -m 644 infra/systemd/global-pulse-web.service /etc/systemd/system/global-pulse-web.service
sudo install -m 644 infra/systemd/global-pulse-collector.service /etc/systemd/system/global-pulse-collector.service
sudo install -m 644 infra/systemd/global-pulse-collector.timer /etc/systemd/system/global-pulse-collector.timer
sudo install -m 644 infra/systemd/global-pulse-analyzer.service /etc/systemd/system/global-pulse-analyzer.service
sudo install -m 644 infra/systemd/global-pulse-analyzer.timer /etc/systemd/system/global-pulse-analyzer.timer
sudo install -m 644 infra/systemd/global-pulse-snapshot.service /etc/systemd/system/global-pulse-snapshot.service
sudo install -m 644 infra/systemd/global-pulse-snapshot.timer /etc/systemd/system/global-pulse-snapshot.timer
sudo install -m 644 infra/systemd/global-pulse-cleanup.service /etc/systemd/system/global-pulse-cleanup.service
sudo install -m 644 infra/systemd/global-pulse-cleanup.timer /etc/systemd/system/global-pulse-cleanup.timer
sudo install -m 644 infra/systemd/global-pulse-backup.service /etc/systemd/system/global-pulse-backup.service
sudo install -m 644 infra/systemd/global-pulse-backup.timer /etc/systemd/system/global-pulse-backup.timer
sudo install -m 644 infra/systemd/global-pulse-source-verify.service /etc/systemd/system/global-pulse-source-verify.service
sudo install -m 644 infra/systemd/global-pulse-source-verify.timer /etc/systemd/system/global-pulse-source-verify.timer

if [[ -f infra/nginx/global-pulse.conf ]]; then
  sudo install -m 644 infra/nginx/global-pulse.conf /etc/nginx/sites-available/global-pulse.conf
  sudo ln -sfn /etc/nginx/sites-available/global-pulse.conf /etc/nginx/sites-enabled/global-pulse.conf
  sudo nginx -t
  sudo systemctl reload nginx
fi

sudo systemctl daemon-reload
sudo systemctl enable --now global-pulse-web.service
sudo systemctl enable --now global-pulse-collector.timer
sudo systemctl enable --now global-pulse-analyzer.timer
sudo systemctl enable --now global-pulse-snapshot.timer
sudo systemctl enable --now global-pulse-cleanup.timer
sudo systemctl enable --now global-pulse-backup.timer
sudo systemctl enable --now global-pulse-source-verify.timer
sudo systemctl restart global-pulse-web.service

echo "[DEPLOY] completed."
