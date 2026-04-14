# Supabase Fallback Audit

- generated_at: 2026-04-14T14:52:44.669Z
- total_matches: 0

## Match Counts By Type
- createSupabaseServiceClient: 0
- getSupabaseServiceClientOrNull: 0
- ENABLE_SUPABASE_FALLBACK: 0
- SUPABASE_ENV: 0

## Retirement Status
All tracked Supabase fallback references are retired in runtime code.

## Guard Checklist
1. Keep `docs/source-notes/supabase-fallback-budget.json` baseline at `0`.
2. Run `npm run ops:supabase:audit` and `npm run ops:supabase:budget -- --print-json` after major refactors.
3. Treat any new match as a regression unless explicitly approved.

## API Fallback Paths
Routes and API shared modules still referencing Supabase fallback.
- (none)

## Batch/Script Fallback Paths
Collector/analyzer/ops scripts referencing Supabase service client paths.
- (none)

## Shared Core
Shared Supabase client and fallback flag handling.
- (none)

## Other References
Non-core references requiring manual review.
- (none)
