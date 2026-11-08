# Note: Lupe's Cleaning booking agent

Links to the published agent and the live API are in my application email. The API's OpenAPI spec is served at `/openapi.json`.

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

I connected the API by describing it to the Builder in plain language (base URL, endpoints, parameters, example bodies). That worked: the agent called the quote endpoint and returned the exact interpolated price (move-out, 1,200 sq ft, $366), which confirms it used the API rather than guessing. These are the places I wanted more control:

1. **Tool definitions are generated, not declared.** The Builder turns my description into actions, but I couldn't find a place to review or edit the exact tool schema it produced (method, params, which response fields it reads), or to import the OpenAPI spec directly. For an engineer that makes changes hard to review, diff and version. *How I'd build it:* an "API actions" panel that accepts an OpenAPI URL, shows each generated operation as an editable schema, and stores it in version control alongside the agent's instructions.

2. **No test suite.** Testing is manual chats in Preview, and one conversation's state carries into the next question. In my run, an earlier out-of-area zip (78701) stayed in context and blocked the later "check my booking" test, which is correct agent behavior but makes regression testing slow and noisy. *How I'd build it:* saved test scenarios (scripted user turns + assertions like "called getQuote", "total equals tool output", "never states a price without a tool call"), each run in a fresh session, re-run on every publish.

3. **Secrets for custom APIs.** My API supports an API key, but I left it open because the only configuration surface was the Builder chat, and pasting a secret into a conversation isn't acceptable for production. *How I'd build it:* a per-agent secret store, referenced from tool definitions (`{{secrets.LUPES_API_KEY}}`) and injected server-side, never shown to the model.

4. **Tool-call observability (this one bit me).** In my first end-to-end test, quoting and availability worked, but the booking call came back without a reference and the agent (correctly) refused to retry and risk a duplicate. From the platform side I couldn't see the request the agent actually sent, so I couldn't tell whether it was the method, the body encoding, or the field names. I fixed it defensively on my side: the booking endpoint now accepts JSON, double-encoded JSON, form bodies and query params, unwraps common envelopes (`body`, `input`, `arguments`), maps snake_case and natural-language values ("Deep Cleaning", "Morning (7-9 AM)", "Tuesday, November 10, 2026"), logs only the *keys* of rejected payloads (never customer data), and also accepts GET as a fallback for tool runners that only issue GETs reliably. In production I'd keep POST-only plus an idempotency key, and the platform should make this unnecessary. When a quote looks wrong, I want to see the exact request the agent sent and the response it got. My API logs every call with a request id, but the platform side should show it too. *How I'd build it:* a per-conversation trace view listing each tool call with inputs, outputs, latency and errors, linked from the chat history.

5. **No way to push events back into a conversation.** If the office confirms an edge-of-area booking or a crew cancels, the API can't notify the customer through the agent. *How I'd build it:* a signed webhook endpoint per agent that appends a system event to the conversation and can trigger a follow-up message or notification.

6. **Payments mid-flow.** Lupe's requires a card to hold online bookings. The integration catalog includes Stripe, but a card-on-file step tied to my own booking API needs a custom checkout handoff. *How I'd build it:* my API returns a Stripe SetupIntent client secret with the booking, and the agent renders Agentplace's payment component with it, then confirms the booking on the success webhook.