CREATE TABLE IF NOT EXISTS issue_overlap_events (
  id BIGSERIAL PRIMARY KEY,
  analyzer_run_at TIMESTAMPTZ NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  region_id TEXT NOT NULL REFERENCES regions(id),
  leader TEXT CHECK (leader IN ('community', 'news', 'tie')),
  lag_minutes INTEGER,
  cosine DOUBLE PRECISION,
  canonical_key TEXT,
  community_topic_id BIGINT REFERENCES topics(id) ON DELETE SET NULL,
  news_topic_id BIGINT REFERENCES topics(id) ON DELETE SET NULL,
  community_topic_name_ko TEXT,
  community_topic_name_en TEXT,
  news_topic_name_ko TEXT,
  news_topic_name_en TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS issue_overlap_events_run_topic_uq
  ON issue_overlap_events(analyzer_run_at, community_topic_id, news_topic_id);

CREATE INDEX IF NOT EXISTS issue_overlap_events_detected_idx
  ON issue_overlap_events(detected_at DESC);

CREATE INDEX IF NOT EXISTS issue_overlap_events_leader_detected_idx
  ON issue_overlap_events(leader, detected_at DESC);

CREATE INDEX IF NOT EXISTS issue_overlap_events_region_detected_idx
  ON issue_overlap_events(region_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS issue_overlap_events_canonical_idx
  ON issue_overlap_events(canonical_key);
