// 公开内容读取层（服务端组件用）
// 仅返回 visibility = 'public' 的内容（与 RLS 一致）；空库 / 异常时兜底返回空数组，
// 保证页面始终可渲染，不会因为没数据而白屏报错。

import { createClient } from "@/lib/supabase/server";

export interface ListOpts {
  table: string;
  select?: string;
  limit?: number;
  /** 排序字段，默认 created_at */
  orderBy?: string;
  /** 升序（时间轴等用），默认降序 */
  ascending?: boolean;
  /** 额外等值过滤，如 { album_id: 'xxx' } */
  eq?: Record<string, unknown>;
}

/** 读取某模块的公开列表（按时间倒序）。 */
export async function getPublicList<T = Record<string, unknown>>(
  opts: ListOpts
): Promise<T[]> {
  try {
    const supabase = await createClient();
    let q = supabase
      .from(opts.table)
      .select(opts.select ?? "*")
      .eq("visibility", "public");
    if (opts.eq) {
      for (const [k, v] of Object.entries(opts.eq)) q = q.eq(k, v);
    }
    q = q.order(opts.orderBy ?? "created_at", {
      ascending: opts.ascending ?? false,
    });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) {
      console.error(`[content] list ${opts.table}:`, error.message);
      return [];
    }
    return (data as T[]) ?? [];
  } catch (e) {
    console.error(`[content] list ${opts.table} failed:`, e);
    return [];
  }
}

/** 按 id 读取单条公开内容；不存在 / 私密 / 异常返回 null。 */
export async function getPublicItem<T = Record<string, unknown>>(
  table: string,
  id: string,
  select = "*"
): Promise<T | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq("id", id)
      .eq("visibility", "public")
      .single();
    if (error) {
      if (error.code !== "PGRST116") {
        // PGRST116 = 0 rows，正常（内容不存在或设为私密）
        console.error(`[content] item ${table}/${id}:`, error.message);
      }
      return null;
    }
    return data as T;
  } catch (e) {
    console.error(`[content] item ${table}/${id} failed:`, e);
    return null;
  }
}

/** 文章按 slug 读取（公开）。 */
export async function getArticleBySlug<T = Record<string, unknown>>(
  slug: string,
  select = "*"
): Promise<T | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("articles")
      .select(select)
      .eq("slug", slug)
      .eq("visibility", "public")
      .single();
    if (error) {
      if (error.code !== "PGRST116") console.error(`[content] article/${slug}:`, error.message);
      return null;
    }
    return data as T;
  } catch (e) {
    console.error(`[content] article/${slug} failed:`, e);
    return null;
  }
}

// ============================================================
// 分类（categories 表，多模块共用）
// ============================================================

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  module: string;
  parent_id: string | null;
  sort_order: number;
}

/** 读取分类；可仅取某模块的（notes / library / atelier）。 */
export async function getCategories(module?: string): Promise<CategoryItem[]> {
  try {
    const supabase = await createClient();
    let q = supabase
      .from("categories")
      .select("id,name,slug,module,parent_id,sort_order")
      .order("sort_order", { ascending: true });
    if (module) q = q.eq("module", module);
    const { data, error } = await q;
    if (error) {
      console.error(`[content] categories:`, error.message);
      return [];
    }
    return (data as CategoryItem[]) ?? [];
  } catch (e) {
    console.error(`[content] categories failed:`, e);
    return [];
  }
}

// ============================================================
// 全站检索
// 说明：表里的 search_vector 用 to_tsvector('simple', …) 生成，但 'simple'
// 配置对中文不做分词（整段中文会成为单个词元），用它查中文子串基本搜不到。
// 个人量级的小档案库用 ILIKE 子串检索即可正确命中中文，且无需再跑迁移。
// 若未来数据量很大，可改为 pg_trgm + gin 索引做三元组子串检索。
// ============================================================

export type SearchType =
  | "note"
  | "resource"
  | "article"
  | "artwork"
  | "album"
  | "moment"
  | "timeline";

export interface SearchResult {
  type: SearchType;
  typeLabel: string;
  id: string;
  title: string;
  snippet: string;
  href: string;
  cover?: string;
  date?: string;
}

