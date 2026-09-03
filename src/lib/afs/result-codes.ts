/**
 * AFS / OPPWA success result codes.
 * Official success regex from https://afs.docs.oppwa.com/reference/resultCodes
 * Regex: /^(000.000.|000.100.1|000.[36]|000.400.[1][12]0)/
 */
export const AFS_SUCCESS_RESULT_CODE_PATTERN =
  /^(000\.000\.|000\.100\.1|000\.[36]|000\.400\.[1][12]0)/;

/** Pending / created checkout — not a completed payment. */
export const AFS_PENDING_RESULT_CODE_PATTERN = /^000\.200\./;

export function isAfsPaymentSuccess(code: string | null | undefined): boolean {
  if (!code) return false;
  return AFS_SUCCESS_RESULT_CODE_PATTERN.test(code);
}

export function isAfsCheckoutPending(code: string | null | undefined): boolean {
  if (!code) return false;
  return AFS_PENDING_RESULT_CODE_PATTERN.test(code);
}
