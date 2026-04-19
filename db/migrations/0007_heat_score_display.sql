-- Add display-friendly normalized heat columns without altering raw heat score.
alter table topics
  add column if not exists heat_score_display float;

alter table global_topics
  add column if not exists heat_score_display float;

create index if not exists idx_topics_region_heat_display
  on topics(region_id, heat_score_display desc);

create index if not exists idx_global_topics_heat_display
  on global_topics(heat_score_display desc);
