# GLOBAL PULSE — 통합 실행 프롬프트 (Master)

> 문서 버전: v2026-04-13
> 문서 목적: 에이전트 실행 프롬프트 단일화(중복 프롬프트 통합)
> 적용 대상: Codex / Claude / Cursor 등 코딩 에이전트
> 아키텍처 기준: **Single EC2 + PostgreSQL (PostgreSQL-only runtime)**
> 인코딩 정책: **UTF-8 (한글 깨짐 방지)**

---

## 0) 문서 사용 규칙 (중요)

1. 이 문서가 Global Pulse 구현/운영의 **유일한 마스터 프롬프트**다.
2. 과거 프롬프트(`INITIAL_PROMPT_GLOBAL_PULSE_EC2.md` 등)는 보조/참조용으로만 둔다.
3. 작업은 항상 Step 단위로 진행한다.
4. 각 Step 종료 시 아래 6개를 반드시 기록한다.
   - 변경 파일 목록
   - Before -> After
   - 실행 명령어
   - 테스트/검증 결과
   - 잔여 이슈/리스크
   - 다음 Step
5. 모든 변경은 `docs/PATCH_NOTES.md`, `docs/DELIVERY_STATUS.md`에 누적 기록한다.
6. 한글 파일은 UTF-8로 저장하고, 저장 후 한글 깨짐 여부를 반드시 확인한다.

---

## 1) 역할 정의

너는 시니어 풀스택 + 데브옵스 엔지니어다.
목표는 단일 EC2 환경에서 Global Pulse를 안정적으로 운영 가능한 상태로 완성하는 것이다.

핵심 원칙:

1. 한 번에 전부 구현하지 말고 Step 단위로 진행
2. 애매하면 합리적 가정을 명시하고 진행
3. 크롤러는 셀렉터 작성 전에 실제 DOM/응답 확인
4. 페이지 요청에서 실시간 스크래핑 금지, DB 조회만 사용
5. 웹 요청 처리와 배치 수집/분석 작업 분리
6. TypeScript strict 유지
7. 운영 기준은 PostgreSQL-only, Supabase runtime 의존 금지
8. systemd timer를 운영 스케줄의 source-of-truth로 사용

---

## 2) 프로젝트 개요

Global Pulse는 전 세계 커뮤니티/SNS의 핫토픽을 수집·분석·시각화하는 여론 모니터링 대시보다.

핵심 가치:

- 뉴스가 아닌 일반 사용자 커뮤니티 반응을 중심으로 추적
- 동일 이슈의 국가별 반응(감성/열기) 비교
- 시계열 흐름(어느 지역에서 먼저 발생하고 어디로 확산되는지) 제공

---

## 3) 아키텍처 결정 (확정)

### 3.1 운영 토폴로지

- 단일 EC2(Ubuntu 22.04 LTS, 권장 t3.medium+)
- Nginx -> Next.js(127.0.0.1:3000)
- PostgreSQL 로컬 설치(외부 5432 비노출)
- 배치(collector/analyzer/snapshot/cleanup/backup)는 systemd service + timer

### 3.2 포함 구성요소

- Next.js App Router 웹/ API
- collector 배치
- analyzer 배치
- 로컬 PostgreSQL
- Nginx 리버스 프록시
- systemd unit/timer
- 백업/정리 스크립트
- 운영 증적(evidence) 수집 스크립트

### 3.3 금지/제거 대상

- Vercel 운영 전제
- Cloudflare Workers cron 운영 전제
- GitHub Actions schedule 운영 전제
- Supabase runtime/DB 의존
- 요청 시점 서버리스 실행 모델

### 3.4 허용 범위

- GitHub: 소스 저장소/PR/CI 용도
- GitHub Actions: lint/test CI 용도(선택)
- 외부 API: Gemini, YouTube, Reddit(optional), Telegram/Mastodon 등 최소 범위

---

## 4) 기술 스택

### 프론트엔드

- Next.js 14+ (App Router)
- React + TypeScript
- Tailwind CSS + CSS Variables
- Recharts (필요 시 D3 일부)
- react-simple-maps
- Framer Motion
- Lucide React
- Fonts: Space Mono, Noto Sans KR, Noto Sans JP, JetBrains Mono

### 백엔드/수집/분석

- Node.js 20 LTS
- TypeScript strict
- PostgreSQL + `pg`
- zod, pino, axios, cheerio, puppeteer-core, iconv-lite, natural, date-fns/dayjs
- Gemini API(선택)

### 운영

- Nginx
- systemd/service/timer
- bash deploy, backup, health check scripts

---

## 5) 디렉토리 기준 (현재 운영형)

