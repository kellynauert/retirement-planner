create table if not exists planner_saves (
  owner text primary key,
  document jsonb not null,
  updated_at timestamptz not null default now()
);
