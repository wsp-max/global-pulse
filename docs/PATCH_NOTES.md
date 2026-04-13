# Global Pulse Patch Notes (Cumulative)

## 기록 원칙
- 버전 ID 형식: `GP-YYYYMMDD-XX`
- 각 버전은 다음 항목을 반드시 기록:
  - `Before -> After`
  - 변경 파일(핵심 + 영향 범위)
  - 실행/검증 명령
  - 남은 이슈
  - 복구 가이드(해당 시점으로 되돌리는 방법)
- 권장 Git 체크포인트 규칙:
  - 해당 버전 완료 시 `git commit -m "GP-YYYYMMDD-XX ..."` 생성
  - 필요 시 `git tag GP-YYYYMMDD-XX`
  - 복구는 `git checkout <tag>` 또는 `git revert <commit>` 기준으로 수행
- 이 문서는 누적 관리한다. 기존 항목은 삭제하지 않는다.

## 버전 히스토리 요약
| Version | Date | Scope | Status |
|---|---|---|---|
| GP-20260412-01 | 2026-04-12 | Step 1 프로젝트 초기화/모노레포 스캐폴드 | Done |
| GP-20260412-02 | 2026-04-12 | Step 2 한국 3개 스크래퍼 + 수집 저장 연결 | Done |
| GP-20260412-03 | 2026-04-12 | Step 3 분석 파이프라인 + DB write 연결 | Done |
| GP-20260412-04 | 2026-04-12 | Step 4 API 실데이터 연결 + 대시보드/리전 바인딩 | Done |
| GP-20260412-05 | 2026-04-12 | 인코딩 복구/기록 체계 도입 | Done |
| GP-20260412-06 | 2026-04-12 | Step 4 마무리: 토픽 상세/타임라인 실데이터화 + 비교 UI | Done |
| GP-20260412-07 | 2026-04-12 | Step 5 확장: Reddit + YouTube KR 수집 파이프라인 연결 | Done |
| GP-20260412-08 | 2026-04-12 | Step 5 확장: Gemini 토픽 요약 파이프라인(옵션) 연동 | Done |
| GP-20260412-09 | 2026-04-12 | Step 5 확장: US/Youtube 추가 소스 + 진행현황 문서화 | Done |
| GP-20260412-10 | 2026-04-12 | Step 5 검증 마감: 추가 소스 실주행 확인 + 남은 범위 정리 | Done |
| GP-20260412-11 | 2026-04-12 | Step 5 연계: 글로벌 토픽 자동생성 실행기 + 워크플로우 연결 | Done |
| GP-20260412-12 | 2026-04-12 | Step 5 확장 4차: Fourchan + EU/ME Reddit 수집 연결 | Done |
| GP-20260414-51 | 2026-04-14 | Step 5C 분석 품질 1차 튜닝 (단편 키워드/토픽명 개선) | Done |
| GP-20260414-52 | 2026-04-14 | Step 5C 분석 품질 2차 튜닝 (cross-region 매핑 정밀화) | Done |
| GP-20260414-53 | 2026-04-14 | UI `??` 노출 제거 + UTF-8 저장 규칙 고정 | Done |

---

## GP-20260412-01 (Step 1: Foundation)
### Before -> After
- Before:
  - 빈 작업 디렉토리
- After:
  - Next.js + Tailwind 기반 앱 생성
  - `packages/shared|collector|analyzer` 모노레포 구조 생성
  - `supabase/migrations`, `scripts`, `.github/workflows` 기본 파일 생성
  - 기본 UI 스캐폴드, API route 스텁 생성

### 주요 변경 파일
- 루트: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- 앱: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- 패키지:
  - `packages/shared/src/{types,constants,regions,supabase,index}.ts`
  - `packages/collector/src/**`
  - `packages/analyzer/src/**`
- DB: `supabase/migrations/{001_create_tables.sql,002_create_indexes.sql}`
- 워크플로우: `.github/workflows/*.yml`
- 스크립트: `scripts/{setup-supabase,seed-regions,test-scraper}.ts`

### 검증
- `npm run lint` 통과
- `npm run build` 통과

### 남은 이슈
- 스크래퍼/분석 로직은 당시 다수 스텁 상태

### 복구 가이드
- Step1 기준 복구 시:
  - 스크래퍼/분석기 구현 파일에서 스텁 상태 확인
  - 실데이터 연동 코드가 없는지 API route 기준으로 확인

---

## GP-20260412-02 (Step 2: Korea Scrapers)
### Before -> After
- Before:
  - 한국 스크래퍼 3종(`dcinside`, `fmkorea`, `clien`) 스텁
- After:
  - 실제 DOM 기반 파싱 구현
  - 수집 결과를 `raw_posts` upsert + `sources` 상태 갱신
  - `collect-korea` 워크플로우 동작형으로 조정

### 주요 변경 파일
- 스크래퍼:
  - `packages/collector/src/scrapers/korea/dcinside.ts`
  - `packages/collector/src/scrapers/korea/fmkorea.ts`
  - `packages/collector/src/scrapers/korea/clien.ts`
- 저장 로직:
  - `packages/collector/src/utils/supabase-storage.ts` (신규)
  - `packages/collector/src/run.ts` (persist 연결)
- 상수:
  - `packages/shared/src/constants.ts` (`dcinside` scrape URL 교정)
- 워크플로우:
  - `.github/workflows/collect-korea.yml`

### 검증
- `npm run test:scraper -- --source dcinside`
- `npm run test:scraper -- --source fmkorea`
- `npm run test:scraper -- --source clien`
- `npm run collect:kr`

### 남은 이슈
- 타 리전/타 SNS 스크래퍼는 여전히 스텁

### 복구 가이드
- 한국 수집 동작 기준 확인 포인트:
  - 수집 결과 로그에서 `dcinside/fmkorea/clien` 게시글 수가 0보다 큰지
  - Supabase 키 있을 때 `raw_posts` 삽입되는지

---

## GP-20260412-03 (Step 3: Analyzer Pipeline)
### Before -> After
- Before:
  - 분석기는 샘플 입력 기반 더미 결과
- After:
  - `raw_posts` 조회 -> 키워드 추출(TF-IDF + engagement 가중) -> 토픽 클러스터링 -> heat/sentiment 계산
  - `topics`, `heat_history`, `region_snapshots` write 연결
  - 분석 실행 파라미터(`--region`, `--hours`) 지원

### 주요 변경 파일
- `packages/analyzer/src/keyword-extractor.ts`
- `packages/analyzer/src/topic-clusterer.ts`
- `packages/analyzer/src/sentiment-analyzer.ts`
- `packages/analyzer/src/heat-score-calculator.ts`
- `packages/analyzer/src/run-analysis.ts`
- `.github/workflows/analyze-topics.yml`

### 검증
- `npm run analyze`
- `npm run analyze -- --region kr --hours 6`
- `npm run lint`, `npm run build`

### 남은 이슈
- `gemini-summarizer`, `translator`는 스텁/부분 구현
- `global_topics` 생성(`analyze-global`) 미완

### 복구 가이드
- 분석 기준 확인 포인트:
  - Supabase 환경에서 `topics`와 `region_snapshots`가 누적되는지

---

## GP-20260412-04 (Step 4: API + Front Data Binding)
### Before -> After
- Before:
  - API 라우트 다수 스텁 응답
  - 대시보드/리전 페이지 정적 목업
- After:
  - `topics`, `regions`, `global-topics`, `timeline`, `search`, `stats` API가 Supabase 조회 기반 동작
  - 메인/글로벌/리전 화면이 API 실데이터 바인딩으로 전환
  - region page에서 토픽 선택 및 타임라인 연동

### 주요 변경 파일
- API:
  - `app/api/_shared/{supabase-server,mappers}.ts` (신규)
  - `app/api/{topics,regions,global-topics,timeline,search,stats}/route.ts`
- Hooks/Types:
  - `lib/types/api.ts` (신규)
  - `lib/hooks/{useTopics,useRegion,useGlobalTopics,useRegions,useTimeline}.ts`
- UI:
  - `app/page.tsx`
  - `app/global-issues/page.tsx`
  - `app/region/[regionId]/page.tsx`
  - `components/dashboard/{WorldHeatMap,RegionCard,HotTopicTicker,GlobalIssuePanel}.tsx`
  - `components/region/{RegionPageClient,RegionHeader,TopicList,TopicCard,SourceBreakdown,TrendChart}.tsx`
  - `components/charts/HeatTrendLine.tsx`

### 검증
- `npm run lint`, `npm run build` 통과

### 남은 이슈
- 세계 지도는 현재 simplified heat map (실제 `react-simple-maps` 지오맵 교체 필요)
- 추이 차트는 간소 렌더(실제 `recharts` 영역/라인 차트 고도화 필요)
- topic detail/timeline 페이지 실데이터 정밀 연결 추가 필요

### 복구 가이드
- API 스텁 상태로 되돌려야 할 경우:
  - `app/api/*/route.ts` 에서 정적 JSON 응답으로 회귀
- 프론트 목업 상태로 되돌려야 할 경우:
  - `app/page.tsx`, `components/dashboard/*` 의 데이터 hook 사용 제거

---

## GP-20260412-05 (Encoding Recovery + Patch Logging)
### Before -> After
- Before:
  - 일부 파일 한글/이모지 깨짐(특히 `packages/shared/src/constants.ts`)
  - 누적 변경 이력 문서 부재
- After:
  - `constants.ts` 한글/국기 이모지 원복
  - 누적 버전 기록용 `docs/PATCH_NOTES.md` 도입

### 주요 변경 파일
- `packages/shared/src/constants.ts`
- `docs/PATCH_NOTES.md` (신규)

### 검증
- 인코딩 체크: UTF-8 정상 렌더 확인

### 남은 이슈
- 다른 파일의 깨진 텍스트 재점검 필요
- Step4 미완 항목(지도/차트 고도화) 계속 진행 예정

### 복구 가이드
- 텍스트 깨짐 재발 시:
  - 저장 인코딩을 UTF-8(무BOM)으로 고정
  - `constants.ts`를 본 문서의 GP-20260412-05 기준 값으로 재적용

---

## GP-20260412-06 (Step 4 Completion: Topic Detail + Timeline)
### Before -> After
- Before:
  - `app/topic/[topicId]`는 스텁 컴포넌트 렌더
  - `app/timeline`은 정적 placeholder 페이지
  - `CrossRegionComparison`, `TopicTimeline`, `KeywordCloud`, `RelatedTopics`가 더미 UI
- After:
  - 토픽 상세 API 추가: 글로벌/리전 토픽 ID 모두 처리
  - 토픽 상세 페이지를 실데이터 기반으로 전환 (`TopicPageClient`)
  - 타임라인 페이지를 글로벌 토픽 선택 + 시간범위 필터 기반으로 전환
  - 교차 리전 감성 비교/타임라인/키워드/연관 토픽 컴포넌트 실데이터화
  - `GlobalIssuePanel` 카드에서 토픽 상세 이동 링크 제공

### 주요 변경 파일
- API/타입/훅
  - `app/api/topic/[topicId]/route.ts` (신규)
  - `lib/types/api.ts` (`TopicDetailApiResponse` 추가)
  - `lib/hooks/useTopicDetail.ts` (신규)
  - `lib/hooks/useTimeline.ts` (region optional 지원)
- 페이지/컴포넌트
  - `app/topic/[topicId]/page.tsx`
  - `app/timeline/page.tsx`
  - `components/topic/TopicPageClient.tsx` (신규)
  - `components/topic/CrossRegionComparison.tsx`
  - `components/topic/TopicTimeline.tsx`
  - `components/topic/KeywordCloud.tsx`
  - `components/topic/RelatedTopics.tsx`
  - `components/dashboard/GlobalIssuePanel.tsx`
- 빌드 안정화
  - `types/react-simple-maps.d.ts` (신규)
  - `tsconfig.json` (`**/*.d.ts` include)
  - `components/charts/HeatTrendLine.tsx` (tooltip formatter 타입 보정)

### 검증
- `npm run lint` 통과
- `npm run build` 통과
- 빌드 산출 라우트에 `ƒ /api/topic/[topicId]`, `ƒ /topic/[topicId]`, `○ /timeline` 확인

### 남은 이슈
- `analyze-global` 워크플로우 기반 `global_topics` 데이터가 적을 때 타임라인/상세가 제한적일 수 있음
- 토픽 상세의 타임라인 매칭은 이름 기반 필터이므로, 향후 `topic_ids` 기반 직접 매핑 테이블이 있으면 정확도 개선 가능

### 복구 가이드
- GP-20260412-06 이전(스텁 UI)으로 회귀 시:
  - `app/topic/[topicId]/page.tsx`, `app/timeline/page.tsx`를 placeholder 버전으로 복원
  - `app/api/topic/[topicId]/route.ts` 제거
  - `components/topic/*`에서 데이터 props를 요구하지 않는 스텁 버전 복원

---

## GP-20260412-07 (Step 5: Reddit + YouTube KR Collector)
### Before -> After
- Before:
  - `reddit.ts`, `youtube.ts`가 스텁 반환(`[]`)
  - collector 실행기가 한국 3개 스크래퍼만 고정 실행
  - `collect-us.yml`, `collect-sns-youtube.yml`는 실제 구현 경로와 불일치
- After:
  - `reddit` 수집 구현: `/r/all/hot.json?limit=50` 파싱, score/comment/postedAt 추출
  - `youtube_kr` 수집 구현: YouTube Data API v3 호출, 통계/메타데이터 추출
  - collector 실행기 필터 확장: `--region`, `--type`, `--source` 지원
  - 테스트 스크립트에 `reddit`, `youtube_kr` 추가
  - 워크플로우 정렬:
    - Korea: `--region kr --type community`
    - US: `--region us --type community`
    - YouTube: `--source youtube_kr` + `YOUTUBE_API_KEY`

### 주요 변경 파일
- 스크래퍼 구현
  - `packages/collector/src/scrapers/us/reddit.ts`
  - `packages/collector/src/scrapers/sns/youtube.ts`
- 실행기/테스트/익스포트
  - `packages/collector/src/run.ts`
  - `scripts/test-scraper.ts`
  - `packages/collector/src/index.ts`
  - `package.json` (collect scripts 추가)
- 워크플로우
  - `.github/workflows/collect-korea.yml`
  - `.github/workflows/collect-us.yml`
  - `.github/workflows/collect-sns-youtube.yml`
- 문서
  - `README.md`

### 검증
- 스크래퍼 테스트
  - `npm run test:scraper -- --source reddit` 성공 (50 posts 수집)
  - `npm run test:scraper -- --source youtube_kr` 실패 확인 (예상: `YOUTUBE_API_KEY is missing.`)
- 실행기 테스트
  - `npm run collect:us` 성공 (`reddit` 50 posts)
  - `npm run collect:youtube:kr` 실패 확인 (예상: API 키 미설정)
- 품질 게이트
  - `npm run lint` 통과
  - `npm run build` 통과

### 남은 이슈
- YouTube 수집은 GitHub Secrets/로컬 env에 `YOUTUBE_API_KEY`가 없으면 실패함
- `reddit_worldnews`, `hackernews`, 기타 SNS는 아직 미구현/스텁 상태

### 복구 가이드
- GP-20260412-07 이전(US/SNS 미연결 상태)으로 회귀 시:
  - `packages/collector/src/scrapers/us/reddit.ts`, `packages/collector/src/scrapers/sns/youtube.ts`를 스텁 버전으로 복원
  - `packages/collector/src/run.ts`에서 `--type/--source` 필터 및 신규 스크래퍼 등록 제거
  - 관련 workflow의 실행 커맨드를 이전 값으로 복원

---

