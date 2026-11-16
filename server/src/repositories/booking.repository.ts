import type Database from 'better-sqlite3';
import type { BookingRepository, BookingRow, MentorRow } from './types.js';

export class SqliteBookingRepository implements BookingRepository {
  constructor(private db: Database.Database) {}

  findByToken(token: string): (BookingRow & { mentor: MentorRow }) | undefined {
    const row = this.db.prepare(`
      SELECT b.*, m.name AS mentor_name, m.email AS mentor_email,
             m.timezone AS mentor_timezone, m.bio AS mentor_bio
      FROM bookings b
      JOIN mentors m ON m.id = b.mentor_id
      WHERE b.token = ?
    `).get(token) as (BookingRow & {
      mentor_name: string;
      mentor_email: string;
      mentor_timezone: string;
      mentor_bio: string;
    }) | undefined;

    if (!row) return undefined;

    const { mentor_name, mentor_email, mentor_timezone, mentor_bio, ...booking } = row;
    return {
      ...booking,
      mentor: {
        id: booking.mentor_id,
        name: mentor_name,
        email: mentor_email,
        timezone: mentor_timezone,
        bio: mentor_bio,
      },
    };
  }

  findByIdempotencyKey(key: string): BookingRow | undefined {
    return this.db.prepare(
      'SELECT * FROM bookings WHERE idempotency_key = ?',
    ).get(key) as BookingRow | undefined;
  }

  findActiveByParentAndChild(email: string, childName: string): BookingRow | undefined {
    return this.db.prepare(`
      SELECT * FROM bookings
      WHERE parent_email = ? AND child_name = ? AND status = 'confirmed'
        AND start_utc > datetime('now')
      ORDER BY start_utc LIMIT 1
    `).get(email, childName) as BookingRow | undefined;
  }

  findConfirmedByMentorAndSlot(mentorId: number, startUtc: string): BookingRow | undefined {
    return this.db.prepare(
      "SELECT * FROM bookings WHERE mentor_id = ? AND start_utc = ? AND status = 'confirmed'",
    ).get(mentorId, startUtc) as BookingRow | undefined;
  }

  countConfirmedByMentorOnDate(mentorId: number, mentorLocalDate: string): number {
    const row = this.db.prepare(
      "SELECT COUNT(*) AS cnt FROM bookings WHERE mentor_id = ? AND mentor_local_date = ? AND status = 'confirmed'",
    ).get(mentorId, mentorLocalDate) as { cnt: number };
    return row.cnt;
  }

  findConfirmedByMentor(mentorId: number): BookingRow[] {
    return this.db.prepare(
      "SELECT * FROM bookings WHERE mentor_id = ? AND status = 'confirmed' ORDER BY start_utc",
    ).all(mentorId) as BookingRow[];
  }

  insert(booking: Omit<BookingRow, 'id'>): BookingRow {
    const stmt = this.db.prepare(`
      INSERT INTO bookings (
        token, idempotency_key, mentor_id, start_utc, end_utc, mentor_local_date,
        parent_name, parent_email, parent_phone, parent_timezone,
        child_name, child_age, class_link, status, created_at, cancelled_at
      ) VALUES (
        @token, @idempotency_key, @mentor_id, @start_utc, @end_utc, @mentor_local_date,
        @parent_name, @parent_email, @parent_phone, @parent_timezone,
        @child_name, @child_age, @class_link, @status, @created_at, @cancelled_at
      )
    `);
    const result = stmt.run(booking);
    return { ...booking, id: result.lastInsertRowid as number };
  }

  cancel(token: string, cancelledAt: string): void {
    this.db.prepare(
      "UPDATE bookings SET status = 'cancelled', cancelled_at = ? WHERE token = ? AND status = 'confirmed'",
    ).run(cancelledAt, token);
  }
}
