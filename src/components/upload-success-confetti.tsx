"use client";

import { useEffect, useState, type CSSProperties } from "react";

const PIECES = [
  [-92, -42, -38, "#f5c85b"], [-68, -82, 26, "#c45b7a"], [-34, -64, -18, "#2f6f66"],
  [0, -94, 42, "#d58b54"], [38, -74, -26, "#c45b7a"], [76, -48, 54, "#f5c85b"],
  [100, -8, -42, "#2f6f66"], [82, 34, 22, "#d58b54"], [48, 65, 68, "#c45b7a"],
  [0, 74, -54, "#f5c85b"], [-48, 62, 36, "#2f6f66"], [-84, 28, -62, "#d58b54"],
] as const;

export function UploadSuccessConfetti({ celebrationKey }: { celebrationKey: number }) {
  const [visibleKey, setVisibleKey] = useState(0);

  useEffect(() => {
    if (!celebrationKey) return;
    setVisibleKey(celebrationKey);
    const timer = window.setTimeout(() => setVisibleKey(0), 1100);
    return () => window.clearTimeout(timer);
  }, [celebrationKey]);

  if (!visibleKey) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center" aria-hidden="true">
      <div className="relative h-1 w-1">
        {PIECES.map(([x, y, rotate, color], index) => (
          <span
            key={`${visibleKey}-${index}`}
            className="add-to-bag-confetti absolute left-1/2 top-1/2 h-3 w-2 rounded-sm"
            style={{
              "--confetti-x": `${x}px`,
              "--confetti-y": `${y}px`,
              "--confetti-rotate": `${rotate}deg`,
              animationDelay: `${index * 20}ms`,
              backgroundColor: color,
            } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
