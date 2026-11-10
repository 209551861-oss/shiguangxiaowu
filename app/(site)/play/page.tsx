import PageHeader from "@/components/content/PageHeader";
import GameTabs from "@/components/game/GameTabs";

export default function PlayPage() {
  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-12 pt-20">
      <PageHeader
        title="棋室"
        desc="数独、中国象棋、国际象棋、围棋。先落子，再讲为什么。"
      />
      <div className="glass rounded-3xl p-5 md:p-8">
        <GameTabs />
      </div>
    </div>
  );
}
