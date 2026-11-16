import type { SlotsResponse, BookingResponse, ApiError } from '@codeyoung/shared';

const BASE = '/api';

class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const body = await res.json();

  if (!res.ok) {
    const err = body as ApiError;
    throw new ApiClientError(
      res.status,
      err.error?.code ?? 'UNKNOWN',
      err.error?.message ?? 'An error occurred',
      err.error?.details as Record<string, unknown> | undefined,
    );
  }

  return body as T;
}

export async function fetchSlots(timezone: string, from?: string, to?: string): Promise<SlotsResponse> {
  const params = new URLSearchParams({ timezone });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return request<SlotsResponse>(`/slots?${params}`);
}

export async function createBooking(body: {
  startUtc: string;
  timezone: string;
  idempotencyKey: string;
  parent: { name: string; email: string; phone: string | null };
  child: { name: string; age: number };
}): Promise<BookingResponse> {
  return request<BookingResponse>('/bookings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getBooking(token: string): Promise<BookingResponse> {
  return request<BookingResponse>(`/bookings/${token}`);
}

export async function cancelBooking(token: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/bookings/${token}/cancel`, { method: 'POST' });
}

export async function fetchMentors(): Promise<Array<{ id: number; name: string }>> {
  return request('/mentors');
}

export async function fetchMentorBookings(mentorId: number): Promise<Array<{
  id: number; startUtc: string; mentorLocalTime: string; mentorLocalDate: string;
  mentorZoneLabel: string; mentorZoneAbbr: string; parentName: string; childName: string;
  parentLocalTime: string; classLink: string; dayCount: string;
}>> {
  return request(`/mentors/${mentorId}/bookings`);
}

export interface NotificationItem {
  id: number;
  booking_id: number;
  recipient_type: 'parent' | 'mentor';
  recipient_email: string;
  timezone: string;
  kind: 'booking_confirmed' | 'booking_cancelled';
  subject: string;
  body: string;
  created_at: string;
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  return request('/notifications');
}

export { ApiClientError };
