import { format, parseISO, differenceInDays, getHours, getMinutes } from 'date-fns';
import type {
  MomenceSession,
  SessionMetrics,
  MonthlyData,
  TimeSlotData,
  VenueConfig,
  ClassTypeData
} from '@/types/momence';
import type { OperatingHours } from '@/lib/benchmarkMetrics';
import { formatDecimalHour } from '@/lib/utils';

export interface TimeSlot {
  label: string;
  start: number;  // Decimal hour (e.g., 6.5 for 6:30am)
  end: number;    // Decimal hour (e.g., 8.5 for 8:30am)
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function utcDecimalHour(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

/**
 * Calculate core metrics from sessions data
 */
export function calculateMetrics(sessions: MomenceSession[], fromDate: string, toDate: string): SessionMetrics {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      totalTicketsSold: 0,
      totalCapacity: 0,
      avgUtilisation: 0,
      totalRevenue: 0,
      avgRevenuePerVisit: 0,
      avgRevenuePerSession: 0,
      sessionsPerDay: 0,
      sessionsPerWeek: 0,
      operatingSince: '-',
    };
  }

  let totalTicketsSold = 0;
  let totalCapacity = 0;
  let totalRevenue = 0;
  let earliestStartsAt = sessions[0].startsAt;

  // Single O(N) pass to accumulate totals and track the earliest session start ISO timestamp,
  // avoiding array cloning and O(N log N) sorting.
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    totalTicketsSold += s.ticketsSold;
    totalCapacity += s.capacity;
    totalRevenue += s.ticketsSold * s.fixedTicketPrice;
    if (s.startsAt < earliestStartsAt) {
      earliestStartsAt = s.startsAt;
    }
  }

  const totalSessions = sessions.length;
  const avgUtilisation = totalCapacity > 0 ? (totalTicketsSold / totalCapacity) * 100 : 0;
  const avgRevenuePerVisit = totalTicketsSold > 0 ? totalRevenue / totalTicketsSold : 0;
  const avgRevenuePerSession = totalSessions > 0 ? totalRevenue / totalSessions : 0;

  const daysDiff = differenceInDays(parseISO(toDate), parseISO(fromDate)) + 1;
  const sessionsPerDay = daysDiff > 0 ? totalSessions / daysDiff : 0;
  const sessionsPerWeek = sessionsPerDay * 7;

  const operatingSince = earliestStartsAt
    ? format(parseISO(earliestStartsAt), 'MMMM yyyy')
    : '-';

  return {
    totalSessions,
    totalTicketsSold,
    totalCapacity,
    avgUtilisation,
    totalRevenue,
    avgRevenuePerVisit,
    avgRevenuePerSession,
    sessionsPerDay,
    sessionsPerWeek,
    operatingSince,
  };
}

/**
 * Group sessions by month and calculate monthly metrics
 */
export function calculateMonthlyData(sessions: MomenceSession[]): MonthlyData[] {
  const monthlyMap = new Map<string, { year: number; monthIndex: number; sessionsCount: number; ticketsSold: number; capacity: number; revenue: number }>();

  // Single pass to accumulate monthly running totals directly without storing session objects
  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const date = new Date(session.startsAt);
    const year = date.getUTCFullYear();
    const monthIndex = date.getUTCMonth();
    const monthKey = `${year}-${String(monthIndex).padStart(2, '0')}`;
    
    let entry = monthlyMap.get(monthKey);
    if (!entry) {
      entry = { year, monthIndex, sessionsCount: 0, ticketsSold: 0, capacity: 0, revenue: 0 };
      monthlyMap.set(monthKey, entry);
    }
    entry.sessionsCount += 1;
    entry.ticketsSold += session.ticketsSold;
    entry.capacity += session.capacity;
    entry.revenue += session.ticketsSold * session.fixedTicketPrice;
  }

  // Sort accumulated monthly entries by year then numeric monthIndex directly
  const sortedEntries = Array.from(monthlyMap.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.monthIndex - b.monthIndex;
  });

  return sortedEntries.map(data => ({
    month: MONTH_NAMES[data.monthIndex],
    year: data.year,
    sessions: data.sessionsCount,
    ticketsSold: data.ticketsSold,
    capacity: data.capacity,
    utilisation: data.capacity > 0 ? (data.ticketsSold / data.capacity) * 100 : 0,
    revenue: data.revenue,
  }));
}

