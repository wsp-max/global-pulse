CREATE INDEX IF NOT EXISTS idx_raw_posts_source_collected ON raw_posts(source_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_posts_collected_at ON raw_posts(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_topics_region_heat ON topics(region_id, heat_score DESC);
CREATE INDEX IF NOT EXISTS idx_topics_region_created ON topics(region_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topics_period ON topics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_global_topics_heat ON global_topics(total_heat_score DESC);
CREATE INDEX IF NOT EXISTS idx_global_topics_created ON global_topics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_heat_history_region_time ON heat_history(region_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_region_snapshots_region_time ON region_snapshots(region_id, snapshot_at DESC);
