# Supabase Cutover Checklist (Legacy Record)

## Status
- Supabase fallback runtime has already been retired.
- Current runtime mode is PostgreSQL-only.
- This file is kept for historical traceability and closure audit history.

## Verified Baseline (Post-Retirement)
```bash
cd /srv/projects/project2/global-pulse
npm run ops:supabase:audit
npm run ops:supabase:budget -- --print-json
```
- Expected:
  - audit `totalMatches: 0`
  - budget check `ok: true` with all categories `0`

## Runtime Validation (PostgreSQL-only)
```bash
curl -sS http://127.0.0.1:3000/api/health
curl -sS http://127.0.0.1:3000/api/stats
curl -sS "http://127.0.0.1:3000/api/topics?region=kr&limit=5"
```
- Expected:
  - no Supabase env requirement
  - `provider: "postgres"` when DB is configured

## Final Closure Gate
```bash
npm run ops:closure
npm run ops:verify3:check -- --print-json
```
- Expected:
  - closure `PASS`
  - `issues: []`

## Rollback Note (Emergency Only)
- If emergency rollback is required, recover Supabase fallback paths from git history.
- Any rollback must also restore:
  - `docs/source-notes/supabase-fallback-budget.json` baseline
  - corresponding patch/delivery records
