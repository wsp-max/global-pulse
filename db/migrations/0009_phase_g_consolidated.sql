ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS sentiment_distribution JSONB,
  ADD COLUMN IF NOT EXISTS sentiment_reasoning_ko TEXT,
  ADD COLUMN IF NOT EXISTS sentiment_reasoning_en TEXT,
  ADD COLUMN IF NOT EXISTS anomaly_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT,
  ADD COLUMN IF NOT EXISTS source_diversity DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dominant_source_share DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS representative_excerpts JSONB;

CREATE TABLE IF NOT EXISTS topic_baseline_daily (
  region_id TEXT,
  category TEXT,
  day DATE,
  heat_mean DOUBLE PRECISION,
  heat_std DOUBLE PRECISION,
  PRIMARY KEY (region_id, category, day)
);

CREATE TABLE IF NOT EXISTS collector_runs (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status TEXT,
  fetched_count INT,
  inserted_count INT,
  error_code TEXT,
  error_message TEXT,
  latency_ms INT
);

CREATE INDEX IF NOT EXISTS idx_collector_runs_source_time
  ON collector_runs(source_id, started_at DESC);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings_audit (
  id BIGSERIAL PRIMARY KEY,
  key TEXT,
  before JSONB,
  after JSONB,
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);
