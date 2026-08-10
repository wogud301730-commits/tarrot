-- tarot-app 데이터베이스 스키마
-- 출처: docs/02-database-schema.md — 이 파일과 그 문서가 어긋나면 안 됨(AGENTS.md §6).
-- 실행 방법: Supabase 대시보드 > SQL Editor > 새 쿼리 > 이 파일 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전하도록(idempotent) IF NOT EXISTS / DROP POLICY IF EXISTS를 사용한다.

-- ────────────────────────────────────────────────────────────
-- 1. cards (78개 행 — 공개 참고자료)
-- ────────────────────────────────────────────────────────────
create table if not exists public.cards (
  id serial primary key,
  name_en text not null unique,
  name_ko text not null,
  arcana text not null check (arcana in ('major', 'minor')),
  suit text check (suit in ('wands', 'cups', 'swords', 'pentacles')),
  number int not null,
  upright_keywords text[] not null,
  reversed_keywords text[] not null,
  upright_meaning text not null,
  reversed_meaning text not null,
  image_key text not null
);

-- ────────────────────────────────────────────────────────────
-- 2. spreads (2개 행)
-- ────────────────────────────────────────────────────────────
create table if not exists public.spreads (
  id serial primary key,
  code text not null unique,
  name_ko text not null,
  description text not null,
  position_count int not null,
  position_labels text[] not null
);

-- ────────────────────────────────────────────────────────────
-- 3. readings
-- ────────────────────────────────────────────────────────────
create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  spread_id int not null references public.spreads(id),
  question text,
  created_at timestamptz not null default now()
);

create index if not exists idx_readings_session_id on public.readings(session_id);

-- ────────────────────────────────────────────────────────────
-- 4. reading_cards
-- ────────────────────────────────────────────────────────────
create table if not exists public.reading_cards (
  id serial primary key,
  reading_id uuid not null references public.readings(id) on delete cascade,
  position_index int not null,
  card_id int not null references public.cards(id),
  orientation text not null check (orientation in ('upright', 'reversed'))
);

create index if not exists idx_reading_cards_reading_id on public.reading_cards(reading_id);

-- ────────────────────────────────────────────────────────────
-- 5. reading_interpretations
-- ────────────────────────────────────────────────────────────
create table if not exists public.reading_interpretations (
  id serial primary key,
  reading_id uuid not null unique references public.readings(id) on delete cascade,
  summary text,
  full_text text,
  model_name text,
  created_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- RLS 활성화 (docs/02 §3) — 기본은 전체 거부, 명시한 것만 허용
-- ────────────────────────────────────────────────────────────
alter table public.cards enable row level security;
alter table public.spreads enable row level security;
alter table public.readings enable row level security;
alter table public.reading_cards enable row level security;
alter table public.reading_interpretations enable row level security;

-- cards, spreads: anon에게 SELECT만 허용 (공개 참고자료)
drop policy if exists "cards_public_read" on public.cards;
create policy "cards_public_read"
  on public.cards for select
  to anon
  using (true);

drop policy if exists "spreads_public_read" on public.spreads;
create policy "spreads_public_read"
  on public.spreads for select
  to anon
  using (true);

-- readings / reading_cards / reading_interpretations: 정책 없음 → anon/authenticated 모두 거부.
-- service_role 키(서버 전용, api/*.js)는 RLS를 우회하므로 별도 정책이 필요 없다.
