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
 * Curated abbreviation map — DESIGN.md §4.6 says don't rely on Intl short names
 * (Intl returns "GMT+1" for BST in en-US). Map zone + offset → known abbreviation.
 */
const ZONE_ABBRS: Record<string, Record<number, string>> = {
  'America/New_York':    { [-300]: 'EST', [-240]: 'EDT' },
  'America/Chicago':     { [-360]: 'CST', [-300]: 'CDT' },
  'America/Denver':      { [-420]: 'MST', [-360]: 'MDT' },
  'America/Los_Angeles': { [-480]: 'PST', [-420]: 'PDT' },
  'America/Phoenix':     { [-420]: 'MST' },
  'America/Anchorage':   { [-540]: 'AKST', [-480]: 'AKDT' },
  'Pacific/Honolulu':    { [-600]: 'HST' },
  'Europe/London':       { [0]: 'GMT', [60]: 'BST' },
  'Europe/Dublin':       { [0]: 'GMT', [60]: 'IST' },
  'Asia/Kolkata':        { [330]: 'IST' },
};

/** Get the curated abbreviation for a zone at a given instant, or fall back to offset */
function getAbbr(zone: string, dt: DateTime): string {
  const offsets = ZONE_ABBRS[zone];
  if (offsets) {
    const abbr = offsets[dt.offset];
    if (abbr) return abbr;
  }
  return formatShortOffset(dt);
}

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

  const abbr = getAbbr(zone, dt);
  const friendlyName = ZONE_LABELS[zone];

  if (!friendlyName) {
    // Fallback: "America/Sao_Paulo · UTC−3"
    const short = formatShortOffset(dt);
    return `${zone} · ${short}`;
  }

  // Disambiguate IST — India vs Ireland summer (DESIGN.md §4.6)
  if (zone === 'Asia/Kolkata') {
    return `${friendlyName} · IST (${formatShortOffset(dt)})`;
  }

  if (zone === 'Europe/Dublin' && abbr === 'IST') {
    return `${friendlyName} · IST (Irish Summer Time)`;
  }

  return `${friendlyName} · ${abbr}`;
}

/**
 * Get the curated zone abbreviation for display alongside times (e.g. "1:30 AM EST").
 */
export function getZoneAbbr(zone: string, instant: DateTime): string {
  const dt = instant.setZone(zone);
  if (!dt.isValid) return '';
  return getAbbr(zone, dt);
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
