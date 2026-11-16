import type { Slot, SlotDay } from '@codeyoung/shared';
import { SlotButton } from '../../components/SlotButton';
import { EmptyState } from '../../components/EmptyState';

interface Props {
  day: SlotDay | null;
  selectedSlot: string | null;
  onSelectSlot: (startUtc: string) => void;
  onNextAvailableDay: () => void;
  alternatives?: string[];
}

function groupSlots(slots: Slot[]): { morning: Slot[]; afternoon: Slot[]; evening: Slot[] } {
  const morning: Slot[] = [];
  const afternoon: Slot[] = [];
  const evening: Slot[] = [];

  for (const slot of slots) {
    // Parse hour from localTime like "4:00 PM" or "10:30 AM"
    const match = slot.localTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) { afternoon.push(slot); continue; }
    let hour = parseInt(match[1]!);
    const ampm = match[3]!.toUpperCase();
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    if (hour < 12) morning.push(slot);
    else if (hour < 17) afternoon.push(slot);
    else evening.push(slot);
  }

  return { morning, afternoon, evening };
}

function SlotGroup({ label, slots, selectedSlot, onSelectSlot }: {
  label: string;
  slots: Slot[];
  selectedSlot: string | null;
  onSelectSlot: (startUtc: string) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <div className="mb-4">
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</h4>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {slots.map(slot => (
          <SlotButton
            key={slot.startUtc}
            time={slot.localTime}
            zoneAbbr={slot.zoneAbbr}
            available={slot.available}
            selected={slot.startUtc === selectedSlot}
            onClick={() => onSelectSlot(slot.startUtc)}
          />
        ))}
      </div>
    </div>
  );
}

export function SlotPicker({ day, selectedSlot, onSelectSlot, onNextAvailableDay, alternatives }: Props) {
  if (!day) {
    return (
      <p className="text-gray-400 text-sm text-center py-6">Select a day to see available times.</p>
    );
  }

  if (day.availableCount === 0) {
    return (
      <EmptyState
        title={`All mentors are booked on ${day.label}`}
        message="Here are some alternative times that are still available."
        action={{ label: 'See next available day', onClick: onNextAvailableDay }}
      >
        {alternatives && alternatives.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {alternatives.map(utc => (
              <button
                key={utc}
                onClick={() => onSelectSlot(utc)}
                className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200"
              >
                {utc}
              </button>
            ))}
          </div>
        )}
      </EmptyState>
    );
  }

  const { morning, afternoon, evening } = groupSlots(day.slots);

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Pick a time on {day.label}
      </h3>
      <SlotGroup label="Morning" slots={morning} selectedSlot={selectedSlot} onSelectSlot={onSelectSlot} />
      <SlotGroup label="Afternoon" slots={afternoon} selectedSlot={selectedSlot} onSelectSlot={onSelectSlot} />
      <SlotGroup label="Evening" slots={evening} selectedSlot={selectedSlot} onSelectSlot={onSelectSlot} />
    </div>
  );
}
