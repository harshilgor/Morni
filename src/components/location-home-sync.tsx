"use client";

import { useLocation } from "@/lib/location";
import { useAuthUser } from "@/lib/use-auth-user";
import { emirateLabel } from "@/lib/format";

/** Greeting line that mirrors the header delivery location. */
export function LocationHomeSync() {
  const emirate = useLocation((s) => s.emirate);
  const area = useLocation((s) => s.area);
  const { auth } = useAuthUser();

  return (
    <p className="text-sm text-muted">
      {auth ? (
        <>
          Hi <span className="font-medium text-ink">{auth.firstName}</span> — delivering
          to <span className="font-medium text-ink">{area}</span>
        </>
      ) : (
        <>
          Delivering to <span className="font-medium text-ink">{area}</span>
        </>
      )}
      {emirate ? ` · showing stores in ${emirateLabel(emirate)}` : null}
    </p>
  );
}