## GP-20260412-08 (Step 5: Gemini Summarization Integration)
### Before -> After
- Before:
  - `gemini-summarizer.ts`는 고정 placeholder 요약만 반환
  - 분석 파이프라인에서 Gemini 사용 경로가 없음
- After:
  - Gemini API(`gemini-1.5-flash`) 호출 기반 토픽 요약/이름/sentiment 보정 구현
  - 분석 실행기에서 `--with-gemini` 옵션으로 선택적 요약 실행 지원
  - Gemini 실패 시 자동 fallback(기존 토픽 유지) 처리
  - 8시간 간격 Gemini 분석 워크플로우 추가

### 주요 변경 파일
- 분석기
  - `packages/analyzer/src/gemini-summarizer.ts`
  - `packages/analyzer/src/run-analysis.ts`
- 워크플로우/스크립트/문서
  - `.github/workflows/analyze-topics-gemini.yml` (신규)
  - `package.json` (`analyze:gemini` script 추가)
  - `README.md` (analyzer 명령 섹션 업데이트)

### 검증
- 분석 실행
  - `npm run analyze -- --region kr --hours 6` 실행 확인
  - `npm run analyze:gemini -- --region kr --hours 6` 실행 확인
  - 로컬에서는 Supabase 미설정으로 "Skipping analysis run" 로그 확인(예상 동작)
- 품질 게이트
  - `npm run lint` 통과
  - `npm run build` 통과

### 남은 이슈
- Gemini 요약은 `GEMINI_API_KEY` + Supabase 환경이 있을 때만 실제 write 반영됨
- `analyze-global`(global_topics 자동 생성)와의 완전 연동은 후속 단계

### 복구 가이드
- GP-20260412-08 이전(placeholder 요약)으로 회귀 시:
  - `packages/analyzer/src/gemini-summarizer.ts`를 스텁 버전으로 복원
  - `run-analysis.ts`의 `--with-gemini` 분기 제거
  - `analyze-topics-gemini.yml`, `analyze:gemini` 스크립트 제거

---

## GP-20260412-09 (Step 5: Additional Sources + Delivery Tracking)
### Before -> After
- Before:
  - US 수집은 `reddit` 단일 소스 중심
  - YouTube 수집은 `youtube_kr`만 실행
  - 남은 작업/완료선(어디까지 해야 하는지) 문서가 분리되어 있지 않음
- After:
  - `reddit_worldnews` 수집 구현 및 테스트 경로 연결
  - `hackernews` 공식 Firebase API 수집 구현(Top stories + item 병렬 조회)
  - `youtube_jp`, `youtube_us` 수집 추가(파라미터형 `YoutubeScraper`)
  - YouTube 워크플로우가 KR/JP/US 동시 수집으로 확장
  - 남은 작업/완료 기준 문서(`docs/DELIVERY_STATUS.md`) 추가

### 주요 변경 파일
- 스크래퍼
  - `packages/collector/src/scrapers/us/reddit.ts`
  - `packages/collector/src/scrapers/us/hackernews.ts`
  - `packages/collector/src/scrapers/sns/youtube.ts`
- 실행기/테스트/스크립트
  - `packages/collector/src/run.ts`
  - `scripts/test-scraper.ts`
  - `packages/collector/src/index.ts`
  - `package.json` (`collect:youtube:global`)
- 워크플로우/문서
  - `.github/workflows/collect-sns-youtube.yml`
  - `README.md`
  - `docs/DELIVERY_STATUS.md` (신규)

### 검증
- 스크래퍼 테스트(예정/실행)
  - `npm run test:scraper -- --source reddit_worldnews`
  - `npm run test:scraper -- --source hackernews`
  - `npm run test:scraper -- --source youtube_jp` / `youtube_us` (API 키 필요)
- 실행기 테스트(예정/실행)
  - `npm run collect:us` (reddit + reddit_worldnews + hackernews)
  - `npm run collect:youtube:global` (youtube_kr/jp/us, API 키 필요)
- 품질 게이트
  - `npm run lint`
  - `npm run build`

### 남은 이슈
- YouTube 멀티리전 수집은 `YOUTUBE_API_KEY` 없으면 실패
- `fourchan`, `reddit_europe`, `reddit_mideast` 등은 아직 스텁

### 복구 가이드
- GP-20260412-09 이전으로 회귀 시:
  - `reddit_worldnews/hackernews/youtube_jp/us` 생성 코드 제거
  - `collect-sns-youtube.yml` 커맨드를 `youtube_kr` 단일 수집으로 복원
  - `docs/DELIVERY_STATUS.md` 제거 또는 이전 문서 상태로 복원

---

## GP-20260412-10 (Step 5: Validation Closure + Remaining Scope)
### Before -> After
- Before:
  - 신규 수집 소스는 코드 반영 상태였지만, 실주행 로그와 완료 범위 문서 반영이 미완
- After:
  - 신규 소스 실주행 검증 완료(US 3소스 성공, YouTube JP/US 키 미설정 실패 경로 확인)
  - `DELIVERY_STATUS`에 진행률/최근 검증/남은 우선순위 업데이트
  - Step 5 확장 3차 범위를 완료 처리하고 다음 집중 영역을 `cross-region-mapper`로 고정

### 주요 변경 파일
- `docs/DELIVERY_STATUS.md`
- `docs/PATCH_NOTES.md`

### 검증
- 성공:
  - `npm run test:scraper -- --source reddit_worldnews`
  - `npm run test:scraper -- --source hackernews`
  - `npm run collect:us` (3/3 성공)
  - `npm run lint`
  - `npm run build` (폰트 네트워크 이슈 1회 후 재실행 성공)
- 예상 실패:
  - `npm run test:scraper -- --source youtube_jp`
  - `npm run test:scraper -- --source youtube_us`
  - `npm run collect:youtube:global`
  - 사유: `YOUTUBE_API_KEY` 미설정

### 남은 이슈
- Google Font 원격 다운로드가 간헐적으로 build 변동 요인일 수 있음(재시도 시 정상 통과)
- `cross-region-mapper`/`analyze-global` 실연동이 아직 핵심 잔여 과제

### 복구 가이드
- GP-20260412-10 이전 상태로 회귀 시:
  - 문서 변경(`DELIVERY_STATUS`, 본 항목)만 되돌리면 코드 영향 없음

---

## GP-20260412-11 (Step 5: Global Topic Auto-Generation Wiring)
### Before -> After
- Before:
  - `cross-region-mapper`는 단순 이름 매칭 수준
  - `analyze-global.yml`이 실제로는 `run-analysis.ts`를 실행하고 있어 `global_topics` 생성 파이프라인이 분리되어 있지 않음
  - API에서 `expires_at` 지난 글로벌 토픽도 노출 가능
- After:
  - `cross-region-mapper`를 토큰/Jaccard 기반 리전 간 유사도 매핑으로 교체
  - `run-global-analysis.ts` 신설:
    - 최근 토픽 조회
    - 크로스 리전 매핑
    - 기존 active 글로벌 토픽 만료 처리
    - 신규 `global_topics` insert
  - `analyze-global.yml`을 전용 글로벌 분석 실행기로 교체
  - `/api/global-topics`에서 `expires_at` 기준 active 토픽만 조회

### 주요 변경 파일
- 분석기/스크립트
  - `packages/analyzer/src/cross-region-mapper.ts`
  - `packages/analyzer/src/run-global-analysis.ts` (신규)
  - `package.json` (`analyze:global` script 추가)
- 워크플로우/API/문서
  - `.github/workflows/analyze-global.yml`
  - `app/api/global-topics/route.ts`
  - `README.md`
  - `docs/DELIVERY_STATUS.md`

### 검증
- `npm run analyze:global -- --hours 24 --min-regions 2 --similarity 0.3`
  - 로컬 env에서는 Supabase 미설정으로 skip 로그 확인(예상 동작)
- `npm run lint` 통과
- `npm run build` 통과

### 남은 이슈
- 운영 Supabase 환경에서 `global_topics` 생성/만료 사이클 실데이터 검증 필요
- 현재 mapper는 텍스트 유사도 기반이므로 후속 단계에서 토픽 ID 기반 매핑 신뢰도 개선 필요

### 복구 가이드
- GP-20260412-11 이전으로 회귀 시:
  - `run-global-analysis.ts` 제거 및 `analyze-global.yml` 실행 커맨드를 이전 상태로 복원
  - `cross-region-mapper.ts`를 단순 매핑 버전으로 복원
  - `/api/global-topics`의 `expires_at` 필터 제거

---

## GP-20260412-12 (Step 5: Fourchan + EU/ME Source Expansion)
### Before -> After
- Before:
  - `fourchan`, `reddit_europe`, `reddit_mideast`가 스텁 상태
  - 유럽/중동 워크플로우는 실행해도 실수집 소스가 부족한 상태
- After:
  - `fourchan` 공식 catalog API 기반 수집 구현
  - `reddit_europe`, `reddit_mideast` 수집 구현(공통 Reddit 파서 재사용)
  - collector 실행기에 EU/ME/US 신규 소스 연결
  - `collect:eu`, `collect:me` 스크립트 추가
  - `collect-europe.yml`, `collect-mideast.yml`를 커뮤니티 수집 명령으로 정리

### 주요 변경 파일
- 스크래퍼/실행기
  - `packages/collector/src/scrapers/us/reddit.ts`
  - `packages/collector/src/scrapers/us/fourchan.ts`
  - `packages/collector/src/scrapers/europe/reddit-europe.ts`
  - `packages/collector/src/scrapers/mideast/reddit-mideast.ts`
  - `packages/collector/src/run.ts`
  - `scripts/test-scraper.ts`
  - `packages/collector/src/index.ts`
- 스크립트/워크플로우/문서
  - `package.json` (`collect:eu`, `collect:me` 추가)
  - `.github/workflows/collect-europe.yml`
  - `.github/workflows/collect-mideast.yml`
  - `README.md`
  - `docs/DELIVERY_STATUS.md`

### 검증
- `npm run test:scraper -- --source reddit_europe` 성공
- `npm run test:scraper -- --source reddit_mideast` 성공
- `npm run test:scraper -- --source fourchan` 성공
- `npm run collect:eu` 성공 (1/1)
- `npm run collect:me` 성공 (1/1)
- `npm run collect:us` 성공 (4/4: reddit/worldnews/fourchan/hackernews)
- `npm run lint` 통과
- `npm run build` 통과

### 남은 이슈
- EU/ME는 현재 Reddit 기반 소스 중심이라 리전 대표성 보강 필요
- SNS 확장(`mastodon`, `bilibili`, `telegram`)은 후속 구현 필요

### 복구 가이드
- GP-20260412-12 이전으로 회귀 시:
  - `fourchan`, `reddit_europe`, `reddit_mideast` 연결 코드 제거
  - `collect:eu`, `collect:me` 스크립트 제거
  - `collect-europe.yml`, `collect-mideast.yml` 실행 커맨드 복원

---

## 현재 진행 중(Next)
1. 운영 Supabase에서 `analyze:global` 실데이터 검증 및 품질 보정
2. SNS 확장(`mastodon`, `bilibili`, `telegram`) 운영 안정화
3. 토픽 연관도 정확도 향상을 위한 전용 매핑 테이블(토픽 ID 기반) 설계

---

## GP-20260412-13 (EC2 Pivot Step 1: Infra Bootstrap)
### Before -> After
- Before:
  - Runtime/operations assumptions were serverless-first (GitHub schedule + Supabase runtime dependency).
  - No EC2 systemd/nginx/bootstrap script set in repository.
- After:
  - Added single-EC2 operations scaffolding (systemd services/timers, nginx reverse proxy, deploy/backup/health scripts).
  - Added `/api/health` endpoint for runtime probing.
  - Added EC2 runbooks (`architecture`, `deployment-ec2`, `operations`).
  - Added workspace + directory scaffolding for EC2 migration target.

### Main File Changes
- Infra:
  - `infra/nginx/global-pulse.conf`
  - `infra/systemd/global-pulse-*.service`
  - `infra/systemd/global-pulse-*.timer`
- Ops scripts:
  - `scripts/run-collector.ts`
  - `scripts/run-analyzer.ts`
  - `scripts/build-snapshots.ts`
  - `scripts/cleanup-old-data.ts`
  - `scripts/health-check.ts`
  - `scripts/deploy-ec2.sh`
  - `scripts/backup-db.sh`
  - `scripts/health-check.sh`
- App/API:
  - `app/api/health/route.ts`
  - `app/global/page.tsx`
  - `app/regions/[region]/page.tsx`
  - `app/search/page.tsx`
- Config/docs:
  - `pnpm-workspace.yaml`
  - `.env.example`
  - `README.md`
  - `docs/architecture.md`
  - `docs/deployment-ec2.md`
  - `docs/operations.md`
  - `docs/source-notes/README.md`

### Commands / Validation
- Executed:
  - `npm run lint` (pass)
  - `npm run build` (pass; first retry had transient Google Fonts fetch failure)
  - `npm run ops:collector -- --source reddit_worldnews` (pass; collection ok, persistence skipped without Supabase env)
  - `npm run ops:analyzer -- --hours 6` (pass; graceful skip without Supabase env)
  - `npm run ops:snapshot -- --hours 24` (pass; graceful skip without Supabase env)
  - `npm run ops:cleanup` (pass; graceful skip without Supabase env)
  - `npm run health` (expected fail in local validation because web server was not running)

### Known Risks
- DB runtime is still Supabase SDK based in this step.
- Full local PostgreSQL adapter migration is deferred to next step.

### Rollback Guide
- To rollback EC2 bootstrap scope:
  - remove `infra/`, new `scripts/*` ops files, new EC2 docs, and route aliases
  - revert `package.json`, `.env.example`, `README.md`
  - keep existing serverless flow unchanged

---

## GP-20260412-14 (EC2 Pivot Step 2A: PostgreSQL Adapter + API Runtime Bridge)
### Before -> After
- Before:
  - API routes depended only on Supabase SDK for DB reads.
  - Local PostgreSQL path existed in docs/infra only, not at API runtime.
- After:
  - Added PostgreSQL adapter module (`pg` pool) in shared package.
  - Added API-side runtime bridge: local PostgreSQL first, Supabase fallback.
  - Migrated API routes to support PostgreSQL read path:
    - `/api/health`
    - `/api/stats`
    - `/api/regions`
    - `/api/topics`
    - `/api/global-topics`
    - `/api/timeline`
    - `/api/search`
    - `/api/topic/[topicId]`
  - Added provider telemetry in responses (`postgres`, `supabase`, `none`).
  - Fixed health-check script so degraded(503) can be accepted during transition.

### Main File Changes
- DB adapter foundation:
  - `packages/shared/src/postgres.ts`
  - `packages/shared/package.json` (subpath export `./postgres`)
  - `app/api/_shared/postgres-server.ts`
- API migration:
  - `app/api/health/route.ts`
  - `app/api/stats/route.ts`
  - `app/api/regions/route.ts`
  - `app/api/topics/route.ts`
  - `app/api/global-topics/route.ts`
  - `app/api/timeline/route.ts`
  - `app/api/search/route.ts`
  - `app/api/topic/[topicId]/route.ts`
  - `app/api/_shared/mappers.ts` (numeric coercion hardening)
- Ops adjustment:
  - `scripts/health-check.ts`

### Commands / Validation
- `npm install pg @types/pg --legacy-peer-deps`
- `npm run lint` (pass)
- `npm run build` (pass)
- API live probe with temporary server:
  - `/api/health` -> degraded + provider info (expected without DB env)
  - `/api/stats`, `/api/regions`, `/api/topics`, `/api/global-topics`, `/api/timeline`, `/api/search`, `/api/topic/1` all responded without runtime crash
- `npm run ops:collector -- --source reddit_worldnews` (pass)
- `npm run ops:analyzer -- --hours 6` (pass; graceful skip without Supabase env)
- `npm run health` against temporary server (pass in degraded mode)

