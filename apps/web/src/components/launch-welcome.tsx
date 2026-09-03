"use client";

import { useEffect, useState } from "react";

const CAMPAIGN_KEY = "morni-launch-welcome-2026";

export function LaunchWelcome() {
  const [visible, setVisible] = useState(false);
  const [customerNumber, setCustomerNumber] = useState(100);

  useEffect(() => {
    if (window.localStorage.getItem(CAMPAIGN_KEY)) return;
    const key = "morni-launch-customer-number";
    const existing = window.localStorage.getItem(key);
    const number = existing ? Number(existing) : 100 + Math.floor(Math.random() * 900);
    window.localStorage.setItem(key, String(number));
    setCustomerNumber(Number.isFinite(number) ? number : 100);
    setVisible(true);
  }, []);

  if (!visible) return null;
  const close = () => {
    window.localStorage.setItem(CAMPAIGN_KEY, "1");
    setVisible(false);
  };
  return (
    <div className="launch-welcome" role="dialog" aria-modal="true" aria-labelledby="launch-welcome-title">
      <div className="launch-welcome-backdrop" />
      <div className="launch-ribbon launch-ribbon-left" aria-hidden="true"><span /></div>
      <div className="launch-ribbon launch-ribbon-right" aria-hidden="true"><span /></div>
      <div className="launch-message">
        <p className="launch-kicker">A new way to shop local</p>
        <h1 id="launch-welcome-title">Welcome to Morni</h1>
        <p className="launch-number">You’re customer <strong>#{customerNumber}</strong> to join us today.</p>
        <button type="button" onClick={close}>Enter Morni <span aria-hidden>→</span></button>
      </div>
    </div>
  );
}
