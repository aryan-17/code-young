import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getBooking } from '../api/client';
import { CopyButton } from '../components/CopyButton';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';

export function ConfirmationPage() {
  const { token } = useParams<{ token: string }>();
  const { data: booking, isLoading, error } = useQuery({
    queryKey: ['booking', token],
    queryFn: () => getBooking(token!),
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-20 w-full" />
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Success header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900">You're booked!</h1>
          <p className="text-sm text-gray-500 mt-1">Your trial class is confirmed</p>
        </div>

        {/* Main booking card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
          <div className="text-center mb-4">
            <p className="text-3xl font-bold text-indigo-600">{booking.localTime}</p>
            <p className="text-lg text-gray-700">{booking.localDate}</p>
            <p className="text-sm text-gray-500">{booking.zoneLabel}</p>
            <p className="text-sm text-gray-400 mt-1">30 minutes</p>
          </div>

          <hr className="my-4" />

          {/* Mentor */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Your Mentor</h3>
            <p className="font-semibold text-gray-800">{booking.mentor.name}</p>
            <p className="text-sm text-gray-500">{booking.mentor.bio}</p>
          </div>

          {/* Class link */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Class Link</h3>
            <div className="flex items-center gap-2">
              <code className="text-sm bg-gray-100 px-2 py-1 rounded flex-1 overflow-x-auto">
                {booking.classLink}
              </code>
              <CopyButton text={booking.classLink} />
            </div>
          </div>

          {/* Booking reference */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Booking Reference</h3>
            <code className="text-sm text-gray-600">{booking.token.slice(0, 12)}...</code>
          </div>
        </div>

        {/* Student info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
          <p className="text-sm text-gray-600">
            <strong>{booking.child.name}</strong> (age {booking.child.age})
            <br />
            Parent: {booking.parent.name} ({booking.parent.email})
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400 text-center">
            A confirmation email has been sent to {booking.parent.email} (simulated).
          </p>

          <div className="flex gap-3 justify-center">
            <Link
              to={`/booking/${booking.token}`}
              className="text-sm text-indigo-600 hover:text-indigo-800 underline"
            >
              Manage booking
            </Link>
            <Link
              to="/outbox"
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              View emails sent (demo)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
