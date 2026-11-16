import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMentors, fetchMentorBookings } from '../api/client';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Link } from 'react-router-dom';

export function MentorPage() {
  const [selectedMentorId, setSelectedMentorId] = useState<number | null>(null);

  const { data: mentors, isLoading: mentorsLoading } = useQuery({
    queryKey: ['mentors'],
    queryFn: fetchMentors,
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['mentor-bookings', selectedMentorId],
    queryFn: () => fetchMentorBookings(selectedMentorId!),
    enabled: selectedMentorId !== null,
  });

  const selectedMentor = mentors?.find(m => m.id === selectedMentorId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mentor View</h1>
          <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800 underline">
            Back to booking
          </Link>
        </div>

        <p className="text-xs text-gray-400 mb-4">
          Demo-only: select your name to see upcoming classes. In production this would use authentication.
        </p>

        {/* Mentor picker */}
        {mentorsLoading && <Skeleton className="h-10 w-full mb-4" />}
        {mentors && (
          <div className="mb-6">
            <label htmlFor="mentor-select" className="block text-sm font-medium text-gray-700 mb-1">
              Select your name
            </label>
            <select
              id="mentor-select"
              value={selectedMentorId ?? ''}
              onChange={e => setSelectedMentorId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Choose mentor...</option>
              {mentors.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Bookings list */}
        {bookingsLoading && (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {selectedMentor && bookings && bookings.length === 0 && (
          <EmptyState
            title="No upcoming classes"
            message={`${selectedMentor.name} has no confirmed bookings.`}
          />
        )}

        {bookings && bookings.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-gray-700">
              Upcoming classes for {selectedMentor?.name}
            </h2>
            {bookings.map(b => (
              <div key={b.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {b.mentorLocalTime} <span className="text-gray-400 text-sm">{b.mentorZoneAbbr}</span>
                    </p>
                    <p className="text-sm text-gray-600">{b.mentorLocalDate}</p>
                    <p className="text-xs text-gray-400">{b.mentorZoneLabel}</p>
                  </div>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                    {b.dayCount} today
                  </span>
                </div>
                <hr className="my-2" />
                <p className="text-sm text-gray-700">
                  <strong>{b.childName}</strong> — parent: {b.parentName}
                </p>
                <p className="text-xs text-gray-400">Parent's local time: {b.parentLocalTime}</p>
                <a
                  href={b.classLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline mt-1 inline-block"
                >
                  Class link
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
