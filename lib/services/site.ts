// 站点数据访问层（服务端组件 / Route Handler 使用）
// 全部基于已建表的公开可读数据（anon 即可读），并对空库/异常做了兜底，
// 未建表或表为空时也能正常渲染首页（显示默认值，不报错）。

import { createClient } from "@/lib/supabase/server";
import type { Moment, Note, TimelineEvent } from "@/types";

export interface SiteMeta {
  site_name: string;
  site_tagline: string;
  about: string;
  social: { github: string; weibo: string; email: string };
}

export interface ModuleCounts {
  notes: number;
  resources: number;
  artworks: number;
  albums: number;
  photos: number;
  moments: number;
  timeline_events: number;
  articles: number;
}

const DEFAULT_META: SiteMeta = {
  site_name: "拾光小屋",
  site_tagline: "记录学习、创作与生活的数字档案",
  about:
    "一个喜欢把日常拾起来的人。在这里慢慢记录、整理、创作，让时间留下痕迹。",
  social: { github: "", weibo: "", email: "" },
};

/** 读取 settings 表，组装站点元信息（名称 / 标语 / 关于 / 社交链接） */
export async function getSiteMeta(): Promise<SiteMeta> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("settings").select("key, value");
    const map = new Map<string, unknown>();
    (data ?? []).forEach((r) => map.set(r.key, r.value));

    const social = (map.get("social_links") as Partial<SiteMeta["social"]>) ?? {};
    return {
      site_name: (map.get("site_name") as string) ?? DEFAULT_META.site_name,
      site_tagline:
        (map.get("site_tagline") as string) ?? DEFAULT_META.site_tagline,
      about: (map.get("about") as string) ?? DEFAULT_META.about,
      social: {
        github: social.github ?? "",
        weibo: social.weibo ?? "",
        email: social.email ?? "",
      },
    };
  } catch {
    // 表不存在或无网络时，返回默认值，保证页面可渲染
    return DEFAULT_META;
  }
}

/** 后台总览：各模块「站长本人的全部内容」数量（含 private / draft）。 */
export async function getOwnerCounts(userId?: string): Promise<ModuleCounts> {
  const supabase = await createClient();
  const tables = [
    "notes",
    "resources",
    "artworks",
    "albums",
    "photos",
    "moments",
    "timeline_events",
    "articles",
  ] as const;

  const entries = await Promise.all(
    tables.map(async (t) => {
      let q = supabase
        .from(t)
        .select("*", { count: "exact", head: true });
      if (userId) q = q.eq("owner_id", userId);
      const { count } = await q;
      return [t, count ?? 0] as const;
    })
  );
  const obj = Object.fromEntries(entries) as Record<string, number>;

  return {
    notes: obj.notes,
    resources: obj.resources,
    artworks: obj.artworks,
    albums: obj.albums,
    photos: obj.photos,
    moments: obj.moments,
    timeline_events: obj.timeline_events,
    articles: obj.articles,
  };
}

/** 各模块公开内容数量（用于首页统计卡） */
export async function getModuleCounts(): Promise<ModuleCounts> {
  const supabase = await createClient();
  const tables = [
    "notes",
    "resources",
    "artworks",
    "albums",
    "photos",
    "moments",
    "timeline_events",
    "articles",
  ] as const;

  const entries = await Promise.all(
    tables.map(async (t) => {
      const { count } = await supabase
        .from(t)
        .select("*", { count: "exact", head: true })
        .eq("visibility", "public");
      return [t, count ?? 0] as const;
    })
  );
  const obj = Object.fromEntries(entries) as Record<string, number>;

  return {
    notes: obj.notes,
    resources: obj.resources,
    artworks: obj.artworks,
    albums: obj.albums,
    photos: obj.photos,
    moments: obj.moments,
    timeline_events: obj.timeline_events,
    articles: obj.articles,
  };
}

/** 最近公开瞬间（首页「最近瞬间」条） */
export async function getRecentMoments(limit = 4): Promise<Moment[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("moments")
      .select("id, content, location, mood, images, created_at, visibility")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as Moment[];
  } catch {
    return [];
  }
}

/** 最近公开笔记（首页「最新学习」条，可选） */
export async function getRecentNotes(limit = 3): Promise<Note[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("notes")
      .select("id, title, summary, cover_url, created_at, visibility")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as Note[];
  } catch {
    return [];
  }
}

/** 最近公开时间轴节点（首页「时间轴高亮」区块） */
export async function getRecentTimeline(limit = 4): Promise<TimelineEvent[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("timeline_events")
      .select("id,title,happened_at,description,icon")
      .eq("visibility", "public")
      .order("happened_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as TimelineEvent[];
  } catch {
    return [];
  }
}
