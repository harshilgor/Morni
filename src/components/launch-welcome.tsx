"use client";

import { useEffect, useState } from "react";
import { launchNumberSequence } from "@/lib/launch-welcome";

const LAUNCH_WELCOME_STORAGE_KEY = "morni:launch-welcome:v1";
const LAUNCH_VISITOR_STORAGE_KEY = "morni:launch-visitor:v1";

function launchVisitorId() {
  try {
    const existing = window.localStorage.getItem(LAUNCH_VISITOR_STORAGE_KEY);
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
      return existing;
    }
    const created = crypto.randomUUID();
    window.localStorage.setItem(LAUNCH_VISITOR_STORAGE_KEY, created);
    return created;
  } catch {
    // The server cookie remains a fallback for browsers with storage disabled.
    return null;
  }
}

export function LaunchWelcome() {
  const [visible, setVisible] = useState(false);
  const [customerNumber, setCustomerNumber] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(LAUNCH_WELCOME_STORAGE_KEY) === "seen") {
        return;
      }
    } catch {
      // If storage is unavailable, keep the launch experience usable.
    }
    const revealTimer = window.setTimeout(() => setVisible(true), 0);
    const visitorId = launchVisitorId();
    void fetch("/api/launch/customer-number", {
      headers: visitorId ? { "x-morni-launch-visitor": visitorId } : undefined,
    }).then((response) => response.ok ? response.json() : null).then((data) => { if (data?.customerNumber) setCustomerNumber(data.customerNumber); });
    return () => window.clearTimeout(revealTimer);
  }, []);

  const [displayNumber, setDisplayNumber] = useState(90);
  useEffect(() => {
    if (!visible || customerNumber == null) return;
    const sequence = launchNumberSequence(customerNumber);
    let index = 0;
    window.queueMicrotask(() => setDisplayNumber(sequence[0] ?? customerNumber));
    const timer = window.setInterval(() => {
      index += 1;
      const value = sequence[index] ?? customerNumber;
      setDisplayNumber(value);
      if (index >= sequence.length - 1) window.clearInterval(timer);
    }, 95);
    return () => window.clearInterval(timer);
  }, [visible, customerNumber]);

  if (!visible) return null;
  const close = () => {
    try {
      window.localStorage.setItem(LAUNCH_WELCOME_STORAGE_KEY, "seen");
    } catch {
      // Dismissal still works when storage is blocked.
    }
    setVisible(false);
  };
  return (
    <div className="launch-welcome" role="dialog" aria-modal="true" aria-labelledby="launch-welcome-title">
      <div className="launch-welcome-backdrop" />
      <div className="launch-fireworks" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="launch-ribbon launch-ribbon-left" aria-hidden="true"><span /></div>
      <div className="launch-ribbon launch-ribbon-right" aria-hidden="true"><span /></div>
      <div className="launch-message">
        <p className="launch-kicker">Morni · Dubai</p>
        <h1 id="launch-welcome-title">Welcome to<br />Morni</h1>
        <p className="launch-number"><span>You are customer</span><strong className="launch-count">#{displayNumber}</strong><span>to join us today.</span></p>
        <button type="button" onClick={close}>Enter Morni <span aria-hidden>→</span></button>
      </div>
    </div>
  );
}
