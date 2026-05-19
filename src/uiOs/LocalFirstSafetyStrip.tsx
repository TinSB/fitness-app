export const LocalFirstSafetyStrip = () => (
  <div className="mx-auto w-full max-w-[1600px] px-4 pt-3 md:px-6 lg:px-8">
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/60 backdrop-blur-xl">
      <span className="font-semibold text-emerald-300">当前使用本地数据</span>
      <span className="text-white/25">/</span>
      <span>云端候选不会自动同步</span>
      <span className="text-white/25">/</span>
      <span>本地训练记录仍可继续</span>
    </div>
  </div>
);
