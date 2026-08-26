/** Dubai-local same-day delivery windows offered at checkout. */
export const DELIVERY_TIMEZONE = "Asia/Dubai";

/** Last moment (Dubai local) a shopper can book a same-day slot. */
export const SAME_DAY_BOOKING_CUTOFF = { hour: 18, minute: 30 } as const;

export type DeliverySlotDefinition = {
  id: string;
  /** Minutes from local midnight. */
  startMinutes: number;
  endMinutes: number;
  label: string;
};

export type BookableDeliverySlot = {
  id: string;
  label: string;
  dateKey: string;
  dateLabel: string;
  startIso: string;
  endIso: string;
};

export const DELIVERY_SLOT_DEFINITIONS: DeliverySlotDefinition[] = [
  { id: "10:00-11:30", startMinutes: 10 * 60, endMinutes: 11 * 60 + 30, label: "10:00 – 11:30 AM" },
  { id: "11:30-13:30", startMinutes: 11 * 60 + 30, endMinutes: 13 * 60 + 30, label: "11:30 AM – 1:30 PM" },
  { id: "13:30-14:30", startMinutes: 13 * 60 + 30, endMinutes: 14 * 60 + 30, label: "1:30 – 2:30 PM" },
  { id: "14:30-16:00", startMinutes: 14 * 60 + 30, endMinutes: 16 * 60, label: "2:30 – 4:00 PM" },
  { id: "16:00-18:00", startMinutes: 16 * 60, endMinutes: 18 * 60, label: "4:00 – 6:00 PM" },
];

const dubaiDateTimeFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: DELIVERY_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function dubaiParts(date: Date) {
  const parts = dubaiDateTimeFormat.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Calendar date key (YYYY-MM-DD) in Asia/Dubai. */
export function dubaiDateKey(date: Date = new Date()) {
  const { year, month, day } = dubaiParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dubaiMinutesSinceMidnight(date: Date = new Date()) {
  const { hour, minute } = dubaiParts(date);
  return hour * 60 + minute;
}

export function isPastSameDayBookingCutoff(date: Date = new Date()) {
  return (
    dubaiMinutesSinceMidnight(date) >=
    SAME_DAY_BOOKING_CUTOFF.hour * 60 + SAME_DAY_BOOKING_CUTOFF.minute
  );
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
}

/** Instant for a Dubai-local wall clock on a YYYY-MM-DD date. Dubai has no DST (UTC+4). */
export function dubaiLocalToUtcIso(dateKey: string, minutesFromMidnight: number) {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  const day = Number(dateKey.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day, hours - 4, minutes, 0)).toISOString();
}

function dateLabelForKey(dateKey: string, todayKey: string) {
  if (dateKey === todayKey) return "Today";
  if (dateKey === addDaysToDateKey(todayKey, 1)) return "Tomorrow";
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-AE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function slotForDate(
  definition: DeliverySlotDefinition,
  dateKey: string,
  todayKey: string,
): BookableDeliverySlot {
  return {
    id: `${dateKey}__${definition.id}`,
    label: definition.label,
    dateKey,
    dateLabel: dateLabelForKey(dateKey, todayKey),
    startIso: dubaiLocalToUtcIso(dateKey, definition.startMinutes),
    endIso: dubaiLocalToUtcIso(dateKey, definition.endMinutes),
  };
}

/**
 * Bookable windows: remaining same-day slots before the 6:30 PM cutoff,
 * otherwise (and additionally as needed) tomorrow's full set.
 */
export function listBookableDeliverySlots(now: Date = new Date()): BookableDeliverySlot[] {
  const todayKey = dubaiDateKey(now);
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const nowMs = now.getTime();
  const slots: BookableDeliverySlot[] = [];

  if (!isPastSameDayBookingCutoff(now)) {
    for (const definition of DELIVERY_SLOT_DEFINITIONS) {
      const candidate = slotForDate(definition, todayKey, todayKey);
      if (new Date(candidate.startIso).getTime() > nowMs) {
        slots.push(candidate);
      }
    }
  }

  if (slots.length === 0) {
    for (const definition of DELIVERY_SLOT_DEFINITIONS) {
      slots.push(slotForDate(definition, tomorrowKey, todayKey));
    }
  }

  return slots;
}

export function findBookableDeliverySlot(
  startIso: string,
  endIso: string,
  now: Date = new Date(),
) {
  return listBookableDeliverySlots(now).find(
    (slot) => slot.startIso === startIso && slot.endIso === endIso,
  );
}

export function formatDeliverySlotWindow(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
) {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const datePart = start.toLocaleDateString("en-AE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: DELIVERY_TIMEZONE,
  });
  const startTime = start.toLocaleTimeString("en-AE", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: DELIVERY_TIMEZONE,
  });
  const endTime = end.toLocaleTimeString("en-AE", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: DELIVERY_TIMEZONE,
  });
  return `${datePart}, ${startTime} – ${endTime}`;
}

export function formatDeliverySlotShort(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
) {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const todayKey = dubaiDateKey();
  const slotKey = dubaiDateKey(start);
  const day =
    slotKey === todayKey
      ? "Today"
      : slotKey === addDaysToDateKey(todayKey, 1)
        ? "Tomorrow"
        : start.toLocaleDateString("en-AE", {
            day: "numeric",
            month: "short",
            timeZone: DELIVERY_TIMEZONE,
          });
  const startTime = start.toLocaleTimeString("en-AE", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: DELIVERY_TIMEZONE,
  });
  const endTime = end.toLocaleTimeString("en-AE", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: DELIVERY_TIMEZONE,
  });
  return `${day} · ${startTime} – ${endTime}`;
}
