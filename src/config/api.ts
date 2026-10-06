// Momence API Configuration

export const API_CONFIG = {
  baseUrl: 'https://readonly-api.momence.com/host-plugins/host',
  defaultHostId: '37867',
  sessionTypes: [
    'course-class',
    'fitness',
    'retreat',
    'special-event',
    'special-event-new',
  ] as const,
  pageSize: 100,
  /** Maximum number of pages to fetch per Momence host */
  maxPages: 250,
  /** Number of pages fetched in parallel per batch */
  batchSize: 10,
  /** Default lookback window when auto-fetching session history */
  defaultFetchWindowYears: 2,
} as const;

// Platform types for venue identification
export type Platform = 'momence' | 'glofox' | 'marianatek' | 'trybe' | 'portal' | 'xtraclubs' | 'acuity' | 'hapana' | 'bsport' | 'punchpass' | 'navia';

export interface VenuePricingPack {
  /** Visits included in the pack. */
  size: number;
  /** Effective rate per visit. */
  perVisit: number;
  /** Total pack price, where it is worth showing alongside the per-visit rate. */
  total?: number;
}

export interface VenuePricingTier {
  label: string;
  casualRate: number;       // single-visit price
  pack5PerVisit?: number;   // per-visit rate on a 5-pack
  pack10PerVisit?: number;  // per-visit rate on a 10-pack
  /**
   * Full pack ladder, for venues that sell more than a 5 and a 10.
   * Supersedes pack5PerVisit/pack10PerVisit when present — those remain for the
   * venues already configured with them.
   */
  packs?: VenuePricingPack[];
}

export interface VenueMembership {
  label: string;            // e.g. "Studio Membership"
  price: string;            // e.g. "$75 / week"
  description?: string;
}

export interface VenuePricingHire {
  label: string;
  /** Formatted price, e.g. '$1,150'. Priced per booking, not per visit. */
  price: string;
  description?: string;
}

export interface VenuePricingConfig {
  tiers: VenuePricingTier[];
  memberships?: VenueMembership[];
  /** Whole-venue or group hire, charged per booking rather than per visit. */
  privateHire?: VenuePricingHire[];
  note?: string;
  /** Currency prefix for tier rates (e.g. 'CHF '). Defaults to '$'. */
  currency?: string;
}

export interface VenueConfig {
  id: string;
  name: string;
  platform: Platform;
  location: string;
  /** IANA timezone name, e.g. 'Australia/Melbourne'. Used to localise operating hours. */
  timezone?: string;
  /** Short positive descriptor shown beneath the venue name on the report header. */
  tagline?: string;
  /** Known pricing tiers for display in the Operating Model section. */
  pricing?: VenuePricingConfig;
  /**
   * Location the report opens on, for venues with more than one. Must match a
   * session `location` exactly. Without it the location with the most
   * measurable sessions is chosen.
   */
  defaultLocation?: string;
  /**
   * Locations still fetched and cached but left out of the report. Like
   * `hidden` for a whole venue: the poller keeps the history current, so
   * removing a name from this list brings the location back with nothing lost.
   * Must match a session `location` exactly.
   */
  hiddenLocations?: string[];
  /**
   * Cache file the report reads, without `.json`, when it is not the usual
   * `{id}-{platform}`. Lets a venue switch to a rebuilt cache while the
   * original file stays untouched beside it; remove this to switch back.
   */
  cacheFile?: string;
  /**
   * Kept in the list and still fetched, but not shown in the venue grid.
   * Use this rather than deleting the entry: the config carries the name,
   * timezone and pricing a cached report still needs, and the poller keeps
   * the history current so unhiding gives current data rather than a frozen
   * cache. Delete the entry only when the venue should stop being fetched.
   */
  hidden?: boolean;
}

