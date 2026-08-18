"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UaeEmirate } from "@/lib/types";
import { EMIRATES } from "@/lib/format";

export const DELIVERY_EMIRATE: UaeEmirate = "dubai";
export const DEFAULT_DELIVERY_AREA = "Dubai Marina";
export const DELIVERY_ONLY_MESSAGE = "We currently deliver in Dubai only.";

export function isDeliverableEmirate(emirate: string | null | undefined): emirate is UaeEmirate {
  return emirate === DELIVERY_EMIRATE;
}

export const UAE_AREAS: Record<UaeEmirate, string[]> = {
  dubai: [
    "Dubai Marina",
    "JBR",
    "Jumeirah",
    "Jumeirah Beach Residence",
    "Downtown Dubai",
    "Business Bay",
    "Dubai Design District",
    "DIFC",
    "Al Quoz",
    "Al Quoz Industrial Area",
    "Dubai Hills",
    "Arabian Ranches",
    "Palm Jumeirah",
    "Deira",
    "Bur Dubai",
    "Karama",
    "Satwa",
    "Mirdif",
    "Silicon Oasis",
    "International City",
    "Sports City",
    "Motor City",
    "Jumeirah Village Circle",
    "Jumeirah Lakes Towers",
    "Barsha",
    "Al Barsha",
    "Discovery Gardens",
    "Production City",
    "Dubai Investment Park",
    "Nad Al Sheba",
  ],
  abu_dhabi: [
    "Al Reem Island",
    "Saadiyat Island",
    "Yas Island",
    "Corniche",
    "Khalifa City",
    "Al Maryah Island",
    "Al Raha Beach",
    "Al Ban Yas",
    "Mussafah",
    "Mohammed Bin Zayed City",
    "Al Zahiyah",
    "Tourist Club Area",
    "Al Khalidiyah",
    "Al Mushrif",
  ],
  sharjah: [
    "Al Majaz",
    "Al Khan",
    "Muwaileh",
    "University City",
    "Al Nahda",
    "Al Qasimia",
    "Al Taawun",
    "Al Rolla",
    "Industrial Area",
    "Maysaloon",
  ],
  ajman: [
    "Al Nuaimiya",
    "Al Rashidiya",
    "Al Jurf",
    "Al Mowaihat",
    "Al Rumailah",
    "Ajman Downtown",
  ],
  uaq: ["Old Town", "Al Salamah", "Al Raafa", "Green Belt", "Industrial Area"],
  rak: [
    "Al Nakheel",
    "Al Hamra",
    "Mina Al Arab",
    "Al Qurm",
    "Al Dhait",
    "RAK City",
  ],
  fujairah: ["Fujairah City", "Dibba", "Sakamkam", "Al Faseel", "Mirbah"],
};

type LocationState = {
  emirate: UaeEmirate;
  area: string;
  setLocation: (emirate: UaeEmirate, area: string) => void;
  label: () => string;
};

export const useLocation = create<LocationState>()(
  persist(
    (set, get) => ({
      emirate: DELIVERY_EMIRATE,
      area: DEFAULT_DELIVERY_AREA,
      setLocation: (emirate, area) => {
        if (!isDeliverableEmirate(emirate)) return;
        set({ emirate, area });
      },
      label: () => {
        const { emirate, area } = get();
        const emirateName =
          EMIRATES.find((e) => e.value === emirate)?.label ?? emirate;
        return area || emirateName;
      },
    }),
    {
      name: "morni-location",
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<LocationState>;
        if (!isDeliverableEmirate(persisted.emirate)) {
          return {
            ...currentState,
            ...persisted,
            emirate: DELIVERY_EMIRATE,
            area: DEFAULT_DELIVERY_AREA,
          };
        }
        return { ...currentState, ...persisted };
      },
    },
  ),
);
