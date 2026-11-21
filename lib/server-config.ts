/**
 * 服务端私有配置：环境变量优先，线上没配时退回 app_config 表。
 *
 * 用途是免去"必须去 Vercel 面板加变量再 Redeploy"这一步。
 * app_config 开了 RLS 且没有任何策略，anon / authenticated 都读不到，
 * 只有 service_role 能查 —— 所以这个模块只能在服务端路由里用。
 */

const TTL = 30_000;
const cache = new Map<string, { value: string; at: number }>();

export async function getServerConfig(key: string, envName: string): Promise<string> {
  const fromEnv = (process.env[envName] || "").trim();
  if (fromEnv) return fromEnv;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  let value = "";
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data } = await createAdminClient()
      .from("app_config")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    value = String((data as { value?: string } | null)?.value ?? "").trim();
  } catch {
    value = "";
  }

  cache.set(key, { value, at: Date.now() });
  return value;
}

export async function configSource(key: string, envName: string): Promise<"env" | "db" | "none"> {
  if ((process.env[envName] || "").trim()) return "env";
  return (await getServerConfig(key, envName)) ? "db" : "none";
}