// Venue list
export const VENUES: VenueConfig[] = [
  {
    id: 'innerstudio', name: 'Inner Studio', platform: 'momence', location: 'Melbourne', timezone: 'Australia/Melbourne',
    pricing: {
      tiers: [
        // Casual rates rose from $45 to $47 on 2026-07-01 at both locations (confirmed in session data).
        // Pack rates below are from the Inner Studio website and have not been re-checked since that rise.
        { label: 'Sauna & Cold Plunge', casualRate: 47, pack5PerVisit: 40, pack10PerVisit: 35 },
        { label: 'Class+', casualRate: 47, pack5PerVisit: 40, pack10PerVisit: 35 },
        { label: 'Class Only', casualRate: 30 },
      ],
      memberships: [
        { label: 'Class Only Membership', price: '$50 / week', description: 'Unlimited class bookings + bath at $35/visit' },
        { label: 'Studio Membership', price: '$75 / week', description: 'Unlimited all sauna & plunge and Class+ sessions' },
      ],
      note: 'Pack credits valid across Sauna & Cold Plunge and Class+ sessions.',
    },
  },
  { id: '59636', name: 'Sol Sauna', platform: 'momence', location: 'Prahran', timezone: 'Australia/Melbourne', tagline: 'Melbourne\'s most loved urban sauna — authentic heat, cold plunge, and community.' },
  { id: '49448', name: 'Aalto', platform: 'momence', location: 'Adelaide', timezone: 'Australia/Adelaide' },
  { id: '41167', name: 'EQ', platform: 'momence', location: 'South Melbourne', timezone: 'Australia/Melbourne', hidden: true },
  // { id: '46052', name: 'Fjord, San Francisco', platform: 'momence', location: 'San Francisco', timezone: 'America/Los_Angeles' },
  { id: 'lore', name: 'Lore Bathing Club', platform: 'glofox', location: 'New York', timezone: 'America/New_York' },
  { id: 'projectmood', name: 'Project Mood', platform: 'marianatek', location: 'Melbourne', timezone: 'Australia/Melbourne', hidden: true },
  { id: 'aerth', name: 'Ærth Saunas', platform: 'marianatek', location: 'Victoria BC', timezone: 'America/Vancouver', hidden: true },
  { id: 'senseofself', name: 'Sense of Self', platform: 'trybe', location: 'Melbourne', timezone: 'Australia/Melbourne' },
  { id: '40726', name: 'Panda Society', platform: 'momence', location: '', timezone: 'Australia/Melbourne', hidden: true },
  { id: 'portal', name: 'PORTAL° Thermaculture', platform: 'portal', location: 'Colorado · Montana · Minnesota', timezone: 'America/Denver' },
  { id: 'xtraclubs', name: 'Xtra Clubs', platform: 'xtraclubs', location: 'Sydney', timezone: 'Australia/Sydney' },
  // Akari uses Glofox for memberships only — no session bookings exist to
  // report on. Its live feed is a Google Sheets occupancy snapshot (see
  // GLOFOX_CONFIG.akariSaunas); re-enable if an occupancy view is built.
  // { id: 'akari', name: 'Akari Saunas', platform: 'glofox', location: 'Brooklyn', timezone: 'America/New_York' },
  { id: 'wellnesssocial', name: 'Wellness Social Club', platform: 'glofox', location: 'Melbourne', timezone: 'Australia/Melbourne' },
  // Moved off Acuity onto Momence on 19 Aug 2026 — last Acuity session 18 Aug
  // 20:30, first Momence session 19 Aug 07:00. The pre-cutover history lives in
  // 41275-momence.json alongside the native data; saunagoose-acuity.json is kept
  // as the untouched Acuity-era record.
  //
  // Prices differ across the cutover. Acuity listed every product about 2.2%
  // above the Momence price for the same product, and three of them carry the
  // same name on both sides, so the pairing is read off the product rather than
  // inferred from the ratio:
  //
  //   Sauna Session                 $25.55  ->  Sauna (silent)/(social)  $25
  //   Saunagus Session              $35.78  ->  Saunagus                 $35
  //   Femme Fridays          (90m)  $56.25  ->  Femme Friday      (90m)  $55
  //   Yoga & Saunagus       (120m)  $66.50  ->  Yoga & Saunagus  (120m)  $65
  //   Men's Breathwork      (120m)  $66.50  ->  Men's Breathwork (120m)  $65
  //   Latvian Sauna         (180m)  $97.50  ->  discontinued, no pair
  //
  // A venue repricing would not scale five unrelated products by the same
  // 1.022x, so a payment surcharge folded into the Acuity appointment type
  // price is the likely cause. That remains inferred, not confirmed against
  // Acuity.
  //
  // Nothing is normalised: each platform's figure is stored as reported, so
  // every tier appears twice in the derived price distribution and any average
  // spanning the cutover blends the two. The Acuity-era sessions are past and
  // Momence never returns their ids, so mergeWithCachedPast retains those
  // objects verbatim on every refetch — the figures above are stable, and
  // saunagoose-acuity.json remains the untouched original either way.
  { id: '41275', name: 'Sauna Goose', platform: 'momence', location: 'Northcote', timezone: 'Australia/Melbourne' },
  // Host id read from the Momence lead-form embed on nativestate.com.au. Kirra is
  // on the Queensland side of the border, so no daylight saving.
  { id: '233027', name: 'Native State', platform: 'momence', location: 'Kirra, Gold Coast', timezone: 'Australia/Brisbane' },
  // Hidden until it has trading data: it opens 2026-10-12, and the only past
  // sessions are 18 zero-sold Monday test slots from July–August, which would
  // read as 0% utilisation. markPreLaunchSessions drops those once a booked
  // session has run, so unhiding a few weeks after opening shows a clean ramp.
  //
  // Each 30-minute entry is its own Momence session with 6 places and a
  // 90-minute stay, so three entries overlap at any time. Utilisation per entry
  // is arrivals against places offered and compares fine; sessions per day does
  // not, since it counts entries rather than sittings.
  //
  // Prices are NZD and are summed as dollars in revenue figures, as KEEN's CHF
  // are. City not yet confirmed; Momence reports only the country.
  { id: '284871', name: 'Sink Bathhouse', platform: 'momence', location: 'New Zealand', timezone: 'Pacific/Auckland', hidden: true },
  { id: 'thecornersauna', name: 'The Corner Sauna', platform: 'acuity', location: 'Apollo Bay', timezone: 'Australia/Sydney' },
  {
    id: 'capybarabathing', name: 'Capybara Bathing', platform: 'acuity', location: 'Surry Hills', timezone: 'Australia/Sydney',
    // Casual rates from the Acuity types (ACUITY_CONFIG.capybarabathing).
    // Passes and memberships from capybarabathing.com.au on 2026-09-26. Passes
    // cover all bathing types; "The Renewal" (5 off-peak for $250, 90-day
    // expiry) is a limited-time offer and left out of the ladder.
    pricing: {
      tiers: [
        { label: 'Bathing (Off-Peak)', casualRate: 65, pack5PerVisit: 63, pack10PerVisit: 60, packs: [{ size: 5, perVisit: 63, total: 315 }, { size: 10, perVisit: 60, total: 600 }] },
        { label: 'Bathing (Peak)', casualRate: 70, pack5PerVisit: 63, pack10PerVisit: 60, packs: [{ size: 5, perVisit: 63, total: 315 }, { size: 10, perVisit: 60, total: 600 }] },
        { label: 'Bathing (Quiet Weekend Morning)', casualRate: 70 },
        { label: 'Guided Session (Soft)', casualRate: 80 },
      ],
      memberships: [
        { label: 'Ritual (Off-Peak)', price: '$40 / week', description: 'One off-peak session per week' },
        { label: 'Ritual (Full Access)', price: '$45 / week', description: 'One peak or off-peak session per week' },
      ],
      note: 'Off-peak is weekdays before 5pm; peak is weeknights from 5pm, weekends and public holidays. Each entry admits 5 people for a 90-minute stay, with a new entry every 15 minutes, so sessions per day counts entries rather than sittings. Acuity sells passes as products rather than per-session tickets, so revenue here is modelled on the casual rate.',
    },
  },
  { id: 'alchemysaunas', name: 'Alchemy Saunas', platform: 'hapana', location: 'Perth', timezone: 'Australia/Perth' },
  {
    id: 'bmsauna', name: 'Blue Mountains Sauna', platform: 'punchpass', location: 'Blue Mountains', timezone: 'Australia/Sydney',
    // Full pass list read from bmsauna.punchpass.com/passes on 2026-08-06.
    // Per-visit rates are pack total ÷ pack size. Gift cards mirror the pack
    // prices exactly and are the same product, so they are not listed twice.
    // One-off event passes (THE BIG SWEAT weekend, Sauna Hat Felting Workshop)
    // are deliberately excluded — they are not the regular session product and
    // would distort the rate ladder.
    pricing: {
      tiers: [
        {
          label: 'Casual (Off-Peak)',
          casualRate: 45,
          pack5PerVisit: 42,
          pack10PerVisit: 40,
          packs: [
            { size: 2, perVisit: 44, total: 88 },
            { size: 5, perVisit: 42, total: 210 },
            { size: 10, perVisit: 40, total: 400 },
            { size: 20, perVisit: 34.95, total: 699 },
            { size: 40, perVisit: 29.98, total: 1199 },
          ],
        },
        {
          label: 'Casual (Peak)',
          casualRate: 55,
          pack5PerVisit: 53,
          pack10PerVisit: 52.5,
          packs: [
            { size: 2, perVisit: 55, total: 110 },
            { size: 5, perVisit: 53, total: 265 },
            { size: 10, perVisit: 52.5, total: 525 },
            { size: 20, perVisit: 50, total: 1000 },
            { size: 40, perVisit: 47, total: 1880 },
          ],
        },
      ],
      memberships: [
        { label: 'Rise & Sweat (Individual)', price: '$32 / week', description: 'Two 1-hour sessions per week, Mon–Fri' },
        { label: 'Balance (Individual)', price: '$56 / week', description: '2 sessions per week' },
        { label: 'Renew (Individual)', price: '$66 / week', description: '3 sessions per week' },
        { label: 'Restore (Individual)', price: '$76 / week', description: '4 sessions per week' },
        { label: 'Revive (Individual)', price: '$91 / week', description: '7 sessions per week' },
        { label: 'Restore (Shared)', price: '$92 / week', description: '4 sessions per week, shared with a partner, child, parent or sibling' },
        { label: 'Revive (Shared)', price: '$140 / week', description: '14 sessions per week, shared with a partner, child, parent or sibling' },
      ],
      privateHire: [
        { label: 'Private group, Mon–Fri 7am–2pm', price: '$1,150', description: '2-hour whole-venue booking' },
        { label: 'Private group, Mon–Fri from 2pm', price: '$1,350', description: '2-hour whole-venue booking' },
        { label: 'Private group, Sat & Sun', price: '$1,650', description: '2-hour whole-venue booking' },
      ],
      note: 'Off-peak is Mon–Fri 7am–9pm and weekends 7am–10am; peak is weekends from 10am and public holidays. Punchpass sells packs rather than per-session tickets, so revenue in this report is modelled on the casual rate and will overstate what a regular pack or membership customer actually pays.',
    },
  },
  {
    id: 'keenwellbeing', name: 'KEEN Wellbeing', platform: 'bsport', location: 'Zurich', timezone: 'Europe/Zurich',
    pricing: {
      currency: 'CHF ',
      tiers: [
        { label: 'Journeys (group & solo)', casualRate: 27, pack10PerVisit: 27 },
      ],
      memberships: [
        { label: 'Unlimited Membership', price: 'CHF 249 / month', description: 'Unlimited group classes and solo journeys' },
      ],
      note: 'Bookings are credit-based on bsport; CHF rates from keenwellbeing.com (10-pack CHF 270). Summer special: 10-pack CHF 200, Unlimited CHF 180/month.',
    },
  },
  {
    // One card, two locations. The report's location selector splits them, and
    // they measure differently: Byron has a derived 16-seat sitting, Prahran
    // has no denominator at all.
    id: 'navia', name: 'Navia Bathhouse', platform: 'navia',
    location: 'Prahran', timezone: 'Australia/Melbourne',
    defaultLocation: 'Prahran',
    // Byron Bay is still polled (NAVIA_CONFIG) so its history keeps accruing,
    // but it is left out of the report. Remove it from this list to bring it back.
    hiddenLocations: ['Byron Bay'],
    // Counts rebuilt from Navia's own entry records (see naviaWindows.ts). The
    // slot feed cache, navia-navia.json, is still written and left as it was;
    // delete this line to put the report back on it.
    cacheFile: 'navia-navia-windows',
    pricing: {
      tiers: [
        { label: 'Prahran — Bathing (1 hour)', casualRate: 50 },
        { label: 'Prahran — Bathing (2 hours)', casualRate: 80 },
      ],
      note: '',
    },
  },
];

