"use client";

type StarRatingProps = {
  value: number;
  max?: number;
  size?: "sm" | "md";
  label?: string;
};

export function StarIcon({
  filled,
  size = "sm",
}: {
  filled: boolean;
  size?: "sm" | "md";
}) {
  const className =
    size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className={`${className} ${filled ? "fill-[#f2b246] text-[#f2b246]" : "fill-none text-[#d6c2a0]"}`}
    >
      <path
        d="m10 1.6 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L2.2 7.3l5.4-.8L10 1.6Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarRating({
  value,
  max = 5,
  size = "sm",
  label,
}: StarRatingProps) {
  const rounded = Math.round(value);
  return (
    <div className="flex items-center gap-1" aria-label={label ?? `${value} out of ${max} stars`}>
      {Array.from({ length: max }, (_, index) => (
        <StarIcon key={index + 1} filled={index + 1 <= rounded} size={size} />
      ))}
    </div>
  );
}

export function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {Array.from({ length: 5 }, (_, index) => {
        const star = index + 1;
        const active = star <= value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(star)}
            className="rounded p-0.5 transition hover:scale-110 disabled:opacity-40"
          >
            <StarIcon filled={active} size="md" />
          </button>
        );
      })}
    </div>
  );
}
