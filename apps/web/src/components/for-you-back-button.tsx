"use client";

import { useRouter } from "next/navigation";

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function ForYouBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="fixed z-50 flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/90 text-ink shadow-[0_8px_24px_-12px_rgba(28,20,24,0.35)] backdrop-blur-sm transition hover:bg-white"
      style={{
        top: "calc(env(safe-area-inset-top) + 0.75rem)",
        left: "calc(env(safe-area-inset-left) + 1rem)",
      }}
      aria-label="Go back"
    >
      <ChevronLeftIcon className="h-5 w-5" />
    </button>
  );
}
