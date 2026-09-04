"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Reset on 4 September 2026 at 11:56:54 AM Dubai time; deployments can override this
// without a code change via NEXT_PUBLIC_GIVEAWAY_END_AT.
export const GIVEAWAY_END_MS = Date.parse(process.env.NEXT_PUBLIC_GIVEAWAY_END_AT ?? "2026-09-06T11:56:54+04:00");
export function giveawayParts(ms: number) { const r = Math.max(0, ms); return { hours: Math.floor(r / 3600000).toString().padStart(2, "0"), minutes: Math.floor(r % 3600000 / 60000).toString().padStart(2, "0"), seconds: Math.floor(r % 60000 / 1000).toString().padStart(2, "0") }; }

export function GiveawayCountdown() {
  const [remaining, setRemaining] = useState(() => Math.max(0, GIVEAWAY_END_MS - Date.now()));
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, GIVEAWAY_END_MS - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const { hours, minutes, seconds } = giveawayParts(remaining);
  return <Link href="/giveaway" className="giveaway-countdown" aria-label={remaining ? `Giveaway ends in ${hours} hours` : "Giveaway has ended"}><span className="giveaway-countdown-gift" aria-hidden><svg viewBox="0 0 24 24" fill="none"><path d="M20 12v8.5H4V12M2.5 8.5h19v3h-19zM12 8.5v12M12 8.5H8.25a2.25 2.25 0 1 1 0-4.5c2.1 0 3.75 4.5 3.75 4.5ZM12 8.5h3.75a2.25 2.25 0 1 0 0-4.5C13.65 4 12 8.5 12 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span className="giveaway-countdown-label">Giveaway</span><span className="giveaway-countdown-separator" aria-hidden>·</span><strong className="giveaway-countdown-time">{remaining ? `${hours}:${minutes}:${seconds}` : "Ended"}</strong><span className="giveaway-countdown-arrow" aria-hidden>↗</span></Link>;
}