/**
 * Default time slots for demand analysis (used as fallback)
 */
const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { label: '4:30 – 6:30am', start: 4.5, end: 6.5 },
  { label: '6:30 – 8:30am', start: 6.5, end: 8.5 },
  { label: '8:30 – 10:30am', start: 8.5, end: 10.5 },
  { label: '10:30am – 12:30pm', start: 10.5, end: 12.5 },
  { label: '12:30 – 2:30pm', start: 12.5, end: 14.5 },
  { label: '2:30 – 4:30pm', start: 14.5, end: 16.5 },
  { label: '4:30 – 6:30pm', start: 16.5, end: 18.5 },
  { label: '6:30 – 8:30pm', start: 18.5, end: 20.5 },
  { label: '8:30 – 10:30pm', start: 20.5, end: 22.5 },
];

/**
 * Generate time slots dynamically based on operating hours.
 * Creates 2-hour slots covering the venue's actual operating window.
 *
 * @param operatingHours - The venue's operating hours (weekday/weekend)
 * @param slotDuration - Duration of each slot in hours (default 2)
 * @returns Array of time slots
 */
export function generateTimeSlots(operatingHours: OperatingHours, slotDuration = 2): TimeSlot[] {
  // Use the earlier start and later end across weekday/weekend
  const earliestStart = Math.min(operatingHours.weekdayStart, operatingHours.weekendStart);
  const latestEnd = Math.max(operatingHours.weekdayEnd, operatingHours.weekendEnd);

  // Round down start to nearest half hour, round up end to nearest half hour
  const start = Math.floor(earliestStart * 2) / 2;
  const end = Math.ceil(latestEnd * 2) / 2;

  const slots: TimeSlot[] = [];
  for (let slotStart = start; slotStart < end; slotStart += slotDuration) {
    const slotEnd = Math.min(slotStart + slotDuration, end);
    const label = `${formatDecimalHour(slotStart)} – ${formatDecimalHour(slotEnd)}`;
    slots.push({ label, start: slotStart, end: slotEnd });
  }

  return slots.length > 0 ? slots : DEFAULT_TIME_SLOTS;
}

/**
 * Calculate demand patterns by time slot
 *
 * @param sessions - Array of sessions to analyze
 * @param timeSlots - Optional custom time slots (if not provided, uses default)
 */
export function calculateDemandPatterns(
  sessions: MomenceSession[],
  timeSlots?: TimeSlot[]
): TimeSlotData[] {
  const slots = timeSlots || DEFAULT_TIME_SLOTS;
  const slotData: Map<string, { tickets: number[]; capacities: number[] }> = new Map();

  slots.forEach(slot => {
    slotData.set(slot.label, { tickets: [], capacities: [] });
  });

  sessions.forEach(session => {
    const hours = utcDecimalHour(session.startsAt);

    for (const slot of slots) {
      if (hours >= slot.start && hours < slot.end) {
        const data = slotData.get(slot.label)!;
        data.tickets.push(session.ticketsSold);
        data.capacities.push(session.capacity);
        break;
      }
    }
  });

  const results: TimeSlotData[] = [];

  slotData.forEach((data, slot) => {
    if (data.tickets.length > 0) {
      const avgTickets = data.tickets.reduce((a, b) => a + b, 0) / data.tickets.length;
      const avgCapacity = data.capacities.reduce((a, b) => a + b, 0) / data.capacities.length;
      const utilisation = avgCapacity > 0 ? (avgTickets / avgCapacity) * 100 : 0;

      let utilisationBand: 'High' | 'Medium' | 'Low';
      if (utilisation >= 70) utilisationBand = 'High';
      else if (utilisation >= 40) utilisationBand = 'Medium';
      else utilisationBand = 'Low';

      results.push({
        slot,
        avgTickets: Math.round(avgTickets * 10) / 10,
        capacity: Math.round(avgCapacity),
        utilisation: Math.round(utilisation * 10) / 10,
        utilisationBand,
      });
    }
  });

  return results;
}

