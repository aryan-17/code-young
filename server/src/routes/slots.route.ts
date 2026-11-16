import type { FastifyInstance } from 'fastify';
import type { AppDependencies } from '../lib/types.js';
import { getSlots } from '../services/slot.service.js';

export function registerSlotRoutes(app: FastifyInstance, deps: AppDependencies) {
  app.get<{
    Querystring: { timezone?: string; from?: string; to?: string };
  }>('/api/slots', async (request, reply) => {
    const { timezone, from, to } = request.query;

    if (!timezone) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'timezone query parameter is required' },
      });
    }

    const result = getSlots(timezone, from, to, deps);
    return result;
  });
}
