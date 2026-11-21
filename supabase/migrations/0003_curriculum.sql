-- ============================================================
-- 0003_curriculum.sql · 教材四表（P1）
-- 承接 0001_schema.sql，只新增，不改动任何旧表。
-- 执行方式：Supabase 控制台 → SQL Editor → 粘贴全文 → Run
-- ============================================================

-- ---------- book ----------
create table if not exists public.book (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  subject                text not null,                       -- 'c' / 'ds' ...
  title                  text not null,
  version                text not null default 'v1',
  status                 text not null default 'draft_outline'
                         check (status in ('draft_outline','pending_confirmation','generating','published','archived')),
  outline_version        text,
  outline_confirmed_at   timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint book_user_subject_version_key unique (user_id, subject, version)
);

comment on table public.book is '教材：一个科目一个版本一本';
comment on column public.book.status is '未确认目录（非 published）不得进入正文生成';

-- ---------- chapter ----------
create table if not exists public.chapter (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.book(id) on delete cascade,
  slug        text not null,                                  -- 稳定身份，导入按它 upsert
  ordinal     int  not null default 0,                        -- 仅排序
  title       text not null,
  summary     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint chapter_book_slug_key unique (book_id, slug)
);

comment on column public.chapter.slug is '稳定身份；ordinal 只用于排序，不得当身份用';

-- ---------- section ----------
create table if not exists public.section (
  id                       uuid primary key default gen_random_uuid(),
  chapter_id               uuid not null references public.chapter(id) on delete cascade,
  slug                     text not null,
  ordinal                  int  not null default 0,
  title                    text not null,
  body_md                  text not null default '',
  goals                    jsonb not null default '[]'::jsonb,  -- 本节目标：string[]
  key_points               jsonb not null default '[]'::jsonb,  -- 知识点清单
  examples                 jsonb not null default '[]'::jsonb,  -- [{title, body_md, runnable}]
  exercises                jsonb not null default '[]'::jsonb,  -- [{prompt, hint, answer}]
  acceptance               text,                                -- 验收判据（她自己能判断）
  est_minutes              int  not null default 30,
  content_version          text not null default 'v1',
  content_hash             text,
  status                   text not null default 'published'
                           check (status in ('draft','published','archived')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint section_chapter_slug_key unique (chapter_id, slug)
);

comment on column public.section.goals is '教学区块用结构化字段，前端不得解析 markdown 标题猜区块';

-- ---------- section_progress ----------
create table if not exists public.section_progress (
  user_id                   uuid not null references auth.users(id) on delete cascade,
  section_id                uuid not null references public.section(id) on delete cascade,
  status                    text not null default 'not_started'
                            check (status in ('not_started','in_progress','completed','stuck')),
  stuck_note                text,
  completed_at              timestamptz,
  completed_content_version text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  primary key (user_id, section_id)
);

comment on column public.section_progress.completed_content_version is '记下学完时的教材版本；与当前 content_version 不同则提示「你学过的是旧版」';

-- ---------- 索引 ----------
create index if not exists idx_book_user            on public.book (user_id, status);
create index if not exists idx_chapter_book_ordinal  on public.chapter (book_id, ordinal);
create index if not exists idx_section_chapter_ord   on public.section (chapter_id, ordinal);
create index if not exists idx_section_status        on public.section (status);
create index if not exists idx_section_progress_user on public.section_progress (user_id, status);

-- ---------- updated_at 触发器（复用 0001 的 set_updated_at） ----------
create trigger trg_book_updated            before update on public.book             for each row execute function public.set_updated_at();
create trigger trg_chapter_updated         before update on public.chapter          for each row execute function public.set_updated_at();
create trigger trg_section_updated         before update on public.section          for each row execute function public.set_updated_at();
create trigger trg_section_progress_updated before update on public.section_progress for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.book             enable row level security;
alter table public.chapter          enable row level security;
alter table public.section          enable row level security;
alter table public.section_progress enable row level security;

-- book：只有本人
drop policy if exists book_owner_all on public.book;
create policy book_owner_all on public.book
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- chapter：通过 book 归属判断
drop policy if exists chapter_owner_all on public.chapter;
create policy chapter_owner_all on public.chapter
  for all to authenticated
  using (exists (
    select 1 from public.book b where b.id = chapter.book_id and b.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.book b where b.id = chapter.book_id and b.user_id = auth.uid()
  ));

-- section：通过 chapter → book 归属判断
drop policy if exists section_owner_all on public.section;
create policy section_owner_all on public.section
  for all to authenticated
  using (exists (
    select 1 from public.chapter c
      join public.book b on b.id = c.book_id
     where c.id = section.chapter_id and b.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.chapter c
      join public.book b on b.id = c.book_id
     where c.id = section.chapter_id and b.user_id = auth.uid()
  ));

-- section_progress：只有本人
drop policy if exists section_progress_owner_all on public.section_progress;
create policy section_progress_owner_all on public.section_progress
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 完成。校验（可单独跑）：
--   select table_name from information_schema.tables
--    where table_schema='public' and table_name in ('book','chapter','section','section_progress');
--
-- 回滚（谨慎，会连进度一起删）：
--   drop table if exists public.section_progress;
--   drop table if exists public.section;
--   drop table if exists public.chapter;
--   drop table if exists public.book;
-- ============================================================
