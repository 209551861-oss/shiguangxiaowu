import { createClient } from "@/lib/supabase/server";

export type DocSource = "unyra" | "upload" | "manual";

export type DocumentRow = {
  id: string;
  source: DocSource;
  external_id: string;
  goal_id: string | null;
  goal_title: string | null;
  title: string;
  kind: string;
  chars: number;
  content_hash: string;
  source_updated_at: string | null;
  archived_at: string | null;
  updated_at: string;
};

export type DocumentListItem = DocumentRow & { chunkCount: number };

export type ChunkRow = {
  id: string;
  ordinal: number;
  content: string;
  heading_path: string | null;
  char_start: number | null;
  char_end: number | null;
  page_start: number | null;
  page_end: number | null;
  embedding_model: string | null;
};

export type SyncLogRow = {
  id: number;
  source: string;
  title: string | null;
  chunks: number;
  chars: number;
  ok: boolean;
  reason: string | null;
  at: string;
};

export type QaTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  model: string | null;
  channel: string | null;
  created_at: string;
};

export type Citation = {
  tag: string;
  chunkId: string;
  documentId: string;
  title: string;
  headingPath: string | null;
  charStart: number | null;
  charEnd: number | null;
  pageStart: number | null;
  pageEnd: number | null;
  excerpt: string;
};

/** 资料列表（带分块数），未登录时 RLS 返回空 */
export async function listDocuments(source?: string): Promise<DocumentListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("document")
    .select(
      "id,source,external_id,goal_id,goal_title,title,kind,chars,content_hash,source_updated_at,archived_at,updated_at"
    )
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (source && source !== "all") query = query.eq("source", source);

  const { data: docs, error } = await query;
  if (error || !docs) return [];

  const ids = docs.map((d) => d.id);
  if (ids.length === 0) return [];

  const { data: chunks } = await supabase
    .from("chunk")
    .select("document_id")
    .in("document_id", ids);

  const counter = new Map<string, number>();
  for (const c of chunks ?? []) {
    const k = c.document_id as string;
    counter.set(k, (counter.get(k) ?? 0) + 1);
  }

  return docs.map((d) => ({
    ...(d as DocumentRow),
    chunkCount: counter.get(d.id as string) ?? 0,
  }));
}

export async function getDocument(id: string): Promise<(DocumentRow & { body_md: string | null }) | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("document")
    .select(
      "id,source,external_id,goal_id,goal_title,title,kind,chars,content_hash,source_updated_at,archived_at,updated_at,body_md"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as (DocumentRow & { body_md: string | null }) | null) ?? null;
}

export async function getDocumentChunks(documentId: string): Promise<ChunkRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chunk")
    .select("id,ordinal,content,heading_path,char_start,char_end,page_start,page_end,embedding_model")
    .eq("document_id", documentId)
    .order("ordinal", { ascending: true });
  return (data as ChunkRow[] | null) ?? [];
}

export async function getLastSync(): Promise<SyncLogRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sync_log")
    .select("id,source,title,chunks,chars,ok,reason,at")
    .order("at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SyncLogRow | null) ?? null;
}

/** 这份资料被问过的问题（只取提问，用来在详情页回显） */
export async function getRecentQuestions(documentId: string, limit = 8): Promise<string[]> {
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("qa_session")
    .select("id")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(20);

  const ids = (sessions ?? []).map((s) => s.id as string);
  if (ids.length === 0) return [];

  const { data: msgs } = await supabase
    .from("qa_message")
    .select("content,created_at")
    .in("session_id", ids)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (msgs ?? []).map((m) => m.content as string);
}

/** 详情页首屏带的对话记录（同一份资料最近一次会话） */
export async function getLatestSession(documentId: string): Promise<{ id: string; turns: QaTurn[] } | null> {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("qa_session")
    .select("id")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) return null;

  const { data: turns } = await supabase
    .from("qa_message")
    .select("id,role,content,citations,model,channel,created_at")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });

  return { id: session.id as string, turns: (turns as QaTurn[] | null) ?? [] };
}
