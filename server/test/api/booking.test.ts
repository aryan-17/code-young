import { describe, it, expect, afterEach } from 'vitest';
import { createTestApp, bookingBody } from './helpers.js';
import { v4 as uuid } from 'uuid';

let cleanup: () => void;

afterEach(() => {
  cleanup?.();
});

describe('POST /api/bookings', () => {
  it('happy path → 201, booking with mentor and notifications', async () => {
    const { app, cleanup: c } = createTestApp();
    cleanup = c;

    const body = bookingBody();
    const res = await app.inject({ method: 'POST', url: '/api/bookings', payload: body });

    expect(res.statusCode).toBe(201);
    const booking = res.json();
    expect(booking.token).toBeTruthy();
    // Response normalizes to .000Z format
    expect(booking.startUtc).toBe('2026-11-16T14:30:00.000Z');
    expect(booking.mentor.name).toBe('Test Mentor');
    expect(booking.status).toBe('confirmed');
    expect(booking.classLink).toContain('codeyoung-demo.com');
    expect(booking.localTime).toBeTruthy();
    expect(booking.zoneLabel).toContain('Eastern Time');

    // Check notifications created
    const notifRes = await app.inject({ method: 'GET', url: '/api/notifications' });
    const notifs = notifRes.json();
    expect(notifs).toHaveLength(2);
    const types = notifs.map((n: { recipient_type: string }) => n.recipient_type);
    expect(types).toContain('parent');
    expect(types).toContain('mentor');
  });

  it('idempotent retry returns same booking with 200', async () => {
    const { app, cleanup: c } = createTestApp();
    cleanup = c;

    const key = uuid();
    const body = bookingBody({ idempotencyKey: key });

    const res1 = await app.inject({ method: 'POST', url: '/api/bookings', payload: body });
    expect(res1.statusCode).toBe(201);

    const res2 = await app.inject({ method: 'POST', url: '/api/bookings', payload: body });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().token).toBe(res1.json().token);
  });

  it('duplicate parent+child → 409 ALREADY_BOOKED', async () => {
    const { app, cleanup: c } = createTestApp();
    cleanup = c;

    const body1 = bookingBody({ parentEmail: 'dup@test.com', childName: 'Sam' });
    await app.inject({ method: 'POST', url: '/api/bookings', payload: body1 });

    const body2 = bookingBody({
      parentEmail: 'dup@test.com', childName: 'Sam',
      startUtc: '2026-11-16T15:00:00Z',
    });
    const res = await app.inject({ method: 'POST', url: '/api/bookings', payload: body2 });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('ALREADY_BOOKED');
  });

  it('fully booked slot → 409 SLOT_UNAVAILABLE with alternatives', async () => {
    const { app, cleanup: c } = createTestApp({
      mentors: [{
        id: 1, name: 'M1', timezone: 'Asia/Kolkata',
        rules: [{ weekday: 1, start: '20:00', end: '21:00' }],
      }],
    });
    cleanup = c;

    // Book the only mentor at this slot
    const body1 = bookingBody({ parentEmail: 'a@test.com', childName: 'A' });
    const res1 = await app.inject({ method: 'POST', url: '/api/bookings', payload: body1 });
    expect(res1.statusCode).toBe(201);

    // Try to book same slot — no mentors left
    const body2 = bookingBody({ parentEmail: 'b@test.com', childName: 'B' });
    const res2 = await app.inject({ method: 'POST', url: '/api/bookings', payload: body2 });
    expect(res2.statusCode).toBe(409);
    expect(res2.json().error.code).toBe('SLOT_UNAVAILABLE');
    expect(res2.json().error.details.alternatives).toBeDefined();
  });

  it('mentor at 2/2 → next booking goes to another mentor', async () => {
    const { app, cleanup: c } = createTestApp({
      mentors: [
        { id: 1, name: 'M1', timezone: 'Asia/Kolkata', rules: [{ weekday: 1, start: '20:00', end: '23:00' }] },
        { id: 2, name: 'M2', timezone: 'Asia/Kolkata', rules: [{ weekday: 1, start: '20:00', end: '23:00' }] },
      ],
    });
    cleanup = c;

    // LeastLoaded distributes: slot 1 → M1 (tie: lowest id), slot 2 → M2 (M1 has 1, M2 has 0)
    // slot 3 → M1 (both have 1, tie → lowest id), slot 4 → M2 (M1 has 2, M2 has 1)
    // After 3 bookings: M1=2, M2=1. Fourth booking at a new slot → M2 (M1 is at 2/2)
    await app.inject({
      method: 'POST', url: '/api/bookings',
      payload: bookingBody({ parentEmail: 'a@test.com', childName: 'A', startUtc: '2026-11-16T14:30:00Z' }),
    });
    await app.inject({
      method: 'POST', url: '/api/bookings',
      payload: bookingBody({ parentEmail: 'b@test.com', childName: 'B', startUtc: '2026-11-16T15:00:00Z' }),
    });
    await app.inject({
      method: 'POST', url: '/api/bookings',
      payload: bookingBody({ parentEmail: 'c@test.com', childName: 'C', startUtc: '2026-11-16T15:30:00Z' }),
    });

    // M1 now at 2/2, fourth booking must go to M2
    const res = await app.inject({
      method: 'POST', url: '/api/bookings',
      payload: bookingBody({ parentEmail: 'd@test.com', childName: 'D', startUtc: '2026-11-16T16:00:00Z' }),
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().mentor.id).toBe(2);
  });

  it('invalid timezone → 400 INVALID_TIMEZONE', async () => {
    const { app, cleanup: c } = createTestApp();
    cleanup = c;

    const body = bookingBody({ timezone: 'Fake/Zone' });
    const res = await app.inject({ method: 'POST', url: '/api/bookings', payload: body });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_TIMEZONE');
  });

  it('off-grid time → 400 SLOT_NOT_ON_GRID', async () => {
    const { app, cleanup: c } = createTestApp();
    cleanup = c;

    const body = bookingBody({ startUtc: '2026-11-16T14:15:00Z' });
    const res = await app.inject({ method: 'POST', url: '/api/bookings', payload: body });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('SLOT_NOT_ON_GRID');
  });

  it('out-of-range time (too soon) → 400 SLOT_OUT_OF_RANGE', async () => {
    const { app, cleanup: c } = createTestApp({ now: '2026-11-16T13:00:00Z' });
    cleanup = c;

    // Slot at 14:30 UTC, now is 13:00 UTC, lead time 120min = need 15:00+
    const body = bookingBody({ startUtc: '2026-11-16T14:30:00Z' });
    const res = await app.inject({ method: 'POST', url: '/api/bookings', payload: body });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('SLOT_OUT_OF_RANGE');
  });
});

