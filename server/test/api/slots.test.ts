import { describe, it, expect, afterEach } from 'vitest';
import { createTestApp } from './helpers.js';

let cleanup: () => void;
afterEach(() => cleanup?.());

describe('GET /api/slots', () => {
  it('returns slots grouped by parent-local day', async () => {
    const { app, cleanup: c } = createTestApp();
    cleanup = c;

    const res = await app.inject({
      method: 'GET',
      url: '/api/slots?timezone=America/New_York',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.timezone).toBe('America/New_York');
    expect(body.zoneLabelNow).toContain('Eastern Time');
    expect(body.days).toBeInstanceOf(Array);
    expect(body.days.length).toBeGreaterThan(0);

    // Each day should have slots
    const firstDay = body.days[0];
    expect(firstDay.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(firstDay.label).toBeTruthy();
    expect(firstDay.slots.length).toBeGreaterThan(0);
    expect(firstDay.slots[0].startUtc).toBeTruthy();
    expect(firstDay.slots[0].localTime).toBeTruthy();
    expect(firstDay.slots[0].zoneAbbr).toBeTruthy();
    expect(typeof firstDay.slots[0].available).toBe('boolean');
  });

  it('respects timezone parameter', async () => {
    const { app, cleanup: c } = createTestApp();
    cleanup = c;

    const nyRes = await app.inject({
      method: 'GET',
      url: '/api/slots?timezone=America/New_York',
    });
    const londonRes = await app.inject({
      method: 'GET',
      url: '/api/slots?timezone=Europe/London',
    });

    const nyBody = nyRes.json();
    const londonBody = londonRes.json();

    expect(nyBody.zoneLabelNow).toContain('Eastern');
    expect(londonBody.zoneLabelNow).toContain('UK');
  });

  it('invalid timezone → 400', async () => {
    const { app, cleanup: c } = createTestApp();
    cleanup = c;

    const res = await app.inject({
      method: 'GET',
      url: '/api/slots?timezone=Invalid/Zone',
    });
    expect(res.statusCode).toBe(400);
  });

  it('missing timezone → 400', async () => {
    const { app, cleanup: c } = createTestApp();
    cleanup = c;

    const res = await app.inject({ method: 'GET', url: '/api/slots' });
    expect(res.statusCode).toBe(400);
  });
});
