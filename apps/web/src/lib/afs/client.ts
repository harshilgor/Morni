import "server-only";
import { isAfsPaymentSuccess } from "@/lib/afs/result-codes";
import {
  amountsMatchAed,
  formatAfsAmount,
  redactAfsPayload,
} from "@/lib/afs/money";

export { amountsMatchAed, formatAfsAmount, redactAfsPayload };

const DEFAULT_UAT_BASE_URL = "https://eu-test.oppwa.com";
const DEFAULT_BRANDS = "VISA MASTER";
const REQUEST_TIMEOUT_MS = 20_000;

export type AfsConfig = {
  enabled: boolean;
  entityId: string;
  accessToken: string;
  baseUrl: string;
  brands: string;
};

export type AfsPrepareCheckoutInput = {
  amountAed: number;
  merchantTransactionId: string;
  customerEmail?: string | null;
};

export type AfsPrepareCheckoutResult = {
  checkoutId: string;
  integrity: string | null;
  resultCode: string | null;
};

export type AfsPaymentStatus = {
  id: string | null;
  checkoutId: string | null;
  amount: string | null;
  currency: string | null;
  paymentType: string | null;
  merchantTransactionId: string | null;
  resultCode: string | null;
  resultDescription: string | null;
  brand: string | null;
  raw: Record<string, unknown>;
};

export class AfsError extends Error {
  readonly status: number;
  readonly resultCode: string | null;

  constructor(message: string, status = 502, resultCode: string | null = null) {
    super(message);
    this.name = "AfsError";
    this.status = status;
    this.resultCode = resultCode;
  }
}

export function isAfsPaymentsEnabled(): boolean {
  const flag = (process.env.AFS_PAYMENTS_ENABLED ?? "").trim().toLowerCase();
  if (flag !== "1" && flag !== "true" && flag !== "yes") return false;
  return Boolean(
    process.env.AFS_ENTITY_ID?.trim() && process.env.AFS_ACCESS_TOKEN?.trim(),
  );
}

export function getAfsPaymentBrands(): string {
  return (process.env.AFS_PAYMENT_BRANDS ?? DEFAULT_BRANDS).trim() || DEFAULT_BRANDS;
}

export function getAfsConfig(): AfsConfig {
  const entityId = process.env.AFS_ENTITY_ID?.trim() ?? "";
  const accessToken = process.env.AFS_ACCESS_TOKEN?.trim() ?? "";
  const baseUrl = normalizeBaseUrl(
    process.env.AFS_BASE_URL?.trim() || DEFAULT_UAT_BASE_URL,
  );
  const enabled = isAfsPaymentsEnabled();

  if (enabled && (!entityId || !accessToken)) {
    throw new AfsError("AFS payment credentials are not configured.", 503);
  }

  return {
    enabled,
    entityId,
    accessToken,
    baseUrl,
    brands: getAfsPaymentBrands(),
  };
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

async function afsFetch(
  pathOrUrl: string,
  init: RequestInit & { entityId: string; accessToken: string; baseUrl: string },
): Promise<Record<string, unknown>> {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${init.baseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${init.accessToken}`,
        ...(init.headers ?? {}),
      },
    });

    const text = await response.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new AfsError("AFS returned a non-JSON response.", 502);
    }

    if (!response.ok) {
      const result = json.result as { code?: string; description?: string } | undefined;
      console.error("AFS request failed", {
        status: response.status,
        resultCode: result?.code ?? null,
        description: result?.description ?? null,
      });
      throw new AfsError(
        result?.description || "AFS payment request failed.",
        502,
        result?.code ?? null,
      );
    }

    return json;
  } catch (error) {
    if (error instanceof AfsError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AfsError("AFS request timed out.", 504);
    }
    throw new AfsError("Unable to reach AFS payment gateway.", 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function prepareAfsCheckout(
  input: AfsPrepareCheckoutInput,
): Promise<AfsPrepareCheckoutResult> {
  const config = getAfsConfig();
  if (!config.enabled) {
    throw new AfsError("Card payments are not enabled.", 503);
  }

  const body = new URLSearchParams();
  body.set("entityId", config.entityId);
  body.set("amount", formatAfsAmount(input.amountAed));
  body.set("currency", "AED");
  body.set("paymentType", "DB");
  body.set("merchantTransactionId", input.merchantTransactionId);
  body.set("integrity", "true");
  if (input.customerEmail) {
    body.set("customer.email", input.customerEmail.slice(0, 128));
  }

  const json = await afsFetch("/v1/checkouts", {
    method: "POST",
    entityId: config.entityId,
    accessToken: config.accessToken,
    baseUrl: config.baseUrl,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const checkoutId = typeof json.id === "string" ? json.id : null;
  const integrity = typeof json.integrity === "string" ? json.integrity : null;
  const result = json.result as { code?: string } | undefined;

  if (!checkoutId) {
    throw new AfsError("AFS did not return a checkout id.", 502, result?.code ?? null);
  }

  return {
    checkoutId,
    integrity,
    resultCode: result?.code ?? null,
  };
}

export async function getAfsPaymentStatus(
  resourcePath: string,
): Promise<AfsPaymentStatus> {
  const config = getAfsConfig();
  if (!config.enabled) {
    throw new AfsError("Card payments are not enabled.", 503);
  }

  const path = resourcePath.startsWith("/") ? resourcePath : `/${resourcePath}`;
  if (!path.startsWith("/v1/")) {
    throw new AfsError("Invalid payment resource path.", 400);
  }

  const separator = path.includes("?") ? "&" : "?";
  const url = `${config.baseUrl}${path}${separator}entityId=${encodeURIComponent(config.entityId)}`;

  const json = await afsFetch(url, {
    method: "GET",
    entityId: config.entityId,
    accessToken: config.accessToken,
    baseUrl: config.baseUrl,
  });

  const result = json.result as { code?: string; description?: string } | undefined;
  const card = json.card as { brand?: string } | undefined;

  return {
    id: typeof json.id === "string" ? json.id : null,
    checkoutId:
      typeof json.ndc === "string"
        ? json.ndc
        : typeof (json as { checkoutId?: string }).checkoutId === "string"
          ? (json as { checkoutId: string }).checkoutId
          : null,
    amount: typeof json.amount === "string" ? json.amount : null,
    currency: typeof json.currency === "string" ? json.currency : null,
    paymentType: typeof json.paymentType === "string" ? json.paymentType : null,
    merchantTransactionId:
      typeof json.merchantTransactionId === "string"
        ? json.merchantTransactionId
        : null,
    resultCode: result?.code ?? null,
    resultDescription: result?.description ?? null,
    brand: card?.brand ?? null,
    raw: redactAfsPayload(json),
  };
}

export function paymentStatusIsSuccessful(status: AfsPaymentStatus): boolean {
  return isAfsPaymentSuccess(status.resultCode);
}

export function getAfsWidgetScriptUrl(checkoutId: string): string {
  const config = getAfsConfig();
  return `${config.baseUrl}/v1/paymentWidgets.js?checkoutId=${encodeURIComponent(checkoutId)}`;
}