describe('GET /api/bookings/:token', () => {
  it('returns booking by token', async () => {
    const { app, cleanup: c } = createTestApp();
    cleanup = c;

    const body = bookingBody();
    const createRes = await app.inject({ method: 'POST', url: '/api/bookings', payload: body });
    const { token } = createRes.json();

    const res = await app.inject({ method: 'GET', url: `/api/bookings/${token}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBe(token);
  });

  it('404 for unknown token', async () => {
    const { app, cleanup: c } = createTestApp();
    cleanup = c;

    const res = await app.inject({ method: 'GET', url: '/api/bookings/nonexistent' });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/bookings/:token/cancel', () => {
  it('cancel frees capacity', async () => {
    const { app, cleanup: c } = createTestApp({
      mentors: [{
        id: 1, name: 'M1', timezone: 'Asia/Kolkata',
        rules: [{ weekday: 1, start: '20:00', end: '21:00' }],
      }],
    });
    cleanup = c;

    // Book the only slot
    const body = bookingBody({ parentEmail: 'a@test.com', childName: 'A' });
    const createRes = await app.inject({ method: 'POST', url: '/api/bookings', payload: body });
    const { token } = createRes.json();

    // Another booking at same slot fails
    const body2 = bookingBody({ parentEmail: 'b@test.com', childName: 'B' });
    const failRes = await app.inject({ method: 'POST', url: '/api/bookings', payload: body2 });
    expect(failRes.statusCode).toBe(409);

    // Cancel first booking
    const cancelRes = await app.inject({ method: 'POST', url: `/api/bookings/${token}/cancel` });
    expect(cancelRes.statusCode).toBe(200);

    // Now same slot should succeed
    const retryRes = await app.inject({ method: 'POST', url: '/api/bookings', payload: body2 });
    expect(retryRes.statusCode).toBe(201);
  });

  it('double cancel → 409 ALREADY_CANCELLED', async () => {
    const { app, cleanup: c } = createTestApp();
    cleanup = c;

    const body = bookingBody();
    const createRes = await app.inject({ method: 'POST', url: '/api/bookings', payload: body });
    const { token } = createRes.json();

    await app.inject({ method: 'POST', url: `/api/bookings/${token}/cancel` });
    const res = await app.inject({ method: 'POST', url: `/api/bookings/${token}/cancel` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('ALREADY_CANCELLED');
  });
});
