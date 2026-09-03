"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth-user";
import { cn } from "@/lib/utils";

function HeartIcon({
  filled,
  size,
}: {
  filled: boolean;
  size: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "size-5" : size === "sm" ? "size-5" : "size-[18px]";

  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 1.25 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={dim}
    >
      <path d="M12 20.25S3.75 15.1 3.75 9.4A4.65 4.65 0 0 1 12 6.75 4.65 4.65 0 0 1 20.25 9.4C20.25 15.1 12 20.25 12 20.25Z" />
    </svg>
  );
}

export function WishlistToggle({
  productId,
  size = "md",
  tone = "onImage",
  onChange,
}: {
  productId: string;
  size?: "sm" | "md" | "lg";
  /** onImage = light stroke on photos; inline = muted ink beside product names */
  tone?: "onImage" | "inline";
  onChange?: (isWished: boolean) => void;
}) {
  const router = useRouter();
  const { auth, loading } = useAuthUser();
  const supabase = useMemo(() => createClient(), []);

  const [isWished, setIsWished] = useState(false);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

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
          btnRef.current?.animate(
            [{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }],
            { duration: 280, easing: "ease-out" },
          );
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const btnClass =
    size === "sm"
      ? tone === "inline"
        ? "size-5"
        : "h-7 w-7"
      : size === "lg"
        ? "h-12 w-12 shrink-0"
        : "h-8 w-8";

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={toggleWishlist}
      disabled={busy}
      aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition",
        btnClass,
        tone === "inline" && size === "sm" && "mt-px",
        tone === "inline"
          ? isWished
            ? "text-accent-deep/75 hover:text-accent-deep"
            : "text-ink/35 hover:text-ink/70"
          : isWished
            ? "text-accent-deep/80 hover:text-accent-deep"
            : "text-white/80 drop-shadow-[0_1px_2px_rgba(28,20,24,0.45)] hover:text-white",
        busy && "opacity-70",
      )}
    >
      <HeartIcon filled={isWished} size={size} />
    </button>
  );
}
