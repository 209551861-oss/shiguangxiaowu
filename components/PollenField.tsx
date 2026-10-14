"use client";

import { useEffect, useRef } from "react";

/** 浅色版"流萤"：漂浮的花粉粒子，纯装饰。 */
export default function PollenField({ count = 26 }: { count?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "pollen";
      const s = 3 + Math.random() * 6;
      p.style.left = Math.random() * 100 + "vw";
      p.style.width = p.style.height = s + "px";
      p.style.animationDuration = 9 + Math.random() * 12 + "s";
      p.style.animationDelay = -Math.random() * 15 + "s";
      box.appendChild(p);
    }
  }, [count]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    />
  );
}
