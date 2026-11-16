import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDb } from '../src/db/index.js';
import { SqliteMentorRepository } from '../src/repositories/mentor.repository.js';
import { SqliteBookingRepository } from '../src/repositories/booking.repository.js';
import { SqliteNotificationRepository } from '../src/repositories/notification.repository.js';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { v4 as uuid } from 'uuid';

const TEST_DB = 'test-repos.db';

let db: Database.Database;
let mentorRepo: SqliteMentorRepository;
let bookingRepo: SqliteBookingRepository;
let notificationRepo: SqliteNotificationRepository;

function seedTestMentor(id?: number) {
  const n = id ?? 1;
  db.prepare(
    'INSERT OR IGNORE INTO mentors (id, name, email, timezone, bio) VALUES (?, ?, ?, ?, ?)',
  ).run(n, `Mentor ${n}`, `mentor${n}@test.com`, 'Asia/Kolkata', `Bio ${n}`);
}

function seedTestRule(mentorId: number, weekday: number, start: string, end: string) {
  db.prepare(
    'INSERT INTO availability_rules (mentor_id, weekday, start_local, end_local) VALUES (?, ?, ?, ?)',
  ).run(mentorId, weekday, start, end);
}

function makeBooking(overrides: Partial<{
  mentorId: number; startUtc: string; endUtc: string; mentorLocalDate: string;
  parentEmail: string; childName: string; status: string;
}> = {}) {
  return {
    token: randomBytes(32).toString('base64url'),
    idempotency_key: uuid(),
    mentor_id: overrides.mentorId ?? 1,
    start_utc: overrides.startUtc ?? '2026-11-20T15:00:00Z',
    end_utc: overrides.endUtc ?? '2026-11-20T15:30:00Z',
    mentor_local_date: overrides.mentorLocalDate ?? '2026-11-20',
    parent_name: 'Test Parent',
    parent_email: overrides.parentEmail ?? 'test@example.com',
    parent_phone: null,
    parent_timezone: 'America/New_York',
    child_name: overrides.childName ?? 'Test Child',
    child_age: 9,
    class_link: 'https://class.codeyoung-demo.com/trial/test',
    status: (overrides.status ?? 'confirmed') as 'confirmed' | 'cancelled',
    created_at: '2026-11-16T10:00:00Z',
    cancelled_at: null,
  };
}

beforeEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  db = createDb(TEST_DB);
  mentorRepo = new SqliteMentorRepository(db);
  bookingRepo = new SqliteBookingRepository(db);
  notificationRepo = new SqliteNotificationRepository(db);
  seedTestMentor(1);
  seedTestMentor(2);
});

