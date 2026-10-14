/** 模块页头：标题 + 描述，沿用原占位页风格。 */
export default function PageHeader({
  title,
  desc,
  count,
}: {
  title: string;
  desc: string;
  count?: number;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-serif text-4xl text-forest">{title}</h1>
        {count !== undefined && (
          <span className="shrink-0 text-sm text-muted">共 {count} 条</span>
        )}
      </div>
      <p className="mt-3 max-w-[640px] leading-8 text-muted">{desc}</p>
    </div>
  );
}
