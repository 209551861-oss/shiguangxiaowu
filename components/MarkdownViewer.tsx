import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

/**
 * Markdown 渲染器。
 * - remark-gfm：表格 / 删除线 / 任务列表 / 自动链接
 * - remark-breaks：单个换行即 <br>，笔记里「一行一句」照原样断行
 * 排版样式见 globals.css 的 .prose-shiguang。
 */
export default function MarkdownViewer({ content }: { content: string }) {
  if (!content) return null;
  return (
    <div className="prose-shiguang">
      <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{content}</Markdown>
    </div>
  );
}