```text
.
├─ app/
│  ├─ api/
│  │  ├─ topics/route.ts
│  │  ├─ global-topics/route.ts
│  │  ├─ regions/route.ts
│  │  ├─ timeline/route.ts
│  │  ├─ search/route.ts
│  │  ├─ stats/route.ts
│  │  ├─ topic/[topicId]/route.ts
│  │  └─ health/route.ts
│  ├─ page.tsx
│  ├─ region/[regionId]/page.tsx
│  ├─ topic/[topicId]/page.tsx
│  ├─ timeline/page.tsx
│  └─ global-issues/page.tsx
├─ components/
├─ lib/
│  ├─ db/
│  ├─ logger/
│  └─ validators/
├─ packages/
│  ├─ collector/
│  ├─ analyzer/
│  └─ shared/
├─ db/
│  ├─ migrations/
│  └─ schema/
├─ infra/
│  ├─ nginx/
│  └─ systemd/
├─ scripts/
│  ├─ run-collector.ts
│  ├─ run-analyzer.ts
│  ├─ build-snapshots.ts
│  ├─ cleanup-old-data.ts
│  ├─ deploy-ec2.sh
│  ├─ backup-db.sh
│  ├─ health-check.sh
│  ├─ capture-ops-snapshot.sh
│  └─ run-ops-watch-window.sh
└─ docs/
   ├─ PATCH_NOTES.md
   ├─ DELIVERY_STATUS.md
   ├─ operations.md
   ├─ deployment-ec2.md
   └─ evidence/
```

---

## 6) 데이터 모델 (핵심 테이블)

운영 기준 테이블:

- `regions`
- `sources`
- `raw_posts`
- `topics`
- `global_topics`
- `heat_history`
- `region_snapshots`

핵심 인덱스:

- `raw_posts(source_id, collected_at desc)`
- `topics(region_id, heat_score desc)`
- `topics(region_id, created_at desc)`
- `global_topics(total_heat_score desc)`
- `heat_history(region_id, recorded_at desc)`
- `region_snapshots(region_id, snapshot_at desc)`

데이터 보존:

- `raw_posts` 30일 정리
- `topics/global_topics`는 `expires_at` 기준 정리

---

## 7) 분석 규칙 (확정)

### 7.1 Heat Score

```ts
post_weight = viewCount * 0.1 + likeCount * 2.0 + commentCount * 1.5 + dislikeCount * 0.5

time_decay = exp(-0.1 * hours_since_posted)

source_weight = 1.2 (dcinside) | 1.3 (reddit) | 1.0 (others)

heat_score = normalize( sum(post_weight * time_decay * source_weight), 0..2000 )
```

### 7.2 키워드/토픽

1. 최근 N시간 `raw_posts.title` 수집
2. 언어권별 형태소/토큰화
3. 불용어 제거
4. TF-IDF + engagement 가중치
5. 공출현(co-occurrence) 기반 토픽 클러스터링
6. heat_score 내림차순 랭킹

### 7.3 감성

- 기본: rule-based/keyword 기반
- 확장: Gemini 보정 가능
- 범위: `-1.0 ~ +1.0`

### 7.4 크로스리전 매핑

- `name_en + keywords` 유사도(Jaccard 등)로 그룹핑
- 유사도 임계치 이상을 글로벌 토픽으로 묶음
- `first_seen_region/at`, `regional_sentiments`, `regional_heat_scores` 기록

### 7.5 Gemini 요약 (선택)

입력: 토픽별 키워드/대표 제목/heat
출력(JSON only):

- `name_ko`
- `name_en`
- `summary_ko`
- `summary_en`
- `sentiment`
- `category`

---

## 8) 수집 소스 요구사항 (우선순위)

### 8.1 KR (우선)

- dcinside (UA 필수, delay 필수)
- fmkorea
- clien

### 8.2 US (우선)

- reddit (/r/all, /r/worldnews)
- 4chan
- hackernews

### 8.3 SNS (점진 확장)

- YouTube KR/JP/US
- Mastodon
- Telegram
- Bilibili

### 8.4 기타 리전 (2차)

- JP: 5ch, hatena
- TW: ptt, dcard
- CN: weibo, zhihu, tieba
- EU/ME: reddit 기반 채널

스크래퍼 구현 공통 규칙:

1. `BaseScraper` 상속
2. 결과 타입 표준화(`ScrapedPost[]`)
3. 오류 시 graceful failure + source status 업데이트
4. 타임아웃/재시도/UA 로테이션 적용
5. 과도한 동시성 금지(특히 Chromium 계열)

---

## 9) API 계약 (유지)

- `GET /api/topics?region=...&limit=...&offset=...&sort=...&period=...`
- `GET /api/global-topics?limit=...&minRegions=...`
- `GET /api/regions`
- `GET /api/timeline?topic=...&region=...&hours=...`
- `GET /api/topic/{topicId}`
- `GET /api/search?q=...&region=...`
- `GET /api/stats`
- `GET /api/health`

규칙:

1. 페이지는 API 응답 + DB 기반 렌더링만 수행
2. API 응답 포맷 호환성 유지
3. 에러 응답은 명시적 상태코드와 메시지 제공

---

## 10) UI/UX 시스템 (MVP 기준)

컨셉: Command Center / Mission Control

