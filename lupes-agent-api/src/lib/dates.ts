/** Today's date (YYYY-MM-DD) in a given IANA timezone. */
export function todayInTz(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Current hour (0-23) in a timezone. */
export function hourInTz(tz: string, now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now));
}

const toUtc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function addDays(d: string, n: number): string {
  return new Date(toUtc(d) + n * 86_400_000).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday */
export function dayOfWeek(d: string): number {
  return new Date(toUtc(d)).getUTCDay();
}

export function prettyDate(d: string): string {
  return new Date(toUtc(d)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}