// Glofox configuration
export const GLOFOX_CONFIG = {
  loreBathingClub: {
    branchId: '67c5eb09efb4277b06084eb6',
    namespace: 'lorebathingclub',
    name: 'Lore Bathing Club',
    timezone: 'America/New_York',
    // Lore moved to a different booking platform (confirmed Aug 2026) and the
    // Glofox branch was deactivated (~June 2026): guest login returns "no
    // active branch", so the weekly token refresh fails for lore and fetches
    // 401. Reports serve the git-tracked cache (frozen at 2026-03-03), which
    // is the only record of the Glofox era.
    token: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJfIiwiZXhwIjoxNzgyODkxMjM1LCJpYXQiOjE3ODAyOTkyMzUsImlzcyI6Il8iLCJ1c2VyIjp7Il9pZCI6Imd1ZXN0IiwibmFtZXNwYWNlIjoibG9yZWJhdGhpbmdjbHViIiwiYnJhbmNoX2lkIjoiNjdjNWViMDllZmI0Mjc3YjA2MDg0ZWI2IiwiZmlyc3RfbmFtZSI6Ikd1ZXN0IiwibGFzdF9uYW1lIjoiVXNlciIsInR5cGUiOiJHVUVTVCIsImlzU3VwZXJBZG1pbiI6ZmFsc2V9fQ.9LaCJTJI4LOk-Y_7HEyQMV46z89deXCX1K774VE8ViI',
    tokenExpiry: '2026-07-01',
    operatingSince: '2026-01-01',
  },
  akariSaunas: {
    branchId: '67cf4fe8ef346c3817003b8f',
    namespace: '', // TODO: discover via guest token probe
    name: 'Akari Saunas',
    timezone: 'America/New_York',
    // Glofox is used for memberships, not session booking
    token: '',
    tokenExpiry: '',
    operatingSince: '2025-01-01',
    // Google Sheets live occupancy feed (from akarisauna.com JS)
    // SingleRow!A2:E2 → [lastUpdatedDatetime, rawOccupancy (0–0.2), prettyDate, prettyTime, occupancyLabel]
    // Closures!A2:A1001 → list of special closure dates
    sheetsSpreadsheetId: '1yrIBz86iBFtin1_glrHsl0g05raVsisvbgIYaAYtin4',
    sheetsApiKey: 'AIzaSyB_CloyomHHpxfqBS8jJFBeIiR_MjE4gAQ',
    sheetsRange: 'SingleRow!A2:E2',
    // Operating hours (from their website JS)
    // Mon–Fri: 8am–10pm ET, Sat–Sun: 9am–8pm ET
  },
  wellnessSocialClub: {
    branchId: '6769bc07dd963d1b0108804b',
    namespace: "wellnesssocialbusine",
    name: 'Wellness Social Club',
    timezone: 'Australia/Melbourne',
    token: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJfIiwiZXhwIjoxNzkzODgyNzE0LCJpYXQiOjE3OTEyMDQzMTQsImlzcyI6Il8iLCJ1c2VyIjp7Il9pZCI6Imd1ZXN0IiwibmFtZXNwYWNlIjoid2VsbG5lc3Nzb2NpYWxidXNpbmUiLCJicmFuY2hfaWQiOiI2NzY5YmMwN2RkOTYzZDFiMDEwODgwNGIiLCJmaXJzdF9uYW1lIjoiR3Vlc3QiLCJsYXN0X25hbWUiOiJVc2VyIiwidHlwZSI6IkdVRVNUIiwiaXNTdXBlckFkbWluIjpmYWxzZX19.EzO4JiwyiGArpBLBFmQYs8rSQzqGPqq7GonXsGC2fks',
    tokenExpiry: '2026-11-05',
    operatingSince: '2025-06-01',
  },
} as const;

