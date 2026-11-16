import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProgressBar } from '../components/ProgressBar';
import { SlotSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { TimeZoneBanner } from '../features/booking/TimeZoneBanner';
import { DayPicker } from '../features/booking/DayPicker';
import { SlotPicker } from '../features/booking/SlotPicker';
import { BookingForm } from '../features/booking/BookingForm';
import { useTimezone } from '../features/booking/useTimezone';
import { useSlots } from '../features/booking/useSlots';
import { useCreateBooking } from '../features/booking/useCreateBooking';
import type { ApiClientError } from '../api/client';
import type { SlotDay } from '@codeyoung/shared';

export function BookingPage() {
  const { timezone, changeTimezone } = useTimezone();
  const { data: slotsData, isLoading, error: slotsError, refetch } = useSlots(timezone);
  const createBooking = useCreateBooking();
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const step = !selectedDate ? 2 : !selectedSlot ? 3 : 4;

  const selectedDay: SlotDay | null = slotsData?.days.find(d => d.date === selectedDate) ?? null;

  // Find selected slot details
  const selectedSlotInfo = selectedDay?.slots.find(s => s.startUtc === selectedSlot);
  const slotLabel = selectedSlotInfo ? `${selectedDay!.label} at ${selectedSlotInfo.localTime} ${selectedSlotInfo.zoneAbbr}` : '';

  const handleSelectDay = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    createBooking.reset();
  }, [createBooking]);

  const handleSelectSlot = useCallback((startUtc: string) => {
    // Find which day this slot belongs to
    if (slotsData) {
      for (const day of slotsData.days) {
        const found = day.slots.find(s => s.startUtc === startUtc);
        if (found) {
          setSelectedDate(day.date);
          setSelectedSlot(startUtc);
          createBooking.reset();
          return;
        }
      }
    }
    setSelectedSlot(startUtc);
    createBooking.reset();
  }, [slotsData, createBooking]);

  const handleNextAvailableDay = useCallback(() => {
    if (!slotsData) return;
    const nextDay = slotsData.days.find(d =>
      d.date !== selectedDate && d.availableCount > 0,
    );
    if (nextDay) {
      setSelectedDate(nextDay.date);
      setSelectedSlot(null);
    }
  }, [slotsData, selectedDate]);

  const handleBack = useCallback(() => {
    if (selectedSlot) {
      setSelectedSlot(null);
      createBooking.reset();
    } else if (selectedDate) {
      setSelectedDate(null);
    }
  }, [selectedSlot, selectedDate, createBooking]);

  const handleSubmit = useCallback((body: Parameters<typeof createBooking.mutate>[0]) => {
    createBooking.mutate(body, {
      onSuccess: (data) => {
        navigate(`/confirmation/${data.token}`);
      },
    });
  }, [createBooking, navigate]);

  // All days fully booked?
  const allFullyBooked = slotsData && slotsData.days.every(d => d.availableCount === 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Book a Trial Class</h1>
          <p className="text-sm text-gray-500 mt-1">Free 30-minute session with a Codeyoung mentor</p>
        </div>

        <ProgressBar current={step} />

        {/* Back button */}
        {(selectedDate || selectedSlot) && (
          <button
            onClick={handleBack}
            className="text-sm text-indigo-600 hover:text-indigo-800 mb-3 focus:outline-none"
          >
            ← Back
          </button>
        )}

        {/* Time zone banner */}
        {slotsData && (
          <TimeZoneBanner
            zoneLabelNow={slotsData.zoneLabelNow}
            timezone={timezone}
            onChangeTimezone={changeTimezone}
          />
        )}

        {/* Loading */}
        {isLoading && <SlotSkeleton />}

        {/* Error */}
        {slotsError && (
          <EmptyState
            title="Something went wrong"
            message="We couldn't load available times. Please try again."
            action={{ label: 'Retry', onClick: () => refetch() }}
          />
        )}

        {/* All booked */}
        {allFullyBooked && (
          <EmptyState
            title="Trial classes are in high demand!"
            message="All our mentors are fully booked for the next 14 days. Please check back soon — new slots open regularly."
          />
        )}

        {/* Slot picker flow */}
        {slotsData && !allFullyBooked && (
          <>
            <DayPicker
              days={slotsData.days}
              selectedDate={selectedDate}
              onSelectDay={handleSelectDay}
            />

            {!selectedSlot && (
              <SlotPicker
                day={selectedDay}
                selectedSlot={selectedSlot}
                onSelectSlot={handleSelectSlot}
                onNextAvailableDay={handleNextAvailableDay}
              />
            )}

            {selectedSlot && selectedSlotInfo && (
              <BookingForm
                startUtc={selectedSlot}
                timezone={timezone}
                slotLabel={slotLabel}
                zoneLabel={slotsData.zoneLabelNow}
                onSubmit={handleSubmit}
                isPending={createBooking.isPending}
                error={createBooking.error as ApiClientError | null}
                onSelectAlternative={handleSelectSlot}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
