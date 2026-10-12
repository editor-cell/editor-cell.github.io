/** Small rules of the members pages, kept apart from the pages so they can be tested. */

/** Only a path on this site, never another site, may be the way back after signing in. */
export function safeBack(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}

/** The new end of a paid membership: added on to what is left, or counted from now. */
export function extendPaid(current: string | null, months: number, now = new Date()): string {
  const start = current && new Date(current) > now ? new Date(current) : new Date(now);
  // Counted in UTC, so a clock change between now and then cannot shift the hour.
  start.setUTCMonth(start.getUTCMonth() + months);
  return start.toISOString();
}
