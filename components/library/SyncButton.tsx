"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SyncResp = {
  ok?: boolean;
  total?: number;
  added?: number;
  updated?: number;
  skipped?: number;
  chunks?: number;
  embedded?: number;
  failed?: { title: string; reason: string }[];
  error?: { message: string; code: string };
};

/** 「立即同步归一」按钮：服务端去桥里拉清单与正文，落库后刷新页面 */
export default function SyncButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/library/sync", { method: "POST" });
      const data = (await res.json()) as SyncResp;
      if (!res.ok || data.error) {
        setMsg({ tone: "warn", text: data.error?.message ?? `同步失败（HTTP ${res.status}）` });
        return;
      }
      const bits = [
        `共 ${data.total ?? 0} 份`,
        `新增 ${data.added ?? 0}`,
        `更新 ${data.updated ?? 0}`,
        `未变 ${data.skipped ?? 0}`,
        `分块 ${data.chunks ?? 0}`,
        `向量 ${data.embedded ?? 0}`,
      ];
      const failed = data.failed ?? [];
      setMsg({
        tone: failed.length ? "warn" : "ok",
        text: failed.length
          ? `${bits.join(" · ")}；${failed.length} 份失败：${failed[0].title}（${failed[0].reason}）`
          : bits.join(" · "),
      });
      startTransition(() => router.refresh());
    } catch (err) {
      setMsg({ tone: "warn", text: `同步中断：${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy || disabled}
        className="rounded-full bg-forest px-5 py-2.5 text-sm text-paper transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "同步中…" : "立即同步归一"}
      </button>
      {msg && (
        <p
          className={`max-w-[380px] text-right text-xs leading-6 ${
            msg.tone === "ok" ? "text-leaf" : "text-ink"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
