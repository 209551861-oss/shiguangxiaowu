"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createUnitFromSelectionAction } from "@/app/(site)/recite/actions";

type Sel = { text: string; top: number; left: number };

/**
 * 在笔记正文里划选一段文字 → 浮出「创建复习单元」。
 * 选中内容自动进背面（答案），正面留空让用户写问题；
 * 保存后建立来源关联，单元里保留这段文字的创建时快照。
 */
export default function NoteSelection({
  itemId,
  children,
}: {
  itemId: string;
  children: React.ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const capture = useCallback(() => {
    const box = boxRef.current;
    const selection = window.getSelection();
    if (!box || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (!box.contains(range.commonAncestorContainer)) return;

    const text = selection.toString().trim();
    if (text.length < 2) return;

    const rect = range.getBoundingClientRect();
    setSel({
      text: text.slice(0, 4000),
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX + rect.width / 2,
    });
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (!open) setSel(null);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  return (
    <div ref={boxRef} onMouseUp={capture} className="relative">
      {children}

      {sel && !open && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setDraft(sel.text);
            setOpen(true);
          }}
          style={{ top: sel.top - 44, left: sel.left }}
          className="absolute z-30 -translate-x-1/2 rounded-pill bg-forest px-4 py-1.5 text-xs text-paper shadow-card"
        >
          创建复习单元
        </button>
      )}

      {open && sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/30 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-paper p-5 shadow-card">
            <div className="flex items-baseline justify-between">
              <h3 className="font-serif text-lg text-forest">从这段内容建一张卡</h3>
              <button onClick={() => setOpen(false)} className="text-muted" aria-label="关闭">
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">
              选中的文字已经放进答案，你只需要写问题。之后改笔记也不会改到这张卡。
            </p>

            <form action={createUnitFromSelectionAction} className="mt-4 space-y-3">
              <input type="hidden" name="itemId" value={itemId} />
              <input
                type="hidden"
                name="anchor"
                value={JSON.stringify({ quote: sel.text.slice(0, 120) })}
              />
              <label className="block">
                <span className="text-xs text-muted">正面 · 问题（必填）</span>
                <textarea
                  name="front_md"
                  autoFocus
                  rows={2}
                  placeholder="这段内容在回答什么问题？"
                  className="mt-1 w-full resize-y rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-leaf"
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted">背面 · 答案（可改）</span>
                <textarea
                  name="back_md"
                  rows={5}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="mt-1 w-full resize-y rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-leaf"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-pill border border-line px-4 py-1.5 text-sm text-ink"
                >
                  取消
                </button>
                <button className="rounded-pill bg-forest px-5 py-1.5 text-sm text-paper">
                  创建并编辑
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
