import { useState } from 'react';
import { TimeZonePicker } from './TimeZonePicker';

interface Props {
  zoneLabelNow: string;
  timezone: string;
  onChangeTimezone: (tz: string) => void;
}

export function TimeZoneBanner({ zoneLabelNow, timezone, onChangeTimezone }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4">
      <p className="text-sm text-gray-700">
        Times are shown in <strong className="text-indigo-700">{zoneLabelNow}</strong>.{' '}
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="text-indigo-600 underline hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
        >
          Change
        </button>
      </p>
      {showPicker && (
        <TimeZonePicker
          current={timezone}
          onSelect={(tz) => {
            onChangeTimezone(tz);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
