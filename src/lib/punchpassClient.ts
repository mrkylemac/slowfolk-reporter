/**
 * Punchpass client — scrapes the public schedule at {tenant}.punchpass.com/classes.
 *
 * Punchpass has no JSON API. Every variant 406s (`.json`, `?format=json`,
 * per-instance `.json`) and `/api/classes` 404s, so the schedule HTML is the
 * only surface. It is stable, server-rendered Foundation/Stimulus markup.
 *
 * Data model — three things make this platform unlike the others we integrate:
 *
 * 1. **Capacity is never published.** The badge reads "N SPOTS LEFT", which is
 *    *remaining*, not total. Total capacity is recovered from a far-future
 *    oracle: Punchpass publishes recurring series months ahead while the real
 *    booking window is days, so a far-future occurrence is unbooked and its
 *    badge equals capacity. Verified against four independent windows spanning
 *    Oct 2026 → Feb 2027: 27 courses, every one with a single stable value, and
 *    164 (course, weekday, time) keys with zero variance.
 *
 * 2. **The badge dies at session START, not end of day.** Once a session begins
 *    the badge disappears, so the last read before it starts is the only chance
 *    to capture true utilisation. Any session first seen after it began has an
 *    unknowable booking count and is emitted with `utilisationKnown: false`
 *    rather than a zero. `mergeWithCached` below always prefers a cached
 *    observation over a fresh unknown — that is the single most important rule
 *    in this file.
 *
 * 3. **History is deep but denominator-only.** Back-paging `from_time` returns
 *    a year of past instances, but historical rows carry no badge at all. They
 *    are genuinely useful for sessions-per-week, opening hours and cancellation
 *    rate, and genuinely useless for utilisation. Same `utilisationKnown: false`
 *    treatment.
 *
 * Roughly 8.9% of near-term rows sit on one-off course ids that never recur, so
 * the oracle never learns their capacity. Those emit capacity 0. Do not try to
 * infer their capacity from the session name: measured against the far-future
 * data, one name ("Regular Session with INFUSION") maps to capacities 7, 9 and
 * 15 while its one-off variants run to 20 spots, so a name-based fallback would
 * be confidently wrong.
 */

import type { MomenceSession } from '@/types/momence';
import type { PunchpassConfig } from '@/config/api';

// ── Constants ────────────────────────────────────────────────────────────────

/** Each /classes response covers a fixed 20-day window from `from_time`. */
const WINDOW_DAYS = 20;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── Parsed row ───────────────────────────────────────────────────────────────

export interface PunchpassRow {
  /** Local calendar date from the day anchor, YYYY-MM-DD. */
  date: string;
  /** Local start time as rendered, e.g. "7:00" or "16:30". */
  time: string;
  /** Recurring series id. The capacity oracle is keyed on this. */
  courseId: string;
  /** Per-occurrence instance id from data-url. Absent on cancelled rows. */
  instanceId: string | null;
  name: string;
  /** Punchpass overloads data-location with the session type, not a place. */
  sessionType: string;
  durationMinutes: number;
  /** Remaining spots. null when no badge was rendered (elapsed, or historical). */
  spotsLeft: number | null;
  cancelled: boolean;
}

// ── HTML parsing ─────────────────────────────────────────────────────────────

const DAY_ANCHOR = /<a id="(\d{4}-\d{2}-\d{2})"><\/a>/g;

const INSTANCE =
  /<div class="schedule__instance instance"(.*?)(?=<div class="schedule__instance instance"|<a id="\d{4}-\d{2}-\d{2}"><\/a>|$)/gs;

/**
 * Strip inline SVG and its XML prologue. They are ~90% of the payload and their
 * `<style>` blocks contain braces and quotes that confuse attribute matching.
 */
function stripNoise(html: string): string {
  return html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<\?xml[^>]*\?>/g, '');
}

