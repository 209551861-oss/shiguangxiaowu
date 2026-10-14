"use client";

/**
 * 文件上传（占位）。
 * Phase 1 后接入 Supabase Storage：原图进 private 桶，自动生成 3 档缩略图，
 * 公开资源进对应公共桶。当前仅做本地选择预览。
 */
import { useState } from "react";

export default function Upload({
  bucket = "private",
  onUploaded,
}: {
  bucket?: string;
  onUploaded?: (path: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <label className="glass flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-dashed border-2 border-line p-6 text-center text-muted transition hover:border-pollen">
      <span className="text-2xl">⬆</span>
      <span className="text-sm">点击选择文件</span>
      <span className="text-xs opacity-70">目标桶：{bucket}</span>
      <input
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setName(f.name);
            // TODO(Phase 1): upload to Supabase Storage
          }
        }}
      />
      {name && <span className="mt-1 text-xs text-forest">已选择：{name}</span>}
    </label>
  );
}