### Known Risks
- Batch layer (`collector/analyzer/snapshot/cleanup`) still writes via Supabase SDK path.
- Full PostgreSQL write migration is not completed in this step.
- Local PostgreSQL path is read-oriented in API first, then batch migration follows.

### Rollback Guide
- Remove PostgreSQL bridge by reverting:
  - `packages/shared/src/postgres.ts`
  - `app/api/_shared/postgres-server.ts`
  - route-level postgres branches in `app/api/*`
- Keep Supabase-only API behavior by restoring previous route versions.

---

## GP-20260412-15 (EC2 Path Policy: /srv/projects/project2)
### Before -> After
- Before:
  - EC2 operation defaults used `/opt/global-pulse` in systemd and deployment docs/scripts.
- After:
  - Standardized EC2 runtime path to `/srv/projects/project2/global-pulse`.
  - Updated systemd `WorkingDirectory`/`ReadWritePaths`, deploy script defaults, and runbooks.
  - Kept `APP_DIR` override support in deploy script for exceptional cases.

### Main File Changes
- systemd:
  - `infra/systemd/global-pulse-web.service`
  - `infra/systemd/global-pulse-collector.service`
  - `infra/systemd/global-pulse-analyzer.service`
  - `infra/systemd/global-pulse-snapshot.service`
  - `infra/systemd/global-pulse-cleanup.service`
- deploy/docs:
  - `scripts/deploy-ec2.sh`
  - `docs/deployment-ec2.md`
  - `docs/operations.md`
  - `docs/architecture.md`
  - `README.md`

### Commands / Validation
- `rg -n "/opt/global-pulse|/opt/" infra scripts docs README.md -S` (no matches in operational files)
- `npm run lint` (pass)
- `npm run build` (pass)

### Known Risks
- Existing EC2 instances already provisioned under `/opt/global-pulse` must either:
  - move repo to `/srv/projects/project2/global-pulse`, or
  - set `APP_DIR=/opt/global-pulse` when using deploy script and adjust unit files accordingly.

### Rollback Guide
- Revert this patch to restore `/opt/global-pulse` defaults in systemd/docs/scripts.

---

## GP-20260412-16 (EC2 Pivot Step 2B: Batch Write Path PostgreSQL-First)
### Before -> After
- Before:
  - Batch jobs (`collector/analyzer/snapshot/cleanup`) wrote only through Supabase SDK.
  - Local PostgreSQL path existed in API read layer but not in batch write path.
- After:
  - Batch pipelines now support PostgreSQL-first with Supabase fallback.
  - Implemented PostgreSQL write/query paths for:
    - collector persistence (`raw_posts`, `sources`)
    - analyzer region pipeline (`raw_posts` read, `topics`/`heat_history`/`region_snapshots` writes)
    - global analyzer (`topics` read, `global_topics` expire + insert)
    - snapshot builder (`topics` read, `region_snapshots` write)
    - cleanup job (`raw_posts`, `heat_history`, `topics`, `global_topics` cleanup)
  - Added safe runtime fallback behavior:
    - PostgreSQL config missing/failure -> fallback Supabase
    - both unavailable -> graceful skip with explicit log

### Main File Changes
- Collector:
  - `packages/collector/src/utils/supabase-storage.ts`
- Analyzer:
  - `packages/analyzer/src/run-analysis.ts`
  - `packages/analyzer/src/run-global-analysis.ts`
- Operations scripts:
  - `scripts/build-snapshots.ts`
  - `scripts/cleanup-old-data.ts`

### Commands / Validation
- `npm run lint` (pass)
- `npm run build` (pass)
- `npm run ops:collector -- --source reddit_worldnews` (pass)
- `npm run ops:analyzer -- --hours 6 --with-global --global-hours 24` (pass)
- `npm run ops:snapshot -- --hours 24` (pass; graceful skip without DB env)
- `npm run ops:cleanup` (pass; graceful skip without DB env)

### Known Risks
- `scripts/seed-regions.ts` remains Supabase-seeding oriented and is not migrated yet.
- Full production verification against a live local PostgreSQL DB is pending (current checks are code-path + graceful-fallback validations).

### Rollback Guide
- Revert this patch to restore Supabase-only batch behavior in:
  - collector persistence module
  - analyzer run scripts
  - snapshot/cleanup scripts

---

## GP-20260412-17 (EC2 Pivot Step 2C: Seed Script PostgreSQL-First)
### Before -> After
- Before:
  - `scripts/seed-regions.ts` was Supabase-only.
- After:
  - `seed-regions` now supports PostgreSQL-first with Supabase fallback.
  - Added PostgreSQL upsert SQL for `regions` and `sources`.
  - Retained Supabase upsert path for compatibility.

### Main File Changes
- `scripts/seed-regions.ts`

### Commands / Validation
- `npm run lint` (pass)
- `npm run build` (pass)
- Note: live seed execution was not run in this environment because DB credentials are not configured.

### Known Risks
- Live DB-level seed validation on EC2 is still pending and should be executed after env setup.

### Rollback Guide
- Revert `scripts/seed-regions.ts` to Supabase-only flow.

---

## GP-20260412-18 (EC2 Pivot Step 3A: DB Migration Runner + PostgreSQL E2E Verifier)
### Before -> After
- Before:
  - `db/migrations` had placeholders only; no runnable migration pipeline.
  - No single command to verify PostgreSQL E2E flow on EC2.
- After:
  - Added concrete migration SQL files under `db/migrations`.
  - Added migration runner script `scripts/init-db.ts` with `schema_migrations` tracking and checksum validation.
  - Added PostgreSQL verification orchestrator `scripts/verify-postgres-e2e.ts`.
  - Added npm scripts:
    - `db:init`
    - `verify:postgres`
  - Updated README/operations/deployment docs for new flow.

### Main File Changes
- Migrations:
  - `db/migrations/0001_create_tables.sql`
  - `db/migrations/0002_create_indexes.sql`
  - `db/migrations/README.md`
- Scripts:
  - `scripts/init-db.ts`
  - `scripts/verify-postgres-e2e.ts`
- Config/docs:
  - `package.json`
  - `README.md`
  - `docs/operations.md`
  - `docs/deployment-ec2.md`

### Commands / Validation
- `npm run lint` (pass)
- `npm run build` (pass)
- `npm run db:init` (pass; graceful skip because PostgreSQL env is missing in this workspace)
- `npm run verify:postgres -- --skip-jobs` (pass; graceful skip because PostgreSQL env is missing)

### Known Risks
- Live EC2 PostgreSQL runtime validation still required (`verify:postgres` without `--skip-jobs`).
- This environment cannot complete DB-write assertions without actual DB credentials.

### Rollback Guide
- Remove new migration files and scripts, then remove npm script entries (`db:init`, `verify:postgres`).

---

## GP-20260412-19 (EC2 Pivot Step 3B: Backup Timer Wiring)
### Before -> After
- Before:
  - Backup script existed but was not scheduled by systemd timer.
- After:
  - Added backup service/timer units for daily PostgreSQL backup execution.
  - Wired deploy script to install and enable backup timer.
  - Updated health check and ops/deployment docs for backup timer visibility.

### Main File Changes
- infra/systemd:
  - `global-pulse-backup.service`
  - `global-pulse-backup.timer`
- scripts/docs:
  - `scripts/deploy-ec2.sh`
  - `scripts/health-check.sh`
  - `docs/operations.md`
  - `docs/deployment-ec2.md`
  - `docs/architecture.md`

### Commands / Validation
- `npm run lint` (pass)
- `npm run build` (pass)
- `npm run db:init` (pass; graceful skip without PostgreSQL env)
- `npm run verify:postgres -- --skip-jobs` (pass; graceful skip without PostgreSQL env)
- `bash -n scripts/deploy-ec2.sh scripts/backup-db.sh scripts/health-check.sh` (not runnable in this Windows shell because WSL/bash is unavailable)

### Known Risks
- Timer activation verification (`systemctl status global-pulse-backup.timer`) must be performed on EC2 host.

### Rollback Guide
- Remove backup unit files and revert deploy/health/docs references.

---

## GP-20260412-20 (EC2 Pivot Step 3C: API Structured Logging + Script Logger Completion)
### Before -> After
- Before:
  - Batch/ops scripts were mostly migrated to pino, but API routes had no unified request logging.
  - `scripts/test-scraper.ts` and `scripts/setup-supabase.ts` still used `console.*`.
- After:
  - Added API request logging wrapper with per-request `x-request-id` propagation.
  - Wrapped all active API routes with unified start/end/exception logs.
  - Completed script-side logger migration by removing remaining `console.*` calls.

### Main File Changes
- API shared:
  - `app/api/_shared/route-logger.ts` (new)
- API routes:
  - `app/api/health/route.ts`
  - `app/api/stats/route.ts`
  - `app/api/regions/route.ts`
  - `app/api/topics/route.ts`
  - `app/api/global-topics/route.ts`
  - `app/api/search/route.ts`
  - `app/api/timeline/route.ts`
  - `app/api/topic/[topicId]/route.ts`
- Scripts:
  - `scripts/test-scraper.ts`
  - `scripts/setup-supabase.ts`

### Commands / Validation
- `npm run lint` (pass)
- `npm run build` (pass)
- `npm run test:scraper -- --source reddit_worldnews` (pass; pino summary log + JSON payload output)
- `npm run ops:analyzer -- --hours 6 --with-global --global-hours 24` (pass; graceful skip without DB env)
- Runtime API probe on local `next start --port 3010`:
  - `/api/health` -> `503` with `x-request-id` header (expected degraded mode without DB env)
  - `/api/stats`, `/api/regions`, `/api/topics`, `/api/global-topics`, `/api/timeline`, `/api/search`, `/api/topic/1` -> `200` with `x-request-id`
- `rg -n "console\\.(log|error|warn|info|debug)" app lib packages scripts -S` (no matches)

### Known Risks
- Live EC2 journald log verification is still pending (`journalctl -u global-pulse-web -f`).
- Local environment still lacks PostgreSQL credentials, so DB-write assertions remain deferred to host execution.

### Rollback Guide
- Revert `app/api/_shared/route-logger.ts` and route wrapper imports/calls.
- Revert script logger migration in `scripts/test-scraper.ts` and `scripts/setup-supabase.ts`.

---

## GP-20260412-21 (EC2 Pivot Step 3D: Restore Drill Script + Ops Docs Update)
### Before -> After
- Before:
  - Backup creation script existed, but restore drill execution required manual SQL command composition.
  - Runbooks had backup instructions only.
- After:
  - Added `scripts/restore-db.sh` to restore latest/selected backup into a scratch database safely.
  - Added restore drill instructions to operations/deployment docs and README operations section.
  - Added API request-id correlation note in operations runbook.

### Main File Changes
- Scripts:
  - `scripts/restore-db.sh` (new)
- Docs:
  - `docs/operations.md`
  - `docs/deployment-ec2.md`
  - `README.md`

### Commands / Validation
- `npm run lint` (pass)
- `npm run build` (pass)
- Local runtime probe on `next start --port 3010`:
  - `/api/health` -> `503` + `x-request-id`
  - `/api/regions` -> `200` + `x-request-id`
  - `/api/topics?region=kr&limit=3` -> `200` + `x-request-id`
- UTF-8 validation (pass):
  - `docs/INITIAL_PROMPT_GLOBAL_PULSE.md`
  - `docs/INITIAL_PROMPT_GLOBAL_PULSE_EC2.md`
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`
  - `docs/operations.md`
  - `docs/deployment-ec2.md`

### Known Risks
- `scripts/restore-db.sh` cannot be shell-validated in this Windows workspace because `bash`/WSL is unavailable.
- Real restore drill execution and evidence capture must be run on EC2 host with PostgreSQL CLI tools.

### Rollback Guide
- Remove `scripts/restore-db.sh`.
- Revert restore-related additions in operations/deployment/README docs.

---

## GP-20260412-22 (EC2 Pivot Step 3E: Collector Runtime Guardrails)
### Before -> After
- Before:
  - Collector runner executed each source sequentially but had no explicit timeout/memory guardrails.
  - Browser-like source protection was not codified at runner level.
- After:
  - Added per-source timeout controls in collector runner:
    - default source timeout
    - browser-like source timeout override
  - Added memory budget check (`RSS`) before each source run.
  - Added explicit guardrail logging per source execution.
  - Added environment knobs to `.env.example` and operations docs.

### Main File Changes
- Collector runtime:
  - `packages/collector/src/run.ts`
- Config/docs:
  - `.env.example`
  - `docs/operations.md`

### Commands / Validation
- `npm run lint` (pass)
- `npm run build` (pass)
- `npm run collect -- --source reddit_worldnews` (pass)
  - verified guardrail log output:
    - `timeout=90000ms`
    - `rss_limit=1536MB`
- Existing no-DB environment behavior preserved (graceful persistence skip).

### Known Risks
- Current browser-like detection is source-id heuristic based.
- No active Chromium scraper is registered in this workspace yet, so browser-specific runtime behavior is not fully exercised.

### Rollback Guide
- Revert guardrail additions in `packages/collector/src/run.ts`.
- Remove `COLLECTOR_*` env keys from `.env.example` and docs.

---

## GP-20260412-23 (EC2 Pivot Step 3F: Supabase Fallback Kill-Switch + Cutover Runbook)
### Before -> After
- Before:
  - Supabase fallback paths were always attempted when PostgreSQL was unavailable.
  - No explicit runtime switch existed for post-cutover PostgreSQL-only mode.
- After:
  - Added runtime kill-switch:
    - `ENABLE_SUPABASE_FALLBACK=false` disables server-side Supabase service client path.
  - Added helper export:
    - `isSupabaseServiceFallbackEnabled()`
  - API Supabase accessor now short-circuits when fallback is disabled.
  - Added cutover runbook for PostgreSQL-only transition evidence capture.

### Main File Changes
- Shared/runtime:
  - `packages/shared/src/supabase.ts`
- API shared:
  - `app/api/_shared/supabase-server.ts`
- Config/docs:
  - `.env.example`
  - `docs/operations.md`
  - `docs/deployment-ec2.md`
  - `docs/supabase-cutover-checklist.md` (new)
  - `README.md`

### Commands / Validation
- `npm run lint` (pass)
- `npm run build` (pass)
- Fallback flag function probe:
  - `ENABLE_SUPABASE_FALLBACK=false` -> `isSupabaseServiceFallbackEnabled()` returns `false`
  - `ENABLE_SUPABASE_FALLBACK=true` -> returns `true`
- Runtime API probe with fallback disabled (`next start --port 3012`):
  - `/api/health` -> `503` + `x-request-id` (expected degraded mode without DB env)
  - `/api/stats`, `/api/regions`, `/api/topics?region=kr&limit=3` -> `200` + `x-request-id`
- UTF-8 validation (pass):
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`
  - `docs/supabase-cutover-checklist.md`
  - `docs/operations.md`
  - `docs/INITIAL_PROMPT_GLOBAL_PULSE.md`
  - `docs/INITIAL_PROMPT_GLOBAL_PULSE_EC2.md`

### Known Risks
- This step adds a controlled disable switch but does not remove legacy Supabase code paths yet.
- Full cutover evidence still requires EC2 host execution with real PostgreSQL env.

### Rollback Guide
- Set `ENABLE_SUPABASE_FALLBACK=true` in env.
- Revert updates in:
  - `packages/shared/src/supabase.ts`
  - `app/api/_shared/supabase-server.ts`
  - docs/config additions related to the new flag.

---

## GP-20260412-24 (EC2 Pivot Step 3G: Cutover Evidence Bundle Automation)
### Before -> After
- Before:
  - EC2 cutover validation commands were documented but executed manually one by one.
  - Evidence logs had to be copied and organized manually.
