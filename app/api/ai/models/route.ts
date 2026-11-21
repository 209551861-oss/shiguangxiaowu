import { createClient } from "@/lib/supabase/server";
import { hasDeepSeek } from "@/lib/ai";
import { bridgeHealth, bridgeModels } from "@/lib/unyra";

/**
 * GET /api/ai/models
 * 返回可用模型清单 + 当前通道。桥不在时只剩云端模型，界面据此把徽标变灰。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type ModelOption = {
  id: string;
  label: string;
  channel: "unyra" | "deepseek";
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: { message: "未登录", code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const models: ModelOption[] = [];
  const health = await bridgeHealth(1000);

  if (health) {
    try {
      const list = await bridgeModels();
      for (const m of list) {
        models.push({
          id: `unyra:${m.id}`,
          label: m.display_name || m.id,
          channel: "unyra",
        });
      }
    } catch {
      // 桥在但取不到清单，继续只用云端
    }
  }

  if (hasDeepSeek()) {
    models.push({ id: "deepseek-chat", label: "DeepSeek Chat（云端）", channel: "deepseek" });
  }

  const bridgeUp = !!health;
  return Response.json({
    bridgeUp,
    bridge: health
      ? { version: health.version ?? null, embedding: health.embedding?.model ?? null }
      : null,
    defaultChannel: bridgeUp && models.some((m) => m.channel === "unyra") ? "unyra" : "deepseek",
    models,
  });
}
