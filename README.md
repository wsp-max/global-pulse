# Global Pulse

Global Pulse is a dashboard for monitoring hot topics from global communities and social platforms.

## Stack
- Next.js App Router + TypeScript
- Tailwind CSS + CSS variables
- PostgreSQL (single-node EC2 runtime)
- systemd timers for scheduled collection/analysis (EC2 target architecture)
- Collector/Analyzer packages in npm workspaces

## Workspace Layout
- `app/`: Next.js pages and API routes
- `components/`: UI components
- `lib/`: frontend utilities and hooks
- `packages/shared`: shared constants/types/postgres/logger helpers
- `packages/collector`: scraping pipeline scaffold
- `packages/analyzer`: NLP analysis scaffold
- `db/migrations`: SQL schema and indexes
- `.github/workflows`: scheduled jobs
- `scripts/`: setup and local utility scripts

## Quick Start
1. Install dependencies

```bash
npm install
```

2. Configure environment variables

```bash
cp .env.example .env.local
```

3. Run development server

```bash
npm run dev
```

4. (Optional) Seed region/source metadata

```bash
npm run seed:regions
```

## Phase 1 Scope (current)
- Step 1-4 MVP baseline complete (API/UI data binding, topic/timeline views)
- Korea scrapers (`dcinside`, `fmkorea`, `clien`) implemented and persisted to PostgreSQL
- Step 5 in progress: `reddit` and `youtube_kr` collectors implemented

## Collector Commands
- `npm run collect:kr`: Korea community collection (`--region kr --type community`)
- `npm run collect:us`: US community collection (`--region us --type community`)
- `npm run collect:eu`: Europe community collection
- `npm run collect:me`: Middle East community collection
- `npm run collect:youtube:kr`: YouTube KR trending collection (`--source youtube_kr`)
- `npm run collect:youtube:global`: YouTube KR/JP/US trending collection

## Analyzer Commands
- `npm run analyze`: TF-IDF/topic clustering pipeline
- `npm run analyze:gemini`: same pipeline + Gemini summaries (`--with-gemini`)
- `npm run analyze:global`: cross-region mapping to `global_topics`

## Scraper Smoke Tests
- `npm run test:scraper -- --source reddit`
- `npm run test:scraper -- --source reddit_worldnews`
- `npm run test:scraper -- --source reddit_europe`
- `npm run test:scraper -- --source reddit_mideast`
- `npm run test:scraper -- --source fourchan`
- `npm run test:scraper -- --source hackernews`
- `npm run test:scraper -- --source youtube_kr` (requires `YOUTUBE_API_KEY`)

## EC2 Operations (Stepwise Migration)
- Default EC2 app path: `/srv/projects/project2/global-pulse`
- `npm run db:init`: apply SQL migrations in `db/migrations`
- `npm run verify:postgres -- --source reddit_worldnews`: run PostgreSQL E2E verification sequence
- `npm run ops:collector`: run the batch collector entrypoint
- `npm run ops:analyzer`: run the analyzer entrypoint
- `npm run ops:snapshot`: rebuild region snapshots
- `npm run ops:cleanup`: cleanup expired/old data
- `npm run health`: local health check (HTTP + timers)
- `bash scripts/backup-db.sh`: create compressed PostgreSQL backup
- `bash scripts/restore-db.sh`: restore latest backup into scratch DB for drill
- `bash scripts/capture-cutover-evidence.sh`: collect EC2 cutover evidence bundle
- `npm run ops:evidence:report`: generate markdown report from latest evidence bundle
- `npm run ops:verify3`: run final EC2 verification loop (default 1 round)
- `npm run ops:verify3:report`: generate final verification closure report
- `npm run ops:verify3:apply`: append latest final verification report into patch/status docs
- `npm run ops:verify3:check`: validate summary/report/doc consistency for closure
- `npm run ops:closure:preflight`: validate closure prerequisites before running full closure
- `npm run ops:closure:selftest`: run local self-test for closure tooling chain
- `npm run ops:monitor:snapshot`: capture one operational monitoring snapshot bundle
- `npm run ops:monitor:watch`: run hourly ops snapshots for watch window (`HOURS/INTERVAL_SECONDS/MAX_FAILURES`)
- `npm run ops:supabase:audit`: generate Supabase fallback retirement audit report
- `npm run ops:supabase:budget`: ensure Supabase fallback references do not regress above baseline
- `npm run ops:closure`: one-shot closure flow (`verify3` -> `report` -> `apply`)
- increase rounds only when needed:
  - `ROUNDS=3 npm run ops:verify3`
  - `ROUNDS=3 npm run ops:closure`
- See infra files:
  - `infra/nginx/global-pulse.conf`
  - `infra/systemd/*.service`
  - `infra/systemd/*.timer`
- EC2 runbooks:
  - `docs/architecture.md`
  - `docs/deployment-ec2.md`
  - `docs/operations.md`
  - `docs/supabase-cutover-checklist.md`


