"use client";

import { useEffect, useState } from "react";
import { launchNumberSequence } from "@/lib/launch-welcome";

export function LaunchWelcome() {
  const [visible, setVisible] = useState(false);
  const [customerNumber, setCustomerNumber] = useState<number | null>(null);

  useEffect(() => {
    setVisible(true);
    void fetch("/api/launch/customer-number").then((response) => response.ok ? response.json() : null).then((data) => { if (data?.customerNumber) setCustomerNumber(data.customerNumber); });
  }, []);

  const [displayNumber, setDisplayNumber] = useState(90);
  useEffect(() => {
    if (!visible || customerNumber == null) return;
    const sequence = launchNumberSequence(customerNumber);
    let index = 0;
    setDisplayNumber(sequence[0] ?? customerNumber);
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
