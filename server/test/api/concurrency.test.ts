import { describe, it, expect, afterEach } from 'vitest';
import { createTestApp, bookingBody } from './helpers.js';
import { v4 as uuid } from 'uuid';

let cleanup: () => void;
afterEach(() => cleanup?.());

describe('Concurrency (DESIGN.md §9.2)', () => {
  it('1 mentor, 10 parallel requests → exactly 1 success', async () => {
    const { app, cleanup: c } = createTestApp({
      mentors: [{
        id: 1, name: 'Solo Mentor', timezone: 'Asia/Kolkata',
        rules: [{ weekday: 1, start: '20:00', end: '21:00' }],
      }],
    });
    cleanup = c;

    const requests = Array.from({ length: 10 }, (_, i) =>
      app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: bookingBody({
          parentEmail: `p${i}@test.com`,
          childName: `Child${i}`,
          idempotencyKey: uuid(),
        }),
      }),
    );

    const results = await Promise.all(requests);
    const successes = results.filter(r => r.statusCode === 201);
    const conflicts = results.filter(r => r.statusCode === 409);

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(9);
    for (const c of conflicts) {
      expect(c.json().error.code).toBe('SLOT_UNAVAILABLE');
    }
  });

  it('3 mentors, 10 parallel requests → exactly 3 successes', async () => {
    const { app, cleanup: c } = createTestApp({
      mentors: [
        { id: 1, name: 'M1', timezone: 'Asia/Kolkata', rules: [{ weekday: 1, start: '20:00', end: '21:00' }] },
        { id: 2, name: 'M2', timezone: 'Asia/Kolkata', rules: [{ weekday: 1, start: '20:00', end: '21:00' }] },
        { id: 3, name: 'M3', timezone: 'Asia/Kolkata', rules: [{ weekday: 1, start: '20:00', end: '21:00' }] },
      ],
    });
    cleanup = c;

    const requests = Array.from({ length: 10 }, (_, i) =>
      app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: bookingBody({
          parentEmail: `p${i}@test.com`,
          childName: `Child${i}`,
          idempotencyKey: uuid(),
        }),
      }),
    );

    const results = await Promise.all(requests);
    const successes = results.filter(r => r.statusCode === 201);
    const conflicts = results.filter(r => r.statusCode === 409);

    expect(successes).toHaveLength(3);
    expect(conflicts).toHaveLength(7);

    // Each mentor should have exactly 1 booking
    const mentorIds = successes.map(r => r.json().mentor.id);
    expect(new Set(mentorIds).size).toBe(3);
  });
});
