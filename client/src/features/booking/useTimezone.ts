import { useState, useCallback } from 'react';

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/New_York';
  }
}

export function useTimezone() {
  const [timezone, setTimezone] = useState(detectTimezone);

  const changeTimezone = useCallback((tz: string) => {
    setTimezone(tz);
  }, []);

  return { timezone, changeTimezone };
}
