/**
 * 中文检索用的轻量文本处理。
 *
 * 为什么不用 tsvector：PostgreSQL 默认分词不认中文，整段中文会被当成一个词。
 * 本项目走 PGroonga（TokenBigram）+ 应用层覆盖度打分，所以这里自己切"检索词"：
 * - 拉丁词/数字/代码标识符：整词
 * - 中文连续串：二元切分（二叉树 -> 二叉 / 叉树），再滤掉虚词二元组
 */

const CJK = /[\u4e00-\u9fa5]/;
const CJK_RUN = /[\u4e00-\u9fa5]+/g;
const WORD_RUN = /[a-zA-Z0-9_][a-zA-Z0-9_+#.-]*/g;

/** 虚词二元组：出现在问题里但不构成检索意图 */
const STOP_BIGRAMS = new Set([
  "什么", "怎么", "如何", "为什", "是什", "么是", "怎样", "哪些", "有哪", "哪个",
  "这个", "那个", "这些", "那些", "可以", "能不", "不能", "是否", "是不", "不是",
  "我们", "你们", "他们", "一下", "请问", "告诉", "解释", "说明", "意思", "区别",
  "为什", "么样", "了吗", "呢吗", "的是", "了的", "在有", "有的", "和和",
]);

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "what", "how", "why", "does", "did", "is", "are",
  "a", "an", "of", "to", "in", "on", "it", "this", "that",
]);

/** 提取检索词（去重、保持出现顺序） */
export function extractTerms(question: string): string[] {
  const q = question.toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (t: string) => {
    const term = t.trim();
    if (!term || seen.has(term)) return;
    seen.add(term);
    out.push(term);
  };

  for (const m of q.matchAll(WORD_RUN)) {
    const w = m[0].replace(/[.-]+$/, "");
    if (w.length >= 2 && !STOP_WORDS.has(w)) push(w);
  }

  for (const m of q.matchAll(CJK_RUN)) {
    const run = m[0];
    if (run.length <= 2) {
      if (!STOP_BIGRAMS.has(run)) push(run);
      continue;
    }
    // 长串整体也留一个（命中标题时加分），但主要靠二元
    for (let i = 0; i < run.length - 1; i += 1) {
      const bigram = run.slice(i, i + 2);
      if (!STOP_BIGRAMS.has(bigram)) push(bigram);
    }
  }

  return out;
}

/** 拼 PGroonga 查询串：显式 OR，避免默认语义不确定 */
export function buildGroongaQuery(terms: string[]): string {
  const safe = terms
    .map((t) => t.replace(/["\\()]/g, " ").trim())
    .filter(Boolean)
    .slice(0, 24);
  if (safe.length === 0) return "";
  return safe.map((t) => `"${t}"`).join(" OR ");
}

/** 去掉 markdown 标记与内嵌 HTML，便于在渲染后的正文里做定位与打分 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~>|]/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 覆盖度：检索词有多少真的出现在这段文字里（0–1） */
export function coverage(content: string, terms: string[]): number {
  if (terms.length === 0) return 0;
  const text = content.toLowerCase();
  let hit = 0;
  for (const t of terms) {
    if (text.includes(t)) hit += 1;
  }
  return hit / terms.length;
}
