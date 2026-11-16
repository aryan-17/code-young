import type { Clock } from './clock.js';
import type { AssignmentStrategy } from '../strategies/types.js';
import type { Notifier } from '../notifiers/types.js';
import type { MentorRepository, BookingRepository, NotificationRepository } from '../repositories/types.js';

/**
 * All injectable dependencies — Composition Root pattern (DESIGN.md §3.3).
 * buildApp() accepts partial overrides; tests swap in FixedClock, mock notifiers, etc.
 */
export interface AppDependencies {
  clock: Clock;
  strategy: AssignmentStrategy;
  notifier: Notifier;
  mentorRepo: MentorRepository;
  bookingRepo: BookingRepository;
  notificationRepo: NotificationRepository;
}
