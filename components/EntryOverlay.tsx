"use client";

import { useEffect, useState } from "react";

/**
 * 入站遮罩：参考 yayoi「正在打开小屋档案…」+ mrzym 入站结构。
 * 加载条跑完（或点击按钮）后淡出，露出主站。
 */
export default function EntryOverlay() {
  const [hide, setHide] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHide(true), 3200);
    return () => clearTimeout(t);
  }, []);

  if (hide) return null;

  return (
    <div
      id="entry"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-mist transition-opacity duration-900"
      style={{
        backgroundImage:
          "radial-gradient(rgba(57,75,60,.10) .7px, transparent .9px), radial-gradient(120% 120% at 50% 0%, #ffffff 0%, var(--mist) 55%, #eef0e6 100%)",
        backgroundSize: "18px 18px, 100% 100%",
      }}
    >
      <div className="mb-6 flex h-20 w-20 animate-breathe items-center justify-center rounded-full glass-strong font-serif text-3xl font-bold text-forest shadow-card">
        拾
      </div>
      <h1 className="mb-3 font-serif text-3xl tracking-[0.18em] text-forest">
        拾光小屋
      </h1>
      <p className="mb-8 text-sm tracking-[0.3em] text-muted">正 在 打 开 档 案 …</p>
      <div className="mb-7 h-1 w-56 overflow-hidden rounded-pill bg-line">
        <div className="h-full w-0 animate-[load_2.4s_ease_forwards] rounded-pill bg-gradient-to-r from-leaf to-pollen" />
      </div>
      <button
        onClick={() => setHide(true)}
        className="rounded-pill border border-line glass-strong px-9 py-3 text-sm tracking-[0.2em] text-forest shadow-soft transition hover:-translate-y-0.5 hover:bg-white"
      >
        进 入 小 屋
      </button>
      <p className="mt-4 text-xs tracking-[0.2em] text-muted opacity-80">
        GATHER THE LIGHT · 记录学习 / 创作 / 生活 / 成长
      </p>
    </div>
  );
}
