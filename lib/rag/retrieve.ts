/**
 * 混合检索：PGroonga 关键词腿 + pgvector 语义腿，RRF 合并。
 *
 * 为什么两条腿都可能只剩一条：
 * - 语义腿需要"问题向量"，本机开发时由归一桥的 bge-m3 现算；
 *   部署到云端后摸不到本机桥，语义腿自动跳过，只走关键词腿（不报错、不白屏）。
 * - 关键词腿是必备的，PGroonga 已实测能正确切中文。
 */

import type { createClient } from "@/lib/supabase/server";
import { bridgeEmbeddings, bridgeHealth } from "@/lib/unyra";
import { buildGroongaQuery, coverage, extractTerms, stripMarkdown } from "./text";

type Client = Awaited<ReturnType<typeof createClient>>;

export type Hit = {
  chunkId: string;
  documentId: string;
  ordinal: number;
  content: string;
  headingPath: string | null;
  charStart: number | null;
  charEnd: number | null;
  pageStart: number | null;
  pageEnd: number | null;
  coverage: number;
  score: number;
  legs: ("kw" | "vec")[];
};

export type RetrieveResult = {
  hits: Hit[];
  terms: string[];
  bestCoverage: number;
  keywordHits: number;
  vectorHits: number;
  vectorSkipped: boolean;
};

type Row = {
  chunk_id: string;
  document_id: string;
  ordinal: number;
  content: string;
  heading_path: string | null;
  char_start: number | null;
  char_end: number | null;
  page_start: number | null;
  page_end: number | null;
  score: number;
};

const RRF_K = 60;

/** 拒答阈值：检索词覆盖不到这个比例，就认为资料里没有依据 */
export const MIN_COVERAGE = 0.34;

function toHit(row: Row, terms: string[]): Omit<Hit, "score" | "legs"> {
  return {
    chunkId: row.chunk_id,
    documentId: row.document_id,
    ordinal: row.ordinal,
    content: row.content,
    headingPath: row.heading_path,
    charStart: row.char_start,
    charEnd: row.char_end,
    pageStart: row.page_start,
    pageEnd: row.page_end,
    coverage: coverage(stripMarkdown(row.content), terms),
  };
}

export async function retrieve(
  supabase: Client,
  question: string,
  opts: { documentId?: string | null; limit?: number } = {}
): Promise<RetrieveResult> {
  const terms = extractTerms(question);
  const query = buildGroongaQuery(terms);
  const limit = opts.limit ?? 6;
  const poolLimit = 16;

  if (!query || terms.length === 0) {
    return { hits: [], terms, bestCoverage: 0, keywordHits: 0, vectorHits: 0, vectorSkipped: true };
  }

  // ---- 关键词腿 ----
  const { data: kwData, error: kwErr } = await supabase.rpc("chunk_search_keyword", {
    p_query: query,
    p_limit: poolLimit,
    p_document_id: opts.documentId ?? null,
  });
  if (kwErr) throw new Error(`关键词检索失败：${kwErr.message}`);

  const kwRows = (kwData ?? []) as Row[];

  // ---- 语义腿（桥可达才算）----
  let vecRows: Row[] = [];
  let vectorSkipped = true;
  const health = await bridgeHealth(1000);
  if (health && health.embedding?.loaded !== false) {
    try {
      const [vec] = await bridgeEmbeddings(question);
      if (vec?.length === 1024) {
        const { data: vData, error: vErr } = await supabase.rpc("chunk_search_vector", {
          p_embedding: JSON.stringify(vec),
          p_limit: poolLimit,
          p_document_id: opts.documentId ?? null,
        });
        if (!vErr) {
          vecRows = (vData ?? []) as Row[];
          vectorSkipped = false;
        }
      }
    } catch {
      // 向量腿失败不影响关键词腿
    }
  }

  // ---- RRF 合并 ----
  const merged = new Map<string, Hit>();
  const bump = (row: Row, leg: "kw" | "vec", rank: number) => {
    const exist = merged.get(row.chunk_id);
    const gain = 1 / (RRF_K + rank + 1);
    if (exist) {
      exist.score += gain;
      if (!exist.legs.includes(leg)) exist.legs.push(leg);
      return;
    }
    merged.set(row.chunk_id, { ...toHit(row, terms), score: gain, legs: [leg] });
  };

  kwRows.forEach((r, i) => bump(r, "kw", i));
  vecRows.forEach((r, i) => bump(r, "vec", i));

  const hits = [...merged.values()]
    // 覆盖度是硬门槛：RRF 只排序，别让语义相近但没提关键字的块混进引用
    .filter((h) => h.coverage >= 0.2)
    .sort((a, b) => b.score - a.score || b.coverage - a.coverage)
    .slice(0, limit);

  const bestCoverage = hits.reduce((m, h) => Math.max(m, h.coverage), 0);

  return {
    hits,
    terms,
    bestCoverage,
    keywordHits: kwRows.length,
    vectorHits: vecRows.length,
    vectorSkipped,
  };
}
