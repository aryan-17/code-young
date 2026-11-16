import { DateTime } from 'luxon';
import { formatZoneLabel, formatTimeLabel, formatDateLabel } from '@codeyoung/shared';
import type { NotificationPayload } from '../notifiers/types.js';

interface BookingData {
  id: number;
  startUtc: string;
  endUtc: string;
  parentName: string;
  parentEmail: string;
  childName: string;
  childAge: number;
  classLink: string;
  token: string;
}

interface MentorData {
  name: string;
  email: string;
  timezone: string;
}

/**
 * Build booking confirmation notifications for parent and mentor (DESIGN.md §5.3 step 9).
 */
export function createBookingNotifications(
  booking: BookingData,
  mentor: MentorData,
  parentZone: string,
): NotificationPayload[] {
  const startUtc = DateTime.fromISO(booking.startUtc, { zone: 'utc' });

  // Parent notification in parent zone
  const parentDt = startUtc.setZone(parentZone);
  const parentZoneLabel = formatZoneLabel(parentZone, startUtc);
  const parentTime = formatTimeLabel(parentDt);
  const parentDate = formatDateLabel(parentDt);

  const parentNotif: NotificationPayload = {
    bookingId: booking.id,
    recipientType: 'parent',
    recipientEmail: booking.parentEmail,
    timezone: parentZone,
    kind: 'booking_confirmed',
    subject: `Trial class booked for ${booking.childName} — ${parentDate} at ${parentTime}`,
    body: [
      `Hi ${booking.parentName},`,
      '',
      `Your trial class for ${booking.childName} (age ${booking.childAge}) is confirmed!`,
      '',
      `Date: ${parentDate}`,
      `Time: ${parentTime} (${parentZoneLabel})`,
      `Duration: 30 minutes`,
      `Mentor: ${mentor.name}`,
      `Class link: ${booking.classLink}`,
      '',
      `Manage your booking: /booking/${booking.token}`,
    ].join('\n'),
  };

  // Mentor notification in mentor zone
  const mentorDt = startUtc.setZone(mentor.timezone);
  const mentorZoneLabel = formatZoneLabel(mentor.timezone, startUtc);
  const mentorTime = formatTimeLabel(mentorDt);
  const mentorDate = formatDateLabel(mentorDt);

  const mentorNotif: NotificationPayload = {
    bookingId: booking.id,
    recipientType: 'mentor',
    recipientEmail: mentor.email,
    timezone: mentor.timezone,
    kind: 'booking_confirmed',
    subject: `New trial class — ${mentorDate} at ${mentorTime}`,
    body: [
      `Hi ${mentor.name},`,
      '',
      `You have a new trial class booking:`,
      '',
      `Date: ${mentorDate}`,
      `Time: ${mentorTime} (${mentorZoneLabel})`,
      `Duration: 30 minutes`,
      `Student: ${booking.childName} (age ${booking.childAge})`,
      `Parent: ${booking.parentName} (${booking.parentEmail})`,
      `Parent's local time: ${parentTime} (${parentZoneLabel})`,
      `Class link: ${booking.classLink}`,
    ].join('\n'),
  };

  return [parentNotif, mentorNotif];
}
