"use client";

import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { softenHtml } from "@/lib/md-soften";

export const CITE_EVENT = "shiguang:cite";

type CiteDetail = { excerpt: string; headingPath?: string | null };

/** 把整棵子树里的文本节点拼成一条串，便于按字符偏移定位 */
function textIndex(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; start: number }[] = [];
  let text = "";
  let n = walker.nextNode();
  while (n) {
    const t = n as Text;
    nodes.push({ node: t, start: text.length });
    text += t.data;
    n = walker.nextNode();
  }
  return { text, nodes };
}

function locate(root: HTMLElement, needle: string) {
  const { text, nodes } = textIndex(root);
  const at = text.indexOf(needle);
  if (at < 0) return null;

  const end = at + needle.length;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  for (const item of nodes) {
    const localStart = item.start;
    const localEnd = item.start + item.node.data.length;
    if (!startNode && at >= localStart && at < localEnd) {
      startNode = item.node;
      startOffset = at - localStart;
    }
    if (!endNode && end > localStart && end <= localEnd) {
      endNode = item.node;
      endOffset = end - localStart;
    }
  }
  if (!startNode || !endNode) return null;
  return { startNode, startOffset, endNode, endOffset };
}

/**
 * 资料正文。订阅 CITE_EVENT：点了回答里的 [S1]，就在这里把原文那一段高亮并滚过去。
 * 之所以不用 #锚点：markdown 渲染后字符位置和源码对不上，只能按文本内容定位。
 */
export default function DocReader({ markdown }: { markdown: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const hl = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function clear() {
      const el = hl.current;
      if (!el) return;
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      parent.normalize();
      hl.current = null;
    }

    function onCite(evt: Event) {
      const detail = (evt as CustomEvent<CiteDetail>).detail;
      const root = ref.current;
      if (!root || !detail?.excerpt) return;

      clear();

      const raw = detail.excerpt.replace(/…$/, "").trim();
      // 渲染后标点/空格可能被合并，逐步缩短前缀再找
      const candidates = [raw.slice(0, 40), raw.slice(0, 24), raw.slice(0, 14), raw.slice(0, 8)].filter(
        (s) => s.length >= 6
      );

      for (const needle of candidates) {
        const hit = locate(root, needle);
        if (!hit) continue;
        const range = document.createRange();
        range.setStart(hit.startNode, hit.startOffset);
        range.setEnd(hit.endNode, hit.endOffset);
        const mark = document.createElement("mark");
        mark.className = "cite-hl";
        try {
          range.surroundContents(mark);
        } catch {
          mark.appendChild(range.extractContents());
          range.insertNode(mark);
        }
        hl.current = mark;
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      // 文本没找到，退一步按章节标题滚
      const head = detail.headingPath?.split(" / ").pop()?.trim();
      if (head) {
        const headings = Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6"));
        const target = headings.find((h) => h.textContent?.includes(head));
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    window.addEventListener(CITE_EVENT, onCite as EventListener);
    return () => {
      window.removeEventListener(CITE_EVENT, onCite as EventListener);
      clear();
    };
  }, []);

  return (
    <div ref={ref} className="prose-shiguang">
      <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{softenHtml(markdown)}</Markdown>
    </div>
  );
}
