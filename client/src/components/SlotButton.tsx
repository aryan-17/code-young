interface SlotButtonProps {
  time: string;
  zoneAbbr: string;
  available: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export function SlotButton({ time, zoneAbbr, available, selected, onClick }: SlotButtonProps) {
  if (!available) {
    return (
      <button
        disabled
        className="px-3 py-2 rounded-lg text-sm border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
        aria-label={`${time} ${zoneAbbr} — Booked`}
      >
        <span>{time}</span>
        <span className="block text-xs text-gray-300">Booked</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500
        ${selected
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-gray-800 border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
        }`}
      aria-label={`${time} ${zoneAbbr}`}
      aria-pressed={selected}
    >
      <span>{time}</span>
      <span className={`block text-xs ${selected ? 'text-indigo-200' : 'text-gray-400'}`}>{zoneAbbr}</span>
    </button>
  );
}
