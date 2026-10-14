import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown 渲染器。
 * 使用 react-markdown + remark-gfm 支持表格 / 删除线 / 任务列表等。
 * 排版样式见 globals.css 的 .prose-shiguang。
 */
export default function MarkdownViewer({ content }: { content: string }) {
  if (!content) return null;
  return (
    <div className="prose-shiguang">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  );
}
