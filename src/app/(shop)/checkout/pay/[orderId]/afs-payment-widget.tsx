"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const WIDGET_TIMEOUT_MS = 45_000;

type WpwlOptions = {
  onReady?: (...args: unknown[]) => void;
  onError?: (error: unknown) => void;
  [key: string]: unknown;
};

type WpwlRuntime = {
  unload?: () => void;
};

type WidgetWindow = Window & {
  wpwlOptions?: WpwlOptions;
  wpwl?: WpwlRuntime;
};

type AfsPaymentWidgetProps = {
  checkoutId: string;
  scriptUrl: string;
  integrity: string | null;
  shopperResultUrl: string;
  brands: string;
  onRetry: () => void;
};

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function widgetHasRenderedCardForm(form: HTMLFormElement) {
  return Boolean(
    form.querySelector(
      ".wpwl-form-card, .wpwl-control-cardNumber, input[name='card.number'], .wpwl-button",
    ),
  );
}

function unloadAfsRuntime(widgetWindow: WidgetWindow) {
  try {
    widgetWindow.wpwl?.unload?.();
  } catch {
    // AFS owns this runtime. Cleanup must continue even if its unload hook
    // throws while a third-party iframe is still settling.
  }

  document
    .querySelectorAll<HTMLScriptElement>('script[src*="static.min.js"]')
    .forEach((script) => script.remove());
}

function describeWidgetError(error: unknown) {
  if (!error || typeof error !== "object") return "AFS did not provide an error message.";
  const details = error as { name?: unknown; message?: unknown };
  const name = typeof details.name === "string" ? details.name : "WidgetError";
  const message = typeof details.message === "string" ? details.message : "Unknown provider error";
  return `${name}: ${message}`.slice(0, 240);
}

export default function AfsPaymentWidget({
  checkoutId,
  scriptUrl,
  integrity,
  shopperResultUrl,
  brands,
  onRetry,
}: AfsPaymentWidgetProps) {
  const formHostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const formMarkup = useMemo(
    () =>
      `<form action="${escapeAttribute(shopperResultUrl)}" class="paymentWidgets" data-brands="${escapeAttribute(brands)}"></form>`,
    [brands, shopperResultUrl],
  );

  useEffect(() => {
    const host = formHostRef.current;
    if (!host) return;

    const form = host.querySelector<HTMLFormElement>("form.paymentWidgets");
    if (!form) {
      setStatus("error");
      return;
    }

    let finished = false;
    const widgetWindow = window as WidgetWindow;
    unloadAfsRuntime(widgetWindow);
    const previousOptions = widgetWindow.wpwlOptions;
    const previousOnReady = previousOptions?.onReady;
    const previousOnError = previousOptions?.onError;

    const markReady = () => {
      if (finished) return;
      finished = true;
      setStatus("ready");
    };

    const fail = () => {
      if (finished) return;
      finished = true;
      setStatus("error");
    };

    const observer = new MutationObserver(() => {
      if (widgetHasRenderedCardForm(form)) markReady();
    });
    observer.observe(form, { childList: true, subtree: true });

    const timeout = window.setTimeout(fail, WIDGET_TIMEOUT_MS);
    widgetWindow.wpwlOptions = {
      ...previousOptions,
      onReady: (...args: unknown[]) => {
        previousOnReady?.(...args);
        markReady();
      },
      onError: (error: unknown) => {
        previousOnError?.(error);
        console.error("AFS payment widget error", describeWidgetError(error));
        fail();
      },
    };

    const script = document.createElement("script");
    script.id = `afs-payment-widget-${checkoutId}`;
    script.src = scriptUrl;
    script.type = "text/javascript";
    // AFS documents a normal classic script tag. Keep this dynamically
    // inserted script non-async so its form scan cannot race the mount.
    script.async = false;
    script.crossOrigin = integrity ? "anonymous" : "";
    if (integrity) script.integrity = integrity;
    script.addEventListener("error", fail, { once: true });
    document.head.appendChild(script);

    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
      unloadAfsRuntime(widgetWindow);
      script.remove();
      host.replaceChildren();
      if (previousOptions) {
        widgetWindow.wpwlOptions = previousOptions;
      } else {
        delete widgetWindow.wpwlOptions;
      }
    };
  }, [checkoutId, formMarkup, integrity, scriptUrl]);

  return (
    <div className="space-y-4">
      <div
        ref={formHostRef}
        // AFS owns and mutates this form after the script loads. Keeping the
        // subtree behind dangerouslySetInnerHTML prevents React from
        // reconciling away provider-generated fields and iframes.
        dangerouslySetInnerHTML={{ __html: formMarkup }}
      />

      {status === "loading" ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-5 text-sm text-muted" role="status">
          Loading secure card form…
        </div>
      ) : null}

      {status === "error" ? (
        <div className="space-y-3 rounded-xl bg-[#fff0f4] px-4 py-4 text-sm text-accent-deep" role="alert">
          <p>We couldn&apos;t load the secure card form. Please try again.</p>
          <button
            type="button"
            onClick={onRetry}
            className="border-b border-accent-deep font-semibold uppercase tracking-[0.08em]"
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}
