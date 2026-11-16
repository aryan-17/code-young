import { DateTime } from 'luxon';
import { randomBytes } from 'node:crypto';
import { v4 as uuid } from 'uuid';
import {
  BookingRequestSchema, formatZoneLabel, formatTimeLabel, formatDateLabel, getZoneAbbr,
} from '@codeyoung/shared';
import type { AppDependencies } from '../lib/types.js';
import { AppError } from '../lib/errors.js';
import { eligibleMentors } from '../domain/eligibility.js';
import { expandMentorSlots } from '../domain/slots.js';
import { isSlotAvailable } from '../domain/eligibility.js';
import { findAlternatives } from '../domain/alternatives.js';
import { createBookingNotifications } from './notification.service.js';

interface BookingResult {
  booking: ReturnType<typeof formatBookingResponse>;
  statusCode: number;
}

/**
 * Create a booking (DESIGN.md §5.3 — full transaction).
 */
export function createBooking(
  body: unknown,
  deps: AppDependencies,
): BookingResult {
  // 1. Validate body
  const parsed = BookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body', {
      issues: parsed.error.issues,
    });
  }
  const req = parsed.data;

  // Validate timezone
  const testDt = DateTime.now().setZone(req.timezone);
  if (!testDt.isValid) {
    throw new AppError(400, 'INVALID_TIMEZONE', `Unknown timezone: ${req.timezone}`);
  }

  // Validate slot is on grid (:00 or :30 UTC)
  const slotStart = DateTime.fromISO(req.startUtc, { zone: 'utc' });
  if (!slotStart.isValid) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid startUtc');
  }
  if (slotStart.minute !== 0 && slotStart.minute !== 30) {
    throw new AppError(400, 'SLOT_NOT_ON_GRID', 'Slot must start at :00 or :30 UTC');
  }
  if (slotStart.second !== 0 || slotStart.millisecond !== 0) {
    throw new AppError(400, 'SLOT_NOT_ON_GRID', 'Slot must have zero seconds and milliseconds');
  }

  // Normalize to consistent ISO format (matches expandMentorSlots output)
  const normalizedStartUtc = slotStart.toISO()!;

  // Validate slot is in bookable window
  const now = deps.clock.now();
  const leadCutoff = now.plus({ minutes: deps.config.LEAD_TIME_MINUTES });
  if (slotStart < leadCutoff) {
    throw new AppError(400, 'SLOT_OUT_OF_RANGE', 'Slot is too soon to book');
  }

  const horizonEnd = now.setZone(req.timezone)
    .plus({ days: deps.config.BOOKING_HORIZON_DAYS })
    .endOf('day').toUTC();
  if (slotStart > horizonEnd) {
    throw new AppError(400, 'SLOT_OUT_OF_RANGE', 'Slot is beyond the booking horizon');
  }

  // 2. Idempotency check
  const existing = deps.bookingRepo.findByIdempotencyKey(req.idempotencyKey);
  if (existing) {
    const withMentor = deps.bookingRepo.findByToken(existing.token);
    return {
      booking: formatBookingResponse(existing, withMentor!.mentor, req.timezone),
      statusCode: 200,
    };
  }

  // 3. Duplicate parent+child check (§5.4)
  const activeBooking = deps.bookingRepo.findActiveByParentAndChild(req.parent.email, req.child.name);
  if (activeBooking) {
    throw new AppError(409, 'ALREADY_BOOKED',
      `You already have a trial booked for ${req.child.name}`, {
        existingToken: activeBooking.token,
      });
  }

  // 4-10. BEGIN IMMEDIATE transaction
  const slotMinutes = deps.config.SLOT_MINUTES;
  const maxPerDay = deps.config.MAX_CLASSES_PER_MENTOR_PER_DAY;

  const result = deps.db.transaction(() => {
    const mentorsWithRules = deps.mentorRepo.findAllWithRules();

    // Build booking info for eligibility
    const allBookings: Array<{
      mentorId: number; startUtc: string; endUtc: string; mentorLocalDate: string;
    }> = [];
    for (const m of mentorsWithRules) {
      for (const b of deps.bookingRepo.findConfirmedByMentor(m.id)) {
        allBookings.push({
          mentorId: b.mentor_id,
          startUtc: b.start_utc,
          endUtc: b.end_utc,
          mentorLocalDate: b.mentor_local_date,
        });
      }
    }

    // Compute mentor local date
    const mentorLocalDate = slotStart.setZone(
      mentorsWithRules[0]?.timezone ?? 'UTC',
    ).toISODate()!;

    // 5. Find eligible mentors
    const eligible = eligibleMentors(
      normalizedStartUtc, mentorLocalDate, mentorsWithRules, allBookings, maxPerDay, slotMinutes,
    );

    if (eligible.length === 0) {
      // Build alternatives for the error response
      const allSlots = buildAllAvailableSlots(mentorsWithRules, allBookings, now, deps);
      const alternatives = findAlternatives(normalizedStartUtc, allSlots, req.timezone, 6);

      throw new AppError(409, 'SLOT_UNAVAILABLE', 'No mentors available for this slot', {
        alternatives: alternatives.map(a => a.startUtc),
      });
    }

    // 6. Pick mentor
    const mentor = deps.strategy.pick(eligible, { startUtc: normalizedStartUtc, mentorLocalDate });

    // Compute mentor-local date for this specific mentor
    const specificMentorLocalDate = slotStart.setZone(mentor.timezone).toISODate()!;

    // 7. INSERT booking
    const token = randomBytes(32).toString('base64url');
    const classLink = `${deps.config.CLASS_LINK_BASE_URL}/${uuid()}`;
    const endUtc = slotStart.plus({ minutes: slotMinutes }).toISO()!;

    let booking;
    try {
      booking = deps.bookingRepo.insert({
        token,
        idempotency_key: req.idempotencyKey,
        mentor_id: mentor.id,
        start_utc: normalizedStartUtc,
        end_utc: endUtc,
        mentor_local_date: specificMentorLocalDate,
        parent_name: req.parent.name,
        parent_email: req.parent.email,
        parent_phone: req.parent.phone ?? null,
        parent_timezone: req.timezone,
        child_name: req.child.name,
        child_age: req.child.age,
        class_link: classLink,
        status: 'confirmed',
        created_at: now.toISO()!,
        cancelled_at: null,
      });
    } catch (err: unknown) {
      // Unique index constraint — retry with remaining candidates
      if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
        const remaining = eligible.filter(e => e.id !== mentor.id);
        if (remaining.length === 0) {
          const allSlots = buildAllAvailableSlots(mentorsWithRules, allBookings, now, deps);
          const alternatives = findAlternatives(normalizedStartUtc, allSlots, req.timezone, 6);
          throw new AppError(409, 'SLOT_UNAVAILABLE', 'No mentors available for this slot', {
            alternatives: alternatives.map(a => a.startUtc),
          });
        }
        const retryMentor = deps.strategy.pick(remaining, { startUtc: normalizedStartUtc, mentorLocalDate });
        const retryMentorLocalDate = slotStart.setZone(retryMentor.timezone).toISODate()!;
        booking = deps.bookingRepo.insert({
          token,
          idempotency_key: req.idempotencyKey,
          mentor_id: retryMentor.id,
          start_utc: normalizedStartUtc,
          end_utc: endUtc,
          mentor_local_date: retryMentorLocalDate,
          parent_name: req.parent.name,
          parent_email: req.parent.email,
          parent_phone: req.parent.phone ?? null,
          parent_timezone: req.timezone,
          child_name: req.child.name,
          child_age: req.child.age,
          class_link: classLink,
          status: 'confirmed',
          created_at: now.toISO()!,
          cancelled_at: null,
        });
      } else {
        throw err;
      }
    }

    // 8. Create notifications
    const mentorData = deps.mentorRepo.findById(booking.mentor_id)!;
    const notifications = createBookingNotifications(
      {
        id: booking.id,
        startUtc: booking.start_utc,
        endUtc: booking.end_utc,
        parentName: booking.parent_name,
        parentEmail: booking.parent_email,
        childName: booking.child_name,
        childAge: booking.child_age,
        classLink: booking.class_link,
        token: booking.token,
      },
      mentorData,
      req.timezone,
    );

    for (const notif of notifications) {
      deps.notificationRepo.insert({
        booking_id: notif.bookingId,
        recipient_type: notif.recipientType,
        recipient_email: notif.recipientEmail,
        timezone: notif.timezone,
        kind: notif.kind,
        subject: notif.subject,
        body: notif.body,
        created_at: now.toISO()!,
      });
      deps.notifier.send(notif);
    }

    return formatBookingResponse(booking, mentorData, req.timezone);
  }).immediate();

  return { booking: result, statusCode: 201 };
}

