/**
 * 背诵板块的服务端守卫。
 *
 * 两道门：
 * 1. 未登录 → 去登录页；
 * 2. 已登录但不是站点所有者 → 当作不存在（404，不暴露板块存在性）。
 * 数据行本身还有 RLS（owner_user_id = auth.uid()），这里是应用层的第二道。
 */
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerConfig } from "@/lib/server-config";

export const RECITE_HOME = "/recite";

export function loginUrl(next: string) {
  return `/dashboard/login?next=${encodeURIComponent(next)}`;
}

export async function reciteOwnerId(): Promise<string> {
  return getServerConfig("recite_owner_user_id", "RECITE_OWNER_USER_ID");
}

export type Viewer = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string | null };
};

/** 页面用：不满足条件直接跳登录 / 404 */
export async function requireReciteOwner(next = RECITE_HOME): Promise<Viewer> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(loginUrl(next));

  const owner = await reciteOwnerId();
  if (owner && owner !== user.id) notFound();

  return { supabase, user };
}

/** Server Action 用：抛错而不是跳转，由调用方转成表单提示 */
export async function assertReciteOwner(): Promise<Viewer> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("登录已过期，请重新登录");

  const owner = await reciteOwnerId();
  if (owner && owner !== user.id) throw new Error("没有权限访问背诵板块");

  return { supabase, user };
}
