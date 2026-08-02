import type { UaeEmirate } from "./types";

export const EMIRATES: { value: UaeEmirate; label: string }[] = [
  { value: "dubai", label: "Dubai" },
  { value: "abu_dhabi", label: "Abu Dhabi" },
  { value: "sharjah", label: "Sharjah" },
  { value: "ajman", label: "Ajman" },
  { value: "uaq", label: "Umm Al Quwain" },
  { value: "rak", label: "Ras Al Khaimah" },
  { value: "fujairah", label: "Fujairah" },
];

export function formatAed(amount: number | string) {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function emirateLabel(emirate: UaeEmirate) {
  return EMIRATES.find((e) => e.value === emirate)?.label ?? emirate;
}

export function deliveryPromise(minutes = 60) {
  if (minutes <= 60) return "Delivery within 1 hour";
  return `Delivery in about ${minutes} minutes`;
}

export function orderStatusLabel(status: string) {
  const map: Record<string, string> = {
    placed: "Placed",
    accepted: "Accepted",
    picking: "Being prepared",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return map[status] ?? status;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
