import type { FastifyInstance } from 'fastify';
import type { AppDependencies } from '../lib/types.js';
import { registerSlotRoutes } from './slots.route.js';
import { registerBookingRoutes } from './bookings.route.js';
import { registerMentorRoutes } from './mentors.route.js';
import { registerNotificationRoutes } from './notifications.route.js';

export function registerRoutes(app: FastifyInstance, deps: AppDependencies) {
  registerSlotRoutes(app, deps);
  registerBookingRoutes(app, deps);
  registerMentorRoutes(app, deps);
  registerNotificationRoutes(app, deps);
}