/**
 * Calculate venue configuration from sessions
 */
export function calculateVenueConfig(sessions: MomenceSession[], fromDate: string, toDate: string): VenueConfig {
  if (sessions.length === 0) {
    return {
      venueName: '-',
      sessionType: 'Sauna & Ice',
      duration: 60,
      price: 35,
      capacity: 12,
      sessionsPerDay: 0,
      operatingHours: '-',
    };
  }

  // Get venue name from location
  const locations = sessions.map(s => s.location).filter(l => l);
  const venueName = getMostCommon(locations) || 'Unknown Venue';

  // Get most common values
  const sessionTypes = sessions.map(s => s.sessionName);
  const sessionType = getMostCommon(sessionTypes) || 'Sauna & Ice';

  const durations = sessions.map(s => s.durationMinutes);
  const duration = getMostCommon(durations) || 60;

  const prices = sessions.map(s => s.fixedTicketPrice);
  const price = getMostCommon(prices) || 35;

  const capacities = sessions.map(s => s.capacity);
  const capacity = getMostCommon(capacities) || 12;

  const daysDiff = differenceInDays(parseISO(toDate), parseISO(fromDate)) + 1;
  const sessionsPerDay = daysDiff > 0 ? Math.round((sessions.length / daysDiff) * 10) / 10 : 0;

  // Find operating hours using session start and end times
  const startTimes = sessions.map(s => {
    return utcDecimalHour(s.startsAt);
  });
  const endTimes = sessions.map(s => {
    const startHour = utcDecimalHour(s.startsAt);
    return startHour + (s.durationMinutes || 60) / 60;
  });
  const minTime = Math.min(...startTimes);
  const maxTime = Math.max(...endTimes);
  const operatingHours = `${formatDecimalHour(minTime)} – ${formatDecimalHour(maxTime)}`;

  return {
    venueName,
    sessionType,
    duration,
    price,
    capacity,
    sessionsPerDay,
    operatingHours,
  };
}

function getMostCommon<T>(arr: T[]): T | undefined {
  const counts = new Map<T, number>();
  arr.forEach(item => {
    counts.set(item, (counts.get(item) || 0) + 1);
  });
  let maxCount = 0;
  let maxItem: T | undefined;
  counts.forEach((count, item) => {
    if (count > maxCount) {
      maxCount = count;
      maxItem = item;
    }
  });
  return maxItem;
}

/**
 * Calculate class type breakdown from sessions
 */
export function calculateClassTypeData(sessions: MomenceSession[]): ClassTypeData[] {
  const classMap = new Map<string, MomenceSession[]>();

  sessions.forEach(session => {
    const className = session.sessionName || 'Unknown';
    if (!classMap.has(className)) {
      classMap.set(className, []);
    }
    classMap.get(className)!.push(session);
  });

  const results: ClassTypeData[] = [];

  classMap.forEach((classSessions, className) => {
    const sessionCount = classSessions.length;
    const totalVisitors = classSessions.reduce((sum, s) => sum + s.ticketsSold, 0);
    const totalCapacity = classSessions.reduce((sum, s) => sum + s.capacity, 0);
    const avgUtilisation = totalCapacity > 0 ? (totalVisitors / totalCapacity) * 100 : 0;
    const totalRevenue = classSessions.reduce((sum, s) => sum + (s.ticketsSold * s.fixedTicketPrice), 0);

    results.push({
      className,
      sessionCount,
      totalVisitors,
      avgVisitorsPerSession: sessionCount > 0 ? totalVisitors / sessionCount : 0,
      totalCapacity,
      avgUtilisation,
      totalRevenue,
    });
  });

  // Sort by total visitors descending
  return results.sort((a, b) => b.totalVisitors - a.totalVisitors);
}
