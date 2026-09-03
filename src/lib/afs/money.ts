export function formatAfsAmount(amountAed: number): string {
  if (!Number.isFinite(amountAed) || amountAed <= 0) {
    throw new Error("Invalid payment amount.");
  }
  return (Math.round((amountAed + Number.EPSILON) * 100) / 100).toFixed(2);
}

export function amountsMatchAed(
  expected: number,
  actual: string | null | undefined,
): boolean {
  if (actual == null || actual === "") return false;
  const parsed = Number.parseFloat(actual);
  if (!Number.isFinite(parsed)) return false;
  return (
    Math.round((expected + Number.EPSILON) * 100) ===
    Math.round((parsed + Number.EPSILON) * 100)
  );
}

/** Strip secrets and card-like fields before logging or storing. */
export function redactAfsPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const blocked = new Set([
    "card",
    "customer",
    "customParameters",
    "risk",
    "redirect",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (blocked.has(key)) continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      out[key] = redactAfsPayload(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}
