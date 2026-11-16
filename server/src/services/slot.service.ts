import { DateTime } from 'luxon';
import {
  formatZoneLabel, getZoneAbbr, formatTimeLabel, formatDateLabel,
  type SlotsResponse, type SlotDay, type Slot,
} from '@codeyoung/shared';
import type { AppDependencies } from '../lib/types.js';
import { AppError } from '../lib/errors.js';
import { expandMentorSlots } from '../domain/slots.js';
import { isSlotAvailable } from '../domain/eligibility.js';

/**
 * Build the slots response for a parent's timezone (DESIGN.md §8 GET /api/slots).
 */
export function getSlots(
  timezone: string,
  fromDate: string | undefined,
  toDate: string | undefined,
  deps: AppDependencies,
): SlotsResponse {
  const now = deps.clock.now();

  // Validate timezone
  const testDt = DateTime.now().setZone(timezone);
  if (!testDt.isValid) {
    throw new AppError(400, 'INVALID_TIMEZONE', `Unknown timezone: ${timezone}`);
  }

  // Default date range: today..+14 days in parent zone
  const parentNow = now.setZone(timezone);
  const from = fromDate ?? parentNow.toISODate()!;
  const to = toDate ?? parentNow.plus({ days: deps.config.BOOKING_HORIZON_DAYS }).toISODate()!;

  // Load all mentors with rules
  const mentorsWithRules = deps.mentorRepo.findAllWithRules();

  // Expand all mentor slots into UTC grid
  const allMentorSlots = new Map<string, Set<number>>(); // startUtc → set of mentorIds
  for (const mentor of mentorsWithRules) {
    // Expand across a wider range to catch cross-timezone/midnight slots
    const expanded = expandMentorSlots(
      mentor.rules, mentor.timezone,
      DateTime.fromISO(from, { zone: timezone }).minus({ days: 1 }).setZone(mentor.timezone).toISODate()!,
      DateTime.fromISO(to, { zone: timezone }).plus({ days: 1 }).setZone(mentor.timezone).toISODate()!,
      deps.config.SLOT_MINUTES,
    );
    for (const slot of expanded) {
      if (!allMentorSlots.has(slot.startUtc)) {
        allMentorSlots.set(slot.startUtc, new Set());
      }
      allMentorSlots.get(slot.startUtc)!.add(mentor.id);
    }
  }

  // Get all bookings in range for eligibility checks
  const bookings = getAllBookingsInRange(deps, from, to, timezone);

  // Build slot availability and group by parent-local day
  const dayMap = new Map<string, { label: string; slots: Slot[] }>();

  const sortedSlotTimes = [...allMentorSlots.keys()].sort();

  for (const startUtc of sortedSlotTimes) {
    const slotDt = DateTime.fromISO(startUtc, { zone: 'utc' });
    const parentLocal = slotDt.setZone(timezone);
    const parentDate = parentLocal.toISODate()!;

    // Filter to requested date range
    if (parentDate < from || parentDate > to) continue;

    // Compute mentor local date for capacity check
    // Use the first mentor's timezone as reference (all are the same in our seed)
    const mentorLocalDate = slotDt.setZone(mentorsWithRules[0]?.timezone ?? 'UTC').toISODate()!;

    const available = isSlotAvailable(
      startUtc, mentorLocalDate, mentorsWithRules, bookings,
      now.toISO()!, deps.config.LEAD_TIME_MINUTES,
      deps.config.MAX_CLASSES_PER_MENTOR_PER_DAY, deps.config.SLOT_MINUTES,
    );

    const slot: Slot = {
      startUtc,
      localTime: formatTimeLabel(parentLocal),
      zoneAbbr: getZoneAbbr(timezone, slotDt),
      available,
    };

    if (!dayMap.has(parentDate)) {
      dayMap.set(parentDate, {
        label: formatDateLabel(parentLocal),
        slots: [],
      });
    }
    dayMap.get(parentDate)!.slots.push(slot);
  }

  // Build response
  const days: SlotDay[] = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { label, slots }]) => ({
      date,
      label,
      availableCount: slots.filter(s => s.available).length,
      slots,
    }));

  return {
    timezone,
    zoneLabelNow: formatZoneLabel(timezone, now),
    days,
  };
}

/** Load all confirmed bookings as BookingInfo for eligibility checks */
function getAllBookingsInRange(
  deps: AppDependencies,
  _from: string,
  _to: string,
  _timezone: string,
) {
  // Load all confirmed bookings across all mentors
  const mentors = deps.mentorRepo.findAll();
  const bookings: Array<{
    mentorId: number;
    startUtc: string;
    endUtc: string;
    mentorLocalDate: string;
  }> = [];

  for (const mentor of mentors) {
    const mentorBookings = deps.bookingRepo.findConfirmedByMentor(mentor.id);
    for (const b of mentorBookings) {
      bookings.push({
        mentorId: b.mentor_id,
        startUtc: b.start_utc,
        endUtc: b.end_utc,
        mentorLocalDate: b.mentor_local_date,
      });
    }
  }

  return bookings;
}