/** Resolve the Glofox config entry for a given venue hostId. */
export function getGlofoxConfig(hostId: string) {
  const map: Record<string, (typeof GLOFOX_CONFIG)[keyof typeof GLOFOX_CONFIG]> = {
    lore: GLOFOX_CONFIG.loreBathingClub,
    wellnesssocial: GLOFOX_CONFIG.wellnessSocialClub,
  };
  const cfg = map[hostId];
  if (!cfg) throw new Error(`No Glofox config for hostId "${hostId}"`);
  return cfg;
}

// TryBe configuration (public customer API — no auth required)
export const TRYBE_CONFIG = {
  senseOfSelf: {
    venueId: '9f40f5e4-d840-487a-b5cd-12e9a571b80e',
    // Each offering is a bookable session type. Sessions are fetched per-offering.
    offerings: [
      { id: '689bfaa6238f5106bb09ebef', name: 'Quiet Morning Bathhouse' },
      { id: '6861f7143c3fb8e08d061fa4', name: 'Bathhouse Session' },
    ],
    name: 'Sense of Self',
    timezone: 'Australia/Melbourne',
    // TryBe rooms ("Bathhouse", "Last Minute BH", "Quiet Morning Bathhouse") are
    // booking channels for the same physical venue, not separate locations.
    // All sessions are labelled with this single location so the report
    // aggregates them into one total.
    locationName: 'Collingwood',
    // TryBe only exposes upcoming/current sessions — past sessions are not accessible
    // via the public API. The fetcher merges newly fetched sessions with previously
    // cached past sessions to build up history over time.
    launchDate: '2025-07-07',
  },
} as const;

// Mariana Tek configuration (customer classes endpoint — no auth required)
// Note: ids are per-tenant — Project Mood and Ærth both having 48717/48541 is
// coincidence, not a copy-paste error (verified against each tenant's
// /locations endpoint).
//
// Data caveats (observed 2026-08-02): the API 403s date chunks older than
// ~6 months, and the bulk classes endpoint now returns capacity 0 on nearly
// every session for both tenants, so sanitization drops them. Full refetches
// therefore yield little or no fresh data; fetch-all-venues merges with the
// existing cache so the historical data (fetched while capacity was still
// populated) is preserved rather than overwritten.
export const MARIANATEK_CONFIG = {
  projectMood: {
    baseUrl: 'https://projectmood.marianatek.com/api/customer/v1',
    locationId: '48717',
    regionId: '48541',
    name: 'Project Mood',
    timezone: 'Australia/Melbourne',
    // Bathhouse sessions only (gym/pilates/reformer classes excluded).
    // 'Open Bathhouse' is the legacy title-case name; the tenant renamed to
    // uppercase and split into BATHHOUSE + OPEN BATHHOUSE in 2026.
    classTypeFilters: ['Open Bathhouse', 'OPEN BATHHOUSE', 'BATHHOUSE'],
  },
  aerthSaunas: {
    baseUrl: 'https://aerthsaunas.marianatek.com/api/customer/v1',
    locationId: '48717',
    regionId: '48541',
    name: 'Ærth Saunas',
    timezone: 'America/Vancouver',
    // Public group sessions; '90 min' is the legacy name of today's 1h 45min
    // cycle, kept so historical fetches retain the old era.
    classTypeFilters: [
      'Ærth Cycle (90 min)',
      'Ærth Cycle (1h 45 min)',
      'Ærth Cycle (1h 45min) - Aufguss',
      'Twilight Hour (60 min)',
    ],
  },
} as const;

