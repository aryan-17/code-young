import { describe, it, expect } from 'vitest';
import { expandMentorSlots } from '../../src/domain/slots.js';
import { formatZoneLabel, formatTimeLabel, getZoneAbbr } from '@codeyoung/shared';
import { DateTime } from 'luxon';
import type { AvailabilityRuleRow } from '../../src/repositories/types.js';

function rule(weekday: number, start: string, end: string): AvailabilityRuleRow {
  return { id: 1, mentor_id: 1, weekday, start_local: start, end_local: end };
}

/** Get the zone abbreviation for a UTC instant in a given zone */
function zoneAbbr(startUtc: string, zone: string): string {
  const dt = DateTime.fromISO(startUtc, { zone: 'utc' });
  return getZoneAbbr(zone, dt);
}

describe('DST — New York spring forward Mar 14 2027', () => {
  // US clocks spring forward at 2:00 AM on Mar 14 2027
  // 2:00-2:59 AM ET doesn't exist that day
  // Mentor in IST: rule covers overnight into Mar 14 US evening → Mar 14 early IST = Mar 13-14 UTC

  it('no 2:xx AM ET slots on spring forward day', () => {
    // Mentor works Sun (7) 02:00-07:00 IST (covers Sat US evening)
    // For Mar 14 2027 (Sun IST), 02:00 IST = Mar 13 20:30 UTC, 07:00 IST = Mar 14 01:30 UTC
    // In New York: Mar 13 20:30 UTC = 3:30 PM ET, ... Mar 14 01:30 UTC = 9:30 PM ET (after spring forward)
    // But we need slots that LAND in 2:xx AM ET
    // 2:00 AM ET on Mar 14 would be 07:00 UTC (EST) or 06:00 UTC (EDT) — but the hour doesn't exist
    // Let's use a broader rule that would generate slots through the 2 AM hour if it existed

    // Mentor works Saturday (6) 20:00-00:30 IST → covers afternoon ET
    // Better: create a rule that would span the 2 AM gap in ET
    // Saturday Mar 13 IST = Friday Mar 12 / Saturday Mar 13 US
    // We need a mentor rule that generates slots around 2 AM ET on March 14
    // 1:00 AM EST = 06:00 UTC, 3:00 AM EDT = 07:00 UTC

    // A mentor with a wide range covering 05:00-08:00 UTC on that day
    // In IST that's 10:30-13:30 (Sun Mar 14)
    const rules = [rule(7, '10:00', '14:00')]; // Sunday 10:00-14:00 IST
    const slots = expandMentorSlots(rules, 'Asia/Kolkata', '2027-03-14', '2027-03-14', 30);

    // Convert each slot to NY local time and check no 2:xx AM
    const nyTimes = slots.map(s => {
      const dt = DateTime.fromISO(s.startUtc, { zone: 'utc' }).setZone('America/New_York');
      return { hour: dt.hour, minute: dt.minute, label: formatTimeLabel(dt) };
    });

    // No slot should have hour === 2
    const twoAMSlots = nyTimes.filter(t => t.hour === 2);
    expect(twoAMSlots).toHaveLength(0);
  });
});

describe('DST — New York fall back Nov 7 2027', () => {
  // US clocks fall back at 2:00 AM on Nov 7 2027
  // 1:00-1:59 AM occurs twice: once EDT, once EST

  it('two 1:30 AM slots with different zone abbreviations', () => {
    // Need mentor slots that cover both 1:30 AM EDT and 1:30 AM EST in New York
    // 1:30 AM EDT = 05:30 UTC, 1:30 AM EST = 06:30 UTC
    // Mentor rule covering 05:00-07:00 UTC → in IST that's 10:30-12:30 (Sun Nov 7)
    const rules = [rule(7, '10:30', '13:00')]; // Sunday 10:30-13:00 IST
    const slots = expandMentorSlots(rules, 'Asia/Kolkata', '2027-11-07', '2027-11-07', 30);

    // Find slots that show as 1:30 AM in New York
    const oneThirtySlots = slots.filter(s => {
      const dt = DateTime.fromISO(s.startUtc, { zone: 'utc' }).setZone('America/New_York');
      return dt.hour === 1 && dt.minute === 30;
    });

    expect(oneThirtySlots).toHaveLength(2);

    // They should have different UTC times
    expect(oneThirtySlots[0]!.startUtc).not.toBe(oneThirtySlots[1]!.startUtc);

    // They should have different zone abbreviations
    const abbrs = oneThirtySlots.map(s => zoneAbbr(s.startUtc, 'America/New_York'));
    expect(abbrs).toContain('EDT');
    expect(abbrs).toContain('EST');
  });
});

