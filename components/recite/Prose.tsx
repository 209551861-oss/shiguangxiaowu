import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";

/**
 * 背诵板块的正文渲染：比站内 MarkdownViewer 多两样东西 ——
 * 数学公式（$..$ / $$..$$）与代码高亮。样式沿用 .prose-shiguang。
 */
export default function Prose({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  if (!content) return null;
  return (
    <div className={`prose-shiguang ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
      >
        {content}
      </Markdown>
    </div>
  );
}
