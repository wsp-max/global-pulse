# Global Pulse Delivery Status

## 紐⑹쟻
- ?꾩옱 援ы쁽 踰붿쐞? ?⑥? ?묒뾽????踰덉뿉 ?뺤씤?섍린 ?꾪븳 ?ㅽ뻾 湲곗? 臾몄꽌.
- ?⑥튂?명듃(`docs/PATCH_NOTES.md`)? ?④퍡 ?낅뜲?댄듃?쒕떎.

## ?꾩옱 ?④퀎
- 湲곗? ?좎쭨: 2026-04-12
- ?꾩옱 吏꾪뻾 ?④퀎: **Step 5 ?뺤옣**
- ?꾩껜 Phase 1 吏꾪뻾瑜?泥댄겕由ъ뒪??湲곗?): **??90%**

## Phase 1 泥댄겕由ъ뒪???곹깭

### Step 1: ?꾨줈?앺듃 珥덇린??- ?곹깭: ?꾨즺
- ?꾨즺 湲곗?:
  - Next.js + Tailwind + 紐⑤끂?덊룷 援ъ“ 援ъ꽦
  - Supabase 留덉씠洹몃젅?댁뀡/湲곕낯 ?뚰겕?뚮줈???ㅽ겕由쏀듃 ?앹꽦

### Step 2: ?쒓뎅 3媛??ъ씠???섏쭛
- ?곹깭: ?꾨즺
- ?꾨즺 湲곗?:
  - `dcinside`, `fmkorea`, `clien` ?섏쭛 援ы쁽
  - `raw_posts` ???+ `sources` ?곹깭 ?낅뜲?댄듃

### Step 3: NLP 遺꾩꽍
- ?곹깭: 遺遺??꾨즺
- ?꾨즺 ??ぉ:
  - TF-IDF ?ㅼ썙??異붿텧
  - ?좏뵿 ?대윭?ㅽ꽣留?  - heat/sentiment 怨꾩궛
  - `topics`, `heat_history`, `region_snapshots` ???  - Gemini ?듭뀡 ?붿빟(`--with-gemini`) ?곌껐
  - 湲濡쒕쾶 遺꾩꽍 ?ㅽ뻾湲?`analyze:global`) 諛??뚰겕?뚮줈???곌껐
- ?⑥? ??ぉ:
  - 踰덉뿭湲?`translator`) ?ㅻ룞???곌퀎
  - ?댁쁺 ?섍꼍(Supabase)?먯꽌 `global_topics` ?앹꽦/留뚮즺 ?ъ씠??寃利?
### Step 4: ?꾨줎?몄뿏??MVP
- ?곹깭: ?遺遺??꾨즺
- ?꾨즺 ??ぉ:
  - ??쒕낫?? 由ъ쟾 ?섏씠吏, 湲濡쒕쾶 ?댁뒋, ??꾨씪?? ?좏뵿 ?곸꽭 ?ㅻ뜲?댄꽣 ?곕룞
  - ?붾뱶留?李⑦듃 諛섏쁺
- ?⑥? ??ぉ:
  - 紐⑤컮???ㅻ퉬寃뚯씠???꾩꽦??蹂닿컯
  - 而댄룷?뚰듃蹂?UI 誘몄꽭議곗젙(諛??媛?낆꽦)

### Step 5: ?뺤옣 以鍮?- ?곹깭: 吏꾪뻾 以?- ?꾨즺 ??ぉ:
  - `reddit` ?섏쭛 援ы쁽
  - `reddit_worldnews` ?섏쭛 援ы쁽
  - `reddit_europe` ?섏쭛 援ы쁽
  - `reddit_mideast` ?섏쭛 援ы쁽
  - `fourchan` ?섏쭛 援ы쁽
  - `hackernews` ?섏쭛 援ы쁽
  - `youtube_kr/jp/us` ?섏쭛 援ы쁽
  - Gemini ?붿빟 ?뚯씠?꾨씪???곌껐
  - US ?섏쭛 ?뚰겕?뚮줈?곗뿉??3媛??뚯뒪 ?숈떆 ?ㅽ뻾 ?뺤씤
  - EU/ME ?섏쭛 ?뚰겕?뚮줈???ㅽ뻾 寃쎈줈 ?뺤씤
- ?⑥? ??ぉ:
  - ? 由ъ쟾 ?ㅽ겕?섑띁(?쇰낯/?留?以묎뎅) ?쒖감 ?숈옉??  - SNS ?뚯뒪(`mastodon`, `bilibili`, `telegram`) ?댁쁺 ?덉젙??
## 吏湲덈????댁빞 ????(?곗꽑?쒖쐞)

1. `cross-region-mapper` ?댁쁺 寃利?+ `global_topics` ?먮룞 ?앹꽦 ?덉젙??- ?꾨즺 湲곗?:
  - 2媛??댁긽 由ъ쟾 ?좏뵿???먮룞 留ㅽ븨?섏뼱 `global_topics` ?앹꽦
  - `first_seen_region/at`, `regional_sentiments`, `regional_heat_scores` ?뺤긽 湲곕줉

2. SNS ?뺤옣 ?덉젙??- 紐⑺몴 ?뚯뒪: `mastodon`, `bilibili` (媛?ν븯硫?`telegram`)
- ?꾨즺 湲곗?:
  - ?ㅽ뙣 ??graceful fallback
  - source ?곹깭/?먮윭 濡쒓렇 諛섏쁺

