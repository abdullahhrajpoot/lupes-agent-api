// Business data for Lupe's Home & Office Cleaning, LLC (San Antonio, TX).
// Source: mylupeshousecleaning.co pricing, FAQ and terms pages ("Prices last updated November 2026").
// Prices are the business's published starting prices, before tax.

export const BUSINESS = {
  name: "Lupe's Home & Office Cleaning",
  phone: "(210) 942-7242",
  email: "info@mylupeshousecleaning.co",
  address: "2618 South Presa St, San Antonio, TX 78210",
  website: "https://mylupeshousecleaning.co",
  timezone: "America/Chicago",
  residentialMinimum: 115,
  officeMinimum: 90,
  hourlyRate: 114, // per hour of a standard 3-person team
  cardFeePct: 2.2,
  serviceRadiusMiles: 23,
} as const;

export type Frequency = "one_time" | "weekly" | "biweekly" | "triweekly" | "monthly";
export const FREQUENCIES: Frequency[] = ["one_time", "weekly", "biweekly", "triweekly", "monthly"];

// Flat-rate package pricing by approximate square footage (published table).
export const SQFT_TIERS = [500, 1500, 2500, 3500, 4500, 5500, 6500, 7500] as const;
export const PRICE_TABLE: Record<"one_time" | "move_in_out" | "deep" | "weekly" | "biweekly" | "triweekly" | "monthly", number[]> = {
  one_time:    [138, 181, 224, 267, 310, 353, 395, 438],
  move_in_out: [267, 408, 549, 691, 832, 974, 1115, 1256],
  deep:        [284, 432, 580, 727, 875, 1022, 1170, 1317],
  weekly:      [115, 119, 149, 179, 210, 240, 271, 301],
  biweekly:    [115, 130, 163, 196, 230, 263, 296, 330],
  triweekly:   [115, 133, 167, 201, 235, 269, 303, 338],
  monthly:     [115, 136, 171, 206, 241, 276, 311, 346],
};

export type ServiceId = "standard" | "deep" | "move_in_out" | "hourly" | "by_room" | "office" | "post_construction";

export const SERVICES: {
  id: ServiceId;
  name: string;
  bestFor: string;
  includes: string[];
  notIncluded?: string[];
  pricing: string;
  needsForQuote: string[];
  instantQuote: boolean;
}[] = [
  {
    id: "standard",
    name: "General / Recurring Cleaning",
    bestFor: "Keeping a lived-in home clean. One-time or on a weekly, bi-weekly, tri-weekly or monthly schedule.",
    includes: [
      "Dust and wipe furniture, counters, window sills and inside the microwave",
      "Scrub tubs/showers, toilets, sinks, faucets and mirrors",
      "Clean floors and empty trash",
    ],
    notIncluded: ["Ceiling fans, baseboards, windows and blinds (add them individually, or book a Deep Clean)"],
    pricing: "Flat rate by square footage. One-time from $138; recurring from $115 per visit.",
    needsForQuote: ["sqft", "frequency", "zip"],
    instantQuote: true,
  },
  {
    id: "deep",
    name: "Deep Cleaning",
    bestFor: "First clean with Lupe's, buildup, before/after guests, or a reset every ~6 months.",
    includes: [
      "Everything in General Cleaning",
      "Air registers, ceiling fans, wall-mounted light fixtures, doors and trim",
      "Windows (inside), blinds and baseboards",
    ],
    pricing: "Flat rate by square footage, from $284.",
    needsForQuote: ["sqft", "zip"],
    instantQuote: true,
  },
  {
    id: "move_in_out",
    name: "Move-In / Move-Out Cleaning",
    bestFor: "Empty homes that need to be spotless for new occupants, landlords or deposit returns.",
    includes: [
      "Air registers, ceiling fans, light fixtures, doors, trim, windows, blinds and baseboards",
      "Inside microwave, oven, refrigerator, cabinets and drawers",
      "Tubs/showers, toilets, sinks, faucets, mirrors, counters and floors",
    ],
    pricing: "Flat rate by square footage, from $267.",
    needsForQuote: ["sqft", "zip"],
    instantQuote: true,
  },
  {
    id: "hourly",
    name: "By-the-Hour Cleaning",
    bestFor: "Customers who want to direct the team to specific priorities.",
    includes: ["A standard 3-person team for the hours you book, working on your priority list"],
    pricing: "$114 per team hour.",
    needsForQuote: ["hours", "zip"],
    instantQuote: true,
  },
  {
    id: "by_room",
    name: "By-the-Room Cleaning",
    bestFor: "Only a few rooms need attention.",
    includes: ["Pick the rooms you want cleaned at General or Deep level"],
    pricing: "Per room, e.g. Kitchen $34 general / $54 deep, Standard Bathroom $24 / $38.",
    needsForQuote: ["rooms", "zip"],
    instantQuote: true,
  },
  {
    id: "office",
    name: "Office Cleaning",
    bestFor: "Offices and small commercial spaces.",
    includes: ["Dust furniture, computer peripherals, counters, sills", "Scrub restrooms", "Floors and trash"],
    pricing: "Custom quote, $90 minimum per visit.",
    needsForQuote: ["contact details"],
    instantQuote: false,
  },
  {
    id: "post_construction",
    name: "Post-Construction / Make-Ready",
    bestFor: "After renovation or construction work.",
    includes: ["Quoted after the office reviews the job"],
    pricing: "Custom quote.",
    needsForQuote: ["contact details"],
    instantQuote: false,
  },
];

