ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS burst_z FLOAT;

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS entities JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS canonical_key TEXT;

CREATE INDEX IF NOT EXISTS topics_canonical_key_idx ON topics(canonical_key);
