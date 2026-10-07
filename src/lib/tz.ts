/**
 * Timezone helpers for platforms that key their schedule on a venue-local day.
 *
 * Bucketing sessions by `startsAt.slice(0, 10)` is wrong for every Australian
 * venue: an evening session in Sydney or Melbourne carries the *previous* UTC
 * date, so a naive slice splits every trading day in two. Eight of Navia Byron
 * Bay's 24 daily slots land on the day before in UTC.
 */

// Cache Intl.DateTimeFormat instances by timezone to avoid object instantiation overhead in loops.
const localDateKeyFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getLocalDateKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = localDateKeyFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    localDateKeyFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** The venue-local calendar date of `date`, as `YYYY-MM-DD`. */
export function localDateKey(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD, which is the shape we want without reassembly.
  return getLocalDateKeyFormatter(timeZone).format(date);
}

/**
 * Advance a `YYYY-MM-DD` calendar date by `days`.
 *
 * Pure calendar arithmetic on the date parts, deliberately not instant
 * arithmetic: adding 24 hours across a DST boundary lands on the same calendar
 * day twice or skips one, and these dates are only ever used as API query
 * parameters where the calendar date is what is meant.
 */
export function addLocalDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}
