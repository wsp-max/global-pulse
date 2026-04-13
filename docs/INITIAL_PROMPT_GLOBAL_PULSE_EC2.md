# GLOBAL PULSE - 단일 EC2 운영형 전 세계 커뮤니티 & SNS 여론 모니터링 대시보드

> 수정일: 2026-04-12
> 목적: Codex / Claude 같은 코딩 에이전트에게 바로 넣어서 단계적으로 구현시키기 위한 상세 실행 프롬프트
> 전제: 서버리스(Vercel / Cloudflare Workers / GitHub Actions schedule / Supabase 런타임 의존) 구조를 제거하고, **단일 EC2 인스턴스 중심 아키텍처**로 재설계한다.

---

## 1) 너의 역할

너는 시니어 풀스택 엔지니어이자 데브옵스 엔지니어다.  
이 프로젝트를 **실제로 실행 가능한 수준의 코드와 인프라 설정 파일**까지 포함해 단계적으로 구현해야 한다.

중요 작업 원칙:

1. **절대 한 번에 전부 구현하지 말고 Step 단위로 진행한다.**
2. 각 Step이 끝날 때마다:
   - 변경한 파일 목록
   - 핵심 구현 내용
   - 실행 명령어
   - 테스트 결과
   - 다음 Step에서 할 일
   을 명확히 정리한다.
3. 이전 Step 결과를 다음 Step 컨텍스트에 반드시 반영한다.
4. 애매한 부분이 있어도 불필요하게 질문만 던지지 말고, **합리적인 가정을 명시한 뒤 진행**한다.
5. 실제 크롤러 구현 전에는 **대상 사이트의 실제 DOM / 응답 구조를 확인한 뒤 셀렉터를 작성**한다.
6. 구현 후 반드시 스크래퍼 단위 테스트를 실행한다.
7. 모든 코드는 TypeScript 기준으로 작성하고, `strict` 모드를 유지한다.
8. 단일 EC2 운영을 전제로 하므로, **웹 요청 처리와 배치 수집/분석 작업을 분리**한다.
9. 페이지 요청 시 실시간 스크래핑을 절대 하지 말고, **DB에 저장된 결과만 조회**한다.
10. 장기적으로 확장 가능해야 하지만, 현재 목표는 **단일 EC2에서 안정적으로 돌아가는 MVP**다.

---

## 2) 프로젝트 개요

"Global Pulse"는 전 세계 주요 인터넷 커뮤니티와 SNS에서 실시간으로 핫 토픽을 수집·분석·시각화하는 웹 애플리케이션이다.

핵심 가치:

- 한국 디시인사이드, 일본 5ch, 미국 Reddit 같은 일반 커뮤니티의 실시간 화제를 한눈에 시각화
- 동일 이슈가 국가별로 어떻게 다르게 반응하는지 비교
- 공식 뉴스가 아닌 사용자 여론의 온도계를 제공
- “뉴스 요약”이 아니라 **커뮤니티/SNS 집단 반응의 흐름**을 보여주는 것이 핵심

---

## 3) 아키텍처 핵심 결정 사항

이 프로젝트는 더 이상 서버리스가 아니다.  
다음 구성 요소를 **단일 EC2 인스턴스 안에서 운영**한다.

### 단일 EC2에 포함할 것

- Next.js 웹 애플리케이션
- API Route / Route Handler
- 수집기(collector) 배치 작업
- 분석기(analyzer) 배치 작업
- PostgreSQL 데이터베이스
- Nginx 리버스 프록시
- systemd 서비스 및 systemd timer
- 로그 파일 / journald
- 백업/정리 스크립트

### 금지 / 제거 대상

다음에 의존하지 않는다.

- Vercel 배포 전제
- Cloudflare Workers 크론
- GitHub Actions schedule 기반 운영
- Supabase 런타임/DB 전제
- Edge Function 전제
- 요청 시점의 서버리스 실행 모델

### 허용 범위

- GitHub는 소스코드 저장소로 사용 가능
- GitHub Actions는 선택적으로 lint/test CI 용도로만 사용 가능
- 외부 API는 필요 최소한으로 사용 가능
  - Gemini API
  - YouTube API
  - Reddit API(optional)
  - Telegram/Mastodon 공개 엔드포인트 등

---

## 4) 인프라 전제

### 서버 전제

- AWS EC2 Ubuntu 22.04 LTS
- 권장 스펙: **t3.medium 이상**
  - 2 vCPU
  - 4GB RAM 이상
  - 30GB 이상 gp3 디스크
- 초기 MVP는 단일 인스턴스 운영
- PostgreSQL은 같은 인스턴스 내부에 로컬 설치
- DB 포트는 외부에 노출하지 않는다
- Security Group:
  - 80/443: 공개
  - 22: 관리자 IP만 허용
  - 5432: 외부 비공개

