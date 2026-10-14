"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CategoryItem } from "@/lib/services/content";

/** 有 category_id 列的模块才提供分类管理。 */
const MODULE_OPTIONS: { value: string; label: string }[] = [
  { value: "notes", label: "学习档案" },
  { value: "library", label: "资料库" },
  { value: "atelier", label: "创作工坊" },
];

const inputCls =
  "w-full rounded-xl border border-line bg-paper/80 px-3 py-2 text-ink outline-none placeholder:text-muted focus:border-leaf";

/** 由名称生成唯一的 slug（保留中文，追加随机串保证唯一）。 */
function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const rand = Math.random().toString(36).slice(2, 7);
  return `${base || "cat"}-${rand}`;
}

function moduleLabel(module: string): string {
  return MODULE_OPTIONS.find((m) => m.value === module)?.label ?? module;
}

export default function CategoryManager() {
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 表单态
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [module, setModule] = useState("notes");
  const [parentId, setParentId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("categories")
      .select("id,name,slug,module,parent_id,sort_order")
      .order("sort_order", { ascending: true });
    setItems((data as CategoryItem[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEditId(null);
    setName("");
    setModule("notes");
    setParentId("");
    setSortOrder("0");
    setMsg("");
  }

  function startEdit(c: CategoryItem) {
    setEditId(c.id);
    setName(c.name);
    setModule(c.module);
    setParentId(c.parent_id ?? "");
    setSortOrder(String(c.sort_order ?? 0));
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setMsg("请填写分类名称");
      return;
    }
    setSaving(true);
    setMsg("");
    const supabase = createClient();
    const order = Number(sortOrder) || 0;

    if (editId) {
      const { error } = await supabase
        .from("categories")
        .update({
          name: name.trim(),
          module,
          parent_id: parentId || null,
          sort_order: order,
        })
        .eq("id", editId);
      if (error) {
        setMsg(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("categories").insert({
        name: name.trim(),
        slug: makeSlug(name.trim()),
        module,
        parent_id: parentId || null,
        sort_order: order,
      });
      if (error) {
        setMsg(error.message);
        setSaving(false);
        return;
      }
    }
    resetForm();
    await load();
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("删除该分类？已归类的内容将变为「未分类」（不会删除内容本身）。")) return;
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      setMsg(error.message);
      return;
    }
    if (editId === id) resetForm();
    await load();
  }

  // 同模块、非自身 的条目可作为父级
  const parentCandidates = items.filter(
    (c) => c.module === module && c.id !== editId
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* 表单 */}
      <form
        onSubmit={submit}
        className="glass h-fit rounded-2xl p-5 shadow-soft"
      >
        <h2 className="font-serif text-xl text-forest">
          {editId ? "编辑分类" : "新建分类"}
        </h2>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm text-ink">名称 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：前端开发"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-ink">所属模块 *</label>
            <select
              value={module}
              onChange={(e) => {
                setModule(e.target.value);
                setParentId("");
              }}
              className={inputCls}
            >
              {MODULE_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-ink">父级分类</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={inputCls}
            >
              <option value="">（无父级，顶级分类）</option>
              {parentCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-ink">排序（越小越靠前）</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {msg && (
          <p className="mt-3 rounded-xl bg-bloom/30 px-3 py-2 text-xs text-forest">{msg}</p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-pill bg-pollen px-5 py-2 text-sm text-forest shadow-press transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {saving ? "保存中…" : editId ? "保存修改" : "创建分类"}
          </button>
          {editId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-pill border border-line px-5 py-2 text-sm text-ink transition hover:bg-leaf/10"
            >
              取消
            </button>
          )}
        </div>
      </form>

      {/* 列表 */}
      <div className="glass rounded-2xl p-5 shadow-soft">
        <h2 className="mb-4 font-serif text-xl text-forest">全部分类</h2>
        {loading ? (
          <p className="text-sm text-muted">加载中…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">还没有分类，在左侧新建一个吧。</p>
        ) : (
          <div className="flex flex-col gap-2">
            {MODULE_OPTIONS.map((m) => {
              const group = items.filter((c) => c.module === m.value);
              if (group.length === 0) return null;
              return (
                <div key={m.value} className="mb-2">
                  <div className="px-2 py-1 text-xs tracking-widest text-muted">
                    {m.label}
                  </div>
                  {group.map((c) => {
                    const parent = items.find((p) => p.id === c.parent_id);
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-xl border border-line/60 bg-paper/50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-forest">{c.name}</span>
                          {parent && (
                            <span className="ml-2 text-xs text-muted">
                              子级 · {parent.name}
                            </span>
                          )}
                          <span className="ml-2 text-xs text-muted">/{c.slug}</span>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() => startEdit(c)}
                            className="rounded-lg px-2 py-1 text-xs text-leaf transition hover:bg-leaf/10"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => remove(c.id)}
                            className="rounded-lg px-2 py-1 text-xs text-bloom transition hover:bg-bloom/20"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
