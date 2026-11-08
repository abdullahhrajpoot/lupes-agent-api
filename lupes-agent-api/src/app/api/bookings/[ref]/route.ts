import { store } from "@/lib/store";
import { prettyDate } from "@/lib/dates";
import { fail, handler, ok, options } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

export const GET = handler(async (_req, ctx: { params: Promise<{ ref: string }> }) => {
  const { ref } = await ctx.params;
  const b = await store.getBooking(ref.toUpperCase());
  if (!b) return fail("NOT_FOUND", `No booking found with reference ${ref}. Ask the customer to double-check it, or call the office.`, 404);
  return ok({
    booking: b,
    message: `Booking ${b.ref} is ${b.status}: ${b.serviceName}${b.date ? ` on ${prettyDate(b.date)}, arrival ${b.arrivalWindow}` : ""}.`,
  });
});
