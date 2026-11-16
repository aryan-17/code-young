import { describe, it, expect, afterEach } from 'vitest';
import { buildApp } from '../src/app.js';
import fs from 'node:fs';

const TEST_DB = 'test-health.db';

afterEach(() => {
  for (const ext of ['', '-wal', '-shm', '-journal']) {
    const p = TEST_DB + ext;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const app = buildApp({ dbPath: TEST_DB });

    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
