import type { AssignmentStrategy, EligibleMentor, AssignmentContext } from './types.js';

/**
 * LeastLoadedStrategy — DESIGN.md §5.2.
 *
 * Picks the mentor with:
 * 1. Fewest bookings on the mentor-local date
 * 2. Then fewest bookings in the 14-day window (spread load)
 * 3. Then lowest mentor id (deterministic → testable)
 */
export class LeastLoadedStrategy implements AssignmentStrategy {
  pick(candidates: EligibleMentor[], _context: AssignmentContext): EligibleMentor {
    return candidates.sort((a, b) => {
      if (a.bookingsOnDay !== b.bookingsOnDay) return a.bookingsOnDay - b.bookingsOnDay;
      if (a.bookingsInWindow !== b.bookingsInWindow) return a.bookingsInWindow - b.bookingsInWindow;
      return a.id - b.id;
    })[0]!;
  }
}