/**
 * Get a booking by token.
 */
export function getBooking(token: string, deps: AppDependencies) {
  const booking = deps.bookingRepo.findByToken(token);
  if (!booking) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  }
  return formatBookingResponse(booking, booking.mentor, booking.parent_timezone);
}

/**
 * Cancel a booking by token.
 */
export function cancelBooking(token: string, deps: AppDependencies) {
  const booking = deps.bookingRepo.findByToken(token);
  if (!booking) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  }
  if (booking.status === 'cancelled') {
    throw new AppError(409, 'ALREADY_CANCELLED', 'Booking is already cancelled');
  }

  const now = deps.clock.now();
  deps.bookingRepo.cancel(token, now.toISO()!);

  // Create cancellation notifications
  const notifications = createCancelNotifications(booking, booking.mentor);
  for (const notif of notifications) {
    deps.notificationRepo.insert({
      booking_id: notif.bookingId,
      recipient_type: notif.recipientType,
      recipient_email: notif.recipientEmail,
      timezone: notif.timezone,
      kind: notif.kind,
      subject: notif.subject,
      body: notif.body,
      created_at: now.toISO()!,
    });
    deps.notifier.send(notif);
  }

  return { status: 'cancelled' };
}

function formatBookingResponse(
  booking: { id: number; token: string; start_utc: string; end_utc: string; parent_name: string;
    parent_email: string; parent_timezone: string; child_name: string; child_age: number;
    class_link: string; status: string; created_at: string; },
  mentor: { id: number; name: string; email: string; timezone: string; bio: string },
  parentZone: string,
) {
  const startDt = DateTime.fromISO(booking.start_utc, { zone: 'utc' });
  const parentLocal = startDt.setZone(parentZone);

  return {
    id: booking.id,
    token: booking.token,
    startUtc: booking.start_utc,
    endUtc: booking.end_utc,
    localTime: formatTimeLabel(parentLocal),
    localDate: formatDateLabel(parentLocal),
    zoneLabel: formatZoneLabel(parentZone, startDt),
    zoneAbbr: getZoneAbbr(parentZone, startDt),
    duration: 30,
    parent: { name: booking.parent_name, email: booking.parent_email },
    child: { name: booking.child_name, age: booking.child_age },
    mentor: { id: mentor.id, name: mentor.name, bio: mentor.bio, timezone: mentor.timezone },
    classLink: booking.class_link,
    status: booking.status,
    createdAt: booking.created_at,
  };
}