afterEach(() => {
  db.close();
  for (const ext of ['', '-wal', '-shm', '-journal']) {
    const p = TEST_DB + ext;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

describe('MentorRepository', () => {
  it('findAll returns seeded mentors', () => {
    const mentors = mentorRepo.findAll();
    expect(mentors).toHaveLength(2);
    expect(mentors[0]!.name).toBe('Mentor 1');
  });

  it('findById returns mentor or undefined', () => {
    expect(mentorRepo.findById(1)).toBeDefined();
    expect(mentorRepo.findById(999)).toBeUndefined();
  });

  it('findAvailabilityRules returns rules for mentor', () => {
    seedTestRule(1, 1, '20:00', '00:30');
    seedTestRule(1, 2, '20:00', '00:30');
    seedTestRule(2, 1, '02:00', '07:00');

    const rules = mentorRepo.findAvailabilityRules(1);
    expect(rules).toHaveLength(2);
    expect(rules[0]!.weekday).toBe(1);
  });

  it('findAllWithRules joins mentors with their rules', () => {
    seedTestRule(1, 1, '20:00', '00:30');
    seedTestRule(2, 3, '02:00', '07:00');

    const result = mentorRepo.findAllWithRules();
    expect(result).toHaveLength(2);
    expect(result[0]!.rules).toHaveLength(1);
    expect(result[1]!.rules).toHaveLength(1);
  });
});

describe('BookingRepository', () => {
  it('insert and findByToken', () => {
    const booking = makeBooking();
    const inserted = bookingRepo.insert(booking);
    expect(inserted.id).toBeGreaterThan(0);

    const found = bookingRepo.findByToken(booking.token);
    expect(found).toBeDefined();
    expect(found!.mentor.name).toBe('Mentor 1');
    expect(found!.parent_email).toBe('test@example.com');
  });

  it('findByIdempotencyKey returns existing booking', () => {
    const booking = makeBooking();
    bookingRepo.insert(booking);

    const found = bookingRepo.findByIdempotencyKey(booking.idempotency_key);
    expect(found).toBeDefined();
    expect(found!.token).toBe(booking.token);
  });

  it('findActiveByParentAndChild finds upcoming confirmed booking', () => {
    const booking = makeBooking({ startUtc: '2099-01-01T12:00:00Z', endUtc: '2099-01-01T12:30:00Z' });
    bookingRepo.insert(booking);

    const found = bookingRepo.findActiveByParentAndChild('test@example.com', 'Test Child');
    expect(found).toBeDefined();
  });

  it('findActiveByParentAndChild ignores cancelled bookings', () => {
    const booking = makeBooking({
      startUtc: '2099-01-01T12:00:00Z',
      endUtc: '2099-01-01T12:30:00Z',
      status: 'cancelled',
    });
    bookingRepo.insert(booking);

    const found = bookingRepo.findActiveByParentAndChild('test@example.com', 'Test Child');
    expect(found).toBeUndefined();
  });

  it('countConfirmedByMentorOnDate counts correctly', () => {
    bookingRepo.insert(makeBooking());
    bookingRepo.insert(makeBooking({ startUtc: '2026-11-20T15:30:00Z', endUtc: '2026-11-20T16:00:00Z' }));

    expect(bookingRepo.countConfirmedByMentorOnDate(1, '2026-11-20')).toBe(2);
    expect(bookingRepo.countConfirmedByMentorOnDate(1, '2026-11-21')).toBe(0);
  });

  it('cancel sets status and cancelled_at', () => {
    const booking = makeBooking();
    bookingRepo.insert(booking);
    bookingRepo.cancel(booking.token, '2026-11-16T12:00:00Z');

    const found = bookingRepo.findByToken(booking.token);
    expect(found!.status).toBe('cancelled');
    expect(found!.cancelled_at).toBe('2026-11-16T12:00:00Z');
  });

  it('cancel frees capacity (countConfirmedByMentorOnDate decreases)', () => {
    const booking = makeBooking();
    bookingRepo.insert(booking);
    expect(bookingRepo.countConfirmedByMentorOnDate(1, '2026-11-20')).toBe(1);

    bookingRepo.cancel(booking.token, '2026-11-16T12:00:00Z');
    expect(bookingRepo.countConfirmedByMentorOnDate(1, '2026-11-20')).toBe(0);
  });

  it('partial unique index prevents duplicate confirmed booking for same mentor+slot', () => {
    bookingRepo.insert(makeBooking());

    expect(() => {
      bookingRepo.insert(makeBooking()); // same mentor_id + start_utc, both confirmed
    }).toThrow();
  });

  it('partial unique index allows booking after cancel', () => {
    const first = makeBooking();
    bookingRepo.insert(first);
    bookingRepo.cancel(first.token, '2026-11-16T12:00:00Z');

    // New booking for same slot should succeed
    const second = makeBooking();
    expect(() => bookingRepo.insert(second)).not.toThrow();
  });

  it('findConfirmedByMentor returns only confirmed bookings', () => {
    bookingRepo.insert(makeBooking());
    const cancelled = makeBooking({
      startUtc: '2026-11-20T16:00:00Z',
      endUtc: '2026-11-20T16:30:00Z',
      status: 'cancelled',
    });
    bookingRepo.insert(cancelled);

    const found = bookingRepo.findConfirmedByMentor(1);
    expect(found).toHaveLength(1);
  });
});

describe('NotificationRepository', () => {
  it('insert and findAll', () => {
    const booking = makeBooking();
    const inserted = bookingRepo.insert(booking);

    notificationRepo.insert({
      booking_id: inserted.id,
      recipient_type: 'parent',
      recipient_email: 'test@example.com',
      timezone: 'America/New_York',
      kind: 'booking_confirmed',
      subject: 'Trial class booked',
      body: 'Your class is on...',
      created_at: '2026-11-16T10:00:00Z',
    });

    const all = notificationRepo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0]!.recipient_type).toBe('parent');
  });

  it('findByBookingId filters correctly', () => {
    const b1 = bookingRepo.insert(makeBooking());
    const b2 = bookingRepo.insert(makeBooking({ mentorId: 2 }));

    notificationRepo.insert({
      booking_id: b1.id, recipient_type: 'parent', recipient_email: 'a@test.com',
      timezone: 'UTC', kind: 'booking_confirmed', subject: 's', body: 'b', created_at: '2026-11-16T10:00:00Z',
    });
    notificationRepo.insert({
      booking_id: b2.id, recipient_type: 'mentor', recipient_email: 'b@test.com',
      timezone: 'UTC', kind: 'booking_confirmed', subject: 's', body: 'b', created_at: '2026-11-16T10:01:00Z',
    });

    expect(notificationRepo.findByBookingId(b1.id)).toHaveLength(1);
    expect(notificationRepo.findByBookingId(b2.id)).toHaveLength(1);
  });
});