/** Resolve the Mariana Tek config entry for a given venue hostId. */
export function getMarianaTekConfig(hostId: string) {
  const map: Record<string, (typeof MARIANATEK_CONFIG)[keyof typeof MARIANATEK_CONFIG]> = {
    projectmood: MARIANATEK_CONFIG.projectMood,
    aerth: MARIANATEK_CONFIG.aerthSaunas,
  };
  const cfg = map[hostId];
  if (!cfg) throw new Error(`No Mariana Tek config for hostId "${hostId}"`);
  return cfg;
}

// Xtra Clubs configuration (public schedule API — no auth required)
export const XTRA_CLUBS_CONFIG = {
  baseUrl: 'https://checkout.xtraclubs.au/api',
  name: 'Xtra Clubs',
  timezone: 'Australia/Sydney',
  locations: [
    { siteId: '65c468e98af2a3e02af945ae', name: 'Bondi Junction', operatingSince: '2024-01-01' },
    { siteId: '6785c335ead6da842a685ba1', name: 'Green Square', operatingSince: '2025-01-01' },
    { siteId: '67ee5f25751de5d4c7470c67', name: 'Merrickville', operatingSince: '2025-01-01' },
  ],
} as const;

// Inner Studio configuration (multi-location Momence venue)
export const INNER_STUDIO_CONFIG = {
  name: 'Inner Studio',
  timezone: 'Australia/Melbourne',
  locations: [
    { hostId: '37867', name: 'Collingwood' },
    { hostId: '190198', name: 'South Yarra' },
  ],
} as const;

// Portal Thermaculture configuration (custom Wix-backed booking platform — no auth required)
export const PORTAL_CONFIG = {
  baseUrl: 'https://book.portalthermaculture.com/api',
  name: 'Portal',
  timezone: 'America/Denver',
  locations: [
    { wixLocationId: '09d22dbe-dae2-4847-b657-90cf03ea5e67', name: 'Denver', operatingSince: '2025-03-26' },
    { wixLocationId: '8ac6d40a-fbbb-4524-9959-33da8cdc67bc', name: 'Boulder', operatingSince: '2025-03-26' },
    // This Wix record was renamed 'Lyons' Nov 2025 – mid-Jan 2026; sessions
    // self-label via the API's per-item location.name, so both appear in data.
    { wixLocationId: '44897ca4-c829-4108-8929-60be0a91fe60', name: 'Bozeman', operatingSince: '2025-03-16' },
  ],
  // Minneapolis uses Glofox instead of the Wix booking API — fetched separately and merged
  glofoxLocations: [
    {
      branchId: '67d9d5a8c2dce5404b08ef68',
      namespace: 'portalthermaculture',
      name: 'Minneapolis',
      timezone: 'America/Chicago',
      token: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJfIiwiZXhwIjoxNzg5NjI2MjcwLCJpYXQiOjE3ODY5NDc4NzAsImlzcyI6Il8iLCJ1c2VyIjp7Il9pZCI6Imd1ZXN0IiwibmFtZXNwYWNlIjoicG9ydGFsdGhlcm1hY3VsdHVyZSIsImJyYW5jaF9pZCI6IjY3ZDlkNWE4YzJkY2U1NDA0YjA4ZWY2OCIsImZpcnN0X25hbWUiOiJHdWVzdCIsImxhc3RfbmFtZSI6IlVzZXIiLCJ0eXBlIjoiR1VFU1QiLCJpc1N1cGVyQWRtaW4iOmZhbHNlfX0.W2ovY8rYvfzD3XzzeeibMG3E11q_cjydA4Am1iHMcho',
      tokenExpiry: '2026-09-17',
      operatingSince: '2025-01-01',
    },
  ],
} as const;

// Acuity Scheduling configuration (public scheduling widget API — no auth required)
//
// Two modes:
//   'class'   — group classes via POST /availability/class (Capybara Bathing)
//   'service' — individual appointments via GET /availability/times (e.g. The Corner Sauna)
//
// Service-type venues must specify a `calendarId` on each appointment type
// because the GET endpoint queries one type+calendar pair at a time.
export interface AcuityConfig {
  /** 'class' (default) or 'service'. Determines which API endpoint to use. */
  mode?: 'class' | 'service';
  baseUrl: string;
  ownerKey: string;
  name: string;
  timezone: string;
  appointmentTypes: {
    id: number;
    name: string;
    duration: number;
    price: string;
    classSize: number;
    /** Required for service-type: which calendar to query this type against. */
    calendarId?: number;
  }[];
  calendarIds: number[];
}

export const ACUITY_CONFIG: Record<string, AcuityConfig> = {
  thecornersauna: {
    mode: 'service',
    baseUrl: 'https://app.squarespacescheduling.com',
    ownerKey: '6f7bfa9c',
    name: 'The Corner Sauna',
    timezone: 'Australia/Sydney',
    appointmentTypes: [
      { id: 71669392, name: 'Single Session', duration: 60, price: '40.00', classSize: 8, calendarId: 11172572 },
      { id: 80179076, name: "Women's Wellness Session", duration: 60, price: '40.00', classSize: 8, calendarId: 11172572 },
      { id: 86988395, name: 'Silent Sauna', duration: 60, price: '40.00', classSize: 8, calendarId: 13261360 },
    ],
    calendarIds: [11172572, 13261360],
  },
  // Sauna Goose migrated to Momence on 19 Aug 2026 (host 41275) and its Acuity
  // config is gone from here so the poller stops chasing a dead feed. Its
  // Acuity-era cache is preserved untouched in saunagoose-acuity.json, and the
  // sessions were carried across into 41275-momence.json.
  //
  // Capybara Bathing (Surry Hills). Ids, durations, prices and class sizes are
  // read from the bootstrap JSON on capybarabathing.as.me/schedule/81d64d64,
  // 2026-09-26. Every bathing type is an Acuity class, so one paginated call
  // covers them all and sold-out entries stay in the feed as slotsAvailable 0.
  //
  // The grid is an entry every 15 minutes, 5 places each, for a 90-minute stay,
  // so six entries overlap at any moment (the Sink Bathhouse shape). The 5 is
  // places admitted at that entry and is what slotsAvailable counts down from,
  // so per-entry utilisation is sound; sessions per day counts entries, not
  // sittings. "Up to 4 people per booking" on the site is a per-booking cap,
  // not the room.
  //
  // The guided session sits on the practitioner's calendar (14553892, Tara)
  // rather than the venue calendar, so both calendars are queried.
  capybarabathing: {
    mode: 'class',
    baseUrl: 'https://capybarabathing.as.me',
    ownerKey: '81d64d64',
    name: 'Capybara Bathing',
    timezone: 'Australia/Sydney',
    appointmentTypes: [
      { id: 57411393, name: 'Bathing (Off-Peak)', duration: 90, price: '65.00', classSize: 5, calendarId: 9539301 },
      { id: 57414776, name: 'Bathing (Peak)', duration: 90, price: '70.00', classSize: 5, calendarId: 9539301 },
      { id: 66085359, name: 'Bathing (Quiet Weekend Morning)', duration: 90, price: '70.00', classSize: 5, calendarId: 9539301 },
      { id: 97868741, name: 'Guided Session (Soft)', duration: 90, price: '80.00', classSize: 8, calendarId: 14553892 },
    ],
    calendarIds: [9539301, 14553892],
  },
};

