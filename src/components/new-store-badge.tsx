"use client";

import { useEffect, useState } from "react";

const NEW_STORE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function NewStoreBadge({ createdAt }: { createdAt?: string | null }) {
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (!createdAt) {
      setIsNew(false);
      return;
    }
    const createdAtMs = Date.parse(createdAt);
    setIsNew(
      Number.isFinite(createdAtMs) &&
        Date.now() - createdAtMs < NEW_STORE_WINDOW_MS,
    );
  }, [createdAt]);

  if (!isNew) return null;

  return (
    <span className="absolute left-2 top-2 z-10 rounded-full bg-ink px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[10px]">
      New
    </span>
  );
}
