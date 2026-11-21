/**
 * 标题优先的 markdown 切块。
 *
 * 规则（对齐需求文档 §7.1）：
 * - 先按 markdown 标题分段，heading_path 记下层级路径
 * - 单段过长再按空行折，目标 1000 字、重叠 150 字
 * - 每块必留 ordinal / char_start / char_end，引用靠它定位
 */

export type ChunkDraft = {
  ordinal: number;
  content: string;
  headingPath: string;
  charStart: number;
  charEnd: number;
};

const TARGET = 1000;
const OVERLAP = 150;

/**
 * 修正重叠片段的边界：别让下一个块从 HTML 标签中间开始
 * （否则引用片段会以 `elaxed text-ink">` 这种残片开头）。
 */
function trimToSafeBoundary(tail: string): string {
  const firstLt = tail.indexOf("<");
  const firstGt = tail.indexOf(">");
  const lastLt = tail.lastIndexOf("<");
  const lastGt = tail.lastIndexOf(">");

  // 开头落在标签体内部：如 'elaxed text-ink">正文'（首个 '>' 之前有引号或等号，且没遇到 '<'）
  if (firstGt !== -1 && (firstLt === -1 || firstGt < firstLt) && /["=]/.test(tail.slice(0, firstGt))) {
    return tail.slice(firstGt + 1);
  }
  // 结尾有未闭合的 '<'：丢掉，免得下一个块开头是半个标签
  if (lastLt > lastGt) {
    return tail.slice(0, lastLt);
  }
  return tail;
}

export function chunkMarkdown(
  markdown: string,
  target = TARGET,
  overlap = OVERLAP
): ChunkDraft[] {
  const lines = markdown.split("\n");
  const sections: { headingPath: string[]; text: string }[] = [];
  let stack: string[] = [];
  let buf: string[] = [];

  const flush = () => {
    const text = buf.join("\n").trim();
    if (text) sections.push({ headingPath: [...stack].filter(Boolean), text });
    buf = [];
  };

  for (const line of lines) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      flush();
      const level = m[1].length;
      stack = stack.slice(0, level - 1);
      stack[level - 1] = m[2].trim();
      stack = stack.filter(Boolean);
    }
    buf.push(line);
  }
  flush();

  const chunks: ChunkDraft[] = [];
  let cursor = 0;

  const push = (text: string, headingPath: string[], start: number) => {
    const body = text.trim();
    if (!body) return;
    const lead = text.length - text.trimStart().length;
    chunks.push({
      ordinal: chunks.length,
      content: body,
      headingPath: headingPath.join(" / "),
      charStart: start + lead,
      charEnd: start + lead + body.length,
    });
  };

  for (const sec of sections) {
    if (sec.text.length <= target) {
      push(sec.text, sec.headingPath, cursor);
      cursor += sec.text.length + 1;
      continue;
    }

    const paras = sec.text.split(/\n{2,}/);
    let cur = "";
    let segStart = cursor;
    for (const p of paras) {
      if (cur && (cur + "\n\n" + p).length > target) {
        push(cur, sec.headingPath, segStart);
        const tail = trimToSafeBoundary(cur.slice(-overlap));
        segStart = segStart + cur.length - tail.length;
        cur = tail ? `${tail}\n\n${p}` : p;
      } else {
        cur = cur ? `${cur}\n\n${p}` : p;
      }
    }
    push(cur, sec.headingPath, segStart);
    cursor = segStart + cur.length + 1;
  }

  return chunks;
}
