import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBooking, cancelBooking } from '../api/client';
import { CopyButton } from '../components/CopyButton';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { useState } from 'react';

export function ManageBookingPage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ['booking', token],
    queryFn: () => getBooking(token!),
    enabled: !!token,
  });

  const cancel = useMutation({
    mutationFn: () => cancelBooking(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', token] });
      setShowConfirm(false);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 py-8">
          <EmptyState
            title="Booking not found"
            message="We couldn't find this booking. The link may be invalid."
            action={{ label: 'Book a new trial', onClick: () => window.location.href = '/' }}
          />
        </div>
      </div>
    );
  }

  const isCancelled = booking.status === 'cancelled';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Booking</h1>

        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700 font-medium">This booking has been cancelled.</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
          <div className="text-center mb-4">
            <p className={`text-3xl font-bold ${isCancelled ? 'text-gray-400 line-through' : 'text-indigo-600'}`}>
              {booking.localTime}
            </p>
            <p className="text-lg text-gray-700">{booking.localDate}</p>
            <p className="text-sm text-gray-500">{booking.zoneLabel}</p>
            <p className="text-sm text-gray-400 mt-1">30 minutes</p>
          </div>

          <hr className="my-4" />

          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Mentor</h3>
            <p className="font-semibold text-gray-800">{booking.mentor.name}</p>
            <p className="text-sm text-gray-500">{booking.mentor.bio}</p>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Class Link</h3>
            <div className="flex items-center gap-2">
              <code className="text-sm bg-gray-100 px-2 py-1 rounded flex-1 overflow-x-auto">
                {booking.classLink}
              </code>
              <CopyButton text={booking.classLink} />
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Student</h3>
            <p className="text-sm text-gray-700">{booking.child.name} (age {booking.child.age})</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Parent</h3>
            <p className="text-sm text-gray-700">{booking.parent.name} ({booking.parent.email})</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {!isCancelled && (
            <a
              href={`/api/bookings/${token}/ics`}
              download="trial-class.ics"
              className="block w-full text-center py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Add to calendar (.ics)
            </a>
          )}

          {!isCancelled && !showConfirm && (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full py-2 bg-white border border-red-300 rounded-lg text-sm text-red-600 hover:bg-red-50"
            >
              Cancel booking
            </button>
          )}

          {showConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700 mb-3">Are you sure you want to cancel this booking? This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => cancel.mutate()}
                  disabled={cancel.isPending}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {cancel.isPending ? 'Cancelling...' : 'Yes, cancel'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Keep booking
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-center pt-2">
            <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800 underline">
              Book another trial
            </Link>
            <Link to="/outbox" className="text-sm text-gray-500 hover:text-gray-700 underline">
              View emails (demo)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
