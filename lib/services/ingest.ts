/**
 * 资料入库（幂等）
 *
 * 语义（需求文档 §4.3）：
 * - (user_id, source, external_id) 唯一，据此 upsert
 * - content_hash 相同 → 直接 skipped，不重建 chunk、不碰任何学习记录
 * - 内容变了才删旧 chunk 重建；正文落在 document.body_md，chunk 的字符区间以它为坐标系
 * - 成功失败都写 sync_log，页面才有"上次同步"可显示
 */

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkMarkdown } from "@/lib/rag/chunk";

export type IngestPayload = {
  source?: "unyra" | "upload" | "manual";
  externalId: string;
  goalId?: string | null;
  goalTitle?: string | null;
  title?: string;
  markdown: string;
  contentHash?: string;
  updatedAt?: number | null;
  chars?: number;
  kind?: "markdown" | "pdf" | "docx" | "txt";
};

export type IngestResult = {
  documentId: string | null;
  chunks: number;
  skipped: boolean;
  existed: boolean;
  reason?: string;
};

export function hashOf(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export async function ingestDocument(
  admin: SupabaseClient,
  userId: string,
  payload: IngestPayload
): Promise<IngestResult> {
  const markdown = String(payload.markdown ?? "");
  if (!payload.externalId || !markdown.trim()) {
    throw new Error("externalId 和 markdown 必填");
  }

  const source = payload.source ?? "unyra";
  const contentHash = payload.contentHash || hashOf(markdown);
  const title = payload.title?.trim() || "未命名资料";
  const chars = payload.chars ?? markdown.replace(/\s/g, "").length;

  const log = async (ok: boolean, chunks: number, reason?: string) => {
    await admin.from("sync_log").insert({
      user_id: userId,
      source,
      external_id: payload.externalId,
      title,
      chunks,
      chars,
      content_hash: contentHash,
      ok,
      reason: reason ?? null,
    });
  };

  const { data: existing } = await admin
    .from("document")
    .select("id,content_hash,archived_at")
    .eq("user_id", userId)
    .eq("source", source)
    .eq("external_id", payload.externalId)
    .maybeSingle();

  if (existing && existing.content_hash === contentHash && !existing.archived_at) {
    return {
      documentId: existing.id as string,
      chunks: 0,
      skipped: true,
      existed: true,
      reason: "content-hash-unchanged",
    };
  }

  const docRow = {
    user_id: userId,
    source,
    external_id: payload.externalId,
    goal_id: payload.goalId ?? null,
    goal_title: payload.goalTitle ?? null,
    title,
    kind: payload.kind ?? "markdown",
    content_hash: contentHash,
    chars,
    body_md: markdown,
    source_updated_at: payload.updatedAt ? new Date(payload.updatedAt).toISOString() : null,
    archived_at: null,
    updated_at: new Date().toISOString(),
  };

  const { data: doc, error: docErr } = await admin
    .from("document")
    .upsert(docRow, { onConflict: "user_id,source,external_id" })
    .select("id")
    .single();

  if (docErr || !doc) {
    await log(false, 0, docErr?.message ?? "文档写入失败");
    throw new Error(`文档写入失败：${docErr?.message ?? "未知错误"}`);
  }

  await admin.from("chunk").delete().eq("document_id", doc.id);

  const drafts = chunkMarkdown(markdown);
  const rows = drafts.map((c) => ({
    document_id: doc.id,
    user_id: userId,
    ordinal: c.ordinal,
    content: c.content,
    heading_path: c.headingPath || null,
    char_start: c.charStart,
    char_end: c.charEnd,
    embedding_model: null,
  }));

  if (rows.length > 0) {
    const { error: chunkErr } = await admin.from("chunk").insert(rows);
    if (chunkErr) {
      await log(false, 0, chunkErr.message);
      throw new Error(`分块写入失败：${chunkErr.message}`);
    }
  }

  await log(true, rows.length);
  return { documentId: doc.id as string, chunks: rows.length, skipped: false, existed: !!existing };
}

/** 给还没有向量的 chunk 补 bge-m3 向量（只在能连到归一桥时可用，即本机） */
export async function embedPendingChunks(
  admin: SupabaseClient,
  userId: string,
  documentId: string,
  embed: (input: string[]) => Promise<number[][]>,
  batch = 8
): Promise<{ embedded: number; model: string }> {
  const { data: rows } = await admin
    .from("chunk")
    .select("id,content")
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .is("embedding", null)
    .order("ordinal", { ascending: true });

  const pending = rows ?? [];
  let done = 0;

  for (let i = 0; i < pending.length; i += batch) {
    const slice = pending.slice(i, i + batch);
    const vectors = await embed(slice.map((r) => r.content as string));
    for (let j = 0; j < slice.length; j += 1) {
      const vec = vectors[j];
      if (!vec || vec.length !== 1024) continue;
      const { error } = await admin
        .from("chunk")
        .update({ embedding: JSON.stringify(vec), embedding_model: "bge-m3" })
        .eq("id", slice[j].id);
      if (!error) done += 1;
    }
  }

  return { embedded: done, model: "bge-m3" };
}
