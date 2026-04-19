ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS burst_z FLOAT;

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS entities JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS canonical_key TEXT;

CREATE INDEX IF NOT EXISTS topics_canonical_key_idx ON topics(canonical_key);

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension is not available, embedding_json fallback will be used.';
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    BEGIN
      ALTER TABLE topics
        ADD COLUMN IF NOT EXISTS embedding vector(768);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Unable to add topics.embedding vector(768), embedding_json fallback will be used.';
    END;
  END IF;
END
$$;

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS embedding_json JSONB;
