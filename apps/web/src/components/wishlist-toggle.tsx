"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth-user";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
    </svg>
  );
}

export function WishlistToggle({
  productId,
  size = "md",
  onChange,
}: {
  productId: string;
  size?: "sm" | "md";
  onChange?: (isWished: boolean) => void;
}) {
  const router = useRouter();
  const { auth, loading } = useAuthUser();
  const supabase = useMemo(() => createClient(), []);

  const [isWished, setIsWished] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    const userId = auth?.user?.id;
    if (!userId) {
      // Avoid synchronous setState inside the effect (eslint/react rule).
      const reset = () => setIsWished(false);
      if (typeof queueMicrotask === "function") queueMicrotask(reset);
      else window.setTimeout(reset, 0);
      return;
    }

    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("id")
        .eq("shopper_id", userId)
        .eq("product_id", productId)
        .maybeSingle();

      if (!active) return;
      if (error) {
        console.error(error);
        return;
      }

      setIsWished(!!data);
    })();

    return () => {
      active = false;
    };
  }, [auth?.user?.id, loading, productId, supabase]);

  async function toggleWishlist(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    if (busy) return;
    const userId = auth?.user?.id;
    if (!userId) {
      router.push("/auth");
      return;
    }

    setBusy(true);
    try {
      if (isWished) {
        const { error } = await supabase
          .from("wishlist_items")
          .delete()
          .eq("shopper_id", userId)
          .eq("product_id", productId);

        if (!error) {
          setIsWished(false);
          onChange?.(false);
        }
      } else {
        const { error } = await supabase
          .from("wishlist_items")
          .insert({ shopper_id: userId, product_id: productId });

        if (!error) {
          setIsWished(true);
          onChange?.(true);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const btnClass = size === "sm" ? "h-9 w-9" : "h-10 w-10";

  return (
    <button
      type="button"
      onClick={toggleWishlist}
      disabled={busy}
      aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}
      className={[
        "inline-flex items-center justify-center rounded-full border backdrop-blur",
        btnClass,
        isWished
          ? "border-accent-deep/30 bg-white/90 text-accent-deep shadow-sm"
          : "border-line bg-white/70 text-muted hover:bg-white/95 hover:text-accent-deep",
        busy ? "opacity-70" : "",
      ].join(" ")}
    >
      <HeartIcon filled={isWished} />
    </button>
  );
}
