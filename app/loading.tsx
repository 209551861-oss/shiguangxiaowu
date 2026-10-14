export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted">
        <div className="h-10 w-10 animate-breathe rounded-full glass-strong font-serif text-lg text-forest shadow-card">
          拾
        </div>
        <p className="text-xs tracking-[0.3em]">正 在 打 开 档 案 …</p>
      </div>
    </div>
  );
}
