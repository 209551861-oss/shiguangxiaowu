"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMsg(error.message);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
      return;
    }

    // 注册（首次创建站长账号）
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      // 关闭了邮箱确认：直接登录
      router.push("/dashboard");
      router.refresh();
    } else {
      setMsg("注册成功！请前往邮箱完成验证，随后即可登录。");
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-5"
      style={{
        backgroundImage:
          "radial-gradient(rgba(57,75,60,.10) .7px, transparent .9px), radial-gradient(120% 120% at 50% 0%, #ffffff 0%, var(--mist) 55%, #eef0e6 100%)",
        backgroundSize: "18px 18px, 100% 100%",
      }}
    >
      <Link href="/" className="mb-6 flex items-baseline gap-2">
        <b className="font-serif text-2xl text-forest">拾光小屋</b>
        <span className="text-xs tracking-[0.28em] text-muted">SHIGUANG</span>
      </Link>

      <div className="glass w-full max-w-[400px] rounded-2xl p-8 shadow-soft">
        <h1 className="font-serif text-2xl text-forest">
          {mode === "login" ? "进入后台" : "创建站长账号"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "login"
            ? "登录以管理全部模块内容、上传资源与配置站点。"
            : "首次使用，注册一个账号作为站点唯一站长。"}
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            className="w-full rounded-xl border border-line bg-paper/80 px-4 py-2.5 text-ink outline-none placeholder:text-muted focus:border-leaf"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码（至少 6 位）"
            className="w-full rounded-xl border border-line bg-paper/80 px-4 py-2.5 text-ink outline-none placeholder:text-muted focus:border-leaf"
          />

          {msg && (
            <p className="rounded-xl bg-bloom/30 px-3 py-2 text-xs text-forest">
              {msg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-pill bg-pollen px-6 py-2.5 text-sm font-medium text-forest shadow-press transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {loading
              ? "处理中…"
              : mode === "login"
                ? "登录"
                : "注册并进入"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setMsg("");
          }}
          className="mt-4 w-full text-center text-xs text-muted hover:text-forest"
        >
          {mode === "login"
            ? "还没有账号？创建站长账号"
            : "已有账号？返回登录"}
        </button>
      </div>

      <p className="mt-6 text-xs text-muted">
        提示：若注册后提示验证邮件，可在 Supabase 后台 Authentication →
        Providers 关闭 Email 确认以直接登录。
      </p>
    </div>
  );
}