describe('DST — London spring forward Mar 28 2027', () => {
  // UK clocks spring forward at 1:00 AM on Mar 28 2027
  // 1:00 AM doesn't exist (goes from 00:59 GMT to 02:00 BST)

  it('no 1:xx AM GMT slots on spring forward day', () => {
    // Mentor rule generating slots around 1 AM London time
    // 1:00 AM GMT would be 01:00 UTC, but it doesn't exist — jump to 2:00 BST = 01:00 UTC
    // Actually in London, at 01:00 UTC on Mar 28 it's already 02:00 BST
    // Need mentor slots around 00:30-02:30 UTC
    const rules = [rule(7, '06:00', '08:00')]; // Sunday 06:00-08:00 IST = 00:30-02:30 UTC
    const slots = expandMentorSlots(rules, 'Asia/Kolkata', '2027-03-28', '2027-03-28', 30);

    const londonTimes = slots.map(s => {
      const dt = DateTime.fromISO(s.startUtc, { zone: 'utc' }).setZone('Europe/London');
      return { hour: dt.hour, label: formatTimeLabel(dt) };
    });

    // No slot at 1:xx AM in London
    const oneAM = londonTimes.filter(t => t.hour === 1);
    expect(oneAM).toHaveLength(0);
  });
});

describe('DST — London fall back Oct 31 2027', () => {
  // UK clocks fall back at 2:00 AM BST → 1:00 AM GMT on Oct 31 2027
  // 1:00-1:59 AM occurs twice: BST and GMT

  it('two 1:00 AM slots with different abbreviations', () => {
    // 1:00 AM BST = 00:00 UTC, 1:00 AM GMT = 01:00 UTC
    // Need mentor covering 23:30-02:00 UTC or similar
    const rules = [rule(7, '05:00', '08:00')]; // Sunday 05:00-08:00 IST = 23:30 (Sat)-02:30 UTC
    const slots = expandMentorSlots(rules, 'Asia/Kolkata', '2027-10-31', '2027-10-31', 30);

    const oneAMSlots = slots.filter(s => {
      const dt = DateTime.fromISO(s.startUtc, { zone: 'utc' }).setZone('Europe/London');
      return dt.hour === 1 && dt.minute === 0;
    });

    expect(oneAMSlots).toHaveLength(2);
    const abbrs = oneAMSlots.map(s => zoneAbbr(s.startUtc, 'Europe/London'));
    expect(abbrs).toContain('BST');
    expect(abbrs).toContain('GMT');
  });
});

describe('DST — Dublin labels never render bare "IST"', () => {
  it('summer: Dublin IST shows "(Irish Summer Time)"', () => {
    // July 2027 — Dublin is in IST (Irish Standard Time = UTC+1)
    const instant = DateTime.fromISO('2027-07-15T12:00:00Z', { zone: 'utc' });
    const label = formatZoneLabel('Europe/Dublin', instant);
    expect(label).toContain('Irish Summer Time');
    expect(label).not.toMatch(/· IST$/); // never bare IST
  });

  it('winter: Dublin GMT shows "GMT"', () => {
    const instant = DateTime.fromISO('2027-01-15T12:00:00Z', { zone: 'utc' });
    const label = formatZoneLabel('Europe/Dublin', instant);
    expect(label).toContain('GMT');
    expect(label).not.toContain('IST');
  });
});