- 다크 베이스 + 네온 액센트
- 고밀도 데이터 + 높은 가독성
- 월드 히트맵 + 리전 카드 + 핫토픽 티커 + 글로벌 이슈

주요 페이지:

1. 메인 대시보드
2. 리전 상세
3. 토픽 상세
4. 글로벌 이슈
5. 타임라인

반응형:

- Desktop: 지도 + 카드 분할
- Tablet: 지도 축소 + 카드 2열
- Mobile: 단일 컬럼 중심

애니메이션:

- 지도 점등
- ticker 무한 스크롤
- 숫자 카운트업
- 카드 hover lift
- pulse indicator

---

## 11) 환경 변수 (PostgreSQL-only 기준)

필수:

- `DATABASE_URL` 또는
  - `DB_HOST`
  - `DB_PORT`
  - `DB_NAME`
  - `DB_USER`
  - `DB_PASSWORD`

선택:

- `GEMINI_API_KEY`
- `YOUTUBE_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `NEXT_PUBLIC_APP_URL`

주의:

- Supabase 키는 운영 필수값이 아님(레거시 참조용만 허용)

---

## 12) 배치 스케줄 기준 (systemd timers)

권장 주기:

- collector(kr): 15m
- collector(us): 30m
- collector(others/sns): 30~120m
- analyzer(regional): 1h
- analyzer(global): 3h
- snapshot: 1h
- cleanup: 1d
- backup: 1d

모든 배치는 web 프로세스와 독립적으로 실패/재시작 가능해야 한다.

---

## 13) 검증 기준 (기본 1회)

기본 정책:

- 검증 기본값은 `ROUNDS=1`
- strict mode 필요 시에만 `ROUNDS=3`

필수 검증 명령:

1. `npm run lint`
2. `npm run build`
3. `npm run ops:supabase:audit`
4. `npm run ops:supabase:budget -- --print-json`
5. `npm run ops:verify3:check -- --print-json`

완료 조건:

- lint/build pass
- fallback audit/budget pass
- closure check `issues=[]`

---

## 14) 기록 규칙 (Patch-note style)

모든 Step 완료 시 아래 포맷을 `PATCH_NOTES`에 추가:

- Version ID: `GP-YYYYMMDD-XX`
- Before -> After
- Main File Changes
- Commands / Validation
- Known Risks
- Rollback Guide

`DELIVERY_STATUS`에는 아래를 갱신:

- Current completion state
- Remaining(current)
- Next priority step

---

## 15) 현재 진행 상태 요약 (2026-04-13 기준)

완료:

- PostgreSQL-only runtime 전환(코드 경로 기준)
- Supabase fallback audit baseline `0`
- single-run closure policy(`ROUNDS=1`) 정착
- EC2 systemd timer 기반 운영 루프 활성화
- 운영 관찰(ops snapshot/watch) 스크립트 도입

진행 중:

- 24h 운영 관찰 루프 결과 수집/요약
- EC2 배포 경로를 git checkout 기반으로 정리(현재 일부 수동 반영)

---

## 16) 다음 실행 우선순위

1. Prompt 단일화 유지
- 신규 작업은 이 문서만 기준으로 진행
- 중복 프롬프트 추가 생성 금지

2. 운영 관찰 마감
- `docs/evidence/ops-monitoring/*` 결과 요약
- 실패/지연 패턴 정리

3. 배포 경로 정리
- EC2 `/srv/projects/project2/global-pulse`를 git clone 기반으로 전환
- remote/push/pull 체계 고정

4. 기능 확장(필요 시)
- JP/TW/CN 소스 점진 확장
- SNS 안정화

---

## 17) 에이전트 실행 템플릿

매 Step 종료 응답 템플릿:

1. Step 이름
2. 변경 파일
3. 실행 명령
4. 검증 결과
5. 리스크/가정
6. 다음 Step

문서 업데이트 순서:

1. 코드/스크립트 수정
2. 검증 실행
3. `PATCH_NOTES` 업데이트
4. `DELIVERY_STATUS` 업데이트

---

## 18) 인코딩/문서 품질 체크리스트

1. 모든 `.md`, `.ts`, `.tsx`, `.sql` 파일 UTF-8 저장
2. 한글 제목/본문 깨짐 여부 확인
3. 터미널 출력 깨짐은 코드페이지 이슈인지 파일 인코딩 이슈인지 분리 확인
4. 한글 깨짐 재발 시 UTF-8 no-BOM으로 재저장 후 diff 확인

---

## 19) 과거 프롬프트 처리 정책

- `docs/INITIAL_PROMPT_GLOBAL_PULSE_EC2.md`는 레거시 포인터 문서로 유지
- 과거 상세 요구사항은 본 문서에 통합 반영 완료
- 이후 변경은 본 문서에만 누적

---

## 20) 최종 지시

앞으로 Global Pulse 구현/운영 요청은 이 문서를 기준으로 수행한다.
작업 단위는 항상 Step이며, 결과는 누적 문서화하고, 검증 가능한 상태로 남긴다.