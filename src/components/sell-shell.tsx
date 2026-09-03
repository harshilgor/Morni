"use client";

import { useEffect } from "react";

export function SellShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add("sell-mode");
    return () => {
      document.body.classList.remove("sell-mode");
    };
  }, []);

  return <div className="sell-shell">{children}</div>;
}
