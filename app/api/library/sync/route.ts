import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedPendingChunks, ingestDocument, hashOf } from "@/lib/services/ingest";
import { bridgeDoc, bridgeDocs, bridgeEmbeddings, bridgeHealth } from "@/lib/unyra";

/**
 * POST /api/library/sync
 * 「立即同步归一」按钮：服务端自己去桥里拉清单和正文，落库。
 *
 * 之所以不让桥反向推送：桥得先配 UNYRA_INGEST_URL 才能推，且云端根本摸不到桥。
 * 反过来由服务端主动拉，本机跑 dev 时立刻可用；云端会明确告诉你桥不在。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json(
      { error: { message: "登录后才能同步资料", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const health = await bridgeHealth(1200);
  if (!health) {
    return Response.json(
      {
        error: {
          message:
            "连不上归一桥。本机请双击 tools/unyra-bridge/启动归一桥.vbs；云端部署访问不到本机，改用本机运行 npm run dev 或 scripts/sync-unyra.mjs 推送。",
          code: "BRIDGE_DOWN",
        },
      },
      { status: 503 }
    );
  }

  let metas;
  try {
    metas = await bridgeDocs();
  } catch (err) {
    return Response.json(
      { error: { message: `读取归一资料清单失败：${(err as Error).message}`, code: "BRIDGE_DOCS" } },
      { status: 502 }
    );
  }

  const admin = createAdminClient();
  const summary = {
    bridge: { version: health.version ?? null, docFiles: metas.length, embedding: health.embedding?.model ?? null },
    total: metas.length,
    added: 0,
    updated: 0,
    skipped: 0,
    chunks: 0,
    embedded: 0,
    failed: [] as { nodeId: string; title: string; reason: string }[],
  };

  for (const meta of metas) {
    try {
      const body = await bridgeDoc(meta.nodeId);
      const result = await ingestDocument(admin, user.id, {
        source: "unyra",
        externalId: meta.nodeId,
        goalId: meta.goalId ?? body.goalId ?? null,
        goalTitle: meta.goalTitle ?? body.goalTitle ?? null,
        title: meta.title || body.title,
        markdown: body.markdown,
        contentHash: hashOf(body.markdown),
        updatedAt: meta.updatedAt ?? body.updatedAt ?? null,
        chars: meta.chars ?? body.chars,
      });

      if (result.skipped) summary.skipped += 1;
      else {
        summary.chunks += result.chunks;
        if (result.existed) summary.updated += 1;
        else summary.added += 1;
      }

      // 内容没变也补一次向量：早期入库的块可能还没有 embedding
      if (result.documentId) {
        try {
          const { embedded } = await embedPendingChunks(admin, user.id, result.documentId, bridgeEmbeddings);
          summary.embedded += embedded;
        } catch {
          // 向量失败不影响入库
        }
      }
    } catch (err) {
      summary.failed.push({
        nodeId: meta.nodeId,
        title: meta.title,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return Response.json({ ok: summary.failed.length === 0, ...summary });
}
