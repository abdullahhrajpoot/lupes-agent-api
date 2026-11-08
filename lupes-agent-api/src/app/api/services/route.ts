import { ADD_ONS, BUSINESS, ROOMS, SERVICES } from "@/lib/business";
import { handler, ok, options } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

export const GET = handler(async () =>
  ok({
    business: BUSINESS,
    services: SERVICES,
    addOns: ADD_ONS,
    rooms: ROOMS,
    message: `Lupe's offers ${SERVICES.length} services. Recommend one based on the customer's situation, then call /api/quote.`,
  }),
);