export function getAcuityConfig(hostId: string): AcuityConfig {
  const cfg = ACUITY_CONFIG[hostId];
  if (!cfg) throw new Error(`No Acuity config for hostId "${hostId}"`);
  return cfg;
}

// Punchpass configuration (public schedule HTML — no auth, no JSON API)
//
// Punchpass never publishes capacity: the badge reads "N SPOTS LEFT", which is
// remaining. Total capacity comes from a far-future oracle — recurring series
// are published months ahead while the real booking window is days, so a
// far-future occurrence is unbooked and its badge equals capacity. See
// src/lib/punchpassClient.ts for the full data model.
export interface PunchpassConfig {
  /** Subdomain tenant, e.g. 'bmsauna' for bmsauna.punchpass.com. */
  tenant: string;
  baseUrl: string;
  name: string;
  location: string;
  timezone: string;
  /** Used when a row's duration text is missing or unparseable. */
  defaultDurationMinutes: number;
  /**
   * Days ahead to sample for the capacity oracle. Several widely-spaced probes,
   * taking the max — a single sample can land on an already-booked date and
   * understate capacity, which overstates utilisation permanently.
   */
  oracleProbeDaysAhead: number[];
  /** 20-day windows to fetch forward from today (the live booking window). */
  forwardWindows: number;
  /** 20-day windows to fetch backward (schedule history; carries no utilisation). */
  backWindows: number;
  /**
   * How often to re-run the far-future oracle probes and the back-history pass.
   * Capacity changes rarely and a past schedule is fixed, so these do not belong
   * on the 30-minute cadence the live window needs. Keeps the steady-state poll
   * to `forwardWindows` requests instead of that plus seven more.
   */
  deepRefreshHours: number;
  /**
   * Drop-in prices. Blue Mountains publishes its rule on /passes:
   *   Off-peak: Mon–Fri 7am–9pm, and weekends 7am–10am
   *   Peak:     weekends from 10am, and public holidays
   * Punchpass sells packs rather than per-session tickets, so revenue derived
   * from these is modelled, not observed. Re-check when pricing changes.
   */
  pricing: { peak: number; offPeak: number };
}

export const PUNCHPASS_CONFIG: Record<string, PunchpassConfig> = {
  bmsauna: {
    tenant: 'bmsauna',
    baseUrl: 'https://bmsauna.punchpass.com',
    name: 'Blue Mountains Sauna',
    location: 'Blue Mountains',
    timezone: 'Australia/Sydney',
    defaultDurationMinutes: 120,
    // ~10, 15, 20 and 25 weeks out. All four returned identical capacities for
    // all 27 recurring courses when verified on 2026-08-06.
    oracleProbeDaysAhead: [70, 105, 140, 175],
    forwardWindows: 3,
    backWindows: 2,
    deepRefreshHours: 24,
    pricing: { peak: 55, offPeak: 45 },
  },
};

export function getPunchpassConfig(hostId: string): PunchpassConfig {
  const cfg = PUNCHPASS_CONFIG[hostId];
  if (!cfg) throw new Error(`No Punchpass config for hostId "${hostId}"`);
  return cfg;
}

// Navia Bathhouse configuration (bespoke public API — no auth required)
//
// Navia built its own booking platform. The feed publishes bookable *entries*,
// not sessions: a start time with its own seat counter, where each entry buys a
// fixed-length stay. Byron Bay staggers four entries 15 minutes apart, each
// capped at 4, and the next group opens two hours later — so a Byron sitting is
// four entries and holds 16. Prahran runs a continuous 15-minute grid with no
// gap to break on, which is why it can carry bookings but not a denominator.
//
// One venue, two locations, one cache file — the Portal pattern. Sessions carry
// their location name so the report's location selector picks them apart.
//
// See src/lib/naviaClient.ts for the full data model and the derivation.
export interface NaviaLocation {
  /** Display name; becomes MomenceSession.location. */
  name: string;
  timezone: string;
  serviceId: number;
  locationId: number;
  /**
   * The single option to query. All options at a location share one seat
   * counter, so a second query returns identical numbers for double the
   * budget. Pick the option whose start-time set is a superset.
   */
  serviceOptionId: number;
  /** Product length in minutes; also the emitted session duration. */
  sessionDurationMinutes: number;
  /** Entries per sitting. `null` disables the block model (continuous grid). */
  blockEntries: number | null;
  /** Per-seat price, or `null` where the product mix behind the counter is unknowable. */
  seatPrice: number | null;
  /** False emits `capacity: 0` + `utilisationKnown: false` on every session. */
  utilisationEligible: boolean;
  measure: 'seats' | 'slot-occupancy';
  operatingSince: string;
  /**
   * How sittings are found in the windows endpoint, which lists every quarter
   * hour of the day rather than only the entries. `every-hour`: each clock hour
   * is a sitting, right for a continuous grid. `feed-sittings`: only the hours
   * where the slot feed found one, because a gapped grid's windows also cover
   * the empty quarter hours between sittings.
   */
  sittingAnchors: 'every-hour' | 'feed-sittings';
  /**
   * Per-entry limit over time, oldest first. Used only for a window with no
   * reading taken before it started: past windows report today's limit rather
   * than the one in force at the time.
   */
  entryLimitHistory: { from: string; limit: number }[];
  /** Sittings starting before this instant carry `capacityUnconfirmedNote`. */
  capacityConfirmedFrom?: string;
  capacityUnconfirmedNote?: string;
}

