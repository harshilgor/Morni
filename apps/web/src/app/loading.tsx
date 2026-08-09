export default function Loading() {
  return (
    <div
      className="mx-auto max-w-7xl animate-pulse px-4 py-8 sm:px-6"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="h-8 w-48 bg-line/60" />
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="overflow-hidden border border-line bg-surface">
            <div className="aspect-[4/5] bg-line/60" />
            <div className="space-y-3 p-4">
              <div className="h-4 w-3/4 bg-line/60" />
              <div className="h-4 w-1/3 bg-line/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