3. ?꾨줎???덉쭏 留덇컧
- ?꾨즺 湲곗?:
  - 紐⑤컮??酉곗뿉???듭떖 ?숈꽑(??쒕낫??由ъ쟾/湲濡쒕쾶/??꾨씪?? 臾몄젣 ?놁쓬
  - API ?덉쇅 ???ъ슜??硫붿떆吏 ?쇨????뺣낫

## Phase 1 ?꾨즺???대뵒源뚯? ?댁빞 ?섎뒗吏)
- ?ㅼ쓬 議곌굔 異⑹” ??Phase 1 ?꾨즺濡?蹂몃떎:
  - ?쒓뎅/誘멸뎅 ?듭떖 ?섏쭛 ?뚯씠?꾨씪???덉젙 ?숈옉
  - 湲濡쒕쾶 ?좏뵿 ?먮룞 ?앹꽦(`global_topics`) ?뚯씠?꾨씪???숈옉
  - ?꾨줎??4媛??듭떖 ?섏씠吏(硫붿씤/由ъ쟾/湲濡쒕쾶?댁뒋/??꾨씪?? ?ㅻ뜲?댄꽣 ?댁쁺 媛??  - GitHub Actions ?ㅼ?以?寃쎈줈媛 ?섏쭛->遺꾩꽍 ?먮쫫?쇰줈 ?곌껐
  - ?ㅽ뙣 ??濡쒓렇/?곹깭 ?뺤씤 媛??`sources.last_error`, ?뚰겕?뚮줈??寃쎄퀬)

## 理쒓렐 寃利??ㅻ깄??(2026-04-12)
- ?깃났
  - `npm run test:scraper -- --source reddit_worldnews`
  - `npm run test:scraper -- --source hackernews`
  - `npm run collect:us` (reddit/reddit_worldnews/hackernews 3/3 ?깃났)
  - `npm run test:scraper -- --source reddit_europe`
  - `npm run test:scraper -- --source reddit_mideast`
  - `npm run test:scraper -- --source fourchan`
  - `npm run collect:eu` (reddit_europe 1/1 ?깃났)
  - `npm run collect:me` (reddit_mideast 1/1 ?깃났)
  - `npm run collect:us` (reddit/reddit_worldnews/fourchan/hackernews 4/4 ?깃났)
  - `npm run lint`
  - `npm run build` (?ъ떆???ы븿 理쒖쥌 ?듦낵)
  - `npm run analyze:global -- --hours 24 --min-regions 2 --similarity 0.3` ?ㅽ뻾 寃쎈줈 ?뺤씤
- ?덉긽 ?ㅽ뙣(?섍꼍 蹂??誘몄꽕??
  - `npm run test:scraper -- --source youtube_jp`
  - `npm run test:scraper -- --source youtube_us`
  - `npm run collect:youtube:global`
  - `npm run analyze:global` ?짣B write 寃利?(Supabase ???놁쓬)

## ?댁쁺 洹쒖튃
- 紐⑤뱺 ?④퀎 ?꾨즺 ??
  - `docs/PATCH_NOTES.md`??踰꾩쟾 異붽?
  - ??臾몄꽌(`docs/DELIVERY_STATUS.md`)???곹깭/?⑥? ??ぉ 媛깆떊

## EC2 Pivot Status (2026-04-12)
- Status: In Progress (Step 1 done)
- Goal: Move from serverless operation to single EC2 operation model.

### Completed in EC2 Pivot Step 1
- Added infra scaffolding for:
  - nginx reverse proxy
  - systemd services/timers (web, collector, analyzer, snapshot, cleanup)
- Added ops scripts:
  - collector/analyzer entrypoints
  - snapshot builder
  - cleanup runner
  - deploy script
  - DB backup script
  - health check scripts
- Added health API endpoint: `/api/health`
- Added docs:
  - `docs/architecture.md`
  - `docs/deployment-ec2.md`
  - `docs/operations.md`

### Remaining (EC2 Migration)
1. Database adapter migration
- Replace Supabase SDK calls with local PostgreSQL adapter (`pg` or Drizzle).
- Move schema/migrations from `supabase/` runtime assumption to `db/` migration pipeline.

2. API/Batch runtime migration
- Update `app/api/*` and `packages/*` DB access layer to new adapter.
- Keep API response contracts stable during migration.

3. Scheduler migration finalization
- Keep GitHub Actions only for CI.
- Define systemd timer schedules as source-of-truth.

4. Production hardening
- Add pino logging integration.
- Add DB backup timer wiring and restore drill docs.
- Add resource limits/concurrency controls for puppeteer sources.

### Done vs Remaining (high level)
- Done: existing MVP features + collector/analyzer pipeline + EC2 infra bootstrap.
- Remaining: DB runtime migration and serverless dependency removal at code level.

## EC2 Pivot Progress Update (2026-04-12, Step 2A)
### Newly completed
- Added local PostgreSQL adapter (`pg`) and API runtime bridge.
- API routes now support `postgres` provider with fallback to Supabase:
  - health, stats, regions, topics, global-topics, timeline, search, topic detail.
- Added response-level provider metadata to make runtime source visible.

### Remaining for full EC2 migration
1. Batch write migration (critical)
- Replace Supabase writes in:
  - `packages/collector/src/utils/supabase-storage.ts`
  - `packages/analyzer/src/run-analysis.ts`
  - `packages/analyzer/src/run-global-analysis.ts`
  - `scripts/build-snapshots.ts`
  - `scripts/cleanup-old-data.ts`
- Target: local PostgreSQL write path with same table contracts.

2. DB migration pipeline finalization
- Move runtime schema source-of-truth to `db/migrations/*`.
- Keep `supabase/` as legacy reference only after parity confirmation.

3. Ops hardening
- Integrate pino logging pipeline (web + batch).
- Wire DB backup timer and restore rehearsal docs.
- Add source-level concurrency limits for puppeteer scrapers in production mode.

4. Scheduler simplification
- Keep GitHub Actions for CI only.
- Use systemd timers as canonical scheduler in production docs.

## EC2 Path Update (2026-04-12)
- Canonical EC2 project path is now:
  - `/srv/projects/project2/global-pulse`
- systemd units, deploy script defaults, and operations/deployment docs have been aligned to this path.
- If an existing server still uses `/opt/global-pulse`, temporarily override with `APP_DIR` or update unit files during migration.

## EC2 Pivot Progress Update (2026-04-12, Step 2B)
### Newly completed
- Batch write path migrated to PostgreSQL-first + Supabase fallback:
  - collector persistence
  - analyzer regional pipeline
  - analyzer global pipeline
  - snapshot builder
  - cleanup job

### Remaining (priority)
1. Local PostgreSQL live validation on EC2
- Run collector/analyzer/snapshot/cleanup against actual DB with `DATABASE_URL` or `DB_*` env set.
- Confirm row-level writes on `raw_posts/topics/global_topics/region_snapshots/heat_history`.

2. Seed/bootstrap migration
- Migrate `scripts/seed-regions.ts` from Supabase SDK to PostgreSQL path.
- Finalize DB initialization flow under `db/migrations` + `db/seeds`.

3. Production hardening
- Integrate pino logging in batch + API runtime.
- Add backup timer wiring and recovery rehearsal record.

4. Scheduler cleanup
- Keep GitHub Actions for CI only; operations scheduler source-of-truth remains systemd timers.

## EC2 Pivot Progress Update (2026-04-12, Step 2C)
### Newly completed
- `seed-regions` script migrated to PostgreSQL-first + Supabase fallback.

### Remaining (updated)
1. Live local PostgreSQL E2E validation on EC2
- collector -> analyzer -> global analyzer -> snapshot -> cleanup -> seed run.
- Confirm writes and upserts in target DB.

2. DB migration source-of-truth consolidation
- finalize `db/migrations` + `db/seeds` operational path.

3. Production hardening
- pino logging integration
- backup timer + restore rehearsal logs
- puppeteer source concurrency/resource limits

## EC2 Pivot Progress Update (2026-04-12, Step 3A)
### Newly completed
- Migration source path is now runnable at `db/migrations` via `npm run db:init`.
- Added PostgreSQL E2E verifier command `npm run verify:postgres` for EC2 runtime checks.

### Remaining (updated priority)
1. EC2 live execution and evidence capture
- Run `db:init` and `verify:postgres` on EC2 with real PostgreSQL env.
- Capture command logs and table count snapshots into docs.

2. Production hardening
- pino logging integration for web/API and batch jobs.
- backup timer wiring + restore rehearsal record.
- puppeteer source concurrency/resource guardrails.

3. Optional cleanup
- after full EC2 cutover, archive/deprecate supabase runtime docs/scripts in a controlled phase.

## EC2 Pivot Progress Update (2026-04-12, Step 3B)
### Newly completed
- Backup scheduling wired via `global-pulse-backup.timer`.
- Deploy script now enables backup timer during rollout.

### Remaining (current)
1. EC2 live execution evidence
- run `db:init`, `verify:postgres`, and check `global-pulse-backup.timer` active state on host.

2. pino logging integration
- structured logs for API and batch pipelines.

3. restore rehearsal
- verify backup file creation + one restore drill and document results.

## EC2 Pivot Progress Update (2026-04-12, Step 3C)
### Newly completed
- API runtime logging hardening completed:
  - shared request logger wrapper for all active API routes
  - per-request `x-request-id` propagation in responses
  - unified start/end/exception logs with pino
- Remaining script-level `console.*` usage removed:
  - `scripts/test-scraper.ts`
  - `scripts/setup-supabase.ts`
- Local runtime verification confirms all API routes respond with `x-request-id`.

### Remaining (current)
1. EC2 live execution evidence (must run on host)
- `npm run db:init`
- `npm run verify:postgres` (without `--skip-jobs`)
- `systemctl status global-pulse-backup.timer`
- `journalctl -u global-pulse-web -u global-pulse-collector -u global-pulse-analyzer -n 200`

2. Restore rehearsal evidence
- execute `scripts/backup-db.sh` on EC2
- perform one restore drill to a scratch database
- record commands and outcome in `docs/operations.md` + `docs/PATCH_NOTES.md`

3. Puppeteer production guardrails
- add explicit concurrency and timeout caps for Chromium-based sources
- verify memory pressure behavior on t3.medium baseline

## EC2 Pivot Progress Update (2026-04-12, Step 3D)
### Newly completed
- Added restore drill automation script:
  - `scripts/restore-db.sh`
- Updated runbooks for backup + restore drill workflow:
  - `docs/operations.md`
  - `docs/deployment-ec2.md`
  - `README.md` operations section
- Confirmed docs remain UTF-8 valid after cumulative updates.

### Remaining (current)
1. EC2 host evidence capture (blocking for migration closure)
- Run and record:
  - `npm run db:init`
  - `npm run verify:postgres -- --source reddit_worldnews`
  - `systemctl status global-pulse-backup.timer`
  - `bash scripts/backup-db.sh`
  - `bash scripts/restore-db.sh`
- Save outputs and table snapshots into patch notes.

2. Puppeteer guardrails
- Introduce explicit concurrency/memory constraints for Chromium-based scrapers.
- Validate behavior under sustained timer-triggered runs on EC2.

3. Supabase runtime deprecation phase (optional after cutover evidence)
- Mark legacy fallback paths and define a removal checklist.

## EC2 Pivot Progress Update (2026-04-12, Step 3E)
### Newly completed
- Added collector runtime guardrails in `packages/collector/src/run.ts`:
  - per-source timeout
  - browser-like source timeout override
  - pre-run RSS memory budget check
- Added guardrail env settings:
  - `COLLECTOR_SCRAPER_TIMEOUT_MS`
  - `COLLECTOR_BROWSER_TIMEOUT_MS`
  - `COLLECTOR_MAX_RSS_MB`
- Verified guarded collection run with `reddit_worldnews`.

### Remaining (current)
1. EC2 host evidence capture (blocking closure)
- Run and document:
  - `npm run db:init`
  - `npm run verify:postgres -- --source reddit_worldnews`
  - `systemctl status global-pulse-backup.timer`
  - `bash scripts/backup-db.sh`
  - `bash scripts/restore-db.sh`

2. Chromium-source validation
- Once Chromium-based scrapers are enabled, validate timeout/memory behavior with live browser workloads.

3. Supabase runtime deprecation phase (optional after cutover evidence)
- Mark fallback paths and define phased removal checklist.

## EC2 Pivot Progress Update (2026-04-12, Step 3F)
### Newly completed
- Added Supabase fallback runtime kill-switch:
  - `ENABLE_SUPABASE_FALLBACK=false`
- Added shared fallback flag helper in runtime:
  - `isSupabaseServiceFallbackEnabled()`
- API Supabase accessor now short-circuits when fallback is disabled.
- Added cutover runbook:
  - `docs/supabase-cutover-checklist.md`

### Remaining (current)
1. EC2 host evidence capture (blocking closure)
- Execute and record:
  - `npm run db:init`
  - `npm run verify:postgres -- --source reddit_worldnews`
  - `systemctl status global-pulse-backup.timer`
  - `bash scripts/backup-db.sh`
  - `bash scripts/restore-db.sh`

2. PostgreSQL-only cutover execution
- Set `ENABLE_SUPABASE_FALLBACK=false` on EC2.
- Re-run API/batch smoke tests and collect journald evidence.

3. Supabase path retirement (post-evidence)
- Remove residual Supabase fallback code in phased PR after successful cutover window.

## EC2 Pivot Progress Update (2026-04-12, Step 3G)
### Newly completed
- Added one-shot cutover evidence bundle automation:
  - `scripts/capture-cutover-evidence.sh`
- Added evidence artifact convention docs:
  - `docs/evidence/README.md`
- Added runnable hook:
  - `npm run ops:evidence` (EC2/bash environment)
- Updated operations/deployment/cutover runbooks to use automated evidence capture.

### Remaining (current)
1. EC2 execution of evidence bundle (blocking closure)
- Run:
  - `bash scripts/capture-cutover-evidence.sh`
- Attach resulting `docs/evidence/cutover/<timestamp>/summary.txt` and key logs into:
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`

2. PostgreSQL-only operational confirmation
- Keep `ENABLE_SUPABASE_FALLBACK=false`
- Verify timer-driven batch cycles over multiple intervals.

3. Supabase code retirement
- After stable run window, remove fallback implementation paths in staged changes.

## EC2 Pivot Progress Update (2026-04-12, Step 3H)
### Newly completed
- Added automated evidence report generation:
  - `scripts/generate-evidence-report.ts`
  - `npm run ops:evidence:report`
- Report output now standardized as:
  - `docs/evidence/cutover/<timestamp>/REPORT.md`
- Cutover/operations docs updated to include report generation step.

### Remaining (current)
1. EC2 blocking execution
- Run on host:
  - `bash scripts/capture-cutover-evidence.sh`
  - `npm run ops:evidence:report`

2. Patch-note closure with real host evidence
- Append actual report outputs and command outcomes into:
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`

3. Final production closure
- After EC2 evidence pass, run final 3x verification cycle and mark migration closure.

## EC2 Pivot Progress Update (2026-04-12, Step 3I)
### Newly completed
- Added final 3x verification automation:
  - `scripts/run-final-verification-3x.sh`
  - `npm run ops:verify3`
- Added final verification evidence output convention:
  - `docs/evidence/final-verification/<timestamp>/summary.txt`
- Updated cutover/operations docs to use this as closure gate.

### Remaining (current)
1. Execute closure gate on EC2
- Run:
  - `npm run ops:verify3`
- Acceptance:
  - all rounds `failures=0`
  - summary artifact exists under `docs/evidence/final-verification/<timestamp>/`

2. Final documentation closure
- Append EC2 actual 3x verification results into:
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`

3. Post-closure cleanup
- Start phased removal of residual Supabase fallback code.

## EC2 Pivot Progress Update (2026-04-12, Step 3J)
### Newly completed
- Added final verification report generation:
  - `scripts/generate-final-verification-report.ts`
  - `npm run ops:verify3:report`
- Final verification evidence now has standardized closure artifact:
  - `docs/evidence/final-verification/<timestamp>/FINAL_REPORT.md`
- Updated deployment/operations/cutover runbooks to include final report generation.

### Remaining (current)
1. EC2 closure execution (blocking)
- Run:
  - `npm run ops:verify3`
  - `npm run ops:verify3:report`
- Confirm:
  - `failures=0` in final summary
  - closure state `PASS` in `FINAL_REPORT.md`

2. Final docs closure
- Append real EC2 final verification report results into:
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`

3. Post-closure code cleanup
- Begin phased Supabase fallback removal after acceptance window.

## EC2 Pivot Progress Update (2026-04-13, Step 3K)
### Newly completed
- Added final report import automation:
  - `scripts/apply-final-verification-report.ts`
  - `npm run ops:verify3:apply -- --report <FINAL_REPORT.md>`
- Added dry-run validation mode for safe preview before append:
  - `--dry-run`
- Updated runbooks to include automated closure-doc append flow.

### Remaining (current)
1. EC2 closure execution (blocking)
- Run:
  - `npm run ops:verify3`
  - `npm run ops:verify3:report`
  - `npm run ops:verify3:apply -- --report docs/evidence/final-verification/<timestamp>/FINAL_REPORT.md`

2. Final closure confirmation
- Verify latest appended entries in:
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`
- Confirm closure state is `PASS` and failures are `0`.

3. Post-closure cleanup
- Start phased Supabase fallback retirement and monitor stability window.

## EC2 Pivot Progress Update (2026-04-13, Step 3L)
### Newly completed
- Added one-shot closure runner:
  - `scripts/complete-closure.sh`
  - `npm run ops:closure`
- Enhanced `ops:verify3:apply`:
  - latest `FINAL_REPORT.md` auto-resolve when `--report` omitted
  - duplicate-import guard and optional `--force`
- Updated runbooks with one-shot closure command and apply options.

### Remaining (current)
1. EC2 closure execution (blocking)
- Run on host:
  - `npm run ops:closure`
- Confirm:
  - final summary `failures=0`
  - `FINAL_REPORT.md` closure state `PASS`
  - `PATCH_NOTES.md` and `DELIVERY_STATUS.md` updated by apply step

2. Post-closure cleanup
- Phase out Supabase fallback code paths in controlled cleanup PRs.

3. Stability watch
- Monitor web/collector/analyzer timer runs and logs for at least 24h.

## EC2 Pivot Progress Update (2026-04-13, Step 3M)
### Newly completed
- Added closure consistency check command:
  - `npm run ops:verify3:check`
- One-shot closure (`ops:closure`) now includes consistency check execution.
- Added checker options for targeted validation:
  - `--dir`, `--skip-docs`, `--expected-state`, `--expected-failures`, `--print-json`

### Remaining (current)
1. EC2 final closure execution (blocking)
- Run:
  - `npm run ops:closure`
- Confirm:
  - `ops:verify3` pass
  - `ops:verify3:report` generated
  - `ops:verify3:apply` appended docs
  - `ops:verify3:check` pass (no issues)

2. Final closure audit
- Verify latest entries in:
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`
- Ensure closure state `PASS`, failures `0`, and evidence paths are present.

3. Post-closure hardening
- Start Supabase fallback retirement phase and keep 24h operational watch.

## EC2 Pivot Progress Update (2026-04-13, Step 3N)
### Newly completed
- Added closure preflight validation command:
  - `npm run ops:closure:preflight`
- Added preflight options for local/CI dry checks:
  - `--skip-systemd`, `--skip-env`, `--print-json`
- Integrated preflight into one-shot closure runner (`ops:closure`) before verification chain.

### Remaining (current)
1. EC2 final closure execution (blocking)
- Run:
  - `npm run ops:closure`
- Confirm sequential pass:
  - `ops:closure:preflight`
  - `ops:verify3`
  - `ops:verify3:report`
  - `ops:verify3:apply`
  - `ops:verify3:check`

2. Final closure evidence import verification
- Ensure latest evidence paths appear in:
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`

3. Post-closure retirement and watch
- Begin Supabase fallback code retirement phase and observe operational stability window.

## EC2 Pivot Progress Update (2026-04-13, Step 3O)
### Newly completed
- Added closure tooling self-test:
  - `npm run ops:closure:selftest`
- Self-test now validates closure automation script chain in local environment before EC2 execution.
- Updated runbooks to include self-test in pre-closure sequence.

### Remaining (current)
1. EC2 final closure execution (blocking)
- Run:
  - `npm run ops:closure`
- Confirm full chain pass and closure evidence outputs.

2. Final closure evidence confirmation
- Verify latest imported markers in:
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`

3. Post-closure cleanup
- Phase out Supabase fallback code and monitor operational stability window.

## EC2 Pivot Progress Update (2026-04-13, Step 3P)
### Newly completed
- Added Supabase fallback retirement audit command:
  - `npm run ops:supabase:audit`
- Generated baseline audit report:
  - `docs/source-notes/supabase-fallback-audit.md`
  - current baseline match count: `53`
- Added retirement prep references in operations/checklist docs.

### Remaining (current)
1. EC2 closure execution (blocking)
- Run:
  - `npm run ops:closure`
- Confirm closure chain pass and evidence import completion.

2. Supabase retirement execution plan
- Use `docs/source-notes/supabase-fallback-audit.md` as removal backlog.
- Execute staged removal after closure acceptance.

3. Stability and cleanup
- Maintain post-closure operational watch window.
- Remove legacy fallback paths in phased PRs.

## EC2 Pivot Progress Update (2026-04-13, Step 3Q)
### Newly completed
- Added Supabase fallback budget guard command:
  - `npm run ops:supabase:budget`
- Added baseline budget file:
  - `docs/source-notes/supabase-fallback-budget.json`
- Verified budget check pass on current baseline (`total=53`).

### Remaining (current)
1. EC2 final closure execution (blocking)
- Run:
  - `npm run ops:closure`
- Confirm full closure chain and evidence import completion.

2. Supabase retirement staged execution
- Use audit + budget guard together:
  - `npm run ops:supabase:audit`
  - `npm run ops:supabase:budget`
- Start phased fallback removal after closure acceptance.

3. Post-closure monitoring
- Keep operational watch window and re-run budget check during each removal stage.

## EC2 Pivot Progress Update (2026-04-13, Step 3R)
### Newly completed
- Revalidated current closure-tooling chain and quality gates:
  - `npm run ops:closure:selftest` (pass)
  - `npm run ops:supabase:budget -- --print-json` (pass, baseline `total=53`)
  - `npm run lint` (pass)
  - `npm run build` (pass)
  - `npm run ops:closure:preflight -- --skip-systemd --skip-env --print-json` (pass)
  - `npm run ops:closure:selftest -- --keep-fixtures` (pass)
  - `npm run ops:verify3:check -- --dir docs/evidence/final-verification/SELFTEST_1776027904047 --skip-docs --expected-state PASS --expected-failures 0 --print-json` (pass)
- Recorded failure/recovery history:
  - one `ops:verify3:check` run failed due to deleted fixture directory
  - recovered by regenerating fixture with `--keep-fixtures` and re-running check (pass)
- UTF-8 validation confirmed:
  - `docs/INITIAL_PROMPT_GLOBAL_PULSE.md`
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`
- Clarified execution boundary:
  - `ops:verify3` and `ops:closure` remain EC2 runtime gates (Linux `systemctl`/`journalctl` dependency), not a Windows-local acceptance gate.

### Remaining (current)
1. EC2 final closure execution (blocking)
- Run on host `/srv/projects/project2/global-pulse`:
  - `npm run ops:closure`
- Confirm full chain pass:
  - `ops:closure:preflight`
  - `ops:verify3`
  - `ops:verify3:report`
  - `ops:verify3:apply`
  - `ops:verify3:check`

2. Final evidence + document closure
- Confirm latest generated artifacts:
  - `docs/evidence/final-verification/<timestamp>/summary.txt`
  - `docs/evidence/final-verification/<timestamp>/FINAL_REPORT.md`
- Confirm closure markers appended with:
  - failures `0`
  - closure state `PASS`
  - evidence path references in `docs/PATCH_NOTES.md` and `docs/DELIVERY_STATUS.md`

3. Next phase after closure acceptance
- Start staged Supabase fallback retirement using:
  - `npm run ops:supabase:audit`
  - `npm run ops:supabase:budget`
- Keep post-closure operational watch window.

## EC2 Pivot Progress Update (Step 3K Imported Final Evidence)
### Imported Final Evidence
- Final verification timestamp: SELFTEST_1776027904047
- Closure state: PASS
- Failures: 0
- Evidence report: /srv/projects/project2/global-pulse/docs/evidence/final-verification/SELFTEST_1776027904047/FINAL_REPORT.md
- Round outcomes:
  - round1: OK (capture=0, report=0, script_failures=0)
  - round2: OK (capture=0, report=0, script_failures=0)
  - round3: OK (capture=0, report=0, script_failures=0)

### Remaining (current)
1. Supabase fallback retirement
- Remove fallback code paths in staged cleanup PR(s).
2. Operational watch
- Monitor timer-driven jobs and logs through at least one full day cycle.

## EC2 Pivot Progress Update (Step 3K Imported Final Evidence)
### Imported Final Evidence
- Final verification timestamp: 20260412_212140
- Closure state: PASS
- Failures: 0
- Evidence report: /srv/projects/project2/global-pulse/docs/evidence/final-verification/20260412_212140/FINAL_REPORT.md
- Round outcomes:
  - round1: OK (capture=0, report=0, script_failures=0)

### Remaining (current)
1. Supabase fallback retirement
- Remove fallback code paths in staged cleanup PR(s).
2. Operational watch
- Monitor timer-driven jobs and logs through at least one full day cycle.

## EC2 Pivot Progress Update (2026-04-13, Step 3S)
### Newly completed
- Deployed current workspace to EC2 target:
  - `/srv/projects/project2/global-pulse`
- Resolved EC2 install blocker:
  - added `.npmrc` (`legacy-peer-deps=true`) for `npm ci` peer conflict
- Resolved preflight toolchain blocker:
  - installed `postgresql-client` on EC2 (`pg_dump`, `psql`)
- Executed user-requested single-run closure (`1??):
  - `ROUNDS=1 SLEEP_SECONDS=0 npm run ops:closure`
  - preflight PASS, verify round1 PASS, failures `0`
- Corrected closure evidence targeting to actual run dir:
  - `docs/evidence/final-verification/20260412_212140`
  - explicit `ops:verify3:report` / `ops:verify3:apply` / `ops:verify3:check` pass
- Synced EC2-updated docs/evidence back to local workspace.

### Remaining (current)
1. Supabase fallback retirement phase
- Start staged cleanup using:
  - `npm run ops:supabase:audit`
  - `npm run ops:supabase:budget`

2. Operational watch window
- Observe web/collector/analyzer and timer cycles for at least 24h.

3. Optional closure strictness upgrade
- If required, rerun closure with 3 rounds (strict mode override).

## EC2 Pivot Progress Update (2026-04-13, Step 3T)
### Newly completed
- Enforced single-run verification as default policy:
  - `run-final-verification-3x.sh` now defaults to `ROUNDS=1`
  - closure runner log now prints effective rounds
  - closure self-test fixture metadata now uses `rounds=1`
- Hardened automatic final evidence selection:
  - default resolver now prioritizes production timestamp directories (`YYYYMMDD_HHMMSS`) over `SELFTEST_*`
  - applied to:
    - `ops:verify3:report`
    - `ops:verify3:apply`
    - `ops:verify3:check`
- Hardened report compatibility and doc checks:
  - parser now accepts both headings:
    - `Final 3x Verification`
    - `Final Verification`
  - canonical source/evidence path now derived from `run_dir` when available
  - local Windows checks no longer fail on path separator/absolute-path mismatch
- Fixed Supabase retirement audit inflation:
  - excluded budget guard script from audit scan
  - audit baseline/count consistency restored (`53`)
- Updated runbooks to match new policy:
  - `README.md`, `docs/operations.md`, `docs/supabase-cutover-checklist.md`, `docs/deployment-ec2.md`, `docs/evidence/README.md`

### Validation (single-run policy)
- `npm run lint` (pass)
- `npm run build` (pass)
- `npm run ops:closure:selftest` (pass)
- `npm run ops:verify3:report -- --print` (pass; selected production timestamp evidence)
- `npm run ops:verify3:check -- --print-json` (pass; `issues=[]`)
- `npm run ops:verify3:apply -- --dry-run` (pass; canonical `/srv/.../FINAL_REPORT.md` path in preview)
- `npm run ops:supabase:audit` (pass; total `53`)
- `npm run ops:supabase:budget -- --print-json` (pass)

### Remaining (current)
1. Supabase fallback retirement phase (actual code removal)
- Start API fallback removal first:
  - remove `getSupabaseServiceClientOrNull` branches from API routes after PostgreSQL-only behavior confirmation.

2. Batch/script fallback staged removal
- Migrate analyzer/collector/scripts to PostgreSQL-only path in controlled slices.

3. Operational watch
- Maintain 24h monitoring window while fallback removal proceeds.

## EC2 Pivot Progress Update (2026-04-13, Step 3U)
### Newly completed
- Started Supabase fallback retirement in API layer (slice 1):
  - removed Supabase fallback branch from `app/api/health/route.ts`
  - health DB readiness is now PostgreSQL-only
- Recomputed and tightened fallback inventory budget:
  - audit total: `53 -> 51`
  - `getSupabaseServiceClientOrNull`: `17 -> 15`
  - baseline updated in:
    - `docs/source-notes/supabase-fallback-budget.json`
- Regenerated and revalidated guards:
  - `ops:supabase:audit` pass
  - `ops:supabase:budget` pass with new baseline

### Validation (single-run policy)
- `npm run lint` (pass)
- `npm run build` (pass)
- `npm run ops:supabase:audit` (pass, `total_matches=51`)
- `npm run ops:supabase:budget -- --print-json` (pass, budget/current matched)

### Remaining (current)
1. API fallback retirement (remaining routes)
- Remove Supabase fallback branches from:
  - `/api/topics`
  - `/api/regions`
  - `/api/global-topics`
  - `/api/search`
  - `/api/stats`
  - `/api/timeline`
  - `/api/topic/[topicId]`

2. Batch/script fallback retirement
- Migrate collector/analyzer/scripts to PostgreSQL-only path in staged slices.

3. Guardrail maintenance
- Tighten fallback budget baseline after each approved removal slice.

## EC2 Pivot Progress Update (2026-04-13, Step 3V~3Z)
### Newly completed
- Step 3V (API ?쒓굅 2李? ?꾨즺:
  - Supabase fallback ?쒓굅:
    - `/api/topics`
    - `/api/regions`
    - `/api/global-topics`
    - `/api/search`
    - `/api/stats`
    - `/api/timeline`
    - `/api/topic/[topicId]`
  - API??PostgreSQL-only ?먮뒗 誘멸뎄????`provider: "none"` ?묐떟?쇰줈 ?듭씪
- Step 3W (Batch ?쒓굅 1李? ?꾨즺:
  - `scripts/build-snapshots.ts` PostgreSQL-only
  - `scripts/cleanup-old-data.ts` PostgreSQL-only
  - analyzer 吏꾩엯??PostgreSQL-only:
    - `packages/analyzer/src/run-analysis.ts`
    - `packages/analyzer/src/run-global-analysis.ts`
- Step 3X (Collector/Seed ?쒓굅 2李? ?꾨즺:
  - collector storage 寃쎈줈 PostgreSQL-only:
    - `packages/collector/src/utils/supabase-storage.ts`
  - seed 寃쎈줈 PostgreSQL-only:
    - `scripts/seed-regions.ts`
- Step 3Y (Shared/Env 理쒖쥌?뺣━) ?꾨즺:
  - shared Supabase runtime export ?쒓굅:
    - `packages/shared/src/index.ts`
  - Supabase runtime ?뚯씪 ?쒓굅:
    - `packages/shared/src/supabase.ts` (deleted)
    - `app/api/_shared/supabase-server.ts` (deleted)
    - `lib/supabase-client.ts` (deleted)
  - preflight env 泥댄겕瑜?PostgreSQL 湲곗??쇰줈 ?꾪솚:
    - `scripts/closure-preflight.ts`
- Step 3Z (留덇컧 寃利?臾몄꽌 怨좎젙) ?꾨즺:
  - `npm run lint` (pass)
  - `npm run build` (pass)
  - `npm run ops:supabase:audit` (pass, `totalMatches=0`)
  - `npm run ops:supabase:budget -- --print-json` (pass, budget/current `0`)
  - `npm run ops:verify3:check -- --print-json` (pass, `issues=[]`)
  - budget ?ш린以??
    - `docs/source-notes/supabase-fallback-budget.json`: `51 -> 0`
  - ?⑥튂?명듃 ?꾩쟻 諛섏쁺:
    - `docs/PATCH_NOTES.md` (`GP-20260413-39`)

### Current completion state
- Supabase fallback runtime 肄붾뱶 寃쎈줈: ?쒓굅 ?꾨즺 (`0` matches)
- Single-run ?대줈? ?뺤콉: ?좎? (`ROUNDS=1` 湲곕낯)
- EC2 final evidence: PASS ?좎? (`20260412_212140`)

### Remaining (current)
1. ?댁쁺 愿李?24h) ?좎?
- systemd timer 二쇨린 ?섏쭛/遺꾩꽍/?뺣━ 猷⑦봽 紐⑤땲?곕쭅
- ?먮윭??吏??DB ?⑸웾 異붿씠 ?뺤씤

2. 臾몄꽌 ?뺣━(?좏깮)
- ??궗 臾몄꽌 ??Supabase ?쒖닠? ?고???鍮꾪솢???덇굅?쒖엫??紐낆떆?곸쑝濡??쇰꺼留?
## EC2 Pivot Progress Update (2026-04-13, Step 4A)
### Newly completed
- ?댁쁺 臾몄꽌 PostgreSQL-only 湲곗? ?뺣━:
  - `README.md`
  - `docs/operations.md`
  - `docs/deployment-ec2.md`
  - `docs/architecture.md`
  - `docs/supabase-cutover-checklist.md` (legacy record ?ъ젙??
  - `.env.example`
- 24h ?댁쁺 愿李??쒖옉 以鍮?
  - ?좉퇋 ?ㅻ깄???ㅽ겕由쏀듃 異붽?:
    - `scripts/capture-ops-snapshot.sh`
    - `scripts/run-ops-watch-window.sh`
  - ?좉퇋 ?ㅽ뻾 紐낅졊 異붽?:
    - `npm run ops:monitor:snapshot`
    - `npm run ops:monitor:watch`
  - ?곗텧臾?寃쎈줈:
    - `docs/evidence/ops-monitoring/<timestamp>/`
- evidence 硫뷀? 媛깆떊:
  - `scripts/capture-cutover-evidence.sh` -> `postgres_config_mode` 湲곕줉
  - `scripts/generate-evidence-report.ts` -> ?좉퇋 ?꾨뱶 ?뚯떛/由ы룷??諛섏쁺
  - `scripts/self-test-closure-tooling.ts` fixture 媛깆떊
- closure import ?꾩냽 臾멸뎄 ?뺣━:
  - `scripts/apply-final-verification-report.ts`
- Supabase audit 由ы룷??媛쒖꽑:
  - `scripts/audit-supabase-fallback.ts`
  - 留ㅼ튂 `0`?????쒓굅 TODO ???guard checklist瑜?異쒕젰
- ?섏〈???ㅽ겕由쏀듃 ?뺣━:
  - root/shared?먯꽌 `@supabase/supabase-js` ?쒓굅
  - `setup:supabase` npm ?ㅽ겕由쏀듃 ?쒓굅

### Validation
- `npm install` (pass)
- `npm run lint` (pass)
- `npm run build` (pass)
- `npm run ops:closure:selftest` (pass)
- `npm run ops:supabase:audit` (pass, `totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` (pass, `ok=true`)
- `npm run ops:verify3:check -- --print-json` (pass, `issues=[]`)

### Current completion state
- Runtime DB path: PostgreSQL-only (?좎?)
- Supabase fallback retirement baseline: `0` (?좎?)
- Closure evidence state: PASS (`20260412_212140`, ?좎?)
- Ops watch tooling: 以鍮??꾨즺 (EC2 ?ㅽ뻾 ?湲?

### Remaining (current)
1. 24h ?댁쁺 愿李??ㅽ뻾
- EC2?먯꽌 1?쒓컙 媛꾧꺽?쇰줈 `npm run ops:monitor:snapshot` ?섑뻾
- 理쒖냼 24??利앹쟻 ?섏쭛 ???댁긽 吏뺥썑(?ㅽ뙣??吏???꾨씫) 寃??
2. 愿李?寃곌낵 臾몄꽌 諛섏쁺
- `docs/PATCH_NOTES.md`, `docs/DELIVERY_STATUS.md`???댁쁺 愿李?寃곌낵 ?붿빟 異붽?

## EC2 Pivot Progress Update (2026-04-13, Step 4B)
### Newly completed
- Local git snapshot commit completed:
  - commit hash: `06fbbc0`
  - scope: PostgreSQL-only runtime + ops monitoring automation
- EC2 systemd activation completed on `3.36.83.199`:
  - installed/enabled:
    - `global-pulse-web.service`
    - `global-pulse-collector.timer`
    - `global-pulse-analyzer.timer`
    - `global-pulse-snapshot.timer`
    - `global-pulse-cleanup.timer`
    - `global-pulse-backup.timer`
- PM2 overlap removed to prevent scheduler/web duplication:
  - `pm2 stop all`
  - `pm2 delete all`
- Ops snapshot script hardening applied and validated:
  - fail-code capture fix (`[FAIL:0]` bug removed)
  - systemd unit detection fix (pipefail false-skip removed)
- 24h watch process re-launched with fixed scripts:
  - old watch PID `111445` replaced
  - active watch PID `115007`
  - launch log:
    - `/srv/projects/project2/global-pulse/docs/evidence/ops-monitoring/watch-launch-20260413_125324.log`

### Validation
- Local:
  - `git commit` (pass)
- EC2:
  - `npm ci` (pass)
  - `npm run build` (pass)
  - systemd units/timers `active` ?뺤씤
  - `bash scripts/capture-ops-snapshot.sh` (pass, failures `0`)

### Current completion state
- systemd 湲곕컲 ?댁쁺 猷⑦봽: ?쒖꽦???꾨즺
- 24h 愿李?猷⑦봽: 吏꾪뻾 以?- local code snapshot: 而ㅻ컠 ?꾨즺

### Remaining (current)
1. Remote Git push finalization
- local repo has no configured remote (`git remote -v` empty)
- push target URL/沅뚰븳 ?꾩슂

2. 24h watch completion review
- watch 醫낅즺 ??`watch-summary.txt` 湲곕컲?쇰줈 ?댁쁺 寃곌낵 ?붿빟/?댁뒋 諛섏쁺

## EC2 Pivot Progress Update (2026-04-13, Step 4C)
### Newly completed
- ?꾨＼?꾪듃 ?⑥씪???꾨즺:
  - 留덉뒪??臾몄꽌濡?`docs/INITIAL_PROMPT_GLOBAL_PULSE.md` ?뺤젙
  - `docs/INITIAL_PROMPT_GLOBAL_PULSE_EC2.md`???덇굅???ъ씤??臾몄꽌濡??꾪솚
- 留덉뒪???꾨＼?꾪듃???듯빀 諛섏쁺:
  - ?⑥씪 EC2/PostgreSQL-only ?꾪궎?띿쿂 湲곗?
  - Step ?⑥쐞 ?ㅽ뻾/湲곕줉/寃利?洹쒖튃
  - ?섏쭛/遺꾩꽍/API/UI/?댁쁺 ?붽뎄?ы빆
  - ?꾩옱 ?곹깭 ?붿빟 + ?ㅼ쓬 ?ㅽ뻾 ?곗꽑?쒖쐞
  - UTF-8 ?몄퐫??泥댄겕由ъ뒪??- 臾몄꽌 ?댁쁺 洹쒖튃 怨좎젙:
  - ?욎쑝濡??꾨＼?꾪듃 媛깆떊? 留덉뒪??臾몄꽌 1怨노쭔 ?낅뜲?댄듃

### Validation
- `Get-Content -Encoding utf8 docs/INITIAL_PROMPT_GLOBAL_PULSE.md` (?쒓?/援ъ“ ?뺤씤)
- `Get-Content -Encoding utf8 docs/INITIAL_PROMPT_GLOBAL_PULSE_EC2.md` (?ъ씤???꾪솚 ?뺤씤)
- `git diff`濡?臾몄꽌 蹂寃?踰붿쐞 ?뺤씤

### Current completion state
- Prompt source-of-truth: ?⑥씪???꾨즺
- PostgreSQL-only ?댁쁺 ?먯튃: ?좎?
- 湲곕줉 泥닿퀎(PATCH_NOTES/DELIVERY_STATUS ?꾩쟻): ?좎?

### Remaining (current)
1. Remote Git push finalization
- local repo remote 誘몄꽕???곹깭 ?닿껐 ?꾩슂(`git remote add origin ...`)

2. EC2 諛고룷 寃쎈줈 git checkout ?꾪솚
- `/srv/projects/project2/global-pulse`瑜?git clone 湲곕컲?쇰줈 ?뺣━

3. 24h ?댁쁺 愿李?寃곌낵 留덇컧
- `docs/evidence/ops-monitoring/*` ?붿빟???⑥튂?명듃/?곹깭臾몄꽌??理쒖쥌 諛섏쁺
## EC2 Pivot Progress Update (2026-04-13, Step 4D)
### Newly completed
- GitHub ?좉퇋 ??μ냼 ?앹꽦 ?꾨즺:
  - `https://github.com/wsp-max/global-pulse`
- 濡쒖뺄 ?먭꺽 ?곌껐 ?꾨즺:
  - `origin = https://github.com/wsp-max/global-pulse.git`
- 理쒖큹 ?낅줈???꾨즺:
  - `git push -u origin master` ?깃났
  - upstream 異붿쟻 ?ㅼ젙 ?꾨즺

### Validation
- `git remote -v` ?뺤씤
- `git push -u origin master` ?깃났 濡쒓렇 ?뺤씤

### Current completion state
- ?먭꺽 ??μ냼 ?곌껐: ?꾨즺
- 肄붾뱶/臾몄꽌 諛깆뾽 寃쎈줈: GitHub origin?쇰줈 ?뺤젙

### Remaining (current)
1. EC2 諛고룷 寃쎈줈 git checkout ?꾪솚
- `/srv/projects/project2/global-pulse`瑜?tar/scp 諛섏쁺 諛⑹떇?먯꽌 `git clone/pull` 湲곕컲?쇰줈 ?꾪솚

2. 24h ?댁쁺 愿李?寃곌낵 留덇컧
- `docs/evidence/ops-monitoring/*` ?붿빟/?댁긽 吏뺥썑瑜?`PATCH_NOTES`/`DELIVERY_STATUS`??理쒖쥌 諛섏쁺

3. 釉뚮옖移??뺤콉 ?뺣━(?좏깮)
- ?꾩슂 ??`master -> main` ?쒖???
## EC2 Pivot Progress Update (2026-04-13, Step 4E)
### Newly completed
- EC2 ??寃쎈줈瑜?git 湲곕컲 諛고룷 援ъ“濡??꾪솚 ?꾨즺:
  - 湲곗〈 寃쎈줈 諛깆뾽:
    - `/srv/projects/project2/global-pulse_legacy_20260413_133224`
  - ?좉퇋 寃쎈줈 clone:
    - `/srv/projects/project2/global-pulse` (`master`)
  - remote:
    - `origin=https://github.com/wsp-max/global-pulse.git`
- 諛고룷 猷⑦떞 ?쒖???
  - `scripts/deploy-ec2.sh` ?ㅽ뻾?쇰줈 build + systemd unit/timer ?ъ쟻??  - `scripts/deploy-ec2.sh` default branch瑜?`master`濡??뺣젹
- ?고????곹깭 ?뺤씤:
  - web service `active`
  - collector/analyzer/snapshot/cleanup/backup timer `active`
  - `/api/health` 理쒖떊 ?고????묐떟 ?뺤씤 (`provider=postgres`)

### Validation
- EC2:
  - `git -C /srv/projects/project2/global-pulse rev-parse --abbrev-ref HEAD` -> `master`
  - `git -C /srv/projects/project2/global-pulse remote -v` ?뺤씤
  - `systemctl status global-pulse-web.service`
  - `systemctl list-timers 'global-pulse-*' --no-pager`
  - `curl -i http://127.0.0.1:3000/api/health`

### Current completion state
- EC2 deploy path: git checkout 湲곕컲?쇰줈 ?꾪솚 ?꾨즺
- 諛섎났 諛고룷 猷⑦떞: `git pull + build + systemd`濡?怨좎젙

### Remaining (current)
1. EC2 PostgreSQL runtime env ?ㅼ젙
- `/etc/global-pulse/global-pulse.env`??`DATABASE_URL` ?먮뒗 `DB_*` 異붽? ?꾩슂
- ?꾩옱 health??`postgres_not_configured`濡?`503` ?곹깭

2. 24h watch 寃곌낵 留덇컧
- ??watch 醫낅즺 ??理쒖쥌 summary瑜?臾몄꽌??諛섏쁺

## EC2 Pivot Progress Update (2026-04-13, Step 4F)
### Newly completed
- ops monitoring evidence瑜??좉퇋 寃쎈줈/濡쒖뺄濡??숆린??
  - `docs/evidence/ops-monitoring/*`
- post-cutover snapshot 1???깃났:
  - `20260413_133512/summary.txt` (failures=0)
- 24h watch ?ъ떆??
  - `watch_20260413_133512/watch-summary.txt`
  - hour=1 pass, failures=0

### Validation
- `npm run ops:monitor:snapshot` (EC2, pass)
- `npm run ops:monitor:watch` (EC2, 諛깃렇?쇱슫???ㅽ뻾 以?
- watch summary?먯꽌 hour=1 ?깃났 ?뺤씤

### Current completion state
- 愿李?利앹쟻 ?닿?: ?꾨즺
- post-cutover watch: 吏꾪뻾 以?
### Remaining (current)
1. watch 醫낅즺 寃곌낵 諛섏쁺
- `watch-summary.txt` 理쒖쥌 `failures` 媛믨낵 以묐떒 ?ъ쑀(?덈뒗 寃쎌슦) 臾몄꽌??
2. DB table count ?쒖꽦??- PostgreSQL env ?ㅼ젙 ??snapshot??`db_table_counts` SKIP ?댁냼

## Step 5A Progress Update (2026-04-13)
### Newly completed
- ?섏쭛湲??뺤옣 1李?援ы쁽:
  - `bilibili` scraper 援ы쁽
  - `mastodon` scraper 援ы쁽
  - `dcard` scraper 援ы쁽(李⑤떒 ??graceful failure)
- collector/runtime 諛섏쁺:
  - `packages/collector/src/run.ts` ????뚯뒪 異붽?
  - `scripts/test-scraper.ts` ?뚯뒪???뚯뒪 異붽?
  - `packages/collector/src/index.ts` export 異붽?
- ?뚰겕?뚮줈???뚯뒪 ?⑥쐞 ?뺣젹:
  - `collect-sns-bilibili.yml` -> `--source bilibili`
  - `collect-sns-mastodon.yml` -> `--source mastodon`
  - `collect-taiwan.yml` -> `--source dcard`

### Validation
- `npm run test:scraper -- --source bilibili` -> success=true, postCount=10
- `npm run test:scraper -- --source mastodon` -> success=true, postCount=29
- `npm run test:scraper -- --source dcard` -> success=false, HTTP 403
- `npm run collect -- --source bilibili,mastodon,dcard` -> `2/3 succeeded`
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run ops:supabase:audit` -> pass (`0`)
- `npm run ops:supabase:budget -- --print-json` -> pass
- `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)

### Current completion state
- Step 5A 紐⑺몴(?좉퇋 3媛??뚯뒪 ?꾩엯): 肄붾뱶 諛섏쁺 ?꾨즺
- ?댁쁺 媛?⑹꽦:
  - bilibili/mastodon: ?숈옉 ?뺤씤
  - dcard: Cloudflare 403濡??ㅽ뙣 泥섎━(?덉긽 由ъ뒪??紐낆떆)

### Remaining (current)
1. Dcard ?덉젙??寃쎈줈 寃곗젙
- API 李⑤떒 ?고쉶(?꾨줉??釉뚮씪?곗? 湲곕컲/?泥??뚯뒪) ?꾨왂 ?꾩슂

2. Step 5B 李⑹닔
- `ptt`, `hatena`, `fivech`, `weibo` 援ы쁽 + ?ㅽ뙣??湲곗? ?섎┰

## EC2 Pivot Progress Update (2026-04-13, Step 4E Follow-up)
### Newly completed
- EC2 ?щ같??異⑸룎 ?댁냼:
  - ?먯씤: `docs/evidence/ops-monitoring/*` untracked ?뚯씪??tracked ?뚯씪 蹂묓빀??留됱쓬
  - 議곗튂: evidence ?붾젆?좊━瑜?`ops-monitoring_runtime_20260413_134415`濡?諛깆뾽 ?대룞 ??pull/deploy ?ъ떎??- EC2 ??理쒖떊???꾨즺:
  - deployed commit: `36a5fa7`
- post-deploy watch ?ъ떆??
  - `watch_20260413_134515` (hour=1 pass, failures=0)
- 濡쒖뺄 evidence ?щ룞湲고솕 ?꾨즺:
  - 理쒖떊 `ops-monitoring` 濡쒓렇/summary 諛섏쁺

### Validation
- `git -C /srv/projects/project2/global-pulse rev-parse --short HEAD` -> `36a5fa7`
- `systemctl is-active global-pulse-web.service ...` -> all active
- `npm run test:scraper -- --source bilibili` (EC2) -> success
- `npm run test:scraper -- --source mastodon` (EC2) -> success
- `npm run test:scraper -- --source dcard` (EC2) -> 403

### Current completion state
- Step 4E: ?꾨즺(?쒖? 諛고룷 + follow-up 異⑸룎 ?댁냼源뚯? 諛섏쁺)
- Step 4F: 吏꾪뻾 以?24h watch ?꾩쟻 以? hour1 pass)
- Step 5A: ?꾨즺(3媛??뚯뒪 肄붾뱶 諛섏쁺 + smoke 寃利??꾨즺)

### Remaining (current)
1. PostgreSQL env ?ㅼ젙
- `/etc/global-pulse/global-pulse.env`??DB ?묒냽 ?뺣낫 異붽? ?꾩슂

2. 24h watch 醫낅즺 留덇컧
- `watch_20260413_134515/watch-summary.txt` 理쒖쥌 ?곹깭 諛섏쁺

3. Step 5B ?ㅽ뻾
- `ptt`, `hatena`, `fivech`, `weibo` 援ы쁽 李⑹닔

## Step 5B Progress Update (2026-04-13)
### Newly completed
- 怨좊????뚯뒪 4媛?援ы쁽 ?꾨즺:
  - `fivech` (`itest.5ch.io/subbacks/bbynews.json`)
  - `hatena` (RSS)
  - `ptt` (over18 cookie + HTML)
  - `weibo` (hotSearch JSON)
- collector/runtime ?곌껐:
  - `run.ts` ????뚯뒪 ?깅줉 ?꾨즺
  - `test-scraper.ts` ?뚯뒪??留ㅽ븨 ?깅줉 ?꾨즺
  - `collector index` export ?뺣젹 ?꾨즺
- ?댁쁺 ?ㅼ젙 蹂댁젙:
  - `collect-taiwan.yml` -> `--region tw`濡?蹂寃?(PTT ?ы븿)
  - `constants.ts`??`fivech/hatena` scrapeUrl???ㅼ젣 ?섏쭛 ?붾뱶?ъ씤?몃줈 ?뺣젹
- ?곗씠???뺥빀??蹂댁젙:
  - fivech 鍮꾩젙??epoch thread(`924...`)??`postedAt` ?앸왂 泥섎━

### Validation
- `npm run test:scraper -- --source hatena` -> success=true, postCount=40
- `npm run test:scraper -- --source fivech` -> success=true, postCount=50
- `npm run test:scraper -- --source ptt` -> success=true, postCount=25
- `npm run test:scraper -- --source weibo` -> success=true, postCount=50
- `npm run collect -- --source hatena,fivech,ptt,weibo` -> `4/4 succeeded`
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run ops:supabase:audit` -> pass (`0`)
- `npm run ops:supabase:budget -- --print-json` -> pass
- `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)

### Current completion state
- Step 5B: 肄붾뱶 援ы쁽/濡쒖뺄 ?섏쭛 寃利??꾨즺
- L2 Data Plane 愿??
  - ?쒖꽦 ?ㅽ겕?섑띁 而ㅻ쾭由ъ?媛 JP/TW/CN?쇰줈 ?뺤옣??- ?⑥? 寃利?
  - DB row 利앷? 寃利앹? EC2(PostgreSQL env ?ㅼ젙 ???먯꽌 final check ?꾩슂

### Remaining (current)
1. EC2 DB runtime ?쒖꽦??- `/etc/global-pulse/global-pulse.env`??`DATABASE_URL` ?먮뒗 `DB_*` ?곸슜
- `/api/health`瑜?`postgres_not_configured` -> ?뺤긽 ?곹깭濡??꾪솚

2. 24h watch 理쒖쥌 留덇컧
- `watch_20260413_134515/watch-summary.txt` 理쒖쥌 寃곌낵瑜?PATCH_NOTES/DELIVERY_STATUS??怨좎젙

3. Step 5C 李⑹닔
- analyzer ?덉쭏 ?쒕떇(遺덉슜???대윭?ㅽ꽣 ?꾧퀎移?cross-region ?좎궗?? 諛??섑뵆 ?덉쭏 由щ럭

## EC2 Runtime Status Update (2026-04-14)
### Newly completed
- EC2 target host confirmed: `3.36.83.199`
- Local PostgreSQL runtime activated for app use:
  - role `global_pulse`, database `global_pulse`
- Runtime env configured at `/etc/global-pulse/global-pulse.env` with DB + Gemini + Telegram values.
- DB bootstrap completed on EC2:
  - `npm run db:init` (2 migrations applied)
  - `npm run seed:regions` (regions/sources seeded)
- End-to-end runtime checks passed:
  - `http://127.0.0.1:3000/api/health` -> 200
  - `http://3.36.83.199/api/health` -> 200
  - web + collector/analyzer/snapshot/cleanup/backup timers active
- Data plane verified with live data:
  - `raw_posts=353`, `topics=97`, `global_topics=8`
  - `/api/stats` returns `configured=true`, `provider=postgres`

### Current state by layer
- L0 Governance: unchanged (single prompt + patch-note flow maintained)
- L1 Runtime Infra: active on EC2 (Nginx + systemd + PostgreSQL local)
- L2 Data Plane: active (collector/analyzer/snapshot working against PostgreSQL)
- L3 API/UI Plane: active (`/api/health`, `/api/stats`, `/api/topics` verified)
- L4 Observability: active (timers + journald + evidence directories)

### Known runtime gaps
- Source-level partial failures still expected:
  - `reddit`, `reddit_worldnews`, `reddit_europe`, `reddit_mideast` => HTTP 403
  - `dcard` => HTTP 403
  - `youtube_kr/jp/us` => missing `YOUTUBE_API_KEY`

### Remaining next steps (strict order)
1. Step 5C quality tuning
- Improve keyword stopwords/topic naming/similarity thresholds and review sample outputs.
2. Source hardening
- Apply fallback paths or API strategy for 403-prone sources (Reddit family, Dcard).
3. Operations closeout
- Continue 24h observation window and freeze final watch summary into docs.
4. UI polish (Step 6)
- Mobile/reporting quality pass and failure-state UX checks.

## Path Split Update (2026-04-14)
### Newly completed
- `/pulse` path-split mode implemented in codebase for shared-host coexistence.
- Base-path aware runtime support added:
  - `NEXT_BASE_PATH`
  - `NEXT_PUBLIC_BASE_PATH`
- Nginx route design updated to isolate Global Pulse behind `/pulse` only.

### Next runtime apply steps (EC2)
1. Set env values in `/etc/global-pulse/global-pulse.env`:
- `NEXT_BASE_PATH=/pulse`
- `NEXT_PUBLIC_BASE_PATH=/pulse`
2. Rebuild with updated env (`npm run build`).
3. Reload nginx and restart web service.
4. Verify:
- `http://<host>/pulse`
- `http://<host>/pulse/api/health`

### Path split runtime status (applied)
- EC2 runtime switched to `/pulse` exposure mode.
- Current public endpoints:
  - `http://3.36.83.199/pulse`
  - `http://3.36.83.199/pulse/api/health`
- Root path `http://3.36.83.199/` intentionally blocked (`404`) to avoid host collision.

## YouTube + Runtime Recovery Update (2026-04-14)
### Newly completed
- `YOUTUBE_API_KEY` 諛섏쁺 ?꾨즺(EC2 runtime env).
- YouTube collector ?ㅼ쬆 ?깃났:
  - `youtube_kr/jp/us` 媛곴컖 20嫄??섏쭛/?곸옱
  - source ?곹깭 `ok`
- ??異⑸룎 蹂듦뎄:
  - ?ㅻⅨ ?꾨줈?앺듃(StockPulse)媛 `3000`???먯쑀 以묒씤 ?곹깭瑜??뺤씤
  - Global Pulse ???고??꾩쓣 `3100`?쇰줈 遺꾨━
  - `/pulse` Nginx ?꾨줉??upstream??`3100`?쇰줈 ?꾪솚
- ?꾩옱 ?묒냽 ?곹깭:
  - `http://3.36.83.199/pulse` (200)
  - `http://3.36.83.199/pulse/api/health` (200)
  - `http://3.36.83.199/pulse/api/stats` (200)

### Current gaps (updated)
1. Step 5C ?덉쭏 ?쒕떇
- 遺덉슜??????좏뵿紐??좎궗???꾧퀎移??뺢탳??2. ?뚯뒪 ?섎뱶??- `reddit*`, `dcard` 403 ???3. ?댁쁺 愿李?留덇컧
- 24h watch 理쒖쥌 寃곌낵瑜?臾몄꽌???뺤젙 諛섏쁺
4. UI Step 6
- 紐⑤컮??UX/?μ븷 ?곹깭 UX 留덇컧

## Step 5C Progress Update (2026-04-14, Slice 1)
### Newly completed
- Analyzer ?덉쭏 ?쒕떇 1李?諛섏쁺:
  - `keyword-extractor`瑜??좊땲肄붾뱶 湲곕컲 ?섎룞 TF-IDF濡??꾪솚
  - 吏??퀎 ?ㅽ겕由쏀듃 媛以묒튂(`kr/jp/cn`)? stopword 媛뺥솕
  - ?쒕ぉ phrase(2~3-gram) 異붿텧 諛?以묐났 ?ㅼ썙???듭젣
  - `topic-clusterer` ????좏뵿紐??앹꽦 濡쒖쭅(愿???쒕ぉ/?ㅼ썙???먯닔 湲곕컲) ?꾩엯
  - ?쏀븳 seed ?ㅽ궢 + single-post ?좏뵿 ?곹븳 + ?좎궗 ?좏뵿 dedupe ?곸슜

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass
- 濡쒖뺄 ?ㅻえ?ъ뿉???좏뵿 寃곌낵媛 ?⑦렪 ?⑥뼱 以묒떖?먯꽌 援щЦ??`愿???묒긽`, `?쒕? 愿??) 以묒떖?쇰줈 媛쒖꽑?⑥쓣 ?뺤씤

### Current completion state
- Step 5C: **吏꾪뻾 以?(1李??쒕떇 ?꾨즺)**
- ?⑥? ?묒뾽? cross-region 留ㅽ븨 ?꾧퀎移???쒕챸 ?덉젙?? ?ㅻ뜲?댄꽣(EC2) ?섑뵆 由щ럭 湲곕컲 誘몄꽭議곗젙

### Remaining (current)
1. Step 5C quality tuning (slice 2)
- cross-region ?좎궗???꾧퀎移??ㅽ깘 ?쒕떇
- 由ъ쟾蹂??섑뵆(kr/jp/cn/us) 20媛??댁긽 ?섎룞 由щ럭 ??stopword 蹂댁젙
2. Source hardening
- `reddit*`, `dcard` 403 ????꾨왂 ?뺤젙 諛??곸슜
3. Ops closeout
- 24h watch 理쒖쥌 ?붿빟 怨좎젙
4. UI Step 6
- 紐⑤컮??UX/?μ븷 ?곹깭 UX 留덇컧

## Step 5C Progress Update (2026-04-14, Slice 2)
### Newly completed
- cross-region 留ㅽ븨 ?덉쭏 ?뺣???
  - ?⑥닚 Jaccard 湲곕컲?먯꽌 蹂듯빀 ?먯닔 湲곕컲(token/keyword/name)?쇰줈 ?꾪솚
  - generic stopword 諛??좏겙 ?뺢퇋??媛뺥솕
  - strong-name / exact-keyword-phrase / primary-name-token 媛??異붽?
- global analyzer 湲곕낯 similarity瑜?`0.32`濡??곹뼢??湲곕낯 ?ㅽ깘 ?꾪솕

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run analyze:global -- --hours 24 --min-regions 2` -> pass (濡쒖뺄 DB 誘몄꽕??skip)
- 濡쒖뺄 smoke?먯꽌 KR/JP 愿???댁뒋??留ㅽ븨?섍퀬, 臾닿???US ?ㅽ룷痢??댁뒋??遺꾨━?⑥쓣 ?뺤씤

### Current completion state
- Step 5C: **吏꾪뻾 以?(Slice 1~2 ?꾨즺)**
- ?⑥? ?듭떖? EC2 ?ㅻ뜲?댄꽣 湲곗? threshold 誘몄꽭議곗젙怨??섎룞 ?섑뵆 由щ럭 寃곌낵 諛섏쁺

### Remaining (current)
1. Step 5C quality tuning (slice 3)
- EC2 DB ?ㅻ뜲?댄꽣(理쒓렐 24h topics/global_topics) ?섑뵆 由щ럭 湲곕컲 threshold/stopword 理쒖쥌 ?쒕떇
2. Source hardening
- `reddit*`, `dcard` 403 ???3. Ops closeout
- 24h watch 理쒖쥌 寃곌낵 臾몄꽌 怨좎젙
4. UI Step 6
- 紐⑤컮??UX/?μ븷 ?곹깭 UX 留덇컧

## UI/Encoding Stability Update (2026-04-14)
### Newly completed
- ?붾㈃ `??` ?몄텧 蹂댁셿:
  - `HeatBadge` placeholder 臾몄옄???쒓굅, heat level ?꾩씠肄?湲곕컲?쇰줈 援먯껜
  - `RegionFlag` fallback 媛쒖꽑 + `regionId` ?뺢퇋??- ?몄퐫???щ컻 諛⑹? 媛??異붽?:
  - `.editorconfig` (UTF-8/LF)
  - `.gitattributes` (text eol=lf)

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

### Blocking info (next step)
- Step 5C Slice 3(EC2 ?ㅻ뜲?댄꽣 ?쒕떇) 吏꾪뻾???꾪빐 SSH ???꾩슂
  - ?쒕룄 寃곌낵: `ubuntu@3.36.83.199: Permission denied (publickey)`

## Source Hardening Update (2026-04-14, Slice 1)
### Newly completed
- Reddit 怨꾩뿴(`reddit`, `reddit_worldnews`, `reddit_europe`, `reddit_mideast`) 403 ?꾪솕 濡쒖쭅 ?곸슜:
  - OAuth ?곗꽑 + 怨듦컻 endpoint fallback ?ㅼ쨷 寃쎈줈
  - ?ㅻ뜑/?먮윭 泥섎━ 媛뺥솕
- Dcard endpoint fallback(2媛?寃쎈줈) ?곸슜

### Validation
- `npm run test:scraper -- --source reddit_worldnews` -> success=true, 30 posts
- `npm run collect -- --source reddit,reddit_worldnews,reddit_europe,reddit_mideast` -> `4/4 succeeded`
- `npm run test:scraper -- --source dcard` -> 403 ?좎?(known)
- `npm run lint` -> pass
- `npm run build` -> pass

### Current completion state
- Source hardening: **遺遺??꾨즺**
  - Reddit 怨꾩뿴: 媛쒖꽑 ?꾨즺
  - Dcard: Cloudflare ?뺤콉 ?댁뒋濡?異붽? ????꾩슂

## Step 5C Progress Update (2026-04-14, Slice 3)
### Newly completed
- ?좏뵿 ?덉쭏 ?쒕떇 3李?留덇컧:
  - `keyword-extractor` stopword/?몄씠利??좏겙 ?꾪꽣 ?뺤옣
  - `topic-clusterer` ?⑥씪 ?좏겙 ??쒕챸 ?듭젣 媛뺥솕(phrase ?곗꽑 + weak single-topic ?ㅽ궢)
  - `cross-region-mapper` ???湲濡쒕쾶 ?좏뵿紐??좏깮???덉쭏 ?먯닔 湲곕컲?쇰줈 蹂댁젙
  - `run-global-analysis` ?낅젰???쒕━?꾨퀎 理쒖떊 諛곗튂?앸줈 ?쒗븳??怨쇨굅 ?몄씠利??ъ쑀??李⑤떒
- EC2 ?ㅻ뜲?댄꽣 ?ъ떎??寃利?
  - analyzer ?ъ떎????理쒖떊 諛곗튂 湲곗? ?⑥씪 ?좏겙 ?좏뵿 鍮꾩쑉 媛먯냼 ?뺤씤
  - 湲濡쒕쾶 ?좏뵿 嫄댁닔 ?몄씠利?異뺤냼 ?뺤씤(25 -> 3)

### Validation
- Local:
  - `npm run lint` -> pass
  - `npm run build` -> pass
- EC2:
  - `npm run analyze -- --hours 6` -> pass
  - `npm run analyze:global -- --hours 24 --min-regions 2 --similarity 0.32` -> pass
  - latest-batch quality query -> region蹂?`single_token = 0` ?뺤씤

### Current completion state
- Step 5C: **?꾨즺 (Slice 1~3)**
- 遺꾩꽍 ?덉쭏? ?쒕떒???⑥뼱 以묒떖?앹뿉???쒓뎄臾??섎? 以묒떖?앹쑝濡??꾪솚 ?꾨즺

### Remaining (current)
1. Step 4F ?댁쁺 愿李?理쒖쥌 留덇컧
- 24h watch summary媛 ?꾩옱 `hour=23, failures=0`源뚯? 湲곕줉?섏뼱 ?덉뼱 final hour ?꾨즺 ??臾몄꽌 怨좎젙 ?꾩슂

2. Source hardening ?붿뿬
- `dcard` Cloudflare 403 吏?? ?꾨줉??釉뚮씪?곗? 湲곕컲 ?섏쭛 ?먮뒗 ?泥??뚯뒪 ?꾨왂 寃곗젙 ?꾩슂

3. UI Step 6 留덇컧
- 紐⑤컮???덉씠?꾩썐 ?숈꽑, ?μ븷/鍮??곗씠???곹깭 ?쒖떆 怨좊룄??
## Access/Credential Update (2026-04-14)
### Newly confirmed
- EC2 SSH key path ?뺤씤: `C:\Users\wsp\Downloads\plasma-key.pem`
- EC2 ?묒냽 ?뺤씤: `ubuntu@3.36.83.199`
- Reddit OAuth credentials 誘몄젣怨??곹깭 ?뺤씤(怨듦컻 endpoint fallback 紐⑤뱶濡??댁쁺)

### Operational note
- Reddit 怨꾩뿴? ?꾩옱 fallback 寃쎈줈濡??섏쭛 ?깃났 耳?댁뒪媛 ?덉쑝?? IP/?쒓컙????곕씪 403 ?щ컻 媛?μ꽦???덉쑝誘濡?OAuth ?먭꺽利앸챸???덉쑝硫??덉젙?깆씠 ???믪븘吏?

## Ops Snapshot Accuracy Update (2026-04-14)
### Newly completed
- `scripts/capture-ops-snapshot.sh` 寃利?濡쒖쭅 蹂댁젙:
  - API health/stats/topics瑜?HTTP ?곹깭肄붾뱶 2xx 湲곗??쇰줈 ?먯젙
  - `PORT`/`NEXT_BASE_PATH`(`NEXT_PUBLIC_BASE_PATH`) 湲곕컲 ?숈쟻 API URL ?앹꽦
  - DB table count ?ㅽ뻾 濡쒓렇??誘쇨컧?뺣낫(redacted) 泥섎━

### Validation
- Local:
  - `npm run lint` -> pass
  - `npm run build` -> pass
- EC2 endpoint spot check:
  - `127.0.0.1:3100/pulse/api/health` -> 200
  - `127.0.0.1:3100/api/health` -> 404
  - 湲곗〈 ?ㅺ?利?議곌굔???뺤씤?????ㅽ겕由쏀듃 蹂댁젙 諛섏쁺

### Current completion state
- L4 Observability: **?뺥솗??蹂댁젙 ?꾨즺**
- ?댁쁺 ?ㅻ깄??寃곌낵媛 `/pulse` + ?ы듃 遺꾨━ ?섍꼍怨??뺥빀?섎룄濡??섏젙??
### Remaining (updated)
1. Step 4F ?댁쁺 愿李?理쒖쥌 留덇컧
- 蹂댁젙???ㅽ겕由쏀듃 湲곗??쇰줈 watch瑜?1???ъ떎?됲빐 final summary瑜?怨좎젙?댁빞 ??
2. Source hardening ?붿뿬
- `dcard` Cloudflare 403 ???釉뚮씪?곗? 湲곕컲/?꾨줉???泥??뚯뒪 ?꾨왂 寃곗젙)

3. UI Step 6 留덇컧
- 紐⑤컮???덉씠?꾩썐, ?μ븷/鍮??곗씠??UX 理쒖쥌 ?뺣━

## Step 4F Closure Update (2026-04-14, single-run)
### Newly completed
- EC2?먯꽌 蹂댁젙??watch ?⑥씪 ???꾨즺:
  - command: `HOURS=1 INTERVAL_SECONDS=0 MAX_FAILURES=1 npm run ops:monitor:watch`
  - evidence: `/srv/projects/project2/global-pulse/docs/evidence/ops-monitoring/watch_20260414_121813/watch-summary.txt`
  - result: `failures=0`
- watch ?대? API ?먭???`/pulse` + `3100` runtime??留욊쾶 諛섏쁺??
  - `http://127.0.0.1:3100/pulse/api/health` -> 200
  - `http://127.0.0.1:3100/pulse/api/stats` -> 200
  - `http://127.0.0.1:3100/pulse/api/topics?region=kr&limit=5` -> 200

### Current completion state
- Step 4F: **single-run 湲곗? ?꾨즺**
- L4 Observability: ?ㅼ슫??寃쎈줈(`/pulse`) 湲곗? 寃利??쇨????뺣낫

## Source Hardening Update (2026-04-14, Slice 2)
### Newly completed
- Dcard scraper??browser fallback 異붽?:
  - API endpoint fallback ?ㅽ뙣 ??headless browser濡??숈씪 endpoint ?ъ떆??  - ?ㅽ뙣 ??endpoint蹂?HTTP status/body snippet源뚯? ?먮윭???ы븿???먯씤 ?뚯븙 媛??
### Validation
- Local:
  - `npm run test:scraper -- --source dcard` -> fail (濡쒖뺄 Chromium ?ㅽ뻾?뚯씪 遺??, fallback ?몄텧 ?뺤씤
- EC2:
  - `npm run test:scraper -- --source dcard` -> fail (403 ?좎?), browser fallback 寃쎈줈 諛??곸꽭 吏꾨떒 硫붿떆吏 ?뺤씤

### Current completion state
- Source hardening: **吏꾪뻾 以?*
  - Reddit 怨꾩뿴: fallback 媛쒖꽑 ?꾨즺
  - Dcard: 吏꾨떒??媛뺥솕 ?꾨즺, ?섏쭛 ?깃났源뚯???異붽? ?고쉶 ?꾨왂 ?꾩슂

### Remaining (updated)
1. Dcard ?댁쁺 ?꾨왂 寃곗젙
- ?꾩슂 ?섏궗寃곗젙: `?꾨줉?? vs `荑좏궎 ?몄뀡` vs `?泥??뚯뒪` 以?1媛??좏깮

2. UI Step 6 留덇컧
- 紐⑤컮???덉씠?꾩썐, ?μ븷/鍮??곗씠??UX 理쒖쥌 ?뺣━

## Cost Policy Update (2026-04-14, No-proxy mode)
### Newly completed
- ?ъ슜??寃곗젙 諛섏쁺: **?꾨줉??鍮꾩슜 鍮꾩궗??* ?뺤콉 ?뺤젙.
- Dcard瑜?湲곕낯 鍮꾪솢???뚯뒪濡??꾪솚:
  - collector 湲곕낯 ?ㅽ뻾?먯꽌 ?먮룞 ?쒖쇅
  - 紐낆떆 ?ㅽ뻾(`--source dcard`)留?吏꾨떒 紐⑹쟻?쇰줈 ?덉슜
- seed/snapshot ?뺥빀??諛섏쁺:
  - `seed-regions` -> `dcard.is_active=false`
  - `region_snapshots.sources_total` -> 湲곕낯 ?쒖꽦 ?뚯뒪 湲곗? 吏묎퀎

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run collect -- --region tw` -> pass
  - 濡쒓렇: `Disabled-by-default sources skipped: dcard`
  - ?ㅽ뻾: `ptt` ?⑥씪 ?뚯뒪 ?섏쭛 ?뺤씤

### Current completion state
- ?댁쁺 ?뺤콉: **臾대퉬??no-proxy) 湲곗? 怨좎젙**
- TW ?곗씠???뚮젅?? PTT 以묒떖 ?댁쁺?쇰줈 ?덉젙??
### Remaining (updated)
1. EC2 諛섏쁺
- ?좉퇋 ?뺤콉 而ㅻ컠 pull/deploy ?먮뒗 ?섎룞 諛섏쁺 ??`npm run seed:regions` ?ъ떎???꾩슂

2. UI Step 6 留덇컧
- 紐⑤컮???덉씠?꾩썐, ?μ븷/鍮??곗씠??UX 理쒖쥌 ?뺣━

## UI Step 6 Update (2026-04-14, Slice 1)
### Newly completed
- 紐⑤컮???숈꽑 媛뺥솕:
  - ???섏씠吏 怨듯넻 ?곷떒 `Header` ?곸슜
  - 紐⑤컮???섎떒 ???대퉬 `MobileBottomNav` 異붽?
- ?μ븷/濡쒕뵫/鍮??곹깭 UX ?뺣━:
  - `EmptyState`, `LoadingSkeleton`, `ErrorBoundary` 媛뺥솕
  - `app/error.tsx`, `app/loading.tsx` 異붽?濡??쇱슦???덈꺼 fallback 蹂댁셿
- 二쇱슂 ?섏씠吏 ?곹깭 泥섎━ ?쇨???
  - Home, Global Issues, Timeline, Search, Region Detail, Topic Detail
- ?띿뒪???뺥빀???뺣━:
  - 源⑥쭊 臾멸뎄/援щ쾭???덈궡臾멸뎄(PostgreSQL 湲곗? ?꾨떂) ?뺣━

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run ops:supabase:audit` -> pass (`totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` -> pass
- `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)

### Current completion state
- Step 6: **吏꾪뻾 以?(Slice 1 ?꾨즺)**
- 紐⑤컮???대퉬 + 湲곕낯 ?곹깭 UX???댁쁺 媛?ν븳 ?섏??쇰줈 ?뺣━??
### Remaining (updated)
1. EC2 ?곸슜 留덇컧
- UI Step 6 而ㅻ컠??EC2??pull/deploy 諛섏쁺
- `/pulse` ?ㅼ젒?띿쑝濡?紐⑤컮???먮윭 fallback ?ㅻえ???뺤씤

2. Step 6 Slice 2 (理쒖쥌 QA)
- ?ㅺ린湲??먮뒗 紐⑤컮??酉고룷???먯꽌 ???대퉬/?ㅽ겕濡?媛?낆꽦 理쒖쥌 ?먭?
- ?μ븷 ?곹솴(API 5xx/鍮덈뜲?댄꽣) ?쒕굹由ъ삤 ?ㅽ겕由곗꺑 利앹쟻 異붽?

## UI Step 6 Update (2026-04-14, Slice 1.5 Runtime Apply)
### Newly completed
- EC2 ?고??꾩뿉 Step 6 肄붾뱶 諛섏쁺 ?꾨즺(archive deploy).
- EC2 build + web service restart ?꾨즺.
- ?ㅼ젒???ㅻえ??
  - `/pulse` 200
  - `/pulse/api/health` 200
  - `/pulse/search` 200
- ?댁쁺 ?ㅻ깄??
  - `npm run ops:monitor:snapshot` pass
  - `failures=0`
  - evidence: `/srv/projects/project2/global-pulse/docs/evidence/ops-monitoring/20260414_130936`

### Current completion state
- Step 6: **吏꾪뻾 以?(Slice 1 + Runtime apply ?꾨즺)**
- 肄붾뱶/諛고룷/?댁쁺 ?ㅻ깄?룹씠 ?숈씪 湲곗??쇰줈 ?뺣젹??
### Remaining (updated)
1. Step 6 Slice 2 (理쒖쥌 QA)
- 紐⑤컮???ㅺ린湲????대퉬/酉고룷??理쒖쥌 ?먭?
- ?먮윭/鍮덈뜲?댄꽣 ?쒕굹由ъ삤 罹≪쿂 利앹쟻 怨좎젙

2. ?댁쁺 諛고룷 猷⑦떞 ?뺣━
- EC2 evidence ?꾩쟻 ?뚯씪 ?뺣━ 猷⑦떞(諛고룷 ??????deploy 臾몄꽌??怨좎젙

## UI Step 6 Update (2026-04-14, Slice 2 QA Automation)
### Newly completed
- 紐⑤컮???먮윭 ?쒕굹由ъ삤 QA ?먮룞???ㅽ겕由쏀듃 異붽?:
  - `scripts/ui-smoke-check.sh`
  - `npm run ops:ui:smoke`
- ?댁쁺 ?곕턿 諛섏쁺:
  - `docs/operations.md`??UI smoke ?뱀뀡 異붽?
- EC2 ?ㅺ?利??꾨즺:
  - `APP_HOST=http://127.0.0.1:3100 APP_BASE_PATH=/pulse npm run ops:ui:smoke`
  - 寃곌낵 `failures=0`
  - 利앹쟻: `/srv/projects/project2/global-pulse/docs/evidence/ui-smoke/20260414_132052`

### Current completion state
- Step 6: **Slice 1 + Slice 2 ?꾨즺**
- 紐⑤컮???μ븷 QA媛 ?ъ떎??媛?ν븳 ?ㅽ겕由쏀듃 湲곕컲?쇰줈 怨좎젙??
### Remaining (updated)
1. ?댁쁺 諛고룷 猷⑦떞 ?뺣━
- EC2 evidence ?꾩쟻 ?뚯씪 ?뺣━ 猷⑦떞(諛고룷 ??????deploy 臾몄꽌??怨좎젙

2. ?좏깮 怨쇱젣 (沅뚯옣)
- ?ㅺ린湲?罹≪쿂(?ㅽ겕由곗꺑) 1?명듃留?異붽???UI smoke 利앹쟻怨??④퍡 蹂닿?

## UI Step 6 Update (2026-04-14, Slice 3 Deploy Hygiene)
### Newly completed
- ?고???利앹쟻 ?뚯쟾 ?먮룞??怨좊룄??
  - `scripts/rotate-runtime-evidence.sh`
  - archive ??? `ops-monitoring`, `ui-smoke`, `final-verification`, `cutover`
  - ?덉쟾 prune 媛????evidence 猷⑦듃 ??寃쎈줈 李⑤떒)
- 諛고룷 泥댁씤 怨좎젙:
  - `scripts/deploy-ec2.sh`?먯꽌 `git pull` ??利앹쟻 ?뚯쟾 湲곕낯 ?ㅽ뻾
  - tracked 蹂寃?媛먯? ??湲곕낯 諛고룷 以묐떒(異⑸룎 ?덈갑)
- ?댁쁺/諛고룷 臾몄꽌 諛섏쁺:
  - `docs/operations.md`, `docs/deployment-ec2.md`
- npm ?ㅽ뻾 寃쎈줈 怨좎젙:
  - `npm run ops:evidence:rotate`

### Validation
- `bash -n scripts/rotate-runtime-evidence.sh` -> pass
- `bash -n scripts/deploy-ec2.sh` -> pass
- `APP_DIR=... ARCHIVE_ROOT=... PRUNE=0 bash scripts/rotate-runtime-evidence.sh` -> pass
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run ops:supabase:audit` -> pass (`totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` -> pass
- `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)

### Current completion state
- Step 6: **Slice 1 + Slice 2 + Slice 3 ?꾨즺 (留덇컧)**
- ?댁쁺 諛고룷 猷⑦떞(利앹쟻 ?꾩쟻/異⑸룎 諛⑹?)源뚯? 臾몄꽌/?ㅽ겕由쏀듃 湲곗??쇰줈 怨좎젙??
### Remaining (updated)
1. Step 5C 遺꾩꽍 ?덉쭏 ?쒕떇
- ?⑦렪 ?ㅼ썙???섎? 遺덈챸 ?좏뵿 媛먯냼瑜??꾪븳 stopword/?좏겙 ?뺢퇋????쒕챸 洹쒖튃 異붽? ?쒕떇

2. ?뚯뒪 ?뺤옣 ?곗꽑?쒖쐞 ?ㅽ뻾
- 臾대퉬???뺤콉 ?좎? ?꾩젣?먯꽌 ?덉젙???뚯뒪(`bilibili`, `mastodon`) ?댁쁺 ?ъ엯 ?뺣?

3. ?좏깮 怨쇱젣 (沅뚯옣)
- ?ㅺ린湲?罹≪쿂(?ㅽ겕由곗꺑) 1?명듃 異붽? ??UI smoke 利앹쟻怨??④퍡 蹂닿?

## Step 5C Update (2026-04-14, Analysis Quality Tuning Round 1)
### Newly completed
- `keyword-extractor` ?덉쭏 ?꾪꽣 媛뺥솕:
  - KR/JP/CN/EN 遺덉슜???뺤옣
  - 諛섎났 媛먰깂/?껋쓬/?뚮옯??硫뷀????≪쓬 ?좏겙 ?쒓굅 ?⑦꽩 異붽?
- `topic-clusterer` ??쒕챸 洹쒖튃 媛뺥솕:
  - ?⑥씪 ?좏뵿紐??명뼢 媛먯냼瑜??꾪빐 蹂댁“ ?꾨낫 寃고빀(`A 쨌 B`) 濡쒖쭅 異붽?
  - ?⑥씪 ?좏겙 理쒖냼 湲몄씠 湲곗? 媛뺥솕
  - KR/JP/CN 硫뷀? ?⑥뼱 釉붾옓由ъ뒪??異붽?

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run ops:supabase:audit` -> pass (`totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` -> pass
- `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)

### Current completion state
- Step 5C: **吏꾪뻾 以?(Round 1 ?꾨즺)**
- ?좏뵿紐?媛?낆꽦怨??ㅼ썙???≪쓬 ?듭젣 洹쒖튃? 肄붾뱶 湲곗??쇰줈 諛섏쁺 ?꾨즺

### Remaining (updated)
1. Step 5C Round 2 (EC2 ?ㅻ뜲?댄꽣 罹섎━釉뚮젅?댁뀡)
- EC2?먯꽌 `npm run analyze -- --hours 6` 1???ㅽ뻾 ???곸쐞 ?좏뵿 ?섑뵆(kr/jp/us) 寃??- 怨쇱냼?꾪꽣/怨쇰떎?꾪꽣 ?щ????곕씪 stopword/釉붾옓由ъ뒪??誘몄꽭 議곗젙

2. ?뚯뒪 ?뺤옣 ?곗꽑?쒖쐞 ?ㅽ뻾
- 臾대퉬???뺤콉 ?꾩젣?먯꽌 ?덉젙???뚯뒪(`bilibili`, `mastodon`) ?댁쁺 ?ъ엯 ?뺣?

3. ?좏깮 怨쇱젣 (沅뚯옣)
- ?ㅺ린湲?罹≪쿂(?ㅽ겕由곗꺑) 1?명듃 異붽? ??UI smoke 利앹쟻怨??④퍡 蹂닿?

## Dashboard UI Update (2026-04-14, Left Empty Zone Fill)
### Newly completed
- 硫붿씤 ??쒕낫??醫뚯륫 鍮??곸뿭???곗씠???⑤꼸濡??꾪솚:
  - ?좉퇋 `PulseSignalBoard` 異붽?
  - 醫뚯륫 而щ읆??`flex` 援ъ“濡?議곗젙???⑤뒗 ?믪씠瑜??⑤꼸???먯뿰?ㅻ읇寃??먯쑀
- Signal Board 援ъ꽦:
  - Total Heat / Active Topics / Source Health / Global Topics
  - Region Momentum 諛?  - Cross Signals(由щ뱶 湲濡쒕쾶 ?댁뒋 + ?ㅼ썙??鍮덈룄 ?쒓렇)

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

### Current completion state
- ????쒕낫?? **吏???섎떒 鍮?怨듦컙 ?댁뒋 ?닿껐 ?꾨즺**
- ?쒓컖 洹좏삎怨??뺣낫 諛??媛쒖꽑 ?꾨즺

### Remaining (updated)
1. Step 5C Round 2 (EC2 ?ㅻ뜲?댄꽣 罹섎━釉뚮젅?댁뀡)
- `npm run analyze -- --hours 6` ???좏뵿 ?덉쭏 ?섑뵆 由щ럭/誘몄꽭 ?쒕떇

2. ?뚯뒪 ?뺤옣 ?곗꽑?쒖쐞 ?ㅽ뻾
- 臾대퉬???뺤콉 ?꾩젣?먯꽌 ?덉젙???뚯뒪(`bilibili`, `mastodon`) ?댁쁺 ?ъ엯 ?뺣?

## Step 5C Update (2026-04-14, Analysis Quality Tuning Round 2)
### Newly completed
- Heat score ?ы솕 ?꾪솕:
  - `heat-score-calculator`瑜?`log1p + soft-cap` 諛⑹떇?쇰줈 ?꾪솚
  - ?곷떒 援ш컙?먯꽌 ?좏뵿 媛??먯닔 遺꾪빐???뺣낫
- Source 媛以묒튂 ?щ갭?곗떛:
  - `topic-clusterer` source weight ?뺤옣
  - YouTube 媛以묒튂 ?섑뼢(0.45), 而ㅻ??덊떚/?댁뒪???뚯뒪 ?곷? ?곗꽑
- ?좏겙 ?덉쭏 蹂닿컯:
  - YouTube 硫뷀? ?⑥뼱 遺덉슜???뺤옣
  - ?좎쭨???좏겙 ?쒓굅 洹쒖튃 異붽?

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run ops:supabase:audit` -> pass (`totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` -> pass
- `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)

### Current completion state
- Step 5C: **吏꾪뻾 以?(Round 1 + Round 2 ?꾨즺)**
- ?먯닔 ?ы솕 ?꾪솕/?≪쓬 ?듭젣 洹쒖튃源뚯? 肄붾뱶 湲곗? 諛섏쁺 ?꾨즺

### Remaining (updated)
1. Step 5C Round 3 (EC2 寃곌낵 罹섎━釉뚮젅?댁뀡)
- Round 2 肄붾뱶 諛고룷 ??`npm run analyze -- --hours 6` ?ъ떎??- `/api/topics?region=kr|jp|us&period=1h` ?섑뵆 由щ럭濡?stopword/source weight 誘몄꽭 議곗젙

2. ?뚯뒪 ?뺤옣 ?곗꽑?쒖쐞 ?ㅽ뻾
- 臾대퉬???뺤콉 ?꾩젣?먯꽌 ?덉젙???뚯뒪(`bilibili`, `mastodon`) ?댁쁺 ?ъ엯 ?뺣?

## Step 5C Update (2026-04-14, Analysis Quality Tuning Round 3)
### Newly completed
- `/api/topics` dedupe ?곸슜:
  - ?숈씪 ?좏뵿紐??뺢퇋??湲곗?) 以?理쒖떊 1嫄대쭔 諛섑솚
  - total 移댁슫?몃룄 dedupe 湲곗??쇰줈 ?쇱튂
- EC2 ?고????ш?利?
  - 諛고룷 ??`global-pulse-web.service` active ?뺤씤
  - `/pulse/api/health` 200 ?뺤씤
- ?щ텇???ㅽ뻾:
  - `npm run analyze -- --hours 6` ?ъ떎???꾨즺
  - heat ?ы솕 ?꾪솕(吏???⑹궛 濡쒓렇 湲곗? 1k~6k 遺꾪룷) ?뺤씤

### Validation
- Local:
  - `npm run lint` -> pass
  - `npm run build` -> pass
  - `npm run ops:supabase:audit` -> pass (`totalMatches=0`)
  - `npm run ops:supabase:budget -- --print-json` -> pass
  - `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)
- Runtime:
  - `http://3.36.83.199/pulse/api/health` -> 200
  - `npm run analyze -- --hours 6` -> pass

### Current completion state
- Step 5C: **Round 1 + Round 2 + Round 3 ?꾨즺**
- 以묐났 ?좏뵿 ?몄텧/?먯닔 ?ы솕/?≪쓬 ?좏겙 ?댁뒋瑜?1李??댁쁺 湲곗??쇰줈 ?뺣━ ?꾨즺

### Remaining (updated)
1. ?뚯뒪 ?뺤옣 ?곗꽑?쒖쐞 ?ㅽ뻾
- 臾대퉬???뺤콉 ?꾩젣?먯꽌 ?덉젙???뚯뒪(`bilibili`, `mastodon`) ?댁쁺 ?ъ엯 ?뺣?

2. ?덉쭏 怨좊룄???좏깮)
- dedupe key瑜?title 湲곕컲?먯꽌 cluster hash 湲곕컲?쇰줈 ?뺤옣
- Gemini ?붿빟 on-demand ?뺤콉(?쇱씪 ?쒗븳)?쇰줈 ?덉쭏 臾몄옣??蹂닿컯

