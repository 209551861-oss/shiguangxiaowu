"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "tiptap-markdown";

/**
 * 双模式编辑器。
 *
 * Markdown 是唯一真源：富文本模式只是它的渲染/编辑视图，切换时不另存一份 HTML。
 * 这样「两种模式共用同一份内容」是结构上的保证，而不是靠来回转换对齐。
 *
 * 两个实现细节，都是踩过坑之后定下来的：
 * 1. 富文本区、源码区、隐藏字段三者始终挂载，只切显隐 —— 早期版本按模式条件渲染，
 *    会造成受控输入在切换时被卸载重建，React 直接报 controlled/uncontrolled 警告。
 * 2. 隐藏字段在「编辑器加载中」时就已经存在并带着初值 —— 否则用户抢在挂载前
 *    点保存，表单里没有这个字段，已有正文会被空值覆盖。
 *
 * 已知边界：公式在富文本模式里以 `$...$` 源码形式出现，阅读态才渲染成排版；
 * 复杂表格在富文本里可编辑，但转回 Markdown 时会被规整成标准管道表格。
 */

export type MarkdownEditorProps = {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  itemId?: string;
  unitId?: string;
  minHeight?: number;
  autoFocus?: boolean;
};

type Mode = "rich" | "md";

const readMarkdown = (editor: Editor): string => {
  const storage = editor.storage as unknown as { markdown?: { getMarkdown(): string } };
  return storage.markdown?.getMarkdown() ?? "";
};