export interface NaviaConfig {
  baseUrl: string;
  name: string;
  /** Session name emitted on every record. */
  sessionName: string;
  /** Minutes between entries within a sitting. A larger gap starts a new one. */
  entryStrideMinutes: number;
  /** Beyond this the grid has gone continuous and the block model is void. */
  maxBlockEntries: number;
  /** Days fetched on a routine poll. */
  hotDays: number;
  /** Days fetched on a deep refresh. */
  horizonDays: number;
  /** How long an entry observation is kept so partial sittings can be rebuilt. */
  ledgerRetentionDays: number;
  /** Past days the windows poll refetches so late changes settle. */
  windowsSettleDays: number;
  /** The same on a deep refresh. */
  windowsDeepSettleDays: number;
  locations: NaviaLocation[];
}

export const NAVIA_CONFIG: NaviaConfig = {
  baseUrl: 'https://api.naviabathhouse.com.au/api/v2',
  name: 'Navia Bathhouse',
  sessionName: 'Bathing',
  entryStrideMinutes: 15,
  maxBlockEntries: 6,
  hotDays: 3,
  horizonDays: 35,
  ledgerRetentionDays: 3,
  windowsSettleDays: 1,
  windowsDeepSettleDays: 7,
  locations: [
    {
      name: 'Byron Bay',
      timezone: 'Australia/Sydney',
      serviceId: 1,
      locationId: 1,
      // Option 1 is the only active Byron bathing product — the 1-hour option 8
      // is isActive: false, so every Byron seat is the same $80 product. That is
      // precisely why Byron can carry a revenue figure and Prahran cannot.
      serviceOptionId: 1,
      sessionDurationMinutes: 120,
      blockEntries: 4,
      seatPrice: 80,
      utilisationEligible: true,
      measure: 'seats',
      operatingSince: '2026-03-26',
      sittingAnchors: 'feed-sittings',
      entryLimitHistory: [{ from: '2026-03-26T00:00:00+10:00', limit: 4 }],
    },
    {
      name: 'Prahran',
      timezone: 'Australia/Melbourne',
      serviceId: 5,
      locationId: 2,
      // Option 9's start times are a strict superset of option 10's, and every
      // shared start returns identical numbers.
      serviceOptionId: 9,
      // 60 to match the hourly sitting, so consecutive sittings tile. As at
      // Byron, the last entry of a sitting stays past the nominal end; using the
      // real end would overlap neighbours and fake a doubled concurrency curve.
      sessionDurationMinutes: 60,
      // MODELLED ON BYRON (decision, 2026-08-16). Prahran runs an unbroken
      // 15-minute cadence, so unlike Byron it hands us no session boundary. We
      // impose Byron's shape on it: four entries per sitting at :00/:15/:30/:45,
      // one sitting per clock hour, so a sitting offers 4 x 10 = 40 seats and
      // consecutive sittings tile without overlapping.
      //
      // What this measures is arrivals against admission slots offered, exactly
      // as at Byron. It deliberately does not model dwell time: Prahran sells
      // both a 1-hour and a 2-hour product from one duration-blind counter, so a
      // guest's stay is unobservable. A 2-hour guest occupies one seat in their
      // arrival hour here, which is right for seat occupancy and wrong for any
      // "bodies in the room" reading.
      //
      // THE ASSUMPTION, stated plainly so it can be revisited: that the sitting
      // is 4 entries deep rather than 8, giving 40 concurrent rather than 80.
      //
      // Supported by floor area, which is the only evidence here independent of
      // the feed. Prahran is roughly twice Byron's square metreage, and floor
      // area constrains concurrent occupancy rather than daily throughput.
      // Byron holds 16, so Prahran should hold something near 32. Depth 4 gives
      // 40, which is 1.25x that. Depth 8 gives 80, which is 2.5x it and would
      // require the bathhouse alone to be five times Byron's. Depth 4 it is.
      //
      // Two reasons 40 is more likely generous than mean. Prahran's floor area
      // also carries the infrared rooms and the red light room, which Byron does
      // not have, so its communal bathhouse is probably rather less than twice
      // Byron's. And the feed enforces no concurrency ceiling at all, so nothing
      // stops the operator throttling arrivals more loosely than the room.
      // Prahran's occupancy is therefore likelier understated than overstated.
      //
      // Observed concurrent floor is 24 and rising (duration independent, so
      // solid), already half the assumed 40 and well past Byron's entire room.
      // Recompute it off the cache as the venue fills: settling near 40 confirms
      // this, sailing past it means moving blockEntries to 8.
      blockEntries: 4,
      // Still null, and deliberately not inferred from the sitting model. The
      // $50 1-hour and $80 2-hour products share one counter, so a booked seat
      // cannot be attributed to a price. Occupancy is now derivable here;
      // revenue is not.
      seatPrice: null,
      utilisationEligible: true,
      measure: 'seats',
      operatingSince: '2026-08-15',
      sittingAnchors: 'every-hour',
      // Read off the slot feed: every reading up to 2:18pm on 22 August showed
      // 10 per entry, and every reading from 3pm showed 8.
      entryLimitHistory: [
        { from: '2026-08-15T00:00:00+10:00', limit: 10 },
        { from: '2026-08-22T15:00:00+10:00', limit: 8 },
      ],
      // The endpoint's room capacity (32) agrees with today's limit of 8 and is
      // enforced now, but it reports today's settings for every past date, so
      // nothing confirms what the room was allowed before the change.
      capacityConfirmedFrom: '2026-08-22T15:00:00+10:00',
      capacityUnconfirmedNote:
        'Capacity not confirmed before 3pm on 22 August. Navia allowed 10 people per 15 minute entry until then, and its room limit for that period cannot be checked.',
    },
  ],
};

