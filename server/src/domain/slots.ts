import { DateTime } from 'luxon';
import type { AvailabilityRuleRow } from '../repositories/types.js';

export interface ExpandedSlot {
  startUtc: string;
  endUtc: string;
  mentorLocalDate: string;
}

/**
 * Expand mentor availability rules into concrete UTC time slots (DESIGN.md §4.3).
 *
 * For each date in the range (mentor-local), find matching weekday rules,
 * build start/end in mentor zone, convert to UTC, and cut into 30-min slots.
 * Handles midnight-crossing shifts (endLocal <= startLocal).
 */
export function expandMentorSlots(
  rules: AvailabilityRuleRow[],
  mentorZone: string,
  fromDate: string,
  toDate: string,
  slotMinutes: number,
): ExpandedSlot[] {
  const slots: ExpandedSlot[] = [];
  let current = DateTime.fromISO(fromDate, { zone: mentorZone });
  const end = DateTime.fromISO(toDate, { zone: mentorZone }).endOf('day');

  while (current <= end) {
    const isoWeekday = current.weekday; // 1=Mon ... 7=Sun

    for (const rule of rules) {
      if (rule.weekday !== isoWeekday) continue;

      const [startH, startM] = rule.start_local.split(':').map(Number) as [number, number];
      const [endH, endM] = rule.end_local.split(':').map(Number) as [number, number];

      let shiftStart = current.set({ hour: startH, minute: startM, second: 0, millisecond: 0 });

      // Determine shift end — if end <= start, it crosses midnight into next day
      let shiftEnd: DateTime;
      const crossesMidnight = endH < startH || (endH === startH && endM <= startM);
      if (crossesMidnight) {
        shiftEnd = current.plus({ days: 1 }).set({ hour: endH, minute: endM, second: 0, millisecond: 0 });
      } else {
        shiftEnd = current.set({ hour: endH, minute: endM, second: 0, millisecond: 0 });
      }

      // Convert to UTC and cut into slots
      let slotStart = shiftStart.toUTC();
      const shiftEndUtc = shiftEnd.toUTC();

      while (slotStart < shiftEndUtc) {
        const slotEnd = slotStart.plus({ minutes: slotMinutes });

        // Determine mentor-local date for this slot (for capacity counting)
        const mentorLocal = slotStart.setZone(mentorZone);
        const mentorLocalDate = mentorLocal.toISODate()!;

        slots.push({
          startUtc: slotStart.toISO()!,
          endUtc: slotEnd.toISO()!,
          mentorLocalDate,
        });

        slotStart = slotEnd;
      }
    }

    current = current.plus({ days: 1 }).startOf('day');
  }

  return slots;
}
