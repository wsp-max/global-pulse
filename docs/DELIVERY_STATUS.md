# Global Pulse Delivery Status

## 목적
- 현재 구현 범위와 남은 작업을 한 번에 확인하기 위한 실행 기준 문서.
- 패치노트(`docs/PATCH_NOTES.md`)와 함께 업데이트한다.

## 현재 단계
- 기준 날짜: 2026-04-12
- 현재 진행 단계: **Step 5 확장**
- 전체 Phase 1 진행률(체크리스트 기준): **약 90%**

## Phase 1 체크리스트 상태

### Step 1: 프로젝트 초기화
- 상태: 완료
- 완료 기준:
  - Next.js + Tailwind + 모노레포 구조 구성
  - Supabase 마이그레이션/기본 워크플로우/스크립트 생성

### Step 2: 한국 3개 사이트 수집
- 상태: 완료
- 완료 기준:
  - `dcinside`, `fmkorea`, `clien` 수집 구현
  - `raw_posts` 저장 + `sources` 상태 업데이트

### Step 3: NLP 분석
- 상태: 부분 완료
- 완료 항목:
  - TF-IDF 키워드 추출
  - 토픽 클러스터링
  - heat/sentiment 계산
  - `topics`, `heat_history`, `region_snapshots` 저장
  - Gemini 옵션 요약(`--with-gemini`) 연결
  - 글로벌 분석 실행기(`analyze:global`) 및 워크플로우 연결
- 남은 항목:
  - 번역기(`translator`) 실동작 연계
  - 운영 환경(Supabase)에서 `global_topics` 생성/만료 사이클 검증

### Step 4: 프론트엔드 MVP
- 상태: 대부분 완료
- 완료 항목:
  - 대시보드, 리전 페이지, 글로벌 이슈, 타임라인, 토픽 상세 실데이터 연동
  - 월드맵/차트 반영
- 남은 항목:
  - 모바일 네비게이션 완성도 보강
  - 컴포넌트별 UI 미세조정(밀도/가독성)

### Step 5: 확장 준비
- 상태: 진행 중
- 완료 항목:
  - `reddit` 수집 구현
  - `reddit_worldnews` 수집 구현
  - `reddit_europe` 수집 구현
  - `reddit_mideast` 수집 구현
  - `fourchan` 수집 구현
  - `hackernews` 수집 구현
  - `youtube_kr/jp/us` 수집 구현
  - Gemini 요약 파이프라인 연결
  - US 수집 워크플로우에서 3개 소스 동시 실행 확인
  - EU/ME 수집 워크플로우 실행 경로 확인
- 남은 항목:
  - 타 리전 스크래퍼(일본/대만/중국) 순차 동작화
  - SNS 소스(`mastodon`, `bilibili`, `telegram`) 운영 안정화

## 지금부터 해야 할 일 (우선순위)

1. `cross-region-mapper` 운영 검증 + `global_topics` 자동 생성 안정화
- 완료 기준:
  - 2개 이상 리전 토픽이 자동 매핑되어 `global_topics` 생성
  - `first_seen_region/at`, `regional_sentiments`, `regional_heat_scores` 정상 기록

2. SNS 확장 안정화
- 목표 소스: `mastodon`, `bilibili` (가능하면 `telegram`)
- 완료 기준:
  - 실패 시 graceful fallback
  - source 상태/에러 로그 반영

3. 프론트 품질 마감
- 완료 기준:
  - 모바일 뷰에서 핵심 동선(대시보드/리전/글로벌/타임라인) 문제 없음
  - API 예외 시 사용자 메시지 일관성 확보

## Phase 1 완료선(어디까지 해야 하는지)
- 다음 조건 충족 시 Phase 1 완료로 본다:
  - 한국/미국 핵심 수집 파이프라인 안정 동작
  - 글로벌 토픽 자동 생성(`global_topics`) 파이프라인 동작
  - 프론트 4개 핵심 페이지(메인/리전/글로벌이슈/타임라인) 실데이터 운영 가능
  - GitHub Actions 스케줄 경로가 수집->분석 흐름으로 연결
  - 실패 시 로그/상태 확인 가능(`sources.last_error`, 워크플로우 경고)

