CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    name_ko TEXT NOT NULL,
    name_en TEXT NOT NULL,
    flag_emoji TEXT NOT NULL,
    timezone TEXT NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    region_id TEXT NOT NULL REFERENCES regions(id),
    name TEXT NOT NULL,
    name_en TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('community', 'sns')),
    scrape_url TEXT NOT NULL,
    scrape_interval_minutes INTEGER NOT NULL DEFAULT 30,
    icon_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_scraped_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raw_posts (
    id BIGSERIAL PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id),
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body_preview TEXT,
    url TEXT,
    author TEXT,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    dislike_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    posted_at TIMESTAMPTZ,
    UNIQUE(source_id, external_id)
);

CREATE TABLE IF NOT EXISTS topics (
    id BIGSERIAL PRIMARY KEY,
    region_id TEXT NOT NULL REFERENCES regions(id),
    name_ko TEXT NOT NULL,
    name_en TEXT NOT NULL,
    summary_ko TEXT,
    summary_en TEXT,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    sentiment FLOAT DEFAULT 0,
    heat_score FLOAT NOT NULL DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    source_ids TEXT[] NOT NULL DEFAULT '{}',
    rank INTEGER,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS global_topics (
    id BIGSERIAL PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_ko TEXT NOT NULL,
    summary_en TEXT,
    summary_ko TEXT,
    regions TEXT[] NOT NULL DEFAULT '{}',
    regional_sentiments JSONB DEFAULT '{}',
    regional_heat_scores JSONB DEFAULT '{}',
    topic_ids BIGINT[] DEFAULT '{}',
    total_heat_score FLOAT NOT NULL DEFAULT 0,
    first_seen_region TEXT,
    first_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS heat_history (
    id BIGSERIAL PRIMARY KEY,
    region_id TEXT NOT NULL REFERENCES regions(id),
    topic_name TEXT NOT NULL,
    heat_score FLOAT NOT NULL,
    sentiment FLOAT DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS region_snapshots (
    id BIGSERIAL PRIMARY KEY,
    region_id TEXT NOT NULL REFERENCES regions(id),
    total_heat_score FLOAT NOT NULL DEFAULT 0,
    active_topics INTEGER DEFAULT 0,
    avg_sentiment FLOAT DEFAULT 0,
    top_keywords TEXT[] DEFAULT '{}',
    sources_active INTEGER DEFAULT 0,
    sources_total INTEGER DEFAULT 0,
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

