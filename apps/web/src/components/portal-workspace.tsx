"use client";

import { useEffect } from "react";

export function PortalWorkspace({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add("portal-mode");
    return () => document.body.classList.remove("portal-mode");
  }, []);

  return <div className="portal-shell">{children}</div>;
}
