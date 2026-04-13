# Global Pulse Architecture (Single EC2 Target)

## Scope
- This document describes the target runtime after migrating away from serverless scheduling.
- Goal: run web/API + collector/analyzer + DB jobs on one EC2 instance.

## Runtime Topology
- Base project path on EC2: `/srv/projects/project2/global-pulse` (under `/srv/projects/project2`).
- `Nginx` listens on `80/443` and reverse proxies to `127.0.0.1:3000`.
- `Next.js` app serves UI and API routes.
- `PostgreSQL` runs locally on EC2 and is not publicly exposed.
- Batch jobs run as `systemd` one-shot services triggered by `systemd timers`.
- Health endpoint: `/api/health` (proxied as `/healthz` in nginx).

## Service Split
- `global-pulse-web.service`
  - Runs the web server (`npm run start` or `pnpm run start`).
- `global-pulse-collector.service` + timer
  - Runs scraper ingestion entrypoint (`scripts/run-collector.ts`).
- `global-pulse-analyzer.service` + timer
  - Runs NLP + optional global mapping (`scripts/run-analyzer.ts`).
- `global-pulse-snapshot.service` + timer
  - Rebuilds `region_snapshots`.
- `global-pulse-cleanup.service` + timer
  - Removes old/expired data.
- `global-pulse-backup.service` + timer
  - Creates periodic PostgreSQL backups via `scripts/backup-db.sh`.

## Data Flow
1. Collector fetches source posts and writes raw rows.
2. Analyzer reads recent raw rows and writes `topics`, `heat_history`, and `global_topics`.
3. Snapshot job creates fast dashboard aggregates in `region_snapshots`.
4. API routes read only from DB; no live scraping on user requests.
5. Cleanup prunes old records by retention policy.

## Migration Notes (Current State)
- Runtime DB access is now PostgreSQL-only.
- Supabase fallback code paths are retired from API, batch, collector, and shared runtime layers.
- Remaining Supabase references are kept only as historical records and retirement guard tooling.
- Current focus:
  - operational stability watch (24h+)
  - scraper/source expansion and quality tuning
