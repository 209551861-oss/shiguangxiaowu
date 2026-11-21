"use client";

import { useRef, useState } from "react";
import { CITE_EVENT } from "./DocReader";

type Citation = {
  tag: string;
  chunkId: string;
  documentId: string;
  title: string;
  headingPath: string | null;
  charStart: number | null;
  charEnd: number | null;
  pageStart: number | null;
  pageEnd: number | null;
  excerpt: string;
};

type Turn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[] | null;
  model?: string | null;
  channel?: string | null;
};

type AskResp = {
  ok?: boolean;
  sessionId?: string;
  answer?: string;
  citations?: Citation[];
  refused?: boolean;
  channel?: string;
  model?: string;
  error?: { message: string; code: string };
};

const CHANNEL_LABEL: Record<string, string> = {
  unyra: "归一 · 本机",
  deepseek: "云端兜底",
  none: "无通道",
};

function jump(c: Citation) {
  window.dispatchEvent(
    new CustomEvent(CITE_EVENT, {
      detail: { excerpt: c.excerpt, headingPath: c.headingPath },
    })
  );
}

/** 把回答里的 [S1] 渲染成可点的角标 */
function AnswerBody({ text, citations }: { text: string; citations: Citation[] }) {
  const byTag = new Map(citations.map((c) => [c.tag, c]));
  const parts = text.split(/(\[S\d+\])/g);

  return (
    <p className="whitespace-pre-wrap text-[14.5px] leading-8 text-ink">
      {parts.map((p, i) => {
        const m = /^\[(S\d+)\]$/.exec(p);
        if (!m) return <span key={i}>{p}</span>;
        const c = byTag.get(m[1]);
        if (!c) return <span key={i}>{p}</span>;
        return (
          <button
            key={i}
            type="button"
            onClick={() => jump(c)}
            title={c.headingPath ?? c.title}
            className="mx-0.5 inline-flex -translate-y-0.5 items-center rounded bg-leaf/15 px-1.5 py-0.5 align-middle text-[10.5px] font-medium text-forest transition hover:bg-leaf/30"
          >
            {m[1]}
          </button>
        );
      })}
    </p>
  );
}

export default function AskPanel({
  documentId,
  initialSession,
}: {
  documentId: string;
  initialSession: { id: string; turns: Turn[] } | null;
}) {
  const [turns, setTurns] = useState<Turn[]>(initialSession?.turns ?? []);
  const [sessionId, setSessionId] = useState<string | null>(initialSession?.id ?? null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const question = value.trim();
    if (!question || busy) return;

    setBusy(true);
    setError(null);
    const localId = `local-${Date.now()}`;
    setTurns((t) => [...t, { id: localId, role: "user", content: question }]);
    setValue("");

    try {
      const res = await fetch("/api/library/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, documentId, sessionId }),
      });
      const data = (await res.json()) as AskResp;

      if (!res.ok || data.error) {
        setError(data.error?.message ?? `请求失败（HTTP ${res.status}）`);
        return;
      }

      setSessionId(data.sessionId ?? null);
      setTurns((t) => [
        ...t,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.answer ?? "",
          citations: data.citations ?? [],
          model: data.model ?? null,
          channel: data.channel ?? null,
        },
      ]);
      requestAnimationFrame(() => {
        boxRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    } catch (err) {
      setError(`请求中断：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="ask" className="mt-14 border-t border-line pt-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl text-forest">问这份资料</h3>
          <p className="mt-1 text-xs text-muted">
            只依据这份资料回答，答不上来会直接说没有；点 [S1] 跳回原句。
          </p>
        </div>
      </div>

      <div ref={boxRef} className="space-y-5">
        {turns.length === 0 && (
          <p className="rounded-xl border border-dashed border-line px-5 py-6 text-sm leading-7 text-muted">
            试试问：「这份资料里，二叉树有哪几种遍历？」「链表和数组的区别是什么？」
          </p>
        )}

        {turns.map((t) =>
          t.role === "user" ? (
            <div key={t.id} className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-md bg-forest px-4 py-3 text-[14px] leading-7 text-paper">
                {t.content}
              </p>
            </div>
          ) : (
            <div key={t.id} className="rounded-2xl border border-line bg-paper px-5 py-4">
              <AnswerBody text={t.content} citations={t.citations ?? []} />

              {(t.citations ?? []).length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                  {t.citations!.map((c) => (
                    <li key={c.tag}>
                      <button
                        type="button"
                        onClick={() => jump(c)}
                        className="group flex w-full gap-2 text-left text-[12px] leading-6 text-muted transition hover:text-forest"
                      >
                        <span className="mt-0.5 shrink-0 rounded bg-mist px-1.5 text-[10.5px] text-forest">
                          {c.tag}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate group-hover:underline">
                            {c.headingPath || c.title}
                          </span>
                          <span className="block truncate text-[11.5px] text-muted/80">
                            {c.excerpt}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-3 flex items-center gap-2 text-[11px] text-muted/80">
                <span>{t.model}</span>
                <span className="rounded bg-mist px-1.5 py-0.5">
                  {CHANNEL_LABEL[t.channel ?? "none"] ?? t.channel}
                </span>
              </p>
            </div>
          )
        )}

        {busy && (
          <div className="rounded-2xl border border-line bg-paper px-5 py-4 text-sm text-muted">
            正在翻资料…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-pollen/50 bg-pollen/10 px-4 py-3 text-sm leading-7 text-ink">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="mt-5 flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit(e as unknown as React.FormEvent);
            }
          }}
          rows={2}
          placeholder="就这份资料提问，Enter 发送，Shift+Enter 换行"
          className="min-h-[52px] flex-1 resize-y rounded-xl border border-line bg-paper px-4 py-3 text-sm leading-7 text-ink outline-none transition placeholder:text-muted/70 focus:border-forest"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="shrink-0 rounded-full bg-forest px-5 py-3 text-sm text-paper transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          提问
        </button>
      </form>
    </section>
  );
}
