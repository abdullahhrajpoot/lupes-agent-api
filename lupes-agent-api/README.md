# Lupe's Cleaning Booking API

The tool layer behind an Agentplace AI booking agent for [Lupe's Home & Office Cleaning](https://mylupeshousecleaning.co), a family-owned cleaning company in San Antonio, TX.

The agent (Agentplace, Luna model) handles the conversation. This Next.js API handles everything that has to be correct: pricing, service area, crew availability and bookings.

- **Live API:** https://YOUR-APP.vercel.app
- **OpenAPI spec:** https://YOUR-APP.vercel.app/openapi.json
- **Agent:** YOUR-AGENT-LINK
- **Design note:** [NOTE.md](./NOTE.md)

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/api/services` | Services, what's included, add-ons, rooms |
| GET | `/api/service-area?zip=78210` | `in_area`, `confirm_with_office` or `out_of_area` |
| GET/POST | `/api/quote` | Itemized quote from Lupe's published price table |
| GET | `/api/availability?date=&days=&teamHours=` | Open crew slots (Mon-Fri, limited Saturday) |
| POST | `/api/bookings` | Re-prices on the server, atomically reserves the slot, returns a reference |
| GET | `/api/bookings/:ref` | Booking status |
| GET | `/openapi.json` | OpenAPI 3.1 spec written for LLM tool use |

Every response has a plain-English `message` the agent can relay. Errors are always `{ "error": { "code", "message" } }` with real status codes (400, 404, 409, 422).

## Examples

```bash
B=https://YOUR-APP.vercel.app

curl "$B/api/quote?serviceId=deep&sqft=1800&zip=78209&addOns=oven_inside,fridge_full"

curl -X POST $B/api/quote -H 'content-type: application/json' \
  -d '{"serviceId":"standard","sqft":2500,"frequency":"biweekly","zip":"78258"}'

curl "$B/api/availability?teamHours=4"

curl -X POST $B/api/bookings -H 'content-type: application/json' -d '{
  "serviceId":"deep","sqft":1800,"zip":"78209","date":"2026-11-12","slot":"morning",
  "customerName":"Jane Doe","phone":"210-555-0101","email":"jane@example.com",
  "address":"123 Main St, San Antonio, TX","notes":"Friendly dog"
}'
```

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # pricing, service area and scheduling tests
```

## Environment variables (all optional)

| Var | Purpose |
|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis for persistent bookings (set automatically by the Vercel Upstash integration). Without them, bookings are stored in memory. |
| `API_KEY` | If set, requests need `x-api-key`, `Authorization: Bearer`, or `?key=`. |

## Stack

Next.js (App Router route handlers), TypeScript, zod, Upstash Redis REST, Vitest. No other runtime dependencies.
