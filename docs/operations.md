# Operations Runbook

## Service Checks
```bash
systemctl status global-pulse-web.service --no-pager
systemctl status global-pulse-collector.timer --no-pager
systemctl status global-pulse-analyzer.timer --no-pager
systemctl status global-pulse-snapshot.timer --no-pager
systemctl status global-pulse-cleanup.timer --no-pager
systemctl status global-pulse-backup.timer --no-pager
systemctl status global-pulse-source-verify.timer --no-pager
```

## Logs
```bash
journalctl -u global-pulse-web.service -n 200 --no-pager
journalctl -u global-pulse-collector.service -n 200 --no-pager
journalctl -u global-pulse-analyzer.service -n 200 --no-pager
journalctl -u global-pulse-snapshot.service -n 200 --no-pager
journalctl -u global-pulse-cleanup.service -n 200 --no-pager
journalctl -u global-pulse-backup.service -n 200 --no-pager
journalctl -u global-pulse-source-verify.service -n 200 --no-pager
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
pnpm run ops:source-verify || npm run ops:source-verify
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

## Runtime Evidence Rotation (EC2 Deploy Hygiene)
```bash
cd /srv/projects/project2/global-pulse
npm run ops:evidence:rotate
```
- Optional prune (archive first, then clear runtime evidence directories):
```bash
cd /srv/projects/project2/global-pulse
PRUNE=1 ARCHIVE_ROOT=/var/backups/global-pulse/evidence npm run ops:evidence:rotate
```
- Deploy integration:
  - `scripts/deploy-ec2.sh` runs evidence rotation before `git pull` by default.
  - defaults: `ROTATE_EVIDENCE_BEFORE_PULL=1`, `ROTATE_EVIDENCE_PRUNE=1`.
  - override example:
```bash
ROTATE_EVIDENCE_BEFORE_PULL=0 bash scripts/deploy-ec2.sh
```
- Output:
  - `/var/backups/global-pulse/evidence/<timestamp>/summary.txt`
  - one archive per evidence category (`ops-monitoring`, `ui-smoke`, `final-verification`, `cutover`)

## Source Ingest Verification (DB Row Check)
```bash
cd /srv/projects/project2/global-pulse
npm run ops:verify:source -- --sources bilibili,mastodon --minutes 60 --samples 3
```
- Optional:
```bash
# do not fail when one source has no rows in the window
npm run ops:verify:source -- --sources bilibili,mastodon --minutes 60 --allow-empty
```
- Behavior:
  - checks `raw_posts` ingestion count for selected sources within the recent window
  - prints per-source sample rows (title/url/collectedAt)
  - exits non-zero by default if any selected source has 0 rows in the window
- Timerized source verification (hourly):
```bash
systemctl status global-pulse-source-verify.timer --no-pager
systemctl status global-pulse-source-verify.service --no-pager
journalctl -u global-pulse-source-verify.service -n 200 --no-pager
```
- Optional env overrides in `/etc/global-pulse/global-pulse.env`:
```bash
VERIFY_SOURCE_INGEST_ENABLED=1
VERIFY_SOURCE_SOURCES=bilibili,mastodon
VERIFY_SOURCE_MINUTES=180
VERIFY_SOURCE_SAMPLES=3
VERIFY_SOURCE_ALLOW_EMPTY=0
```

## Source Connectivity Matrix (All Sources)
```bash
cd /srv/projects/project2/global-pulse
npm run ops:source:report -- --minutes 180 --print-json
```
- Output file:
  - `docs/source-notes/source-connectivity-report.md`
- Optional filters:
```bash
# include inactive sources
npm run ops:source:report -- --include-disabled

# only selected regions
npm run ops:source:report -- --regions kr,jp,tw --minutes 120
```
- Purpose:
  - one-table view for `connected` vs `error/stale/zero` per source
  - includes last error and recommended next action for triage

## Source Health Report (24h + Optional Live Activation)
```bash
cd /srv/projects/project2/global-pulse
npm run ops:source:health -- --format md
```
- Optional filters/output:
```bash
# region-only and JSON output
npm run ops:source:health -- --region kr --format json --print

# activate only sources with >=1 success row in the window (requires explicit confirm)
npm run ops:source:health -- --hours 24 --activate-live --confirm
```
- Behavior:
  - reports per-source `recent_count`, `last_scraped_at`, `last_error`, and connected/degraded state
  - `--activate-live` flips `sources.is_active` by recent 24h success rows

## Community Feed Verification (HTTP + Item Count Gate)
```bash
cd /srv/projects/project2/global-pulse
npm run ops:community:verify-feeds -- --region kr
```
- Optional apply mode:
```bash
npm run ops:community:verify-feeds -- --region kr --apply
```
- Behavior:
  - checks community/sns sources with GET probe
  - requires `itemCount >= 5` to classify as healthy
  - `--apply` updates `sources.is_active` for verified source set

## Recent Topic Enrichment Backfill (Opt-in)
```bash
cd /srv/projects/project2/global-pulse
npm run ops:topics:backfill -- --dry-run --limit 120
```
- Optional focused run:
```bash
npm run ops:topics:backfill -- --region kr --scope community --limit 60
```
- Notes:
  - target: `topics.created_at >= 48h` and `summary_ko is null`
  - updates only `summary_ko/summary_en/category/entities/aliases/canonical_key`
  - does **not** modify `name_ko/name_en`
  - requires `GEMINI_API_KEY`

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
