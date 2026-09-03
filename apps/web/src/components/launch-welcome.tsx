"use client";

import { useEffect, useState } from "react";

export function LaunchWelcome() {
  const [visible, setVisible] = useState(false);
  const [customerNumber, setCustomerNumber] = useState(100);

  useEffect(() => {
    setCustomerNumber(100);
    setVisible(true);
  }, []);

  const [displayNumber, setDisplayNumber] = useState(90);
  useEffect(() => {
    if (!visible) return;
    let value = 90;
    const timer = window.setInterval(() => {
      value += 1;
      setDisplayNumber(value);
      if (value >= customerNumber) window.clearInterval(timer);
    }, 70);
    return () => window.clearInterval(timer);
  }, [visible, customerNumber]);

  if (!visible) return null;
  const close = () => {
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
        <p className="launch-number">You’re customer <strong className="launch-count">#{displayNumber}</strong> to join us today.</p>
        <button type="button" onClick={close}>Enter Morni <span aria-hidden>→</span></button>
      </div>
    </div>
  );
}
