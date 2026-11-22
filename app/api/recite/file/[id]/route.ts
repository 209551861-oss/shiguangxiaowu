import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reciteOwnerId } from "@/lib/recite/guard";

/**
 * 私有附件的唯一出口。
 *
 * 不暴露存储路径，也不发永久公开地址：
 * 先用「用户会话」客户端查 attachment（RLS 决定能不能看到这行），
 * 查到才由 service role 签发 10 分钟有效的地址，然后 302 过去。
 * 查不到时统一 404，不说明是"不存在"还是"不属于你"。
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const owner = await reciteOwnerId();
  if (owner && owner !== user.id) return new Response("forbidden", { status: 403 });

  const { data: row } = await supabase
    .from("attachment")
    .select("storage_key,filename,mime")
    .eq("id", id)
    .maybeSingle();

  if (!row) return new Response("not found", { status: 404 });

  const { storage_key, filename, mime } = row as {
    storage_key: string;
    filename: string;
    mime: string;
  };

  const { data: signed, error } = await createAdminClient()
    .storage.from("private")
    .createSignedUrl(storage_key, 600);

  if (error || !signed?.signedUrl) {
    return new Response("not found", { status: 404 });
  }

  const wantDownload = req.nextUrl.searchParams.get("download") === "1";
  const url = wantDownload
    ? `${signed.signedUrl}&download=${encodeURIComponent(filename)}`
    : signed.signedUrl;

  return new Response(null, {
    status: 302,
    headers: {
      location: url,
      "cache-control": "private, no-store",
      "content-type": mime,
    },
  });
}