- After:
  - Added single-entry evidence capture script:
    - `scripts/capture-cutover-evidence.sh`
  - Script collects:
    - `db:init`
    - `verify:postgres`
    - systemd status
    - API probes (including headers)
    - journald snapshots
    - backup/restore drill outputs (optional toggle)
  - Outputs are persisted to timestamped directory:
    - `docs/evidence/cutover/<timestamp>/`
    - summary at `summary.txt`

### Main File Changes
- Scripts:
  - `scripts/capture-cutover-evidence.sh` (new)
- Docs/config:
  - `package.json` (`ops:evidence`)
  - `docs/supabase-cutover-checklist.md`
  - `docs/operations.md`
  - `docs/deployment-ec2.md`
  - `docs/evidence/README.md` (new)
  - `README.md`

### Commands / Validation
- `npm run lint` (pass)
- `npm run build` (pass)
- `npm run verify:postgres -- --skip-jobs` (pass; expected skip without PostgreSQL env)

### Known Risks
- `scripts/capture-cutover-evidence.sh` requires bash/systemd/journalctl and cannot be executed in this Windows workspace.
- Full evidence generation must be run on EC2 host.

### Rollback Guide
- Remove `scripts/capture-cutover-evidence.sh`.
- Remove `ops:evidence` from `package.json`.
- Revert evidence-related docs references.

---

## GP-20260412-25 (EC2 Pivot Step 3H: Evidence Report Generator)
### Before -> After
- Before:
  - Evidence bundle (`summary.txt` + logs) required manual interpretation and manual patch-note formatting.
- After:
  - Added evidence report generator:
    - `scripts/generate-evidence-report.ts`
  - New command:
    - `npm run ops:evidence:report`
  - Generates `REPORT.md` from latest or specified evidence bundle with:
    - parsed command outcomes
    - failure count
    - ready-to-paste patch-note snippet

### Main File Changes
- Scripts:
  - `scripts/generate-evidence-report.ts` (new)
- Config/docs:
  - `package.json` (`ops:evidence:report`)
  - `docs/supabase-cutover-checklist.md`
  - `docs/operations.md`
  - `docs/evidence/README.md`
  - `README.md`

### Commands / Validation
- `npm run ops:evidence:report -- --dir docs/evidence/cutover/20990101_000000 --print` (pass with temporary fixture)
  - validated parsed output + `REPORT.md` generation behavior
  - temporary fixture removed after verification
- `npm run lint` (pass)
- `npm run build` (pass)

### Known Risks
- This script depends on the output format of `scripts/capture-cutover-evidence.sh`.
- If summary format changes, parser updates are required.

### Rollback Guide
- Remove `scripts/generate-evidence-report.ts`.
- Remove `ops:evidence:report` from `package.json`.
- Revert evidence-report references in docs.

---

## GP-20260412-26 (EC2 Pivot Step 3I: Final 3x Verification Automation)
### Before -> After
- Before:
  - Final closure gate required running evidence collection manually three times.
  - No standardized loop output for final sign-off.
- After:
  - Added final verification loop script:
    - `scripts/run-final-verification-3x.sh`
  - New command:
    - `npm run ops:verify3`
  - Script orchestrates:
    - 3 rounds of cutover evidence capture + evidence report generation
    - per-round status logging
    - final summary with pass/fail counts
  - Final evidence output:
    - `docs/evidence/final-verification/<timestamp>/summary.txt`

### Main File Changes
- Scripts:
  - `scripts/run-final-verification-3x.sh` (new)
- Config/docs:
  - `package.json` (`ops:verify3`)
  - `docs/operations.md`
  - `docs/supabase-cutover-checklist.md`
  - `docs/evidence/README.md`
  - `README.md`

### Commands / Validation
- `npm run lint` (pass)
- `npm run build` (pass)
- Note:
  - `ops:verify3` cannot be executed in this Windows workspace because bash/systemd are unavailable.
  - It is intended for EC2 host execution.

### Known Risks
- Depends on `scripts/capture-cutover-evidence.sh` output format and EC2 service availability.
- If a round sleeps long (`SLEEP_SECONDS`), total execution time is substantial.

### Rollback Guide
- Remove `scripts/run-final-verification-3x.sh`.
- Remove `ops:verify3` from `package.json`.
- Revert final-verification references in docs.

---

## GP-20260412-27 (EC2 Pivot Step 3J: Final Verification Report Generator)
### Before -> After
- Before:
  - `ops:verify3` produced `summary.txt` and logs, but closure formatting for patch notes remained manual.
- After:
  - Added final verification report generator:
    - `scripts/generate-final-verification-report.ts`
  - New command:
    - `npm run ops:verify3:report`
  - Generates:
    - `docs/evidence/final-verification/<timestamp>/FINAL_REPORT.md`
  - Includes:
    - closure state (PASS/FAIL)
    - per-round status
    - patch-note snippet template

### Main File Changes
- Scripts:
  - `scripts/generate-final-verification-report.ts` (new)
- Config/docs:
  - `package.json` (`ops:verify3:report`)
  - `docs/operations.md`
  - `docs/supabase-cutover-checklist.md`
  - `docs/evidence/README.md`
  - `docs/deployment-ec2.md`
  - `README.md`

### Commands / Validation
- `npm run ops:verify3:report -- --dir docs/evidence/final-verification/20990101_010000 --print` (pass with temporary fixture)
  - validated parse + `FINAL_REPORT.md` generation
  - temporary fixture removed after verification
- `npm run lint` (pass)
- `npm run build` (pass)

### Known Risks
- Parser assumes `run-final-verification-3x.sh` summary key format.
- If summary key names change, parser update is required.

### Rollback Guide
- Remove `scripts/generate-final-verification-report.ts`.
- Remove `ops:verify3:report` from `package.json`.
- Revert final-report references in docs.

---

## GP-20260413-28 (EC2 Pivot Step 3K: Final Report Import Automation)
### Before -> After
- Before:
  - Even after generating `FINAL_REPORT.md`, updating `PATCH_NOTES.md` and `DELIVERY_STATUS.md` remained manual.
- After:
  - Added import script:
    - `scripts/apply-final-verification-report.ts`
  - New command:
    - `npm run ops:verify3:apply -- --report <FINAL_REPORT.md>`
  - Supports:
    - `--dry-run` preview mode
    - automatic append blocks for patch notes and delivery status

### Main File Changes
- Scripts:
  - `scripts/apply-final-verification-report.ts` (new)
- Config/docs:
  - `package.json` (`ops:verify3:apply`)
  - `docs/operations.md`
  - `docs/supabase-cutover-checklist.md`

### Commands / Validation
- `npm run ops:verify3:apply -- --report docs/evidence/final-verification/20990101_020000/FINAL_REPORT.md --dry-run` (pass with temporary fixture)
  - validated generated append blocks for both docs
  - temporary fixture removed after verification
- `npm run lint` (pass)
- `npm run build` (pass)

### Known Risks
- Parser expects the current `FINAL_REPORT.md` snippet format.
- If final report structure changes, parser rules must be updated.

### Rollback Guide
- Remove `scripts/apply-final-verification-report.ts`.
- Remove `ops:verify3:apply` from `package.json`.
- Revert related operation/checklist references.

---

## GP-20260413-29 (EC2 Pivot Step 3L: One-Shot Closure Runner + Auto-Report Resolve)
### Before -> After
- Before:
  - Closure flow required manual chaining and explicit final report path.
  - `ops:verify3:apply` required `--report` input every time.
- After:
  - Added one-shot closure script:
    - `scripts/complete-closure.sh`
  - New command:
    - `npm run ops:closure`
  - Enhanced apply script:
    - auto-resolves latest `docs/evidence/final-verification/*/FINAL_REPORT.md` when `--report` is omitted
    - duplicate-import guard (skip if already applied unless `--force`)
    - dynamic patch note key (`GP-FINAL-<verification_timestamp>`)

### Main File Changes
- Scripts:
  - `scripts/complete-closure.sh` (new)
  - `scripts/apply-final-verification-report.ts`
- Config/docs:
  - `package.json` (`ops:closure`)
  - `docs/operations.md`
  - `docs/supabase-cutover-checklist.md`
  - `docs/deployment-ec2.md`
  - `docs/evidence/README.md`
  - `README.md`

### Commands / Validation
- `npm run ops:verify3:apply -- --dry-run` (pass with temporary fixture, auto-resolve confirmed)
- `npm run lint` (pass)
- `npm run build` (pass)
- Note:
  - `ops:closure` is bash/systemd dependent and should be executed on EC2 host.

### Known Risks
- Auto-resolve chooses the latest lexicographically sorted final-verification directory.
- If evidence naming convention changes, resolver logic should be updated.

### Rollback Guide
- Remove `scripts/complete-closure.sh`.
- Remove `ops:closure` from `package.json`.
- Revert auto-resolve/duplicate-guard changes in `scripts/apply-final-verification-report.ts`.

---

## GP-20260413-30 (EC2 Pivot Step 3M: Closure Consistency Checker)
### Before -> After
- Before:
  - Closure flow generated artifacts and appended docs, but consistency validation was manual.
- After:
  - Added closure checker:
    - `scripts/check-closure-state.ts`
  - New command:
    - `npm run ops:verify3:check`
  - Validates:
    - final summary vs `FINAL_REPORT.md` (`failures`, timestamp/run_dir coherence)
    - expected closure state/failure thresholds
    - optional doc marker presence in `PATCH_NOTES.md` and `DELIVERY_STATUS.md`
  - Integrated into one-shot closure:
    - `scripts/complete-closure.sh` now runs `ops:verify3:check`.

### Main File Changes
- Scripts:
  - `scripts/check-closure-state.ts` (new)
  - `scripts/complete-closure.sh`
- Config/docs:
  - `package.json` (`ops:verify3:check`)
  - `docs/operations.md`
  - `docs/supabase-cutover-checklist.md`
  - `docs/deployment-ec2.md`
  - `docs/evidence/README.md`
  - `README.md`

### Commands / Validation
- `npm run ops:verify3:check -- --dir docs/evidence/final-verification/20990101_040000 --skip-docs --print-json` (pass with temporary fixture)
  - validated parser and issue detection output
  - temporary fixture removed after verification
- `npm run lint` (pass)
- `npm run build` (pass)

### Known Risks
- For full doc-marker validation, real EC2-applied report path markers are required.
- If final summary/report formats change, parser updates are needed.

### Rollback Guide
- Remove `scripts/check-closure-state.ts`.
- Remove `ops:verify3:check` from `package.json`.
- Revert closure-check references in scripts/docs.

---

## GP-20260413-31 (EC2 Pivot Step 3N: Closure Preflight Validation)
### Before -> After
- Before:
  - Closure command could fail late due to missing prerequisites (files/commands/systemd assumptions).
- After:
  - Added preflight validator:
    - `scripts/closure-preflight.ts`
  - New command:
    - `npm run ops:closure:preflight`
  - Integrated preflight into one-shot closure runner:
    - `scripts/complete-closure.sh` now starts with `ops:closure:preflight`
  - Added skip/debug options for local dry checks:
    - `--skip-systemd`
    - `--skip-env`
    - `--print-json`

### Main File Changes
- Scripts:
  - `scripts/closure-preflight.ts` (new)
  - `scripts/complete-closure.sh`
- Config/docs:
  - `package.json` (`ops:closure:preflight`)
  - `docs/operations.md`
  - `docs/supabase-cutover-checklist.md`
  - `docs/deployment-ec2.md`
  - `docs/evidence/README.md`
  - `README.md`

### Commands / Validation
- `npm run ops:closure:preflight -- --skip-systemd --skip-env --print-json` (pass)
- `npm run lint` (pass)
- `npm run build` (pass)

### Known Risks
- Full systemd/toolchain checks require EC2 Linux runtime; local Windows check uses skip flags.
- Command detection behavior depends on shell command availability (`bash`, `curl`, etc.).

### Rollback Guide
- Remove `scripts/closure-preflight.ts`.
- Remove `ops:closure:preflight` from `package.json`.
- Revert preflight references in closure/docs.

---

## GP-20260413-32 (EC2 Pivot Step 3O: Closure Tooling Self-Test)
### Before -> After
- Before:
  - Closure tooling scripts were individually validated, but end-to-end tooling consistency required manual sequence testing.
- After:
  - Added closure tooling self-test script:
    - `scripts/self-test-closure-tooling.ts`
  - New command:
    - `npm run ops:closure:selftest`
  - Self-test flow:
    - creates temporary cutover/final-verification fixtures
    - runs report generation scripts
    - runs apply script in dry-run mode
    - runs closure state checker (`--skip-docs`)
    - runs preflight checker in local mode (`--skip-systemd --skip-env`)
    - cleans up fixtures by default

### Main File Changes
- Scripts:
  - `scripts/self-test-closure-tooling.ts` (new)
- Config/docs:
  - `package.json` (`ops:closure:selftest`)
  - `docs/operations.md`
  - `docs/supabase-cutover-checklist.md`
  - `docs/deployment-ec2.md`
  - `docs/evidence/README.md`
  - `README.md`

### Commands / Validation
- `npm run ops:closure:selftest` (pass)
- `npm run lint` (pass)
- `npm run build` (pass)

### Known Risks
- Self-test validates tooling integration, not real EC2 systemd/runtime behavior.
- Real closure acceptance still depends on EC2 host execution.

### Rollback Guide
- Remove `scripts/self-test-closure-tooling.ts`.
- Remove `ops:closure:selftest` from `package.json`.
- Revert self-test references in docs.

---

## GP-20260413-33 (EC2 Pivot Step 3P: Supabase Retirement Audit Automation)
### Before -> After
- Before:
  - Supabase fallback removal scope had to be identified manually with ad-hoc search.
- After:
  - Added automated Supabase fallback audit script:
    - `scripts/audit-supabase-fallback.ts`
  - New command:
    - `npm run ops:supabase:audit`
  - Generates structured inventory report:
    - `docs/source-notes/supabase-fallback-audit.md`
  - Report includes:
    - match counts by key pattern
    - categorized references (API / Batch / Shared)
    - suggested retirement order checklist

### Main File Changes
- Scripts:
  - `scripts/audit-supabase-fallback.ts` (new)
- Config/docs:
  - `package.json` (`ops:supabase:audit`)
  - `docs/operations.md`
  - `docs/supabase-cutover-checklist.md`
  - `README.md`
  - generated: `docs/source-notes/supabase-fallback-audit.md`

### Commands / Validation
- `npm run ops:supabase:audit` (pass)
  - generated report with `total_matches: 53`
  - type counts:
    - `createSupabaseServiceClient: 26`
    - `getSupabaseServiceClientOrNull: 17`
    - `ENABLE_SUPABASE_FALLBACK: 5`
    - `SUPABASE_ENV: 5`
- `npm run ops:closure:selftest` (pass; closure tooling chain still healthy)
- `npm run lint` (pass)
- `npm run build` (pass)

### Known Risks
- Audit is pattern-based and may include non-runtime references that still need human review.
- Removal should remain staged after EC2 closure acceptance.

### Rollback Guide
- Remove `scripts/audit-supabase-fallback.ts`.
- Remove `ops:supabase:audit` from `package.json`.
- Revert audit command references in docs.

---

## GP-20260413-34 (EC2 Pivot Step 3Q: Supabase Fallback Budget Guard)
### Before -> After
- Before:
  - Supabase fallback references were auditable, but there was no regression guard to prevent count increase.
- After:
  - Added baseline budget file:
    - `docs/source-notes/supabase-fallback-budget.json`
  - Added budget check script:
    - `scripts/check-supabase-fallback-budget.ts`
  - New command:
    - `npm run ops:supabase:budget`
  - Guard behavior:
    - fails if total or per-pattern fallback reference count exceeds baseline budget.

