import GlassCard from "./GlassCard";

/** 模块页占位骨架（Phase 2 起逐页填充真实内容与列表）。 */
export default function PagePlaceholder({
  title,
  desc,
  phase = "Phase 2+",
}: {
  title: string;
  desc: string;
  phase?: string;
}) {
  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-10 pt-20">
      <h1 className="font-serif text-4xl text-forest">{title}</h1>
      <p className="mt-3 max-w-[600px] leading-8 text-muted">{desc}</p>
      <GlassCard className="mt-8 p-10 text-center text-muted">
        <span className="text-3xl">🚧</span>
        <p className="mt-3 text-sm">
          该模块建设中（{phase}）。脚手架已就绪，待 Phase 1 建表后填充列表与详情。
        </p>
      </GlassCard>
    </div>
  );
}
