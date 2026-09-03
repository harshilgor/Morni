export const RETURN_WINDOW_DAYS = 14;

export type ReturnJobStatus = "assigned" | "accepted" | "at_customer" | "collected" | "at_store" | "completed" | "failed" | "cancelled";

const RETURN_JOB_TRANSITIONS: Record<ReturnJobStatus, ReturnJobStatus[]> = {
  assigned: ["accepted"],
  accepted: ["at_customer"],
  at_customer: ["collected"],
  collected: ["at_store"],
  at_store: [],
  completed: [],
  failed: [],
  cancelled: [],
};

export function isReturnWindowOpen(deliveredAt: string, now = Date.now()) {
  const deliveredTime = Date.parse(deliveredAt);
  return Number.isFinite(deliveredTime) && now - deliveredTime <= RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function canAdvanceReturnJob(from: ReturnJobStatus, to: ReturnJobStatus) {
  return RETURN_JOB_TRANSITIONS[from]?.includes(to) ?? false;
}