## Step 5A Update (2026-04-14, Stable SNS Source Hardening)
### Newly completed
- Mastodon ?섏쭛 ?뺤젣 ?덉쭏 媛뺥솕:
  - HTML ?뷀떚???붿퐫??named + numeric)
  - URL 怨듬갚 ?뺢퇋??  - `cleanUrl()` 異붽? 諛?mastodon scraper URL ?곸슜
- ?덉젙??SNS ?뚯뒪 寃利?
  - `bilibili` scraper ?듦낵
  - `mastodon` scraper ?듦낵

### Validation
- `npm run test:scraper -- --source mastodon` -> pass
- `npm run test:scraper -- --source bilibili` -> pass
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run ops:supabase:audit` -> pass (`totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` -> pass
- `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)

### Current completion state
- Step 5A: **?덉젙??SNS ?뚯뒪 1李??섎뱶???꾨즺**
- ?띿뒪??URL ?뺥빀??媛쒖꽑?쇰줈 downstream 遺꾩꽍 ?덉쭏 媛쒖꽑 湲곕컲 ?뺣낫

### Remaining (updated)
1. EC2 ?댁쁺 ?곗씠??寃利?- `npm run collect -- --source bilibili,mastodon` ?ㅽ뻾 ??`raw_posts` 利앷? ?뺤씤
- ?대떦 ?뚯뒪 湲곕컲 遺꾩꽍 諛섏쁺 ?섑뵆 ?뺤씤

