# GLOBAL PULSE - 전 세계 커뮤니티 & SNS 여론 모니터링 대시보드

> 원본 작성일: 2026-04-12
> 보관 목적: 프로젝트 최초 요구사항(초기 프롬프트) 영구 보관

## 프로젝트 개요

"Global Pulse"는 전 세계 주요 인터넷 커뮤니티와 SNS에서 실시간으로 핫 토픽을 수집·분석·시각화하는 서버리스 웹 애플리케이션이다.

핵심 가치:
- 한국 디시인사이드, 일본 5ch, 미국 Reddit 같은 일반 커뮤니티의 실시간 화제를 한눈에 시각화
- 동일 이슈가 국가별로 어떻게 다르게 반응하는지 비교
- 공식 뉴스가 아닌 사용자 여론의 온도계를 제공

## 기술 스택 (전부 무료 티어)

### 프론트엔드
- Next.js 14+ (App Router)
- Vercel (무료)
- Tailwind CSS + CSS Variables
- Recharts 또는 D3.js
- react-simple-maps
- Framer Motion
- Lucide React
- Google Fonts (Space Mono, Noto Sans KR/JP, JetBrains Mono)

### 백엔드 / 데이터 수집
- GitHub Actions schedule 크론
- Cloudflare Workers (보조 크론)
- Supabase PostgreSQL
- TF-IDF(`natural`) + Gemini API 요약
- cheerio + axios / puppeteer-core + @sparticuz/chromium
- TypeScript 전면 적용

## 디렉토리 구조(원 요구사항)

- `.github/workflows`: 리전별 수집 + SNS 수집 + 토픽 분석 + 글로벌 분석
- `packages/collector`: 스크래퍼/유틸/타입/실행 엔트리
- `packages/analyzer`: 키워드/클러스터/감성/요약/크로스리전
- `packages/shared`: 공통 타입/상수/regions/supabase
- `app`: Next.js App Router 페이지 + API 라우트
- `components`: layout/dashboard/region/topic/shared/charts
- `lib`: API 래퍼 + hooks + utils
- `supabase/migrations`: 테이블/인덱스
- `scripts`: setup/seed/test

## 데이터 모델 핵심 테이블

- `regions`: 리전 메타
- `sources`: 사이트 메타(스크랩 대상/주기)
- `raw_posts`: 수집 원문 메타(제목/조회/추천/댓글)
- `topics`: 리전별 분석 결과
- `global_topics`: 크로스 리전 글로벌 이슈
- `heat_history`: 시계열 열기 데이터
- `region_snapshots`: 대시보드 요약 캐시

## 핵심 계산/분석 규칙

### Heat Score
- `post_weight = view*0.1 + like*2 + comment*1.5 + dislike*0.5`
- `time_decay = exp(-0.1 * hours_since_posted)`
- `source_weight`: 디시 1.2, 레딧 1.3, 그 외 1.0
- 결과 정규화 범위: `0~2000`

### 키워드/토픽
- 최근 N시간 게시글 제목 기반 TF-IDF
- 불용어 제거
- 공출현(co-occurrence) 기반 토픽 그룹화
- heat_score 순으로 rank 부여

### Gemini 요약
- topic별 `name_ko/name_en/summary_ko/summary_en/sentiment/category` JSON 반환
- 마크다운 없이 순수 JSON 강제

## 스크래퍼 요구사항 요약

### 한국
- `dcinside`: User-Agent 필수, 요청 딜레이 1~3초
- `fmkorea`: XE 구조 기준 파싱
- `clien`: referer/https 고려

### 일본
- `5ch`: 인코딩(EUC-JP) 유의
- `hatena`: RSS 우선

### 대만
- `PTT`: `over18=1` 쿠키
- `Dcard`: 공식성 높은 JSON API 활용

### 중국
- `weibo`: hotSearch JSON
- `zhihu`: SPA 대응(puppeteer/대체 API)
- `bilibili`: 공개 랭킹 API

### 미국
- `reddit`: JSON API
- `4chan`: 공식 API
- `hackernews`: topstories + item 병렬

### SNS
- `youtube`, `telegram`, `mastodon`, `tiktok`, `threads`, `bilibili`

## UI/UX 요구사항 요약

컨셉:
- "Command Center / Mission Control"
- 다크 베이스 + 네온 액센트
- 데이터 밀도 높지만 가독성 유지

페이지:
- 메인 대시보드: World Heat Map + Region Cards + Hot Ticker + Global Issues
- 리전 상세: 토픽 랭킹/상세/감성/출처/추이/소스 상태
- 글로벌 이슈: 리전별 감성 비교 및 확산 경로
- 타임라인: 토픽 전파 시계열

애니메이션:
- 지도 점등, 티커 무한 스크롤, 실시간 pulse, 랭킹 변동, 차트 드로우 등

반응형:
- Desktop / Tablet / Mobile 별 레이아웃 정의

## API 요구사항 요약

- `GET /api/topics?region=&limit=&offset=&sort=&period=`
- `GET /api/global-topics?limit=&minRegions=`
- `GET /api/regions`
- `GET /api/timeline?topic=&region=&hours=`
- `GET /api/search?q=&region=`
- `GET /api/stats`

## 환경 변수

- Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- Google: `YOUTUBE_API_KEY`, `GEMINI_API_KEY`
- Telegram: `TELEGRAM_BOT_TOKEN`
- Reddit(optional): `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`
- Next public: `NEXT_PUBLIC_*`

## Phase 1 MVP 체크리스트

1. 프로젝트 초기화
2. 한국 3개 스크래퍼 구현
3. NLP 분석 파이프라인 구현
4. 프론트 MVP 구현
5. 확장(레딧/유튜브/Gemini/다른 리전)

## 운용 원칙

- ISR/SWR/캐시 테이블로 성능 최적화
- 수집 실패시 `sources.last_error` 갱신
- RLS 활성화 + 키 비공개
- 원문 전문 저장 지양(저작권 리스크 최소화)
- robots.txt 가능한 범위 준수

## 실행 지침(원 프롬프트의 마지막 요청)

- 한 번에 전부 구현하지 말고 Phase/Step 단위로 진행
- 이전 Step 결과를 다음 Step 컨텍스트에 포함
- UI 구현 시 디자인 시스템 규칙 유지
- 스크래퍼 구현 전 실제 DOM 확인 후 셀렉터 작성
- 구현 후 `npx tsx scripts/test-scraper.ts --source {sourceId}` 테스트 필수
