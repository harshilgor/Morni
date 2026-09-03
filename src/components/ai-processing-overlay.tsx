type UploadProgress = {
  completed: number;
  total: number;
  currentProduct?: string;
  stage: "uploading" | "saving";
};

export function AiProcessingOverlay({ phase, photoCount, productCount, uploadProgress }: { phase: "reading" | "analyzing" | "publishing"; photoCount: number; productCount: number; uploadProgress?: UploadProgress | null }) {
  const isRealUploadProgress = phase === "publishing" && uploadProgress;
  const completedPhotos = uploadProgress?.completed ?? 0;
  const totalPhotos = uploadProgress?.total ?? photoCount;
  const progressPercent = isRealUploadProgress
    ? uploadProgress.stage === "saving"
      ? 100
      : totalPhotos > 0
        ? Math.round((completedPhotos / totalPhotos) * 100)
        : 0
    : phase === "reading" ? 33 : phase === "analyzing" ? 66 : 100;
  const message = isRealUploadProgress
    ? uploadProgress.stage === "saving"
      ? "All photos are uploaded. Saving your products…"
      : `Uploading ${completedPhotos} of ${totalPhotos} photos${uploadProgress.currentProduct ? ` for ${uploadProgress.currentProduct}` : ""}…`
    : phase === "publishing" ? "Saving your listing…" : phase === "analyzing" ? "Grouping photos and writing details…" : "Preparing your photos…";
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/25 p-4" role="status" aria-live="polite" aria-label="Generating product listing">
    <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 text-center shadow-xl">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#dcebe2] border-t-[#2f6f66]" />
      <h2 className="mt-4 text-lg font-semibold text-ink">Generating your listing…</h2>
      <p className="mt-1 text-sm text-muted">{message}</p>
      <div className="mx-auto mt-4 h-1.5 overflow-hidden rounded-full bg-[#dcebe2]"><div className="h-full rounded-full bg-[#2f6f66] transition-[width] duration-300" style={{ width: `${progressPercent}%` }} /></div>
      <p className="mt-3 text-xs text-muted">{isRealUploadProgress ? uploadProgress.stage === "saving" ? `${totalPhotos} photos uploaded · saving ${productCount} products` : `${completedPhotos} of ${totalPhotos} photos uploaded` : `${photoCount} photo${photoCount === 1 ? "" : "s"} · keep this window open`}</p>
    </div>
  </div>;
}
