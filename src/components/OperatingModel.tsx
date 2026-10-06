"use client";

import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import type { MomenceSession } from '@/types/momence';
import type { BenchmarkMetrics } from '@/lib/benchmarkMetrics';
import { Card, CardContent } from '@/components/ui/card';
import { derivePriceTiers, formatPrice } from '@/lib/priceTiers';
import { VENUES } from '@/config/api';
import type { VenuePricingConfig, VenuePricingPack } from '@/config/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type SessionKind = 'bath' | 'class' | 'short';

interface CompositionEntry {
  kind: SessionKind;
  label: string;
  sessionCount: number;
  totalVisitors: number;
  totalCapacity: number;
  sessionPct: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const CLASS_KEYWORDS = [
  'yoga', 'pilates', 'fitness', 'class', 'workshop', 'ceremony',
  'saunagus', 'gus', 'meditation', 'stretch', 'guided', 'latvian',
  'ritual', 'breathwork', 'sound',
];

function getModalDuration(sessions: MomenceSession[]): number {
  const counts = new Map<number, number>();
  sessions.forEach(s => {
    if (s.durationMinutes > 0) counts.set(s.durationMinutes, (counts.get(s.durationMinutes) ?? 0) + 1);
  });
  let modal = 60;
  let maxCount = 0;
  counts.forEach((c, d) => { if (c > maxCount) { maxCount = c; modal = d; } });
  return modal;
}

function classifySession(s: MomenceSession, modalDuration: number): SessionKind {
  const name = s.sessionName.toLowerCase();
  if (CLASS_KEYWORDS.some(kw => name.includes(kw))) return 'class';
  if (s.durationMinutes > 0 && s.durationMinutes < modalDuration * 0.65) return 'short';
  return 'bath';
}

function buildComposition(sessions: MomenceSession[], modalDuration: number): CompositionEntry[] {
  const buckets: Record<SessionKind, { count: number; visitors: number; cap: number }> = {
    bath: { count: 0, visitors: 0, cap: 0 },
    class: { count: 0, visitors: 0, cap: 0 },
    short: { count: 0, visitors: 0, cap: 0 },
  };
  sessions.forEach(s => {
    const kind = classifySession(s, modalDuration);
    buckets[kind].count++;
    buckets[kind].visitors += s.ticketsSold;
    buckets[kind].cap += s.capacity;
  });
  const total = sessions.length;
  const LABELS: Record<SessionKind, string> = {
    bath: 'Sauna & bath sessions',
    class: 'Class sessions',
    short: 'Short sessions',
  };
  return (['bath', 'class', 'short'] as SessionKind[])
    .filter(k => buckets[k].count > 0)
    .map(k => ({
      kind: k,
      label: LABELS[k],
      sessionCount: buckets[k].count,
      totalVisitors: buckets[k].visitors,
      totalCapacity: buckets[k].cap,
      sessionPct: total > 0 ? (buckets[k].count / total) * 100 : 0,
    }));
}

function computePeakConcurrent(sessions: MomenceSession[]): { peak: number; p75: number } {
  if (sessions.length === 0) return { peak: 0, p75: 0 };
  const events: { t: number; delta: number }[] = [];
  sessions.forEach(s => {
    events.push({ t: new Date(s.startsAt).getTime(), delta: s.capacity });
    events.push({ t: new Date(s.endsAt).getTime(), delta: -s.capacity });
  });
  events.sort((a, b) => a.t - b.t);
  let current = 0;
  let peak = 0;
  const startSnaps: number[] = [];
  events.forEach(e => {
    current += e.delta;
    if (current > peak) peak = current;
    if (e.delta > 0) startSnaps.push(current);
  });
  startSnaps.sort((a, b) => a - b);
  const p75 = startSnaps[Math.floor(startSnaps.length * 0.75)] ?? peak;
  return { peak, p75 };
}

function computeSessionIncrement(sessions: MomenceSession[]): number | null {
  if (sessions.length === 0) return null;
  const byDate = new Map<string, number[]>();
  // Performance optimization: Avoid expensive parseISO + format calls in hot loop for ISO 8601 strings (yyyy-MM-ddThh:mm...)
  // Direct string slicing & parsing is ~25x faster and avoids date object creation overhead.
  sessions.forEach(s => {
    const key = s.startsAt.substring(0, 10);
    const hours = parseInt(s.startsAt.substring(11, 13), 10);
    const minutes = parseInt(s.startsAt.substring(14, 16), 10);
    const mins = hours * 60 + minutes;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(mins);
  });
  const gapCounts = new Map<number, number>();
  byDate.forEach(times => {
    const sorted = [...new Set(times)].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap >= 10 && gap <= 120) gapCounts.set(gap, (gapCounts.get(gap) ?? 0) + 1);
    }
  });
  if (gapCounts.size === 0) return null;
  let modal = 0;
  let maxCount = 0;
  gapCounts.forEach((c, g) => { if (c > maxCount) { maxCount = c; modal = g; } });
  return modal >= 10 ? modal : null;
}

