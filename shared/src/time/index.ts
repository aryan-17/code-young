import { DateTime } from 'luxon';

/**
 * Curated zone display names — DESIGN.md §4.6.
 * Maps IANA zone → friendly prefix. Zones not listed fall back to IANA name + UTC offset.
 */
const ZONE_LABELS: Record<string, string> = {
  'America/New_York': 'Eastern Time',
  'America/Chicago': 'Central Time',
  'America/Denver': 'Mountain Time',
  'America/Los_Angeles': 'Pacific Time',
  'America/Phoenix': 'Arizona Time',
  'America/Anchorage': 'Alaska Time',
  'Pacific/Honolulu': 'Hawaii Time',
  'Europe/London': 'UK time',
  'Europe/Dublin': 'Irish time',
  'Asia/Kolkata': 'India time',
};

/**
 * Format a human-readable zone label for a given IANA zone at a given instant.
 *
 * Examples (DESIGN.md §4.6):
 *  - "Eastern Time · EST" / "Eastern Time · EDT"
 *  - "UK time · GMT" / "UK time · BST"
 *  - "Irish time · GMT" / "Irish time · IST (Irish Summer Time)"
 *  - "India time · IST (UTC+5:30)"
 *  - fallback: "America/Sao_Paulo · UTC−3"
 */
export function formatZoneLabel(zone: string, instant: DateTime): string {
  const dt = instant.setZone(zone);
  if (!dt.isValid) return zone;

  const abbr = dt.toFormat('ZZZZ'); // e.g. "EST", "BST", "GMT", "IST"
  const offsetStr = dt.toFormat("'UTC'ZZ"); // e.g. "UTC+05:30", "UTC-05:00"
  const friendlyName = ZONE_LABELS[zone];

  if (!friendlyName) {
    // Fallback: "America/Sao_Paulo · UTC−3"
    const short = formatShortOffset(dt);
    return `${zone} · ${short}`;
  }

  // Disambiguate IST — India vs Ireland summer (DESIGN.md §4.6)
  if (zone === 'Asia/Kolkata') {
    return `${friendlyName} · IST (${offsetStr})`;
  }

  if (zone === 'Europe/Dublin' && abbr === 'IST') {
    return `${friendlyName} · IST (Irish Summer Time)`;
  }

  return `${friendlyName} · ${abbr}`;
}

/** Short offset like "UTC+5:30" or "UTC−3" */
function formatShortOffset(dt: DateTime): string {
  const offset = dt.offset; // minutes
  if (offset === 0) return 'UTC';
  const sign = offset > 0 ? '+' : '−';
  const absMinutes = Math.abs(offset);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  return mins === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${String(mins).padStart(2, '0')}`;
}

/**
 * Format a date for display: "Fri, 20 Nov" — avoids US/UK date format confusion (DESIGN.md §4.6).
 */
export function formatDateLabel(dt: DateTime): string {
  return dt.toFormat('ccc, d LLL');
}

/**
 * Format a time for display: "4:00 PM"
 */
export function formatTimeLabel(dt: DateTime): string {
  return dt.toFormat('h:mm a');
}
