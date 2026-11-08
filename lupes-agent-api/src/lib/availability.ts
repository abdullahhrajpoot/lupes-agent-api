import { BUSINESS } from "./business";
import { addDays, dayOfWeek, daysBetween, hourInTz, prettyDate, todayInTz } from "./dates";
import { store } from "./store";

// Lupe's schedules Mon-Fri with limited Saturday, in morning / midday / afternoon slots.
// Arrival is within about one hour of the scheduled time (published terms).
export const SLOTS = [
  { id: "morning", label: "Morning", start: 8, arrival: "7:00 to 9:00 AM" },
  { id: "midday", label: "Midday", start: 11, arrival: "10:00 AM to 12:00 PM" },
  { id: "afternoon", label: "Afternoon", start: 14, arrival: "1:00 to 3:00 PM" },
] as const;
export type SlotId = (typeof SLOTS)[number]["id"];

const WEEKDAY_CREWS = 4;
const SATURDAY_CREWS = 1;

/** Deterministic "already booked by other customers" load, so the demo schedule looks real and stays stable. */
export function seededLoad(date: string, slot: SlotId): number {
  let h = 2166136261;
  for (const c of `${date}:${slot}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const r = (h >>> 0) % 100;
  const cap = capacityFor(date, slot);
  if (cap === 0) return 0;
  // Mornings book up first.
  const bias = slot === "morning" ? 25 : slot === "midday" ? 10 : 0;
  return Math.min(cap, Math.floor(((r + bias) / 100) * (cap + 1)));
}

export function capacityFor(date: string, slot: SlotId): number {
  const dow = dayOfWeek(date);
  if (dow === 0) return 0; // Sunday closed
  if (dow === 6) return slot === "morning" ? SATURDAY_CREWS : 0; // limited Saturday
  return WEEKDAY_CREWS;
}

/** Long jobs need to start early to finish within the working day. */
export function slotFitsDuration(slot: SlotId, teamHours: number): boolean {
  // A 3-person team; on-site time is roughly teamHours / 1 crew. Day ends ~6 PM.
  const start = SLOTS.find((s) => s.id === slot)!.start;
  return start + Math.max(1, teamHours) <= 18;
}

export type DaySlots = { date: string; day: string; slots: { slot: SlotId; label: string; arrivalWindow: string; available: boolean }[] };

export async function getAvailability(fromDate: string, days: number, teamHours: number, now = new Date()): Promise<DaySlots[]> {
  const today = todayInTz(BUSINESS.timezone, now);
  const hourNow = hourInTz(BUSINESS.timezone, now);
  const out: DaySlots[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    const delta = daysBetween(today, date);
    const slots = [];
    for (const s of SLOTS) {
      const cap = capacityFor(date, s.id);
      let available = cap > 0 && delta >= 0 && slotFitsDuration(s.id, teamHours);
      if (available && delta === 0 && s.start <= hourNow + 2) available = false; // need 2h notice same day
      if (available) {
        const used = seededLoad(date, s.id) + (await store.slotCount(`${date}:${s.id}`));
        available = used < cap;
      }
      slots.push({ slot: s.id, label: s.label, arrivalWindow: s.arrival, available });
    }
    out.push({ date, day: prettyDate(date), slots });
  }
  return out;
}

export async function reserve(date: string, slot: SlotId, teamHours: number, now = new Date()): Promise<{ ok: true } | { ok: false; reason: string }> {
  const day = (await getAvailability(date, 1, teamHours, now))[0];
  const s = day.slots.find((x) => x.slot === slot);
  if (!s?.available) return { ok: false, reason: `The ${slot} slot on ${day.day} is no longer available. Check availability again and offer another time.` };
  const cap = capacityFor(date, slot) - seededLoad(date, slot);
  const ok = await store.reserveSlot(`${date}:${slot}`, cap);
  return ok ? { ok: true } : { ok: false, reason: `That slot was just taken. Check availability again and offer another time.` };
}
