import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { ApiClientError } from '../../api/client';

interface Props {
  startUtc: string;
  timezone: string;
  slotLabel: string;
  zoneLabel: string;
  onSubmit: (body: {
    startUtc: string;
    timezone: string;
    idempotencyKey: string;
    parent: { name: string; email: string; phone: string | null };
    child: { name: string; age: number };
  }) => void;
  isPending: boolean;
  error: ApiClientError | null;
  onSelectAlternative?: (startUtc: string) => void;
}

interface FormData {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childName: string;
  childAge: string;
}

export function BookingForm({
  startUtc, timezone, slotLabel, zoneLabel,
  onSubmit, isPending, error, onSelectAlternative,
}: Props) {
  const [form, setForm] = useState<FormData>({
    parentName: '', parentEmail: '', parentPhone: '',
    childName: '', childAge: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [idempotencyKey] = useState(() => uuid());

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!form.parentName.trim()) newErrors.parentName = 'Name is required';
    if (!form.parentEmail.trim()) newErrors.parentEmail = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.parentEmail)) newErrors.parentEmail = 'Invalid email';
    if (!form.childName.trim()) newErrors.childName = "Child's name is required";

    const age = parseInt(form.childAge);
    if (!form.childAge) newErrors.childAge = 'Age is required';
    else if (isNaN(age) || age < 5 || age > 18) newErrors.childAge = 'Age must be 5–18';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      startUtc,
      timezone,
      idempotencyKey,
      parent: {
        name: form.parentName.trim(),
        email: form.parentEmail.trim().toLowerCase(),
        phone: form.parentPhone.trim() || null,
      },
      child: {
        name: form.childName.trim(),
        age: parseInt(form.childAge),
      },
    });
  }

  function updateField(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }));
  }

  return (
    <div>
      {/* Slot summary */}
      <div className="bg-indigo-50 rounded-lg p-3 mb-4">
        <p className="text-sm text-gray-700">
          Booking for <strong>{slotLabel}</strong>
          <br />
          <span className="text-gray-500">{zoneLabel}</span>
        </p>
      </div>

      {/* Error from server */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4" role="alert" aria-live="assertive">
          {error.code === 'SLOT_UNAVAILABLE' && (
            <>
              <p className="text-sm text-red-700 font-medium">Sorry — someone just booked that time.</p>
              <p className="text-sm text-red-600 mt-1">Choose an alternative below:</p>
              {error.details?.alternatives && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {(error.details.alternatives as string[]).map(utc => (
                    <button
                      key={utc}
                      onClick={() => onSelectAlternative?.(utc)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-full hover:bg-red-200"
                    >
                      {utc}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {error.code === 'ALREADY_BOOKED' && (
            <>
              <p className="text-sm text-red-700 font-medium">
                You already have a trial booked for {form.childName}.
              </p>
              {error.details?.existingToken && (
                <a
                  href={`/booking/${error.details.existingToken}`}
                  className="text-sm text-indigo-600 underline mt-1 inline-block"
                >
                  View your existing booking
                </a>
              )}
            </>
          )}
          {error.code !== 'SLOT_UNAVAILABLE' && error.code !== 'ALREADY_BOOKED' && (
            <p className="text-sm text-red-700">{error.message}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <h3 className="text-sm font-medium text-gray-700">Your details</h3>

        <div>
          <label htmlFor="parentName" className="block text-sm text-gray-600 mb-1">Your name</label>
          <input
            id="parentName"
            type="text"
            value={form.parentName}
            onChange={e => updateField('parentName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
              ${errors.parentName ? 'border-red-400' : 'border-gray-300'}`}
            required
          />
          {errors.parentName && <p className="text-xs text-red-500 mt-1">{errors.parentName}</p>}
        </div>

        <div>
          <label htmlFor="parentEmail" className="block text-sm text-gray-600 mb-1">Email</label>
          <input
            id="parentEmail"
            type="email"
            value={form.parentEmail}
            onChange={e => updateField('parentEmail', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
              ${errors.parentEmail ? 'border-red-400' : 'border-gray-300'}`}
            required
          />
          {errors.parentEmail && <p className="text-xs text-red-500 mt-1">{errors.parentEmail}</p>}
        </div>

        <div>
          <label htmlFor="childName" className="block text-sm text-gray-600 mb-1">Child's name</label>
          <input
            id="childName"
            type="text"
            value={form.childName}
            onChange={e => updateField('childName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
              ${errors.childName ? 'border-red-400' : 'border-gray-300'}`}
            required
          />
          {errors.childName && <p className="text-xs text-red-500 mt-1">{errors.childName}</p>}
        </div>

        <div>
          <label htmlFor="childAge" className="block text-sm text-gray-600 mb-1">Child's age</label>
          <input
            id="childAge"
            type="number"
            min={5}
            max={18}
            value={form.childAge}
            onChange={e => updateField('childAge', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
              ${errors.childAge ? 'border-red-400' : 'border-gray-300'}`}
            required
          />
          {errors.childAge && <p className="text-xs text-red-500 mt-1">{errors.childAge}</p>}
        </div>

        <div>
          <label htmlFor="parentPhone" className="block text-sm text-gray-600 mb-1">Phone <span className="text-gray-400">(optional)</span></label>
          <input
            id="parentPhone"
            type="tel"
            value={form.parentPhone}
            onChange={e => updateField('parentPhone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700
            focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Booking...' : 'Book Trial Class'}
        </button>
      </form>
    </div>
  );
}
