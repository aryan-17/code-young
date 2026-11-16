import { useQuery } from '@tanstack/react-query';
import { fetchNotifications } from '../api/client';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Link } from 'react-router-dom';

export function OutboxPage() {
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Notification Outbox</h1>
          <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800 underline">
            Back to booking
          </Link>
        </div>

        <p className="text-xs text-gray-400 mb-4">
          Simulated email notifications. In production these would be sent via an email provider.
        </p>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {notifications && notifications.length === 0 && (
          <EmptyState
            title="No notifications yet"
            message="Book a trial class to see confirmation emails here."
          />
        )}

        {notifications && notifications.length > 0 && (
          <div className="space-y-3">
            {notifications.map(n => (
              <div key={n.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${n.recipient_type === 'parent'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {n.recipient_type}
                    </span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium
                      ${n.kind === 'booking_confirmed'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {n.kind.replace('booking_', '')}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{n.timezone}</span>
                </div>
                <p className="text-sm text-gray-500 mb-1">To: {n.recipient_email}</p>
                <p className="text-sm font-medium text-gray-800 mb-2">{n.subject}</p>
                <pre className="text-xs text-gray-500 bg-gray-50 rounded p-2 whitespace-pre-wrap overflow-x-auto">
                  {n.body}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
