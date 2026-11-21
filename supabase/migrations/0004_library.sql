-- ============================================================
-- 0004_library.sql · 资料库三表 + 问答两表（P2）
-- 承接 0003_curriculum.sql，只新增，不改动任何已有表。
-- 执行方式：node scripts/migrate.mjs supabase/migrations/0004_library.sql
--
-- 中文检索：本库 pgroonga 3.2.5 可用（已实测 TokenBigram 分词），
--   因此关键词腿走 PGroonga；向量腿走 pgvector + bge-m3(1024)。
--   两条腿在应用层用 RRF 合并（k=60），不依赖任何 pg 端扩展函数做融合。
-- ============================================================

create extension if not exists vector;
create extension if not exists pgroonga;

-- ---------- document：一份资料 = 一行 ----------
create table if not exists public.document (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  source            text not null default 'unyra'
                    check (source in ('unyra','upload','manual')),
  external_id       text not null,                       -- 归一 nodeId；上传用内容哈希
  goal_id           text,
  goal_title        text,
  title             text not null,
  kind              text not null default 'markdown'
                    check (kind in ('markdown','pdf','docx','txt')),
  content_hash      text not null,
  chars             integer not null default 0,
  source_updated_at timestamptz,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.document is '资料：归一自动同步 / 手动上传 / 站内写，均为私人数据';

create unique index if not exists document_uidx
  on public.document (user_id, source, external_id);
create index if not exists document_user_idx
  on public.document (user_id, archived_at, updated_at desc);

-- ---------- chunk：检索与引用定位的最小单位 ----------
create table if not exists public.chunk (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.document(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  ordinal         integer not null,
  content         text not null,
  heading_path    text,
  page_start      integer,
  page_end        integer,
  char_start      integer,
  char_end        integer,
  embedding_model text,                                  -- 换模型必须整列重算，禁止混用
  embedding       vector(1024),                          -- bge-m3
  created_at      timestamptz not null default now()
);

comment on column public.chunk.char_start is '在 document 规范化 markdown 中的起始字符下标，引用高亮靠它';

create index if not exists chunk_doc_idx on public.chunk (document_id, ordinal);
create index if not exists chunk_user_idx on public.chunk (user_id);

-- 中文全文索引（PGroonga，bigram 分词）
create index if not exists chunk_content_groonga_idx
  on public.chunk using pgroonga (content) with (tokenizer = 'TokenBigram');

-- 向量索引（bge-m3 = 1024 维；换模型要重建这一列与索引）
create index if not exists chunk_embedding_idx
  on public.chunk using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ---------- sync_log：设置页显示"上次同步" ----------
create table if not exists public.sync_log (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  source       text not null,
  external_id  text,
  title        text,
  chunks       integer not null default 0,
  chars        integer not null default 0,
  content_hash text,
  ok           boolean not null default true,
  reason       text,
  at           timestamptz not null default now()
);

create index if not exists sync_log_user_idx on public.sync_log (user_id, at desc);

-- ---------- 问答 ----------
create table if not exists public.qa_session (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.document(id) on delete set null,
  title       text,
  created_at  timestamptz not null default now()
);

create index if not exists qa_session_user_idx on public.qa_session (user_id, created_at desc);
create index if not exists qa_session_doc_idx on public.qa_session (document_id);

create table if not exists public.qa_message (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.qa_session(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  citations  jsonb,
  model      text,
  channel    text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists qa_message_session_idx on public.qa_message (session_id, created_at);

-- ============================================================
-- RLS：五张表全部只有本人可见
-- ============================================================
alter table public.document   enable row level security;
alter table public.chunk      enable row level security;
alter table public.sync_log   enable row level security;
alter table public.qa_session enable row level security;
alter table public.qa_message enable row level security;

drop policy if exists document_owner_all on public.document;
create policy document_owner_all on public.document
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists chunk_owner_all on public.chunk;
create policy chunk_owner_all on public.chunk
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists sync_log_owner_all on public.sync_log;
create policy sync_log_owner_all on public.sync_log
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists qa_session_owner_all on public.qa_session;
create policy qa_session_owner_all on public.qa_session
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists qa_message_owner_all on public.qa_message;
create policy qa_message_owner_all on public.qa_message
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 检索函数（security invoker：RLS 依然生效，越权查不到别人的资料）
-- ============================================================

-- 关键词腿：PGroonga，按相关度返回
create or replace function public.chunk_search_keyword(
  p_query text,
  p_limit integer default 12,
  p_document_id uuid default null
)
returns table (
  chunk_id     uuid,
  document_id  uuid,
  ordinal      integer,
  content      text,
  heading_path text,
  char_start   integer,
  char_end     integer,
  page_start   integer,
  page_end     integer,
  score        real
)
language sql
stable
as $$
  select c.id,
         c.document_id,
         c.ordinal,
         c.content,
         c.heading_path,
         c.char_start,
         c.char_end,
         c.page_start,
         c.page_end,
         pgroonga_score(c.tableoid, c.ctid)::real as score
    from public.chunk c
   where c.content &@~ p_query
     and (p_document_id is null or c.document_id = p_document_id)
   order by score desc
   limit p_limit
$$;

-- 语义腿：pgvector cosine
create or replace function public.chunk_search_vector(
  p_embedding vector(1024),
  p_limit integer default 12,
  p_document_id uuid default null
)
returns table (
  chunk_id     uuid,
  document_id  uuid,
  ordinal      integer,
  content      text,
  heading_path text,
  char_start   integer,
  char_end     integer,
  page_start   integer,
  page_end     integer,
  score        real
)
language sql
stable
as $$
  select c.id,
         c.document_id,
         c.ordinal,
         c.content,
         c.heading_path,
         c.char_start,
         c.char_end,
         c.page_start,
         c.page_end,
         (1 - (c.embedding <=> p_embedding))::real as score
    from public.chunk c
   where c.embedding is not null
     and (p_document_id is null or c.document_id = p_document_id)
   order by c.embedding <=> p_embedding
   limit p_limit
$$;

grant execute on function public.chunk_search_keyword(text, integer, uuid) to authenticated;
grant execute on function public.chunk_search_vector(vector, integer, uuid) to authenticated;

-- ============================================================
-- 完成。校验：
--   select table_name from information_schema.tables
--    where table_schema='public'
--      and table_name in ('document','chunk','sync_log','qa_session','qa_message');
--   select indexname from pg_indexes where tablename='chunk';
--
-- 回滚（会连资料与问答一起删）：
--   drop function if exists public.chunk_search_keyword(text,integer,uuid);
--   drop function if exists public.chunk_search_vector(vector,integer,uuid);
--   drop table if exists public.qa_message;
--   drop table if exists public.qa_session;
--   drop table if exists public.sync_log;
--   drop table if exists public.chunk;
--   drop table if exists public.document;
-- ============================================================
