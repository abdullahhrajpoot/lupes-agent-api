const endpoints = [
  ["GET", "/api/services", "Service catalog, add-ons, rooms"],
  ["GET", "/api/service-area?zip=78210", "Is this zip in the 23-mile service radius?"],
  ["GET", "/api/quote?serviceId=deep&sqft=1800&zip=78209", "Instant itemized quote (also POST JSON)"],
  ["GET", "/api/availability?teamHours=4", "Open crew slots, next 4 days"],
  ["POST", "/api/bookings", "Create a booking (server re-prices and re-checks the slot)"],
  ["GET", "/api/bookings/LHC-1234A", "Booking status lookup"],
  ["GET", "/openapi.json", "OpenAPI 3.1 spec for agent tool import"],
];

export default function Home() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "56px 24px" }}>
      <p style={{ letterSpacing: 2, fontSize: 12, color: "#6b4fa0", fontWeight: 700, margin: 0 }}>AGENTPLACE TEST TASK</p>
      <h1 style={{ fontSize: 36, margin: "10px 0 8px" }}>Lupe's Cleaning Booking API</h1>
      <p style={{ fontSize: 17, lineHeight: 1.6, color: "#4a4060" }}>
        The tool layer behind an AI booking agent for{" "}
        <a href="https://mylupeshousecleaning.co" style={{ color: "#6b4fa0" }}>Lupe's Home &amp; Office Cleaning</a>, San Antonio, TX.
        Pricing, service area, crew scheduling and bookings live here, so the model never invents a price or a time slot.
      </p>
      <div style={{ marginTop: 32, border: "1px solid #e6def2", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
        {endpoints.map(([m, path, desc]) => (
          <div key={path} style={{ display: "flex", gap: 16, padding: "14px 18px", borderTop: "1px solid #f0eaf8", alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: m === "GET" ? "#2f7d4f" : "#b45309", width: 40 }}>{m}</span>
            {m === "GET" ? <a href={path} style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, color: "#1d1530" }}>{path}</a>
              : <code style={{ fontSize: 14 }}>{path}</code>}
            <span style={{ color: "#6b6380", fontSize: 14 }}>{desc}</span>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 28, fontSize: 13, color: "#8a82a0" }}>Built with Next.js, TypeScript and zod. Prices from Lupe's published pricing page.</p>
    </main>
  );
}