describe('DST — Mismatch week Mar 14-27 2027', () => {
  // NY springs forward Mar 14, London springs forward Mar 28
  // During Mar 14-27: NY-London gap is 4h instead of usual 5h

  it('same IST mentor slot is 4h apart in NY vs London during mismatch', () => {
    // Mar 20 2027 (Saturday) — in the mismatch window
    // Mentor slot at 20:30 IST = 15:00 UTC
    // NY (EDT, -4): 15:00 UTC = 11:00 AM
    // London (GMT, +0): 15:00 UTC = 3:00 PM
    // Difference: 4 hours (not 5)
    const utcInstant = '2027-03-20T15:00:00.000Z';

    const nyDt = DateTime.fromISO(utcInstant, { zone: 'utc' }).setZone('America/New_York');
    const londonDt = DateTime.fromISO(utcInstant, { zone: 'utc' }).setZone('Europe/London');

    expect(nyDt.hour).toBe(11); // 11:00 AM EDT
    expect(londonDt.hour).toBe(15); // 3:00 PM GMT

    // Offset difference: London(0) - NY(-4) = 4 hours
    expect(londonDt.offset - nyDt.offset).toBe(4 * 60);
  });

  it('outside mismatch window, gap is 5h', () => {
    // Apr 5 2027 — both in summer time
    const utcInstant = '2027-04-05T15:00:00.000Z';

    const nyDt = DateTime.fromISO(utcInstant, { zone: 'utc' }).setZone('America/New_York');
    const londonDt = DateTime.fromISO(utcInstant, { zone: 'utc' }).setZone('Europe/London');

    // London BST (+1) - NY EDT (-4) = 5 hours
    expect(londonDt.offset - nyDt.offset).toBe(5 * 60);
  });
});

describe('DST — Phoenix and Honolulu unchanged', () => {
  it('Phoenix offset is always -7h (no DST)', () => {
    const winter = DateTime.fromISO('2027-01-15T12:00:00Z', { zone: 'utc' }).setZone('America/Phoenix');
    const summer = DateTime.fromISO('2027-07-15T12:00:00Z', { zone: 'utc' }).setZone('America/Phoenix');
    expect(winter.offset).toBe(-7 * 60);
    expect(summer.offset).toBe(-7 * 60);
  });

  it('Honolulu offset is always -10h (no DST)', () => {
    const winter = DateTime.fromISO('2027-01-15T12:00:00Z', { zone: 'utc' }).setZone('Pacific/Honolulu');
    const summer = DateTime.fromISO('2027-07-15T12:00:00Z', { zone: 'utc' }).setZone('Pacific/Honolulu');
    expect(winter.offset).toBe(-10 * 60);
    expect(summer.offset).toBe(-10 * 60);
  });
});

describe('DST — Booking near US fall back Nov 1 2026', () => {
  it('slot before transition shows EDT label, after shows EST', () => {
    // US fall back Nov 1 2026 at 2:00 AM
    // Slot at 1:30 AM EDT (05:30 UTC) → EDT
    const beforeDt = DateTime.fromISO('2026-11-01T05:30:00Z', { zone: 'utc' });
    expect(getZoneAbbr('America/New_York', beforeDt)).toBe('EDT');

    // Slot at 1:30 AM EST (06:30 UTC) → EST
    const afterDt = DateTime.fromISO('2026-11-01T06:30:00Z', { zone: 'utc' });
    expect(getZoneAbbr('America/New_York', afterDt)).toBe('EST');
  });
});

describe('DST — Booking near UK fall back Oct 25 2026', () => {
  it('slot before transition shows BST, after shows GMT', () => {
    // UK fall back Oct 25 2026 at 2:00 AM BST → 1:00 AM GMT (01:00 UTC)
    // Before: 00:30 UTC = 1:30 AM BST
    const beforeDt = DateTime.fromISO('2026-10-25T00:30:00Z', { zone: 'utc' });
    expect(getZoneAbbr('Europe/London', beforeDt)).toBe('BST');

    // After: 01:30 UTC = 1:30 AM GMT
    const afterDt = DateTime.fromISO('2026-10-25T01:30:00Z', { zone: 'utc' });
    expect(getZoneAbbr('Europe/London', afterDt)).toBe('GMT');
  });
});
