import Link from "next/link";
import { requireReciteOwner, RECITE_HOME } from "@/lib/recite/guard";

const TABS = [
  { href: "/recite", label: "今日" },
  { href: "/recite/library", label: "知识库" },
  { href: "/recite/stats", label: "统计" },
];

export default async function ReciteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireReciteOwner(RECITE_HOME);

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-24 pt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.28em] text-muted">MEMORY</p>
          <h1 className="mt-1 font-serif text-2xl text-forest">背诵</h1>
          <p className="mt-1 text-sm text-muted">
            私人知识库与间隔复习。这里的内容只有你自己能看到。
          </p>
        </div>
        <nav className="flex gap-1 rounded-pill bg-paper p-1 shadow-soft ring-1 ring-line">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded-pill px-4 py-1.5 text-sm text-ink transition hover:bg-leaf/15 hover:text-forest"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
