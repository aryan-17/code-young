import type Database from 'better-sqlite3';
import type { NotificationRepository, NotificationRow } from './types.js';

export class SqliteNotificationRepository implements NotificationRepository {
  constructor(private db: Database.Database) {}

  insert(notification: Omit<NotificationRow, 'id'>): NotificationRow {
    const stmt = this.db.prepare(`
      INSERT INTO notifications (
        booking_id, recipient_type, recipient_email, timezone, kind, subject, body, created_at
      ) VALUES (
        @booking_id, @recipient_type, @recipient_email, @timezone, @kind, @subject, @body, @created_at
      )
    `);
    const result = stmt.run(notification);
    return { ...notification, id: result.lastInsertRowid as number };
  }

  findAll(): NotificationRow[] {
    return this.db.prepare(
      'SELECT * FROM notifications ORDER BY created_at DESC',
    ).all() as NotificationRow[];
  }

  findByBookingId(bookingId: number): NotificationRow[] {
    return this.db.prepare(
      'SELECT * FROM notifications WHERE booking_id = ? ORDER BY created_at',
    ).all(bookingId) as NotificationRow[];
  }
}
