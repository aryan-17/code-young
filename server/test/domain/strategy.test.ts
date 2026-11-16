import { describe, it, expect } from 'vitest';
import { LeastLoadedStrategy } from '../../src/strategies/least-loaded.js';
import type { EligibleMentor, AssignmentContext } from '../../src/strategies/types.js';

function mentor(id: number, onDay: number, inWindow: number): EligibleMentor {
  return {
    id, name: `M${id}`, email: `m${id}@test.com`,
    timezone: 'Asia/Kolkata', bio: `Bio ${id}`,
    bookingsOnDay: onDay, bookingsInWindow: inWindow,
  };
}

const ctx: AssignmentContext = { startUtc: '2026-11-16T14:30:00Z', mentorLocalDate: '2026-11-16' };
const strategy = new LeastLoadedStrategy();

describe('LeastLoadedStrategy', () => {
  it('picks mentor with fewest bookings on that day', () => {
    const candidates = [mentor(1, 1, 5), mentor(2, 0, 5)];
    expect(strategy.pick(candidates, ctx).id).toBe(2);
  });

  it('tie-breaks on fewest bookings in window', () => {
    const candidates = [mentor(1, 0, 5), mentor(2, 0, 3)];
    expect(strategy.pick(candidates, ctx).id).toBe(2);
  });

  it('tie-breaks on lowest id when all counts equal', () => {
    const candidates = [mentor(3, 0, 0), mentor(1, 0, 0), mentor(2, 0, 0)];
    expect(strategy.pick(candidates, ctx).id).toBe(1);
  });

  it('handles single candidate', () => {
    const candidates = [mentor(5, 1, 10)];
    expect(strategy.pick(candidates, ctx).id).toBe(5);
  });

  it('complex: mixed counts', () => {
    const candidates = [
      mentor(1, 1, 3), // day=1
      mentor(2, 0, 8), // day=0, window=8
      mentor(3, 0, 2), // day=0, window=2 — winner
    ];
    expect(strategy.pick(candidates, ctx).id).toBe(3);
  });
});
