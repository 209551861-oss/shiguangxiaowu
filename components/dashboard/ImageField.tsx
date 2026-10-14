"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 图片上传字段（公开桶）。
 * - multiple=false：单图（封面），value 为公开 URL 字符串。
 * - multiple=true ：多图（瞬间），value 为公开 URL 数组。
 */
export default function ImageField({
  bucket,
  multiple = false,
  value,
  onChange,
  label,
}: {
  bucket: string;
  multiple?: boolean;
  value: string | string[];
  onChange: (v: string | string[]) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const urls: string[] = multiple
    ? (value as string[]) || []
    : value
      ? [value as string]
      : [];

  function removeAt(i: number) {
    if (multiple) {
      const next = urls.filter((_, idx) => idx !== i);
      onChange(next);
    } else {
      onChange("");
    }
  }

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files.length) return;
    setBusy(true);
    const supabase = createClient();
    const next = multiple ? [...urls] : [];
    let errored = "";
    for (const file of Array.from(files)) {
      const safe = file.name.replace(/[^\w.\-]/g, "_");
      const path = `${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: false, cacheControl: "3600" });
      if (error) {
        errored = error.message;
        continue;
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      next.push(data.publicUrl);
    }
    setBusy(false);
    if (errored) alert("部分图片上传失败：" + errored);
    onChange(multiple ? next : next[0] ?? "");
    e.target.value = "";
  }

  return (
    <div>
      {label && <p className="mb-1 text-sm text-ink">{label}</p>}
      <div className="flex flex-wrap gap-3">
        {urls.map((u, i) => (
          <div
            key={u}
            className="relative h-24 w-24 overflow-hidden rounded-xl border border-line bg-paper"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1 top-1 rounded-full bg-forest/80 px-1.5 text-xs text-white"
              aria-label="删除"
            >
              ✕
            </button>
          </div>
        ))}

        <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-muted transition hover:border-pollen">
          <span className="text-xl">{busy ? "…" : "⬆"}</span>
          <span className="text-xs">{busy ? "上传中" : "上传"}</span>
          <input
            type="file"
            accept="image/*"
            multiple={multiple}
            className="hidden"
            onChange={handle}
          />
        </label>
      </div>
    </div>
  );
}
