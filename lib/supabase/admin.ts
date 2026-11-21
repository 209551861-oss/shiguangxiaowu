/**
 * Supabase service role 客户端（只在服务端路由里用，绕过 RLS）。
 * 只给 ingest / sync 这类"不是用户会话"的写入路径使用；
 * 查询用户数据一律走 lib/supabase/server 的会话客户端，让 RLS 生效。
 */
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("缺少 SUPABASE 服务端环境变量");
  return createClient(url, key, { auth: { persistSession: false } });
}
