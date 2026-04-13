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
