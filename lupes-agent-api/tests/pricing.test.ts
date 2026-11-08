import { describe, expect, it } from "vitest";
import { buildQuote, priceForSqft } from "@/lib/pricing";
import { checkServiceArea } from "@/lib/business";
import { capacityFor, seededLoad, slotFitsDuration } from "@/lib/availability";

const NOW = new Date("2026-11-09T15:00:00Z"); // Monday 9am Central

describe("pricing", () => {
  it("matches the published table at tier points", () => {
    expect(priceForSqft("one_time", 1500)).toBe(181);
    expect(priceForSqft("deep", 2500)).toBe(580);
    expect(priceForSqft("move_in_out", 7500)).toBe(1256);
  });
  it("interpolates between tiers", () => {
    expect(priceForSqft("one_time", 2000)).toBe(203); // halfway 181..224
  });
  it("requires a custom quote above 7,500 sq ft", () => {
    expect(() => priceForSqft("deep", 9000)).toThrow(/custom quote/);
  });
  it("applies the $115 minimum", () => {
    const q = buildQuote({ serviceId: "by_room", rooms: [{ id: "half_bathroom", qty: 1 }] }, NOW);
    expect(q.total).toBe(115);
    expect(q.minimumApplied).toBe(true);
  });
  it("does not charge for add-ons included in a deep clean", () => {
    const q = buildQuote({ serviceId: "deep", sqft: 1500, addOns: [{ id: "ceiling_fan_cleaning", qty: 4 }, { id: "oven_inside", qty: 1 }] }, NOW);
    expect(q.total).toBe(432 + 32);
    expect(q.includedFree).toContain("Ceiling fan cleaning");
  });
  it("prices per-sq-ft add-ons", () => {
    const q = buildQuote({ serviceId: "standard", sqft: 2500, frequency: "biweekly", addOns: [{ id: "baseboard_cleaning", qty: 1 }] }, NOW);
    expect(q.total).toBe(163 + 75);
    expect(q.perVisit).toBe(true);
  });
  it("applies same-week discount", () => {
    const q = buildQuote({ serviceId: "deep", sqft: 2500, date: "2026-11-12" }, NOW);
    expect(q.discount?.amount).toBe(29);
    expect(q.total).toBe(551);
  });
  it("rejects out-of-area zips", () => {
    expect(() => buildQuote({ serviceId: "deep", sqft: 1500, zip: "78701" }, NOW)).toThrow(/outside/);
  });
});

describe("service area", () => {
  it("classifies zips", () => {
    expect(checkServiceArea("78210").status).toBe("in_area");
    expect(checkServiceArea("78023").status).toBe("in_area");
    expect(checkServiceArea("78006").status).toBe("confirm_with_office");
    expect(checkServiceArea("10001").status).toBe("out_of_area");
  });
});

describe("availability", () => {
  it("closes Sundays and limits Saturdays", () => {
    expect(capacityFor("2026-11-15", "morning")).toBe(0); // Sunday
    expect(capacityFor("2026-11-14", "morning")).toBe(1); // Saturday
    expect(capacityFor("2026-11-14", "afternoon")).toBe(0);
  });
  it("seeded load is deterministic and within capacity", () => {
    const a = seededLoad("2026-11-10", "morning");
    expect(seededLoad("2026-11-10", "morning")).toBe(a);
    expect(a).toBeLessThanOrEqual(4);
  });
  it("long jobs only fit early slots", () => {
    expect(slotFitsDuration("afternoon", 6)).toBe(false);
    expect(slotFitsDuration("morning", 9)).toBe(true);
  });
});