2. ?ㅼ쓬 ?뺤옣 ?곗꽑?쒖쐞
- 鍮꾩슜 ?뺤콉 ?좎? ?꾩젣?먯꽌 `zhihu`/`weibo` ?덉젙??媛쒖꽑 ?먮뒗 `hatena`/`ptt` ?뺥빀??蹂닿컯

## Step 5A Update (2026-04-14, Ops Verification Automation)
### Newly completed
- ?뚯뒪 ?곸옱 寃利??먮룞??異붽?:
  - `scripts/verify-source-ingest.ts`
  - ?좏깮 ?뚯뒪??理쒓렐 N遺?`raw_posts` 嫄댁닔/?섑뵆 row 異쒕젰
  - 湲곕낯 紐⑤뱶?먯꽌 ?뚯뒪蹂?0嫄댁씠硫??ㅽ뙣 泥섎━
- ?댁쁺 紐낅졊 異붽?:
  - `npm run ops:verify:source`
- ?곕턿 諛섏쁺:
  - `docs/operations.md`??source verify ?뱀뀡 異붽?

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run test:scraper -- --source bilibili` -> pass
- `npm run test:scraper -- --source mastodon` -> pass
- `npm run ops:supabase:audit` -> pass (`totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` -> pass
- `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)

### Current completion state
- Step 5A: **?댁쁺 寃利??먮룞?붽퉴吏 ?꾨즺**
- ?덉젙??SNS ?뚯뒪 ?뺤옣(?섏쭛 + ?댁쁺 ?먭?) ?덉감媛 諛섎났 媛???뺥깭濡?怨좎젙??
### Remaining (updated)
1. EC2 諛곗튂 猷⑦떞 寃고빀
- collector timer ?꾩쿂由щ줈 `ops:verify:source` 二쇨린 ?ㅽ뻾 ?щ? 寃??
2. ?ㅼ쓬 ?뚯뒪 ?뺤옣
- 鍮꾩슜 ?뺤콉 ?좎? ?꾩젣?먯꽌 `hatena` ?먮뒗 `ptt` ?뺥빀??媛쒖꽑 ?곗꽑 ?곸슜

