"use client";

/**
 * 内容编辑器（占位）。
 * Phase 3 替换为 Markdown 编辑器（如 @uiw/react-md-editor）。
 * 当前为受控 textarea，事件已预留 onChange。
 */
export default function Editor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={12}
      placeholder="开始书写…（支持 Markdown）"
      className="w-full rounded-2xl border border-line bg-paper/80 p-4 text-ink outline-none placeholder:text-muted focus:border-leaf"
    />
  );
}
