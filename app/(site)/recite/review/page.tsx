import Link from "next/link";
import { requireReciteOwner } from "@/lib/recite/guard";
import { buildQueue } from "@/lib/services/recite";
import ReviewSession from "@/components/recite/ReviewSession";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { user } = await requireReciteOwner("/recite/review");
  const queue = await buildQueue(user.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-xl text-forest">今日复习</h2>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>逾期 {queue.counts.overdue}</span>
          <span>今日到期 {queue.counts.today}</span>
          <span>新卡 {queue.counts.newCards}</span>
          <Link href="/recite" className="text-leaf hover:text-forest">
            退出
          </Link>
        </div>
      </div>

      <ReviewSession cards={queue.cards} timezone={queue.settings.timezone} />
    </div>
  );
}