// bsport configuration (public booking API — no auth required)
//
// KEEN Wellbeing (Zurich) runs on bsport (bsport.io). The public offer endpoint
// exposes full session history (back to 2024-11) including capacity (`effectif`)
// and booking counts (`validated_booking_count`) — fetched via date-range
// pagination like Momence.
//
// All public offers are included (matching the Momence/Glofox convention) —
// the venue regularly retires and introduces meta_activity IDs, so an activity
// allowlist would silently drop new class types. Only `manager_only` offers
// and excluded establishments (Mindbody-mirror placeholders with zero real
// bookings) are filtered out.
//
// Pricing on bsport is credit-based (1 credit per session), so `sessionPriceChf`
// carries a static per-visit rate derived from their website (10-pack CHF 270).
export interface BsportConfig {
  baseUrl: string;
  companyId: number;
  name: string;
  timezone: string;
  /** Earliest session date to fetch (first flagship session). */
  operatingSince: string;
  /** Static per-visit price in CHF (bsport bookings are credit-based). */
  sessionPriceChf: number;
  /** Establishment IDs to exclude (e.g. third-party booking mirrors). */
  excludedEstablishmentIds: number[];
  /** establishment ID → display name, used as the session `location`. */
  establishments: Record<number, string>;
}

export const BSPORT_CONFIG: Record<string, BsportConfig> = {
  keenwellbeing: {
    baseUrl: 'https://api.production.bsport.io/book/v1',
    companyId: 3385,
    name: 'KEEN Wellbeing',
    timezone: 'Europe/Zurich',
    operatingSince: '2024-11-23',
    sessionPriceChf: 27,
    // 12232 "MBO: KEEN Wellbeing" holds Mindbody-sync placeholder offers with
    // zero real bookings — excluding it keeps utilisation honest.
    excludedEstablishmentIds: [12232],
    establishments: {
      11743: 'KEEN Zurich',
      12232: 'MBO: KEEN Wellbeing',
      13598: 'KEEN Flagship: Treatment Room',
      14620: 'Josefwiese (Outdoor)',
      14621: 'Bootsvermietung Enge',
      17048: 'Sauna Utoquai',
      17851: 'Indigo Fitness Club Zürich',
      19791: 'Secret Location',
      20188: 'Samigo Sport Club',
    },
  },
};

export function getBsportConfig(hostId: string): BsportConfig {
  const cfg = BSPORT_CONFIG[hostId];
  if (!cfg) throw new Error(`No bsport config for hostId "${hostId}"`);
  return cfg;
}

// Hapana configuration (public widget API — security token required)
//
// Alchemy Saunas uses Hapana (hapana.com) as their booking platform.
// The widget API at widgetapi.hapana.com exposes session data including
// capacity and booking counts. Each location has its own widget ID (siteID).
//
// Data availability: ~2-3 months of historical data + future schedule.
// Past sessions are removed over time, so incremental caching is needed.
export interface HapanaLocation {
  widgetId: string;
  name: string;
  operatingSince: string;
  /** Flat drop-in price for this location (AUD). Alchemy prices by location, not by time. */
  dropInPrice: number;
  /** Unlimited weekly membership price for this location (AUD). */
  membershipWeekly: number;
}

export const HAPANA_CONFIG = {
  baseUrl: 'https://widgetapi.hapana.com/v2/wAPI/site/sessions',
  name: 'Alchemy Saunas',
  origin: 'https://alchemysaunas.com.au',
  timezone: 'Australia/Perth',
  // Security token is fetched dynamically from the settings endpoint per-location.
  // No hardcoded token needed — see hapanaClient.ts fetchSecurityToken().
  //
  // Static pricing — Hapana returns casualRate: 0 (credit-based), so we use website pricing.
  // Alchemy prices per LOCATION (not by time of day): premium/amenity sites $35 drop-in /
  // $40 week unlimited; beach & river sites $20 / $30. Confirmed 2026-07 from alchemysaunas.com.au.
  locations: [
    { widgetId: 'T204UER6NXhMbHQxemhCSTIxdDU2Zz09', name: 'Karrinyup', operatingSince: '2026-01-01', dropInPrice: 35, membershipWeekly: 40 },
    { widgetId: 'SlN0WjlHeitPRCtSd1h0K00yTmt3Zz09', name: 'Port Beach', operatingSince: '2025-01-01', dropInPrice: 20, membershipWeekly: 30 },
    { widgetId: 'bzNBYXpVMkNaT1ltdTcrZFlMSTlaUT09', name: 'Point Walter', operatingSince: '2025-01-01', dropInPrice: 20, membershipWeekly: 30 },
    { widgetId: 'MEZ6M1FsaXY2QUpEYkFLelpEQ254QT09', name: 'Fremantle', operatingSince: '2025-01-01', dropInPrice: 20, membershipWeekly: 30 },
    { widgetId: 'bzVBYmt0cm41S3h2WXhQZGdRVHE0Zz09', name: 'West Leederville', operatingSince: '2025-01-01', dropInPrice: 35, membershipWeekly: 40 },
    { widgetId: 'MTVjN0FsbmZMS0JhcVhzdGwvbUpDZz09', name: 'City Beach', operatingSince: '2025-01-01', dropInPrice: 20, membershipWeekly: 30 },
    { widgetId: 'a2Z6bVlFU2s4TEE4cmo0L3JIZHBqdz09', name: 'East Fremantle', operatingSince: '2025-01-01', dropInPrice: 35, membershipWeekly: 40 },
    { widgetId: 'dzBFdU1yRWxBQ2dwNktHVGFPM2dLUT09', name: 'Scarborough', operatingSince: '2025-01-01', dropInPrice: 35, membershipWeekly: 40 },
  ] as HapanaLocation[],
} as const;
