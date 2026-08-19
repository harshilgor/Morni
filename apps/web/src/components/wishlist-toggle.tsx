"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { HeartFilledIcon, HeartIcon } from "@radix-ui/react-icons";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth-user";
import { cn } from "@/lib/utils";

function HeartIconComponent({
  filled,
  size,
}: {
  filled: boolean;
  size: "sm" | "md" | "lg";
}) {
  const iconClass = size === "lg" ? "size-5" : "size-[18px]";
  const Icon = filled ? HeartFilledIcon : HeartIcon;

  return <Icon aria-hidden className={iconClass} />;
}

export function WishlistToggle({
  productId,
  size = "md",
  onChange,
}: {
  productId: string;
  size?: "sm" | "md" | "lg";
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
            [{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }],
            { duration: 300, easing: "ease-out" },
          );
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const btnClass =
    size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14 shrink-0" : "h-10 w-10";

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={toggleWishlist}
      disabled={busy}
      aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        "inline-flex items-center justify-center rounded-full border bg-white transition backdrop-blur-sm",
        btnClass,
        isWished
          ? "border-accent-deep/30 text-accent-deep shadow-sm"
          : "border-line text-muted hover:border-accent-deep/25 hover:text-accent-deep",
        busy && "opacity-70",
      )}
    >
      <HeartIconComponent filled={isWished} size={size} />
    </button>
  );
}
