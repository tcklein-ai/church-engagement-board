create extension if not exists "pgcrypto";

-- 1. workflows (swimlane rows)
create table if not exists pc_workflow_workflows (
  id            uuid primary key default gen_random_uuid(),
  pco_id        text unique not null,
  name          text not null,
  color         text default '#6366f1',
  position      integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. steps (native PCO workflow steps, mapped to a universal board column)
create type board_column as enum (
  'new',
  'action_required',
  'waiting',
  'completed'
);

create table if not exists pc_workflow_steps (
  id            uuid primary key default gen_random_uuid(),
  workflow_id   uuid not null references pc_workflow_workflows(id) on delete cascade,
  pco_id        text not null,
  name          text not null,
  board_column  board_column not null default 'new',
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (workflow_id, pco_id)
);

-- 3. cards (the kanban cards)
create table if not exists pc_workflow_cards (
  id                uuid primary key default gen_random_uuid(),
  pco_id            text unique not null,
  workflow_id       uuid not null references pc_workflow_workflows(id) on delete cascade,
  step_id           uuid references pc_workflow_steps(id) on delete set null,
  board_column      board_column not null default 'new',

  person_name       text not null,
  person_avatar_url text,
  assignee_name     text,
  note              text,

  snoozed_until     timestamptz,
  flagged           boolean not null default false,

  pco_created_at    timestamptz,
  pco_updated_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_pc_cards_workflow_column on pc_workflow_cards (workflow_id, board_column);
create index if not exists idx_pc_cards_step on pc_workflow_cards (step_id);
create index if not exists idx_pc_steps_workflow on pc_workflow_steps (workflow_id);

-- 4. updated_at triggers
create or replace function set_pc_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_pc_workflows_updated_at on pc_workflow_workflows;
create trigger trg_pc_workflows_updated_at
  before update on pc_workflow_workflows
  for each row execute function set_pc_updated_at();

drop trigger if exists trg_pc_cards_updated_at on pc_workflow_cards;
create trigger trg_pc_cards_updated_at
  before update on pc_workflow_cards
  for each row execute function set_pc_updated_at();

-- 5. Row Level Security
alter table pc_workflow_workflows enable row level security;
alter table pc_workflow_steps enable row level security;
alter table pc_workflow_cards enable row level security;

create policy "Public read access on pc_workflows"
  on pc_workflow_workflows for select using (true);

create policy "Public read access on pc_steps"
  on pc_workflow_steps for select using (true);

create policy "Public read access on pc_cards"
  on pc_workflow_cards for select using (true);

-- 6. Enable Realtime and Full Replica Identity for TV updates
alter publication supabase_realtime add table pc_workflow_cards, pc_workflow_steps;
alter table pc_workflow_cards replica identity full;
alter table pc_workflow_steps replica identity full;