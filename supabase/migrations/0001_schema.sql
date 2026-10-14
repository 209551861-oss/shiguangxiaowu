-- ============================================================
-- 拾光事务所 · Phase 1 · 数据库初始化（schema + RLS）
-- 适用：Supabase（PostgreSQL 15+）
-- 用法：Supabase 控制台 → SQL Editor → 全选本文件 → Run
-- 设计依据：拾光数据库设计文档 V1.0 + 实施方案（已确认决策）
--   单用户 / 默认公开 / 原图签名 URL 保护
-- ============================================================

-- ---------- 0. 扩展与枚举（可重复执行） ----------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

do $$
begin
  if not exists (select 1 from pg_type where typname = 'visibility') then
    create type visibility as enum ('public', 'private', 'draft');
  end if;
end $$;

-- ---------- 1. 通用触发器函数 ----------
-- 自动维护 updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 自动填充 owner_id（单用户：登录者即站长）
create or replace function public.set_owner_id()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is null then
    new.owner_id = auth.uid();
  end if;
  return new;
end;
$$;

-- 新用户注册时自动建 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, split_part(new.email, '@', 1), split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ============================================================
-- 2. 表结构（12 张）
-- ============================================================

-- 2.1 profiles（与 auth.users 一一对应，即站长本人）
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text unique,
  display_name text,
  bio          text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2.2 categories（多模块共用的分类树）
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  module     text not null,               -- notes / library / atelier / gallery / articles
  parent_id  uuid references public.categories (id) on delete set null,
  sort_order int  not null default 0,
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.3 notes（学习档案室）
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  summary     text,
  content     text,                       -- markdown 正文
  category_id uuid references public.categories (id) on delete set null,
  cover_url   text,
  visibility  visibility not null default 'public',
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2.4 resources（资料库：外链 / 附件）
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  url         text,                        -- 外链地址（可选）
  description text,
  category_id uuid references public.categories (id) on delete set null,
  file_type   text,                        -- pdf / doc / link ...
  visibility  visibility not null default 'public',
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2.5 artworks（创作工坊：作品条目）
create table if not exists public.artworks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  cover_url   text,                        -- 展示图（公开桶）
  category_id uuid references public.categories (id) on delete set null,
  visibility  visibility not null default 'public',
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2.6 artwork_files（原作文件：原图一律入 private 桶）
create table if not exists public.artwork_files (
  id         uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  file_path  text not null,                -- private 桶内路径，永不对外明文返回
  file_name  text,
  file_size  bigint,
  mime_type  text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 2.7 albums（相册容器）
create table if not exists public.albums (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  cover_url   text,
  visibility  visibility not null default 'public',
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2.8 photos（图片记录：原图入 private 桶）
create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid references public.albums (id) on delete set null,
  file_path    text not null,              -- private 桶内原始路径
  thumbnail_url text,                      -- 展示缩略图（gallery 公开桶）
  caption      text,
  taken_at     date,
  visibility   visibility not null default 'public',
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2.9 moments（瞬间记录，轻量图文）
create table if not exists public.moments (
  id         uuid primary key default gen_random_uuid(),
  content    text,
  location   text,
  mood       text,
  images     jsonb default '[]'::jsonb,    -- 数组：每张含 thumbnail + private_path
  visibility visibility not null default 'public',
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.10 timeline_events（成长时间轴）
create table if not exists public.timeline_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  happened_at date not null,
  description text,
  icon        text,                        -- 图标名 / emoji
  visibility  visibility not null default 'public',
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2.11 articles（文章，重 SEO）
create table if not exists public.articles (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  slug        text not null unique,
  content     text,                        -- markdown 正文
  cover_url   text,
  published_at timestamptz,
  visibility  visibility not null default 'public',
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2.12 settings（网站级配置）
create table if not exists public.settings (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 3. 全文检索向量（notes / articles / resources）
-- ============================================================
alter table public.notes
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('simple',
      coalesce(title, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce(content, ''))
  ) stored;

alter table public.articles
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('simple',
      coalesce(title, '') || ' ' ||
      coalesce(content, ''))
  ) stored;

alter table public.resources
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('simple',
      coalesce(title, '') || ' ' ||
      coalesce(description, ''))
  ) stored;

-- ============================================================
-- 4. 索引
-- ============================================================
create index if not exists idx_categories_module     on public.categories (module);
create index if not exists idx_categories_parent     on public.categories (parent_id);
create index if not exists idx_notes_visibility      on public.notes (visibility);
create index if not exists idx_notes_category       on public.notes (category_id);
create index if not exists idx_notes_search         on public.notes using gin (search_vector);
create index if not exists idx_resources_visibility  on public.resources (visibility);
create index if not exists idx_resources_search     on public.resources using gin (search_vector);
create index if not exists idx_artworks_visibility   on public.artworks (visibility);
create index if not exists idx_artwork_files_art    on public.artwork_files (artwork_id);
create index if not exists idx_albums_visibility    on public.albums (visibility);
create index if not exists idx_photos_album         on public.photos (album_id);
create index if not exists idx_photos_visibility    on public.photos (visibility);
create index if not exists idx_moments_visibility   on public.moments (visibility);
create index if not exists idx_moments_created      on public.moments (created_at desc);
create index if not exists idx_timeline_visibility  on public.timeline_events (visibility);
create index if not exists idx_timeline_happened    on public.timeline_events (happened_at);
create index if not exists idx_articles_slug        on public.articles (slug);
create index if not exists idx_articles_visibility  on public.articles (visibility);
create index if not exists idx_articles_search      on public.articles using gin (search_vector);
create index if not exists idx_articles_published   on public.articles (published_at desc);

-- ============================================================
-- 5. 触发器绑定（updated_at / owner_id）
-- 先 drop if exists 再 create，保证脚本可重复执行（幂等）
-- ============================================================
drop trigger if exists trg_profiles_updated   on public.profiles;
drop trigger if exists trg_categories_updated on public.categories;
drop trigger if exists trg_categories_owner   on public.categories;
drop trigger if exists trg_notes_updated      on public.notes;
drop trigger if exists trg_notes_owner        on public.notes;
drop trigger if exists trg_resources_updated  on public.resources;
drop trigger if exists trg_resources_owner    on public.resources;
drop trigger if exists trg_artworks_updated   on public.artworks;
drop trigger if exists trg_artworks_owner     on public.artworks;
drop trigger if exists trg_albums_updated     on public.albums;
drop trigger if exists trg_albums_owner       on public.albums;
drop trigger if exists trg_photos_updated     on public.photos;
drop trigger if exists trg_photos_owner       on public.photos;
drop trigger if exists trg_moments_updated    on public.moments;
drop trigger if exists trg_moments_owner      on public.moments;
drop trigger if exists trg_timeline_updated   on public.timeline_events;
drop trigger if exists trg_timeline_owner     on public.timeline_events;
drop trigger if exists trg_articles_updated   on public.articles;
drop trigger if exists trg_articles_owner     on public.articles;
drop trigger if exists trg_settings_updated   on public.settings;
drop trigger if exists on_auth_user_created    on auth.users;

create trigger trg_profiles_updated   before update on public.profiles     for each row execute function public.set_updated_at();
create trigger trg_categories_updated before update on public.categories   for each row execute function public.set_updated_at();
create trigger trg_categories_owner   before insert on public.categories   for each row execute function public.set_owner_id();
create trigger trg_notes_updated      before update on public.notes        for each row execute function public.set_updated_at();
create trigger trg_notes_owner        before insert on public.notes        for each row execute function public.set_owner_id();
create trigger trg_resources_updated  before update on public.resources    for each row execute function public.set_updated_at();
create trigger trg_resources_owner    before insert on public.resources    for each row execute function public.set_owner_id();
create trigger trg_artworks_updated   before update on public.artworks     for each row execute function public.set_updated_at();
create trigger trg_artworks_owner     before insert on public.artworks     for each row execute function public.set_owner_id();
create trigger trg_albums_updated     before update on public.albums       for each row execute function public.set_updated_at();
create trigger trg_albums_owner       before insert on public.albums       for each row execute function public.set_owner_id();
create trigger trg_photos_updated     before update on public.photos       for each row execute function public.set_updated_at();
create trigger trg_photos_owner       before insert on public.photos       for each row execute function public.set_owner_id();
create trigger trg_moments_updated    before update on public.moments      for each row execute function public.set_updated_at();
create trigger trg_moments_owner      before insert on public.moments      for each row execute function public.set_owner_id();
create trigger trg_timeline_updated   before update on public.timeline_events for each row execute function public.set_updated_at();
create trigger trg_timeline_owner     before insert on public.timeline_events for each row execute function public.set_owner_id();
create trigger trg_articles_updated   before update on public.articles     for each row execute function public.set_updated_at();
create trigger trg_articles_owner     before insert on public.articles     for each row execute function public.set_owner_id();
create trigger trg_settings_updated   before update on public.settings      for each row execute function public.set_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 6. 行级安全（RLS）
-- 模型：public 匿名可读、仅站长可写；private/draft 仅站长可读写
-- ============================================================

-- 6.1 启用 RLS
alter table public.profiles         enable row level security;
alter table public.categories       enable row level security;
alter table public.notes            enable row level security;
alter table public.resources        enable row level security;
alter table public.artworks         enable row level security;
alter table public.artwork_files    enable row level security;
alter table public.albums           enable row level security;
alter table public.photos           enable row level security;
alter table public.moments          enable row level security;
alter table public.timeline_events  enable row level security;
alter table public.articles         enable row level security;
alter table public.settings         enable row level security;

-- 6.2 内容表通用策略（notes / resources / artworks / albums / photos / moments / timeline_events / articles）
-- 匿名可读公开内容
drop policy if exists "content_public_read" on public.notes;
create policy "content_public_read" on public.notes for select to anon, authenticated
  using (visibility = 'public');
drop policy if exists "content_owner_read"  on public.notes;
create policy "content_owner_read"  on public.notes for select to authenticated
  using (owner_id = auth.uid());
drop policy if exists "content_owner_write" on public.notes;
create policy "content_owner_write" on public.notes for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "content_public_read" on public.resources;
create policy "content_public_read" on public.resources for select to anon, authenticated
  using (visibility = 'public');
drop policy if exists "content_owner_read"  on public.resources;
create policy "content_owner_read"  on public.resources for select to authenticated
  using (owner_id = auth.uid());
drop policy if exists "content_owner_write" on public.resources;
create policy "content_owner_write" on public.resources for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "content_public_read" on public.artworks;
create policy "content_public_read" on public.artworks for select to anon, authenticated
  using (visibility = 'public');
drop policy if exists "content_owner_read"  on public.artworks;
create policy "content_owner_read"  on public.artworks for select to authenticated
  using (owner_id = auth.uid());
drop policy if exists "content_owner_write" on public.artworks;
create policy "content_owner_write" on public.artworks for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "content_public_read" on public.albums;
create policy "content_public_read" on public.albums for select to anon, authenticated
  using (visibility = 'public');
drop policy if exists "content_owner_read"  on public.albums;
create policy "content_owner_read"  on public.albums for select to authenticated
  using (owner_id = auth.uid());
drop policy if exists "content_owner_write" on public.albums;
create policy "content_owner_write" on public.albums for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "content_public_read" on public.photos;
create policy "content_public_read" on public.photos for select to anon, authenticated
  using (visibility = 'public');
drop policy if exists "content_owner_read"  on public.photos;
create policy "content_owner_read"  on public.photos for select to authenticated
  using (owner_id = auth.uid());
drop policy if exists "content_owner_write" on public.photos;
create policy "content_owner_write" on public.photos for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "content_public_read" on public.moments;
create policy "content_public_read" on public.moments for select to anon, authenticated
  using (visibility = 'public');
drop policy if exists "content_owner_read"  on public.moments;
create policy "content_owner_read"  on public.moments for select to authenticated
  using (owner_id = auth.uid());
drop policy if exists "content_owner_write" on public.moments;
create policy "content_owner_write" on public.moments for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "content_public_read" on public.timeline_events;
create policy "content_public_read" on public.timeline_events for select to anon, authenticated
  using (visibility = 'public');
drop policy if exists "content_owner_read"  on public.timeline_events;
create policy "content_owner_read"  on public.timeline_events for select to authenticated
  using (owner_id = auth.uid());
drop policy if exists "content_owner_write" on public.timeline_events;
create policy "content_owner_write" on public.timeline_events for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "content_public_read" on public.articles;
create policy "content_public_read" on public.articles for select to anon, authenticated
  using (visibility = 'public');
drop policy if exists "content_owner_read"  on public.articles;
create policy "content_owner_read"  on public.articles for select to authenticated
  using (owner_id = auth.uid());
drop policy if exists "content_owner_write" on public.articles;
create policy "content_owner_write" on public.articles for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 6.3 artwork_files：原作文件，仅站长可读写（原图绝不匿名暴露）
drop policy if exists "files_owner_read"  on public.artwork_files;
create policy "files_owner_read"  on public.artwork_files for select to authenticated
  using (exists (select 1 from public.artworks a where a.id = artwork_id and a.owner_id = auth.uid()));
drop policy if exists "files_owner_write" on public.artwork_files;
create policy "files_owner_write" on public.artwork_files for all to authenticated
  using (exists (select 1 from public.artworks a where a.id = artwork_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.artworks a where a.id = artwork_id and a.owner_id = auth.uid()));

-- 6.4 categories：分类名公开可读，仅站长可写
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories for select to anon, authenticated using (true);
drop policy if exists "categories_owner_write" on public.categories;
create policy "categories_owner_write" on public.categories for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 6.5 profiles：公开可读，仅本人可写
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "profiles_owner_write" on public.profiles;
create policy "profiles_owner_write" on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- 6.6 settings：网站配置公开可读，仅站长可写
drop policy if exists "settings_public_read" on public.settings;
create policy "settings_public_read" on public.settings for select to anon, authenticated using (true);
drop policy if exists "settings_owner_write" on public.settings;
create policy "settings_owner_write" on public.settings for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 7. 初始站点配置（settings 种子，可改）
-- ============================================================
insert into public.settings (key, value) values
  ('site_name',    '"拾光事务所"'::jsonb),
  ('site_tagline', '"记录学习、创作与生活的数字档案"'::jsonb),
  ('social_links', '{"github": "", "weibo": "", "email": ""}'::jsonb)
on conflict (key) do nothing;
