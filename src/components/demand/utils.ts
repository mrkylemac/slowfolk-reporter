import { parseISO, format } from 'date-fns';
import type { MomenceSession } from '@/types/momence';
import type { OperatingHours } from '@/lib/benchmarkMetrics';
import { generateTimeSlots } from '@/lib/metricsCalculator';

// ── Types ──

export interface SlotSummary {
  slot: string;
  utilisation: number;
  sessionCount: number;
  avgVisitors: number;
}

export interface AggregatedSlot {
  time: string;
  duration: string;
  count: number;
  occupancyPct: number;
  avgBooked: number;
  capacity: number;
}

export interface DetailTarget {
  name: string;
  dayIndex: number;
  visitors: number;
  dateCount: number;
}

export interface MonthGroup {
  monthKey: string;
  monthLabel: string;
  dateGroups: { date: string; sessions: MomenceSession[] }[];
  avgOccupancyPct: number;
  totalVisitors: number;
  sessionCount: number;
}

export interface DayOfWeekEntry {
  name: string;
  dayIndex: number;
  visitors: number;
  sessions: number;
  isWeekend: boolean;
  pctOfPeak: number;
}

// ── Constants ──

export const AGGREGATE_THRESHOLD = 2;

// ── Fast Helper ──

function parseDate(iso: string): Date {
  return new Date(iso);
}

// ── Helpers ──

export function formatSessionTime(iso: string): string {
  return format(parseDate(iso), 'h:mmaaa');
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  return mins === 60 ? '1 hr' : `${mins / 60} hrs`;
}

// ── Data builders ──

/**
 * Optimised buildDayOfWeekData:
 * Single pass over sessions using fast native date parsing and indexed array lookup.
 */
export function buildDayOfWeekData(sessions: MomenceSession[]): DayOfWeekEntry[] {
  const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const visitors = [0, 0, 0, 0, 0, 0, 0];
  const sessionCounts = [0, 0, 0, 0, 0, 0, 0];

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const day = parseDate(s.startsAt).getDay();
    visitors[day] += s.ticketsSold;
    sessionCounts[day] += 1;
  }

  let maxVisitors = 0;
  for (let i = 0; i < 7; i++) {
    if (visitors[i] > maxVisitors) maxVisitors = visitors[i];
  }

  return DAY_ORDER.map((d, i) => {
    const vis = visitors[d];
    return {
      name: DAY_NAMES[i],
      dayIndex: d,
      visitors: vis,
      sessions: sessionCounts[d],
      isWeekend: d === 0 || d === 6,
      pctOfPeak: maxVisitors > 0 ? (vis / maxVisitors) * 100 : 0,
    };
  });
}

/**
 * Optimised buildSessionsForDay:
 * Single pass date parsing, and Date.parse sorting without creating Date objects.
 */
export function buildSessionsForDay(sessions: MomenceSession[], dayIndex: number) {
  const byDate = new Map<string, MomenceSession[]>();

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const parsed = parseDate(s.startsAt);
    if (parsed.getDay() !== dayIndex) continue;

    const date = format(parsed, 'yyyy-MM-dd');
    let daySessions = byDate.get(date);
    if (!daySessions) {
      daySessions = [];
      byDate.set(date, daySessions);
    }
    daySessions.push(s);
  }

  const sortedDates = Array.from(byDate.keys()).sort();

  return sortedDates.map(date => {
    const daySessions = byDate.get(date)!;
    // Fast native Date.parse comparison without allocating Date objects during sort
    daySessions.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return { date, sessions: daySessions };
  });
}

/**
 * Optimised buildAggregatedSlots:
 * Single pass native date parsing per matching session.
 */
