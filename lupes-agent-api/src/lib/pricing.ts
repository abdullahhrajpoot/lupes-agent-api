import { z } from "zod";
import { ADD_ONS, BUSINESS, INCLUDED_ADD_ONS, PRICE_TABLE, ROOMS, SQFT_TIERS, checkServiceArea, type Frequency } from "./business";
import { daysBetween, todayInTz } from "./dates";

export const QuoteInput = z.object({
  serviceId: z.enum(["standard", "deep", "move_in_out", "hourly", "by_room", "office", "post_construction"]),
  sqft: z.coerce.number().int().positive().max(20000).optional(),
  frequency: z.enum(["one_time", "weekly", "biweekly", "triweekly", "monthly"]).optional(),
  hours: z.coerce.number().positive().max(24).optional(),
  roomLevel: z.enum(["general", "deep"]).optional(),
  rooms: z.array(z.object({ id: z.string(), qty: z.coerce.number().int().positive().max(20).default(1) })).optional(),
  addOns: z.array(z.object({ id: z.string(), qty: z.coerce.number().positive().max(500).default(1) })).optional(),
  zip: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type QuoteInput = z.infer<typeof QuoteInput>;

export type LineItem = { label: string; amount: number; note?: string };
export type Quote = {
  serviceId: string;
  serviceName: string;
  frequency?: Frequency;
  lineItems: LineItem[];
  subtotal: number;
  discount?: { label: string; amount: number };
  minimumApplied: boolean;
  total: number;
  perVisit: boolean;
  estimatedTeamHours: number;
  includedFree: string[];
  serviceArea?: ReturnType<typeof checkServiceArea>;
  notes: string[];
  message: string;
};

export class QuoteError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Linear interpolation over the published square-footage table. */
export function priceForSqft(column: keyof typeof PRICE_TABLE, sqft: number): number {
  const prices = PRICE_TABLE[column];
  if (sqft > SQFT_TIERS[SQFT_TIERS.length - 1]) {
    throw new QuoteError("CUSTOM_QUOTE_REQUIRED", `Homes over 7,500 sq ft need a custom quote. Please call ${BUSINESS.phone}.`, 422);
  }
  if (sqft <= SQFT_TIERS[0]) return prices[0];
  for (let i = 1; i < SQFT_TIERS.length; i++) {
    if (sqft <= SQFT_TIERS[i]) {
      const t = (sqft - SQFT_TIERS[i - 1]) / (SQFT_TIERS[i] - SQFT_TIERS[i - 1]);
      return Math.round(prices[i - 1] + t * (prices[i] - prices[i - 1]));
    }
  }
  return prices[prices.length - 1];
}

const NAMES: Record<string, string> = {
  standard: "General / Recurring Cleaning",
  deep: "Deep Cleaning",
  move_in_out: "Move-In / Move-Out Cleaning",
  hourly: "By-the-Hour Cleaning",
  by_room: "By-the-Room Cleaning",
};
const FREQ_LABEL: Record<Frequency, string> = {
  one_time: "one-time", weekly: "weekly", biweekly: "bi-weekly", triweekly: "tri-weekly", monthly: "monthly",
};

export function buildQuote(input: QuoteInput, now = new Date()): Quote {
  const { serviceId } = input;
  if (serviceId === "office" || serviceId === "post_construction") {
    throw new QuoteError(
      "CUSTOM_QUOTE_REQUIRED",
      `${serviceId === "office" ? "Office cleaning" : "Post-construction cleaning"} is quoted by the office. Collect the customer's name, phone, email and a short description, then create a booking request with serviceId "${serviceId}".`,
      422,
    );
  }

  const notes: string[] = [];
  const lineItems: LineItem[] = [];
  let serviceArea: Quote["serviceArea"];
  if (input.zip) {
    serviceArea = checkServiceArea(input.zip);
    if (serviceArea.status === "out_of_area") throw new QuoteError("OUT_OF_AREA", serviceArea.message, 422);
    if (serviceArea.status === "confirm_with_office") notes.push(serviceArea.message);
  }

  let frequency: Frequency | undefined;
  let base = 0;

  if (serviceId === "standard" || serviceId === "deep" || serviceId === "move_in_out") {
    if (!input.sqft) throw new QuoteError("MISSING_FIELD", "Ask the customer for the approximate square footage of the home (a rough number is fine).");
    if (serviceId === "standard") {
      frequency = input.frequency ?? "one_time";
      base = priceForSqft(frequency, input.sqft);
      lineItems.push({ label: `${NAMES.standard}, ${FREQ_LABEL[frequency]}, ~${input.sqft.toLocaleString()} sq ft`, amount: base });
      if (frequency === "one_time") {
        const biweekly = priceForSqft("biweekly", input.sqft);
        notes.push(`Tip: bi-weekly service for this home would be about $${biweekly} per visit instead of $${base}.`);
      }
    } else {
      base = priceForSqft(serviceId, input.sqft);
      lineItems.push({ label: `${NAMES[serviceId]}, ~${input.sqft.toLocaleString()} sq ft`, amount: base });
    }
  } else if (serviceId === "hourly") {
    if (!input.hours) throw new QuoteError("MISSING_FIELD", "Ask how many team hours the customer wants to book.");
    base = round2(input.hours * BUSINESS.hourlyRate);
    lineItems.push({ label: `${input.hours} team hour(s) at $${BUSINESS.hourlyRate}/hr (3-person team)`, amount: base });
  } else if (serviceId === "by_room") {
    if (!input.rooms?.length) throw new QuoteError("MISSING_FIELD", "Ask which rooms the customer wants cleaned.");
    const level = input.roomLevel ?? "general";
    for (const r of input.rooms) {
      const room = ROOMS.find((x) => x.id === r.id);
      if (!room) throw new QuoteError("UNKNOWN_ROOM", `Unknown room "${r.id}". Valid rooms: ${ROOMS.map((x) => x.id).join(", ")}.`);
      const amt = room[level] * r.qty;
      lineItems.push({ label: `${room.name} x${r.qty} (${level})`, amount: amt });
      base += amt;
    }
  }

  const included = INCLUDED_ADD_ONS[serviceId] ?? [];
  const includedFree: string[] = [];
  for (const a of input.addOns ?? []) {
    const def = ADD_ONS.find((x) => x.id === a.id);
    if (!def) throw new QuoteError("UNKNOWN_ADD_ON", `Unknown add-on "${a.id}". Valid add-ons: ${ADD_ONS.map((x) => x.id).join(", ")}.`);
    if (included.includes(def.id)) { includedFree.push(def.name); continue; }
    let qty = a.qty;
    let label = `${def.name}`;
    if (def.unit === "per_sqft") {
      if (!input.sqft) throw new QuoteError("MISSING_FIELD", `"${def.name}" is priced per sq ft. Ask for the home's square footage.`);
      qty = input.sqft;
      label += ` (${input.sqft.toLocaleString()} sq ft x $${def.price})`;
    } else if (def.unit !== "flat") {
      label += ` x${qty}`;
    } else {
      qty = 1;
    }
    lineItems.push({ label, amount: round2(def.price * qty) });
  }
  if (includedFree.length) notes.push(`Already included at no charge: ${includedFree.join(", ")}.`);

  const subtotal = round2(lineItems.reduce((s, l) => s + l.amount, 0));

  // Published promos: up to 8% same-day, 5% same-week, when available.
  let discount: Quote["discount"];
  if (input.date) {
    const days = daysBetween(todayInTz(BUSINESS.timezone, now), input.date);
    if (days < 0) throw new QuoteError("DATE_IN_PAST", "That date has already passed. Ask for a future date.");
    if (days === 0) discount = { label: "Same-day promotional discount (8%, subject to availability)", amount: round2(subtotal * 0.08) };
    else if (days <= 6) discount = { label: "Same-week booking discount (5%, subject to availability)", amount: round2(subtotal * 0.05) };
  }

  let total = round2(subtotal - (discount?.amount ?? 0));
  let minimumApplied = false;
  if (total < BUSINESS.residentialMinimum) { total = BUSINESS.residentialMinimum; minimumApplied = true; notes.push(`The $${BUSINESS.residentialMinimum} residential minimum applies.`); }

  notes.push("Prices are Lupe's published starting prices before tax. Final price depends on the home's condition.");
  notes.push(`Pay at completion by card (${BUSINESS.cardFeePct}% processing fee), debit, ACH, Zelle, check or cash. No deposit for standard cleanings.`);

  const estimatedTeamHours = Math.max(1, Math.round((total / BUSINESS.hourlyRate) * 2) / 2);
  const perVisit = serviceId === "standard" && frequency !== "one_time";
  const name = NAMES[serviceId];

  return {
    serviceId, serviceName: name, frequency, lineItems, subtotal, discount, minimumApplied, total, perVisit,
    estimatedTeamHours, includedFree, serviceArea, notes,
    message: `${name}${frequency ? ` (${FREQ_LABEL[frequency]})` : ""}: $${total.toFixed(2)}${perVisit ? " per visit" : ""}. About ${estimatedTeamHours} team hours.`,
  };
}