export type AddOnUnit = "per_sqft" | "each" | "flat" | "per_hour" | "per_load" | "per_room";
export const ADD_ONS: { id: string; name: string; price: number; unit: AddOnUnit }[] = [
  { id: "baseboard_cleaning", name: "Baseboard cleaning", price: 0.03, unit: "per_sqft" },
  { id: "baseboard_dusting", name: "Baseboard dusting", price: 0.02, unit: "per_sqft" },
  { id: "blind_cleaning", name: "Blind cleaning", price: 8, unit: "each" },
  { id: "blind_dusting", name: "Blind dusting only", price: 4, unit: "each" },
  { id: "carpet_shampoo", name: "Carpet shampoo", price: 35, unit: "per_room" },
  { id: "ceiling_fan_cleaning", name: "Ceiling fan cleaning", price: 8, unit: "each" },
  { id: "ceiling_fan_dusting", name: "Ceiling fan dusting only", price: 4, unit: "each" },
  { id: "door_exterior", name: "Exterior door cleaning", price: 9, unit: "each" },
  { id: "door_interior", name: "Interior door cleaning", price: 4, unit: "each" },
  { id: "floor_cleaning", name: "Floor cleaning", price: 0.07, unit: "per_sqft" },
  { id: "laundry_fold", name: "Laundry, fold and hang", price: 14, unit: "per_load" },
  { id: "laundry_wash_dry", name: "Laundry, wash and dry", price: 30, unit: "per_load" },
  { id: "organizing", name: "Organizing", price: 120, unit: "per_hour" },
  { id: "oven_inside", name: "Inside oven", price: 32, unit: "flat" },
  { id: "fridge_empty", name: "Inside refrigerator (empty)", price: 38, unit: "flat" },
  { id: "fridge_full", name: "Inside refrigerator (with contents)", price: 45, unit: "flat" },
  { id: "sliding_door", name: "Sliding glass door", price: 12, unit: "each" },
  { id: "storm_door", name: "Storm door", price: 12, unit: "each" },
  { id: "windows_inside", name: "Windows, inside", price: 4, unit: "each" },
  { id: "bed_linen", name: "Extra bed linen change", price: 6, unit: "each" },
  { id: "dishwashing", name: "Extra dishwashing (per sink load)", price: 14, unit: "each" },
];

// Add-ons already included at no charge in these services.
export const INCLUDED_ADD_ONS: Partial<Record<ServiceId, string[]>> = {
  deep: ["baseboard_cleaning", "baseboard_dusting", "blind_cleaning", "blind_dusting", "ceiling_fan_cleaning", "ceiling_fan_dusting", "windows_inside"],
  move_in_out: ["baseboard_cleaning", "baseboard_dusting", "blind_cleaning", "blind_dusting", "ceiling_fan_cleaning", "ceiling_fan_dusting", "windows_inside", "oven_inside", "fridge_empty"],
};

