/**
 * Repository pattern — data access interfaces (DESIGN.md §3.3).
 * Dependency Inversion: services depend on these interfaces, not SQL.
 */

export interface MentorRow {
  id: number;
  name: string;
  email: string;
  timezone: string;
  bio: string;
}

export interface AvailabilityRuleRow {
  id: number;
  mentor_id: number;
  weekday: number;
  start_local: string;
  end_local: string;
}

export interface BookingRow {
  id: number;
  token: string;
  idempotency_key: string;
  mentor_id: number;
  start_utc: string;
  end_utc: string;
  mentor_local_date: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string | null;
  parent_timezone: string;
  child_name: string;
  child_age: number;
  class_link: string;
  status: 'confirmed' | 'cancelled';
  created_at: string;
  cancelled_at: string | null;
}

export interface NotificationRow {
  id: number;
  booking_id: number;
  recipient_type: 'parent' | 'mentor';
  recipient_email: string;
  timezone: string;
  kind: 'booking_confirmed' | 'booking_cancelled';
  subject: string;
  body: string;
  created_at: string;
}

export interface MentorRepository {
  findAll(): MentorRow[];
  findById(id: number): MentorRow | undefined;
  findAvailabilityRules(mentorId: number): AvailabilityRuleRow[];
  findAllWithRules(): Array<MentorRow & { rules: AvailabilityRuleRow[] }>;
}

export interface BookingRepository {
  findByToken(token: string): (BookingRow & { mentor: MentorRow }) | undefined;
  findByIdempotencyKey(key: string): BookingRow | undefined;
  findActiveByParentAndChild(email: string, childName: string): BookingRow | undefined;
  findConfirmedByMentorAndSlot(mentorId: number, startUtc: string): BookingRow | undefined;
  countConfirmedByMentorOnDate(mentorId: number, mentorLocalDate: string): number;
  findConfirmedByMentor(mentorId: number): BookingRow[];
  insert(booking: Omit<BookingRow, 'id'>): BookingRow;
  cancel(token: string, cancelledAt: string): void;
}

export interface NotificationRepository {
  insert(notification: Omit<NotificationRow, 'id'>): NotificationRow;
  findAll(): NotificationRow[];
  findByBookingId(bookingId: number): NotificationRow[];
}
