import type Database from 'better-sqlite3';
import { buildApp } from '../../src/app.js';
import { FixedClock } from '../../src/lib/clock.js';
import { createDb } from '../../src/db/index.js';
import type { Config } from '../../src/config.js';
import fs from 'node:fs';
import { v4 as uuid } from 'uuid';

const TEST_CONFIG: Config = {
  PORT: 0,
  DATABASE_PATH: '',
  LEAD_TIME_MINUTES: 120,
  BOOKING_HORIZON_DAYS: 14,
  SLOT_MINUTES: 30,
  MAX_CLASSES_PER_MENTOR_PER_DAY: 2,
  CLASS_LINK_BASE_URL: 'https://class.codeyoung-demo.com/trial',
  NOW_OVERRIDE: undefined,
};

/**
 * Create a test app with a temp file DB, seeded mentor, and fixed clock.
 * Returns the app and cleanup function.
 */
export function createTestApp(options: {
  now?: string;
  mentors?: Array<{ id: number; name: string; timezone: string; rules: Array<{ weekday: number; start: string; end: string }> }>;
} = {}): { app: ReturnType<typeof buildApp>; db: Database.Database; clock: FixedClock; cleanup: () => void; dbPath: string } {
  const dbPath = `test-api-${uuid()}.db`;
  const db = createDb(dbPath);

  const clock = new FixedClock(options.now ?? '2026-11-16T10:00:00Z');

  // Seed mentors
  const mentors = options.mentors ?? [{
    id: 1,
    name: 'Test Mentor',
    timezone: 'Asia/Kolkata',
    rules: [{ weekday: 1, start: '20:00', end: '23:00' }], // Mon 20:00-23:00 IST
  }];

  for (const m of mentors) {
    db.prepare(
      'INSERT INTO mentors (id, name, email, timezone, bio) VALUES (?, ?, ?, ?, ?)',
    ).run(m.id, m.name, `mentor${m.id}@test.com`, m.timezone, `Bio for ${m.name}`);
    for (const r of m.rules) {
      db.prepare(
        'INSERT INTO availability_rules (mentor_id, weekday, start_local, end_local) VALUES (?, ?, ?, ?)',
      ).run(m.id, r.weekday, r.start, r.end);
    }
  }

  const app = buildApp({
    dbPath,
    deps: { clock, config: TEST_CONFIG, db },
  });

  function cleanup() {
    db.close();
    for (const ext of ['', '-wal', '-shm', '-journal']) {
      const p = dbPath + ext;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }

  return { app, db, clock, cleanup, dbPath };
}

export function bookingBody(overrides: Partial<{
  startUtc: string;
  timezone: string;
  idempotencyKey: string;
  parentName: string;
  parentEmail: string;
  childName: string;
  childAge: number;
}> = {}) {
  return {
    startUtc: overrides.startUtc ?? '2026-11-16T14:30:00Z',
    timezone: overrides.timezone ?? 'America/New_York',
    idempotencyKey: overrides.idempotencyKey ?? uuid(),
    parent: {
      name: overrides.parentName ?? 'Jane Doe',
      email: overrides.parentEmail ?? 'jane@example.com',
      phone: null,
    },
    child: {
      name: overrides.childName ?? 'Billy',
      age: overrides.childAge ?? 9,
    },
  };
}
