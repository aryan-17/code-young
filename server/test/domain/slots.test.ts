import { describe, it, expect } from 'vitest';
import { expandMentorSlots } from '../../src/domain/slots.js';
import type { AvailabilityRuleRow } from '../../src/repositories/types.js';

function rule(weekday: number, start: string, end: string, mentorId = 1): AvailabilityRuleRow {
  return { id: 1, mentor_id: mentorId, weekday, start_local: start, end_local: end };
}

describe('expandMentorSlots', () => {
  it('expands a normal evening shift into 30-min UTC slots', () => {
    // Monday (weekday 1) 20:00-22:00 IST
    // IST = UTC+5:30, so 20:00 IST = 14:30 UTC, 22:00 IST = 16:30 UTC
    const rules = [rule(1, '20:00', '22:00')];
    // 2026-11-16 is a Monday
    const slots = expandMentorSlots(rules, 'Asia/Kolkata', '2026-11-16', '2026-11-16', 30);

    expect(slots).toHaveLength(4); // 14:30, 15:00, 15:30, 16:00
    expect(slots[0]!.startUtc).toBe('2026-11-16T14:30:00.000Z');
    expect(slots[1]!.startUtc).toBe('2026-11-16T15:00:00.000Z');
    expect(slots[2]!.startUtc).toBe('2026-11-16T15:30:00.000Z');
    expect(slots[3]!.startUtc).toBe('2026-11-16T16:00:00.000Z');
  });

  it('handles midnight-crossing shift (end <= start)', () => {
    // Monday 20:00-00:30 IST (crosses midnight into Tuesday)
    // 20:00 IST = 14:30 UTC, 00:30 IST next day = 19:00 UTC
    const rules = [rule(1, '20:00', '00:30')];
    // 2026-11-16 is a Monday
    const slots = expandMentorSlots(rules, 'Asia/Kolkata', '2026-11-16', '2026-11-16', 30);

    // 14:30, 15:00, ..., 18:30 = 9 slots (4.5h shift, 9 half-hours)
    expect(slots).toHaveLength(9);
    expect(slots[0]!.startUtc).toBe('2026-11-16T14:30:00.000Z');
    expect(slots[slots.length - 1]!.startUtc).toBe('2026-11-16T18:30:00.000Z');
  });

  it('midnight-crossing shift assigns correct mentor-local dates', () => {
    // Monday 23:00-01:00 IST — 23:00 is Mon, 00:00 and 00:30 are Tue
    const rules = [rule(1, '23:00', '01:00')];
    // 2026-11-16 is a Monday
    const slots = expandMentorSlots(rules, 'Asia/Kolkata', '2026-11-16', '2026-11-16', 30);

    // 23:00 IST = 17:30 UTC, 23:30 IST = 18:00 UTC (both Mon local)
    // 00:00 IST = 18:30 UTC, 00:30 IST = 19:00 UTC (both Tue local)
    expect(slots).toHaveLength(4);
    expect(slots[0]!.mentorLocalDate).toBe('2026-11-16'); // Mon
    expect(slots[1]!.mentorLocalDate).toBe('2026-11-16'); // Mon
    expect(slots[2]!.mentorLocalDate).toBe('2026-11-17'); // Tue
    expect(slots[3]!.mentorLocalDate).toBe('2026-11-17'); // Tue
  });

  it('slot grid is always :00 or :30 UTC', () => {
    const rules = [rule(1, '20:00', '23:00')];
    const slots = expandMentorSlots(rules, 'Asia/Kolkata', '2026-11-16', '2026-11-16', 30);

    for (const slot of slots) {
      const minute = new Date(slot.startUtc).getUTCMinutes();
      expect([0, 30]).toContain(minute);
    }
  });

  it('returns empty when no rule matches weekday', () => {
    // Rule for Tuesday (2), but date is Monday
    const rules = [rule(2, '20:00', '22:00')];
    const slots = expandMentorSlots(rules, 'Asia/Kolkata', '2026-11-16', '2026-11-16', 30);
    expect(slots).toHaveLength(0);
  });

  it('expands across multiple days', () => {
    // Mon + Tue rules
    const rules = [
      rule(1, '20:00', '21:00'), // Mon: 2 slots
      rule(2, '20:00', '21:00'), // Tue: 2 slots
    ];
    // Mon 2026-11-16, Tue 2026-11-17
    const slots = expandMentorSlots(rules, 'Asia/Kolkata', '2026-11-16', '2026-11-17', 30);
    expect(slots).toHaveLength(4);
  });

  it('US-evening shift (02:00-07:00 IST, not crossing midnight)', () => {
    // Tuesday rule (2): 02:00-07:00 IST
    // 02:00 IST = 20:30 UTC (prev day), 07:00 IST = 01:30 UTC
    // Wait — 02:00 IST on Tue = Mon 20:30 UTC. This is a regular shift, not midnight-crossing.
    // Actually 02:00 < 07:00 so it's NOT midnight-crossing.
    const rules = [rule(2, '02:00', '07:00')];
    // 2026-11-17 is a Tuesday
    const slots = expandMentorSlots(rules, 'Asia/Kolkata', '2026-11-17', '2026-11-17', 30);

    // 02:00 IST = 20:30 UTC (Nov 16), 07:00 IST = 01:30 UTC (Nov 17)
    // 10 slots: 20:30, 21:00, ..., 01:00
    expect(slots).toHaveLength(10);
    // First slot is on the previous UTC day
    expect(slots[0]!.startUtc).toBe('2026-11-16T20:30:00.000Z');
    // All slots should have mentorLocalDate = 2026-11-17 (Tuesday IST)
    for (const slot of slots) {
      expect(slot.mentorLocalDate).toBe('2026-11-17');
    }
  });
});