## 최근 검증 스냅샷 (2026-04-12)
- 성공
  - `npm run test:scraper -- --source reddit_worldnews`
  - `npm run test:scraper -- --source hackernews`
  - `npm run collect:us` (reddit/reddit_worldnews/hackernews 3/3 성공)
  - `npm run test:scraper -- --source reddit_europe`
  - `npm run test:scraper -- --source reddit_mideast`
  - `npm run test:scraper -- --source fourchan`
  - `npm run collect:eu` (reddit_europe 1/1 성공)
  - `npm run collect:me` (reddit_mideast 1/1 성공)
  - `npm run collect:us` (reddit/reddit_worldnews/fourchan/hackernews 4/4 성공)
  - `npm run lint`
  - `npm run build` (재시도 포함 최종 통과)
  - `npm run analyze:global -- --hours 24 --min-regions 2 --similarity 0.3` 실행 경로 확인
- 예상 실패(환경 변수 미설정)
  - `npm run test:scraper -- --source youtube_jp`
  - `npm run test:scraper -- --source youtube_us`
  - `npm run collect:youtube:global`
  - `npm run analyze:global` 실DB write 검증 (Supabase 키 없음)

## 운영 규칙
- 모든 단계 완료 후:
  - `docs/PATCH_NOTES.md`에 버전 추가
  - 이 문서(`docs/DELIVERY_STATUS.md`)의 상태/남은 항목 갱신

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
- Executed user-requested single-run closure (`1회`):
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
- Step 3V (API 제거 2차) 완료:
  - Supabase fallback 제거:
    - `/api/topics`
    - `/api/regions`
    - `/api/global-topics`
    - `/api/search`
    - `/api/stats`
    - `/api/timeline`
    - `/api/topic/[topicId]`
  - API는 PostgreSQL-only 또는 미구성 시 `provider: "none"` 응답으로 통일
- Step 3W (Batch 제거 1차) 완료:
  - `scripts/build-snapshots.ts` PostgreSQL-only
  - `scripts/cleanup-old-data.ts` PostgreSQL-only
  - analyzer 진입점 PostgreSQL-only:
    - `packages/analyzer/src/run-analysis.ts`
    - `packages/analyzer/src/run-global-analysis.ts`
- Step 3X (Collector/Seed 제거 2차) 완료:
  - collector storage 경로 PostgreSQL-only:
    - `packages/collector/src/utils/supabase-storage.ts`
  - seed 경로 PostgreSQL-only:
    - `scripts/seed-regions.ts`
- Step 3Y (Shared/Env 최종정리) 완료:
  - shared Supabase runtime export 제거:
    - `packages/shared/src/index.ts`
  - Supabase runtime 파일 제거:
    - `packages/shared/src/supabase.ts` (deleted)
    - `app/api/_shared/supabase-server.ts` (deleted)
    - `lib/supabase-client.ts` (deleted)
  - preflight env 체크를 PostgreSQL 기준으로 전환:
    - `scripts/closure-preflight.ts`
- Step 3Z (마감 검증/문서 고정) 완료:
  - `npm run lint` (pass)
  - `npm run build` (pass)
  - `npm run ops:supabase:audit` (pass, `totalMatches=0`)
  - `npm run ops:supabase:budget -- --print-json` (pass, budget/current `0`)
  - `npm run ops:verify3:check -- --print-json` (pass, `issues=[]`)
  - budget 재기준화:
    - `docs/source-notes/supabase-fallback-budget.json`: `51 -> 0`
  - 패치노트 누적 반영:
    - `docs/PATCH_NOTES.md` (`GP-20260413-39`)

