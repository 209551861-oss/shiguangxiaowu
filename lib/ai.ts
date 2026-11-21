/**
 * 模型通道：归一桥优先 → DeepSeek 直连兜底 → 都没有返回不可用。
 *
 * 云端部署（Vercel）摸不到本机桥，所以线上永远是 deepseek 通道；
 * 本机 `npm run dev` 时优先走归一桥（能用到归一里配的模型与 key）。
 */

import { bridgeChat } from "@/lib/unyra";

export type Channel = "unyra" | "deepseek" | "none";

export type ChatResult = {
  content: string;
  model: string;
  channel: Channel;
};

const DEEPSEEK_BASE = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "";

type Msg = { role: "system" | "user" | "assistant"; content: string };

async function deepseekChat(
  messages: Msg[],
  opts: { model?: string; temperature?: number; maxTokens?: number }
): Promise<ChatResult> {
  if (!DEEPSEEK_KEY) {
    throw new Error("no-channel");
  }
  const model = opts.model && !opts.model.startsWith("unyra:") ? opts.model : "deepseek-chat";
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 1200,
      stream: false,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}：${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
  };
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? model,
    channel: "deepseek",
  };
}

/**
 * 依次尝试：归一桥 → DeepSeek。
 * preferChannel 用于"用户明确选了云端模型"时跳过桥。
 */
export async function chat(
  messages: Msg[],
  opts: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    preferChannel?: Channel;
  } = {}
): Promise<ChatResult> {
  if (opts.preferChannel !== "deepseek") {
    try {
      const raw = opts.model?.startsWith("unyra:") ? opts.model.slice("unyra:".length) : "";
      const r = await bridgeChat({
        messages,
        model: raw && raw !== "default" ? raw : undefined,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 1200,
      });
      if (r.content.trim()) return { ...r, channel: "unyra" };
    } catch {
      // 桥不在（云端常态），继续回退
    }
  }

  try {
    return await deepseekChat(messages, opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(msg === "no-channel" ? "no-channel" : msg);
  }
}

export function hasDeepSeek(): boolean {
  return !!DEEPSEEK_KEY;
}
