ALTER TABLE issue_overlap_events
  ADD COLUMN IF NOT EXISTS community_first_post_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS news_first_post_at TIMESTAMPTZ;
