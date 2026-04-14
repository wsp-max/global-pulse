# EC2 Deployment Guide (Ubuntu 22.04)

## 1) Base Packages
```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib git curl build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pnpm
```

## 2) App Directory
```bash
sudo mkdir -p /srv/projects/project2/global-pulse
sudo chown -R $USER:$USER /srv/projects/project2/global-pulse
git clone <YOUR_REPO_URL> /srv/projects/project2/global-pulse
cd /srv/projects/project2/global-pulse
pnpm install || npm install
pnpm run build || npm run build
```

## 3) Environment File
Create `/etc/global-pulse/global-pulse.env`.
```bash
sudo mkdir -p /etc/global-pulse
sudo tee /etc/global-pulse/global-pulse.env >/dev/null <<'EOF'
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://global_pulse:change_me@127.0.0.1:5432/global_pulse
# or discrete env:
# DB_HOST=127.0.0.1
# DB_PORT=5432
# DB_NAME=global_pulse
# DB_USER=global_pulse
# DB_PASSWORD=change_me
YOUTUBE_API_KEY=...
GEMINI_API_KEY=...
EOF
```

## 4) Install systemd Units
```bash
cd /srv/projects/project2/global-pulse
sudo cp infra/systemd/*.service /etc/systemd/system/
sudo cp infra/systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now global-pulse-web.service
sudo systemctl enable --now global-pulse-collector.timer
sudo systemctl enable --now global-pulse-analyzer.timer
sudo systemctl enable --now global-pulse-snapshot.timer
sudo systemctl enable --now global-pulse-cleanup.timer
sudo systemctl enable --now global-pulse-backup.timer
```

## 5) Install nginx Config
```bash
sudo cp infra/nginx/global-pulse.conf /etc/nginx/sites-available/global-pulse.conf
sudo ln -sfn /etc/nginx/sites-available/global-pulse.conf /etc/nginx/sites-enabled/global-pulse.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 6) Verify
```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1/healthz
systemctl status global-pulse-web.service --no-pager
systemctl list-timers 'global-pulse-*' --no-pager
pnpm run db:init || npm run db:init
pnpm run verify:postgres -- --source reddit_worldnews || npm run verify:postgres -- --source reddit_worldnews
bash scripts/backup-db.sh
bash scripts/restore-db.sh
bash scripts/capture-cutover-evidence.sh
npm run ops:evidence:report
npm run ops:closure:preflight
npm run ops:closure:selftest
npm run ops:verify3
npm run ops:verify3:report
npm run ops:verify3:apply
npm run ops:verify3:check
npm run ops:monitor:snapshot
# or one-shot closure:
npm run ops:closure
# default closure is single-round (ROUNDS=1).
# optional strict mode:
ROUNDS=3 npm run ops:verify3
ROUNDS=3 npm run ops:closure
```

## 7) Update Deploy
```bash
cd /srv/projects/project2/global-pulse
bash scripts/deploy-ec2.sh
```
- Default deploy behavior:
  - rotates runtime evidence before pull (`ROTATE_EVIDENCE_BEFORE_PULL=1`)
  - archives and prunes runtime evidence directories (`ROTATE_EVIDENCE_PRUNE=1`)
  - aborts if tracked local changes exist (`ALLOW_DIRTY_TRACKED=0`)
- Useful overrides:
```bash
# keep runtime evidence files, skip auto-rotation
ROTATE_EVIDENCE_BEFORE_PULL=0 bash scripts/deploy-ec2.sh

# allow deploy even when tracked local changes exist (use carefully)
ALLOW_DIRTY_TRACKED=1 bash scripts/deploy-ec2.sh
```
- Manual evidence rotation:
```bash
cd /srv/projects/project2/global-pulse
PRUNE=1 ARCHIVE_ROOT=/var/backups/global-pulse/evidence npm run ops:evidence:rotate
```
