/**
 * 归一笔记里常混着手写的 HTML 卡片（<div class="..."><h4>…</h4><p>…</p></div>），
 * 但站点的 markdown 渲染器不认 HTML，直接渲染会显示成一堆尖括号。
 *
 * 这里把 HTML 块"软化"成纯 markdown 段落：
 * - h1–h6 → 对应级别的 ####
 * - </p> / <br> / </li> → 换行
 * - 其余标签剥掉
 * 代码围栏里的内容原样保留（技术文档里 a < b 这种比较不能被吃掉）。
 */

const FENCE = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g;
const FENCE_TEST = /^(```|~~~)/;

function softenChunk(chunk: string): string {
  return chunk
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, text: string) => {
      const lv = Math.min(Number(level) + 1, 6);
      return `\n\n${"#".repeat(lv)} ${text.replace(/<[^>]+>/g, "").trim()}\n\n`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|tr|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function softenHtml(markdown: string): string {
  if (!markdown.includes("<")) return markdown;

  return markdown
    .split(FENCE)
    .map((part) => (FENCE_TEST.test(part) ? part : softenChunk(part)))
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