function computeOverbooking(sessions: MomenceSession[]) {
  const over = sessions.filter(s => s.ticketsSold > s.capacity);
  return { count: over.length, pct: sessions.length > 0 ? (over.length / sessions.length) * 100 : 0 };
}

function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const period = hh < 12 ? 'am' : 'pm';
  const display = hh === 0 ? 12 : hh <= 12 ? hh : hh - 12;
  return mm === 0 ? `${display}${period}` : `${display}:${mm.toString().padStart(2, '0')}${period}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium mb-3">{children}</p>;
}

function StatRow({ label, right, pct, subRight, dimBar = false }: {
  label: string; right: string; pct: number; subRight?: string; dimBar?: boolean;
}) {
  return (
    <div className="relative h-8 rounded-lg overflow-hidden flex items-center px-3">
      <div className="absolute inset-0 bg" />
      <div
        className="absolute inset-y-0 left-0 rounded-lg transition-[width,background-color] duration-300"
        style={{
          width: `${Math.min(Math.max(pct, 0), 100)}%`,
          backgroundColor: dimBar
            ? 'color-mix(in srgb, var(--muted-foreground) 14%, transparent)'
            : 'color-mix(in srgb, var(--chart-fill) 18%, transparent)',
        }}
      />
      <span className="relative z-10 text-sm">{label}</span>
      <span className="relative z-10 ml-auto text-sm tabular-nums font-medium shrink-0 flex items-baseline gap-2">
        {subRight && <span className="text-xs text-muted-foreground font-normal">{subRight}</span>}
        {right}
      </span>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground leading-none mb-1">{label}</p>
      <p className="text-sm tabular-nums font-medium leading-snug">{value}</p>
    </div>
  );
}

/**
 * Pack ladder for a tier, reading the generic `packs` list first and falling
 * back to the original pack5/pack10 fields for venues configured with those.
 */
function tierPacks(tier: VenuePricingConfig['tiers'][number]): VenuePricingPack[] {
  if (tier.packs?.length) return [...tier.packs].sort((a, b) => a.size - b.size);
  const legacy: VenuePricingPack[] = [];
  if (tier.pack5PerVisit) legacy.push({ size: 5, perVisit: tier.pack5PerVisit });
  if (tier.pack10PerVisit) legacy.push({ size: 10, perVisit: tier.pack10PerVisit });
  return legacy;
}

/** Whole dollars stay bare; cents get both places. Thousands are grouped. */
function money(amount: number): string {
  return amount.toLocaleString('en-AU', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Pricing is static venue reference data and does not depend on session
 * history, so it is exported for the report's empty state — a venue we have not
 * yet observed a completed session for still has a pricing model worth showing.
 */
export function PricingTable({ pricing }: { pricing: VenuePricingConfig }) {
  const currency = pricing.currency ?? '$';

  return (
    <div>
      {/* One stacked block per session tier. A single wide table would need
          horizontal scrolling once a venue sells more than a couple of pack
          sizes (Blue Mountains sells five), and a scrolling table hides the
          cheapest rates off-screen — which are the ones worth seeing. Stacking
          keeps every rate visible at any width, and the per-visit column stays
          vertically aligned so the discount ladder reads straight down. */}
      <div className="space-y-2 mb-4">
        {pricing.tiers.map(tier => {
          const packs = tierPacks(tier);
          return (
            <div key={tier.label} className="border border-border rounded-lg overflow-hidden">
              {/* Casual rate. Shown per-visit like every row beneath it so the
                  right-hand column is directly comparable top to bottom. */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-3 px-3 py-2.5 bg-muted/40">
                <span className="text-sm font-medium">{tier.label}</span>
                <span />
                <span className="text-sm tabular-nums font-medium text-right">
                  {currency}{money(tier.casualRate)}
                </span>
                <span className="text-sm text-muted-foreground">/visit</span>
              </div>

              {packs.map(pack => (
                <div
                  key={pack.size}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-3 px-3 py-2 text-sm border-t border-border"
                >
                  <span className="text-muted-foreground">{pack.size}-Pack</span>
                  <span className="text-xs tabular-nums text-muted-foreground/70 text-right">
                    {pack.total !== undefined ? `${currency}${money(pack.total)}` : ''}
                  </span>
                  <span className="tabular-nums text-right">
                    {currency}{money(pack.perVisit)}
                  </span>
                  <span className="text-muted-foreground">/visit</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Memberships */}
      {pricing.memberships && pricing.memberships.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden mb-3">
          <div className="grid grid-cols-[1fr_auto] text-[11px] font-medium text-muted-foreground bg-muted/40 px-3 py-2">
            <span>Membership</span>
            <span className="text-right">Price</span>
          </div>
          {pricing.memberships.map(m => (
            <div key={m.label} className="grid grid-cols-[1fr_auto] items-start px-3 py-2.5 text-sm border-t border-border first:border-t-0 gap-3">
              <div>
                <p className="font-medium">{m.label}</p>
                {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
              </div>
              <span className="tabular-nums text-right whitespace-nowrap">{m.price}</span>
            </div>
          ))}
        </div>
      )}

      {/* Private / group hire — priced per booking, not per visit, so it sits
          outside the per-visit ladder above. */}
      {pricing.privateHire && pricing.privateHire.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden mb-3">
          <div className="grid grid-cols-[1fr_auto] text-[11px] font-medium text-muted-foreground bg-muted/40 px-3 py-2">
            <span>Private hire</span>
            <span className="text-right">Per booking</span>
          </div>
          {pricing.privateHire.map(h => (
            <div key={h.label} className="grid grid-cols-[1fr_auto] items-start px-3 py-2.5 text-sm border-t border-border first:border-t-0 gap-3">
              <div>
                <p className="font-medium">{h.label}</p>
                {h.description && <p className="text-xs text-muted-foreground mt-0.5">{h.description}</p>}
              </div>
              <span className="tabular-nums text-right whitespace-nowrap">{h.price}</span>
            </div>
          ))}
        </div>
      )}

      {pricing.note && (
        <p className="text-xs text-muted-foreground">{pricing.note}</p>
      )}
    </div>
  );
}

const MAX_TIERS_SHOWN = 5;

function DerivedPricingDisplay({ sessions, metrics }: { sessions: MomenceSession[]; metrics: BenchmarkMetrics }) {
  // Price distribution from fixedTicketPrice, for venues with no config.
  // Ordered by how common each price is — see src/lib/priceTiers.ts.
  const tiers = useMemo(() => derivePriceTiers(sessions), [sessions]);

  if (tiers.length === 0) return <p className="text-sm text-muted-foreground">No pricing data available.</p>;

  const shown = tiers.slice(0, MAX_TIERS_SHOWN);
  const hidden = tiers.length - shown.length;
  const shownPct = shown.reduce((sum, t) => sum + t.pct, 0);

  return (
    <div className="space-y-1">
      {shown.map(t => (
        <StatRow
          key={t.price}
          label={formatPrice(t.price)}
          pct={(t.pct / t.maxPct) * 100}
          right={`${t.pct.toFixed(0)}% of listings`}
        />
      ))}
      {hidden > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          {shownPct.toFixed(0)}% of listings shown — {hidden} rarer price{hidden === 1 ? '' : 's'} not listed.
        </p>
      )}
      {metrics.avgPrice > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          Average listed price ${metrics.avgPrice.toFixed(0)} — actual revenue per guest is lower when packs or memberships apply.
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface OperatingModelProps {
  sessions: MomenceSession[];
  metrics: BenchmarkMetrics;
  hostId?: string;
}

export function OperatingModel({ sessions, metrics, hostId }: OperatingModelProps) {
  const venueConfig = useMemo(() => VENUES.find(v => v.id === hostId), [hostId]);

  const modalDuration = useMemo(() => getModalDuration(sessions), [sessions]);
  const composition = useMemo(() => buildComposition(sessions, modalDuration), [sessions, modalDuration]);
  const concurrent = useMemo(() => computePeakConcurrent(sessions), [sessions]);
  const increment = useMemo(() => computeSessionIncrement(sessions), [sessions]);
  const overbooking = useMemo(() => computeOverbooking(sessions), [sessions]);

  if (sessions.length === 0) return null;

  const avgOccupancy = metrics.totalCapacity > 0
    ? (metrics.totalVisits / metrics.totalCapacity) * 100
    : 0;

  const sessionsPerDay = metrics.totalSessions / Math.max(metrics.daysInRange, 1);
  const { weekdayStart, weekdayEnd, weekendStart, weekendEnd } = metrics.operatingHours;
  const sameHours = weekdayStart === weekendStart && weekdayEnd === weekendEnd;

  const maxSessionPct = Math.max(...composition.map(c => c.sessionPct), 1);

  const hasMembershipSignal = overbooking.pct >= 2;

  return (
    <Card className="print-section">
      <CardContent className="px-4 py-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <p className="text-lg font-semibold">Sessions</p>
          <div className="text-right">
            <p className="text-[22px] font-semibold tabular-nums leading-none tracking-[-0.03em]">
              {avgOccupancy.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">average occupancy</p>
          </div>
        </div>

        {/* 1 · Structure ────────────────────────────────────────────────── */}
        <div className="mb-6">
          <SectionLabel>Structure</SectionLabel>
          <div className="space-y-1">
            <StatRow label="Typical session length" pct={100} right={`${modalDuration} min`} />
            {increment !== null && (
              <StatRow
                label="Time between sessions"
                pct={(increment / modalDuration) * 100}
                right={`Every ${increment} min`}
              />
            )}
            <StatRow
              label="Sessions per day"
              pct={Math.min((sessionsPerDay / 25) * 100, 100)}
              right={sessionsPerDay.toFixed(1)}
            />
            {metrics.modalCapacity > 0 && (
              <StatRow
                label="Guests per session"
                pct={Math.min((metrics.modalCapacity / (concurrent.peak || metrics.modalCapacity)) * 100, 100)}
                right={`${metrics.modalCapacity} guests`}
              />
            )}
            <StatRow
              label="Peak simultaneous guests"
              pct={100}
              right={`${concurrent.peak}`}
            />
            <StatRow
              label="Typical simultaneous guests"
              pct={(concurrent.p75 / Math.max(concurrent.peak, 1)) * 100}
              right={`${concurrent.p75}`}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {sameHours
              ? `${fmtHour(weekdayStart)}–${fmtHour(weekdayEnd)} daily`
              : `Weekday ${fmtHour(weekdayStart)}–${fmtHour(weekdayEnd)} · Weekend ${fmtHour(weekendStart)}–${fmtHour(weekendEnd)}`
            }
            {' · '}Peak = all-time high. Typical = 75th-percentile load.
          </p>
        </div>

        {/* 2 · Visit mix ───────────────────────────────────────────────── */}
        <div className="pt-5 border-t border-border mb-6">
          <SectionLabel>Visit mix</SectionLabel>
          <div className="space-y-1 mb-4">
            {composition.map(c => {
              const fillPct = c.totalCapacity > 0 ? (c.totalVisitors / c.totalCapacity) * 100 : 0;
              return (
                <StatRow
                  key={c.kind}
                  label={c.label}
                  pct={(c.sessionPct / maxSessionPct) * 100}
                  right={`${c.sessionPct.toFixed(0)}%`}
                  subRight={`${c.totalVisitors.toLocaleString()} guests · ${fillPct.toFixed(0)}% fill`}
                  dimBar={c.kind !== 'bath'}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mb-4">
            <Stat label="Total guests" value={metrics.totalVisits.toLocaleString()} />
            <Stat label="Average fill" value={`${avgOccupancy.toFixed(1)}%`} />
            {hasMembershipSignal && (
              <Stat label="Above-cap bookings" value={`${overbooking.count} (${overbooking.pct.toFixed(0)}%)`} />
            )}
          </div>

          {hasMembershipSignal && (
            <p className="text-xs text-muted-foreground">
              {overbooking.pct.toFixed(0)}% of sessions were booked beyond the session cap — a sign of membership use. The real share is higher: members who book within capacity are indistinguishable from casual guests in this data.
            </p>
          )}
        </div>

        {/* 3 · Pricing ──────────────────────────────────────────────────── */}
        <div className="pt-5 border-t border-border">
          <SectionLabel>Pricing</SectionLabel>
          {venueConfig?.pricing ? (
            <PricingTable pricing={venueConfig.pricing} />
          ) : (
            <DerivedPricingDisplay sessions={sessions} metrics={metrics} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