### Main File Changes
- Scripts:
  - `scripts/check-supabase-fallback-budget.ts` (new)
- Docs/config:
  - `docs/source-notes/supabase-fallback-budget.json` (new)
  - `package.json` (`ops:supabase:budget`)
  - `docs/operations.md`
  - `docs/supabase-cutover-checklist.md`
  - `README.md`

### Commands / Validation
- `npm run ops:supabase:budget -- --print-json` (pass)
  - budget/current both matched:
    - total: `53`
    - `createSupabaseServiceClient: 26`
    - `getSupabaseServiceClientOrNull: 17`
    - `ENABLE_SUPABASE_FALLBACK: 5`
    - `SUPABASE_ENV: 5`
- `npm run ops:closure:selftest` (pass)
- `npm run lint` (pass)
- `npm run build` (pass)

### Known Risks
- Budget is a numeric guard and does not guarantee semantic retirement progress.
- Budget file should be intentionally updated only after approved staged removals.

### Rollback Guide
- Remove `scripts/check-supabase-fallback-budget.ts`.
- Remove `docs/source-notes/supabase-fallback-budget.json`.
- Remove `ops:supabase:budget` from `package.json`.

---

## GP-20260413-35 (EC2 Pivot Step 3R: Revalidation Pass + EC2 Boundary Clarification)
### Before -> After
- Before:
  - Step 3Q까지 구현/기록은 있었지만, 최신 요청 기준으로 검증 재실행 결과와 실패/복구 이력이 누적 정리되어 있지 않았다.
  - `ops:verify3`/`ops:closure`의 EC2 전용 실행 경계가 진행 기록에 명시적으로 고정되어 있지 않았다.
- After:
  - 최신 검증 재실행 결과를 누적 확정:
    - `npm run ops:closure:selftest` (pass)
    - `npm run ops:supabase:budget -- --print-json` (pass)
    - `npm run lint` (pass)
    - `npm run build` (pass)
    - `npm run ops:closure:preflight -- --skip-systemd --skip-env --print-json` (pass)
    - `npm run ops:closure:selftest -- --keep-fixtures` (pass)
    - `npm run ops:verify3:check -- --dir docs/evidence/final-verification/SELFTEST_1776027904047 --skip-docs --expected-state PASS --expected-failures 0 --print-json` (pass)
  - 검증 중 1회 실패 이력도 기록:
    - `ops:verify3:check`를 삭제된 self-test fixture 경로로 실행하여 `Final verification directory not found` 실패
    - `--keep-fixtures` 재실행 후 동일 체크 pass로 복구
  - 최종 단계 경계 명확화:
    - `ops:verify3`/`ops:closure`는 `systemctl`/`journalctl`/로컬 Linux 서비스 상태를 전제로 하므로 EC2(`/srv/projects/project2/global-pulse`)에서 실행해야 함.

### Main File Changes
- Docs:
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`
  - `docs/operations.md`

### Commands / Validation
- Local validation (this step):
  - `npm run ops:closure:selftest` (pass)
  - `npm run ops:supabase:budget -- --print-json` (pass)
  - `npm run lint` (pass)
  - `npm run build` (pass)
  - `npm run ops:closure:preflight -- --skip-systemd --skip-env --print-json` (pass)
  - `npm run ops:closure:selftest -- --keep-fixtures` (pass)
  - `npm run ops:verify3:check -- --dir docs/evidence/final-verification/SELFTEST_1776027904047 --skip-docs --expected-state PASS --expected-failures 0 --print-json` (pass)
  - UTF-8 validation (pass):
    - `docs/INITIAL_PROMPT_GLOBAL_PULSE.md`
    - `docs/PATCH_NOTES.md`
    - `docs/DELIVERY_STATUS.md`
- Expected boundary:
  - `npm run ops:verify3` / `npm run ops:closure` are EC2 runtime verification commands and remain pending in local Windows context.

### Known Risks
- EC2 실제 3회 검증 증적(`docs/evidence/final-verification/<timestamp>`)은 아직 미생성 상태다.
- `--keep-fixtures` 사용으로 self-test fixture 디렉토리가 남아 있어, 장기적으로는 정리 필요하다.

### Rollback Guide
- Remove this section `GP-20260413-35` from `docs/PATCH_NOTES.md`.
- Remove the matching Step 3R block in `docs/DELIVERY_STATUS.md`.
- Revert the local/EC2 boundary note added to `docs/operations.md` if not needed.

---

## GP-FINAL-SELFTEST_1776027904047 (EC2 Closure Evidence Imported)
### EC2 Final 3x Verification Result
- Closure state: PASS
- Failures: 0
- Run directory: /srv/projects/project2/global-pulse/docs/evidence/final-verification/SELFTEST_1776027904047
- Source report: /srv/projects/project2/global-pulse/docs/evidence/final-verification/SELFTEST_1776027904047/FINAL_REPORT.md
### Round Outcomes
- round1: OK (capture=0, report=0, script_failures=0)
- round2: OK (capture=0, report=0, script_failures=0)
- round3: OK (capture=0, report=0, script_failures=0)
### Notes
- Imported by `scripts/apply-final-verification-report.ts`.

---

## GP-FINAL-20260412_212140 (EC2 Closure Evidence Imported)
### EC2 Final 3x Verification Result
- Closure state: PASS
- Failures: 0
- Run directory: /srv/projects/project2/global-pulse/docs/evidence/final-verification/20260412_212140
- Source report: /srv/projects/project2/global-pulse/docs/evidence/final-verification/20260412_212140/FINAL_REPORT.md
### Round Outcomes
- round1: OK (capture=0, report=0, script_failures=0)
### Notes
- Imported by `scripts/apply-final-verification-report.ts`.

---

## GP-20260413-36 (EC2 Pivot Step 3S: Project2 Deploy + Single-Run Closure)
### Before -> After
- Before:
  - EC2 target path `/srv/projects/project2/global-pulse` was missing.
  - `npm ci` on EC2 failed due peer dependency conflict (`react-simple-maps@3.0.0` vs React 19).
  - Closure execution remained blocked in local/remote handoff stage.
- After:
  - Deployed repository bundle to EC2:
    - `/srv/projects/project2/global-pulse`
  - Added install policy file for reproducible install on EC2:
    - `.npmrc` with `legacy-peer-deps=true`
  - Installed missing preflight runtime toolchain on EC2:
    - `postgresql-client` (`pg_dump`, `psql`)
  - Ran user-requested single-run closure on EC2:
    - `ROUNDS=1 SLEEP_SECONDS=0 npm run ops:closure`
    - preflight: PASS
    - round1 verification: PASS
    - failures: `0`
  - Corrected report targeting mismatch:
    - default `ops:verify3:report` selected `SELFTEST_*` fixture directory
    - reran with explicit real run dir:
      - `npm run ops:verify3:report -- --dir docs/evidence/final-verification/20260412_212140`
      - `npm run ops:verify3:apply -- --report docs/evidence/final-verification/20260412_212140/FINAL_REPORT.md`
      - `npm run ops:verify3:check -- --dir docs/evidence/final-verification/20260412_212140`
  - Synced EC2 generated evidence/docs back to local workspace.

### Main File Changes
- Config:
  - `.npmrc` (new)
- Docs:
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`
- Evidence:
  - `docs/evidence/final-verification/20260412_212140/summary.txt`
  - `docs/evidence/final-verification/20260412_212140/FINAL_REPORT.md`

### Commands / Validation
- Local:
  - `npm run lint` (pass)
  - `npm run build` (pass)
- EC2 deploy/runtime:
  - bundle upload/extract to `/srv/projects/project2/global-pulse` (pass)
  - `npm ci` (pass after `.npmrc`)
  - `npm run lint` (pass)
  - `npm run build` (pass)
  - `ROUNDS=1 SLEEP_SECONDS=0 npm run ops:closure` (pass, failures `0`)
  - explicit report/apply/check on `20260412_212140` (pass)

### Known Risks
- This run is intentionally `1` round (user directive), not default 3-round closure cadence.
- Preflight warning remains:
  - `ENABLE_SUPABASE_FALLBACK is not set in current shell.`
- Existing imported self-test evidence section remains in history and should not be treated as production closure evidence.

### Rollback Guide
- Remove `.npmrc` if peer-deps bypass policy is not acceptable.
- Remove this `GP-20260413-36` section from `docs/PATCH_NOTES.md`.
- Remove the matching Step 3S block from `docs/DELIVERY_STATUS.md`.
- Remove local copied evidence directory `docs/evidence/final-verification/20260412_212140` if rollbacking EC2 closure record.

---

## GP-20260413-37 (EC2 Pivot Step 3T: Single-Run Default + Closure Resolver Hardening)
### Before -> After
- Before:
  - Verification tooling default was still effectively 3 rounds (`ROUNDS=3`) unless env override was passed each time.
  - `ops:verify3:report` / `ops:verify3:apply` / `ops:verify3:check` auto-resolve could pick `SELFTEST_*` directories before real timestamp evidence.
  - Cross-platform check could fail in local Windows context because doc marker comparison used host-absolute report path.
  - Supabase audit count was inflated by counting the budget guard script itself.
- After:
  - Default verification policy is now single-run:
    - `scripts/run-final-verification-3x.sh` default `ROUNDS=1`
    - `scripts/complete-closure.sh` logs effective `ROUNDS` in closure step
    - `scripts/self-test-closure-tooling.ts` fixture summary now uses `rounds=1`
  - Closure evidence auto-resolve hardened:
    - `generate-final-verification-report.ts`, `apply-final-verification-report.ts`, `check-closure-state.ts`
    - default selection now prioritizes production timestamp directories (`YYYYMMDD_HHMMSS`) over `SELFTEST_*`
  - Report parsing/output hardened:
    - parser accepts both legacy heading (`Final 3x Verification`) and new heading (`Final Verification`)
    - report title/snippet now uses `Final Verification`
  - Cross-platform doc marker check fixed:
    - canonical report path is derived from `run_dir` (`/srv/.../FINAL_REPORT.md`) when available
    - `ops:verify3:check` now accepts canonical/normalized path markers
  - Supabase audit consistency fixed:
    - `scripts/audit-supabase-fallback.ts` now excludes `scripts/check-supabase-fallback-budget.ts`
    - audit total restored to baseline (`53`)

### Main File Changes
- Scripts:
  - `scripts/run-final-verification-3x.sh`
  - `scripts/complete-closure.sh`
  - `scripts/generate-final-verification-report.ts`
  - `scripts/apply-final-verification-report.ts`
  - `scripts/check-closure-state.ts`
  - `scripts/self-test-closure-tooling.ts`
  - `scripts/audit-supabase-fallback.ts`
- Docs:
  - `README.md`
  - `docs/operations.md`
  - `docs/supabase-cutover-checklist.md`
  - `docs/deployment-ec2.md`
  - `docs/evidence/README.md`
  - generated refresh: `docs/source-notes/supabase-fallback-audit.md`

### Commands / Validation
- `npm run lint` (pass)
- `npm run build` (pass)
- `npm run ops:closure:selftest` (pass)
- `npm run ops:verify3:report -- --print` (pass)
  - default selected `docs/evidence/final-verification/20260412_212140` (not `SELFTEST_*`)
- `npm run ops:verify3:check -- --print-json` (pass, `issues: []`)
- `npm run ops:verify3:apply -- --dry-run` (pass)
  - preview now emits canonical source/evidence report path (`/srv/.../FINAL_REPORT.md`)
- `npm run ops:supabase:audit` (pass, total `53`)
- `npm run ops:supabase:budget -- --print-json` (pass, baseline unchanged)

### Known Risks
- Command/filename naming still uses legacy token `verify3` for backward compatibility even though default is 1 round.
- Historical entries in `PATCH_NOTES.md`/`DELIVERY_STATUS.md` still include `Final 3x` wording by design.

### Rollback Guide
- Revert script defaults/parsers:
  - `scripts/run-final-verification-3x.sh`
  - `scripts/complete-closure.sh`
  - `scripts/generate-final-verification-report.ts`
  - `scripts/apply-final-verification-report.ts`
  - `scripts/check-closure-state.ts`
  - `scripts/self-test-closure-tooling.ts`
  - `scripts/audit-supabase-fallback.ts`
- Revert runbook updates:
  - `README.md`
  - `docs/operations.md`
  - `docs/supabase-cutover-checklist.md`
  - `docs/deployment-ec2.md`
  - `docs/evidence/README.md`
- Re-run `npm run ops:supabase:audit` after rollback to refresh inventory report.

---

## GP-20260413-38 (EC2 Pivot Step 3U: API Fallback Removal Slice 1 + Budget Tighten)
### Before -> After
- Before:
  - `/api/health` still had Supabase fallback probe path when PostgreSQL pool was unavailable.
  - Supabase fallback budget baseline remained at `53`, even after confirmed removals.
- After:
  - Removed Supabase fallback branch from health route:
    - `app/api/health/route.ts`
    - DB check is now PostgreSQL-only (`postgres_not_configured` when pool is unavailable)
  - Re-ran audit and tightened baseline budget to match reduced usage:
    - fallback audit total reduced: `53 -> 51`
    - `getSupabaseServiceClientOrNull` matches reduced: `17 -> 15`
    - updated baseline file:
      - `docs/source-notes/supabase-fallback-budget.json`

### Main File Changes
- API:
  - `app/api/health/route.ts`
- Scripts:
  - generated refresh: `docs/source-notes/supabase-fallback-audit.md`
- Budget:
  - `docs/source-notes/supabase-fallback-budget.json`

### Commands / Validation
- `npm run lint` (pass)
- `npm run build` (pass)
- `npm run ops:supabase:audit` (pass, `total_matches: 51`)
- `npm run ops:supabase:budget -- --print-json` (pass)
  - budget/current matched at:
    - total: `51`
    - `createSupabaseServiceClient: 26`
    - `getSupabaseServiceClientOrNull: 15`
    - `ENABLE_SUPABASE_FALLBACK: 5`
    - `SUPABASE_ENV: 5`

### Known Risks
- Remaining API routes still contain Supabase fallback branches; health route is only the first slice.
- Health endpoint now surfaces PostgreSQL-only readiness and no longer reports Supabase fallback status.

### Rollback Guide
- Restore Supabase fallback logic in `app/api/health/route.ts`.
- Reset `docs/source-notes/supabase-fallback-budget.json` to the previous baseline (`53/17`).
- Re-run:
  - `npm run ops:supabase:audit`
  - `npm run ops:supabase:budget -- --print-json`

---

## GP-20260413-39 (EC2 Pivot Step 3V~3Z: PostgreSQL-only Fallback Retirement Complete)
### Before -> After
- Before:
  - API 7개 엔드포인트에 Supabase fallback 분기 잔존:
    - `/api/topics`
    - `/api/regions`
    - `/api/global-topics`
    - `/api/search`
    - `/api/stats`
    - `/api/timeline`
    - `/api/topic/[topicId]`
  - 배치/수집/시드 경로에서 Supabase fallback 경로 잔존:
    - analyzer (`run-analysis`, `run-global-analysis`)
    - scripts (`build-snapshots`, `cleanup-old-data`, `seed-regions`)
    - collector persistence (`packages/collector/src/utils/supabase-storage.ts`)
  - shared runtime에 Supabase export/module 잔존:
    - `packages/shared/src/index.ts -> export * from "./supabase"`
    - `packages/shared/src/supabase.ts`
    - `app/api/_shared/supabase-server.ts`
  - Supabase fallback budget baseline: `51`
