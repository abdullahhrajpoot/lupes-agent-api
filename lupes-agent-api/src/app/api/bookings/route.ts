import { z } from "zod";
import { BUSINESS, checkServiceArea } from "@/lib/business";
import { buildQuote, QuoteInput } from "@/lib/pricing";
import { reserve, SLOTS } from "@/lib/availability";
import { prettyDate } from "@/lib/dates";
import { store, type Booking } from "@/lib/store";
import { fail, handler, ok, options, parseList } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

const BookingInput = QuoteInput.extend({
  slot: z.enum(["morning", "midday", "afternoon"]).optional(),
  customerName: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().optional(),
  address: z.string().optional(),
  zip: z.string().min(5),
  notes: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Agent platforms send tool calls in many shapes: JSON, stringified JSON,
// form-encoded, query params, wrapped in {body:{...}} / {input:{...}},
// snake_case keys, "Deep Cleaning" instead of "deep", "Morning" instead of
// "morning", dates like "Tuesday, November 10, 2026". Normalize all of it here
// so the booking succeeds whenever the intent is clear.
// ---------------------------------------------------------------------------

async function readPayload(req: Request): Promise<Record<string, any>> {
  const fromQuery: Record<string, any> = Object.fromEntries(new URL(req.url).searchParams.entries());
  if (req.method === "GET") return fromQuery;

  const raw = (await req.text()).trim();
  let body: any = {};
  if (raw) {
    try {
      body = JSON.parse(raw);
      if (typeof body === "string") body = JSON.parse(body); // double-encoded JSON
    } catch {
      body = Object.fromEntries(new URLSearchParams(raw).entries()); // form-encoded
    }
  }
  // Unwrap common envelopes.
  for (const k of ["body", "data", "input", "params", "parameters", "arguments", "booking", "payload"]) {
    if (body && typeof body[k] === "object" && !Array.isArray(body[k])) body = { ...body, ...body[k] };
    if (body && typeof body[k] === "string" && body[k].trim().startsWith("{")) {
      try { body = { ...body, ...JSON.parse(body[k]) }; } catch {}
    }
  }
  return { ...fromQuery, ...(body && typeof body === "object" ? body : {}) };
}

const pick = (o: Record<string, any>, ...keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  return undefined;
};

function normService(v: any): string | undefined {
  if (!v) return undefined;
  const s = String(v).toLowerCase();
  if (s.includes("move")) return "move_in_out";
  if (s.includes("deep")) return "deep";
  if (s.includes("hour")) return "hourly";
  if (s.includes("room")) return "by_room";
  if (s.includes("office")) return "office";
  if (s.includes("construction") || s.includes("make")) return "post_construction";
  if (s.includes("standard") || s.includes("general") || s.includes("recurring") || s.includes("regular")) return "standard";
  return s;
}

function normFrequency(v: any): string | undefined {
  if (!v) return undefined;
  const s = String(v).toLowerCase().replace(/[\s-]/g, "");
  if (s.includes("triweekly") || s.includes("every3")) return "triweekly";
  if (s.includes("biweekly") || s.includes("every2") || s.includes("everyother")) return "biweekly";
  if (s.includes("weekly")) return "weekly";
  if (s.includes("month")) return "monthly";
  if (s.includes("one") || s.includes("once") || s.includes("single")) return "one_time";
  return s;
}

function normSlot(v: any): string | undefined {
  if (!v) return undefined;
  const s = String(v).toLowerCase();
  if (s.includes("morning") || /\b(7|8|9)(:00)?\s*am\b/.test(s)) return "morning";
  if (s.includes("afternoon") || /\b(1|2|3)(:00)?\s*pm\b/.test(s)) return "afternoon";
  if (s.includes("midday") || s.includes("mid-day") || s.includes("noon") || /\b(10|11)(:00)?\s*am\b/.test(s)) return "midday";
  return s;
}

function normDate(v: any): string | undefined {
  if (!v) return undefined;
  const s = String(v).trim();
  const iso = s.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const t = Date.parse(s.replace(/^[A-Za-z]+,\s*/, "")); // "Tuesday, November 10, 2026"
  if (!isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return s;
}

function normList(v: any) {
  if (v === undefined || v === null || v === "") return undefined;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? { id: x, qty: 1 } : x));
  if (typeof v === "string") return parseList(v);
  return undefined;
}

function normalize(p: Record<string, any>) {
  const c = typeof p.customer === "object" && p.customer ? p.customer : {};
  const address = pick(p, "address", "street_address", "streetAddress", "service_address") ?? pick(c, "address");
  let zip = pick(p, "zip", "zipCode", "zip_code", "postal_code", "postalCode") ?? pick(c, "zip", "zipCode");
  if (!zip && address) zip = String(address).match(/\b\d{5}\b/)?.[0];
  const email = pick(p, "email", "email_address", "emailAddress") ?? pick(c, "email");
  return {
    serviceId: normService(pick(p, "serviceId", "service_id", "service", "serviceType", "service_type")),
    sqft: pick(p, "sqft", "squareFeet", "square_feet", "square_footage", "squareFootage", "size"),
    frequency: normFrequency(pick(p, "frequency", "schedule")),
    hours: pick(p, "hours", "teamHours"),
    roomLevel: pick(p, "roomLevel", "room_level", "level"),
    rooms: normList(pick(p, "rooms")),
    addOns: normList(pick(p, "addOns", "add_ons", "addons", "extras")),
    zip: zip !== undefined ? String(zip) : undefined,
    date: normDate(pick(p, "date", "bookingDate", "booking_date", "appointmentDate", "appointment_date")),
    slot: normSlot(pick(p, "slot", "timeSlot", "time_slot", "time", "window", "arrivalWindow")),
    customerName: pick(p, "customerName", "customer_name", "name", "fullName", "full_name") ?? pick(c, "name", "fullName"),
    phone: pick(p, "phone", "phoneNumber", "phone_number", "mobile", "mobileNumber") ?? pick(c, "phone", "phoneNumber"),
    email: email && /\S+@\S+\.\S+/.test(String(email)) ? String(email) : undefined,
    address: address ? String(address) : undefined,
    notes: pick(p, "notes", "note", "accessNotes", "access_notes", "instructions", "pets") ?? undefined,
  };
}

function newRef() {
  return `LHC-${Math.floor(1000 + Math.random() * 9000)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
}

async function createBooking(req: Request) {
  const payload = await readPayload(req);
  const normalized = normalize(payload);
  const parsed = BookingInput.safeParse(normalized);
  if (!parsed.success) {
    // Log only the shape (keys), never customer values.
    console.log(JSON.stringify({ bookingRejected: true, receivedKeys: Object.keys(payload), issues: parsed.error.issues.map((i) => i.path.join(".")) }));
    const missing = parsed.error.issues.map((i) => i.path.join(".") || "body").join(", ");
    return fail("INVALID_INPUT", `Booking is missing or has invalid: ${missing}. Ask the customer for it, then try again with the same details.`, 400);
  }
  const input = parsed.data;

  const area = checkServiceArea(input.zip);
  if (area.status === "out_of_area") return fail("OUT_OF_AREA", area.message, 422);

  const customer = { name: input.customerName, phone: input.phone, email: input.email, address: input.address, zip: input.zip };
  const ref = newRef();

  // Custom-quote services become a request for the office to follow up.
  if (input.serviceId === "office" || input.serviceId === "post_construction") {
    const b: Booking = {
      ref, status: "requested", createdAt: new Date().toISOString(), serviceId: input.serviceId,
      serviceName: input.serviceId === "office" ? "Office Cleaning" : "Post-Construction / Make-Ready",
      date: input.date, slot: input.slot, customer, notes: input.notes,
    };
    await store.saveBooking(b);
    return ok({ ref, booking: b, message: `Request ${ref} received. The office will call ${input.phone} with a custom quote, usually within one business day.` }, 201);
  }

  if (!input.date || !input.slot) return fail("MISSING_FIELD", "Pick a date and slot (morning, midday or afternoon) from availability before booking.");

  // Never trust a client-side price: recompute on the server.
  const quote = buildQuote(input);
  const r = await reserve(input.date, input.slot, quote.estimatedTeamHours);
  if (!r.ok) return fail("SLOT_UNAVAILABLE", r.reason, 409);

  const slot = SLOTS.find((s) => s.id === input.slot)!;
  const b: Booking = {
    ref, status: area.status === "in_area" ? "confirmed" : "requested", createdAt: new Date().toISOString(),
    serviceId: input.serviceId, serviceName: quote.serviceName, date: input.date, slot: input.slot,
    arrivalWindow: slot.arrival, total: quote.total, perVisit: quote.perVisit, frequency: quote.frequency,
    customer, notes: input.notes, quote,
  };
  await store.saveBooking(b);
  console.log(JSON.stringify({ bookingCreated: ref, method: req.method }));

  return ok({
    ref,
    booking: b,
    message:
      `Booked! Reference ${ref}. ${quote.serviceName} on ${prettyDate(input.date)}, team arrives ${slot.arrival}. ` +
      `Total $${quote.total.toFixed(2)}${quote.perVisit ? " per visit" : ""}, paid at completion. ` +
      `A confirmation and a reminder 2 days before will be sent. To change or cancel, give 24 hours' notice by calling ${BUSINESS.phone}.` +
      (b.status === "requested" ? " Because this address is near the edge of the service area, the office will confirm first." : ""),
  }, 201);
}

// POST is the proper REST call. GET with query params is supported because some
// agent tool runners only issue GET requests reliably.
export const POST = handler(createBooking);
export const GET = handler(createBooking);