## Step 5A Update (2026-04-14, Source Verify Timer Integration)
### Newly completed
- Added source verify wrapper script:
  - `scripts/run-source-verify.ts`
  - applies env defaults and executes `verify-source-ingest.ts` safely in batch mode
- Added dedicated systemd units:
  - `infra/systemd/global-pulse-source-verify.service`
  - `infra/systemd/global-pulse-source-verify.timer` (hourly)
- Deployment chain updated:
  - `scripts/deploy-ec2.sh` now installs/enables source-verify timer automatically
- Operations/deployment runbooks updated with:
  - timer status/log commands
  - env override keys (`VERIFY_SOURCE_*`)

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run ops:supabase:audit` -> pass (`totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` -> pass
- `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)

### Current completion state
- Step 5A follow-up: **ops verification now timerized**
- Source ingest health can now be checked continuously without touching collector timer logic

### Remaining (updated)
1. EC2 runtime apply and smoke check
- deploy latest commit to EC2, then verify:
  - `systemctl status global-pulse-source-verify.timer --no-pager`
  - `systemctl list-timers 'global-pulse-*' --no-pager`
  - `journalctl -u global-pulse-source-verify.service -n 200 --no-pager`

2. Next expansion slice
- low-cost source quality expansion (`hatena` or `ptt`) after timer stability is confirmed

