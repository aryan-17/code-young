import type Database from 'better-sqlite3';
import type { Clock } from './clock.js';
import type { AssignmentStrategy } from '../strategies/types.js';
import type { Notifier } from '../notifiers/types.js';
import type { MentorRepository, BookingRepository, NotificationRepository } from '../repositories/types.js';
import type { Config } from '../config.js';

/**
 * All injectable dependencies — Composition Root pattern (DESIGN.md §3.3).
 * buildApp() accepts partial overrides; tests swap in FixedClock, mocks, etc.
 */
export interface AppDependencies {
  db: Database.Database;
  clock: Clock;
  config: Config;
  strategy: AssignmentStrategy;
  notifier: Notifier;
  mentorRepo: MentorRepository;
  bookingRepo: BookingRepository;
  notificationRepo: NotificationRepository;
}
