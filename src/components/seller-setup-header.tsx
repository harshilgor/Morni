"use client";

import Link from "next/link";

function ArrowLeftIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 12H5m6 6-6-6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StoreMark() {
  return (
    <span className="seller-setup-mark" aria-hidden>
      M
    </span>
  );
}

export function SellerSetupHeader({
  saved,
}: {
  saved: boolean;
}) {
  return (
    <header className="seller-setup-header">
      <div className="seller-setup-header-inner">
        <Link href="/sell" className="seller-setup-exit">
          <ArrowLeftIcon />
          <span>Exit setup</span>
        </Link>

        <Link href="/sell" className="seller-setup-brand" aria-label="Morni seller setup home">
          <StoreMark />
          <span className="hidden sm:inline">Morni</span>
          <span className="seller-setup-brand-divider" aria-hidden />
          <span>Seller setup</span>
        </Link>

        <span className={`seller-setup-save-status ${saved ? "is-saved" : ""}`}>
          <span className="seller-setup-save-dot" aria-hidden />
          {saved ? "Saved" : "Progress saves as you continue"}
        </span>
      </div>
    </header>
  );
}