export const ROOMS: { id: string; name: string; general: number; deep: number }[] = [
  { id: "dining_area", name: "Dining Area", general: 30, deep: 48 },
  { id: "exercise_room", name: "Exercise Room", general: 24, deep: 38 },
  { id: "family_room", name: "Family Room", general: 36, deep: 58 },
  { id: "library", name: "Library", general: 30, deep: 48 },
  { id: "living_area", name: "Living Area", general: 36, deep: 58 },
  { id: "loft", name: "Loft", general: 30, deep: 48 },
  { id: "master_bedroom", name: "Master Bedroom", general: 36, deep: 58 },
  { id: "office", name: "Office", general: 36, deep: 58 },
  { id: "playroom", name: "Playroom", general: 36, deep: 58 },
  { id: "sitting_room", name: "Sitting Room", general: 24, deep: 38 },
  { id: "standard_bedroom", name: "Standard Bedroom", general: 30, deep: 48 },
  { id: "sunroom", name: "Sunroom", general: 30, deep: 48 },
  { id: "dinette", name: "Dinette", general: 24, deep: 38 },
  { id: "half_bathroom", name: "Half Bathroom", general: 8, deep: 13 },
  { id: "kitchen", name: "Kitchen", general: 34, deep: 54 },
  { id: "master_bathroom", name: "Master Bathroom", general: 36, deep: 58 },
  { id: "standard_bathroom", name: "Standard Bathroom", general: 24, deep: 38 },
];

// Service area: 23-mile radius from downtown San Antonio.
// Zips confirmed in-area vs. edge-of-radius zips the office should confirm.
// Production: geocode the address and compute distance from downtown instead.
const SA_CORE = [
  78201, 78202, 78203, 78204, 78205, 78206, 78207, 78208, 78209, 78210, 78211, 78212, 78213, 78214, 78215,
  78216, 78217, 78218, 78219, 78220, 78221, 78222, 78223, 78224, 78225, 78226, 78227, 78228, 78229, 78230,
  78231, 78232, 78233, 78234, 78235, 78236, 78237, 78238, 78239, 78240, 78242, 78244, 78245, 78247, 78248,
  78249, 78250, 78251, 78252, 78253, 78254, 78255, 78256, 78257, 78258, 78259, 78260, 78261, 78263, 78264, 78266,
];
const NEARBY_IN_AREA: Record<number, string> = {
  78023: "Helotes",
  78109: "Converse",
  78148: "Universal City",
  78150: "Randolph AFB",
  78154: "Schertz",
  78073: "Von Ormy",
  78112: "Elmendorf",
  78101: "Adkins",
  78152: "St. Hedwig",
  78054: "Kirby",
};
const EDGE_OF_AREA: Record<number, string> = {
  78015: "Fair Oaks Ranch",
  78108: "Cibolo",
  78124: "Marion",
  78132: "New Braunfels (south)",
  78002: "Atascosa",
  78069: "Somerset",
  78052: "Lytle",
  78056: "Mico",
  78006: "Boerne",
  78130: "New Braunfels",
};

export type AreaStatus = "in_area" | "confirm_with_office" | "out_of_area";
export function checkServiceArea(zip: string): { zip: string; status: AreaStatus; place?: string; message: string } {
  const z = Number(String(zip).trim().slice(0, 5));
  if (!/^\d{5}$/.test(String(zip).trim().slice(0, 5))) {
    return { zip, status: "out_of_area", message: "That doesn't look like a valid 5-digit US zip code." };
  }
  if (SA_CORE.includes(z)) return { zip: String(z), status: "in_area", place: "San Antonio", message: "Great news, this address is in Lupe's service area." };
  if (NEARBY_IN_AREA[z]) return { zip: String(z), status: "in_area", place: NEARBY_IN_AREA[z], message: `Great news, ${NEARBY_IN_AREA[z]} is in Lupe's service area.` };
  if (EDGE_OF_AREA[z]) return {
    zip: String(z), status: "confirm_with_office", place: EDGE_OF_AREA[z],
    message: `${EDGE_OF_AREA[z]} is near the edge of the 23-mile service radius. The office will confirm, and you can still request a booking.`,
  };
  return { zip: String(z), status: "out_of_area", message: `Sorry, that zip is outside Lupe's service area (23 miles from downtown San Antonio). Call ${BUSINESS.phone} if you think this is a mistake.` };
}
