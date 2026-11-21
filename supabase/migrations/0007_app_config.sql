-- 服务端私有配置（模型 key 之类）
-- 设计原则：RLS 开启但一条策略都不建，anon / authenticated 完全读不到；
-- 只有 service_role 能读写。这样 key 不必只依赖 Vercel 面板的环境变量。

create table if not exists public.app_config (
  key text primary key,
  value text not null,
  note text,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

revoke all on public.app_config from anon, authenticated;

comment on table public.app_config is
  '服务端私有配置。RLS 开启且无策略，仅 service_role 可访问；用于存放不适合写进前端包的密钥。';
