// 拾光事务所核心类型定义
// 字段名严格对应 Phase 1 落库的 0001_schema.sql 实际列

export type Visibility = "public" | "private" | "draft";

export interface Profile {
  id: string;
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  module: string; // notes | library | atelier | gallery | articles
  parent_id?: string | null;
  sort_order: number;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  category_id?: string | null;
  cover_url?: string | null;
  visibility: Visibility;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Resource {
  id: string;
  title: string;
  url?: string | null;
  description?: string | null;
  category_id?: string | null;
  file_type?: string | null;
  visibility: Visibility;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Artwork {
  id: string;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  category_id?: string | null;
  visibility: Visibility;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface ArtworkFile {
  id: string;
  artwork_id: string;
  file_path: string; // private 桶路径，永不对外明文返回
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  sort_order: number;
  created_at: string;
}

export interface Album {
  id: string;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  visibility: Visibility;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  album_id?: string | null;
  file_path: string; // private 桶内原始路径（原图）
  thumbnail_url?: string | null; // 展示缩略图（gallery 公开桶）
  caption?: string | null;
  taken_at?: string | null;
  visibility: Visibility;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

/** moments.images 数组元素结构 */
export interface MomentImage {
  thumbnail?: string | null; // 公开桶缩略图
  private_path?: string | null; // private 桶原图（仅服务端用）
}

export interface Moment {
  id: string;
  content?: string | null;
  location?: string | null;
  mood?: string | null;
  images?: MomentImage[] | null;
  visibility: Visibility;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  happened_at: string; // date
  description?: string | null;
  icon?: string | null;
  visibility: Visibility;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  content?: string | null;
  cover_url?: string | null;
  published_at?: string | null;
  visibility: Visibility;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: unknown; // jsonb，按 key 解析为对象/字符串
  updated_at: string;
}
