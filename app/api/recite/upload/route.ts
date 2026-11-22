import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reciteOwnerId } from "@/lib/recite/guard";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB

const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** 附件白名单：扩展名 → 允许的 MIME 前缀 */
const FILE_RULES: { ext: string; mimes: string[]; label: string }[] = [
  { ext: "pdf", mimes: ["application/pdf"], label: "PDF" },
  { ext: "txt", mimes: ["text/plain"], label: "文本" },
  { ext: "md", mimes: ["text/plain", "text/markdown", "text/x-markdown"], label: "Markdown" },
  { ext: "csv", mimes: ["text/csv", "text/plain", "application/vnd.ms-excel"], label: "CSV" },
  { ext: "json", mimes: ["application/json", "text/plain"], label: "JSON" },
  {
    ext: "docx",
    mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    label: "Word",
  },
  {
    ext: "xlsx",
    mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    label: "Excel",
  },
  {
    ext: "pptx",
    mimes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    label: "PowerPoint",
  },
  { ext: "zip", mimes: ["application/zip", "application/x-zip-compressed"], label: "压缩包" },
];

/** 只看文件头，不信浏览器给的 MIME */
function sniff(buf: Uint8Array): "png" | "jpeg" | "gif" | "webp" | "pdf" | "zip" | "text" | "unknown" {
  const b = buf;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return "webp";
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05)) return "zip";
  // 纯文本：没有 0 字节且大部分是可打印字符
  const sample = b.subarray(0, Math.min(b.length, 512));
  if (sample.length > 0 && !sample.includes(0)) return "text";
  return "unknown";
}

function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120) || "file";
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "登录后才能上传" }, { status: 401 });

  const owner = await reciteOwnerId();
  if (owner && owner !== user.id) {
    return Response.json({ error: "没有权限" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "没有收到文件" }, { status: 400 });
  }
  if (file.size === 0) return Response.json({ error: "文件为空" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "单个文件不能超过 20MB" }, { status: 413 });
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniff(buf);
  const ext = extOf(file.name);
  const declared = file.type || "application/octet-stream";
  const isImage = IMAGE_MIME.has(declared) || ["png", "jpeg", "gif", "webp"].includes(sniffed);

  let mime = declared;
  let kind: "image" | "file" = "file";
  let storedExt = ext || "bin";

  if (isImage) {
    const map: Record<string, { mime: string; ext: string }> = {
      png: { mime: "image/png", ext: "png" },
      jpeg: { mime: "image/jpeg", ext: "jpg" },
      gif: { mime: "image/gif", ext: "gif" },
      webp: { mime: "image/webp", ext: "webp" },
    };
    const hit = map[sniffed];
    if (!hit) return Response.json({ error: "图片格式不支持（只收 PNG / JPG / WebP / GIF）" }, { status: 415 });
    kind = "image";
    mime = hit.mime;
    storedExt = hit.ext;
  } else {
    const rule = FILE_RULES.find((r) => r.ext === ext);
    if (!rule) {
      return Response.json({ error: `不支持的文件类型 .${ext || "未知"}` }, { status: 415 });
    }
    const contentTypeOk =
      rule.mimes.includes(declared) ||
      (rule.ext === "md" && declared.startsWith("text/")) ||
      (rule.ext === "csv" && declared.startsWith("text/"));
    if (!contentTypeOk) {
      return Response.json({ error: "文件类型与内容不符" }, { status: 415 });
    }
    if (rule.ext === "pdf" && sniffed !== "pdf") {
      return Response.json({ error: "不是有效的 PDF" }, { status: 415 });
    }
    if (["docx", "xlsx", "pptx", "zip"].includes(rule.ext) && sniffed !== "zip") {
      return Response.json({ error: "不是有效的 Office / ZIP 文件" }, { status: 415 });
    }
    mime = rule.mimes[0];
    kind = "file";
  }

  const itemId = String(form.get("itemId") ?? "").trim() || null;
  const unitId = String(form.get("unitId") ?? "").trim() || null;

  // 归属校验：父级记录必须存在且属于当前用户（读不出来就是无权）
  if (itemId) {
    const { data } = await supabase
      .from("knowledge_item")
      .select("id")
      .eq("id", itemId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data) return Response.json({ error: "找不到所属内容" }, { status: 404 });
  }
  if (unitId) {
    const { data } = await supabase
      .from("review_unit")
      .select("id")
      .eq("id", unitId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data) return Response.json({ error: "找不到所属复习单元" }, { status: 404 });
  }

  const key = `recite/${user.id}/${crypto.randomUUID()}.${storedExt}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("private")
    .upload(key, buf, { contentType: mime, upsert: false });

  if (uploadError) {
    return Response.json({ error: `存储写入失败：${uploadError.message}` }, { status: 500 });
  }

  const { data: row, error: dbError } = await supabase
    .from("attachment")
    .insert({
      owner_user_id: user.id,
      item_id: itemId,
      review_unit_id: unitId,
      kind,
      filename: safeName(file.name),
      mime,
      size: file.size,
      storage_key: key,
    })
    .select("id")
    .single();

  if (dbError) {
    await admin.storage.from("private").remove([key]);
    return Response.json({ error: dbError.message }, { status: 500 });
  }

  const id = (row as { id: string }).id;
  return Response.json({
    id,
    kind,
    filename: safeName(file.name),
    url: `/api/recite/file/${id}`,
  });
}