import type { NotificationPayload } from '../notifiers/types.js';

function createCancelNotifications(
  booking: { id: number; parent_name: string; parent_email: string; parent_timezone: string;
    child_name: string; start_utc: string; },
  mentor: { name: string; email: string; timezone: string },
): NotificationPayload[] {
  const startDt = DateTime.fromISO(booking.start_utc, { zone: 'utc' });
  const parentLocal = startDt.setZone(booking.parent_timezone);

  return [
    {
      bookingId: booking.id,
      recipientType: 'parent',
      recipientEmail: booking.parent_email,
      timezone: booking.parent_timezone,
      kind: 'booking_cancelled',
      subject: `Trial class cancelled for ${booking.child_name}`,
      body: `Hi ${booking.parent_name}, your trial class on ${formatDateLabel(parentLocal)} at ${formatTimeLabel(parentLocal)} has been cancelled.`,
    },
    {
      bookingId: booking.id,
      recipientType: 'mentor',
      recipientEmail: mentor.email,
      timezone: mentor.timezone,
      kind: 'booking_cancelled',
      subject: `Trial class cancelled — ${booking.child_name}`,
      body: `Hi ${mentor.name}, the trial class with ${booking.child_name} on ${formatDateLabel(startDt.setZone(mentor.timezone))} has been cancelled.`,
    },
  ];
}

/** Build all available slots for alternatives */
function buildAllAvailableSlots(
  mentorsWithRules: Array<{ id: number; name: string; email: string; timezone: string; bio: string;
    rules: Array<{ id: number; mentor_id: number; weekday: number; start_local: string; end_local: string }> }>,
  allBookings: Array<{ mentorId: number; startUtc: string; endUtc: string; mentorLocalDate: string }>,
  now: DateTime,
  deps: AppDependencies,
): Array<{ startUtc: string; available: boolean }> {
  // Collect all unique UTC slots across all mentors
  const slotSet = new Set<string>();
  for (const mentor of mentorsWithRules) {
    const expanded = expandMentorSlots(
      mentor.rules, mentor.timezone,
      now.setZone(mentor.timezone).toISODate()!,
      now.setZone(mentor.timezone).plus({ days: deps.config.BOOKING_HORIZON_DAYS + 1 }).toISODate()!,
      deps.config.SLOT_MINUTES,
    );
    for (const s of expanded) slotSet.add(s.startUtc);
  }

  return [...slotSet].sort().map(startUtc => {
    const slotDt = DateTime.fromISO(startUtc, { zone: 'utc' });
    const mentorLocalDate = slotDt.setZone(mentorsWithRules[0]?.timezone ?? 'UTC').toISODate()!;
    const available = isSlotAvailable(
      startUtc, mentorLocalDate, mentorsWithRules, allBookings,
      now.toISO()!, deps.config.LEAD_TIME_MINUTES,
      deps.config.MAX_CLASSES_PER_MENTOR_PER_DAY, deps.config.SLOT_MINUTES,
    );
    return { startUtc, available };
  });
}
