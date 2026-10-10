import { describe, it, expect } from 'vitest';
import type { MomenceSession } from '@/types/momence';
import {
  buildDayOfWeekData,
  buildAggregatedSlots,
  buildSessionsForDay,
  buildMonthlyGroupedSessions,
  buildSlotSummaries,
} from '@/components/demand/utils';

function generateMockSessions(count: number): MomenceSession[] {
  const sessions: MomenceSession[] = [];
  const baseTime = new Date('2025-01-01T06:00:00Z').getTime();

  for (let i = 0; i < count; i++) {
    const time = new Date(baseTime + i * 3600 * 1000 * 2); // every 2 hours
    sessions.push({
      id: `s-${i}`,
      sessionName: 'Sauna Session',
      startsAt: time.toISOString(),
      endsAt: new Date(time.getTime() + 3600 * 1000).toISOString(),
      durationMinutes: 60,
      capacity: 20,
      ticketsSold: (i % 15) + 1,
      fixedTicketPrice: 35,
      location: 'Bondi',
      inPerson: true,
    });
  }
  return sessions;
}

describe('Demand Utils Performance', () => {
  it('processes 10,000 sessions efficiently across demand analytics functions', () => {
    const sessions = generateMockSessions(10000);
    const operatingHours = { weekdayStart: 6, weekdayEnd: 21, weekendStart: 7, weekendEnd: 19 };

    const start = performance.now();

    for (let i = 0; i < 10; i++) {
      buildDayOfWeekData(sessions);
      buildSlotSummaries(sessions, operatingHours, false);
      buildSlotSummaries(sessions, operatingHours, true);
      buildAggregatedSlots(sessions, 1);
      buildSessionsForDay(sessions, 1);
      buildMonthlyGroupedSessions(sessions, 1);
    }

    const duration = performance.now() - start;
    // Fast processing ceiling to catch future performance regressions
    expect(duration).toBeLessThan(2000);
  });
});
