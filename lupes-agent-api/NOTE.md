# Note: Lupe's Cleaning booking agent

**Agent:** YOUR-AGENT-LINK
**API:** https://YOUR-APP.vercel.app (spec at `/openapi.json`)
**Code:** YOUR-GITHUB-LINK

## The business

Lupe's Home & Office Cleaning is a family-owned cleaning company in San Antonio. Their site has everything an agent needs to quote properly: a square-footage price table across 7 service and frequency combinations, 20+ add-ons, per-room prices, a $115 minimum, same-day and same-week promos, and a 23-mile service radius. Today customers either fill in a booking form or call. The agent replaces that with a two-minute conversation that ends in a priced, scheduled booking.

## How the pieces fit

```
Customer
   |
Agentplace agent (Luna)  <- system prompt: flow, rules, recommendation logic
   |  knowledge base: policies, FAQs, checklists
   |
   |  tool calls (HTTPS, JSON)
   v
Next.js API on Vercel
   ├── /api/service-area   zip -> in_area / confirm_with_office / out_of_area
   ├── /api/quote          published price table + add-ons + promos + minimum
   ├── /api/availability   crews per slot, Mon-Fri + limited Saturday, job length
   ├── /api/bookings       re-price, atomic slot reserve, reference number
   └── /api/bookings/:ref  status lookup
              |
        Upstash Redis (bookings + slot counters)
```

The split is deliberate. The model does what it's good at: understanding what the customer needs, recommending a service, collecting details naturally, and explaining. Anything that has to be exactly right lives in code: prices, discounts, minimums, which add-ons are already included, whether a slot is really free. The prompt tells the agent never to state a price or slot that didn't come from a tool.

## Decisions worth calling out

- **Server-side pricing from the real table.** Prices interpolate between Lupe's published square-footage tiers, add-ons already included in Deep and Move-In/Out are never charged twice, and the $115 minimum and promos are applied in one place. All of it is covered by unit tests.
- **The booking endpoint never trusts the client.** It recomputes the quote from the inputs, so a hallucinated or stale price can't end up on a booking.
- **Double booking protection.** Slots are reserved with an atomic Redis `INCR` against crew capacity and re-checked at booking time. The agent gets a `409 SLOT_UNAVAILABLE` with a message telling it to re-check and offer other times.
- **Job length affects availability.** The quote returns `estimatedTeamHours`, and availability only offers slots where the job can finish within the working day, so a 7-hour move-out doesn't get an afternoon slot.
- **Responses are written for an LLM.** Every response includes a `message` the agent can relay as-is, errors explain what to ask the customer next ("Ask for the approximate square footage"), and the OpenAPI descriptions say *when* to call each tool, not just what it does.
- **Edge-of-area zips don't get a hard no.** They come back as `confirm_with_office`, so the booking is created as `requested` instead of turning the customer away.

## What I'd change for production

1. **Real schedule.** Lupe's uses MaidCentral. I'd sync availability and bookings with it instead of the simulated crew schedule, using a webhook for changes made by the office.
2. **Payment at booking.** Their online form requires a card. I'd add a Stripe SetupIntent (card on file, charged at completion, matching their policy) and return a payment link the agent can show.
3. **Slot holds.** Hold a slot for ~10 minutes once offered, so two customers can't pick the same one mid-conversation.
4. **Idempotency keys** on `POST /bookings`, so a retried tool call never creates a duplicate booking.
5. **Geocoded service area.** Geocode the address and measure distance from downtown, instead of a zip allowlist.
6. **Confirmations.** SMS and email to the customer, plus a notification to the office (they already send reminders 2 days out).
7. **Multi-tenant.** Per-business API keys, price tables in a database with an admin UI, so the same service could power any cleaning company on Agentplace.
8. **Observability.** Structured logs exist (request id, path, status, latency). Next I'd trace each tool call with the conversation id, and track quote-to-booking conversion and the reasons bookings fail.

## Where I hit the platform's limits

FILL THIS IN WHILE BUILDING. For each item: what you needed, what happened, how you'd build it.

Things to check and note as you build:
- **Auth for custom APIs:** can you send an API key header, or only open URLs? (I made the key optional for this reason.)
- **Request formats:** does the tool builder support POST with a JSON body and nested arrays, or only GET query params? (The API supports both for quotes.)
- **Passing data between tools:** can the agent reliably reuse `estimatedTeamHours` from the quote in the availability call?
- **Structured UI:** can you render service cards, a quote breakdown or slot buttons, or is it text only?
- **Payments:** is there a native Stripe or checkout step?
- **Async events:** can the API push an update back into a conversation (e.g. "the office confirmed your booking")?
- **Testing:** is there a way to run test conversations automatically?

Example of how to write one:
> **Slot buttons.** I wanted open slots shown as tappable buttons. The agent could only return text, so customers have to type "Tuesday morning". On the platform side I'd let a tool response include a `choices` array that the chat UI renders as quick replies, and send the selected value back as the next user message.