## Step 5B Update (2026-04-14, PTT Recommend Parsing Hardening)
### Newly completed
- Reworked PTT recommend parser to avoid encoding-fragile branch logic.
- Added robust handling for:
  - hot marker (`??) -> `likeCount=100`
  - downvote marker (`X<number>`) -> `dislikeCount`
  - numeric push counts (`<number>`) -> `likeCount`
  - unknown markers -> graceful zero fallback
- Kept existing over18 cookie and date parsing behavior unchanged.

### Validation
- `npm run test:scraper -- --source ptt` -> pass
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run ops:supabase:audit` -> pass (`totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` -> pass
- `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)

### Current completion state
- TW source quality: **PTT parsing stability improved**
- Encoding-dependent parsing edge case removed from collector path

### Remaining (updated)
1. Runtime apply for this slice
- deploy latest commit to EC2 and run `npm run test:scraper -- --source ptt` once on host

2. Next source expansion
- proceed with `hatena`/`fivech`/`weibo` quality hardening under no-proxy policy

## Step 5B Update (2026-04-14, Fivech Feed Quality Hardening)
### Newly completed
- Refined `fivech` scraper feed quality rules:
  - skip non-time-based pinned/promotional DAT rows (invalid epoch DAT tokens)
  - suppress low-signal constant activity values (`commentCount<=2`) to avoid fake engagement noise
- Result:
  - noisy top pinned ads removed from output
  - feed now starts from real recent threads with valid `postedAt`

### Validation
- `npm run test:scraper -- --source fivech` -> pass (`postCount=48`)
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run ops:supabase:audit` -> pass (`totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` -> pass
- `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)

### Current completion state
- JP source quality: **fivech noise filtering applied**
- collector output suitability for downstream topic analysis improved

### Remaining (updated)
1. Runtime apply for this slice
- deploy latest commit to EC2 and run `npm run test:scraper -- --source fivech` once on host

2. Next source expansion
- continue low-cost quality hardening for `hatena` -> `weibo` ordering/normalization

## Step 5B Update (2026-04-14, Weibo Snapshot Identity Hardening)
### Newly completed
- Improved Weibo hot-search ingestion identity model:
  - `externalId` now includes UTC hour bucket + rank position
  - prevents long-term overwrite of the same topic key and keeps hourly trend snapshots
- Added explicit `postedAt` for Weibo snapshot rows:
  - each row now carries capture timestamp to keep analyzer time-decay behavior consistent
- Retained existing source behavior:
  - top 50 realtime items
  - same search URL mapping and numeric view count extraction

### Validation
- `npm run test:scraper -- --source weibo` -> pass (`postCount=50`)
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run ops:supabase:audit` -> pass (`totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` -> pass
- `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)

### Current completion state
- CN source quality: **weibo snapshot history retention improved**
- downstream topic analysis can now use hour-level distinct rows instead of repeated upsert on one static key

### Remaining (updated)
1. Runtime apply for this slice
- deploy latest commit to EC2 and run `npm run test:scraper -- --source weibo` once on host

2. Next source hardening
- evaluate `hatena` description normalization and `weibo` secondary metadata mapping (`icon_desc/flag`) for extra signal

## Step 5C Update (2026-04-15, Global Topics Empty-State Stabilization)
### Newly completed
- Fixed global analyzer replacement policy to prevent transient empty global issues:
  - when `topics` window is empty, keep existing active `global_topics`
  - when cross-region mapping result is empty, keep existing active `global_topics`
  - only expire+replace active rows when a new mapped set exists
- UI polish:
  - `HotTopicTicker` no longer duplicates fallback message when there is only one ticker item

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run ops:supabase:audit` -> pass (`totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` -> pass
- `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)

### Current completion state
- Global issues panel resilience: **improved**
- Temporary low-overlap analyzer runs no longer wipe visible global topic cards

### Remaining (updated)
1. Runtime apply and confirm
- deploy to EC2, run one analyzer cycle, confirm `/pulse/api/global-topics` remains non-empty across next cycle

2. Quality tuning follow-up
- reduce low-information global names (`keep brawl`, etc.) via cross-region naming stopwords/normalization

## Step 5C Runtime Apply (2026-04-15, EC2 deploy + revalidation)
### Newly completed
- EC2 deploy blocker resolved:
  - preserved host-local dirty state on `backup/ec2-local-20260414_213114` (`ceb8d0b`)
  - created safety bundle: `/home/ubuntu/global-pulse-backup-20260414_213114.bundle`
- Runtime deployed to latest `master` commit `6812546`.
- Rebuild + web restart completed on EC2.
- Analyzer one-shot completed successfully, including global mapping.

### Validation
- Runtime services:
  - `global-pulse-web.service` -> active/running
  - `global-pulse-analyzer.service` -> success (oneshot)
  - `systemctl list-timers 'global-pulse-*'` -> all expected timers active
- Public endpoints:
  - `http://3.36.83.199/pulse/api/health` -> `200`
  - `http://3.36.83.199/pulse/api/global-topics?limit=5` -> `200`, `total=3`
- Analyzer log:
  - `Global analysis completed. generated=3`
- UI signal:
  - `/pulse/global-issues` empty-state text not present at verification time

### Current completion state
- Step 5C: **code + runtime apply ?꾨즺**
- empty-state recurrence risk significantly reduced for transient low-signal analyzer runs

### Remaining (updated)
1. Step 5C quality follow-up
- global topic naming normalization (`keep brawl` ????뺣낫 紐낆묶 ?듭젣)

2. Step 5A/5B source expansion continuation
- 臾대퉬???곗꽑 ?뺤콉 湲곗??쇰줈 `hatena`/`ptt` ??怨좊????뚯뒪 ?덉젙??
## Step 5C Update (2026-04-15, UI Encoding + Loading State UX Guard)
### Newly completed
- ??湲濡쒕쾶 ?섏씠吏 ?몄퐫??蹂듦뎄:
  - 源⑥쭊 ?쒓? 臾멸뎄(紐⑥?諛붿?) ?쒓굅 諛?UTF-8 ?띿뒪?몃줈 ?듭씪
- 濡쒕뵫 UX 蹂댁젙:
  - `GlobalIssuePanel`??濡쒕뵫 以묒뿉???뚮뜑?섏? ?딅룄濡?議곌굔 ?섏젙
  - ?곗씠??濡쒕뱶 ??鍮?移대뱶媛 癒쇱? 蹂댁씠???꾩긽 ?꾪솕
- API ?대씪?댁뼵??蹂닿컯:
  - `lib/api.ts`??`/pulse` ?고???base-path 媛먯? fallback 異붽?
  - build-time env ?꾨씫 ?쒖뿉???대씪?댁뼵??fetch 寃쎈줈 ?덉젙??媛뺥솕

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run ops:supabase:audit` -> pass (`totalMatches=0`)
- `npm run ops:verify3:check -- --print-json` -> pass (`issues=[]`)

### Current completion state
- ?ъ슜??泥닿컧 ?댁뒋(臾몄옄??源⑥쭚, 濡쒕뵫 以?鍮?湲濡쒕쾶 ?댁뒋 ?몄텧) 1李?蹂댁젙 ?꾨즺
- `/pulse` ?섏쐞 寃쎈줈 ?댁쁺?먯꽌 ?대씪?댁뼵??API ?몄텧 ?덉젙??蹂닿컯 ?꾨즺

### Remaining (updated)
1. Runtime apply
- EC2 諛고룷 ???ㅼ젣 釉뚮씪?곗??먯꽌 ??湲濡쒕쾶 ?섏씠吏 ?뚮뜑 ?곹깭 ?ы솗??
2. Quality tuning follow-up
- 湲濡쒕쾶 ?좏뵿 ??쒕챸 ??뺣낫 ?쒗쁽(`keep brawl` ?? ?듭젣 洹쒖튃 異붽?

## Step 5C Runtime Recovery (2026-04-15, `/pulse` subpath output fix)
### Newly completed
- Identified public runtime fault:
  - `/pulse` HTML was still emitting root-relative links and static asset paths
  - this broke subpath deployment on the shared EC2 host
- Fixed build-time basePath source:
  - `next.config.ts` now reads `NEXT_PUBLIC_BASE_PATH` as well as `NEXT_BASE_PATH`
- Re-normalized mobile navigation labels and key fallback UI strings for stable subpath builds

### Validation
- `$env:NEXT_PUBLIC_BASE_PATH='/pulse'; npm run lint` -> pass
- `$env:NEXT_PUBLIC_BASE_PATH='/pulse'; npm run build` -> pass
- `.next/server/app/index.html` confirmed:
  - links use `/pulse/...`
  - static chunks use `/pulse/_next/...`

### Current completion state
- `/pulse` deployment output path issue: **code fix ?꾨즺**
- next action is runtime deploy + public endpoint verification

### Remaining (updated)
1. EC2 runtime apply
- deploy latest commit and confirm public `/pulse` HTML now references `/pulse/_next/...`

2. Quality tuning follow-up
- 湲濡쒕쾶 ?좏뵿 ??쒕챸 ??뺣낫 ?쒗쁽(`keep brawl` ?? ?듭젣 洹쒖튃 異붽?

## Step 5C Runtime Recovery (2026-04-15, deploy-chain follow-up)
### Newly completed
- Identified EC2 redeploy failure after basePath fix:
  - `deploy-ec2.sh` loaded runtime env before install
  - `NODE_ENV=production` caused build dependencies to be omitted during `npm ci`
- Fixed deploy order:
  - install dependencies first
  - load env file second
  - run build last

### Validation
- failure signature captured from EC2:
  - missing `@tailwindcss/postcss`
  - missing `prop-types`
  - missing `react-is`
- deploy script updated to prevent the same install/build split-brain on the next run

### Current completion state
- `/pulse` output fix: **code ready**
- deploy chain regression: **fixed in script**

### Remaining (updated)
1. Quality tuning follow-up
- 湲濡쒕쾶 ?좏뵿 ??쒕챸 ??뺣낫 ?쒗쁽(`keep brawl` ?? ?듭젣 洹쒖튃 異붽?

## Step 5C Runtime Recovery (2026-04-15, public `/pulse` recovered)
### Newly completed
- EC2 manual recovery completed with explicit npm install flags:
  - `npm ci --include=dev --include-workspace-root`
  - env load + rebuild + web restart
- Public runtime confirmed healthy:
  - `/pulse` now emits `/pulse/_next/...` static asset paths
  - `/pulse` navigation links stay inside `/pulse/...`
  - `/pulse/api/health` returns `200`
  - `/pulse/api/global-topics` returns populated data

### Validation
- `http://3.36.83.199/pulse` HTML contains:
  - `/pulse/_next/static/...`
  - `href="/pulse"`
  - `href="/pulse/global-issues"`
- `http://3.36.83.199/pulse/api/health` -> `200`
- `http://3.36.83.199/pulse/api/global-topics?limit=3` -> `200`, `total=3`

### Current completion state
- `/pulse` runtime breakage: **蹂듦뎄 ?꾨즺**
- deploy-chain root cause: **?앸퀎 諛??ㅽ겕由쏀듃 諛섏쁺 ?꾨즺**

### Remaining (updated)
1. Deploy script final hardening
- `deploy-ec2.sh` 理쒖떊 ?섏젙(`--include=dev --include-workspace-root`) 而ㅻ컠 諛섏쁺蹂?湲곗??쇰줈 ?ㅼ쓬 諛고룷 ?ъ씠???ш?利?
2. Quality tuning follow-up
- 湲濡쒕쾶 ?좏뵿 ??쒕챸 ??뺣낫 ?쒗쁽(`keep brawl` ?? ?듭젣 洹쒖튃 異붽?

## Update 2026-04-15: Topic Quality Tuning
- Status: In progress validation completed locally, pending EC2 analyzer rerun.
- Scope:
  - richer phrase extraction (2..4 grams)
  - UTF-8 safe extra stopwords for KR/JP/CN
  - stricter low-signal topic-label filtering
  - phrase-token similarity merge for fragmented phrase variants
- Local verification:
  - `npm run lint` -> pass
  - `npm run build` -> pass
- Expected user-facing effect:
  - fewer one-word topics
  - more phrase-shaped topic names
  - better merging of reordered phrase variants
- API freshness update (2026-04-15):
  - `/api/topics` and `/api/regions` now read latest batch only.
  - Purpose: prevent stale fragmented topics from dominating the dashboard after analyzer improvements.

## Step 5A Runtime Apply (2026-04-16)
### Newly completed
- Expanded per-region source registry and wired new IDs end-to-end:
  - collector run registry: `packages/collector/src/run.ts`
  - Reddit source router: `packages/collector/src/scrapers/us/reddit.ts`
  - scraper test harness: `scripts/test-scraper.ts`
  - source constants: `packages/shared/src/constants.ts`
- Added region source filtering in API queries to prevent cross-region contamination:
  - `app/api/topics/route.ts`
  - `app/api/regions/route.ts`
- Snapshot/build scripts now ignore rows not belonging to active allowed sources by region:
  - `scripts/build-snapshots.ts`
  - `scripts/seed-regions.ts`

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run test:scraper -- --source reddit_eu_union` -> pass
- `npm run test:scraper -- --source reddit_science` -> pass
- `npm run test:scraper -- --source reddit_taiwan` -> pass
- `npm run ops:supabase:audit` -> pass (`totalMatches=0`)

### Current completion state
- Source expansion: **active**
- EU heat distortion guard: **implemented at query level**

### Remaining (next)
1. EC2 runtime apply (required)
- deploy latest commit and run collection/analyze cycle once
- verify `/pulse/api/topics?region=eu` heat/sources are consistent in dashboard
2. Quality follow-up
- tune topic naming after phrase merge to reduce low-signal fragments where still present

## Step 5A Runtime Update (2026-04-16, Source Sync + Live Failure Classification)
### Newly completed
- Applied EC2 runtime source sync:
  - `npm run seed:regions`
- Production DB source registry now updated:
  - `db_sources=47`
  - `db_active=47`
  - `db_active_community=41`
- Ran one full collection cycle against synced registry:
  - `npm run collect`
  - result: `16/46 succeeded`

### Live diagnostics summary
- Reddit community family: HTTP 403 from EC2 egress (broad failure across regions)
- FMKorea: HTTP 430 with retry-after
- Dcard: HTTP 403 including browser fallback challenge
- Zhihu: still zero because scraper implementation is stub
- Stable/OK cluster: weibo, bilibili, mastodon, ptt, fivech, hatena, clien, fourchan, hackernews, youtube_us
- Low-volume but successful: dcinside, ruliweb, theqoo, youtube_kr, youtube_jp

### Remaining (updated)
1. Reddit collection path split
- move Reddit scraping to alternate egress (GitHub Actions or another IP)
- keep EC2 collector for non-Reddit sources
2. Anti-bot constrained sources
- FMKorea/Dcard require dedicated bypass strategy beyond parser tuning
3. Zhihu implementation
- implement actual scraper and wire runner/test entry

## Step 5A Runtime Update (2026-04-16, Non-Reddit Priority)
### Newly completed
- Source registry sync completed on EC2:
  - `npm run seed:regions`
  - result: `sources=56, active_sources=56`
- Zhihu scraper moved from stub to real API collector:
  - endpoint: https://api.zhihu.com/topstory/hot-list
  - runner wiring added in collector run path and test harness

### Verification
- `npm run lint` -> pass
- `npm run build` -> pass
- EC2 seed sync output confirms 56 registered sources

### Remaining
1. Reddit path: OAuth credentials + alternate egress/collection path (403 resolution)
2. FMKorea/Dcard: anti-bot bypass strategy refinement
3. Re-run full collect/analyze after deploy and refresh dashboard metrics

## Step 5A Runtime Verify (2026-04-16, after Zhihu implementation)
### Completed now
- EC2 deployed commit 8342615
- Full collector pass executed: 17/56 succeeded
- Zhihu promoted to active working source (postCount=30 test pass)
- Analysis pipeline rerun (`analyze`, `analyze:global`, `ops:snapshot`)
- /pulse/api/health externally reachable (200)

### Current state
- Global topics regenerated and non-empty
- Non-Reddit source coverage improved via Zhihu + source registry sync
- Remaining blockers are anti-bot/egress constrained sources (Reddit, FMKorea, Dcard)
## Step 5A Runtime Update (2026-04-16, Source Connectivity Matrix)
### Newly completed
- Added source connectivity matrix generator:
  - `scripts/source-connectivity-report.ts`
- Added npm command:
  - `npm run ops:source:report`
- Updated operations runbook with usage and filtering examples.

### What it provides
- Per-source triage in one table:
  - region/source/type/active flag
  - recent rows, total rows
  - last collected and last scraped timestamps
  - connectivity state: `CONNECTED`, `ERROR`, `STALE`, `ZERO`, `DISABLED`
  - recommended next action by failure signature (403/430/missing key/reddit path)
- Generated output:
  - `docs/source-notes/source-connectivity-report.md`

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

### Remaining
1. Run matrix on EC2 with production DB env:
- `npm run ops:source:report -- --minutes 180 --print-json`
2. Use generated matrix to prioritize non-Reddit fixes by region/source.
3. After matrix refresh, continue source expansion hardening.

## Step 5A Runtime Update (2026-04-16, Connectivity Report Hotfix)
- Fixed markdown sanitizer to handle non-string values from PostgreSQL rows.
- Resolved EC2 failure signature: `value.replace is not a function`.
- Validation: `npm run lint`, `npm run typecheck` pass.

## Step 5A Runtime Update (2026-04-16, Non-Reddit Recovery Verified)
### Newly completed
- EC2 runtime pulled latest commits and executed source matrix report.
- Verified `fmkorea` and `dcard` scraper success on EC2.
- Ran targeted collector execution for both sources and refreshed matrix.

### Verification
- `npm run test:scraper -- --source fmkorea` -> success, postCount=24
- `npm run test:scraper -- --source dcard` -> success, postCount=30
- `npm run collect -- --source fmkorea,dcard` -> 2/2 succeeded
- `npm run ops:source:report -- --minutes 180 --print-json`:
  - before rerun: connected=17, error=39
  - after rerun: connected=19, error=37
  - non-reddit: 19/19 connected

### Remaining
1. Reddit family (37 sources) remains blocked from EC2 runtime path.
2. Next step is Reddit OAuth credentials + alternative egress strategy.
## Step 5A Runtime Update (2026-04-18, Source Expansion Batch A/B/C)
### Newly completed
- Implemented and wired 14 new expansion sources:
  - KR: `inven`, `instiz`, `arca`
  - JP: `yahoo_japan`, `girlschannel`, `togetter`
  - US: `slashdot`, `fark`, `resetera`
  - TW/CN/EU: `bahamut`, `mobile01`, `tieba`, `gutefrage`, `mumsnet`
- Added source IDs into shared constants and collector/test runner routes.
- Applied analyzer quality tuning for new source weights + low-signal token filtering.

### Verification
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run test:scraper -- --source <id>` summary:
  - `tieba=29`, `gutefrage=16`, `yahoo_japan=50`, `togetter=50`, `slashdot=15`
  - `inven=21`, `instiz=41`, `arca=1`, `bahamut=8`, `mobile01=30`
  - `girlschannel=50`, `mumsnet=27`, `fark=50`, `resetera=39`
- Batch collect dry-run (no DB persistence in local env):
  - `npm run collect -- --source tieba,gutefrage,yahoo_japan,togetter,slashdot` -> `5/5 succeeded`
  - `npm run collect -- --source inven,instiz,arca,bahamut,mobile01` -> `5/5 succeeded`
  - `npm run collect -- --source girlschannel,mumsnet,fark,resetera` -> `4/4 succeeded`

### Runtime constraints (local)
- PostgreSQL env missing in local shell:
  - collect persisted writes skipped
  - `npm run analyze -- --region <id>` logs `PostgreSQL configuration missing. Skipping analysis run.`
  - `npm run ops:source:report -- --print-json` fails with DB config error as expected

### Remaining
1. EC2 runtime apply:
- pull latest commit and rerun Batch A/B/C collect with runtime env loaded
2. Generate runtime connectivity matrix:
- `npm run ops:source:report -- --minutes 180 --print-json`
3. 24h observation policy:
- monitor `arca` and `bahamut` low-volume behavior and disable per-source if persistent degradation continues

## Step 5D Runtime Stability Update (2026-04-18, API Fresh/Stale Fallback)
### Newly completed
- API empty-state hardening:
  - `/api/topics`: switched from strict period-only batch selection to `fresh-first + stale-fallback`.
  - `/api/regions`: same fallback policy for region heat/active topic metrics and topTopics.
  - `/api/global-topics`: if active rows are empty, fallback to latest historical global topics.
- Response metadata extended:
  - `meta.dataState`: `fresh | stale | empty`
  - `stale`: boolean flag
  - topics API additionally returns `meta.selectedBatchCreatedAt` and `meta.periodStart`.

### Why this step
- Dashboard showed zero activity when collector/analyzer was temporarily delayed beyond the selected period.
- With fallback, the UI keeps showing last-known valid data instead of collapsing to all-zero cards.

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

### Remaining
1. EC2 deploy + runtime verify:
- `git pull --ff-only`
- `npm run build`
- `sudo systemctl restart global-pulse-web.service`
2. External endpoint check after deploy:
- `/pulse/api/topics?region=kr&limit=5` returns `meta.dataState` and non-zero `total` when stale data exists
- `/pulse/api/regions` returns non-zero `activeTopics/totalHeatScore` in stale mode
- `/pulse/api/global-topics` returns fallback rows with `stale=true` when fresh rows are absent

## Step 6 UI Update (2026-04-18, Propagation Stream)
### Newly completed
- Added a new dashboard propagation section for live visual context:
  - moving keyword stream (region keyword signals)
  - cross-region spread track (animated flow lane)
- Integrated into `app/page.tsx` without API schema changes.

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

### Remaining
1. Runtime deploy to EC2 and visual confirmation at `/pulse`.
2. Optional follow-up: tune animation density for low-end mobile devices after runtime observation.

## Hotfix Update (2026-04-18, regions/topics recovery)
### Newly completed
- Fixed `/api/regions` SQL CTE syntax error causing dashboard region fetch failures.
- Fixed latest-batch matching precision in `/api/topics` and `/api/regions`.
- Deployed to EC2 and verified runtime recovery.

### Runtime verification
- `/pulse/api/health` -> 200
- `/pulse/api/regions` -> 200 with non-zero heat/activity for active regions
- `/pulse/api/topics?region=kr&limit=5` -> populated topic list

### Remaining
1. Continue analyzer quality tuning for label readability.
2. Keep source connectivity/collection watch loop running.

## UI Update (2026-04-18, mobile map + in-map spread motion)
### Newly completed
- Enabled dashboard world map panel on mobile layout.
- Added map-overlay spread motion lines/dots derived from cross-region topic paths.
- Kept API contract unchanged; visualization uses existing regions/globalTopics payload.

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

### Remaining
1. Deploy to EC2 and verify mobile rendering on `/pulse`.
2. Fine-tune route anchor points if any country marker overlap is visually dense.

## UI Behavior Update (2026-04-18, actual movement gating)
### Newly completed
- Propagation animation is now evidence-driven only.
- Removed fallback visual movement when cross-region propagation is not confirmed.
- Added explicit static-status messaging for no-movement intervals.

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

## UI Geometry Fix (2026-04-18, propagation route alignment)
### Newly completed
- Replaced manual overlay route anchors with true map projection route lines.
- In-map propagation now follows real lon/lat route geometry between regions.

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

## UI/Data Quality Update (2026-04-18, propagation stability + density)
### Newly completed
- Stabilized propagation direction to reduce random-looking back-and-forth paths.
- Increased dashboard signal density:
  - Home global topics fetch `5 -> 20`
  - Region summary topic fetch `3 -> 8`
  - Wider keyword extraction window for signal board.
- Expanded global analysis candidate window:
  - latest `1 -> 3` batches per region in global mapping input.
- Recovered UTF-8 text in key dashboard/region UI components to remove mojibake output.

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

### Remaining
1. Deploy to EC2 and run manual visual check on `/pulse` for one-way propagation behavior.
2. Execute one collector+analyzer+global-analyzer cycle on EC2 to increase fresh cross-region movement evidence.
3. Re-check `/pulse/api/global-topics?limit=20` and confirm movement lanes increase accordingly.

## UI/Data Density Follow-up (2026-04-18, shared-keyword propagation)
### Newly completed
- Added cross-region shared-keyword routing to world map propagation overlay.
- Expanded propagation stream source from `global topics only` to `global topics + shared region keywords`.
- Direction is stable and evidence-based:
  - map: high-heat source region -> spread regions
  - stream: origin/target longitude-based direction

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

### Remaining
1. Deploy this follow-up commit and verify movement density at `/pulse`.
2. Observe 24h and disable noisy keywords if any false spread appears.

## API Density Follow-up (2026-04-18, global topics backfill)
### Newly completed
- `/api/global-topics` now supplements low fresh result sets with deduped recent historical rows.
- Added response metadata `meta.supplementedFromHistory`.

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

### Remaining
1. Deploy and verify `/pulse/api/global-topics?limit=20` returns richer set in low fresh windows.
2. Continue improving true fresh cross-region match rate (Gemini endpoint/env correction + source diversity).

### Follow-up
- Backfill dedupe refined to name-based key to avoid duplicate global labels across fresh/history rows.

## Analyzer Follow-up (2026-04-18, Gemini 404 대응)
### Newly completed
- Gemini summarizer now supports multi-model fallback and dynamic model listing.
- Runtime diagnostics enhanced to include concise HTTP body snippets for model errors.
- UTF-8 prompt/fallback text restored in analyzer summarizer path.

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

### Remaining
1. Deploy and run `npm run analyze:gemini -- --hours 24` on EC2.
2. Confirm 404 disappearance and check whether fresh cross-region global topics increase.

## Analyzer Density Update (2026-04-18)
### Newly completed
- Added env-based analyzer density controls for raw-post intake and cluster output size.
- Increased default topic density for region rankings.

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

### Remaining
1. Deploy and run analyzer once to confirm region topic counts increase in runtime.
2. Observe for over-fragmentation and tune env limits if needed.

## API Follow-up (2026-04-19)
### Newly completed
- Added final dedupe guard on `/api/global-topics` response to remove duplicate labels in stale/fresh overlap windows.

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

## Expansion Update (2026-04-19, 3-point batch)
### Completed in this batch
- Cross-region mapping recall tuned (`similarity default 0.24`) with relaxed matching heuristics.
- ME/RU source expansion wired end-to-end:
  - added `habr`, `youtube_me`, `youtube_ru`, `mastodon_me`, `mastodon_ru`
  - collector runner + test runner mapping + analyzer source weights updated
- Propagation behavior stabilization:
  - map movement now based on confirmed global-topic routes only
  - stream lane jitter reduced with stable key hashing and active-region gating

### Local validation
- `npm run lint` -> pass
- `npm run build` -> pass
- scraper tests:
  - `habr` pass (40)
  - `mastodon_me` pass (2)
  - `mastodon_ru` pass (1)
  - `youtube_me`, `youtube_ru` require runtime `YOUTUBE_API_KEY`

### Next operational check on EC2
1. Pull + build + restart `global-pulse-web` (pulse-only route).
2. Seed new sources and run collector/analyzer cycle.
3. Verify `/pulse/api/regions` and `/pulse/api/global-topics` reflect ME/RU activity.
4. Confirm `/stock` endpoint health is unchanged.

## Deployment Verification (2026-04-19, EC2 runtime)
### Completed
- Deployed latest batch (`107a0c6`) to EC2 `/srv/projects/project2/global-pulse`.
- Protected multi-site coexistence:
  - `/stock` kept intact
  - `/pulse` updated only
- Confirmed endpoint health:
  - `/stock` 200
  - `/pulse` 200
  - `/pulse/api/health` 200
  - `/` 404 (unchanged)

### Data/Analysis verification
- Source onboarding confirmed on EC2:
  - `habr` connected (40)
  - `youtube_me` connected (20)
  - `youtube_ru` connected (20)
  - `mastodon_me` connected (2)
  - `mastodon_ru` connected (1)
- Region impact confirmed:
  - `me` active (`heat=1161.64`, `topics=6`)
  - `ru` active (`heat=698.47`, `topics=10`)
- Global topics endpoint active with updated mapping threshold (`6` rows on `limit=20`).

### Operational caveat fixed
- Production env had `NODE_ENV=production`, so manual `npm ci` omitted dev deps and broke Next build.
- Runtime deploy command was corrected to `npm ci --include=dev` before build.

## Dashboard QoL Sweep (2026-04-19, GP-20260419-107)
### Completed in this round
- Restored live header clock behavior and `h23` format guard (no `24:xx`).
- Added/kept freshness badge semantics with valid Korean text and ARIA labels.
- Removed remaining mojibake in high-visibility UI blocks (header/nav/dashboard/global issue panel).
- Kept global-topic dedupe and region-nameEn quality path active without schema/API change.
- Kept heat-map geo source local (`/pulse/geo/countries-110m.json`) and no external CDN dependency.

### Validation snapshot
- Local build gate (`NEXT_BASE_PATH=/pulse`): `lint` pass, `build` pass.
- Local route gate: `/pulse`, `/pulse/api/regions`, `/pulse/api/global-topics`, `/pulse/api/topics?region=kr` all 200.
- Remote data gate (`3.36.83.199` pre-deploy read):
  - global-topic duplicate check on top 10: none
  - KR topics include `nameEn != nameKo` rows
  - period/sort API queries return changed ordering

### Remaining
1. Deploy this commit to EC2 and re-check `/pulse` navigation labels and freshness badge rendering.
2. Run post-deploy smoke: `/stock` 200, `/pulse` 200, `/pulse/api/health` 200.
3. Optional: widen sentiment lexicon coverage for JP/TW/CN where zero concentration is still high.

## Post-deploy Verification (2026-04-19, GP-20260419-108)
### Completed
- Deployed `aabb595` to EC2 pulse service and restarted `global-pulse-web`.
- Confirmed 3-site coexistence remains intact (`/stock` unaffected).
- Executed analyzer/global-analyzer once with production env sourced from `/etc/global-pulse/global-pulse.env`.

### Verified
- Availability: `/stock` 200, `/pulse` 200, `/pulse/api/health` 200, `/` 404.
- Home SSR includes actual topic text (`오늘자 지수`) in HTML payload.
- Header freshness badge text and ARIA now render 정상 한국어.
- `/api/global-topics?limit=20` dedupe collision 없음.
- `/api/topics?region=kr`에서 `nameEn != nameKo` 항목 존재.
- `/pulse` HTML에서 외부 world-atlas CDN 참조 없음.
- period/sort 쿼리 변경 시 `/api/topics` 결과 순서 변화 확인.

### Remaining
1. Optional quality pass: US/EU/ME/RU nameEn quality tuning (still 일부 fallback 라벨 존재).
2. Optional quality pass: region-specific sentiment lexicon 확장으로 null 비중 추가 감소.

## Delivery Update (2026-04-19)
- 수행: 상세 재검증(lint/test/build + EC2 서비스/API/타이머) 완료.
- 보완: analyzer 토큰/라벨 필터 강화, Gemini 저신호 토픽명 자동 폴백 로직 추가.
- 테스트: analyzer 테스트 22건 통과, 빌드 통과.
- 배포: EC2 재배포 및 analyzer(지역/글로벌) 배치 재실행.
- 운영확인: `/pulse` 및 `/pulse/api/health` 200, 글로벌 토픽 spread 정렬 응답 정상.

- 추가 보완: evidence rotation 권한 폴백 적용(backup 경고 감소).

- 추가 보완: evidence prune를 untracked-only로 수정(원격 tracked 삭제 방지).

## 2026-04-19 Update (GP-20260419-01)
- Completed foundational implementation of news/portal track with scope-aware data plane.
- Added `news` and `compare` routes behind `FEATURE_DUAL_MAP_UI` (default false).
- Added API extensions:
  - `GET /api/topics?scope=`
  - `GET /api/regions?scope=`
  - `GET /api/global-topics?scope=`
  - `GET /api/regions/compare?regionId=`
  - `GET /api/portal-rankings?regionId=&limit=`
  - `GET /api/issue-overlaps?minTier=&limit=`
- Added issue overlap generation pipeline (`community` vs `news`) into `issue_overlaps`.
- Expanded region definitions (19 total) and map coordinates for propagation visuals.
- Build/test/lint gates all pass locally.

## 2026-04-19 Update (Gate Verification Continuation)
- Resolved route gate mismatch for dual-map pages under Next.js 16 streamed responses.
- Added `proxy.ts` hard 404 gate for `/pulse/news` and `/pulse/compare` when `FEATURE_DUAL_MAP_UI=false`.
- Confirmed runtime matrix:
  - OFF: `/pulse` 200, `/pulse/news` 404, `/pulse/compare` 404
  - ON: `/pulse` 200, `/pulse/news` 200, `/pulse/compare` 200
- Build/lint/test and feed verification all green in local gate run.

## 2026-04-19 Deploy Update (master `cae8a7f`)
- EC2 배포 완료 (`/srv/projects/project2/global-pulse`) 및 웹 서비스 `active` 확인.
- 멀티사이트 영향 점검 통과:
  - `/stock` 200 유지
  - `/pulse` 200
  - `/pulse/api/health` 200
  - `/` 404 유지
- dual-map feature gate 검증:
  - `FEATURE_DUAL_MAP_UI=false` 기준 `/pulse/news`, `/pulse/compare` 404 동작 확인.
- post-deploy에서 `scope=news` API 500 확인 후 DB 마이그레이션 적용(`0005_news_sources_and_scope.sql`)으로 복구.
- 복구 후 news/compare API 200 정상화.

## 2026-04-19 Recovery Update (news FK + tab exposure)
- 뉴스 수집 실패(FK) 원인 복구: EC2에서 `seed:regions` 재적용 후 대상 news 소스 수집 성공 확인.
- Pulse 네비게이션 라벨 한글 깨짐 복구.
- Pulse 탭 노출 확장: 뉴스 트랙(`/news`), 커뮤 vs 뉴스(`/compare`)를 feature flag 기반으로 노출.
- EC2 env에서 dual-map/news pipeline 활성화 값 적용 완료.

## 2026-04-19 Runtime Recovery Confirmed
- EC2에 dual-map/news pipeline flag 활성화 + 재배포 완료.
- `sources` 카탈로그 재시드 후 news 수집 FK 오류 복구 확인(대상 3소스 3/3 성공).
- `/pulse/news`, `/pulse/compare` 접근 가능(HTTP 200) 및 `scope=news` API 데이터 응답 확인.

## 2026-04-19 Update (News Heat Recovery)
- 원인: 뉴스/RSS 소스의 참여지표 부족으로 `heat_score`가 0으로 수렴.
- 조치: analyzer heat 계산에 뉴스 전용 baseline 신호와 fallback heat 경로를 추가.
- 범위: community 스코프 계산식은 유지, news/mixed에서만 baseline 적용.
- 검증: `npm run lint`, `npm run test`(25/25), `npm run build` 통과.
- 다음: EC2에서 `analyze --scope news` 재실행 후 `/pulse/news`, `/pulse/api/topics?scope=news` 값 확인.

## 2026-04-19 Deploy Verification (a109c31)
- EC2 재배포 완료: `/srv/projects/project2/global-pulse`.
- 뉴스 분석 재실행 완료: `scope=news` 및 `global news` 배치 성공.
- 결과: 뉴스 토픽 `heat_score=0` 고착 해소(실데이터에서 non-zero 확인).
- 탭 노출 확인: `/pulse`에서 `/pulse/news`, `/pulse/compare` 링크 존재.
- 멀티사이트 확인: `/stock` 200, `/pulse` 200, `/` 404 유지.

## 2026-04-19 Status Update (GP-20260419-115)
- Runtime wiring recovery completed for analyzer + map propagation rendering path.
- New ops tools added for live source health, community feed verification, and enrichment backfill.
- Community source catalog expanded; configured regions now satisfy `community >= news` by source definition counts.
- Admin runtime status page added: `/pulse/admin/pipeline-status`.
- Local validation complete: lint pass, tests pass, build pass.
- Pending runtime step on EC2: run source-health/backfill with production DB env and apply activation with operator approval flag.
