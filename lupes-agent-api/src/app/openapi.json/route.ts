import { NextResponse } from "next/server";
import { ADD_ONS, ROOMS } from "@/lib/business";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const serviceIds = ["standard", "deep", "move_in_out", "hourly", "by_room", "office", "post_construction"];
  const quoteProps = {
    serviceId: { type: "string", enum: serviceIds, description: "standard = general/recurring, deep, move_in_out, hourly, by_room. office and post_construction need a custom quote (create a booking request instead)." },
    sqft: { type: "integer", description: "Approximate square footage. Required for standard, deep, move_in_out and per-sq-ft add-ons." },
    frequency: { type: "string", enum: ["one_time", "weekly", "biweekly", "triweekly", "monthly"], description: "Only for serviceId=standard." },
    hours: { type: "number", description: "Team hours, only for serviceId=hourly." },
    roomLevel: { type: "string", enum: ["general", "deep"], description: "Only for by_room." },
    rooms: { type: "array", items: { type: "object", properties: { id: { type: "string", enum: ROOMS.map((r) => r.id) }, qty: { type: "integer" } }, required: ["id"] } },
    addOns: { type: "array", items: { type: "object", properties: { id: { type: "string", enum: ADD_ONS.map((a) => a.id) }, qty: { type: "number" } }, required: ["id"] } },
    zip: { type: "string", description: "5-digit zip. Checked against the service area." },
    date: { type: "string", format: "date", description: "Planned cleaning date (YYYY-MM-DD). Enables same-day / same-week discounts." },
  };
  const err = { description: "Error. Relay error.message to the customer in your own words.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Lupe's Home & Office Cleaning - Booking API",
      version: "1.0.0",
      description: "Tools for an AI booking agent: services, service-area check, instant quotes, crew availability and bookings for Lupe's Home & Office Cleaning in San Antonio, TX. Every response includes a human-readable `message` the agent can relay.",
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: { apiKey: { type: "apiKey", in: "header", name: "x-api-key" } },
      schemas: { Error: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } } } } },
    },
    paths: {
      "/api/services": {
        get: { operationId: "listServices", summary: "List services, add-ons and rooms", description: "Call when the customer asks what's offered or what's included, or before recommending a service.", responses: { "200": { description: "Service catalog" } } },
      },
      "/api/service-area": {
        get: {
          operationId: "checkServiceArea", summary: "Check if a zip is in the service area",
          description: "Call as soon as you have the customer's zip code. status is in_area, confirm_with_office or out_of_area.",
          parameters: [{ name: "zip", in: "query", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Area status" }, "400": err },
        },
      },
      "/api/quote": {
        get: {
          operationId: "getQuoteGet", summary: "Get an exact price quote (query params)",
          description: "Same as POST /api/quote. rooms and addOns as comma lists like 'kitchen:1,standard_bathroom:2' or 'oven_inside,windows_inside:10'.",
          parameters: Object.entries(quoteProps).map(([name, schema]) => ({ name, in: "query", required: name === "serviceId", schema: (schema as any).type === "array" ? { type: "string" } : schema })),
          responses: { "200": { description: "Quote" }, "400": err, "422": err },
        },
        post: {
          operationId: "getQuote", summary: "Get an exact price quote",
          description: "Call only after you know the service and its required details (sqft + frequency for standard, sqft for deep/move_in_out, hours for hourly, rooms for by_room) and ideally the zip. NEVER state a price that didn't come from this tool.",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: quoteProps, required: ["serviceId"] } } } },
          responses: { "200": { description: "Quote with line items, total and estimatedTeamHours" }, "400": err, "422": err },
        },
      },
      "/api/availability": {
        get: {
          operationId: "getAvailability", summary: "Open time slots",
          description: "Call after a quote. Pass teamHours = quote.estimatedTeamHours so long jobs only get slots that fit. Returns openSlots for `days` days starting at `date`. Offer up to 3.",
          parameters: [
            { name: "date", in: "query", schema: { type: "string", format: "date" }, description: "Start date (YYYY-MM-DD). Defaults to tomorrow." },
            { name: "days", in: "query", schema: { type: "integer", default: 4, maximum: 14 } },
            { name: "teamHours", in: "query", schema: { type: "number", default: 2 } },
          ],
          responses: { "200": { description: "Availability" }, "400": err },
        },
      },
      "/api/bookings": {
        post: {
          operationId: "createBooking", summary: "Create a booking",
          description: "Call only after the customer confirms the summary (service, price, date, slot) and you have their name, phone and zip (plus address and email if possible). Send the same quote fields used for /api/quote plus date and slot. The server recomputes the price. On 409 SLOT_UNAVAILABLE, re-check availability and offer other times.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: {
              type: "object",
              properties: {
                ...quoteProps,
                slot: { type: "string", enum: ["morning", "midday", "afternoon"] },
                customerName: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, address: { type: "string" },
                notes: { type: "string", description: "Access instructions, pets, priorities." },
              },
              required: ["serviceId", "customerName", "phone", "zip"],
            } } },
          },
          responses: { "201": { description: "Booking with reference number" }, "400": err, "409": err, "422": err },
        },
      },
      "/api/bookings/{ref}": {
        get: {
          operationId: "getBooking", summary: "Look up a booking",
          description: "Call when a customer asks about an existing booking and gives their reference (e.g. LHC-4821K).",
          parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Booking" }, "404": err },
        },
      },
    },
  };
  return NextResponse.json(spec, { headers: { "Access-Control-Allow-Origin": "*" } });
}
