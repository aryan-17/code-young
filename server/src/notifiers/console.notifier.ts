import type { Notifier, NotificationPayload } from './types.js';

/**
 * ConsoleNotifier — Adapter pattern (DESIGN.md §3.3).
 * Logs notifications to console. Outbox storage handled by the service layer.
 */
export class ConsoleNotifier implements Notifier {
  send(notification: NotificationPayload): void {
    console.log(`[NOTIFICATION] To: ${notification.recipientEmail} (${notification.recipientType})`);
    console.log(`  Subject: ${notification.subject}`);
  }
}
