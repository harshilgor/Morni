"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocation } from "@/lib/location";
import { useAuthUser } from "@/lib/use-auth-user";

/** Keeps home store filters in sync with the header delivery location. */
export function LocationHomeSync() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emirate = useLocation((s) => s.emirate);
  const area = useLocation((s) => s.area);
  const { auth } = useAuthUser();
  const urlEmirate = searchParams.get("emirate");

  useEffect(() => {
    if (!urlEmirate && emirate) {
      router.replace(`/?emirate=${emirate}`);
    }
  }, [emirate, urlEmirate, router]);

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
      {urlEmirate || emirate
        ? ` · showing stores in ${(urlEmirate || emirate).replace("_", " ")}`
        : null}
    </p>
  );
}
