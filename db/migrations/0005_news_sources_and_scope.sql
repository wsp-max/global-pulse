ALTER TABLE sources
  DROP CONSTRAINT IF EXISTS sources_type_check;

ALTER TABLE sources
  ADD CONSTRAINT sources_type_check
  CHECK (type IN ('community', 'sns', 'news'));

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS news_category TEXT,
  ADD COLUMN IF NOT EXISTS trust_tier SMALLINT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS feed_kind TEXT,
  ADD COLUMN IF NOT EXISTS metro_hint TEXT;

ALTER TABLE sources
  DROP CONSTRAINT IF EXISTS sources_news_category_check;

ALTER TABLE sources
  ADD CONSTRAINT sources_news_category_check
  CHECK (
    news_category IS NULL OR news_category IN (
      'wire_service',
      'newspaper',
      'broadcaster',
      'portal',
      'business_media',
      'tech_media',
      'tabloid',
      'magazine',
      'local_news'
    )
  );

ALTER TABLE sources
  DROP CONSTRAINT IF EXISTS sources_feed_kind_check;

ALTER TABLE sources
  ADD CONSTRAINT sources_feed_kind_check
  CHECK (feed_kind IS NULL OR feed_kind IN ('rss', 'atom', 'json', 'html_ranking'));

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'community';

ALTER TABLE topics
  DROP CONSTRAINT IF EXISTS topics_scope_check;

ALTER TABLE topics
  ADD CONSTRAINT topics_scope_check
  CHECK (scope IN ('community', 'news', 'mixed'));

ALTER TABLE global_topics
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'community';

ALTER TABLE global_topics
  DROP CONSTRAINT IF EXISTS global_topics_scope_check;

ALTER TABLE global_topics
  ADD CONSTRAINT global_topics_scope_check
  CHECK (scope IN ('community', 'news', 'mixed'));

ALTER TABLE region_snapshots
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'community';

ALTER TABLE region_snapshots
  DROP CONSTRAINT IF EXISTS region_snapshots_scope_check;

ALTER TABLE region_snapshots
  ADD CONSTRAINT region_snapshots_scope_check
  CHECK (scope IN ('community', 'news', 'mixed'));

CREATE TABLE IF NOT EXISTS portal_ranking_signals (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  region_id TEXT NOT NULL REFERENCES regions(id),
  rank INTEGER NOT NULL,
  headline TEXT NOT NULL,
  url TEXT,
  view_count INTEGER,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_ranking_signals_region_time_idx
  ON portal_ranking_signals(region_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS issue_overlaps (
  id BIGSERIAL PRIMARY KEY,
  community_topic_id BIGINT REFERENCES topics(id) ON DELETE CASCADE,
  news_topic_id BIGINT REFERENCES topics(id) ON DELETE CASCADE,
  canonical_key TEXT,
  cosine FLOAT,
  lag_minutes INTEGER,
  leader TEXT CHECK (leader IN ('community', 'news', 'tie')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(community_topic_id, news_topic_id)
);

CREATE INDEX IF NOT EXISTS topics_scope_region_idx ON topics(scope, region_id);
CREATE INDEX IF NOT EXISTS global_topics_scope_idx ON global_topics(scope);
CREATE INDEX IF NOT EXISTS sources_type_cat_idx ON sources(type, news_category);
CREATE INDEX IF NOT EXISTS issue_overlaps_detected_idx ON issue_overlaps(detected_at DESC);
CREATE INDEX IF NOT EXISTS issue_overlaps_canonical_idx ON issue_overlaps(canonical_key);
