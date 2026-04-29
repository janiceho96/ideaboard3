-- ================================================================
-- Ideaboard v3 Schema
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- If you already ran the v2 schema, run only the ALTER TABLE lines.
-- ================================================================

create table if not exists boards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Untitled Board',
  owner_id    uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

create table if not exists cards (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid references boards(id) on delete cascade not null,
  title       text not null default '',
  body        text default '',
  date_label  text default '',
  due_date    date default null,         -- NEW: real date for overdue detection
  tag         text default 'idea',
  bg          text default 'white',
  x           float default 300,
  y           float default 200,
  rotation    float default 0,
  card_width  float default 185,        -- NEW: resizable width
  card_height float default null,       -- NEW: resizable height (null = auto)
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists goal_tags (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid references boards(id) on delete cascade not null,
  label       text not null default '',
  bg          text default '#6C63FF',
  color       text default 'white',
  x           float default 200,
  y           float default 200,
  created_at  timestamptz default now()
);

-- If upgrading from v2, run just these lines:
-- alter table cards add column if not exists due_date date default null;
-- alter table cards add column if not exists card_width float default 185;
-- alter table cards add column if not exists card_height float default null;

create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists cards_updated_at on cards;
create trigger cards_updated_at
  before update on cards
  for each row execute function update_updated_at();

alter table boards    enable row level security;
alter table cards     enable row level security;
alter table goal_tags enable row level security;

drop policy if exists "boards: owner full access"    on boards;
drop policy if exists "cards: board owner full access" on cards;
drop policy if exists "goal_tags: board owner full access" on goal_tags;

create policy "boards: owner full access"
  on boards for all
  using  (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "cards: board owner full access"
  on cards for all
  using  (exists (select 1 from boards where boards.id = cards.board_id and boards.owner_id = auth.uid()))
  with check (exists (select 1 from boards where boards.id = cards.board_id and boards.owner_id = auth.uid()));

create policy "goal_tags: board owner full access"
  on goal_tags for all
  using  (exists (select 1 from boards where boards.id = goal_tags.board_id and boards.owner_id = auth.uid()))
  with check (exists (select 1 from boards where boards.id = goal_tags.board_id and boards.owner_id = auth.uid()));
