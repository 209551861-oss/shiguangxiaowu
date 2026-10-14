"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  MODULE_CONFIGS,
  type ModuleConfig,
  type FieldDef,
} from "@/lib/content-config";
import ImageField from "./ImageField";
import PhotosField from "./PhotosField";

const inputCls =
  "w-full rounded-xl border border-line bg-paper/80 px-3 py-2 text-ink outline-none placeholder:text-muted focus:border-leaf";

type Values = Record<string, unknown>;

/** 依据配置与（可选的）初始数据，构造表单初值。 */
function buildDefaults(cfg: ModuleConfig, initial?: Record<string, unknown>): Values {
  const v: Values = {};
  for (const f of cfg.fields) {
    if (f.type === "visibility") v[f.name] = (initial?.[f.name] as string) || cfg.defaultVisibility;
    else if (f.type === "images") v[f.name] = (initial?.[f.name] as string[]) || [];
    else if (f.type === "photo") {
      v["file_path"] = (initial?.file_path as string) || "";
      v["thumbnail_url"] = (initial?.thumbnail_url as string) || "";
    } else v[f.name] = (initial?.[f.name] as string) ?? "";
  }
  return v;
}

/** 构造写入数据库的对象（空字符串转 null，图片/照片特殊处理）。 */
function sanitize(cfg: ModuleConfig, values: Values) {
  const payload: Values = {};
  for (const f of cfg.fields) {
    if (f.type === "photo") {
      payload.file_path = values.file_path || null;
      payload.thumbnail_url = values.thumbnail_url || null;
      continue;
    }
    if (f.type === "images") {
      payload[f.name] = Array.isArray(values[f.name]) ? values[f.name] : [];
      continue;
    }
    if (f.type === "visibility") {
      payload[f.name] = (values[f.name] as string) || "public";
      continue;
    }
    const val = values[f.name];
    payload[f.name] = val === "" || val === undefined || val === null ? null : val;
  }
  return payload;
}

