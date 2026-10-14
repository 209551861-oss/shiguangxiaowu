import { ReactNode } from "react";

/** 浅色磨砂玻璃容器：所有卡片的统一底。 */
export default function GlassCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass rounded-2xl ${className}`}>{children}</div>
  );
}
