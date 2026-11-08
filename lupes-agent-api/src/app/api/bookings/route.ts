import { z } from "zod";
import { BUSINESS, checkServiceArea } from "@/lib/business";
import { buildQuote, QuoteInput } from "@/lib/pricing";
import { reserve, SLOTS } from "@/lib/availability";
import { prettyDate } from "@/lib/dates";
import { store, type Booking } from "@/lib/store";
import { fail, handler, ok, options } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

const BookingInput = QuoteInput.extend({
  slot: z.enum(["morning", "midday", "afternoon"]).optional(),
  customerName: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  address: z.string().min(5).optional(),
  zip: z.string().min(5),
  notes: z.string().max(1000).optional(),
});

function newRef() {
  return `LHC-${Math.floor(1000 + Math.random() * 9000)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
}

export const POST = handler(async (req) => {
  const body = await req.json();
  // Accept a nested customer object too.
  if (body.customer && typeof body.customer === "object") {
    body.customerName ??= body.customer.name;
    body.phone ??= body.customer.phone;
    body.email ??= body.customer.email;
    body.address ??= body.customer.address;
    body.zip ??= body.customer.zip;
  }
  const input = BookingInput.parse(body);

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
    return ok({ booking: b, message: `Request ${ref} received. The office will call ${input.phone} with a custom quote, usually within one business day.` }, 201);
  }

  if (!input.date || !input.slot) return fail("MISSING_FIELD", "Pick a date and slot from /api/availability before booking.");

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

  return ok({
    booking: b,
    message:
      `Booked! Reference ${ref}. ${quote.serviceName} on ${prettyDate(input.date)}, team arrives ${slot.arrival}. ` +
      `Total $${quote.total.toFixed(2)}${quote.perVisit ? " per visit" : ""}, paid at completion. ` +
      `A confirmation and a reminder 2 days before will be sent. To change or cancel, give 24 hours' notice by calling ${BUSINESS.phone}.` +
      (b.status === "requested" ? " Because this address is near the edge of the service area, the office will confirm first." : ""),
  }, 201);
});