export default function ContentForm({
  module,
  initial,
}: {
  module: string;
  initial?: Record<string, unknown>;
}) {
  const cfg = MODULE_CONFIGS[module];
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => buildDefaults(cfg, initial));
  const [categories, setCategories] = useState<Record<string, { id: string; name: string }[]>>({});
  const [albums, setAlbums] = useState<{ id: string; title: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const needCat = cfg.fields.some((f) => f.type === "category");
    const needAlbum = cfg.fields.some((f) => f.type === "album");
    async function load() {
      if (needCat) {
        const { data } = await supabase.from("categories").select("id,name,module");
        const map: Record<string, { id: string; name: string }[]> = {};
        (data ?? []).forEach((c: { id: string; name: string; module: string }) => {
          (map[c.module] ||= []).push({ id: c.id, name: c.name });
        });
        setCategories(map);
      }
      if (needAlbum) {
        const { data } = await supabase.from("albums").select("id,title");
        setAlbums((data as { id: string; title: string }[]) ?? []);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  function set(name: string, val: unknown) {
    setValues({ ...values, [name]: val });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    // 必填校验
    for (const f of cfg.fields) {
      if (!f.required) continue;
      if (f.type === "photo") {
        if (!values.file_path) {
          setMsg("请先上传原图");
          setSaving(false);
          return;
        }
      } else if (f.type === "images") {
        if (!Array.isArray(values[f.name]) || (values[f.name] as string[]).length === 0) {
          setMsg(`请填写${f.label}`);
          setSaving(false);
          return;
        }
      } else if (!values[f.name]) {
        setMsg(`请填写${f.label}`);
        setSaving(false);
        return;
      }
    }

    const supabase = createClient();
    const payload = sanitize(cfg, values);
    let error: { message: string } | null = null;
    if (initial?.id) {
      ({ error } = await supabase.from(cfg.table).update(payload).eq("id", initial.id as string));
    } else {
      ({ error } = await supabase.from(cfg.table).insert(payload));
    }
    if (error) {
      setMsg(error.message);
      setSaving(false);
      return;
    }
    router.push(`/dashboard/${module}`);
    router.refresh();
  }

  function renderField(f: FieldDef) {
    const val = values[f.name];
    switch (f.type) {
      case "text":
      case "url":
        return (
          <input
            type={f.type === "url" ? "url" : "text"}
            value={(val as string) ?? ""}
            onChange={(e) => set(f.name, e.target.value)}
            placeholder={f.placeholder}
            className={inputCls}
          />
        );
      case "textarea":
      case "markdown":
        return (
          <textarea
            value={(val as string) ?? ""}
            onChange={(e) => set(f.name, e.target.value)}
            placeholder={f.placeholder}
            rows={f.type === "markdown" ? 10 : 4}
            className={inputCls}
          />
        );
      case "date":
        return (
          <input
            type="date"
            value={(val as string) ?? ""}
            onChange={(e) => set(f.name, e.target.value)}
            className={inputCls}
          />
        );
      case "visibility":
        return (
          <select
            value={(val as string) ?? "public"}
            onChange={(e) => set(f.name, e.target.value)}
            className={inputCls}
          >
            <option value="public">公开</option>
            <option value="private">私密</option>
            <option value="draft">草稿</option>
          </select>
        );
      case "category": {
        const opts = categories[f.module || ""] || [];
        return (
          <select
            value={(val as string) ?? ""}
            onChange={(e) => set(f.name, e.target.value)}
            className={inputCls}
          >
            <option value="">（未分类）</option>
            {opts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        );
      }
      case "album":
        return (
          <select
            value={(val as string) ?? ""}
            onChange={(e) => set(f.name, e.target.value)}
            className={inputCls}
          >
            <option value="">（不属于任何相册）</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        );
      case "cover":
        return (
          <ImageField
            bucket={f.bucket!}
            value={(val as string) ?? ""}
            onChange={(v) => set(f.name, v)}
            label="封面图"
          />
        );
      case "images":
        return (
          <ImageField
            bucket={f.bucket!}
            multiple
            value={(val as string[]) ?? []}
            onChange={(v) => set(f.name, v)}
            label="图片"
          />
        );
      case "photo":
        return (
          <PhotosField
            file_path={(values.file_path as string) ?? ""}
            thumbnail_url={(values.thumbnail_url as string) ?? ""}
            onChange={(v) =>
              setValues({ ...values, file_path: v.file_path, thumbnail_url: v.thumbnail_url })
            }
            required={f.required}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div>
      <Link href={`/dashboard/${module}`} className="text-sm text-muted hover:text-forest">
        ← 返回列表
      </Link>
      <h1 className="mt-3 font-serif text-3xl text-forest">
        {initial?.id ? `编辑${cfg.singular}` : `新建${cfg.singular}`}
      </h1>

      <form
        onSubmit={save}
        className="glass mt-6 flex flex-col gap-5 rounded-2xl p-6 shadow-soft"
      >
        {cfg.fields.map((f) => (
          <div key={f.name}>
            <label className="mb-1 flex items-center gap-1 text-sm text-ink">
              {f.label}
              {f.required && <span className="text-forest">*</span>}
            </label>
            {renderField(f)}
            {f.help && <p className="mt-1 text-xs text-muted">{f.help}</p>}
          </div>
        ))}

        {msg && (
          <p className="rounded-xl bg-bloom/30 px-3 py-2 text-xs text-forest">{msg}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-pill bg-pollen px-6 py-2.5 text-sm text-forest shadow-press transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {saving ? "保存中…" : initial?.id ? "保存修改" : "创建"}
          </button>
          <Link
            href={`/dashboard/${module}`}
            className="rounded-pill border border-line px-6 py-2.5 text-sm text-ink transition hover:bg-leaf/10"
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  );
}
