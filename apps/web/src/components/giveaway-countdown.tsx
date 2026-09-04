"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export const GIVEAWAY_END_MS = Date.parse(process.env.NEXT_PUBLIC_GIVEAWAY_END_AT ?? "2026-09-05T09:00:00+04:00");
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
  return <Link href="/giveaway" className="giveaway-countdown" aria-label={remaining ? `Giveaway ends in ${hours} hours` : "Giveaway has ended"}><span className="giveaway-countdown-dot" aria-hidden /><span className="giveaway-countdown-label">Giveaway</span><span className="giveaway-countdown-separator" aria-hidden>·</span><strong className="giveaway-countdown-time">{remaining ? `${hours}:${minutes}:${seconds}` : "Ended"}</strong><span className="giveaway-countdown-arrow" aria-hidden>↗</span></Link>;
}
