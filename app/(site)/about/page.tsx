import { getSiteMeta } from "@/lib/services/site";
import PageHeader from "@/components/content/PageHeader";
import GlassCard from "@/components/ui/GlassCard";

export default async function AboutPage() {
  const meta = await getSiteMeta();
  const socials = [
    { key: "github", label: "GitHub", href: meta.social.github },
    { key: "weibo", label: "微博", href: meta.social.weibo },
    {
      key: "email",
      label: "邮箱",
      href: meta.social.email ? `mailto:${meta.social.email}` : "",
    },
  ].filter((s) => s.href);

  return (
    <div className="mx-auto max-w-[760px] px-5 pb-12 pt-20">
      <PageHeader title="关于我" desc="这座档案馆的由来，以及怎么联系到我。" />
      <GlassCard className="p-8">
        <p className="whitespace-pre-wrap leading-[2] text-ink">{meta.about}</p>
        {socials.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            {socials.map((s) => (
              <a
                key={s.key}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-pill border border-line px-5 py-2 text-sm text-forest transition hover:bg-leaf/10"
              >
                {s.label}
              </a>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
