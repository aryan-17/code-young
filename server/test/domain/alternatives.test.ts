import { describe, it, expect } from 'vitest';
import { findAlternatives } from '../../src/domain/alternatives.js';

interface AvailableSlot {
  startUtc: string;
  available: boolean;
}

function slot(utc: string, available = true): AvailableSlot {
  return { startUtc: utc, available };
}

describe('findAlternatives', () => {
  // Parent in America/New_York
  const parentZone = 'America/New_York';

  // Requested: 2026-11-20T21:00:00Z = 4:00 PM ET
  const requestedUtc = '2026-11-20T21:00:00Z';

  it('returns nearest available on same parent-local day', () => {
    const allSlots = [
      slot('2026-11-20T20:00:00Z'), // 3:00 PM ET — before
      slot('2026-11-20T20:30:00Z'), // 3:30 PM ET — closer before
      slot('2026-11-20T21:00:00Z', false), // 4:00 PM ET — requested, unavailable
      slot('2026-11-20T21:30:00Z'), // 4:30 PM ET — closest after
      slot('2026-11-20T22:00:00Z'), // 5:00 PM ET
    ];
    const result = findAlternatives(requestedUtc, allSlots, parentZone, 6);

    // Should include same-day slots, sorted by closeness
    expect(result.length).toBeGreaterThan(0);
    // Closest should be 4:30 PM or 3:30 PM (both 30 min away)
    const utcs = result.map(s => s.startUtc);
    expect(utcs).toContain('2026-11-20T21:30:00Z');
    expect(utcs).toContain('2026-11-20T20:30:00Z');
  });

  it('returns same parent-local time on next available days', () => {
    const allSlots = [
      slot('2026-11-20T21:00:00Z', false), // requested, unavailable
      slot('2026-11-21T21:00:00Z'), // same time next day
      slot('2026-11-22T21:00:00Z'), // same time day after
    ];
    const result = findAlternatives(requestedUtc, allSlots, parentZone, 6);
    const utcs = result.map(s => s.startUtc);
    expect(utcs).toContain('2026-11-21T21:00:00Z');
  });

  it('returns earliest available slot overall', () => {
    const allSlots = [
      slot('2026-11-18T14:00:00Z'), // earliest
      slot('2026-11-20T21:00:00Z', false), // requested
      slot('2026-11-25T21:00:00Z'), // far away
    ];
    const result = findAlternatives(requestedUtc, allSlots, parentZone, 6);
    const utcs = result.map(s => s.startUtc);
    expect(utcs).toContain('2026-11-18T14:00:00Z');
  });

  it('deduplicates slots', () => {
    // A slot that is both "nearest on same day" and "earliest overall"
    const allSlots = [
      slot('2026-11-20T21:00:00Z', false),
      slot('2026-11-20T21:30:00Z'), // this is nearest on same day AND earliest overall
    ];
    const result = findAlternatives(requestedUtc, allSlots, parentZone, 6);
    const utcs = result.map(s => s.startUtc);
    const unique = new Set(utcs);
    expect(utcs.length).toBe(unique.size); // no dupes
  });

  it('returns at most `limit` alternatives', () => {
    const allSlots = Array.from({ length: 20 }, (_, i) =>
      slot(`2026-11-20T${String(10 + i).padStart(2, '0')}:00:00Z`, i !== 11), // index 11 = requested
    );
    const result = findAlternatives('2026-11-20T21:00:00Z', allSlots, parentZone, 6);
    expect(result.length).toBeLessThanOrEqual(6);
  });

  it('returns empty when no available slots', () => {
    const allSlots = [slot('2026-11-20T21:00:00Z', false)];
    const result = findAlternatives(requestedUtc, allSlots, parentZone, 6);
    expect(result).toHaveLength(0);
  });
});
