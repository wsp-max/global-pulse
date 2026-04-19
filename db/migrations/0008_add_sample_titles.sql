alter table topics
  add column if not exists sample_titles text[] not null default '{}';

create index if not exists idx_topics_region_created_scope
  on topics(region_id, created_at desc, scope);
