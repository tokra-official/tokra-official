-- =====================================================================
--  TOKRA — Crypto & Gold Market Intelligence Platform
--  Backup schema: run this in the Supabase SQL Editor.
--  Tables, indexes, and Row Level Security (RLS) policies.
-- =====================================================================

-- ============================== CATEGORIES ==============================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- ================================ POSTS =================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  category_id uuid references public.categories(id) on delete set null,
  market_type text not null default 'general' check (market_type in ('crypto','gold','general')),
  sentiment text not null default 'neutral' check (sentiment in ('bullish','bearish','neutral')),
  is_highlighted boolean not null default false,
  featured_image text,
  views integer not null default 0,
  created_at timestamptz not null default now()
);

-- =========================== BREAKING ALERTS ============================
create table if not exists public.breaking_alerts (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  link_url text,
  badge_type text not null default 'BREAKING' check (badge_type in ('URGENT','BULLISH','BEARISH','BREAKING')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =============================== PROFILES ===============================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  role text not null default 'reader' check (role in ('admin','reader')),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ============================== INDEXES =================================
create index if not exists idx_posts_category_id on public.posts(category_id);
create index if not exists idx_posts_created_at on public.posts(created_at desc);
create index if not exists idx_posts_market_type on public.posts(market_type);
create index if not exists idx_posts_sentiment on public.posts(sentiment);
create index if not exists idx_posts_highlighted on public.posts(is_highlighted) where is_highlighted = true;
create index if not exists idx_breaking_alerts_active on public.breaking_alerts(is_active, created_at desc);
create index if not exists idx_profiles_role on public.profiles(role);

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================
alter table public.categories enable row level security;
alter table public.posts enable row level security;
alter table public.breaking_alerts enable row level security;
alter table public.profiles enable row level security;

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------- CATEGORIES ------------------------------
create policy "Categories are publicly readable"
  on public.categories for select
  using (true);

create policy "Only admins can insert categories"
  on public.categories for insert
  with check (public.is_admin());

create policy "Only admins can update categories"
  on public.categories for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Only admins can delete categories"
  on public.categories for delete
  using (public.is_admin());

-- ------------------------------- POSTS ---------------------------------
create policy "Posts are publicly readable"
  on public.posts for select
  using (true);

create policy "Only admins can insert posts"
  on public.posts for insert
  with check (public.is_admin());

create policy "Only admins can update posts"
  on public.posts for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Only admins can delete posts"
  on public.posts for delete
  using (public.is_admin());

-- -------------------------- BREAKING ALERTS ----------------------------
create policy "Active breaking alerts are publicly readable"
  on public.breaking_alerts for select
  using (is_active = true or public.is_admin());

create policy "Only admins can insert breaking alerts"
  on public.breaking_alerts for insert
  with check (public.is_admin());

create policy "Only admins can update breaking alerts"
  on public.breaking_alerts for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Only admins can delete breaking alerts"
  on public.breaking_alerts for delete
  using (public.is_admin());

-- ------------------------------ PROFILES -------------------------------
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

create policy "Only admins can delete profiles"
  on public.profiles for delete
  using (public.is_admin());

-- =====================================================================
--  AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
--  SEED CATEGORIES
-- =====================================================================
insert into public.categories (name, slug) values
  ('Crypto Spot', 'crypto-spot'),
  ('Crypto Futures', 'crypto-futures'),
  ('Gold Spot', 'gold-spot'),
  ('Gold Futures', 'gold-futures'),
  ('SMC Analysis', 'smc-analysis'),
  ('Market News', 'market-news')
on conflict (slug) do nothing;
