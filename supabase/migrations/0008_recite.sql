-- ============================================================
-- 拾光 · 背诵板块（私有知识库 + FSRS 间隔复习）
-- 0008：六张表 + 索引 + RLS + 触发器 + 私有存储路径策略
--
-- 设计要点
-- 1) 全部表按 owner_user_id 做行级隔离，策略一律 auth.uid() = owner_user_id；
--    即使日后站内出现别的账号，也只能看到自己那一片。
-- 2) 内容统一以 Markdown 文本存储（question_md / answer_md / body_md 等），
--    富文本编辑只是渲染层，不另存一份 HTML，避免双份正文漂移。
-- 3) FSRS 状态单独一张表（review_state），与内容解耦：
--    换算法/调参只动这张表，内容与历史不受影响。
-- 4) 复习历史（review_log）只追加，不更新、不删除，用于回溯与统计。
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ------------------------------------------------------------
-- 1. 知识内容（问答卡片 / 知识笔记）
-- ------------------------------------------------------------
create table if not exists public.knowledge_item (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  type          text not null check (type in ('qa', 'note')),
  title         text not null default '',
  question_md   text,          -- qa：正面（问题）
  answer_md     text,          -- qa：背面（答案）
  body_md       text,          -- note：正文
  category      text,
  tags          text[] not null default '{}',
  review_enabled boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists knowledge_item_owner_created_idx
  on public.knowledge_item (owner_user_id, created_at desc)
  where deleted_at is null;

create index if not exists knowledge_item_owner_type_idx
  on public.knowledge_item (owner_user_id, type)
  where deleted_at is null;

-- 标题/正文搜索（PGroonga 已在前序迁移启用；缺失时退化为 ilike，由应用层兜底）
create index if not exists knowledge_item_title_trgm_idx
  on public.knowledge_item using gin (title gin_trgm_ops);

-- ------------------------------------------------------------
-- 2. 复习单元
-- ------------------------------------------------------------
create table if not exists public.review_unit (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null references auth.users (id) on delete cascade,
  source_item_id  uuid references public.knowledge_item (id) on delete set null,
  source_type     text not null default 'manual'
                  check (source_type in ('qa', 'note_selection', 'manual')),
  front_md        text not null default '',
  back_md         text not null default '',
  -- 从笔记选取时保存创建瞬间的答案快照：笔记后续被改也不影响复习内容
  source_snapshot text,
  -- 原文定位：{ headingPath, start, end }
  source_anchor   jsonb,
  review_enabled  boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists review_unit_owner_idx
  on public.review_unit (owner_user_id, created_at desc)
  where deleted_at is null;

create index if not exists review_unit_source_idx
  on public.review_unit (source_item_id)
  where deleted_at is null;

-- ------------------------------------------------------------
-- 3. FSRS 调度状态（每个复习单元一行）
-- ------------------------------------------------------------
create table if not exists public.review_state (
  review_unit_id    uuid primary key references public.review_unit (id) on delete cascade,
  owner_user_id     uuid not null references auth.users (id) on delete cascade,
  due_at            timestamptz not null default now(),
  last_reviewed_at  timestamptz,
  first_reviewed_at timestamptz,      -- 用于统计"今天引入了多少新卡"
  stability         double precision not null default 0,
  difficulty        double precision not null default 0,
  fsrs_state        smallint not null default 0,  -- 0 New / 1 Learning / 2 Review / 3 Relearning
  reps              integer not null default 0,
  lapses            integer not null default 0,
  scheduled_days    integer not null default 0,
  learning_steps    integer not null default 0,
  elapsed_days      integer not null default 0,
  scheduler_version text not null default 'ts-fsrs-6',
  scheduler_params  jsonb,
  updated_at        timestamptz not null default now()
);

create index if not exists review_state_due_idx
  on public.review_state (owner_user_id, due_at);

-- ------------------------------------------------------------
-- 4. 复习历史（只追加）
-- ------------------------------------------------------------
create table if not exists public.review_log (
  id                uuid primary key default gen_random_uuid(),
  owner_user_id     uuid not null references auth.users (id) on delete cascade,
  review_unit_id    uuid not null references public.review_unit (id) on delete cascade,
  rating            smallint not null check (rating between 1 and 4),
  reviewed_at       timestamptz not null default now(),
  state_before      smallint,
  state_after       smallint,
  due_before        timestamptz,
  due_after         timestamptz,
  stability_after   double precision,
  difficulty_after  double precision,
  elapsed_days      integer,
  scheduler_version text,
  -- 同一次会话内避免重复提交（双击 / 重放）导致重复写日志
  client_token      text
);

create unique index if not exists review_log_token_uidx
  on public.review_log (review_unit_id, client_token)
  where client_token is not null;

create index if not exists review_log_owner_time_idx
  on public.review_log (owner_user_id, reviewed_at desc);

-- ------------------------------------------------------------
-- 5. 附件
-- ------------------------------------------------------------
create table if not exists public.attachment (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references auth.users (id) on delete cascade,
  item_id        uuid references public.knowledge_item (id) on delete cascade,
  review_unit_id uuid references public.review_unit (id) on delete cascade,
  kind           text not null check (kind in ('image', 'file')),
  filename       text not null,
  mime           text not null,
  size           bigint not null check (size >= 0),
  storage_key    text not null unique,
  sha256         text,
  created_at     timestamptz not null default now(),
  constraint attachment_one_parent check (num_nonnulls(item_id, review_unit_id) <= 1)
);

create index if not exists attachment_item_idx on public.attachment (item_id);
create index if not exists attachment_unit_idx on public.attachment (review_unit_id);

-- ------------------------------------------------------------
-- 6. 设置
-- ------------------------------------------------------------
create table if not exists public.recite_settings (
  owner_user_id      uuid primary key references auth.users (id) on delete cascade,
  daily_new_limit    integer not null default 10 check (daily_new_limit between 0 and 500),
  auto_new_enabled   boolean not null default true,
  timezone           text not null default 'Asia/Shanghai',
  desired_retention  double precision not null default 0.9
                     check (desired_retention between 0.7 and 0.99),
  updated_at         timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. updated_at 触发器
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['knowledge_item', 'review_unit', 'review_state', 'recite_settings']
  loop
    execute format('drop trigger if exists trg_%s_touch on public.%I', t, t);
    execute format(
      'create trigger trg_%s_touch before update on public.%I for each row execute function public.touch_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 8. RLS
-- ------------------------------------------------------------
alter table public.knowledge_item  enable row level security;
alter table public.review_unit     enable row level security;
alter table public.review_state    enable row level security;
alter table public.review_log      enable row level security;
alter table public.attachment      enable row level security;
alter table public.recite_settings enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'knowledge_item', 'review_unit', 'review_state',
    'review_log', 'attachment', 'recite_settings'
  ]
  loop
    execute format('drop policy if exists "%s_owner_all" on public.%I', t, t);
    execute format(
      'create policy "%s_owner_all" on public.%I for all to authenticated
         using (owner_user_id = auth.uid())
         with check (owner_user_id = auth.uid())',
      t, t
    );
    -- 匿名角色不给任何策略 = 默认拒绝
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- review_log 只允许追加：挡掉 update / delete 策略（策略是 for all，这里再收紧）
drop policy if exists "review_log_owner_all" on public.review_log;
create policy "review_log_owner_select" on public.review_log
  for select to authenticated using (owner_user_id = auth.uid());
create policy "review_log_owner_insert" on public.review_log
  for insert to authenticated with check (owner_user_id = auth.uid());

-- ------------------------------------------------------------
-- 9. 私有存储：recite/ 前缀只允许本人读写
--    实际访问走服务端签发的短时 URL；这条策略是第二道保险
-- ------------------------------------------------------------
drop policy if exists "recite_bucket_owner_read" on storage.objects;
create policy "recite_bucket_owner_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'private' and (storage.foldername(name))[1] = 'recite'
         and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "recite_bucket_owner_write" on storage.objects;
create policy "recite_bucket_owner_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'private' and (storage.foldername(name))[1] = 'recite'
              and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "recite_bucket_owner_delete" on storage.objects;
create policy "recite_bucket_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'private' and (storage.foldername(name))[1] = 'recite'
         and (storage.foldername(name))[2] = auth.uid()::text);
