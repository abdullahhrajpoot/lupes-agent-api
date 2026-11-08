import { checkServiceArea } from "@/lib/business";
import { fail, handler, ok, options } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

export const GET = handler(async (req) => {
  const zip = new URL(req.url).searchParams.get("zip");
  if (!zip) return fail("MISSING_FIELD", "Ask the customer for their 5-digit zip code.");
  return ok(checkServiceArea(zip));
});