- After:
  - API 7개 엔드포인트 모두 PostgreSQL-only로 통일 (fallback branch 제거, 미구성 시 `provider: "none"` 응답)
  - analyzer/collector/scripts의 Supabase fallback 실행 경로 제거:
    - analyzer storage mode를 PostgreSQL 단일 모드로 정리
    - snapshot/cleanup/seed 스크립트 PostgreSQL-only로 정리
    - collector persistence PostgreSQL-only로 정리
  - shared/runtime Supabase 의존 제거:
    - `packages/shared/src/index.ts`에서 Supabase export 제거
    - `packages/shared/src/supabase.ts` 삭제
    - `app/api/_shared/supabase-server.ts` 삭제
    - 미사용 `lib/supabase-client.ts` 삭제
  - preflight env 체크를 PostgreSQL 기준으로 전환:
    - `ENABLE_SUPABASE_FALLBACK` 체크 제거
    - `DATABASE_URL` 또는 `DB_*` 조합 체크로 변경
  - 감사/예산 재기준화 완료:
    - `ops:supabase:audit` 결과 `totalMatches: 0`
    - `docs/source-notes/supabase-fallback-budget.json` baseline `0`으로 갱신

### Main File Changes
- API:
  - `app/api/topics/route.ts`
  - `app/api/regions/route.ts`
  - `app/api/global-topics/route.ts`
  - `app/api/search/route.ts`
  - `app/api/stats/route.ts`
  - `app/api/timeline/route.ts`
  - `app/api/topic/[topicId]/route.ts`
- Batch / Analyzer / Collector / Seed:
  - `packages/analyzer/src/run-analysis.ts`
  - `packages/analyzer/src/run-global-analysis.ts`
  - `packages/collector/src/utils/supabase-storage.ts`
  - `scripts/build-snapshots.ts`
  - `scripts/cleanup-old-data.ts`
  - `scripts/seed-regions.ts`
  - `scripts/closure-preflight.ts`
- Shared / Runtime cleanup:
  - `packages/shared/src/index.ts`
  - `packages/shared/src/supabase.ts` (deleted)
  - `app/api/_shared/supabase-server.ts` (deleted)
  - `lib/supabase-client.ts` (deleted)
- Audit/Budget artifacts:
  - `docs/source-notes/supabase-fallback-audit.md` (regenerated)
  - `docs/source-notes/supabase-fallback-budget.json` (re-baselined to 0)

