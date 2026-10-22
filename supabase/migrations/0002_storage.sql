-- ============================================================
-- 拾光小屋 · Phase 1 · 存储桶与文件权限（Storage + RLS）
-- 适用：Supabase Storage
-- 用法：Supabase 控制台 → SQL Editor → 全选本文件 → Run
-- ============================================================

-- ---------- 1. 创建 7 个存储桶 ----------
-- private：原图 / 原作文件，绝不公开，访问走服务端签名 URL
-- 其余：展示图（缩略图 / 封面），公开可读
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('private',   'private',   false, 52428800, null),                 -- 50MB，原图原作
  ('avatars',   'avatars',   true,  5242880,  array['image/*']),     -- 5MB
  ('resources', 'resources', true,  52428800, null),                 -- 资料附件
  ('artworks',  'artworks',  true,  20971520, array['image/*']),     -- 20MB 展示图
  ('gallery',   'gallery',   true,  20971520, array['image/*']),     -- 20MB 相册缩略图
  ('articles',  'articles',  true,  20971520, array['image/*']),     -- 20MB 文章图
  ('moments',   'moments',   true,  10485760, array['image/*'])      -- 10MB 瞬间图
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------- 2. 存储对象权限（storage.objects RLS） ----------
-- 先 drop if exists 再 create，保证脚本可重复执行（幂等）
-- 公开桶：任何人可读；仅登录站长可写（上传 / 改 / 删）
drop policy if exists "public_buckets_read" on storage.objects;
create policy "public_buckets_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('avatars', 'resources', 'artworks', 'gallery', 'articles', 'moments'));

drop policy if exists "public_buckets_write" on storage.objects;
create policy "public_buckets_write" on storage.objects
  for all to authenticated
  using (bucket_id in ('avatars', 'resources', 'artworks', 'gallery', 'articles', 'moments'))
  with check (bucket_id in ('avatars', 'resources', 'artworks', 'gallery', 'articles', 'moments'));

-- private 桶：仅登录站长可读写；匿名无任何策略 → 默认拒绝
-- 实际对外访问由服务端（service_role）生成短期签名 URL，不暴露真实路径
drop policy if exists "private_bucket_owner" on storage.objects;
create policy "private_bucket_owner" on storage.objects
  for all to authenticated
  using (bucket_id = 'private')
  with check (bucket_id = 'private');

-- ============================================================
-- 3. 原图取用约定（给后续 Service 层 / 服务端路由参考）
--   - 公开展示图：直接返回 https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
--   - 私有原图  ：服务端用 service_role 调用 createSignedUrl(path, 3600) 生成 1 小时有效临时链接
--   - 前端页面源码绝不出现 private 桶真实路径；photos.file_path / artwork_files.file_path 仅服务端读取
-- ============================================================
