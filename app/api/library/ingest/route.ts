import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestDocument, type IngestPayload } from "@/lib/services/ingest";

/**
 * POST /api/library/ingest
 * 归一桥（或手写脚本）把资料推过来。
 * 鉴权走 HMAC，不是用户会话 —— 所以写入归属用 UNYRA_OWNER_USER_ID，service role 落库。
 *
 * 头：X-Unyra-Signature = hex(HMAC-SHA256(rawBody, UNYRA_INGEST_SECRET))
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET = process.env.UNYRA_INGEST_SECRET || "";
const OWNER = process.env.UNYRA_OWNER_USER_ID || "";

function verify(raw: string, signature: string | null) {
  if (!SECRET) return "服务端没配 UNYRA_INGEST_SECRET";
  if (!signature) return "缺少 X-Unyra-Signature";
  const expect = crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
  const a = Buffer.from(expect);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return "签名不匹配";
  return null;
}

function fail(message: string, code: string, status: number) {
  return Response.json({ error: { message, code } }, { status });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const bad = verify(raw, req.headers.get("x-unyra-signature"));
  if (bad) return fail(bad, "BAD_SIGNATURE", 401);
  if (!OWNER) return fail("缺 UNYRA_OWNER_USER_ID", "NO_OWNER", 500);

  let payload: IngestPayload;
  try {
    payload = JSON.parse(raw) as IngestPayload;
  } catch {
    return fail("JSON 解析失败", "BAD_JSON", 400);
  }

  try {
    const admin = createAdminClient();
    const result = await ingestDocument(admin, OWNER, {
      ...payload,
      source: payload.source ?? "unyra",
    });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, "INGEST_FAILED", 500);
  }
}
