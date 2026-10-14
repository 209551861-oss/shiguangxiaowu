# 拾光事务所 · Supabase 初始化

本目录的 SQL 在 Supabase 控制台执行一次即可完成数据库与存储桶搭建。

## 执行顺序
1. `migrations/0001_schema.sql` —— 12 张表 + 索引 + 触发器 + RLS 权限策略 + settings 种子
2. `migrations/0002_storage.sql` —— 7 个存储桶 + 存储对象权限策略

## 在 Supabase 控制台执行
1. 打开 https://supabase.com → 进入你的项目
2. 左侧 **SQL Editor** → **New query**
3. 把 `0001_schema.sql` 全文粘贴进去 → 点 **Run**
4. 再新建一个 query，粘贴 `0002_storage.sql` → **Run**
5. 两个都出现 `Success. No rows returned` 即完成

## 验证
- 左侧 **Table Editor** 应能看到 12 张表
- 左侧 **Storage** 应能看到 7 个桶（private 标记为 Private，其余 Public）

## 设计要点（对应已确认决策）
- **单用户**：所有写操作限定 `auth.uid()`（即登录的站长本人）；注册后自动建 profile
- **默认公开**：内容表 `visibility` 默认 `'public'`，匿名可看；设 `private`/`draft` 仅站长可见
- **原图保护**：`private` 桶设为私有，匿名无访问策略；对外访问由服务端用 service_role 生成 1 小时签名 URL，页面源码不暴露真实路径
- **全文搜索**：`notes` / `articles` / `resources` 已建 `search_vector` + GIN 索引（Phase 3 搜索功能用）

## 后续
- 密钥已填在 `shiguang/.env.local`（URL / anon / service_role）
- Phase 3 起，前端通过 Supabase 客户端读写；私有原图走服务端签名 URL 路由
