/** Error codes returned by the API — see DESIGN.md §8 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_TIMEZONE: 'INVALID_TIMEZONE',
  SLOT_OUT_OF_RANGE: 'SLOT_OUT_OF_RANGE',
  SLOT_NOT_ON_GRID: 'SLOT_NOT_ON_GRID',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  ALREADY_BOOKED: 'ALREADY_BOOKED',
  ALREADY_CANCELLED: 'ALREADY_CANCELLED',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Standard API error envelope */
export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Mentor as returned to the client (subset) */
export interface MentorSummary {
  id: number;
  name: string;
  bio: string;
  timezone: string;
}

/** A single time slot for the parent-facing slot picker */
export interface Slot {
  startUtc: string;
  localTime: string;
  zoneAbbr: string;
  available: boolean;
}

/** A day of slots grouped for the parent */
export interface SlotDay {
  date: string;
  label: string;
  availableCount: number;
  slots: Slot[];
}

/** Full slot response */
export interface SlotsResponse {
  timezone: string;
  zoneLabelNow: string;
  days: SlotDay[];
}

/** Booking as returned to the parent */
export interface BookingResponse {
  id: number;
  token: string;
  startUtc: string;
  endUtc: string;
  localTime: string;
  localDate: string;
  zoneLabel: string;
  duration: number;
  parent: {
    name: string;
    email: string;
  };
  child: {
    name: string;
    age: number;
  };
  mentor: MentorSummary;
  classLink: string;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
}

/** Notification record (outbox) */
export interface NotificationRecord {
  id: number;
  bookingId: number;
  recipientType: 'parent' | 'mentor';
  recipientEmail: string;
  timezone: string;
  kind: 'booking_confirmed' | 'booking_cancelled';
  subject: string;
  body: string;
  createdAt: string;
}
