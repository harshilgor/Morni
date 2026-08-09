export default function ProductLoading() {
  return (
    <div
      className="mx-auto max-w-6xl animate-pulse px-4 py-10 sm:px-6"
      aria-busy="true"
      aria-label="Loading product"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
        <div className="aspect-[4/5] bg-line/60" />
        <div className="space-y-5 pt-8 lg:pt-16">
          <div className="h-3 w-24 bg-line/60" />
          <div className="h-12 w-3/4 bg-line/60" />
          <div className="h-6 w-28 bg-line/60" />
          <div className="h-20 max-w-md bg-line/60" />
          <div className="h-12 w-44 bg-line/60" />
        </div>
      </div>
    </div>
  );
}
