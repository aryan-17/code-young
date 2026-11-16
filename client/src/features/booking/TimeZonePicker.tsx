import { useState, useMemo } from 'react';

const COMMON_ZONES = [
  { zone: 'America/New_York', label: 'Eastern Time (US)' },
  { zone: 'America/Chicago', label: 'Central Time (US)' },
  { zone: 'America/Denver', label: 'Mountain Time (US)' },
  { zone: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { zone: 'America/Phoenix', label: 'Arizona' },
  { zone: 'America/Anchorage', label: 'Alaska' },
  { zone: 'Pacific/Honolulu', label: 'Hawaii' },
  { zone: 'Europe/London', label: 'United Kingdom' },
  { zone: 'Europe/Dublin', label: 'Ireland' },
  { zone: 'Asia/Kolkata', label: 'India' },
];

// Get all IANA zones from Intl
function getAllZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone');
  } catch {
    return COMMON_ZONES.map(z => z.zone);
  }
}

interface Props {
  current: string;
  onSelect: (zone: string) => void;
  onClose: () => void;
}

export function TimeZonePicker({ current, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const allZones = useMemo(getAllZones, []);

  const filtered = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return allZones
      .filter(z => z.toLowerCase().includes(q))
      .slice(0, 20);
  }, [search, allZones]);

  return (
    <div className="mt-3 bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-h-80 overflow-y-auto">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">Select time zone</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
      </div>

      <input
        type="text"
        placeholder="Search zones..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        autoFocus
      />

      <div className="space-y-1">
        <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Common</div>
        {COMMON_ZONES.map(({ zone, label }) => (
          <button
            key={zone}
            onClick={() => onSelect(zone)}
            className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-indigo-50 transition-colors
              ${zone === current ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-700'}`}
          >
            {label} <span className="text-gray-400 text-xs">({zone})</span>
          </button>
        ))}

        {filtered.length > 0 && (
          <>
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mt-3 mb-1">Search results</div>
            {filtered.map(zone => (
              <button
                key={zone}
                onClick={() => onSelect(zone)}
                className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-indigo-50
                  ${zone === current ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-700'}`}
              >
                {zone}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
