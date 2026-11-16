import { createDb } from './index.js';
import { loadConfig } from '../config.js';
import { randomBytes } from 'node:crypto';
import { v4 as uuid } from 'uuid';
import fs from 'node:fs';

const config = loadConfig();
const scenarios = process.argv.includes('--scenarios');

// Wipe existing DB
if (fs.existsSync(config.DATABASE_PATH)) {
  fs.unlinkSync(config.DATABASE_PATH);
  // Clean WAL/SHM files if present
  for (const ext of ['-wal', '-shm', '-journal']) {
    const p = config.DATABASE_PATH + ext;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

const db = createDb(config.DATABASE_PATH);

// ── Mentors (DESIGN.md §7.1) ──────────────────────────────────────────────

interface MentorSeed {
  name: string;
  email: string;
  bio: string;
}

const mentors: MentorSeed[] = [
  // UK-evening shift mentors (1-4)
  { name: 'Priya Sharma', email: 'priya.sharma@codeyoung.in', bio: 'Python & web dev specialist. 3 years teaching kids to build real projects.' },
  { name: 'Arjun Patel', email: 'arjun.patel@codeyoung.in', bio: 'Game development guru. Makes coding fun with Scratch and Unity.' },
  { name: 'Neha Gupta', email: 'neha.gupta@codeyoung.in', bio: 'Full-stack engineer turned educator. Passionate about creative coding.' },
  { name: 'Rohan Desai', email: 'rohan.desai@codeyoung.in', bio: 'Competitive programming coach. Builds problem-solving skills from day one.' },
  // US-evening shift mentors (5-8)
  { name: 'Kavitha Nair', email: 'kavitha.nair@codeyoung.in', bio: 'AI & robotics enthusiast. Teaches computational thinking through projects.' },
  { name: 'Vikram Singh', email: 'vikram.singh@codeyoung.in', bio: 'App development expert. Helps kids build their first mobile app.' },
  { name: 'Ananya Reddy', email: 'ananya.reddy@codeyoung.in', bio: 'Data science background. Makes math and algorithms approachable.' },
  { name: 'Siddharth Iyer', email: 'siddharth.iyer@codeyoung.in', bio: 'Ex-startup founder. Teaches coding with an entrepreneurial mindset.' },
  // Weekend shift mentors (9-10)
  { name: 'Meera Joshi', email: 'meera.joshi@codeyoung.in', bio: 'Creative arts + coding. Specializes in animation and visual projects.' },
  { name: 'Rahul Verma', email: 'rahul.verma@codeyoung.in', bio: 'Systems engineer by trade. Patient teacher who loves weekend sessions.' },
];

const insertMentor = db.prepare(
  'INSERT INTO mentors (name, email, timezone, bio) VALUES (?, ?, ?, ?)',
);

for (const m of mentors) {
  insertMentor.run(m.name, m.email, 'Asia/Kolkata', m.bio);
}

// ── Availability rules (DESIGN.md §7.1) ───────────────────────────────────
// Weekday: ISO 1=Mon ... 7=Sun. Times in mentor-local (Asia/Kolkata).

interface RuleSeed {
  mentorId: number;
  weekday: number;
  startLocal: string;
  endLocal: string;
}

const rules: RuleSeed[] = [];

// UK-evening shift: mentors 1-4, Mon-Fri, ~20:00-00:30 IST (varies slightly)
// UK evening = ~15:00-19:00 UK = 20:30-00:30 IST
const ukShifts: [string, string][] = [
  ['20:00', '00:30'], // Priya: 4.5h
  ['20:30', '00:30'], // Arjun: 4h
  ['20:00', '00:00'], // Neha: 4h
  ['20:30', '00:00'], // Rohan: 3.5h
];
for (let i = 0; i < 4; i++) {
  const [start, end] = ukShifts[i]!;
  for (let day = 1; day <= 5; day++) { // Mon-Fri
    rules.push({ mentorId: i + 1, weekday: day, startLocal: start, endLocal: end });
  }
}

// US-evening shift: mentors 5-8, Tue-Sat IST (= Mon-Fri US evenings)
// US Eastern evening = ~18:00-22:00 ET = 03:30-07:30 IST (next day)
// These cross midnight in IST
const usShifts: [string, string][] = [
  ['02:00', '07:00'], // Kavitha: 5h
  ['02:30', '07:00'], // Vikram: 4.5h
  ['02:00', '06:30'], // Ananya: 4.5h
  ['02:30', '06:30'], // Siddharth: 4h
];
for (let i = 0; i < 4; i++) {
  const [start, end] = usShifts[i]!;
  for (let day = 2; day <= 6; day++) { // Tue-Sat IST (Mon-Fri US evenings)
    rules.push({ mentorId: i + 5, weekday: day, startLocal: start, endLocal: end });
  }
}

// Weekend shift: mentors 9-10, Sat-Sun
// US/UK weekend mornings = IST afternoon/evening
// Sat-Sun, covering ~14:00-20:00 IST
rules.push({ mentorId: 9, weekday: 6, startLocal: '14:00', endLocal: '20:00' }); // Sat
rules.push({ mentorId: 9, weekday: 7, startLocal: '14:00', endLocal: '19:30' }); // Sun
rules.push({ mentorId: 10, weekday: 6, startLocal: '14:30', endLocal: '20:00' }); // Sat
rules.push({ mentorId: 10, weekday: 7, startLocal: '14:00', endLocal: '20:00' }); // Sun

const insertRule = db.prepare(
  'INSERT INTO availability_rules (mentor_id, weekday, start_local, end_local) VALUES (?, ?, ?, ?)',
);

for (const r of rules) {
  insertRule.run(r.mentorId, r.weekday, r.startLocal, r.endLocal);
}

console.log(`Seeded ${mentors.length} mentors with ${rules.length} availability rules.`);

// ── Scenarios (DESIGN.md §7.1) ────────────────────────────────────────────

if (scenarios) {
  const insertBooking = db.prepare(`
    INSERT INTO bookings (
      token, idempotency_key, mentor_id, start_utc, end_utc, mentor_local_date,
      parent_name, parent_email, parent_phone, parent_timezone,
      child_name, child_age, class_link, status, created_at, cancelled_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, NULL)
  `);

  function makeToken(): string {
    return randomBytes(32).toString('base64url');
  }

  // Scenario 1: Mentor 1 (Priya) at 2/2 on 2026-11-17 (mentor-local)
  // Slots at 20:00 IST and 20:30 IST = 14:30 UTC and 15:00 UTC
  insertBooking.run(
    makeToken(), uuid(), 1, '2026-11-17T14:30:00Z', '2026-11-17T15:00:00Z', '2026-11-17',
    'Sarah Johnson', 'sarah@example.com', null, 'Europe/London',
    'Emma', 8, `${config.CLASS_LINK_BASE_URL}/${uuid()}`, '2026-11-16T10:00:00Z',
  );
  insertBooking.run(
    makeToken(), uuid(), 1, '2026-11-17T15:00:00Z', '2026-11-17T15:30:00Z', '2026-11-17',
    'James Wilson', 'james@example.com', null, 'Europe/London',
    'Oliver', 10, `${config.CLASS_LINK_BASE_URL}/${uuid()}`, '2026-11-16T10:05:00Z',
  );

  // Scenario 2: Slot 2026-11-18T15:00:00Z with only 1 mentor left
  // Book mentors 2, 3 at that slot so only mentor 4 remains for UK-evening
  insertBooking.run(
    makeToken(), uuid(), 2, '2026-11-18T15:00:00Z', '2026-11-18T15:30:00Z', '2026-11-18',
    'Emily Brown', 'emily@example.com', null, 'Europe/Dublin',
    'Liam', 7, `${config.CLASS_LINK_BASE_URL}/${uuid()}`, '2026-11-16T11:00:00Z',
  );
  insertBooking.run(
    makeToken(), uuid(), 3, '2026-11-18T15:00:00Z', '2026-11-18T15:30:00Z', '2026-11-18',
    'Michael Davis', 'michael@example.com', null, 'Europe/London',
    'Sophie', 9, `${config.CLASS_LINK_BASE_URL}/${uuid()}`, '2026-11-16T11:05:00Z',
  );

  // Scenario 3: Fully booked day — mentor 4 at 2/2 on 2026-11-19, plus other UK mentors booked
  // This ensures at least one mentor-local day is fully packed
  insertBooking.run(
    makeToken(), uuid(), 4, '2026-11-19T15:00:00Z', '2026-11-19T15:30:00Z', '2026-11-19',
    'Laura Martinez', 'laura@example.com', null, 'America/New_York',
    'Lucas', 11, `${config.CLASS_LINK_BASE_URL}/${uuid()}`, '2026-11-16T12:00:00Z',
  );
  insertBooking.run(
    makeToken(), uuid(), 4, '2026-11-19T15:30:00Z', '2026-11-19T16:00:00Z', '2026-11-19',
    'Robert Chen', 'robert@example.com', null, 'America/New_York',
    'Mia', 6, `${config.CLASS_LINK_BASE_URL}/${uuid()}`, '2026-11-16T12:05:00Z',
  );

  console.log('Seeded scenario bookings: mentor at 2/2, slot with 1 left, fully booked day.');
}

db.close();
console.log('Done.');
