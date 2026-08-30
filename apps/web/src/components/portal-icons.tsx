import type { ReactNode } from "react";

export type PortalIconName =
  | "overview"
  | "orders"
  | "products"
  | "promotions"
  | "reviews"
  | "analytics"
  | "settings"
  | "store"
  | "search"
  | "bell"
  | "plus"
  | "arrow"
  | "chevronDown"
  | "external"
  | "package"
  | "warning"
  | "check"
  | "clock"
  | "phone"
  | "location"
  | "more"
  | "eye"
  | "eyeOff"
  | "sparkle"
  | "edit"
  | "refresh"
  | "camera"
  | "close"
  | "image";

export function PortalIcon({
  name,
  className = "h-4 w-4",
}: {
  name: PortalIconName;
  className?: string;
}) {
  const paths: Record<PortalIconName, ReactNode> = {
    overview: <><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /></>,
    orders: <><path d="M5 4.5h14v15H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    products: <><path d="m12 3 8 4.4v9.2L12 21l-8-4.4V7.4L12 3Z" /><path d="m4.5 7.8 7.5 4.1 7.5-4.1M12 12v8.5" /></>,
    promotions: <><path d="m3.5 12 8.5-8.5 8.5 8.5-8.5 8.5L3.5 12Z" /><circle cx="8.5" cy="8.5" r="1" fill="currentColor" /><path d="m9 15 6-6" /></>,
    reviews: <><path d="M5 4.5h14v11H9l-4 4v-15Z" /><path d="m8 10 2 2 4-4" /></>,
    analytics: <><path d="M4 19.5V10M10 19.5V4.5M16 19.5v-6M22 19.5H2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.1 2.1-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.1h-3v-.1A1.7 1.7 0 0 0 10.7 18.6a1.7 1.7 0 0 0-1.88.34l-.06.06-2.1-2.1.06-.06A1.7 1.7 0 0 0 7.06 15a1.7 1.7 0 0 0-1.56-1.03h-.1v-3h.1A1.7 1.7 0 0 0 7.06 9.94 1.7 1.7 0 0 0 6.72 8.06L6.66 8l2.1-2.1.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.1h3v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.1 2.1-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.1v3h-.1A1.7 1.7 0 0 0 19.4 15Z" /></>,
    store: <><path d="M4 10.5V20h16v-9.5" /><path d="M3 10.5 4.5 4h15l1.5 6.5" /><path d="M3 10.5h18M8 20v-5h8v5" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    bell: <><path d="M18 10a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h13M13 6l6 6-6 6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6H4V6h6" /></>,
    package: <><path d="m12 3 8 4.4v9.2L12 21l-8-4.4V7.4L12 3Z" /><path d="m4.5 7.8 7.5 4.1 7.5-4.1M12 12v8.5" /></>,
    warning: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v4.5M12 17h.01" /></>,
    check: <path d="m5 12 4.2 4.2L19 6.5" />,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
    phone: <path d="M7 3.5 4.5 5a2 2 0 0 0-.9 2.1c1.3 6.3 7 12 13.3 13.3a2 2 0 0 0 2.1-.9l1.5-2.5-4-2.5-1.5 1.7a13.5 13.5 0 0 1-7.2-7.2l1.7-1.5-2.5-4Z" />,
    location: <><path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
    eye: <><path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.4" /></>,
    eyeOff: <><path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.4" /><path d="m4 4 16 16" /></>,
    sparkle: <><path d="M12 2.8 13.7 9 20 10.7l-6.3 1.7L12 18.7l-1.7-6.3L4 10.7 10.3 9 12 2.8ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
    edit: <><path d="m4 16.5-.8 3.3 3.3-.8L18.8 6.7a2.3 2.3 0 0 0-3.3-3.3L4 16.5Z" /><path d="m13.8 5.2 3.3 3.3" /></>,
    refresh: <><path d="M20 11a8.1 8.1 0 0 0-14.8-3L3.5 10.5M4 5v5.5h5.5" /><path d="M4 13a8.1 8.1 0 0 0 14.8 3l1.7-2.5M20 19v-5.5h-5.5" /></>,
    camera: <><path d="M4.5 8.5h3l1.5-2h6l1.5 2h3A1.5 1.5 0 0 1 21 10v8.5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5V10A1.5 1.5 0 0 1 4.5 8.5Z" /><circle cx="12" cy="14" r="3.2" /></>,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    image: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m7.5 17 3.5-3.5L14 16l2.5-2.5L20.5 17" /></>,
  };

  return <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>;
}
