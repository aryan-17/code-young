import { describe, it, expect } from 'vitest';
import { formatZoneLabel } from '@codeyoung/shared';
import { DateTime } from 'luxon';

const winter = DateTime.fromISO('2027-01-15T12:00:00Z', { zone: 'utc' });
const summer = DateTime.fromISO('2027-07-15T12:00:00Z', { zone: 'utc' });

describe('formatZoneLabel — curated zones', () => {
  it('Eastern Time — winter EST', () => {
    expect(formatZoneLabel('America/New_York', winter)).toBe('Eastern Time · EST');
  });
  it('Eastern Time — summer EDT', () => {
    expect(formatZoneLabel('America/New_York', summer)).toBe('Eastern Time · EDT');
  });

  it('Central Time — winter CST', () => {
    expect(formatZoneLabel('America/Chicago', winter)).toBe('Central Time · CST');
  });
  it('Central Time — summer CDT', () => {
    expect(formatZoneLabel('America/Chicago', summer)).toBe('Central Time · CDT');
  });

  it('Mountain Time — winter MST', () => {
    expect(formatZoneLabel('America/Denver', winter)).toBe('Mountain Time · MST');
  });
  it('Mountain Time — summer MDT', () => {
    expect(formatZoneLabel('America/Denver', summer)).toBe('Mountain Time · MDT');
  });

  it('Pacific Time — winter PST', () => {
    expect(formatZoneLabel('America/Los_Angeles', winter)).toBe('Pacific Time · PST');
  });
  it('Pacific Time — summer PDT', () => {
    expect(formatZoneLabel('America/Los_Angeles', summer)).toBe('Pacific Time · PDT');
  });

  it('Arizona Time — always MST (no DST)', () => {
    expect(formatZoneLabel('America/Phoenix', winter)).toBe('Arizona Time · MST');
    expect(formatZoneLabel('America/Phoenix', summer)).toBe('Arizona Time · MST');
  });

  it('Alaska Time — winter AKST', () => {
    expect(formatZoneLabel('America/Anchorage', winter)).toBe('Alaska Time · AKST');
  });
  it('Alaska Time — summer AKDT', () => {
    expect(formatZoneLabel('America/Anchorage', summer)).toBe('Alaska Time · AKDT');
  });

  it('Hawaii Time — always HST (no DST)', () => {
    expect(formatZoneLabel('Pacific/Honolulu', winter)).toBe('Hawaii Time · HST');
    expect(formatZoneLabel('Pacific/Honolulu', summer)).toBe('Hawaii Time · HST');
  });

  it('UK time — winter GMT', () => {
    expect(formatZoneLabel('Europe/London', winter)).toBe('UK time · GMT');
  });
  it('UK time — summer BST', () => {
    expect(formatZoneLabel('Europe/London', summer)).toBe('UK time · BST');
  });

  it('Irish time — winter GMT', () => {
    const label = formatZoneLabel('Europe/Dublin', winter);
    expect(label).toBe('Irish time · GMT');
  });
  it('Irish time — summer IST with disambiguation', () => {
    const label = formatZoneLabel('Europe/Dublin', summer);
    expect(label).toBe('Irish time · IST (Irish Summer Time)');
    // Must never be bare "IST"
    expect(label).not.toMatch(/· IST$/);
  });

  it('India time — always IST with UTC offset', () => {
    const winterLabel = formatZoneLabel('Asia/Kolkata', winter);
    const summerLabel = formatZoneLabel('Asia/Kolkata', summer);
    expect(winterLabel).toContain('IST');
    expect(winterLabel).toContain('UTC');
    expect(winterLabel).toContain('+5:30');
    expect(summerLabel).toContain('IST');
    // Should never be bare "IST"
    expect(winterLabel).not.toMatch(/· IST$/);
    expect(summerLabel).not.toMatch(/· IST$/);
  });
});

describe('formatZoneLabel — fallback zones', () => {
  it('uncurated zone shows IANA name + UTC offset', () => {
    const label = formatZoneLabel('America/Sao_Paulo', winter);
    expect(label).toContain('America/Sao_Paulo');
    expect(label).toContain('UTC');
  });

  it('UTC zone', () => {
    const label = formatZoneLabel('UTC', winter);
    expect(label).toContain('UTC');
  });
});
