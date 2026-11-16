import { describe, it, expect } from 'vitest';
import { eligibleMentors, isSlotAvailable } from '../../src/domain/eligibility.js';
import type { AvailabilityRuleRow } from '../../src/repositories/types.js';

interface MentorWithSlots {
  id: number;
  name: string;
  email: string;
  timezone: string;
  bio: string;
  rules: AvailabilityRuleRow[];
}

interface BookingInfo {
  mentorId: number;
  startUtc: string;
  endUtc: string;
  mentorLocalDate: string;
}

function makeMentor(id: number, rules: AvailabilityRuleRow[] = []): MentorWithSlots {
  return {
    id, name: `Mentor ${id}`, email: `m${id}@test.com`,
    timezone: 'Asia/Kolkata', bio: `Bio ${id}`, rules,
  };
}

function makeRule(mentorId: number, weekday: number, start: string, end: string): AvailabilityRuleRow {
  return { id: 1, mentor_id: mentorId, weekday, start_local: start, end_local: end };
}

function makeBooking(mentorId: number, startUtc: string, mentorLocalDate: string): BookingInfo {
  return {
    mentorId, startUtc,
    endUtc: startUtc.replace(/T(\d{2}):(\d{2})/, (_, h, m) => {
      const mins = parseInt(m) + 30;
      if (mins >= 60) return `T${String(parseInt(h) + 1).padStart(2, '0')}:${String(mins - 60).padStart(2, '0')}`;
      return `T${h}:${String(mins).padStart(2, '0')}`;
    }),
    mentorLocalDate,
  };
}

describe('eligibleMentors', () => {
  // Monday slot: 2026-11-16T14:30:00Z = 20:00 IST Monday
  const slotStartUtc = '2026-11-16T14:30:00.000Z';
  const mentorLocalDate = '2026-11-16';

  it('returns mentor when available with matching rule and no bookings', () => {
    const mentors = [makeMentor(1, [makeRule(1, 1, '20:00', '22:00')])]; // Mon 20:00-22:00 IST
    const result = eligibleMentors(slotStartUtc, mentorLocalDate, mentors, [], 2, 30);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(1);
  });

  it('excludes mentor when booked at that exact slot', () => {
    const mentors = [makeMentor(1, [makeRule(1, 1, '20:00', '22:00')])];
    const bookings = [makeBooking(1, '2026-11-16T14:30:00.000Z', '2026-11-16')];
    const result = eligibleMentors(slotStartUtc, mentorLocalDate, mentors, bookings, 2, 30);
    expect(result).toHaveLength(0);
  });

  it('excludes mentor at capacity (2 bookings on mentor-local day)', () => {
    const mentors = [makeMentor(1, [makeRule(1, 1, '20:00', '23:00')])];
    const bookings = [
      makeBooking(1, '2026-11-16T15:00:00.000Z', '2026-11-16'),
      makeBooking(1, '2026-11-16T15:30:00.000Z', '2026-11-16'),
    ];
    const result = eligibleMentors(slotStartUtc, mentorLocalDate, mentors, bookings, 2, 30);
    expect(result).toHaveLength(0);
  });

  it('capacity is per mentor-local day only — different day OK', () => {
    const mentors = [makeMentor(1, [makeRule(1, 1, '20:00', '23:00')])];
    // 2 bookings on a different day
    const bookings = [
      makeBooking(1, '2026-11-17T15:00:00.000Z', '2026-11-17'),
      makeBooking(1, '2026-11-17T15:30:00.000Z', '2026-11-17'),
    ];
    const result = eligibleMentors(slotStartUtc, mentorLocalDate, mentors, bookings, 2, 30);
    expect(result).toHaveLength(1);
  });

  it('excludes mentor whose rule does not cover the slot', () => {
    // Rule is for Tuesday (weekday 2) but slot is Monday (weekday 1)
    const mentors = [makeMentor(1, [makeRule(1, 2, '20:00', '22:00')])];
    const result = eligibleMentors(slotStartUtc, mentorLocalDate, mentors, [], 2, 30);
    expect(result).toHaveLength(0);
  });

  it('returns multiple eligible mentors', () => {
    const mentors = [
      makeMentor(1, [makeRule(1, 1, '20:00', '22:00')]),
      makeMentor(2, [makeRule(2, 1, '20:00', '22:00')]),
    ];
    const result = eligibleMentors(slotStartUtc, mentorLocalDate, mentors, [], 2, 30);
    expect(result).toHaveLength(2);
  });

  it('mixed: one eligible, one booked', () => {
    const mentors = [
      makeMentor(1, [makeRule(1, 1, '20:00', '22:00')]),
      makeMentor(2, [makeRule(2, 1, '20:00', '22:00')]),
    ];
    const bookings = [makeBooking(1, '2026-11-16T14:30:00.000Z', '2026-11-16')];
    const result = eligibleMentors(slotStartUtc, mentorLocalDate, mentors, bookings, 2, 30);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(2);
  });

  it('populates bookingsOnDay and bookingsInWindow counts', () => {
    const mentors = [makeMentor(1, [makeRule(1, 1, '20:00', '23:00')])];
    const bookings = [makeBooking(1, '2026-11-16T16:00:00.000Z', '2026-11-16')];
    const result = eligibleMentors(slotStartUtc, mentorLocalDate, mentors, bookings, 2, 30);
    expect(result).toHaveLength(1);
    expect(result[0]!.bookingsOnDay).toBe(1);
    expect(result[0]!.bookingsInWindow).toBe(1);
  });
});

describe('isSlotAvailable', () => {
  it('returns true when at least one mentor is eligible', () => {
    const mentors = [makeMentor(1, [makeRule(1, 1, '20:00', '22:00')])];
    const result = isSlotAvailable(
      '2026-11-16T14:30:00.000Z', '2026-11-16', mentors, [],
      '2026-11-16T10:00:00.000Z', 120, 2, 30,
    );
    expect(result).toBe(true);
  });

  it('returns false when no mentor is eligible', () => {
    const mentors = [makeMentor(1, [makeRule(1, 1, '20:00', '22:00')])];
    const bookings = [makeBooking(1, '2026-11-16T14:30:00.000Z', '2026-11-16')];
    const result = isSlotAvailable(
      '2026-11-16T14:30:00.000Z', '2026-11-16', mentors, bookings,
      '2026-11-16T10:00:00.000Z', 120, 2, 30,
    );
    expect(result).toBe(false);
  });

  it('returns false when slot is within lead time', () => {
    const mentors = [makeMentor(1, [makeRule(1, 1, '20:00', '22:00')])];
    // now is 13:00 UTC, slot is 14:30 UTC, lead time 120 min → need 15:00+ to be bookable
    const result = isSlotAvailable(
      '2026-11-16T14:30:00.000Z', '2026-11-16', mentors, [],
      '2026-11-16T13:00:00.000Z', 120, 2, 30,
    );
    expect(result).toBe(false);
  });

  it('returns true when slot is past lead time', () => {
    const mentors = [makeMentor(1, [makeRule(1, 1, '20:00', '22:00')])];
    // now is 12:00 UTC, slot is 14:30 UTC, lead time 120 min → 14:00 cutoff, 14:30 is OK
    const result = isSlotAvailable(
      '2026-11-16T14:30:00.000Z', '2026-11-16', mentors, [],
      '2026-11-16T12:00:00.000Z', 120, 2, 30,
    );
    expect(result).toBe(true);
  });
});