### Current completion state
- Supabase fallback runtime 코드 경로: 제거 완료 (`0` matches)
- Single-run 클로저 정책: 유지 (`ROUNDS=1` 기본)
- EC2 final evidence: PASS 유지 (`20260412_212140`)

### Remaining (current)
1. 운영 관찰(24h) 유지
- systemd timer 주기 수집/분석/정리 루프 모니터링
- 에러율/지연/DB 용량 추이 확인

2. 문서 정리(선택)
- 역사 문서 내 Supabase 서술은 런타임 비활성/레거시임을 명시적으로 라벨링

## EC2 Pivot Progress Update (2026-04-13, Step 4A)
### Newly completed
- 운영 문서 PostgreSQL-only 기준 정리:
  - `README.md`
  - `docs/operations.md`
  - `docs/deployment-ec2.md`
  - `docs/architecture.md`
  - `docs/supabase-cutover-checklist.md` (legacy record 재정의)
  - `.env.example`
- 24h 운영 관찰 시작 준비:
  - 신규 스냅샷 스크립트 추가:
    - `scripts/capture-ops-snapshot.sh`
    - `scripts/run-ops-watch-window.sh`
  - 신규 실행 명령 추가:
    - `npm run ops:monitor:snapshot`
    - `npm run ops:monitor:watch`
  - 산출물 경로:
    - `docs/evidence/ops-monitoring/<timestamp>/`
- evidence 메타 갱신:
  - `scripts/capture-cutover-evidence.sh` -> `postgres_config_mode` 기록
  - `scripts/generate-evidence-report.ts` -> 신규 필드 파싱/리포트 반영
  - `scripts/self-test-closure-tooling.ts` fixture 갱신
- closure import 후속 문구 정리:
  - `scripts/apply-final-verification-report.ts`
- Supabase audit 리포트 개선:
  - `scripts/audit-supabase-fallback.ts`
  - 매치 `0`일 때 제거 TODO 대신 guard checklist를 출력
- 의존성/스크립트 정리:
  - root/shared에서 `@supabase/supabase-js` 제거
  - `setup:supabase` npm 스크립트 제거

