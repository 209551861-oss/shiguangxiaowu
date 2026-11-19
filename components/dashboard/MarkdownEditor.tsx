"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import MarkdownViewer from "@/components/MarkdownViewer";

/**
 * Markdown 笔记编辑器。
 * - 等宽字体书写，原始符号对齐
 * - 「书写 / 预览」切换，预览与前台渲染完全一致（同一个 MarkdownViewer）
 * - 列表回车自动续标记，空条目回车跳出列表；Tab 缩进两格，Shift+Tab 反缩进
 * - Ctrl/Cmd + B 粗体、I 斜体、K 链接
 */
export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 16,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const pending = useRef<[number, number] | null>(null);

  /** 写回内容并在下一帧恢复光标位置（受控组件重渲染后选区会丢）。 */
  function commit(next: string, sel?: [number, number]) {
    onChange(next);
    if (!sel) return;
    pending.current = sel;
    requestAnimationFrame(() => {
      const el = ref.current;
      const pos = pending.current;
      if (!el || !pos) return;
      el.focus();
      el.setSelectionRange(pos[0], pos[1]);
      pending.current = null;
    });
  }

  /** 用 before/after 包裹选区；没有选区时插入占位文字并选中它。 */
  function wrap(before: string, after = before) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const picked = value.slice(s, e) || "文字";
    const next = value.slice(0, s) + before + picked + after + value.slice(e);
    commit(next, [s + before.length, s + before.length + picked.length]);
  }

  /** 给选区覆盖的每一行加前缀（有序列表按行号递增）。 */
  function prefixLines(prefix: string | ((i: number) => string)) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const start = value.lastIndexOf("\n", s - 1) + 1;
    const nl = value.indexOf("\n", e);
    const end = nl === -1 ? value.length : nl;
    const block = value.slice(start, end);
    const make = typeof prefix === "string" ? () => prefix : prefix;
    const next = block
      .split("\n")
      .map((line, i) => (line.trim() === "" ? line : make(i) + line))
      .join("\n");
    commit(value.slice(0, start) + next + value.slice(end), [start, start + next.length]);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const t = el.selectionEnd;

    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "b") {
        e.preventDefault();
        wrap("**");
        return;
      }
      if (k === "i") {
        e.preventDefault();
        wrap("*");
        return;
      }
      if (k === "k") {
        e.preventDefault();
        wrap("[", "](url)");
        return;
      }
    }

    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        const start = value.lastIndexOf("\n", s - 1) + 1;
        const block = value.slice(start, t);
        const nextBlock = block
          .split("\n")
          .map((line) => line.replace(/^( {1,2}|\t)/, ""))
          .join("\n");
        if (nextBlock !== block) {
          commit(value.slice(0, start) + nextBlock + value.slice(t), [
            start,
            start + nextBlock.length,
          ]);
        }
        return;
      }
      commit(value.slice(0, s) + "  " + value.slice(t), [s + 2, s + 2]);
      return;
    }

    if (e.key === "Enter" && s === t) {
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const line = value.slice(lineStart, s);
      const m = line.match(/^(\s*)(?:([-*+])\s+(\[[ xX]\]\s+)?|(\d+)\.\s+)/);
      if (!m) return;

      e.preventDefault();
      const indent = m[1] ?? "";
      const bullet = m[2];
      const task = m[3];
      const num = m[4];

      // 只有标记、没有内容的条目 → 回车收起标记，跳出列表
      if (line.trim() === (m[0] ?? "").trim()) {
        const next = value.slice(0, lineStart) + indent + value.slice(s);
        commit(next, [lineStart + indent.length, lineStart + indent.length]);
        return;
      }

      const marker =
        bullet && task ? `${bullet} ${task}` : bullet ? `${bullet} ` : `${Number(num) + 1}. `;
      const insert = "\n" + indent + marker;
      commit(value.slice(0, s) + insert + value.slice(t), [s + insert.length, s + insert.length]);
      return;
    }
  }

  const tools: { label: string; title: string; run: () => void }[] = [
    { label: "B", title: "粗体 ⌘B", run: () => wrap("**") },
    { label: "I", title: "斜体 ⌘I", run: () => wrap("*") },
    { label: "</>", title: "行内代码", run: () => wrap("`") },
    { label: "🔗", title: "链接 ⌘K", run: () => wrap("[", "](url)") },
    { label: "•", title: "无序列表", run: () => prefixLines("- ") },
    { label: "1.", title: "有序列表", run: () => prefixLines((i) => `${i + 1}. `) },
    { label: "❝", title: "引用", run: () => prefixLines("> ") },
    { label: "{ }", title: "代码块", run: () => wrap("```\n", "\n```") },
    { label: "—", title: "分割线", run: () => wrap("\n---\n", "") },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper/80 focus-within:border-leaf">
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-leaf/5 px-2 py-1.5">
        <div className="mr-2 flex overflow-hidden rounded-pill border border-line">
          {(["edit", "preview"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`px-3 py-1 text-xs transition ${
                tab === k ? "bg-forest text-paper" : "text-muted hover:text-forest"
              }`}
            >
              {k === "edit" ? "书写" : "预览"}
            </button>
          ))}
        </div>
        {tab === "edit" &&
          tools.map((tl) => (
            <button
              key={tl.label}
              type="button"
              title={tl.title}
              onClick={() => {
                tl.run();
                requestAnimationFrame(() => ref.current?.focus());
              }}
              className="h-7 min-w-7 rounded-md px-1.5 font-mono text-xs text-ink/80 transition hover:bg-forest/10 hover:text-forest"
            >
              {tl.label}
            </button>
          ))}
        <span className="ml-auto pr-1 text-[11px] text-muted">
          回车续列表 · Tab 缩进 · ⌘B/⌘I/⌘K
        </span>
      </div>

      {tab === "edit" ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          spellCheck={false}
          className="block w-full resize-y bg-transparent px-4 py-3 font-mono text-[13.5px] leading-7 text-ink outline-none placeholder:text-muted"
        />
      ) : (
        <div className="min-h-[12rem] px-4 py-3">
          {value.trim() ? (
            <MarkdownViewer content={value} />
          ) : (
            <p className="text-sm text-muted">还没有内容，切回「书写」开始吧。</p>
          )}
        </div>
      )}
    </div>
  );
}
