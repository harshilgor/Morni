import Image from "next/image";

export function BrandLogo({
  className = "h-auto w-28",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/morni-logo.png"
      alt="Morni"
      width={824}
      height={314}
      className={className}
      priority={priority}
    />
  );
}

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