### Commands / Validation
- `npm run lint` (pass)
- `npm run build` (pass)
- `npm run ops:supabase:audit` (pass, `totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` (pass, budget/current 모두 `0`)
- `npm run ops:verify3:check -- --print-json` (pass, `issues=[]`, evidence `20260412_212140`)

### Known Risks
- 역사적 문서(`docs/supabase-cutover-checklist.md` 등)에 Supabase 관련 설명이 남아 있을 수 있으나, 런타임 코드 경로에서는 제거 완료.
- `scripts/setup-supabase.ts` 및 `supabase/` 디렉토리는 기록/이관용 유산 자산으로 남아 있음 (운영 런타임 비사용).

### Rollback Guide
- 복구 대상:
  - 위 삭제 파일 3개(`packages/shared/src/supabase.ts`, `app/api/_shared/supabase-server.ts`, `lib/supabase-client.ts`) 복원
  - API/배치/수집/시드의 Supabase fallback 분기 재도입
  - `docs/source-notes/supabase-fallback-budget.json` baseline을 이전 값(`51`)으로 되돌림
- 복구 후 재검증:
  - `npm run lint`
  - `npm run build`
  - `npm run ops:supabase:audit`
  - `npm run ops:supabase:budget -- --print-json`

---

## GP-20260413-40 (EC2 Pivot Step 4A: Operations Runbook PostgreSQL-only Cleanup + 24h Watch Snapshot Tooling)
### Before -> After
- Before:
  - 운영 문서(`README`, `operations`, `deployment`, `architecture`)에 Supabase 전환 단계 문구가 남아 있어 현재 PostgreSQL-only 상태와 불일치.
  - 24시간 운영 관찰을 위한 표준화된 스냅샷 수집 스크립트 부재.
  - cutover evidence 요약/리포트 메타가 `enable_supabase_fallback` 중심.
- After:
  - 운영 문서 PostgreSQL-only 기준으로 정리:
    - `README.md` stack/layout/env/runbook 문구 정리
    - `docs/operations.md` 전면 갱신
    - `docs/deployment-ec2.md` env 템플릿을 PostgreSQL 기준으로 갱신
    - `docs/architecture.md` migration 상태를 "완료" 기준으로 갱신
    - `docs/supabase-cutover-checklist.md`를 legacy record 형태로 재정의
    - `.env.example`를 PostgreSQL 중심으로 재작성
  - 24h 관찰 준비:
    - 신규 스크립트 `scripts/capture-ops-snapshot.sh`
    - 신규 스크립트 `scripts/run-ops-watch-window.sh`
    - 신규 명령 `npm run ops:monitor:snapshot`
    - 신규 명령 `npm run ops:monitor:watch`
    - service/timer/api/journal/db-count 증적을 `docs/evidence/ops-monitoring/<timestamp>/`로 저장
  - evidence 메타 정리:
    - `scripts/capture-cutover-evidence.sh` -> `postgres_config_mode` 기록
    - `scripts/generate-evidence-report.ts` -> `postgres_config_mode` 파싱/출력 지원(기존 필드 하위호환 유지)
    - `scripts/self-test-closure-tooling.ts` fixture 업데이트
  - closure import 문구 정리:
    - `scripts/apply-final-verification-report.ts` PASS 후속 항목을 운영 관찰/0-baseline 유지로 수정
  - 의존성 정리:
    - root/shared package에서 `@supabase/supabase-js` 제거
    - `package.json`에서 `setup:supabase` 스크립트 제거

### Main File Changes
- Operations/docs:
  - `README.md`
  - `docs/operations.md`
  - `docs/deployment-ec2.md`
  - `docs/architecture.md`
  - `docs/supabase-cutover-checklist.md`
  - `.env.example`
- Scripts/runtime:
  - `scripts/capture-ops-snapshot.sh` (new)
  - `scripts/run-ops-watch-window.sh` (new)
  - `scripts/capture-cutover-evidence.sh`
  - `scripts/generate-evidence-report.ts`
  - `scripts/self-test-closure-tooling.ts`
  - `scripts/apply-final-verification-report.ts`
  - `scripts/audit-supabase-fallback.ts` (0-match 상태에서 guard checklist 출력하도록 개선)
- Package metadata:
  - `package.json`
  - `packages/shared/package.json`
  - `package-lock.json`

### Commands / Validation
- `npm install` (pass; lockfile updated)
- `npm run lint` (pass)
- `npm run build` (pass)
- `npm run ops:closure:selftest` (pass)
- `npm run ops:supabase:audit` (pass, `totalMatches=0`)
- `npm run ops:supabase:budget -- --print-json` (pass, `ok=true`)
- `npm run ops:verify3:check -- --print-json` (pass, `issues=[]`)

### Known Risks
- Local Windows shell in this environment has no usable `bash` runtime (WSL not configured), so new bash monitoring script execution validation is pending on EC2 Linux host.
- Legacy historical documents still contain Supabase terms by design (audit trail preservation).

### Rollback Guide
- Revert operations/runbook/tooling changes in:
  - `README.md`
  - `docs/operations.md`
  - `docs/deployment-ec2.md`
  - `docs/architecture.md`
  - `docs/supabase-cutover-checklist.md`
  - `.env.example`
  - `scripts/capture-ops-snapshot.sh`
  - `scripts/capture-cutover-evidence.sh`
  - `scripts/generate-evidence-report.ts`
  - `scripts/self-test-closure-tooling.ts`
  - `scripts/apply-final-verification-report.ts`
  - `package.json`
  - `packages/shared/package.json`
  - `package-lock.json`
- Re-run:
  - `npm run lint`
  - `npm run build`
  - `npm run ops:supabase:audit`
  - `npm run ops:supabase:budget -- --print-json`

---

## GP-20260413-41 (EC2 Pivot Step 4B: Git Snapshot Commit + EC2 systemd Activation and Watch Stabilization)
### Before -> After
- Before:
  - Local workspace changes were not snapshot-committed.
  - EC2 host (`3.36.83.199`) had no `global-pulse-*` systemd units installed.
  - Web app was running under PM2 (`stockpulse`) and conflicted with systemd web service on port `3000`.
  - `capture-ops-snapshot.sh` had two operational bugs:
    - failure exit code logging could show `[FAIL:0]`
    - unit detection under `pipefail` could incorrectly enter skip path.
- After:
  - Local git snapshot committed:
    - commit: `06fbbc0`
    - message: `feat: finalize postgres-only runtime and ops monitoring automation`
  - EC2 systemd units installed and enabled:
    - `global-pulse-web.service`
    - `global-pulse-{collector,analyzer,snapshot,cleanup,backup}.timer`
  - PM2 workload stopped/removed to avoid duplicate schedulers and web port conflict:
    - `pm2 stop all`
    - `pm2 delete all`
  - Ops snapshot scripts hardened:
    - fixed fail status capture in `run_capture()` (`capture-ops-snapshot.sh`, `capture-cutover-evidence.sh`)
    - fixed systemd unit detection logic in `capture-ops-snapshot.sh` (no false skip under `pipefail`)
  - 24h monitoring watch restarted with corrected script and systemd-aware checks:
    - previous watch PID: `111445` (replaced)
    - active watch PID: `115007`
    - launch log: `/srv/projects/project2/global-pulse/docs/evidence/ops-monitoring/watch-launch-20260413_125324.log`

### Main File Changes
- `scripts/capture-ops-snapshot.sh`
- `scripts/capture-cutover-evidence.sh`
- `docs/PATCH_NOTES.md`
- `docs/DELIVERY_STATUS.md`

### Commands / Validation
- Local:
  - `git add -A`
  - `git commit -m "feat: finalize postgres-only runtime and ops monitoring automation"` (pass)
- EC2 (`ubuntu@3.36.83.199`):
  - `npm ci` (pass)
  - `npm run build` (pass)
  - install/enable systemd units + timers (pass)
  - `pm2 stop all && pm2 delete all` (pass)
  - `bash scripts/capture-ops-snapshot.sh` (pass, failures `0`, unit checks included)
  - 24h watch restart (pass, PID `115007`)

### Known Risks
- This EC2 path is not currently a git checkout (`.git` absent), so `git pull` deployment flow is not available yet.
- Health endpoint on this host currently reports degraded DB check (`provider: supabase`, `not_configured`) due host runtime/env state; ops snapshot still records this as HTTP success.

### Rollback Guide
- To roll back EC2 service model:
  - stop/disable `global-pulse-*` systemd units
  - re-register PM2 processes if needed
- To roll back script hardening:
  - restore previous versions of:
    - `scripts/capture-ops-snapshot.sh`
    - `scripts/capture-cutover-evidence.sh`

---

## GP-20260413-42 (EC2 Pivot Step 4C: Prompt Consolidation to Single Master + UTF-8 Guard)
### Before -> After
- Before:
  - 프롬프트 문서가 분산(`INITIAL_PROMPT_GLOBAL_PULSE.md`, `INITIAL_PROMPT_GLOBAL_PULSE_EC2.md`)되어 실행 기준이 중복/충돌될 여지가 있었음.
  - 작업 지시(아키텍처, 검증, 기록 규칙)가 여러 문서에 흩어져 있어 운영자가 "어느 문서를 기준으로 실행할지" 매번 판단해야 했음.
- After:
  - 단일 마스터 프롬프트로 통합:
    - `docs/INITIAL_PROMPT_GLOBAL_PULSE.md`
  - EC2 프롬프트 문서는 레거시 포인터로 전환:
    - `docs/INITIAL_PROMPT_GLOBAL_PULSE_EC2.md`
  - 마스터 문서에 다음 내용을 통합 반영:
    - 단일 EC2/PostgreSQL-only 아키텍처
    - 수집/분석/API/UI/운영 검증 기준
    - Step 단위 기록 규칙(Patch-note style)
    - 현재 상태 및 다음 우선순위
    - UTF-8 인코딩 품질 체크리스트

### Main File Changes
- `docs/INITIAL_PROMPT_GLOBAL_PULSE.md` (full rewrite, unified master prompt)
- `docs/INITIAL_PROMPT_GLOBAL_PULSE_EC2.md` (deprecated pointer)
- `docs/PATCH_NOTES.md`
- `docs/DELIVERY_STATUS.md`

### Commands / Validation
- UTF-8 읽기 검증:
  - `Get-Content -Encoding utf8 docs/INITIAL_PROMPT_GLOBAL_PULSE.md`
  - `Get-Content -Encoding utf8 docs/INITIAL_PROMPT_GLOBAL_PULSE_EC2.md`
- 변경사항 점검:
  - `git status --short`
  - `git diff -- docs/INITIAL_PROMPT_GLOBAL_PULSE.md docs/INITIAL_PROMPT_GLOBAL_PULSE_EC2.md docs/PATCH_NOTES.md docs/DELIVERY_STATUS.md`

### Known Risks
- 기존 자동화/문서에서 `INITIAL_PROMPT_GLOBAL_PULSE_EC2.md`의 상세 본문을 직접 참조하던 경우, 이제는 마스터 문서 참조로 갱신이 필요함.

### Rollback Guide
- 이전 구조로 되돌리려면:
  - `docs/INITIAL_PROMPT_GLOBAL_PULSE.md`를 Step 4C 이전 버전으로 복원
  - `docs/INITIAL_PROMPT_GLOBAL_PULSE_EC2.md`에 기존 상세 본문 재적용
  - 본 GP-20260413-42 항목을 `PATCH_NOTES`/`DELIVERY_STATUS`에서 제거
---

## GP-20260413-43 (EC2 Pivot Step 4D: GitHub Repository Provisioning + Origin Push)
### Before -> After
- Before:
  - 로컬 저장소에 원격(remote) 설정이 없어서 `git push` 불가 상태였음.
  - EC2 운영/문서 기준은 정리되었지만, 원격 백업/협업 저장소가 미연결 상태였음.
- After:
  - GitHub 계정 `wsp-max` 하위에 신규 저장소 생성:
    - `https://github.com/wsp-max/global-pulse`
  - 로컬 저장소 원격 연결:
    - `origin -> https://github.com/wsp-max/global-pulse.git`
  - 현재 브랜치(`master`) 최초 push 완료 및 upstream 설정 완료.

### Main File Changes
- `docs/PATCH_NOTES.md`
- `docs/DELIVERY_STATUS.md`

### Commands / Validation
- 계정/원격 준비 확인:
  - `git config --global user.name`
  - `git config --global user.email`
  - `git remote -v`
- 기존 GitHub 계정 탐지(로컬 기존 저장소 remotes):
  - `rg`/`.git/config` 조회로 `wsp-max` 확인
- GitHub repo 생성:
  - `Invoke-RestMethod POST https://api.github.com/user/repos` (git credential-manager 토큰 사용)
- 원격 연결/푸시:
  - `git remote add origin https://github.com/wsp-max/global-pulse.git`
  - `git push -u origin master`
- 결과:
  - `CREATED wsp-max/global-pulse`
  - `PUSHED branch=master`

### Known Risks
- 기본 브랜치명이 현재 `master`임. 조직 표준이 `main`이면 후속 단계에서 브랜치명 정리 필요.

### Rollback Guide
- 원격 연결 해제/변경:
  - `git remote remove origin` 또는 `git remote set-url origin <other-url>`
- 원격 저장소 롤백이 필요하면 GitHub에서 `wsp-max/global-pulse` 삭제 후 재생성.

---

## GP-20260413-44 (EC2 Pivot Step 4E~4F: Git-based EC2 Deploy Standardization + Ops Watch Evidence Handoff)
### Before -> After
- Before:
  - EC2 운영 경로(`/srv/projects/project2/global-pulse`)에 `.git`이 없어 `git pull` 기반 배포가 불가능했음.
  - 24h watch/ops 증적은 legacy 디렉토리에 분산되어 있고, 신규 배포 경로에는 동기화되지 않은 상태였음.
  - `/api/health`는 `provider=supabase` 상태로 노출되어 최신 PostgreSQL-only 코드와 불일치했음.
- After:
  - EC2 앱 경로를 git checkout 기반으로 재구성:
    - 기존 경로 백업: `/srv/projects/project2/global-pulse_legacy_20260413_133224`
    - 신규 clone: `/srv/projects/project2/global-pulse` (`master`, `origin=https://github.com/wsp-max/global-pulse.git`)
  - 표준 배포 체인 고정:
    - `bash scripts/deploy-ec2.sh` (BRANCH=master)로 build + systemd unit/timer 재적용
  - 런타임 확인:
    - `global-pulse-web.service` 및 주요 timer `active`
    - `/api/health` 응답이 최신 코드 기준(`provider=postgres`)으로 전환됨
  - 운영 관찰 증적 이관/재시작:
    - legacy `docs/evidence/ops-monitoring/*`를 신규 경로/로컬로 동기화
    - 신규 watch 시작: `watch_20260413_133512` (hour=1 pass, failures=0)

### Main File Changes
- 운영 증적 동기화:
  - `docs/evidence/ops-monitoring/*` (new, legacy + post-cutover evidence)
- 배포 기본 브랜치 정렬:
  - `scripts/deploy-ec2.sh` (`BRANCH` default: `main -> master`)
- 문서 누적:
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`

### Commands / Validation
- EC2 cutover:
  - backup + clone + deploy:
    - `/srv/projects/project2/global-pulse -> /srv/projects/project2/global-pulse_legacy_20260413_133224`
    - `git clone --branch master https://github.com/wsp-max/global-pulse.git /srv/projects/project2/global-pulse`
    - `APP_DIR=/srv/projects/project2/global-pulse BRANCH=master USE_PNPM=0 bash scripts/deploy-ec2.sh`
- EC2 runtime checks:
  - `systemctl status global-pulse-web.service`
  - `systemctl list-timers 'global-pulse-*' --no-pager`
  - `curl -i http://127.0.0.1:3000/api/health`
  - result:
    - web/timers active
    - health = `503 degraded` with `provider=postgres`, `error=postgres_not_configured` (의도 상태: DB env 미설정)
- Ops evidence:
  - `npm run ops:monitor:snapshot` (pass, failures=0, output `20260413_133512`)
  - `HOURS=24 INTERVAL_SECONDS=3600 MAX_FAILURES=3 npm run ops:monitor:watch` (running, first hour pass)

### Known Risks
- `/etc/global-pulse/global-pulse.env`에 PostgreSQL 접속 정보(`DATABASE_URL` 또는 `DB_*`)가 없어 health가 degraded(503) 상태임.
- 24h watch는 현재 진행 중이며 아직 최종 종료 summary가 생성되지 않음.

### Rollback Guide
- EC2 경로 롤백:
  - 신규 경로 중지 후 legacy 경로로 서비스 WorkingDirectory를 되돌리거나, legacy 디렉토리에서 재배포 수행
- 배포 기본 브랜치 롤백:
  - `scripts/deploy-ec2.sh`의 `BRANCH` 기본값을 `main`으로 복원
- 증적 롤백:
  - `docs/evidence/ops-monitoring/*` 신규 동기화분 삭제 가능 (legacy 원본은 EC2 backup 경로에 유지)

---

## GP-20260413-45 (Step 5A: Collector Expansion Slice 1 - bilibili, mastodon, dcard)
### Before -> After
- Before:
  - `bilibili`, `mastodon`, `dcard` 스크래퍼가 모두 스텁(`return []`) 상태.
  - collector 실행기와 테스트 엔트리에서 해당 소스가 운영 대상에 포함되지 않았음.
  - SNS/TW 워크플로우가 region 단위 실행이라 소스 단위 제어가 불명확했음.
- After:
  - 3개 스크래퍼 구현:
    - `bilibili`: `https://s.search.bilibili.com/main/hotword` 파싱
    - `mastodon`: `https://mastodon.social/api/v1/trends/statuses` 파싱
    - `dcard`: 인기글 API 파싱 + Cloudflare 차단 시 명시적 실패 처리
  - collector 실행기 확장:
    - `run.ts` 후보 스크래퍼에 `BilibiliScraper`, `MastodonScraper`, `DcardScraper` 추가
  - 테스트 엔트리 확장:
    - `scripts/test-scraper.ts`에 `bilibili/mastodon/dcard` 등록
  - 워크플로우 소스 단위 고정:
    - `collect-sns-bilibili.yml` -> `--source bilibili`
    - `collect-sns-mastodon.yml` -> `--source mastodon`
    - `collect-taiwan.yml` -> `--source dcard`
  - 공유 상수 정렬:
    - `bilibili.scrapeUrl`을 hotword endpoint로 교체

### Main File Changes
- Scrapers:
  - `packages/collector/src/scrapers/sns/bilibili.ts`
  - `packages/collector/src/scrapers/sns/mastodon.ts`
  - `packages/collector/src/scrapers/taiwan/dcard.ts`
- Runtime/Test:
  - `packages/collector/src/run.ts`
  - `packages/collector/src/index.ts`
  - `scripts/test-scraper.ts`
- Constants/Workflow:
  - `packages/shared/src/constants.ts`
  - `.github/workflows/collect-sns-bilibili.yml`
  - `.github/workflows/collect-sns-mastodon.yml`
  - `.github/workflows/collect-taiwan.yml`

### Commands / Validation
- Source tests:
  - `npm run test:scraper -- --source bilibili` -> success=true, postCount=10
  - `npm run test:scraper -- --source mastodon` -> success=true, postCount=29
  - `npm run test:scraper -- --source dcard` -> success=false, HTTP 403 (Cloudflare 차단)
- Aggregated collector run:
  - `npm run collect -- --source bilibili,mastodon,dcard`
  - result: `2/3 succeeded` (`dcard` blocked)
- Quality/ops gates:
  - `npm run lint` (pass)
  - `npm run build` (pass)
  - `npm run ops:supabase:audit` (pass, `totalMatches=0`)
  - `npm run ops:supabase:budget -- --print-json` (pass)
  - `npm run ops:verify3:check -- --print-json` (pass, `issues=[]`)
  - `npm run verify:postgres -- --source reddit_worldnews` (skip: local DB env missing)

### Known Risks
- `dcard`는 현재 Cloudflare 403으로 직접 수집 실패(네트워크/IP 환경 의존성 높음).
- `bilibili`는 기존 ranking API가 `-352` 응답을 반환하여 hotword endpoint 기반으로 우회 구현함(추후 endpoint 정책 변화 모니터링 필요).

### Rollback Guide
- 3개 소스 확장 롤백:
  - 위 스크래퍼 파일을 스텁 버전으로 복원
  - `run.ts`/`test-scraper.ts` 신규 소스 등록 제거
  - workflow의 `--source` 변경을 이전 상태로 복원
- 상수 롤백:
  - `packages/shared/src/constants.ts`의 `bilibili.scrapeUrl`을 이전 값으로 복원

---

## GP-20260413-46 (EC2 Deploy Follow-up: Untracked Evidence Merge Fix + Runtime Sync)
### Before -> After
- Before:
  - EC2 `deploy-ec2.sh` 재실행 시 `git pull --ff-only`가 실패:
    - 원인: `docs/evidence/ops-monitoring/*`가 원격 워킹트리에 untracked 상태로 존재해 tracked 파일 병합 충돌 발생
  - EC2 앱은 직전 커밋(`d34028c`) 상태로 남아 신규 Step 5A 코드가 반영되지 않았음.
- After:
  - 충돌 원인을 비파괴 방식으로 해소:
    - runtime evidence 디렉토리 백업 이동:
      - `docs/evidence/ops-monitoring -> docs/evidence/ops-monitoring_runtime_20260413_134415`
  - 이후 `master` fast-forward + deploy 성공:
    - EC2 HEAD: `36a5fa7`
  - post-deploy 스모크 확인:
    - `bilibili` scraper success
    - `mastodon` scraper success
    - `dcard` scraper 403 유지(known risk)
  - post-deploy 24h watch 재시작:
    - `watch_20260413_134515` (hour=1, failures=0)
  - 최신 ops evidence를 로컬로 재동기화하여 기록 일관성 유지

### Main File Changes
- 증적 갱신:
  - `docs/evidence/ops-monitoring/*` (updated + new `20260413_134515`, `watch_20260413_134515`, `watch-launch-after-deploy.log`)
- 문서 누적:
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`

### Commands / Validation
- EC2 충돌 해소 + 재배포:
  - `mv docs/evidence/ops-monitoring docs/evidence/ops-monitoring_runtime_<timestamp>`
  - `git pull --ff-only origin master`
  - `APP_DIR=/srv/projects/project2/global-pulse BRANCH=master USE_PNPM=0 bash scripts/deploy-ec2.sh`
- 배포 확인:
  - `git -C /srv/projects/project2/global-pulse rev-parse --short HEAD` -> `36a5fa7`
  - `systemctl is-active global-pulse-web.service ...` -> all `active`
  - `curl -i http://127.0.0.1:3000/api/health` -> `provider=postgres`, `postgres_not_configured`
- 스크래퍼 smoke:
  - `npm run test:scraper -- --source bilibili` -> success
  - `npm run test:scraper -- --source mastodon` -> success
  - `npm run test:scraper -- --source dcard` -> 403

### Known Risks
- watch 재시작은 되었지만 24시간 종료 증적은 아직 진행 중.
- PostgreSQL env 미설정으로 health는 degraded(503) 상태 유지.

### Rollback Guide
- 충돌 복구 롤백:
  - `docs/evidence/ops-monitoring_runtime_20260413_134415`에서 필요한 증적을 복원
- 배포 롤백:
  - EC2에서 이전 commit checkout 후 deploy 스크립트 재실행

---

## GP-20260413-47 (Step 5B: JP/TW/CN High-Variability Source Implementation - fivech, hatena, ptt, weibo)
### Before -> After
- Before:
  - `fivech`, `hatena`, `ptt`, `weibo` 스크래퍼가 모두 스텁(`return []`) 상태.
  - collector 런타임/테스트 매핑에 4개 소스가 연결되지 않아 실제 수집 불가.
  - Taiwan 수집 워크플로우는 `--source dcard` 단일 소스만 실행.
- After:
  - 4개 스크래퍼 구현 완료:
    - `fivech`: `https://itest.5ch.io/subbacks/bbynews.json` 파싱
    - `hatena`: `https://b.hatena.ne.jp/hotentry/all.rss` XML/RSS 파싱
    - `ptt`: `over18=1` 쿠키 포함 Gossiping HTML 파싱
    - `weibo`: `https://weibo.com/ajax/side/hotSearch` JSON 파싱
  - 런타임 연결:
    - `packages/collector/src/run.ts`에 4개 소스 등록
    - `scripts/test-scraper.ts`에 4개 테스트 소스 등록
    - `packages/collector/src/index.ts` export 추가
  - 운영 상수/워크플로우 정렬:
    - `packages/shared/src/constants.ts`
      - `fivech.scrapeUrl` -> `https://itest.5ch.io/subbacks/bbynews.json`
      - `hatena.scrapeUrl` -> `https://b.hatena.ne.jp/hotentry/all.rss`
    - `.github/workflows/collect-taiwan.yml`
      - `--source dcard` -> `--region tw` (PTT + Dcard 동시 커버)
  - Fivech timestamp 보정:
    - 스팸/공지성 비정상 thread id(`924...`)는 `postedAt`를 비워 미래 시각 오염 방지.

### Main File Changes
- Scrapers:
  - `packages/collector/src/scrapers/japan/fivech.ts`
  - `packages/collector/src/scrapers/japan/hatena.ts`
  - `packages/collector/src/scrapers/taiwan/ptt.ts`
  - `packages/collector/src/scrapers/china/weibo.ts`
- Runtime/Test/Export:
  - `packages/collector/src/run.ts`
  - `scripts/test-scraper.ts`
  - `packages/collector/src/index.ts`
- Constants/Workflow:
  - `packages/shared/src/constants.ts`
  - `.github/workflows/collect-taiwan.yml`

### Commands / Validation
- Source tests:
  - `npm run test:scraper -- --source hatena` -> success=true, postCount=40
  - `npm run test:scraper -- --source fivech` -> success=true, postCount=50
  - `npm run test:scraper -- --source ptt` -> success=true, postCount=25
  - `npm run test:scraper -- --source weibo` -> success=true, postCount=50
- Aggregated collector run:
  - `npm run collect -- --source hatena,fivech,ptt,weibo` -> `4/4 succeeded`
  - local 환경에서는 DB env 미설정으로 persistence skip 로그 출력(의도된 동작)
- Quality/ops gates:
  - `npm run lint` (pass)
  - `npm run build` (pass)
  - `npm run ops:supabase:audit` (pass, `totalMatches=0`)
  - `npm run ops:supabase:budget -- --print-json` (pass)
  - `npm run ops:verify3:check -- --print-json` (pass, `issues=[]`)

### Known Risks
- PTT는 공지/관리자 글이 목록에 함께 포함될 수 있어 후속 필터링(공지 제외 룰) 튜닝 여지 존재.
- Fivech는 일부 thread token이 epoch 범위를 벗어나 `postedAt`를 비우는 방식으로 처리됨.
- 로컬 환경에서는 PostgreSQL env 미설정 시 row 증가 검증을 수행할 수 없음(EC2에서 확인 필요).

### Rollback Guide
- 4개 스크래퍼 롤백:
  - 해당 파일을 스텁 버전으로 복원하고 `run.ts`/`test-scraper.ts` 등록 제거
- 워크플로우 롤백:
  - `.github/workflows/collect-taiwan.yml`을 `--source dcard`로 복원
- 상수 롤백:
  - `packages/shared/src/constants.ts`의 `fivech/hatena` scrapeUrl을 이전 값으로 복원

---

## GP-20260414-48 (EC2 Runtime Activation: PostgreSQL + Env + Live Validation)
### Before -> After
- Before:
  - EC2 runtime had PostgreSQL service installed but application env was not configured for DB.
  - `/api/health` was previously observed as degraded with `postgres_not_configured`.
  - `db:init` and `seed:regions` were skipped in runtime due missing DB env.
- After:
  - Local PostgreSQL runtime was activated on EC2 with dedicated app role/database:
    - role: `global_pulse`
    - database: `global_pulse`
  - `/etc/global-pulse/global-pulse.env` was updated with runtime-only secrets and DB config:
    - `DATABASE_URL` + `DB_*`
    - `GEMINI_API_KEY`
    - `TELEGRAM_BOT_TOKEN`
    - `TELEGRAM_CHAT_ID`
    - file permission hardened to `640` (`root:ubuntu`)
  - Schema + seed applied on EC2:
    - `npm run db:init` -> applied `0001`, `0002`
    - `npm run seed:regions` -> regions/sources seeded
  - Runtime validation now PASS:
    - `/api/health` -> `200`, `provider=postgres`, `phase=postgres-runtime-active`
    - external `http://3.36.83.199/api/health` via Nginx -> `200`
    - full collector/analyzer systemd runs succeed (with expected source-level partial failures)

### Main File / Runtime Changes
- Runtime host changes (EC2 only, not committed):
  - `/etc/global-pulse/global-pulse.env` (created/updated, secrets included)
  - PostgreSQL role/database created on EC2 instance
- Repository docs updated:
  - `docs/PATCH_NOTES.md`
  - `docs/DELIVERY_STATUS.md`

### Commands / Validation
- DB bootstrap:
  - `npm run db:init`
  - `npm run seed:regions`
- Runtime checks:
  - `systemctl is-active global-pulse-web.service global-pulse-collector.timer global-pulse-analyzer.timer global-pulse-snapshot.timer global-pulse-cleanup.timer global-pulse-backup.timer`
  - `systemctl list-timers 'global-pulse-*' --no-pager`
  - `curl -i http://127.0.0.1:3000/api/health`
  - `curl -i http://3.36.83.199/api/health`
- Data checks (EC2 postgres):
  - `raw_posts=353`
  - `topics=97`
  - `global_topics=8`
  - `/api/stats` returned `configured=true`, `provider=postgres`
- 3x health verification:
  - 3 consecutive calls to `/api/health` all returned `200`.

### Observed Runtime Notes
- `reddit*` sources currently return `403` on EC2 in direct JSON fetch path.
- `dcard` currently returns `403` (known risk from prior steps).
- `youtube_*` sources fail when `YOUTUBE_API_KEY` is unset (expected behavior).

### Rollback Guide
- Env rollback:
  - restore previous `/etc/global-pulse/global-pulse.env` backup or rewrite with prior values
  - restart `global-pulse-web.service` and related timers
- DB rollback:
  - restore from backup (`scripts/backup-db.sh` / `scripts/restore-db.sh`) if needed
  - or drop/recreate `global_pulse` DB and rerun `npm run db:init && npm run seed:regions`

## GP-20260414-49 (Path Split Mode: /pulse for shared-host coexistence)
### Before -> After
- Before:
  - Global Pulse root routing (`/`) could conflict with another website hosted on the same EC2/Nginx.
  - Access intent was to expose Global Pulse as a separate path without purchasing a new domain.
- After:
  - Global Pulse runtime was made base-path aware using `/pulse`.
  - Nginx route contract changed to proxy only `/pulse` traffic to Next.js and keep non-`/pulse` paths isolated.
  - API client paths now honor configurable public base path (`NEXT_PUBLIC_BASE_PATH`).

### Main File Changes
- [next.config.ts](/c:/Users/wsp/Desktop/Web/Human_flow/global-pulse/next.config.ts)
  - Added env-driven `basePath` via `NEXT_BASE_PATH`.
- [lib/api.ts](/c:/Users/wsp/Desktop/Web/Human_flow/global-pulse/lib/api.ts)
  - API base now computed from `NEXT_PUBLIC_BASE_PATH`.
- [app/search/page.tsx](/c:/Users/wsp/Desktop/Web/Human_flow/global-pulse/app/search/page.tsx)
  - Search endpoint path switched to base-path aware API URL.
- [infra/nginx/global-pulse.conf](/c:/Users/wsp/Desktop/Web/Human_flow/global-pulse/infra/nginx/global-pulse.conf)
  - Added `/pulse` -> `/pulse/` redirect.
  - Added `/pulse/` reverse proxy to `127.0.0.1:3000`.
  - Added `/pulse/healthz` to `/pulse/api/health`.
  - Non-`/pulse` requests now return `404` in this server block.
- [.env.example](/c:/Users/wsp/Desktop/Web/Human_flow/global-pulse/.env.example)
  - Added `NEXT_BASE_PATH`, `NEXT_PUBLIC_BASE_PATH` examples.

### Validation
- Local quality gates:
  - `npm run lint` PASS
  - `npm run build` PASS

### Runtime Notes
- For this mode, EC2 runtime env must include:
  - `NEXT_BASE_PATH=/pulse`
  - `NEXT_PUBLIC_BASE_PATH=/pulse`
- Build must run after env update because Next.js base path is build-time effective.

### Hotfix (same step)
- Removed Nginx `/pulse -> /pulse/` redirect to avoid Next.js 308 bounce.
- `/pulse` is now proxied directly.

### Runtime Apply Result (EC2)
- Applied on `3.36.83.199` with commit `b770efb`.
- Runtime env set:
  - `NEXT_BASE_PATH=/pulse`
  - `NEXT_PUBLIC_BASE_PATH=/pulse`
  - `NEXT_PUBLIC_APP_URL=http://3.36.83.199/pulse`
- Verified:
  - `http://3.36.83.199/pulse` -> 200
  - `http://3.36.83.199/pulse/api/health` -> 200
  - `http://3.36.83.199/` -> 404 (isolated from root)

## GP-20260414-50 (YouTube API Activation + Web Port Conflict Recovery)
### Before -> After
- Before:
  - `YOUTUBE_API_KEY` 미설정으로 `youtube_kr/jp/us` 수집이 모두 실패.
  - 런타임 중 `global-pulse-web`가 내려간 사이 포트 `3000`을 다른 앱(StockPulse, `/srv/projects/project3`)이 점유하여 `/pulse` 경로가 404/오염 응답으로 흔들림.
- After:
  - EC2 env에 `YOUTUBE_API_KEY` 반영 완료.
  - YouTube 수집 검증:
    - `youtube_kr`: 20건
    - `youtube_jp`: 20건
    - `youtube_us`: 20건
    - `sources.last_error`: 모두 `ok`
  - 런타임 포트 충돌 해소:
    - Global Pulse 웹 포트를 `3100`으로 분리(`PORT=3100` in `/etc/global-pulse/global-pulse.env`)
    - Nginx `/pulse` 프록시를 `127.0.0.1:3100`으로 전환
  - 경로 복구 확인:
    - `http://3.36.83.199/pulse` -> 200
    - `http://3.36.83.199/pulse/api/health` -> 200
    - `http://3.36.83.199/pulse/api/stats` -> 200
    - `http://3.36.83.199/` -> 404(분리 유지)

### Main File Changes
- [infra/nginx/global-pulse.conf](/c:/Users/wsp/Desktop/Web/Human_flow/global-pulse/infra/nginx/global-pulse.conf)
  - upstream `3000 -> 3100`
  - `/pulse/healthz` upstream `3000 -> 3100`
- Runtime only (not committed):
  - `/etc/global-pulse/global-pulse.env`
    - `YOUTUBE_API_KEY` 추가
    - `PORT=3100` 반영

### Commands / Validation
- YouTube key apply (masked verification):
  - `grep '^YOUTUBE_API_KEY=' /etc/global-pulse/global-pulse.env` (masked)
- Collector run:
  - `npm run collect -- --source youtube_kr,youtube_jp,youtube_us` -> `3/3 succeeded`
- DB verification (EC2 postgres):
  - `raw_posts where source_id=youtube_kr` -> 20
  - `raw_posts where source_id=youtube_jp` -> 20
  - `raw_posts where source_id=youtube_us` -> 20
  - `sources.last_error` for 3 youtube sources -> `ok`
- Runtime recovery:
  - `global-pulse-web.service` 재기동/enable
  - `nginx -t && systemctl reload nginx`
  - public endpoint checks pass

### Known Risks
- StockPulse(별도 프로젝트)가 `3000`을 점유 중이므로, Global Pulse는 `3100` 고정 운영 전제를 유지해야 함.
- 향후 deploy 스크립트 실행 시 `PORT=3100`이 env에 유지되는지 확인 필요.

### Rollback Guide
- 포트 롤백:
  - `/etc/global-pulse/global-pulse.env`의 `PORT`를 `3000`으로 되돌리고
  - Nginx upstream도 `3000`으로 복원 후 web/nginx 재시작
- YouTube 키 롤백:
  - `YOUTUBE_API_KEY` 제거/교체 후 collector 재실행

---

## GP-20260414-51 (Step 5C: Analysis Quality Tuning Slice 1 - keyword/topic quality)
### Before -> After
- Before:
  - `natural.TfIdf` 내부 토크나이저 한계로 한글/일본어/중국어 키워드가 약하게 반영되거나 누락될 수 있었음.
  - 토픽명이 seed 단어 1개 기반이라 단편 단어가 그대로 제목으로 노출되는 케이스가 많았음.
  - 단일 게시글에서 파생된 단어들이 다수 독립 토픽으로 분리되어 의미 해석이 어려웠음.
- After:
  - `keyword-extractor`를 유니코드 대응 수동 TF-IDF 계산으로 전환하여 다국어 토큰을 직접 점수화.
  - 지역별 script 가중치(`kr/jp/cn`)를 적용해 해당 리전 언어 신호를 우선 반영.
  - 제목 phrase(2~3-gram) 추출 + 불용어/노이즈 필터를 강화하고, 중복 키워드 억제 로직을 추가.
  - 토픽명 생성 로직을 seed 단어 고정에서 “관련 게시글 제목 + 키워드 점수” 기반 대표 phrase 선택 방식으로 변경.
  - 클러스터 결과 후처리(약한 single-post seed 제한, 유사 토픽명 dedupe)로 단편 토픽 난립을 완화.

### Main File Changes
- [keyword-extractor.ts](/c:/Users/wsp/Desktop/Web/Human_flow/global-pulse/packages/analyzer/src/keyword-extractor.ts)
  - `natural.TfIdf` 제거, 수동 TF-IDF 계산 구현
  - `tokenizeForAnalysis`, `buildTitlePhrases` 공개 유틸 추가
  - 지역별 stopword/script multiplier, 한국어 조사 suffix 정리 로직 추가
  - phrase boost + near-duplicate keyword 제거 로직 추가
- [topic-clusterer.ts](/c:/Users/wsp/Desktop/Web/Human_flow/global-pulse/packages/analyzer/src/topic-clusterer.ts)
  - 대표 토픽명 생성기(`buildRepresentativeTopicName`) 추가
  - 약한 seed 스킵 기준(coverage/score) 추가
  - single-post 토픽 상한 제어 및 최종 토픽명 dedupe 추가

### Commands / Validation
- 품질 게이트:
  - `npm run lint` -> pass
  - `npm run build` -> pass
- 로컬 스모크:
  - `npx tsx tmp/analyzer-smoke.ts`(임시 스크립트)로 키워드/토픽명 출력 확인 후 파일 정리
  - 결과: 단일 영어 동사 중심 키워드 대신 `관세`, `자동차`, `관세 협상`, `한미 관세` 등 구문형 토픽 신호 확인

### Known Risks
- 현재 튜닝은 1차로, 리전별 형태소 분석기 미도입 상태라 JP/CN 문장 분해 품질은 추가 개선 여지가 있음.
- 극저볼륨 구간(게시글 수 적음)에서는 single-post 기반 토픽이 일부 남을 수 있음.

### Rollback Guide
- 분석 품질 튜닝 롤백:
  - `packages/analyzer/src/keyword-extractor.ts`
  - `packages/analyzer/src/topic-clusterer.ts`
  - 위 두 파일을 GP-20260414-50 시점 커밋으로 되돌리면 이전 토픽 생성 방식으로 즉시 복귀 가능.

---

## GP-20260414-52 (Step 5C: Analysis Quality Tuning Slice 2 - cross-region mapping quality)
### Before -> After
- Before:
  - cross-region 매핑이 단순 Jaccard 위주라, 리전 언어가 다를 때(예: KR/JP) 같은 이슈도 묶이지 않는 누락 가능성이 있었음.
  - 반대로 generic token 기반으로 오탐될 여지도 있어, 묶임 기준의 정밀도가 부족했음.
- After:
  - `cross-region-mapper`를 복합 스코어 기반으로 재구성:
    - token Jaccard + keyword Jaccard + name Dice + name containment/primary token 보정
  - generic stopword 필터/토큰 정규화 강화로 의미 없는 공통 단어 영향 축소
  - 유사도 판단을 다중 가드로 분리:
    - 강한 이름 포함 매칭
    - exact keyword phrase 매칭
    - primary name token 매칭
    - 일반 score-threshold 매칭
  - `run-global-analysis` 기본 similarity를 `0.30 -> 0.32`로 상향해 기본 오탐을 완화

### Main File Changes
- [cross-region-mapper.ts](/c:/Users/wsp/Desktop/Web/Human_flow/global-pulse/packages/analyzer/src/cross-region-mapper.ts)
  - 토큰화/정규화/불용어 처리 강화
  - `computeSimilarity` 기반 복합 점수 계산 도입
  - 매핑 의사결정 가드(정밀 조건) 재설계
  - 디버그용 `debugCrossRegionSimilarity` 유틸 추가
- [run-global-analysis.ts](/c:/Users/wsp/Desktop/Web/Human_flow/global-pulse/packages/analyzer/src/run-global-analysis.ts)
  - default similarity 인자 상향 (`0.32`)

### Commands / Validation
- 품질 게이트:
  - `npm run lint` -> pass
  - `npm run build` -> pass
- 실행 경로:
  - `npm run analyze:global -- --hours 24 --min-regions 2` -> 로컬 DB 미설정으로 skip(정상)
- 로컬 smoke:
  - KR/JP 관세 이슈 + US NBA 이슈 샘플에서 KR/JP만 매핑되고 US는 분리되는 시나리오 확인

### Known Risks
- 다국어 완전 의미 매칭은 번역/임베딩 계층 없이 규칙 기반으로만 처리하므로, 일부 케이스는 여전히 누락 가능.
- 실제 운영 데이터에서 threshold(`0.32`)는 추가 샘플 리뷰 후 미세 조정 필요.

### Rollback Guide
- cross-region 튜닝 롤백:
  - `packages/analyzer/src/cross-region-mapper.ts`
  - `packages/analyzer/src/run-global-analysis.ts`
  - 위 파일을 GP-20260414-51 시점으로 되돌리면 기존 매핑 로직으로 즉시 복귀 가능.

---

## GP-20260414-53 (UI placeholder cleanup + encoding guardrails)
### Before -> After
- Before:
  - 일부 화면에서 실제 텍스트로 `??`가 표시될 수 있는 하드코딩 fallback이 존재.
  - 에디터/OS에 따라 파일 인코딩/줄바꿈이 흔들릴 수 있어 한글 깨짐 재발 위험이 있었음.
- After:
  - `HeatBadge`의 `?? {score}` 제거, 열기 레벨별 아이콘으로 교체.
  - `RegionFlag`의 `?? Unknown` 제거, `regionId` 정규화(`trim + lower`) 후 미확인 fallback 개선.
  - 저장 규칙 고정:
    - `.editorconfig` 추가(UTF-8, LF, newline)
    - `.gitattributes` 추가(text eol=lf + binary 확장자 지정)

### Main File Changes
- [HeatBadge.tsx](/c:/Users/wsp/Desktop/Web/Human_flow/global-pulse/components/shared/HeatBadge.tsx)
- [RegionFlag.tsx](/c:/Users/wsp/Desktop/Web/Human_flow/global-pulse/components/shared/RegionFlag.tsx)
- [.editorconfig](/c:/Users/wsp/Desktop/Web/Human_flow/global-pulse/.editorconfig)
- [.gitattributes](/c:/Users/wsp/Desktop/Web/Human_flow/global-pulse/.gitattributes)

### Commands / Validation
- `npm run lint` -> pass
- `npm run build` -> pass
- `ssh -o BatchMode=yes ubuntu@3.36.83.199 "echo connected"` -> fail (`Permission denied (publickey)`)
  - EC2 실데이터 튜닝(Step 5C Slice 3)은 SSH 키 제공 후 진행 가능

### Known Risks
- EC2 직접 접속 권한 부재로, 운영 데이터 기준 최종 튜닝은 아직 미착수.
- `docs/source-notes/supabase-fallback-audit.md`는 audit 실행 시 자동 갱신되어 변경분이 누적될 수 있음.

### Rollback Guide
- UI/인코딩 가드 롤백:
  - `components/shared/HeatBadge.tsx`
  - `components/shared/RegionFlag.tsx`
  - `.editorconfig`
  - `.gitattributes`
  - 위 파일을 GP-20260414-52 시점으로 되돌리면 이전 상태로 복귀 가능.
