import type { FastifyInstance } from 'fastify';
import type { AppDependencies } from '../lib/types.js';

export function registerNotificationRoutes(app: FastifyInstance, deps: AppDependencies) {
  app.get('/api/notifications', async () => {
    return deps.notificationRepo.findAll();
  });
}
