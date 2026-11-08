import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { QuoteError } from "./pricing";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
};

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS });
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status, headers: CORS });
}

export function options() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Optional API key. If API_KEY is set, require it via x-api-key header, Bearer token, or ?key= */
export function checkAuth(req: Request): Response | null {
  const key = process.env.API_KEY;
  if (!key) return null;
  const u = new URL(req.url);
  const given = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || u.searchParams.get("key");
  return given === key ? null : fail("UNAUTHORIZED", "Missing or invalid API key.", 401);
}

/** Wraps a handler with auth, request id logging and consistent error handling. */
export function handler(fn: (req: Request, ctx: any) => Promise<Response>) {
  return async (req: Request, ctx: any) => {
    const id = crypto.randomUUID().slice(0, 8);
    const t0 = Date.now();
    let res: Response;
    try {
      res = checkAuth(req) ?? (await fn(req, ctx));
    } catch (e) {
      if (e instanceof QuoteError) res = fail(e.code, e.message, e.status);
      else if (e instanceof ZodError) {
        const msg = e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
        res = fail("INVALID_INPUT", msg, 400);
      } else if (e instanceof SyntaxError) res = fail("INVALID_JSON", "Request body must be valid JSON.", 400);
      else {
        console.error(`[${id}]`, e);
        res = fail("INTERNAL", "Something went wrong on our side. Offer to take the customer's details so the office can call them back.", 500);
      }
    }
    console.log(JSON.stringify({ id, method: req.method, path: new URL(req.url).pathname, status: res.status, ms: Date.now() - t0 }));
    res.headers.set("x-request-id", id);
    return res;
  };
}

/** Parse an array param from query string: "a,b" or "a:2,b:1" or JSON. */
export function parseList(v: string | null): { id: string; qty: number }[] | undefined {
  if (!v) return undefined;
  const t = v.trim();
  if (t.startsWith("[")) return JSON.parse(t);
  return t.split(",").filter(Boolean).map((p) => {
    const [id, q] = p.split(":");
    return { id: id.trim(), qty: q ? Number(q) : 1 };
  });
}
