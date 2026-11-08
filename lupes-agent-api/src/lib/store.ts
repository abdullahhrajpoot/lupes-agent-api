// Storage: Upstash Redis (REST) when configured, otherwise in-memory.
// On Vercel, add the "Upstash for Redis" integration and it sets KV_REST_API_URL / KV_REST_API_TOKEN.
// In-memory works for demos but resets on cold starts and isn't shared across instances.

export type Booking = {
  ref: string;
  status: "requested" | "confirmed" | "cancelled";
  createdAt: string;
  serviceId: string;
  serviceName: string;
  date?: string;
  slot?: string;
  arrivalWindow?: string;
  total?: number;
  perVisit?: boolean;
  frequency?: string;
  customer: { name: string; phone: string; email?: string; address?: string; zip?: string };
  notes?: string;
  quote?: unknown;
};

interface Store {
  getBooking(ref: string): Promise<Booking | null>;
  saveBooking(b: Booking): Promise<void>;
  /** Atomically reserve one crew for a slot. Returns false if full. */
  reserveSlot(key: string, capacity: number): Promise<boolean>;
  slotCount(key: string): Promise<number>;
  driver: string;
}

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis<T = unknown>(cmd: (string | number)[]): Promise<T> {
  const res = await fetch(url!, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  return ((await res.json()) as { result: T }).result;
}

const redisStore: Store = {
  driver: "upstash-redis",
  async getBooking(ref) {
    const v = await redis<string | null>(["GET", `booking:${ref}`]);
    return v ? (JSON.parse(v) as Booking) : null;
  },
  async saveBooking(b) {
    await redis(["SET", `booking:${b.ref}`, JSON.stringify(b)]);
  },
  async reserveSlot(key, capacity) {
    const n = await redis<number>(["INCR", `slot:${key}`]);
    await redis(["EXPIRE", `slot:${key}`, 60 * 60 * 24 * 60]);
    if (n > capacity) { await redis(["DECR", `slot:${key}`]); return false; }
    return true;
  },
  async slotCount(key) {
    return Number((await redis<string | null>(["GET", `slot:${key}`])) ?? 0);
  },
};

const g = globalThis as unknown as { __mem?: { bookings: Map<string, Booking>; slots: Map<string, number> } };
g.__mem ??= { bookings: new Map(), slots: new Map() };
const mem = g.__mem;

const memoryStore: Store = {
  driver: "memory",
  async getBooking(ref) { return mem.bookings.get(ref) ?? null; },
  async saveBooking(b) { mem.bookings.set(b.ref, b); },
  async reserveSlot(key, capacity) {
    const n = mem.slots.get(key) ?? 0;
    if (n >= capacity) return false;
    mem.slots.set(key, n + 1);
    return true;
  },
  async slotCount(key) { return mem.slots.get(key) ?? 0; },
};

export const store: Store = url && token ? redisStore : memoryStore;
