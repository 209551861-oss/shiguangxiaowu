-- ============================================================
-- 0006_search_vector_text.sql · 向量检索函数改用 text 入参
-- 原因：PostgREST 调 rpc 时传 JS 数组到 vector(1024) 会类型不匹配，
--       改成 p_embedding text（"[]" 字符串）在函数内部 ::vector 转换，最稳。
-- ============================================================

drop function if exists public.chunk_search_vector(vector, integer, uuid);

create or replace function public.chunk_search_vector(
  p_embedding text,
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
  with q as (select p_embedding::vector(1024) as v)
  select c.id,
         c.document_id,
         c.ordinal,
         c.content,
         c.heading_path,
         c.char_start,
         c.char_end,
         c.page_start,
         c.page_end,
         (1 - (c.embedding <=> q.v))::real as score
    from public.chunk c, q
   where c.embedding is not null
     and (p_document_id is null or c.document_id = p_document_id)
   order by c.embedding <=> q.v
   limit p_limit
$$;

grant execute on function public.chunk_search_vector(text, integer, uuid) to authenticated;
