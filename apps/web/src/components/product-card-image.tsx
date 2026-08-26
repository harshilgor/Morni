"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductCardImage({ src, alt, priority = false }: { src?: string; alt: string; priority?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>();
  if (!src || failedSrc === src) {
    return <span role="img" aria-label={`${alt} image unavailable`} className="absolute inset-0 grid place-items-center bg-[#f2ece8] px-4 text-center text-xs font-medium text-[#7c6a6f]">Image unavailable</span>;
  }

  return <Image src={src} alt={alt} fill sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 180px" priority={priority} onError={() => setFailedSrc(src)} className="object-cover transition duration-500 group-hover:scale-[1.04]" />;
}
