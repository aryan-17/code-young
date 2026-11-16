import type { FastifyInstance } from 'fastify';
import type { AppDependencies } from '../lib/types.js';
import { DateTime } from 'luxon';
import { formatTimeLabel, formatDateLabel, formatZoneLabel, getZoneAbbr } from '@codeyoung/shared';

export function registerMentorRoutes(app: FastifyInstance, deps: AppDependencies) {
  app.get('/api/mentors', async () => {
    return deps.mentorRepo.findAll().map(m => ({
      id: m.id,
      name: m.name,
    }));
  });

  app.get<{ Params: { id: string } }>('/api/mentors/:id/bookings', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid mentor id' },
      });
    }

    const mentor = deps.mentorRepo.findById(id);
    if (!mentor) {
      return reply.status(404).send({
        error: { code: 'BOOKING_NOT_FOUND', message: 'Mentor not found' },
      });
    }

    const bookings = deps.bookingRepo.findConfirmedByMentor(id);
    const maxPerDay = deps.config.MAX_CLASSES_PER_MENTOR_PER_DAY;

    return bookings.map(b => {
      const startDt = DateTime.fromISO(b.start_utc, { zone: 'utc' });
      const mentorLocal = startDt.setZone(mentor.timezone);
      const parentLocal = startDt.setZone(b.parent_timezone);

      // Count bookings on this mentor-local day
      const dayCount = deps.bookingRepo.countConfirmedByMentorOnDate(id, b.mentor_local_date);

      return {
        id: b.id,
        startUtc: b.start_utc,
        mentorLocalTime: formatTimeLabel(mentorLocal),
        mentorLocalDate: formatDateLabel(mentorLocal),
        mentorZoneLabel: formatZoneLabel(mentor.timezone, startDt),
        mentorZoneAbbr: getZoneAbbr(mentor.timezone, startDt),
        parentName: b.parent_name,
        childName: b.child_name,
        parentLocalTime: `${formatTimeLabel(parentLocal)} (${formatZoneLabel(b.parent_timezone, startDt)})`,
        classLink: b.class_link,
        dayCount: `${dayCount} of ${maxPerDay}`,
      };
    });
  });
}
