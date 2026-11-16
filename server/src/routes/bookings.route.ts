import type { FastifyInstance } from 'fastify';
import type { AppDependencies } from '../lib/types.js';
import { createBooking, getBooking, cancelBooking } from '../services/booking.service.js';

export function registerBookingRoutes(app: FastifyInstance, deps: AppDependencies) {
  app.post('/api/bookings', async (request, reply) => {
    const { booking, statusCode } = createBooking(request.body, deps);
    return reply.status(statusCode).send(booking);
  });

  app.get<{ Params: { token: string } }>('/api/bookings/:token', async (request) => {
    return getBooking(request.params.token, deps);
  });

  app.post<{ Params: { token: string } }>('/api/bookings/:token/cancel', async (request) => {
    return cancelBooking(request.params.token, deps);
  });
}
