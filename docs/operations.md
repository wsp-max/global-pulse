# Operations Runbook

## Service Checks
```bash
systemctl status global-pulse-web.service --no-pager
systemctl status global-pulse-collector.timer --no-pager
systemctl status global-pulse-analyzer.timer --no-pager
systemctl status global-pulse-snapshot.timer --no-pager
systemctl status global-pulse-cleanup.timer --no-pager
systemctl status global-pulse-backup.timer --no-pager
```

## Logs
```bash
journalctl -u global-pulse-web.service -n 200 --no-pager
journalctl -u global-pulse-collector.service -n 200 --no-pager
journalctl -u global-pulse-analyzer.service -n 200 --no-pager
journalctl -u global-pulse-snapshot.service -n 200 --no-pager
journalctl -u global-pulse-cleanup.service -n 200 --no-pager
journalctl -u global-pulse-backup.service -n 200 --no-pager
```
- API responses include `x-request-id`; use that value to correlate web/API and batch logs.

## Manual Batch Runs
```bash
cd /srv/projects/project2/global-pulse
pnpm run db:init || npm run db:init
pnpm run ops:collector || npm run ops:collector
pnpm run ops:analyzer -- --hours 6 --with-global --global-hours 24 || npm run ops:analyzer -- --hours 6 --with-global --global-hours 24
pnpm run ops:snapshot -- --hours 24 || npm run ops:snapshot -- --hours 24
pnpm run ops:cleanup || npm run ops:cleanup
```

## PostgreSQL E2E Verification
```bash
cd /srv/projects/project2/global-pulse
pnpm run verify:postgres -- --source reddit_worldnews || npm run verify:postgres -- --source reddit_worldnews
```
- Optional strict mode:
```bash
pnpm run verify:postgres -- --source reddit_worldnews --strict || npm run verify:postgres -- --source reddit_worldnews --strict
```

## Health
```bash
cd /srv/projects/project2/global-pulse
pnpm run health || npm run health
bash scripts/health-check.sh
```

## DB Backup
```bash
cd /srv/projects/project2/global-pulse
bash scripts/backup-db.sh
```

## DB Restore Drill (Scratch DB)
```bash
cd /srv/projects/project2/global-pulse
bash scripts/restore-db.sh
```
- Optional explicit backup file:
```bash
BACKUP_FILE=/var/backups/global-pulse/global_pulse_YYYYMMDD_HHMMSS.sql.gz bash scripts/restore-db.sh
```
- Optional DB name override:
```bash
RESTORE_DB_NAME=global_pulse_restore_verify bash scripts/restore-db.sh
```
- Cleanup scratch DB after drill:
```bash
PGPASSWORD="$DB_PASSWORD" dropdb --host="${DB_HOST:-127.0.0.1}" --port="${DB_PORT:-5432}" --username="${DB_USER:-global_pulse}" global_pulse_restore_verify
```

## Cutover Evidence Capture
```bash
cd /srv/projects/project2/global-pulse
bash scripts/capture-cutover-evidence.sh
npm run ops:evidence:report
```
- Optional flags:
```bash
SOURCE_ID=reddit_worldnews RUN_BACKUP_RESTORE=1 bash scripts/capture-cutover-evidence.sh
npm run ops:evidence:report -- --dir docs/evidence/cutover/<timestamp> --print
```
- Output:
  - `docs/evidence/cutover/<timestamp>/summary.txt`
  - `docs/evidence/cutover/<timestamp>/REPORT.md`