function pick(block: string, re: RegExp): string | null {
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

/**
 * "2 hours" / "90 minutes" / "1 hour 30 minutes" → minutes.
 * Returns null when unparseable so the caller can fall back to config.
 */
export function parseDuration(text: string | null): number | null {
  if (!text) return null;
  const h = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  const m = text.match(/(\d+)\s*(?:minutes?|mins?)\b/i);
  if (!h && !m) return null;
  return Math.round((h ? parseFloat(h[1]) * 60 : 0) + (m ? parseInt(m[1], 10) : 0));
}

/**
 * Read the availability badge. Scoped to the gray/alert label classes that
 * carry availability — the orange TODAY/TOMORROW labels are day headers, not
 * instance state, and must never be read as availability.
 */
function parseSpots(block: string): number | null {
  const badge = pick(block, /<span class="(?:gray|alert)[^"]*label">\s*([^<]+?)\s*<\/span>/);
  if (!badge) return null;
  const left = badge.match(/^(\d+)\s+SPOTS?\s+LEFT$/i);
  if (left) return parseInt(left[1], 10);
  if (/^CLASS FULL$/i.test(badge)) return 0;
  return null;
}

/** Parse one schedule page into rows. Exported for tests against fixtures. */
export function parseSchedulePage(html: string): PunchpassRow[] {
  const doc = stripNoise(html);

  // Locate day anchors so each instance can inherit its calendar date.
  const days: { pos: number; date: string }[] = [];
  for (const m of doc.matchAll(DAY_ANCHOR)) {
    days.push({ pos: m.index!, date: m[1] });
  }

  const rows: PunchpassRow[] = [];
  for (let i = 0; i < days.length; i++) {
    const start = days[i].pos;
    const end = i + 1 < days.length ? days[i + 1].pos : doc.length;
    const segment = doc.slice(start, end);

    for (const m of segment.matchAll(INSTANCE)) {
      const block = m[1];
      const courseId = pick(block, /data-course-id="(\d+)"/);
      const time = pick(block, /class="schedule__instance__time">\s*([^<]+?)\s*</);
      if (!courseId || !time) continue;

      const url = pick(block, /data-url="([^"]+)"/);
      rows.push({
        date: days[i].date,
        time,
        courseId,
        instanceId: url ? (url.match(/\/classes\/(\d+)/)?.[1] ?? null) : null,
        name:
          pick(block, /class="schedule__instance__link"><a [^>]*>([^<]*)</) ??
          pick(block, /data-location="([^"]*)"/) ??
          'Session',
        sessionType: pick(block, /data-location="([^"]*)"/) ?? '',
        durationMinutes: parseDuration(pick(block, /class="schedule__instance__length">\s*([^<]+?)\s*</)) ?? 0,
        spotsLeft: parseSpots(block),
        cancelled: /label">\s*CANCELLED/i.test(block),
      });
    }
  }
  return rows;
}

// ── Timezone ─────────────────────────────────────────────────────────────────

// Optimization: Cache Intl.DateTimeFormat instances by timezone to avoid costly
// re-instantiation inside parsing loops across hundreds/thousands of Punchpass rows.
const zoneOffsetFormatterCache = new Map<string, Intl.DateTimeFormat>();
const localPartsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getZoneOffsetFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = zoneOffsetFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    zoneOffsetFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function getLocalPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = localPartsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit',
    });
    localPartsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** Offset of `timeZone` from UTC at `date`, in milliseconds. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZoneOffsetFormatter(timeZone).formatToParts(date);

  const get = (type: string) => Number(parts.find(p => p.type === type)!.value);
  const asIfUtc = Date.UTC(
    get('year'), get('month') - 1, get('day'),
    get('hour') % 24, get('minute'), get('second'),
  );
  return asIfUtc - date.getTime();
}

/**
 * Convert a venue-local wall clock to a real UTC instant.
 *
 * Punchpass renders a bare local date and time with no offset, and Blue
 * Mountains sits in Australia/Sydney which observes DST, so a fixed +10 would
 * be an hour out for roughly half the year. The offset is resolved twice
 * because the first lookup uses an instant that may fall on the wrong side of a
 * DST boundary.
 */
export function localToUtc(date: string, time: string, timeZone: string): Date {
  const [h, min] = time.split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, min ?? 0, 0);

  let offset = zoneOffsetMs(new Date(naive), timeZone);
  const second = zoneOffsetMs(new Date(naive - offset), timeZone);
  if (second !== offset) offset = second;

  return new Date(naive - offset);
}

// ── Pricing ──────────────────────────────────────────────────────────────────

/**
 * Blue Mountains publishes its rule on /passes:
 *   Off-peak: Monday–Friday 7am–9pm, and weekends 7am–10am
 *   Peak:     weekends from 10am, and public holidays
 *
 * Public holidays are not applied — deriving the NSW holiday calendar is out of
 * scope, so a handful of holiday sessions are priced off-peak. That understates
 * revenue slightly rather than overstating it.
 */
export function priceFor(startLocal: { weekday: number; hour: number }, cfg: PunchpassConfig): number {
  const isWeekend = startLocal.weekday === 0 || startLocal.weekday === 6;
  const isPeak = isWeekend && startLocal.hour >= 10;
  return isPeak ? cfg.pricing.peak : cfg.pricing.offPeak;
}

/** Venue-local weekday (0=Sun) and decimal hour for a UTC instant. */
function localParts(instant: Date, timeZone: string): { weekday: number; hour: number } {
  const parts = getLocalPartsFormatter(timeZone).formatToParts(instant);
  const val = (t: string) => parts.find(p => p.type === t)!.value;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    weekday: days.indexOf(val('weekday')),
    hour: Number(val('hour')) % 24 + Number(val('minute')) / 60,
  };
}

