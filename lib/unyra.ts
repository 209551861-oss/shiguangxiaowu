/**
 * 归一桥客户端（只在服务端用；不要 import 到客户端组件）
 * 桥默认跑在 http://127.0.0.1:4399，见 tools/unyra-bridge
 *
 * 注意：站点部署在云端时访问不到本机 127.0.0.1，所有调用都要"短超时 + 可失败"，
 * 失败后由调用方回退（聊天回退 DeepSeek，向量腿直接跳过）。
 */

const BRIDGE_URL = (process.env.UNYRA_BRIDGE_URL || "http://127.0.0.1:4399").replace(/\/+$/, "");
const BRIDGE_TOKEN = process.env.UNYRA_BRIDGE_TOKEN || "";

export type UnyraModel = {
  id: string;
  display_name?: string;
  provider_label?: string;
  context_window?: number | null;
};

export type BridgeHealth = {
  ok: true;
  version?: string;
  docFiles?: number;
  providers?: number;
  models?: number;
  embedding?: { model?: string; dim?: number; loaded?: boolean };
};

function headers(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (BRIDGE_TOKEN) h.authorization = `Bearer ${BRIDGE_TOKEN}`;
  return h;
}

export async function bridgeHealth(timeoutMs = 1200): Promise<BridgeHealth | null> {
  try {
    const res = await fetch(`${BRIDGE_URL}/health`, {
      headers: headers(),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as BridgeHealth;
  } catch {
    return null;
  }
}

export async function bridgeModels(): Promise<UnyraModel[]> {
  const res = await fetch(`${BRIDGE_URL}/v1/models`, {
    headers: headers(),
    signal: AbortSignal.timeout(1500),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`归一桥 /v1/models 返回 ${res.status}`);
  const data = (await res.json()) as { data?: UnyraModel[] };
  return data.data ?? [];
}

/** 非流式聊天（服务端要拿到完整回答才能校验引用，所以这里不用 SSE） */
export async function bridgeChat(body: {
  messages: { role: string; content: string }[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}): Promise<{ content: string; model: string }> {
  const res = await fetch(`${BRIDGE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ ...body, stream: false }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`归一桥 /v1/chat/completions 返回 ${res.status}`);
  const data = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
  };
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? body.model ?? "unyra",
  };
}

/** 本地 bge-m3 向量（1024 维） */
export async function bridgeEmbeddings(input: string | string[]): Promise<number[][]> {
  const res = await fetch(`${BRIDGE_URL}/v1/embeddings`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ input, model: "bge-m3" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`归一桥 /v1/embeddings 返回 ${res.status}`);
  const data = (await res.json()) as { data?: { embedding: number[] }[] };
  return (data.data ?? []).map((d) => d.embedding);
}

export type UnyraDocMeta = {
  goalId?: string | null;
  goalTitle?: string | null;
  nodeId: string;
  title: string;
  chars?: number;
  hash?: string;
  updatedAt?: number;
};

export type UnyraDocBody = UnyraDocMeta & { markdown: string };

/** 归一中可导入的资料清单 */
export async function bridgeDocs(): Promise<UnyraDocMeta[]> {
  const res = await fetch(`${BRIDGE_URL}/unyra/docs`, {
    headers: headers(),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`归一桥 /unyra/docs 返回 ${res.status}`);
  const data = (await res.json()) as { items?: UnyraDocMeta[] };
  return data.items ?? [];
}

/** 单份资料的规范化 markdown */
export async function bridgeDoc(nodeId: string): Promise<UnyraDocBody> {
  const res = await fetch(`${BRIDGE_URL}/unyra/doc?nodeId=${encodeURIComponent(nodeId)}`, {
    headers: headers(),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`归一桥 /unyra/doc 返回 ${res.status}`);
  return (await res.json()) as UnyraDocBody;
}