## Final Verification (Default 1 Round)
```bash
cd /srv/projects/project2/global-pulse
npm run ops:closure:preflight
npm run ops:closure:selftest
npm run ops:verify3
npm run ops:verify3:report
npm run ops:verify3:apply
npm run ops:verify3:check
```
- One-shot closure:
```bash
npm run ops:closure
```
- Optional tuning:
```bash
ROUNDS=1 SLEEP_SECONDS=0 SOURCE_ID=reddit_worldnews RUN_BACKUP_RESTORE_FIRST_ROUND=1 RUN_BACKUP_RESTORE_OTHER_ROUNDS=0 bash scripts/run-final-verification-3x.sh
# optional strict mode:
ROUNDS=3 SLEEP_SECONDS=300 SOURCE_ID=reddit_worldnews RUN_BACKUP_RESTORE_FIRST_ROUND=1 RUN_BACKUP_RESTORE_OTHER_ROUNDS=0 bash scripts/run-final-verification-3x.sh
npm run ops:verify3:report -- --dir docs/evidence/final-verification/<timestamp> --print
npm run ops:verify3:apply -- --report docs/evidence/final-verification/<timestamp>/FINAL_REPORT.md --dry-run
npm run ops:verify3:apply -- --report docs/evidence/final-verification/<timestamp>/FINAL_REPORT.md --force
npm run ops:verify3:check -- --dir docs/evidence/final-verification/<timestamp> --skip-docs --print-json
npm run ops:closure:preflight -- --skip-systemd --skip-env --print-json
npm run ops:closure:selftest -- --keep-fixtures
```
- Execution boundary:
  - `ops:verify3` / `ops:closure` are EC2 Linux acceptance gates (requires `systemctl`, `journalctl`, and local service endpoints).
  - default run is single-round (`ROUNDS=1`); increase rounds only when explicitly needed.
  - default auto-selection prefers production timestamp directories (`YYYYMMDD_HHMMSS`) over `SELFTEST_*`.
  - On Windows/local dev, use:
    - `npm run ops:closure:preflight -- --skip-systemd --skip-env --print-json`
    - `npm run ops:closure:selftest`
    - `npm run ops:verify3:check -- --dir docs/evidence/final-verification/<selftest-stamp> --skip-docs --print-json`
- Output:
  - `docs/evidence/final-verification/<timestamp>/summary.txt`
  - `docs/evidence/final-verification/<timestamp>/FINAL_REPORT.md`
  - round-level capture/report logs in same directory
  - appended closure entries in `docs/PATCH_NOTES.md` and `docs/DELIVERY_STATUS.md`

## 24h Monitoring Watch
```bash
cd /srv/projects/project2/global-pulse
npm run ops:monitor:snapshot
```
- Output:
  - `docs/evidence/ops-monitoring/<timestamp>/summary.txt`
  - service/timer/journal/api/db snapshot logs in the same directory
- Recommended cadence:
  - run once per hour for 24 hours after major runtime changes
  - keep all bundles for post-incident comparison
- Optional automation:
```bash
cd /srv/projects/project2/global-pulse
HOURS=24 INTERVAL_SECONDS=3600 MAX_FAILURES=3 npm run ops:monitor:watch
```
- Watch summary:
  - `docs/evidence/ops-monitoring/watch_<timestamp>/watch-summary.txt`

## UI Smoke (Mobile + Error Scenarios)
```bash
cd /srv/projects/project2/global-pulse
npm run ops:ui:smoke
```
- Optional custom host/path:
```bash
APP_HOST=http://127.0.0.1:3100 APP_BASE_PATH=/pulse npm run ops:ui:smoke
```
- Output:
  - `docs/evidence/ui-smoke/<timestamp>/summary.txt`
  - route/api response headers + bodies for troubleshooting

## Common Failure Cases
- `/api/health` returns `postgres_not_configured`
  - PostgreSQL pool/env is missing for web runtime.
  - Set `DATABASE_URL` or `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`.
- `npm ci` fails with peer dependency conflict (`react-simple-maps` / React 19)
  - Ensure project root `.npmrc` includes `legacy-peer-deps=true`.
- `YOUTUBE_API_KEY is missing`
  - Set key in `/etc/global-pulse/global-pulse.env`, then `sudo systemctl restart global-pulse-web.service`.
- Log level control
  - Set `LOG_LEVEL` in `/etc/global-pulse/global-pulse.env` (for example `debug`, `info`, `warn`, `error`).
- Collector guardrails
  - `COLLECTOR_SCRAPER_TIMEOUT_MS`: default scraper timeout.
  - `COLLECTOR_BROWSER_TIMEOUT_MS`: timeout for browser-likely sources.
  - `COLLECTOR_MAX_RSS_MB`: memory budget check before each source run.
- Timer runs but job does not execute
  - Check `Persistent=true` behavior and system clock/timezone.
  - Confirm unit names with `systemctl list-timers`.

## Related Runbooks
- `docs/architecture.md`
- `docs/deployment-ec2.md`
- `docs/supabase-cutover-checklist.md` (legacy record; runtime fallback already removed)

## Supabase Retirement Guard (Should Stay at 0)
```bash
cd /srv/projects/project2/global-pulse
npm run ops:supabase:audit
npm run ops:supabase:budget -- --print-json
```
- Expected:
  - `docs/source-notes/supabase-fallback-audit.md` shows `total matches: 0`
  - `docs/source-notes/supabase-fallback-budget.json` baseline remains `0`
