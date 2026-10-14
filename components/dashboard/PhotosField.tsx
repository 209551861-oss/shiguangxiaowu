"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 照片上传字段（私有桶原图 + 公开桶缩略图）。
 * 原图上传到 private 桶（不对外暴露），同时在前端生成缩略图上传到 gallery 公开桶，
 * 返回 { file_path, thumbnail_url } 直接写入 photos 表的对应列。
 */
export default function PhotosField({
  file_path,
  thumbnail_url,
  onChange,
  required,
}: {
  file_path: string;
  thumbnail_url: string;
  onChange: (v: { file_path: string; thumbnail_url: string }) => void;
  required?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function makeThumbnail(file: File, maxDim = 1280): Promise<Blob> {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("图片读取失败"));
      img.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), "image/jpeg", 0.82)
    );
  }

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const supabase = createClient();

    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const origPath = `photos/${crypto.randomUUID()}-${safe}`;
    const { error: e1 } = await supabase.storage
      .from("private")
      .upload(origPath, file, { upsert: false });
    if (e1) {
      alert(e1.message);
      setBusy(false);
      return;
    }

    const thumb = await makeThumbnail(file);
    const thumbPath = `photos/${crypto.randomUUID()}.jpg`;
    const { error: e2 } = await supabase.storage
      .from("gallery")
      .upload(thumbPath, thumb, {
        upsert: false,
        contentType: "image/jpeg",
        cacheControl: "3600",
      });
    if (e2) {
      alert(e2.message);
      setBusy(false);
      return;
    }

    const { data } = supabase.storage.from("gallery").getPublicUrl(thumbPath);
    setBusy(false);
    onChange({ file_path: origPath, thumbnail_url: data.publicUrl });
    e.target.value = "";
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-line bg-paper">
          {thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-muted">
              {file_path ? "原图已存" : "未上传"}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="cursor-pointer rounded-pill bg-leaf/15 px-4 py-2 text-sm text-forest transition hover:bg-leaf/25">
            {busy ? "处理中…" : file_path ? "重新上传" : "选择照片"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handle}
            />
          </label>
          {file_path && (
            <button
              type="button"
              onClick={() => onChange({ file_path: "", thumbnail_url: "" })}
              className="rounded-pill px-4 py-1 text-xs text-muted hover:text-forest"
            >
              清除
            </button>
          )}
          {required && !file_path && (
            <span className="text-xs text-forest">* 必填</span>
          )}
        </div>
      </div>
    </div>
  );
}