export function buildAggregatedSlots(sessions: MomenceSession[], dayIndex: number): AggregatedSlot[] {
  const bySlot = new Map<string, {
    totalBooked: number; totalCapacity: number; count: number;
    duration: number; capacity: number[];
    minutesSinceMidnight: number;
  }>();

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const parsed = parseDate(s.startsAt);
    if (parsed.getDay() !== dayIndex) continue;

    const key = format(parsed, 'h:mmaaa');
    const mins = parsed.getHours() * 60 + parsed.getMinutes();
    let slot = bySlot.get(key);
    if (!slot) {
      slot = {
        totalBooked: 0,
        totalCapacity: 0,
        count: 0,
        duration: s.durationMinutes,
        capacity: [],
        minutesSinceMidnight: mins,
      };
      bySlot.set(key, slot);
    }
    slot.totalBooked += s.ticketsSold;
    slot.totalCapacity += s.capacity;
    slot.count += 1;
    slot.capacity.push(s.capacity);
  }

  return Array.from(bySlot.entries())
    .sort(([, a], [, b]) => a.minutesSinceMidnight - b.minutesSinceMidnight)
    .map(([time, data]) => {
      const capCounts = new Map<number, number>();
      for (let j = 0; j < data.capacity.length; j++) {
        const c = data.capacity[j];
        capCounts.set(c, (capCounts.get(c) ?? 0) + 1);
      }
      let modalCap = data.capacity[0] ?? 0;
      let maxCount = 0;
      capCounts.forEach((cnt, cap) => { if (cnt > maxCount) { maxCount = cnt; modalCap = cap; } });

      return {
        time,
        duration: formatDuration(data.duration),
        count: data.count,
        occupancyPct: data.totalCapacity > 0 ? (data.totalBooked / data.totalCapacity) * 100 : 0,
        avgBooked: data.count > 0 ? data.totalBooked / data.count : 0,
        capacity: modalCap,
      };
    });
}

export function buildMonthlyGroupedSessions(sessions: MomenceSession[], dayIndex: number): MonthGroup[] {
  const dateGroups = buildSessionsForDay(sessions, dayIndex);

  const monthMap = new Map<string, {
    dateGroups: { date: string; sessions: MomenceSession[] }[];
    totalBooked: number;
    totalCap: number;
    sessionCount: number;
  }>();

  for (let i = 0; i < dateGroups.length; i++) {
    const group = dateGroups[i];
    const monthKey = group.date.substring(0, 7);
    let month = monthMap.get(monthKey);
    if (!month) {
      month = { dateGroups: [], totalBooked: 0, totalCap: 0, sessionCount: 0 };
      monthMap.set(monthKey, month);
    }
    month.dateGroups.push(group);
    for (let j = 0; j < group.sessions.length; j++) {
      const s = group.sessions[j];
      month.totalBooked += s.ticketsSold;
      month.totalCap += s.capacity;
      month.sessionCount += 1;
    }
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, data]) => ({
      monthKey,
      monthLabel: format(parseISO(`${monthKey}-01`), 'MMMM yyyy'),
      dateGroups: data.dateGroups,
      avgOccupancyPct: data.totalCap > 0 ? (data.totalBooked / data.totalCap) * 100 : 0,
      totalVisitors: data.totalBooked,
      sessionCount: data.sessionCount,
    }));
}

/**
 * Optimised buildSlotSummaries:
 * Indexed array slot accumulation and single-pass session iteration with native date parsing.
 */
export function buildSlotSummaries(
  sessions: MomenceSession[],
  hours: OperatingHours,
  weekend: boolean,
): SlotSummary[] {
  const timeSlots = generateTimeSlots(hours);
  const slotCount = timeSlots.length;
  const slotData = new Array<{ totalTickets: number; totalCapacity: number; count: number }>(slotCount);
  for (let i = 0; i < slotCount; i++) {
    slotData[i] = { totalTickets: 0, totalCapacity: 0, count: 0 };
  }

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const date = parseDate(s.startsAt);
    const day = date.getDay();
    const isWeekendDay = day === 0 || day === 6;
    if (weekend ? !isWeekendDay : isWeekendDay) continue;

    const h = date.getHours() + date.getMinutes() / 60;
    for (let j = 0; j < slotCount; j++) {
      const slot = timeSlots[j];
      if (h >= slot.start && h < slot.end) {
        const data = slotData[j];
        data.totalTickets += s.ticketsSold;
        data.totalCapacity += s.capacity;
        data.count += 1;
        break;
      }
    }
  }

  const results: SlotSummary[] = [];
  for (let i = 0; i < slotCount; i++) {
    const data = slotData[i];
    if (data.count === 0) continue;
    results.push({
      slot: timeSlots[i].label,
      utilisation: data.totalCapacity > 0 ? (data.totalTickets / data.totalCapacity) * 100 : 0,
      sessionCount: data.count,
      avgVisitors: Math.round((data.totalTickets / data.count) * 10) / 10,
    });
  }

  return results.sort((a, b) => b.utilisation - a.utilisation);
}

/**
 * Optimised computeOccupancyPct:
 * Simple tight loop without .reduce closures.
 */
export function computeOccupancyPct(subset: MomenceSession[]): number {
  let totalCap = 0;
  let totalBooked = 0;
  for (let i = 0; i < subset.length; i++) {
    totalCap += subset[i].capacity;
    totalBooked += subset[i].ticketsSold;
  }
  return totalCap > 0 ? (totalBooked / totalCap) * 100 : 0;
}
