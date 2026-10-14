"use client";

import Link from "next/link";
import { NAV_LINKS } from "@/lib/constants";

export default function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-forest/30" onClick={onClose} />
      <div className="glass-strong absolute right-0 top-0 flex h-full w-72 flex-col gap-1 p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <b className="font-serif text-lg text-forest">导览</b>
          <button onClick={onClose} aria-label="关闭" className="text-muted">
            ✕
          </button>
        </div>
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={onClose}
            className="rounded-xl px-4 py-3 text-ink transition hover:bg-leaf/15"
          >
            {l.label}
          </Link>
        ))}
        <Link
          href="/dashboard"
          onClick={onClose}
          className="mt-3 rounded-pill bg-pollen px-4 py-3 text-center text-forest"
        >
          登录后台
        </Link>
      </div>
    </div>
  );
}