// ── Capacity oracle ──────────────────────────────────────────────────────────

export type CapacityOracle = Map<string, number>;

/**
 * The oracle persisted between polls, alongside the session cache.
 *
 * Capacity is the denominator of every utilisation figure this venue produces
 * and it is derived rather than published, so it is written to its own file
 * where it can be read and sanity-checked by a human rather than buried in
 * 2,000 sessions.
 */
export interface PersistedOracle {
  refreshedAt: string;
  /** courseId → capacity. */
  capacities: Record<string, number>;
  /** Days ahead sampled on the last refresh, for provenance. */
  sampledDaysAhead: number[];
}

export function oracleToPersisted(oracle: CapacityOracle, sampledDaysAhead: number[]): PersistedOracle {
  return {
    refreshedAt: new Date().toISOString(),
    capacities: Object.fromEntries([...oracle.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    sampledDaysAhead,
  };
}

export function persistedToOracle(p: PersistedOracle | null | undefined): CapacityOracle {
  return new Map(Object.entries(p?.capacities ?? {}));
}

/**
 * Build courseId → capacity from far-future rows.
 *
 * Takes the maximum ever observed, never the first. A first observation can be
 * of an already partly-booked session, and an understated capacity overstates
 * utilisation permanently without ever self-correcting.
 */
export function buildCapacityOracle(rows: PunchpassRow[], existing?: CapacityOracle): CapacityOracle {
  const oracle: CapacityOracle = new Map(existing ?? []);
  for (const r of rows) {
    if (r.cancelled || r.spotsLeft === null) continue;
    const prev = oracle.get(r.courseId);
    if (prev === undefined || r.spotsLeft > prev) oracle.set(r.courseId, r.spotsLeft);
  }
  return oracle;
}

// ── Mapping ──────────────────────────────────────────────────────────────────

function toSession(row: PunchpassRow, oracle: CapacityOracle, cfg: PunchpassConfig): MomenceSession {
  const start = localToUtc(row.date, row.time, cfg.timezone);
  const duration = row.durationMinutes || cfg.defaultDurationMinutes;
  const end = new Date(start.getTime() + duration * 60_000);

  const capacity = oracle.get(row.courseId) ?? 0;
  // A live badge is the only source of truth for bookings. No badge means the
  // session has already started (Punchpass drops the badge at start) or the row
  // came from back-paged history, and in both cases the count is unknowable.
  const observed = row.spotsLeft !== null && capacity > 0;

  // If remaining ever exceeds the stored capacity the oracle is stale — the
  // venue has raised capacity. Trust the live reading and let the next oracle
  // refresh catch up, rather than emitting a negative ticketsSold.
  const effectiveCapacity = observed ? Math.max(capacity, row.spotsLeft!) : capacity;

  return {
    id: row.instanceId
      ? `punchpass-${row.instanceId}`
      : `punchpass-${row.courseId}-${row.date}-${row.time.replace(':', '')}`,
    sessionName: row.name,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    durationMinutes: duration,
    capacity: effectiveCapacity,
    ticketsSold: observed ? effectiveCapacity - row.spotsLeft! : 0,
    fixedTicketPrice: priceFor(localParts(start, cfg.timezone), cfg),
    location: cfg.location,
    inPerson: true,
    ...(row.cancelled ? { isCancelled: true } : {}),
    ...(observed ? {} : { utilisationKnown: false as const }),
  };
}

// ── Fetching ─────────────────────────────────────────────────────────────────

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchWindow(cfg: PunchpassConfig, from: Date): Promise<PunchpassRow[]> {
  // from_time wants a local wall clock; the trailing offset is only a hint and
  // the day anchors in the response are authoritative, so a nominal one is fine.
  const url = `${cfg.baseUrl}/classes?from_time=${ymd(from)}+00:00:00`;
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
  });
  if (!res.ok) throw new Error(`Punchpass ${res.status} ${res.statusText} for ${url}`);
  return parseSchedulePage(await res.text());
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

export interface PunchpassFetchOptions {
  onProgress?: (count: number) => void;
  /** Oracle persisted by a previous poll. Skips the probes while still fresh. */
  cachedOracle?: PersistedOracle | null;
  /** Receives the oracle actually used, so the caller can persist it. */
  onOracle?: (oracle: PersistedOracle) => void;
  /** Force the far-future probes and back-history pass regardless of age. */
  forceDeepRefresh?: boolean;
}

/**
 * Fetch Punchpass sessions and merge with cached history.
 *
 * Three passes, deliberately on two different cadences:
 *
 *   1. Oracle  — far-future windows, unbooked, to learn capacity per course.
 *   2. Forward — today onward, the live booking window. The only data that ever
 *                carries real utilisation.
 *   3. Back    — historical windows for schedule and cancellation history.
 *                Denominator-only; never carries utilisation.
 *
 * Passes 1 and 3 only need running occasionally: capacity changes rarely, and a
 * past schedule is fixed once it has happened. Pass 2 has to run before every
 * session start or its utilisation is lost forever. Splitting them keeps the
 * steady-state poll at three requests instead of nine, which matters when the
 * cadence is every 30 minutes against a small vendor's server.
 */
export async function fetchAllPunchpassSessions(
  cfg: PunchpassConfig,
  existingSessions: MomenceSession[],
  options: PunchpassFetchOptions = {},
): Promise<MomenceSession[]> {
  const { onProgress, cachedOracle, onOracle, forceDeepRefresh } = options;
  const today = new Date();

  const oracleAgeHours = cachedOracle
    ? (today.getTime() - new Date(cachedOracle.refreshedAt).getTime()) / 3_600_000
    : Infinity;
  const deepRefresh = forceDeepRefresh || oracleAgeHours >= cfg.deepRefreshHours;

  // ── 1. Oracle ──
  let oracle = persistedToOracle(cachedOracle);
  if (deepRefresh) {
    for (const daysAhead of cfg.oracleProbeDaysAhead) {
      try {
        const rows = await fetchWindow(cfg, addDays(today, daysAhead));
        oracle = buildCapacityOracle(rows, oracle);
      } catch (err) {
        console.warn(`[Punchpass] Oracle probe +${daysAhead}d failed: ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log(`[Punchpass] Capacity oracle refreshed: ${oracle.size} courses`);
    onOracle?.(oracleToPersisted(oracle, cfg.oracleProbeDaysAhead));
  } else {
    console.log(
      `[Punchpass] Reusing cached oracle: ${oracle.size} courses ` +
      `(${oracleAgeHours.toFixed(1)}h old, refreshes at ${cfg.deepRefreshHours}h)`,
    );
  }

  if (oracle.size === 0) {
    // Without an oracle every session would be capacity 0 and the poll would
    // write a file whose utilisation silently reads as nothing. Fail loudly.
    throw new Error('Punchpass capacity oracle is empty — refusing to write a cache with no capacity data');
  }

  // ── 2 & 3. Forward and back windows ──
  const collected: PunchpassRow[] = [];
  const windows: Date[] = [];
  for (let i = 0; i < cfg.forwardWindows; i++) windows.push(addDays(today, i * WINDOW_DAYS));
  if (deepRefresh) {
    for (let i = 1; i <= cfg.backWindows; i++) windows.push(addDays(today, -i * WINDOW_DAYS));
  }

  for (const from of windows) {
    try {
      const rows = await fetchWindow(cfg, from);
      collected.push(...rows);
      onProgress?.(collected.length);
    } catch (err) {
      console.warn(`[Punchpass] Window ${ymd(from)} failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // De-duplicate: 20-day windows from a moving cursor overlap at the edges.
  const fresh = new Map<string, MomenceSession>();
  for (const row of collected) {
    const session = toSession(row, oracle, cfg);
    const prior = fresh.get(session.id);
    // Within one poll, prefer the reading that actually observed availability.
    if (!prior || (prior.utilisationKnown === false && session.utilisationKnown !== false)) {
      fresh.set(session.id, session);
    }
  }

  const known = [...fresh.values()].filter(s => s.utilisationKnown !== false).length;
  console.log(
    `[Punchpass] ${fresh.size} sessions across ${windows.length} windows ` +
    `(${known} with observed utilisation, ${fresh.size - known} unknown)`,
  );

  return mergeWithCached([...fresh.values()], existingSessions);
}

/**
 * Merge fresh rows over cached ones.
 *
 * The rule that matters: a cached session that recorded real utilisation always
 * beats a fresh one that did not. Punchpass drops the availability badge the
 * moment a session starts, so every session we have already observed will come
 * back badge-less forever after. Letting the fresh row win would erase the only
 * real reading we will ever get and replace it with a placeholder.
 */
export function mergeWithCached(
  fresh: MomenceSession[],
  cached: MomenceSession[],
): MomenceSession[] {
  const merged = new Map<string, MomenceSession>();
  for (const s of cached) merged.set(s.id, s);

  let preserved = 0;
  for (const s of fresh) {
    const prior = merged.get(s.id);
    if (prior && prior.utilisationKnown !== false && s.utilisationKnown === false) {
      // Keep the cached observation, but let the fresh row update cancellation
      // state — a session can be cancelled after we last read its availability.
      if (s.isCancelled && !prior.isCancelled) merged.set(s.id, { ...prior, isCancelled: true });
      preserved++;
      continue;
    }
    merged.set(s.id, s);
  }

  if (preserved > 0) {
    console.log(`[Punchpass] Preserved ${preserved} cached utilisation readings over badge-less fresh rows`);
  }

  return [...merged.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
