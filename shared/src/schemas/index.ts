import { z } from 'zod';

/** Booking request — POST /api/bookings (DESIGN.md §8) */
export const BookingRequestSchema = z.object({
  startUtc: z.string().datetime({ offset: true }),
  timezone: z.string().min(1),
  idempotencyKey: z.string().uuid(),
  parent: z.object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    phone: z.string().nullable().optional(),
  }),
  child: z.object({
    name: z.string().min(1).max(200),
    age: z.number().int().min(5).max(18),
  }),
});

export type BookingRequest = z.infer<typeof BookingRequestSchema>;

/** Slots query params */
export const SlotsQuerySchema = z.object({
  timezone: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type SlotsQuery = z.infer<typeof SlotsQuerySchema>;

/** Standard error envelope */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});
