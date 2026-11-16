/**
 * Adapter pattern — notification delivery (DESIGN.md §3.3).
 * Interface Segregation: single send() method.
 * Liskov Substitution: ConsoleNotifier, OutboxNotifier, future EmailNotifier all interchangeable.
 */
export interface NotificationPayload {
  bookingId: number;
  recipientType: 'parent' | 'mentor';
  recipientEmail: string;
  timezone: string;
  kind: 'booking_confirmed' | 'booking_cancelled';
  subject: string;
  body: string;
}

export interface Notifier {
  send(notification: NotificationPayload): void;
}
