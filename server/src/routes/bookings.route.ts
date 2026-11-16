import type { FastifyInstance } from 'fastify';
import type { AppDependencies } from '../lib/types.js';
import { createBooking, getBooking, cancelBooking, generateIcs } from '../services/booking.service.js';

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

  app.get<{ Params: { token: string } }>('/api/bookings/:token/ics', async (request, reply) => {
    const ics = generateIcs(request.params.token, deps);
    return reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="trial-class.ics"')
      .send(ics);
  });
}
