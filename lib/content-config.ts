import type { Visibility } from "@/types";

/** 字段类型，决定后台录入表单如何渲染该列。 */
export type FieldType =
  | "text"
  | "textarea"
  | "markdown"
  | "url"
  | "date"
  | "visibility"
  | "category" // 关联 categories 表（按 module 过滤）
  | "album" // 关联 albums 表
  | "cover" // 上传到公开桶，存公开 URL
  | "images" // 多图上传到公开桶，存 JSON 数组
  | "photo"; // 原图进 private 桶 + 缩略图进 gallery 桶

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  bucket?: string; // cover / images 使用的公开桶
  module?: string; // category 字段：取哪个模块的 categories
}

export interface ListColumn {
  key: string;
  label: string;
}

export interface ModuleConfig {
  key: string;
  table: string; // 数据库表名
  label: string; // 模块名（学习档案）
  singular: string; // 单条称呼（笔记）
  icon: string;
  defaultVisibility: Visibility;
  fields: FieldDef[];
  listColumns: ListColumn[];
}

/**
 * 八大模块的后台录入配置（配置驱动：列表 + 表单 + 上传统一复用）。
 * 顺序即后台侧边栏顺序。
 */
export const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  notes: {
    key: "notes",
    table: "notes",
    label: "学习档案",
    singular: "笔记",
    icon: "📖",
    defaultVisibility: "public",
    fields: [
      { name: "title", label: "标题", type: "text", required: true, placeholder: "例如：React 并发渲染笔记" },
      { name: "summary", label: "摘要", type: "textarea", placeholder: "一句话概括" },
      { name: "content", label: "正文（Markdown）", type: "markdown", placeholder: "支持 Markdown 书写…" },
      { name: "category_id", label: "分类", type: "category", module: "notes" },
      { name: "cover_url", label: "封面图", type: "cover", bucket: "artworks", help: "上传展示封面（公开桶）" },
      { name: "visibility", label: "可见性", type: "visibility" },
    ],
    listColumns: [
      { key: "title", label: "标题" },
      { key: "created_at", label: "创建时间" },
      { key: "visibility", label: "可见性" },
    ],
  },

  resources: {
    key: "resources",
    table: "resources",
    label: "资料库",
    singular: "资料",
    icon: "🗂️",
    defaultVisibility: "public",
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "url", label: "外链地址", type: "url", placeholder: "https://…" },
      { name: "description", label: "描述", type: "textarea" },
      { name: "category_id", label: "分类", type: "category", module: "library" },
      { name: "file_type", label: "类型", type: "text", placeholder: "pdf / doc / link …" },
      { name: "visibility", label: "可见性", type: "visibility" },
    ],
    listColumns: [
      { key: "title", label: "标题" },
      { key: "file_type", label: "类型" },
      { key: "created_at", label: "创建时间" },
      { key: "visibility", label: "可见性" },
    ],
  },

  artworks: {
    key: "artworks",
    table: "artworks",
    label: "创作工坊",
    singular: "作品",
    icon: "🎨",
    defaultVisibility: "public",
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "description", label: "描述", type: "textarea" },
      { name: "category_id", label: "分类", type: "category", module: "atelier" },
      { name: "cover_url", label: "封面图", type: "cover", bucket: "artworks" },
      { name: "visibility", label: "可见性", type: "visibility" },
    ],
    listColumns: [
      { key: "title", label: "标题" },
      { key: "created_at", label: "创建时间" },
      { key: "visibility", label: "可见性" },
    ],
  },

  albums: {
    key: "albums",
    table: "albums",
    label: "生活相册",
    singular: "相册",
    icon: "🖼️",
    defaultVisibility: "public",
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "description", label: "描述", type: "textarea" },
      { name: "cover_url", label: "封面图", type: "cover", bucket: "gallery" },
      { name: "visibility", label: "可见性", type: "visibility" },
    ],
    listColumns: [
      { key: "title", label: "标题" },
      { key: "created_at", label: "创建时间" },
      { key: "visibility", label: "可见性" },
    ],
  },

  photos: {
    key: "photos",
    table: "photos",
    label: "相册照片",
    singular: "照片",
    icon: "📷",
    defaultVisibility: "public",
    fields: [
      { name: "album_id", label: "所属相册", type: "album" },
      {
        name: "file_path",
        label: "原图（私有桶）",
        type: "photo",
        required: true,
        help: "原图进入 private 桶，自动生成缩略图到 gallery 公开桶",
      },
      { name: "caption", label: "说明", type: "text" },
      { name: "taken_at", label: "拍摄日期", type: "date" },
      { name: "visibility", label: "可见性", type: "visibility" },
    ],
    listColumns: [
      { key: "caption", label: "说明" },
      { key: "taken_at", label: "拍摄日期" },
      { key: "created_at", label: "创建时间" },
      { key: "visibility", label: "可见性" },
    ],
  },

  moments: {
    key: "moments",
    table: "moments",
    label: "瞬间记录",
    singular: "瞬间",
    icon: "✨",
    defaultVisibility: "public",
    fields: [
      { name: "content", label: "内容", type: "textarea", required: true, placeholder: "一句话、一张图的即时光阴" },
      { name: "location", label: "地点", type: "text" },
      { name: "mood", label: "心情", type: "text", placeholder: "emoji 或文字" },
      { name: "images", label: "图片", type: "images", bucket: "moments" },
      { name: "visibility", label: "可见性", type: "visibility" },
    ],
    listColumns: [
      { key: "content", label: "内容" },
      { key: "created_at", label: "创建时间" },
      { key: "visibility", label: "可见性" },
    ],
  },

  timeline_events: {
    key: "timeline_events",
    table: "timeline_events",
    label: "成长时间轴",
    singular: "节点",
    icon: "🕰️",
    defaultVisibility: "public",
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "happened_at", label: "发生日期", type: "date", required: true },
      { name: "description", label: "描述", type: "textarea" },
      { name: "icon", label: "图标", type: "text", placeholder: "emoji，如 🎓" },
      { name: "visibility", label: "可见性", type: "visibility" },
    ],
    listColumns: [
      { key: "title", label: "标题" },
      { key: "happened_at", label: "日期" },
      { key: "visibility", label: "可见性" },
    ],
  },

  articles: {
    key: "articles",
    table: "articles",
    label: "文章",
    singular: "文章",
    icon: "📝",
    defaultVisibility: "public",
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "slug", label: "URL 标识", type: "text", required: true, placeholder: "my-first-article（英文短横）" },
      { name: "content", label: "正文（Markdown）", type: "markdown" },
      { name: "cover_url", label: "封面图", type: "cover", bucket: "articles" },
      { name: "published_at", label: "发布日期", type: "date" },
      { name: "visibility", label: "可见性", type: "visibility" },
    ],
    listColumns: [
      { key: "title", label: "标题" },
      { key: "slug", label: "标识" },
      { key: "published_at", label: "发布" },
      { key: "visibility", label: "可见性" },
    ],
  },
};

/** 后台侧边栏 / 总览的顺序。 */
export const MODULE_ORDER: string[] = [
  "notes",
  "resources",
  "artworks",
  "albums",
  "photos",
  "moments",
  "timeline_events",
  "articles",
];

export function getModuleConfig(key: string): ModuleConfig | undefined {
  return MODULE_CONFIGS[key];
}
