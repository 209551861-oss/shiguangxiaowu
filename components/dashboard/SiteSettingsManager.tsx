"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputCls =
  "w-full rounded-xl border border-line bg-paper/80 px-3 py-2 text-ink outline-none placeholder:text-muted focus:border-leaf";

interface SettingsForm {
  siteName: string;
  tagline: string;
  about: string;
  github: string;
  weibo: string;
  email: string;
}

const EMPTY: SettingsForm = {
  siteName: "",
  tagline: "",
  about: "",
  github: "",
  weibo: "",
  email: "",
};

function toText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** 后台「站点设置」：读写 settings 表（site_name / site_tagline / about / social_links）。 */
export default function SiteSettingsManager() {
  const router = useRouter();
  const [form, setForm] = useState<SettingsForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState(false);

  async function load() {
    setLoading(true);
    setMsg("");
    const supabase = createClient();
    const { data, error } = await supabase.from("settings").select("key,value");
    if (error) {
      setMsg(`读取失败：${error.message}`);
      setLoading(false);
      return;
    }
    const map = new Map<string, unknown>();
    (data ?? []).forEach((row: { key: string; value: unknown }) => {
      map.set(row.key, row.value);
    });
    const social = (map.get("social_links") ?? {}) as Record<string, unknown>;
    setForm({
      siteName: toText(map.get("site_name")),
      tagline: toText(map.get("site_tagline")),
      about: toText(map.get("about")),
      github: toText(social.github),
      weibo: toText(social.weibo),
      email: toText(social.email),
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function field(key: keyof SettingsForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((prev) => {
        const next = { ...prev };
        next[key] = value;
        return next;
      });
      setSaved(false);
    };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.siteName.trim()) {
      setMsg("站点名称不能为空。");
      setSaved(false);
      return;
    }
    setSaving(true);
    setMsg("");
    setSaved(false);
    const supabase = createClient();
    const rows = [
      { key: "site_name", value: form.siteName.trim() },
      { key: "site_tagline", value: form.tagline.trim() },
      { key: "about", value: form.about.trim() },
      {
        key: "social_links",
        value: {
          github: form.github.trim(),
          weibo: form.weibo.trim(),
          email: form.email.trim(),
        },
      },
    ];
    const { error } = await supabase
      .from("settings")
      .upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) {
      setMsg(`保存失败：${error.message}`);
      return;
    }
    setMsg("已保存，公开站点会立即读取新配置。");
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={save} className="glass rounded-2xl p-6 shadow-soft">
        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor="site-name" className="mb-1 block text-sm text-ink">
              站点名称 *
            </label>
            <input
              id="site-name"
              value={form.siteName}
              onChange={field("siteName")}
              placeholder="例如：拾光小屋"
              className={inputCls}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-muted">
              导航栏、页脚、浏览器标题与入站遮罩都读取这里。
            </p>
          </div>

          <div>
            <label htmlFor="site-tagline" className="mb-1 block text-sm text-ink">
              站点标语
            </label>
            <input
              id="site-tagline"
              value={form.tagline}
              onChange={field("tagline")}
              placeholder="一句话介绍这个站点"
              className={inputCls}
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="site-about" className="mb-1 block text-sm text-ink">
              关于我
            </label>
            <textarea
              id="site-about"
              value={form.about}
              onChange={field("about")}
              rows={5}
              placeholder="首页统计卡里的自我介绍"
              className={inputCls}
              disabled={loading}
            />
          </div>

          <div>
            <p className="mb-2 text-sm text-ink">社交链接</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                value={form.github}
                onChange={field("github")}
                placeholder="GitHub 地址"
                aria-label="GitHub"
                className={inputCls}
                disabled={loading}
              />
              <input
                value={form.weibo}
                onChange={field("weibo")}
                placeholder="微博地址"
                aria-label="微博"
                className={inputCls}
                disabled={loading}
              />
              <input
                value={form.email}
                onChange={field("email")}
                placeholder="联系邮箱"
                aria-label="邮箱"
                className={inputCls}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {msg && (
          <p
            className={`mt-4 rounded-xl px-3 py-2 text-xs ${
              saved ? "bg-leaf/15 text-forest" : "bg-bloom/30 text-forest"
            }`}
          >
            {msg}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="submit"
            disabled={saving || loading}
            className="rounded-pill bg-pollen px-6 py-2.5 text-sm text-forest shadow-press transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {saving ? "保存中…" : "保存设置"}
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-pill border border-line px-6 py-2.5 text-sm text-ink transition hover:bg-leaf/10 disabled:opacity-60"
          >
            重新读取
          </button>
        </div>
      </form>

      <aside className="flex flex-col gap-4">
        <div className="glass rounded-2xl p-5 shadow-soft">
          <h2 className="font-serif text-lg text-forest">前台预览</h2>
          <div className="mt-4 rounded-xl bg-paper/70 p-4">
            <p className="font-serif text-2xl text-forest">
              {form.siteName || "拾光小屋"}
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              {form.tagline || "记录学习、创作与生活的数字档案"}
            </p>
          </div>
          <p className="mt-3 text-xs leading-6 text-muted">
            {form.about || "（关于我 为空）"}
          </p>
        </div>

        <div className="glass rounded-2xl p-5 text-xs leading-6 text-muted shadow-soft">
          <p className="mb-1 font-medium text-ink">说明</p>
          <ul className="list-disc pl-4">
            <li>保存写入 settings 表，公开页为服务端渲染，刷新即生效。</li>
            <li>若还要改代码里的默认站名，记得同步 DEFAULT_META。</li>
            <li>后台内部称呼「拾光后台」固定不变。</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}