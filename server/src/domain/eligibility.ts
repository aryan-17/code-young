import { DateTime } from 'luxon';
import type { AvailabilityRuleRow } from '../repositories/types.js';
import type { EligibleMentor } from '../strategies/types.js';
import { expandMentorSlots } from './slots.js';

interface MentorWithRules {
  id: number;
  name: string;
  email: string;
  timezone: string;
  bio: string;
  rules: AvailabilityRuleRow[];
}

interface BookingInfo {
  mentorId: number;
  startUtc: string;
  endUtc: string;
  mentorLocalDate: string;
}

/**
 * Find mentors eligible to teach a specific slot (DESIGN.md §5.1).
 *
 * A mentor is eligible if:
 * 1. Their availability rule covers the slot
 * 2. They have no confirmed booking overlapping the slot
 * 3. Their confirmed bookings on the mentor-local date < maxPerDay
 */
export function eligibleMentors(
  slotStartUtc: string,
  _mentorLocalDate: string,
  mentors: MentorWithRules[],
  bookings: BookingInfo[],
  maxPerDay: number,
  slotMinutes: number,
): EligibleMentor[] {
  const slotStart = DateTime.fromISO(slotStartUtc, { zone: 'utc' });
  // Normalize to match expandMentorSlots output format (always .000Z)
  const normalizedStartUtc = slotStart.toISO()!;

  const result: EligibleMentor[] = [];

  for (const mentor of mentors) {
    // Check 1: Does a rule cover this slot?
    // Expand mentor's rules for the relevant date range to find if this UTC slot is covered
    const mentorSlots = expandMentorSlots(
      mentor.rules, mentor.timezone,
      slotStart.setZone(mentor.timezone).minus({ days: 1 }).toISODate()!,
      slotStart.setZone(mentor.timezone).plus({ days: 1 }).toISODate()!,
      slotMinutes,
    );

    const coversSlot = mentorSlots.some(s => s.startUtc === normalizedStartUtc);
    if (!coversSlot) continue;

    // Check 2: No confirmed booking overlapping this slot
    const mentorBookings = bookings.filter(b => b.mentorId === mentor.id);
    const hasOverlap = mentorBookings.some(b => b.startUtc === normalizedStartUtc || b.startUtc === slotStartUtc);
    if (hasOverlap) continue;

    // Check 3: Capacity — bookings on this mentor-local date < maxPerDay
    // Find the mentorLocalDate for this mentor at this slot time
    const slotMentorLocalDate = slotStart.setZone(mentor.timezone).toISODate()!;
    const bookingsOnDay = mentorBookings.filter(b => b.mentorLocalDate === slotMentorLocalDate).length;
    if (bookingsOnDay >= maxPerDay) continue;

    const bookingsInWindow = mentorBookings.length;

    result.push({
      id: mentor.id,
      name: mentor.name,
      email: mentor.email,
      timezone: mentor.timezone,
      bio: mentor.bio,
      bookingsOnDay,
      bookingsInWindow,
    });
  }

  return result;
}

/**
 * Check if a slot has at least one eligible mentor (DESIGN.md §5.1).
 * Also checks lead time constraint.
 */
export function isSlotAvailable(
  slotStartUtc: string,
  mentorLocalDate: string,
  mentors: MentorWithRules[],
  bookings: BookingInfo[],
  nowUtc: string,
  leadTimeMinutes: number,
  maxPerDay: number,
  slotMinutes: number,
): boolean {
  // Lead time check
  const slotStart = DateTime.fromISO(slotStartUtc, { zone: 'utc' });
  const now = DateTime.fromISO(nowUtc, { zone: 'utc' });
  if (slotStart < now.plus({ minutes: leadTimeMinutes })) {
    return false;
  }

  return eligibleMentors(slotStartUtc, mentorLocalDate, mentors, bookings, maxPerDay, slotMinutes).length > 0;
}