/** 清洗检索词：去掉 ILIKE / .or() 的特殊字符，折叠空白。 */
function sanitizeQuery(raw: string): string {
  return raw
    .replace(/[%_*,|()'"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 取首个非空文本做摘要，截断到约 90 字。 */
function makeSnippet(...texts: (string | null | undefined)[]): string {
  for (const t of texts) {
    const s = (t ?? "").replace(/\s+/g, " ").trim();
    if (s) return s.length > 90 ? s.slice(0, 90) + "…" : s;
  }
  return "";
}

/** 跨模块全文（子串）检索，仅返回公开内容。 */
export async function searchSite(raw: string): Promise<SearchResult[]> {
  const q = sanitizeQuery(raw);
  if (!q) return [];

  try {
    const supabase = await createClient();
    const like = `%${q}%`;

    type Def = {
      table: string;
      or: string;
      select: string;
      map: (r: Record<string, unknown>) => SearchResult;
    };

    const defs: Def[] = [
      {
        table: "notes",
        or: `title.ilike.${like},summary.ilike.${like},content.ilike.${like}`,
        select: "id,title,summary,content,cover_url,created_at",
        map: (r) => ({
          type: "note",
          typeLabel: "笔记",
          id: r.id as string,
          title: r.title as string,
          snippet: makeSnippet(r.summary as string, r.content as string),
          href: `/notes/${r.id}`,
          cover: r.cover_url as string | undefined,
          date: r.created_at as string,
        }),
      },
      {
        table: "resources",
        or: `title.ilike.${like},description.ilike.${like},url.ilike.${like}`,
        select: "id,title,description,url,created_at",
        map: (r) => ({
          type: "resource",
          typeLabel: "资料",
          id: r.id as string,
          title: r.title as string,
          snippet: makeSnippet(r.description as string, r.url as string),
          href: `/library/${r.id}`,
          date: r.created_at as string,
        }),
      },
      {
        table: "articles",
        or: `title.ilike.${like},content.ilike.${like}`,
        select: "id,title,slug,content,cover_url,published_at,created_at",
        map: (r) => ({
          type: "article",
          typeLabel: "文章",
          id: r.id as string,
          title: r.title as string,
          snippet: makeSnippet(r.content as string),
          href: `/articles/${r.slug}`,
          cover: r.cover_url as string | undefined,
          date: (r.published_at as string) ?? (r.created_at as string),
        }),
      },
      {
        table: "artworks",
        or: `title.ilike.${like},description.ilike.${like}`,
        select: "id,title,description,cover_url,created_at",
        map: (r) => ({
          type: "artwork",
          typeLabel: "作品",
          id: r.id as string,
          title: r.title as string,
          snippet: makeSnippet(r.description as string),
          href: `/atelier/${r.id}`,
          cover: r.cover_url as string | undefined,
          date: r.created_at as string,
        }),
      },
      {
        table: "albums",
        or: `title.ilike.${like},description.ilike.${like}`,
        select: "id,title,description,cover_url,created_at",
        map: (r) => ({
          type: "album",
          typeLabel: "相册",
          id: r.id as string,
          title: r.title as string,
          snippet: makeSnippet(r.description as string),
          href: `/gallery/${r.id}`,
          cover: r.cover_url as string | undefined,
          date: r.created_at as string,
        }),
      },
      {
        table: "moments",
        or: `content.ilike.${like},location.ilike.${like},mood.ilike.${like}`,
        select: "id,content,location,mood,created_at",
        map: (r) => ({
          type: "moment",
          typeLabel: "瞬间",
          id: r.id as string,
          title: makeSnippet(r.content as string, r.mood as string) || "瞬间记录",
          snippet: makeSnippet(r.content as string, r.location as string, r.mood as string),
          href: `/moments`,
          date: r.created_at as string,
        }),
      },
      {
        table: "timeline_events",
        or: `title.ilike.${like},description.ilike.${like}`,
        select: "id,title,description,happened_at",
        map: (r) => ({
          type: "timeline",
          typeLabel: "时间轴",
          id: r.id as string,
          title: r.title as string,
          snippet: makeSnippet(r.description as string),
          href: `/timeline`,
          date: r.happened_at as string,
        }),
      },
    ];

    const batched = await Promise.all(
      defs.map(async (d) => {
        const { data, error } = await supabase
          .from(d.table)
          .select(d.select)
          .or(d.or)
          .eq("visibility", "public")
          .limit(30);
        if (error) {
          console.error(`[search] ${d.table}:`, error.message);
          return [] as SearchResult[];
        }
        return (data as unknown as Record<string, unknown>[]).map(d.map);
      })
    );

    return batched
      .flat()
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  } catch (e) {
    console.error(`[search] failed:`, e);
    return [];
  }
}