export default function MarkdownEditor({
  name,
  defaultValue,
  placeholder = "开始写…",
  itemId,
  unitId,
  minHeight = 220,
  autoFocus = false,
}: MarkdownEditorProps) {
  const initial = defaultValue ?? "";
  const [mode, setMode] = useState<Mode>("rich");
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(initial);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: "code-block" } },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      TableKit.configure({ table: { resizable: false } }),
      Markdown.configure({
        html: false,
        tightLists: true,
        breaks: true,
        linkify: true,
      }),
    ],
    content: initial,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class: "recite-prose focus:outline-none",
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor: e }) => {
      const md = readMarkdown(e);
      valueRef.current = md;
      setValue(md);
    },
  });

  // 从 Markdown 切回富文本：把源码区的最新内容灌进编辑器
  const switchTo = useCallback(
    (next: Mode) => {
      if (next === mode) return;
      if (next === "rich" && editor) {
        editor.commands.setContent(valueRef.current || "");
      }
      setMode(next);
    },
    [editor, mode]
  );

  const upload = useCallback(
    async (file: File): Promise<string> => {
      const fd = new FormData();
      fd.append("file", file);
      if (itemId) fd.append("itemId", itemId);
      if (unitId) fd.append("unitId", unitId);
      const res = await fetch("/api/recite/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error || "上传失败");
      return json.url;
    },
    [itemId, unitId]
  );

  const onPickFile = useCallback(
    async (file: File | null) => {
      if (!file || !editor) return;
      setBusy(true);
      setError(null);
      try {
        const url = await upload(file);
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      } catch (err) {
        setError(err instanceof Error ? err.message : "上传失败");
      } finally {
        setBusy(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [editor, upload]
  );

  // 支持直接把图片拖进正文
  useEffect(() => {
    const el = editor?.view.dom;
    if (!el) return;
    const onDrop = (event: DragEvent) => {
      const file = event.dataTransfer?.files?.[0];
      if (file && file.type.startsWith("image/")) {
        event.preventDefault();
        void onPickFile(file);
      }
    };
    el.addEventListener("drop", onDrop);
    return () => el.removeEventListener("drop", onDrop);
  }, [editor, onPickFile]);

  const btn = (active: boolean) =>
    `rounded-lg px-2.5 py-1.5 text-[13px] transition ${
      active ? "bg-forest text-paper" : "text-ink hover:bg-leaf/15"
    }`;

  const run = (fn: (chain: ReturnType<Editor["chain"]>) => void) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    fn(chain);
    chain.run();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper">
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-mist/60 px-2 py-1.5">
        <div className="mr-1 flex rounded-lg bg-paper p-0.5 ring-1 ring-line">
          <button
            type="button"
            onClick={() => switchTo("rich")}
            className={`rounded-md px-2.5 py-1 text-[12px] ${
              mode === "rich" ? "bg-forest text-paper" : "text-muted"
            }`}
          >
            可视化
          </button>
          <button
            type="button"
            onClick={() => switchTo("md")}
            className={`rounded-md px-2.5 py-1 text-[12px] ${
              mode === "md" ? "bg-forest text-paper" : "text-muted"
            }`}
          >
            Markdown
          </button>
        </div>

        {mode === "rich" && (
          <>
            <span className="mx-1 h-4 w-px bg-line" />
            <button type="button" className={btn(!!editor?.isActive("bold"))} onClick={() => run((c) => c.toggleBold())} title="加粗">
              <b>B</b>
            </button>
            <button type="button" className={btn(!!editor?.isActive("italic"))} onClick={() => run((c) => c.toggleItalic())} title="斜体">
              <i>I</i>
            </button>
            <button type="button" className={btn(!!editor?.isActive("strike"))} onClick={() => run((c) => c.toggleStrike())} title="删除线">
              <s>S</s>
            </button>
            <button
              type="button"
              className={btn(!!editor?.isActive("heading", { level: 2 }))}
              onClick={() => run((c) => c.toggleHeading({ level: 2 }))}
              title="二级标题"
            >
              H2
            </button>
            <button
              type="button"
              className={btn(!!editor?.isActive("heading", { level: 3 }))}
              onClick={() => run((c) => c.toggleHeading({ level: 3 }))}
              title="三级标题"
            >
              H3
            </button>
            <button type="button" className={btn(!!editor?.isActive("bulletList"))} onClick={() => run((c) => c.toggleBulletList())} title="无序列表">
              ••
            </button>
            <button type="button" className={btn(!!editor?.isActive("orderedList"))} onClick={() => run((c) => c.toggleOrderedList())} title="有序列表">
              1.
            </button>
            <button type="button" className={btn(!!editor?.isActive("blockquote"))} onClick={() => run((c) => c.toggleBlockquote())} title="引用">
              ❝
            </button>
            <button type="button" className={btn(!!editor?.isActive("codeBlock"))} onClick={() => run((c) => c.toggleCodeBlock())} title="代码块">
              {"</>"}
            </button>
            <button type="button" className={btn(!!editor?.isActive("code"))} onClick={() => run((c) => c.toggleCode())} title="行内代码">
              `
            </button>
            <button
              type="button"
              className={btn(false)}
              title="链接"
              onClick={() => {
                if (!editor) return;
                const url = window.prompt("链接地址", "https://");
                if (!url) return;
                editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
              }}
            >
              🔗
            </button>
            <button
              type="button"
              className={btn(false)}
              title="插入表格"
              onClick={() => run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}
            >
              ▦
            </button>
            <button type="button" className={btn(false)} onClick={() => fileRef.current?.click()} title="插入图片" disabled={busy}>
              {busy ? "…" : "🖼"}
            </button>
            <button
              type="button"
              className={btn(false)}
              title="插入行内公式"
              onClick={() => run((c) => c.insertContent("$E=mc^2$"))}
            >
              ∑
            </button>
            <span className="mx-1 h-4 w-px bg-line" />
            <button type="button" className={btn(false)} onClick={() => run((c) => c.undo())} title="撤销">
              ↶
            </button>
            <button type="button" className={btn(false)} onClick={() => run((c) => c.redo())} title="重做">
              ↷
            </button>
          </>
        )}

        <span className="ml-auto text-[11px] text-muted">
          {mode === "rich" ? "所见即所得" : "源码编辑"} · {value.length} 字符
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
      />

      {/* 富文本区：始终挂载，只切显隐 */}
      <div className={mode === "rich" ? "" : "hidden"}>
        {editor ? (
          <EditorContent editor={editor} className="recite-editor px-4 py-3" />
        ) : (
          <div className="px-4 py-3 text-sm text-muted" style={{ minHeight }}>
            编辑器加载中…
          </div>
        )}
      </div>

      {/* 源码区：始终挂载，保证切换时草稿不丢；提交仍然只走隐藏字段 */}
      <textarea
        value={value}
        onChange={(e) => {
          valueRef.current = e.target.value;
          setValue(e.target.value);
        }}
        spellCheck={false}
        placeholder={placeholder}
        className={`w-full resize-y bg-paper px-4 py-3 font-mono text-[13px] leading-6 text-ink outline-none ${
          mode === "md" ? "" : "hidden"
        }`}
        style={{ minHeight }}
      />

      <input type="hidden" name={name} value={value} />

      {error && (
        <p className="border-t border-line bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>
      )}
    </div>
  );
}
