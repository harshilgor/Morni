"use client";

import { ArrowTopRightIcon, CheckIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AddToBagButton({
  label,
  disabled = false,
  added = false,
  onClick,
  className,
  size = "default",
}: {
  label: string;
  disabled?: boolean;
  added?: boolean;
  onClick: () => void;
  className?: string;
  size?: "default" | "compact";
}) {
  return (
    <Button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative w-full justify-between rounded-full border-0 bg-ink px-2 pl-5 text-left font-semibold tracking-normal normal-case text-white shadow-none hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40",
        size === "compact" ? "h-12 pl-4 text-sm lg:h-11" : "h-14 pl-5 text-base sm:h-[3.25rem] sm:text-[0.95rem]",
        className,
      )}
    >
      <span className="truncate">{label}</span>
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-white/14 text-white ring-1 ring-white/20 transition group-hover/button:bg-white/20",
          size === "compact" ? "size-9" : "size-10 sm:size-9",
        )}
      >
        {added ? (
          <CheckIcon className="size-[1.15rem]" />
        ) : (
          <ArrowTopRightIcon className="size-[1.15rem]" />
        )}
      </span>
    </Button>
  );
}
