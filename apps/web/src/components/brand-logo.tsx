import Image from "next/image";

export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <Image
      src="/brand/morni-mark.png"
      alt=""
      width={145}
      height={155}
      className={className}
    />
  );
}
