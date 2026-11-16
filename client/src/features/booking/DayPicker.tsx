import type { SlotDay } from '@codeyoung/shared';

interface Props {
  days: SlotDay[];
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
}

function dayHint(day: SlotDay): string {
  if (day.availableCount === 0) return 'Fully booked';
  if (day.availableCount <= 3) return `${day.availableCount} left`;
  return `${day.availableCount} slots`;
}

export function DayPicker({ days, selectedDate, onSelectDay }: Props) {
  if (days.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Pick a day</h3>
      <div
        className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x"
        role="listbox"
        aria-label="Available days"
      >
        {days.map(day => {
          const isSelected = day.date === selectedDate;
          const isFullyBooked = day.availableCount === 0;
          const hint = dayHint(day);

          return (
            <button
              key={day.date}
              onClick={() => onSelectDay(day.date)}
              role="option"
              aria-selected={isSelected}
              className={`flex-shrink-0 snap-start w-20 px-2 py-3 rounded-lg border text-center transition-colors
                focus:outline-none focus:ring-2 focus:ring-indigo-500
                ${isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : isFullyBooked
                    ? 'bg-gray-50 text-gray-400 border-gray-200'
                    : 'bg-white text-gray-800 border-gray-300 hover:border-indigo-400'
                }`}
            >
              <div className="text-xs font-medium">{day.label}</div>
              <div className={`text-xs mt-1 ${isSelected ? 'text-indigo-200' : isFullyBooked ? 'text-gray-300' : 'text-gray-400'}`}>
                {hint}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