### 런타임 구조

- Nginx → Next.js Node 서버(127.0.0.1:3000)
- PostgreSQL 로컬
- 배치 작업은 systemd one-shot service + systemd timer
- 웹 서버도 systemd 서비스로 관리
- 로그는 journald + 파일 로깅 병행 가능
- Puppeteer/Chromium이 필요한 스크래퍼는 동시 실행 수를 엄격히 제한

---

## 5) 기술 스택

## 프론트엔드

- Next.js 14+ (App Router)
- React
- TypeScript
- Tailwind CSS + CSS Variables
- Recharts 우선, 필요한 경우에만 D3.js 일부 사용
- react-simple-maps
- Framer Motion
- Lucide React
- Google Fonts
  - Space Mono
  - Noto Sans KR
  - Noto Sans JP
  - JetBrains Mono

## 백엔드 / 수집 / 분석

- Node.js 20 LTS
- TypeScript
- pnpm workspace
- PostgreSQL
- Drizzle ORM 또는 SQL 중심 접근 중 하나를 선택하되, **쿼리와 스키마가 명확히 드러나게 구현**
- zod (환경변수, API 쿼리 검증)
- pino (로깅)
- axios
- cheerio
- puppeteer-core + 시스템 Chromium
- iconv-lite (EUC-JP 대응)
- natural (TF-IDF)
- Gemini API (토픽 요약/분류)
- date-fns 또는 dayjs

## 프로세스 / 배포 / 운영

- Nginx
- systemd
- systemd timers
- bash deploy script
- pg_dump backup script
- cron은 가능하면 쓰지 말고 **systemd timer 우선**

---

## 6) 디렉토리 구조

다음 구조를 기준으로 구현한다.

```text
.
├─ app/                           # Next.js App Router
│  ├─ api/
│  │  ├─ topics/route.ts
│  │  ├─ global-topics/route.ts
│  │  ├─ regions/route.ts
│  │  ├─ timeline/route.ts
│  │  ├─ search/route.ts
│  │  ├─ stats/route.ts
│  │  └─ health/route.ts
│  ├─ regions/[region]/page.tsx
│  ├─ global/page.tsx
│  ├─ timeline/page.tsx
│  ├─ search/page.tsx
│  ├─ layout.tsx
│  └─ page.tsx
├─ components/
│  ├─ layout/
│  ├─ dashboard/
│  ├─ region/
│  ├─ topic/
│  ├─ shared/
│  └─ charts/
├─ lib/
│  ├─ db/
│  ├─ api/
│  ├─ hooks/
│  ├─ utils/
│  ├─ constants/
│  ├─ validators/
│  └─ logger/
├─ packages/
│  ├─ collector/
│  │  ├─ src/
│  │  │  ├─ core/
│  │  │  ├─ scrapers/
│  │  │  │  ├─ kr/
│  │  │  │  ├─ jp/
│  │  │  │  ├─ tw/
│  │  │  │  ├─ cn/
│  │  │  │  ├─ us/
│  │  │  │  └─ sns/
│  │  │  ├─ normalizers/
│  │  │  ├─ clients/
│  │  │  ├─ types/
│  │  │  └─ index.ts
│  ├─ analyzer/
│  │  ├─ src/
│  │  │  ├─ keywords/
│  │  │  ├─ clustering/
│  │  │  ├─ sentiment/
│  │  │  ├─ summarizer/
│  │  │  ├─ cross-region/
│  │  │  ├─ heat/
│  │  │  └─ index.ts
│  └─ shared/
│     ├─ src/
│     │  ├─ types/
│     │  ├─ constants/
│     │  ├─ regions/
│     │  └─ schemas/
├─ db/
│  ├─ migrations/
│  ├─ seeds/
│  └─ schema/
├─ infra/
│  ├─ nginx/
│  │  └─ global-pulse.conf
│  └─ systemd/
│     ├─ global-pulse-web.service
│     ├─ global-pulse-collector.service
│     ├─ global-pulse-collector.timer
│     ├─ global-pulse-analyzer.service
│     ├─ global-pulse-analyzer.timer
│     ├─ global-pulse-snapshot.service
│     ├─ global-pulse-snapshot.timer
│     ├─ global-pulse-cleanup.service
│     └─ global-pulse-cleanup.timer
├─ scripts/
│  ├─ test-scraper.ts
│  ├─ run-collector.ts
│  ├─ run-analyzer.ts
│  ├─ build-snapshots.ts
│  ├─ cleanup-old-data.ts
│  ├─ deploy-ec2.sh
│  ├─ backup-db.sh
│  └─ health-check.sh
├─ docs/
│  ├─ architecture.md
│  ├─ deployment-ec2.md
│  ├─ operations.md
│  └─ source-notes/
├─ public/
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.json
└─ next.config.js
```
