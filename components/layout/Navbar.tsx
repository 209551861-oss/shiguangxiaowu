"use client";

import { useState } from "react";
import Link from "next/link";
import { NAV_LINKS } from "@/lib/constants";
import MobileNav from "./MobileNav";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="glass sticky top-3.5 z-40 mx-auto flex max-w-[1080px] items-center justify-between rounded-pill px-5 py-3 shadow-soft">
        <Link href="/" className="flex items-baseline gap-2">
          <b className="font-serif text-xl text-forest">拾光事务所</b>
          <span className="text-xs tracking-[0.28em] text-muted">SHIGUANG</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-pill px-4 py-2 text-sm text-ink transition hover:bg-leaf/15 hover:text-forest"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="hidden rounded-pill bg-pollen px-5 py-2 text-sm text-forest shadow-press transition hover:-translate-y-0.5 md:block"
          >
            登录后台
          </Link>
          <button
            aria-label="菜单"
            onClick={() => setOpen(true)}
            className="rounded-pill border border-line px-4 py-2 text-sm text-forest md:hidden"
          >
            菜单
          </button>
        </div>
      </nav>

      <MobileNav open={open} onClose={() => setOpen(false)} />
    </>
  );
}
