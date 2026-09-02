export function AiProcessingOverlay({ phase, photoCount, productCount }: { phase: "reading" | "analyzing" | "publishing"; photoCount: number; productCount: number }) {
  const message = phase === "publishing" ? "Saving your listing…" : phase === "analyzing" ? "Grouping photos and writing details…" : "Preparing your photos…";
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/25 p-4" role="status" aria-live="polite" aria-label="Generating product listing">
    <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 text-center shadow-xl">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#dcebe2] border-t-[#2f6f66]" />
      <h2 className="mt-4 text-lg font-semibold text-ink">Generating your listing…</h2>
      <p className="mt-1 text-sm text-muted">{message}</p>
      <div className="mx-auto mt-4 h-1.5 overflow-hidden rounded-full bg-[#dcebe2]"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#2f6f66]" /></div>
      <p className="mt-3 text-xs text-muted">{photoCount} photo{photoCount === 1 ? "" : "s"} · keep this window open</p>
    </div>
  </div>;
}
