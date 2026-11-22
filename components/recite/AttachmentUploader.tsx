"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 附件上传：图片走编辑器插入正文，其它文件走这里。
 * 上传成功后刷新页面，由服务端列出附件（尺寸/类型/时间都在服务端算）。
 */
export default function AttachmentUploader({
  itemId,
  unitId,
}: {
  itemId?: string;
  unitId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        if (itemId) fd.append("itemId", itemId);
        if (unitId) fd.append("unitId", unitId);
        const res = await fetch("/api/recite/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error || `${file.name} 上传失败`);
        }
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void upload(e.target.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-pill border border-line bg-paper px-4 py-1.5 text-sm text-forest transition hover:bg-leaf/10 disabled:opacity-60"
      >
        {busy ? "上传中…" : "+ 添加附件"}
      </button>
      <span className="text-[11px] text-muted">PDF / 文本 / Markdown / CSV / Office / ZIP · 单个 ≤ 20MB</span>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
