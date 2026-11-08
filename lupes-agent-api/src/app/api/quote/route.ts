import { buildQuote, QuoteInput } from "@/lib/pricing";
import { handler, ok, options, parseList } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

export const GET = handler(async (req) => {
  const p = new URL(req.url).searchParams;
  const input = QuoteInput.parse({
    serviceId: p.get("serviceId") ?? undefined,
    sqft: p.get("sqft") ?? undefined,
    frequency: p.get("frequency") ?? undefined,
    hours: p.get("hours") ?? undefined,
    roomLevel: p.get("roomLevel") ?? undefined,
    rooms: parseList(p.get("rooms")),
    addOns: parseList(p.get("addOns")),
    zip: p.get("zip") ?? undefined,
    date: p.get("date") ?? undefined,
  });
  return ok(buildQuote(input));
});

export const POST = handler(async (req) => {
  const input = QuoteInput.parse(await req.json());
  return ok(buildQuote(input));
});
