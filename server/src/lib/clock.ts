import { DateTime } from 'luxon';

/**
 * Clock abstraction — Dependency Inversion Principle.
 * All time access goes through this interface.
 * SystemClock for production, FixedClock for tests/demo (DESIGN.md §3.3, §4).
 */
export interface Clock {
  now(): DateTime;
}

/** Production clock — returns real current time in UTC */
export class SystemClock implements Clock {
  now(): DateTime {
    return DateTime.utc();
  }
}

/** Test/demo clock — returns a fixed instant (DESIGN.md §9.1, §9.3) */
export class FixedClock implements Clock {
  private instant: DateTime;

  constructor(iso: string) {
    const dt = DateTime.fromISO(iso, { zone: 'utc' });
    if (!dt.isValid) throw new Error(`FixedClock: invalid ISO string "${iso}"`);
    this.instant = dt;
  }

  now(): DateTime {
    return this.instant;
  }

  /** Advance the clock (useful in multi-step tests) */
  advance(minutes: number): void {
    this.instant = this.instant.plus({ minutes });
  }
}
