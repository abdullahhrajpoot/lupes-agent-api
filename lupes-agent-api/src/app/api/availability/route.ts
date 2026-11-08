import { z } from "zod";
import { BUSINESS } from "@/lib/business";
import { getAvailability } from "@/lib/availability";
import { addDays, todayInTz } from "@/lib/dates";
import { handler, ok, options } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

const Q = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
  days: z.coerce.number().int().min(1).max(14).default(4),
  teamHours: z.coerce.number().positive().max(16).default(2),
});

export const GET = handler(async (req) => {
  const p = new URL(req.url).searchParams;
  const q = Q.parse({ date: p.get("date") ?? undefined, days: p.get("days") ?? undefined, teamHours: p.get("teamHours") ?? p.get("durationHours") ?? undefined });
  const today = todayInTz(BUSINESS.timezone);
  const from = q.date && q.date >= today ? q.date : (q.date ? today : addDays(today, 1));
  const days = await getAvailability(from, q.days, q.teamHours);
  const open = days.flatMap((d) => d.slots.filter((s) => s.available).map((s) => ({ date: d.date, day: d.day, slot: s.slot, arrivalWindow: s.arrivalWindow })));
  return ok({
    timezone: BUSINESS.timezone,
    from,
    days,
    openSlots: open,
    message: open.length
      ? `Open times: ${open.slice(0, 3).map((o) => `${o.day} ${o.slot} (arrival ${o.arrivalWindow})`).join("; ")}. Offer up to 3 of these.`
      : "No openings in this range. Check later dates (pass a later date).",
  });
});
