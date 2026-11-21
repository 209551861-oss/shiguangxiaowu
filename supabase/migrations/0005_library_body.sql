-- ============================================================
-- 0005_library_body.sql · document 补一列正文
-- 原因：详情页要渲染 markdown，而云端访问不到本机归一桥，
--       不能每次打开都去桥里取 node.json，正文必须落库。
-- 只加列，不动任何已有数据。
-- ============================================================

alter table public.document
  add column if not exists body_md text;

comment on column public.document.body_md is '规范化 markdown 全文；chunk.char_start/char_end 以它为坐标系';
