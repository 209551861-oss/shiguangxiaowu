/**
 * 资料问答：检索 → 组 prompt → 调模型 → 服务端校验引用。
 *
 * 关键点（需求文档 §7.3）：
 * - 编号 [S1]…[S6] 由服务端分配，模型只许引用已给的编号
 * - 模型编出来的编号一律剔除
 * - 引用条目（标题/章节/字符区间）全部由数据库元数据生成，不采信模型输出
 * - 召回覆盖度不够就拒答，不猜
 */

import type { createClient } from "@/lib/supabase/server";
import { chat, type Channel } from "@/lib/ai";
import { stripMarkdown } from "./text";
import { MIN_COVERAGE, retrieve, type Hit } from "./retrieve";
import type { Citation } from "@/lib/services/library";

type Client = Awaited<ReturnType<typeof createClient>>;

export const REFUSAL_TEXT =
  "当前资料库没有找到足够依据，这个我不猜。可以换个说法问，或先把相关笔记放进资料库。";

export type AskResult = {
  answer: string;
  citations: Citation[];
  refused: boolean;
  model: string;
  channel: Channel;
  latencyMs: number;
  hits: Hit[];
  bestCoverage: number;
  vectorSkipped: boolean;
};

const SYSTEM = `你是宁雪的私人学习助教。你只能依据下面给出的【资料】回答，不允许使用资料以外的知识，不允许编造。

回答规则：
1. 每句有事实依据的话，句末必须标注来源编号，格式如 [S1]；同一句可标注多个，如 [S1][S3]。
2. 只能使用下面实际出现的编号，绝对不许自己编造编号。
3. 如果【资料】不足以回答，直接用一句「资料里没有」开头说明缺什么，不要给出猜测性答案。
4. 用中文，短句，先给结论，再给依据；不要整段复述资料原文。
5. 如果问题与资料完全无关，直接说资料里没有相关内容。`;

function buildSources(hits: Hit[], docTitle?: string) {
  return hits
    .map((h, i) => {
      const where = h.headingPath ? ` · ${h.headingPath}` : "";
      return `[S${i + 1}] 《${docTitle ?? "资料"}》${where}\n${h.content}`;
    })
    .join("\n\n");
}

function excerpt(text: string, max = 140) {
  const plain = stripMarkdown(text);
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

/** 把模型输出里的 [Sx] 过滤成合法集合，并按使用顺序生成本地引用条目 */
function normalizeCitations(raw: string, hits: Hit[], docTitle: string) {
  const used: number[] = [];
  const cleaned = raw.replace(/\[S(\d+)\]/g, (whole, num: string) => {
    const idx = Number(num) - 1;
    if (idx < 0 || idx >= hits.length) return ""; // 编造的编号，剔除
    if (!used.includes(idx)) used.push(idx);
    return whole;
  });

  const citations: Citation[] = used.map((idx) => {
    const h = hits[idx];
    return {
      tag: `S${idx + 1}`,
      chunkId: h.chunkId,
      documentId: h.documentId,
      title: docTitle,
      headingPath: h.headingPath,
      charStart: h.charStart,
      charEnd: h.charEnd,
      pageStart: h.pageStart,
      pageEnd: h.pageEnd,
      excerpt: excerpt(h.content),
    };
  });

  return { cleaned: cleaned.replace(/[ \t]{2,}/g, " ").trim(), citations };
}

export async function answerQuestion(
  supabase: Client,
  opts: {
    question: string;
    documentId?: string | null;
    documentTitle?: string;
    model?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  }
): Promise<AskResult> {
  const started = Date.now();
  const question = opts.question.trim();
  if (!question) throw new Error("问题不能为空");

  const r = await retrieve(supabase, question, { documentId: opts.documentId ?? null });

  // 没检索到，或命中内容跟问题对不上 → 直接拒答，不调模型
  if (r.hits.length === 0 || r.bestCoverage < MIN_COVERAGE) {
    return {
      answer: REFUSAL_TEXT,
      citations: [],
      refused: true,
      model: "none",
      channel: "none",
      latencyMs: Date.now() - started,
      hits: [],
      bestCoverage: r.bestCoverage,
      vectorSkipped: r.vectorSkipped,
    };
  }

  const docTitle = opts.documentTitle ?? "资料";
  const messages = [
    { role: "system" as const, content: SYSTEM },
    {
      role: "user" as const,
      content: `【资料】\n${buildSources(r.hits, docTitle)}\n\n【问题】\n${question}`,
    },
  ];

  const res = await chat(messages, { model: opts.model, temperature: 0.2, maxTokens: 900 });

  if (!res.content.trim()) {
    return {
      answer: "模型这一次没有返回内容，稍后再试一次。",
      citations: [],
      refused: true,
      model: res.model,
      channel: res.channel,
      latencyMs: Date.now() - started,
      hits: r.hits,
      bestCoverage: r.bestCoverage,
      vectorSkipped: r.vectorSkipped,
    };
  }

  const { cleaned, citations } = normalizeCitations(res.content, r.hits, docTitle);
  const saidNothing = /资料里没有|资料中没有|没有找到相关/.test(cleaned.slice(0, 60));

  return {
    answer: cleaned,
    citations: saidNothing ? [] : citations,
    refused: saidNothing,
    model: res.model,
    channel: res.channel,
    latencyMs: Date.now() - started,
    hits: r.hits,
    bestCoverage: r.bestCoverage,
    vectorSkipped: r.vectorSkipped,
  };
}
