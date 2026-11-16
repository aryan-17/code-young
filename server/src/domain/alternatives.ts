import { DateTime } from 'luxon';

interface AvailableSlot {
  startUtc: string;
  available: boolean;
}

interface AlternativeSlot {
  startUtc: string;
}

/**
 * Find alternative available slots when a requested slot is unavailable (DESIGN.md §5.5).
 *
 * Returns up to `limit` alternatives:
 * 1. Nearest available slots on the same parent-local day (before and after)
 * 2. Same parent-local time on the next available days
 * 3. Earliest available slot overall
 * Deduplicated, sorted by closeness to requested time.
 */
export function findAlternatives(
  requestedStartUtc: string,
  allSlots: AvailableSlot[],
  parentZone: string,
  limit = 6,
): AlternativeSlot[] {
  const requested = DateTime.fromISO(requestedStartUtc, { zone: 'utc' });
  const requestedLocal = requested.setZone(parentZone);
  const requestedDate = requestedLocal.toISODate()!;
  const requestedLocalTime = requestedLocal.toFormat('HH:mm');

  const available = allSlots.filter(s => s.available);
  if (available.length === 0) return [];

  const seen = new Set<string>();
  const candidates: Array<{ startUtc: string; distance: number }> = [];

  function add(slot: AvailableSlot, distance: number) {
    if (seen.has(slot.startUtc)) return;
    seen.add(slot.startUtc);
    candidates.push({ startUtc: slot.startUtc, distance });
  }

  // 1. Nearest available on same parent-local day
  const sameDaySlots = available.filter(s => {
    const local = DateTime.fromISO(s.startUtc, { zone: 'utc' }).setZone(parentZone);
    return local.toISODate() === requestedDate;
  });
  for (const slot of sameDaySlots) {
    const dist = Math.abs(DateTime.fromISO(slot.startUtc, { zone: 'utc' }).toMillis() - requested.toMillis());
    add(slot, dist);
  }

  // 2. Same parent-local time on next available days
  const sameTimeSlots = available.filter(s => {
    const local = DateTime.fromISO(s.startUtc, { zone: 'utc' }).setZone(parentZone);
    return local.toFormat('HH:mm') === requestedLocalTime && local.toISODate() !== requestedDate;
  });
  for (const slot of sameTimeSlots) {
    const dist = Math.abs(DateTime.fromISO(slot.startUtc, { zone: 'utc' }).toMillis() - requested.toMillis());
    add(slot, dist);
  }

  // 3. Earliest available overall
  const sorted = [...available].sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  if (sorted[0]) {
    const dist = Math.abs(DateTime.fromISO(sorted[0].startUtc, { zone: 'utc' }).toMillis() - requested.toMillis());
    add(sorted[0], dist);
  }

  // Sort by distance (closeness to requested time) and return top `limit`
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates.slice(0, limit).map(c => ({ startUtc: c.startUtc }));
}
