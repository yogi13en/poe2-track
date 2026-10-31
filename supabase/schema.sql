-- ══════════════════════════════════════════════════════════════
--  «Хроники Падших» — общая статистика смертей на Supabase.
--  Выполните этот файл целиком в SQL Editor проекта Supabase.
--  Схема append-only: читать может кто угодно, добавлять — кто угодно,
--  изменять и удалять через anon-ключ нельзя.
-- ══════════════════════════════════════════════════════════════

create table if not exists public.deaths (
  id          uuid primary key default gen_random_uuid(),
  char_name   text        not null check (char_length(char_name) between 2 and 32),
  class_name  text        not null check (char_length(class_name) between 2 and 24),
  ascendancy  text,
  level       smallint    not null check (level between 1 and 100),
  area        text        not null check (char_length(area) between 2 and 64),
  act         text        not null,
  cause_key   text        not null,
  cause       text        not null,
  source      text,
  damage      text,
  league      text        not null,
  hardcore    boolean     not null default false,
  note        text,
  author      text,
  author_id   text,
  created_at  timestamptz not null default now()
);

create index if not exists deaths_created_at_idx on public.deaths (created_at desc);

alter table public.deaths enable row level security;

-- чтение открыто всем (это публичная статистика)
drop policy if exists "deaths are public" on public.deaths;
create policy "deaths are public"
  on public.deaths for select
  to anon, authenticated
  using (true);

-- добавление разрешено без входа, но только валидные записи
drop policy if exists "anyone can report a death" on public.deaths;
create policy "anyone can report a death"
  on public.deaths for insert
  to anon, authenticated
  with check (
    char_length(char_name) between 2 and 32
    and char_length(area) between 2 and 64
    and level between 1 and 100
    and char_length(coalesce(note, '')) <= 500
  );

-- политик update/delete нет: изменить или стереть летопись через клиент нельзя
grant select, insert on public.deaths to anon, authenticated;