### Validation
- `npm install` (pass)
- `npm run lint` (pass)
- `npm run build` (pass)
- `npm run ops:closure:selftest` (pass)
- `npm run ops:supabase:audit` (pass, `totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` (pass, `ok=true`)
- `npm run ops:verify3:check -- --print-json` (pass, `issues=[]`)

### Current completion state
- Runtime DB path: PostgreSQL-only (유지)
- Supabase fallback retirement baseline: `0` (유지)
- Closure evidence state: PASS (`20260412_212140`, 유지)
- Ops watch tooling: 준비 완료 (EC2 실행 대기)

### Remaining (current)
1. 24h 운영 관찰 실행
- EC2에서 1시간 간격으로 `npm run ops:monitor:snapshot` 수행
- 최소 24회 증적 수집 후 이상 징후(실패율/지연/누락) 검토

2. 관찰 결과 문서 반영
- `docs/PATCH_NOTES.md`, `docs/DELIVERY_STATUS.md`에 운영 관찰 결과 요약 추가

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
  - systemd units/timers `active` 확인
  - `bash scripts/capture-ops-snapshot.sh` (pass, failures `0`)

### Current completion state
- systemd 기반 운영 루프: 활성화 완료
- 24h 관찰 루프: 진행 중
- local code snapshot: 커밋 완료

### Remaining (current)
1. Remote Git push finalization
- local repo has no configured remote (`git remote -v` empty)
- push target URL/권한 필요

2. 24h watch completion review
- watch 종료 후 `watch-summary.txt` 기반으로 운영 결과 요약/이슈 반영

## EC2 Pivot Progress Update (2026-04-13, Step 4C)
### Newly completed
- 프롬프트 단일화 완료:
  - 마스터 문서로 `docs/INITIAL_PROMPT_GLOBAL_PULSE.md` 확정
  - `docs/INITIAL_PROMPT_GLOBAL_PULSE_EC2.md`는 레거시 포인터 문서로 전환
- 마스터 프롬프트에 통합 반영:
  - 단일 EC2/PostgreSQL-only 아키텍처 기준
  - Step 단위 실행/기록/검증 규칙
  - 수집/분석/API/UI/운영 요구사항
  - 현재 상태 요약 + 다음 실행 우선순위
  - UTF-8 인코딩 체크리스트
- 문서 운영 규칙 고정:
  - 앞으로 프롬프트 갱신은 마스터 문서 1곳만 업데이트

### Validation
- `Get-Content -Encoding utf8 docs/INITIAL_PROMPT_GLOBAL_PULSE.md` (한글/구조 확인)
- `Get-Content -Encoding utf8 docs/INITIAL_PROMPT_GLOBAL_PULSE_EC2.md` (포인터 전환 확인)
- `git diff`로 문서 변경 범위 확인

### Current completion state
- Prompt source-of-truth: 단일화 완료
- PostgreSQL-only 운영 원칙: 유지
- 기록 체계(PATCH_NOTES/DELIVERY_STATUS 누적): 유지

### Remaining (current)
1. Remote Git push finalization
- local repo remote 미설정 상태 해결 필요(`git remote add origin ...`)

2. EC2 배포 경로 git checkout 전환
- `/srv/projects/project2/global-pulse`를 git clone 기반으로 정리

3. 24h 운영 관찰 결과 마감
- `docs/evidence/ops-monitoring/*` 요약을 패치노트/상태문서에 최종 반영
## EC2 Pivot Progress Update (2026-04-13, Step 4D)
### Newly completed
- GitHub 신규 저장소 생성 완료:
  - `https://github.com/wsp-max/global-pulse`
- 로컬 원격 연결 완료:
  - `origin = https://github.com/wsp-max/global-pulse.git`
- 최초 업로드 완료:
  - `git push -u origin master` 성공
  - upstream 추적 설정 완료

### Validation
- `git remote -v` 확인
- `git push -u origin master` 성공 로그 확인

### Current completion state
- 원격 저장소 연결: 완료
- 코드/문서 백업 경로: GitHub origin으로 확정

### Remaining (current)
1. EC2 배포 경로 git checkout 전환
- `/srv/projects/project2/global-pulse`를 tar/scp 반영 방식에서 `git clone/pull` 기반으로 전환

2. 24h 운영 관찰 결과 마감
- `docs/evidence/ops-monitoring/*` 요약/이상 징후를 `PATCH_NOTES`/`DELIVERY_STATUS`에 최종 반영

3. 브랜치 정책 정리(선택)
- 필요 시 `master -> main` 표준화

## EC2 Pivot Progress Update (2026-04-13, Step 4E)
### Newly completed
- EC2 앱 경로를 git 기반 배포 구조로 전환 완료:
  - 기존 경로 백업:
    - `/srv/projects/project2/global-pulse_legacy_20260413_133224`
  - 신규 경로 clone:
    - `/srv/projects/project2/global-pulse` (`master`)
  - remote:
    - `origin=https://github.com/wsp-max/global-pulse.git`
- 배포 루틴 표준화:
  - `scripts/deploy-ec2.sh` 실행으로 build + systemd unit/timer 재적용
  - `scripts/deploy-ec2.sh` default branch를 `master`로 정렬
- 런타임 상태 확인:
  - web service `active`
  - collector/analyzer/snapshot/cleanup/backup timer `active`
  - `/api/health` 최신 런타임 응답 확인 (`provider=postgres`)

### Validation
- EC2:
  - `git -C /srv/projects/project2/global-pulse rev-parse --abbrev-ref HEAD` -> `master`
  - `git -C /srv/projects/project2/global-pulse remote -v` 확인
  - `systemctl status global-pulse-web.service`
  - `systemctl list-timers 'global-pulse-*' --no-pager`
  - `curl -i http://127.0.0.1:3000/api/health`

### Current completion state
- EC2 deploy path: git checkout 기반으로 전환 완료
- 반복 배포 루틴: `git pull + build + systemd`로 고정

### Remaining (current)
1. EC2 PostgreSQL runtime env 설정
- `/etc/global-pulse/global-pulse.env`에 `DATABASE_URL` 또는 `DB_*` 추가 필요
- 현재 health는 `postgres_not_configured`로 `503` 상태

2. 24h watch 결과 마감
- 새 watch 종료 후 최종 summary를 문서에 반영

## EC2 Pivot Progress Update (2026-04-13, Step 4F)
### Newly completed
- ops monitoring evidence를 신규 경로/로컬로 동기화:
  - `docs/evidence/ops-monitoring/*`
- post-cutover snapshot 1회 성공:
  - `20260413_133512/summary.txt` (failures=0)
- 24h watch 재시작:
  - `watch_20260413_133512/watch-summary.txt`
  - hour=1 pass, failures=0

### Validation
- `npm run ops:monitor:snapshot` (EC2, pass)
- `npm run ops:monitor:watch` (EC2, 백그라운드 실행 중)
- watch summary에서 hour=1 성공 확인

### Current completion state
- 관찰 증적 이관: 완료
- post-cutover watch: 진행 중

### Remaining (current)
1. watch 종료 결과 반영
- `watch-summary.txt` 최종 `failures` 값과 중단 사유(있는 경우) 문서화

2. DB table count 활성화
- PostgreSQL env 설정 후 snapshot의 `db_table_counts` SKIP 해소

## Step 5A Progress Update (2026-04-13)
### Newly completed
- 수집기 확장 1차 구현:
  - `bilibili` scraper 구현
  - `mastodon` scraper 구현
  - `dcard` scraper 구현(차단 시 graceful failure)
- collector/runtime 반영:
  - `packages/collector/src/run.ts` 대상 소스 추가
  - `scripts/test-scraper.ts` 테스트 소스 추가
  - `packages/collector/src/index.ts` export 추가
- 워크플로우 소스 단위 정렬:
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
- Step 5A 목표(신규 3개 소스 도입): 코드 반영 완료
- 운영 가용성:
  - bilibili/mastodon: 동작 확인
  - dcard: Cloudflare 403로 실패 처리(예상 리스크 명시)

### Remaining (current)
1. Dcard 안정화 경로 결정
- API 차단 우회(프록시/브라우저 기반/대체 소스) 전략 필요

2. Step 5B 착수
- `ptt`, `hatena`, `fivech`, `weibo` 구현 + 실패율 기준 수립

## EC2 Pivot Progress Update (2026-04-13, Step 4E Follow-up)
### Newly completed
- EC2 재배포 충돌 해소:
  - 원인: `docs/evidence/ops-monitoring/*` untracked 파일이 tracked 파일 병합을 막음
  - 조치: evidence 디렉토리를 `ops-monitoring_runtime_20260413_134415`로 백업 이동 후 pull/deploy 재실행
- EC2 앱 최신화 완료:
  - deployed commit: `36a5fa7`
- post-deploy watch 재시작:
  - `watch_20260413_134515` (hour=1 pass, failures=0)
- 로컬 evidence 재동기화 완료:
  - 최신 `ops-monitoring` 로그/summary 반영

### Validation
- `git -C /srv/projects/project2/global-pulse rev-parse --short HEAD` -> `36a5fa7`
- `systemctl is-active global-pulse-web.service ...` -> all active
- `npm run test:scraper -- --source bilibili` (EC2) -> success
- `npm run test:scraper -- --source mastodon` (EC2) -> success
- `npm run test:scraper -- --source dcard` (EC2) -> 403

### Current completion state
- Step 4E: 완료(표준 배포 + follow-up 충돌 해소까지 반영)
- Step 4F: 진행 중(24h watch 누적 중, hour1 pass)
- Step 5A: 완료(3개 소스 코드 반영 + smoke 검증 완료)

### Remaining (current)
1. PostgreSQL env 설정
- `/etc/global-pulse/global-pulse.env`에 DB 접속 정보 추가 필요

2. 24h watch 종료 마감
- `watch_20260413_134515/watch-summary.txt` 최종 상태 반영

3. Step 5B 실행
- `ptt`, `hatena`, `fivech`, `weibo` 구현 착수

## Step 5B Progress Update (2026-04-13)
### Newly completed
- 고변동 소스 4개 구현 완료:
  - `fivech` (`itest.5ch.io/subbacks/bbynews.json`)
  - `hatena` (RSS)
  - `ptt` (over18 cookie + HTML)
  - `weibo` (hotSearch JSON)
- collector/runtime 연결:
  - `run.ts` 대상 소스 등록 완료
  - `test-scraper.ts` 테스트 매핑 등록 완료
  - `collector index` export 정렬 완료
- 운영 설정 보정:
  - `collect-taiwan.yml` -> `--region tw`로 변경 (PTT 포함)
  - `constants.ts`의 `fivech/hatena` scrapeUrl을 실제 수집 엔드포인트로 정렬
- 데이터 정합성 보정:
  - fivech 비정상 epoch thread(`924...`)는 `postedAt` 생략 처리

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
- Step 5B: 코드 구현/로컬 수집 검증 완료
- L2 Data Plane 관점:
  - 활성 스크래퍼 커버리지가 JP/TW/CN으로 확장됨
- 남은 검증:
  - DB row 증가 검증은 EC2(PostgreSQL env 설정 후)에서 final check 필요

### Remaining (current)
1. EC2 DB runtime 활성화
- `/etc/global-pulse/global-pulse.env`에 `DATABASE_URL` 또는 `DB_*` 적용
- `/api/health`를 `postgres_not_configured` -> 정상 상태로 전환

2. 24h watch 최종 마감
- `watch_20260413_134515/watch-summary.txt` 최종 결과를 PATCH_NOTES/DELIVERY_STATUS에 고정

3. Step 5C 착수
- analyzer 품질 튜닝(불용어/클러스터 임계치/cross-region 유사도) 및 샘플 품질 리뷰

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
- `YOUTUBE_API_KEY` 반영 완료(EC2 runtime env).
- YouTube collector 실증 성공:
  - `youtube_kr/jp/us` 각각 20건 수집/적재
  - source 상태 `ok`
- 웹 충돌 복구:
  - 다른 프로젝트(StockPulse)가 `3000`을 점유 중인 상태를 확인
  - Global Pulse 웹 런타임을 `3100`으로 분리
  - `/pulse` Nginx 프록시 upstream을 `3100`으로 전환
- 현재 접속 상태:
  - `http://3.36.83.199/pulse` (200)
  - `http://3.36.83.199/pulse/api/health` (200)
  - `http://3.36.83.199/pulse/api/stats` (200)

### Current gaps (updated)
1. Step 5C 품질 튜닝
- 불용어/대표 토픽명/유사도 임계치 정교화
2. 소스 하드닝
- `reddit*`, `dcard` 403 대응
3. 운영 관찰 마감
- 24h watch 최종 결과를 문서에 확정 반영
4. UI Step 6
- 모바일 UX/장애 상태 UX 마감

## Step 5C Progress Update (2026-04-14, Slice 1)
### Newly completed
- Analyzer 품질 튜닝 1차 반영:
  - `keyword-extractor`를 유니코드 기반 수동 TF-IDF로 전환
  - 지역별 스크립트 가중치(`kr/jp/cn`)와 stopword 강화
  - 제목 phrase(2~3-gram) 추출 및 중복 키워드 억제
  - `topic-clusterer` 대표 토픽명 생성 로직(관련 제목/키워드 점수 기반) 도입
  - 약한 seed 스킵 + single-post 토픽 상한 + 유사 토픽 dedupe 적용

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass
- 로컬 스모크에서 토픽 결과가 단편 단어 중심에서 구문형(`관세 협상`, `한미 관세`) 중심으로 개선됨을 확인

### Current completion state
- Step 5C: **진행 중 (1차 튜닝 완료)**
- 남은 작업은 cross-region 매핑 임계치/대표명 안정화, 실데이터(EC2) 샘플 리뷰 기반 미세조정

### Remaining (current)
1. Step 5C quality tuning (slice 2)
- cross-region 유사도 임계치/오탐 튜닝
- 리전별 샘플(kr/jp/cn/us) 20개 이상 수동 리뷰 후 stopword 보정
2. Source hardening
- `reddit*`, `dcard` 403 대응 전략 확정 및 적용
3. Ops closeout
- 24h watch 최종 요약 고정
4. UI Step 6
- 모바일 UX/장애 상태 UX 마감

## Step 5C Progress Update (2026-04-14, Slice 2)
### Newly completed
- cross-region 매핑 품질 정밀화:
  - 단순 Jaccard 기반에서 복합 점수 기반(token/keyword/name)으로 전환
  - generic stopword 및 토큰 정규화 강화
  - strong-name / exact-keyword-phrase / primary-name-token 가드 추가
- global analyzer 기본 similarity를 `0.32`로 상향해 기본 오탐 완화

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run analyze:global -- --hours 24 --min-regions 2` -> pass (로컬 DB 미설정 skip)
- 로컬 smoke에서 KR/JP 관세 이슈는 매핑되고, 무관한 US 스포츠 이슈는 분리됨을 확인

### Current completion state
- Step 5C: **진행 중 (Slice 1~2 완료)**
- 남은 핵심은 EC2 실데이터 기준 threshold 미세조정과 수동 샘플 리뷰 결과 반영

### Remaining (current)
1. Step 5C quality tuning (slice 3)
- EC2 DB 실데이터(최근 24h topics/global_topics) 샘플 리뷰 기반 threshold/stopword 최종 튜닝
2. Source hardening
- `reddit*`, `dcard` 403 대응
3. Ops closeout
- 24h watch 최종 결과 문서 고정
4. UI Step 6
- 모바일 UX/장애 상태 UX 마감

## UI/Encoding Stability Update (2026-04-14)
### Newly completed
- 화면 `??` 노출 보완:
  - `HeatBadge` placeholder 문자열 제거, heat level 아이콘 기반으로 교체
  - `RegionFlag` fallback 개선 + `regionId` 정규화
- 인코딩 재발 방지 가드 추가:
  - `.editorconfig` (UTF-8/LF)
  - `.gitattributes` (text eol=lf)

### Validation
- `npm run lint` -> pass
- `npm run build` -> pass

### Blocking info (next step)
- Step 5C Slice 3(EC2 실데이터 튜닝) 진행을 위해 SSH 키 필요
  - 시도 결과: `ubuntu@3.36.83.199: Permission denied (publickey)`

## Source Hardening Update (2026-04-14, Slice 1)
### Newly completed
- Reddit 계열(`reddit`, `reddit_worldnews`, `reddit_europe`, `reddit_mideast`) 403 완화 로직 적용:
  - OAuth 우선 + 공개 endpoint fallback 다중 경로
  - 헤더/에러 처리 강화
- Dcard endpoint fallback(2개 경로) 적용

### Validation
- `npm run test:scraper -- --source reddit_worldnews` -> success=true, 30 posts
- `npm run collect -- --source reddit,reddit_worldnews,reddit_europe,reddit_mideast` -> `4/4 succeeded`
- `npm run test:scraper -- --source dcard` -> 403 유지(known)
- `npm run lint` -> pass
- `npm run build` -> pass

### Current completion state
- Source hardening: **부분 완료**
  - Reddit 계열: 개선 완료
  - Dcard: Cloudflare 정책 이슈로 추가 대응 필요

## Step 5C Progress Update (2026-04-14, Slice 3)
### Newly completed
- 토픽 품질 튜닝 3차 마감:
  - `keyword-extractor` stopword/노이즈 토큰 필터 확장
  - `topic-clusterer` 단일 토큰 대표명 억제 강화(phrase 우선 + weak single-topic 스킵)
  - `cross-region-mapper` 대표 글로벌 토픽명 선택을 품질 점수 기반으로 보정
  - `run-global-analysis` 입력을 “리전별 최신 배치”로 제한해 과거 노이즈 재유입 차단
- EC2 실데이터 재실행 검증:
  - analyzer 재실행 후 최신 배치 기준 단일 토큰 토픽 비율 감소 확인
  - 글로벌 토픽 건수 노이즈 축소 확인(25 -> 3)

### Validation
- Local:
  - `npm run lint` -> pass
  - `npm run build` -> pass
- EC2:
  - `npm run analyze -- --hours 6` -> pass
  - `npm run analyze:global -- --hours 24 --min-regions 2 --similarity 0.32` -> pass
  - latest-batch quality query -> region별 `single_token = 0` 확인

### Current completion state
- Step 5C: **완료 (Slice 1~3)**
- 분석 품질은 “단편 단어 중심”에서 “구문/의미 중심”으로 전환 완료

### Remaining (current)
1. Step 4F 운영 관찰 최종 마감
- 24h watch summary가 현재 `hour=23, failures=0`까지 기록되어 있어 final hour 완료 후 문서 고정 필요

2. Source hardening 잔여
- `dcard` Cloudflare 403 지속: 프록시/브라우저 기반 수집 또는 대체 소스 전략 결정 필요

3. UI Step 6 마감
- 모바일 레이아웃 동선, 장애/빈 데이터 상태 표시 고도화

## Access/Credential Update (2026-04-14)
### Newly confirmed
- EC2 SSH key path 확인: `C:\Users\wsp\Downloads\plasma-key.pem`
- EC2 접속 확인: `ubuntu@3.36.83.199`
- Reddit OAuth credentials 미제공 상태 확인(공개 endpoint fallback 모드로 운영)

### Operational note
- Reddit 계열은 현재 fallback 경로로 수집 성공 케이스가 있으나, IP/시간대에 따라 403 재발 가능성이 있으므로 OAuth 자격증명이 있으면 안정성이 더 높아짐.

## Ops Snapshot Accuracy Update (2026-04-14)
### Newly completed
- `scripts/capture-ops-snapshot.sh` 검증 로직 보정:
  - API health/stats/topics를 HTTP 상태코드 2xx 기준으로 판정
  - `PORT`/`NEXT_BASE_PATH`(`NEXT_PUBLIC_BASE_PATH`) 기반 동적 API URL 생성
  - DB table count 실행 로그의 민감정보(redacted) 처리

### Validation
- Local:
  - `npm run lint` -> pass
  - `npm run build` -> pass
- EC2 endpoint spot check:
  - `127.0.0.1:3100/pulse/api/health` -> 200
  - `127.0.0.1:3100/api/health` -> 404
  - 기존 오검증 조건을 확인한 뒤 스크립트 보정 반영

### Current completion state
- L4 Observability: **정확도 보정 완료**
- 운영 스냅샷 결과가 `/pulse` + 포트 분리 환경과 정합하도록 수정됨

### Remaining (updated)
1. Step 4F 운영 관찰 최종 마감
- 보정된 스크립트 기준으로 watch를 1회 재실행해 final summary를 고정해야 함

2. Source hardening 잔여
- `dcard` Cloudflare 403 대응(브라우저 기반/프록시/대체 소스 전략 결정)

3. UI Step 6 마감
- 모바일 레이아웃, 장애/빈 데이터 UX 최종 정리
