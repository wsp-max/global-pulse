# DB Migrations

This directory is the migration source for EC2 local PostgreSQL runtime.

Current files:
- `0001_create_tables.sql`
- `0002_create_indexes.sql`

Run:
- `npm run db:init`

Notes:
- Applied migrations are tracked in `schema_migrations`.
- Re-running is idempotent.
