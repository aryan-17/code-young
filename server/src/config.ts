import { z } from 'zod';

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_PATH: z.string().default('data.db'),
  LEAD_TIME_MINUTES: z.coerce.number().default(120),
  BOOKING_HORIZON_DAYS: z.coerce.number().default(14),
  SLOT_MINUTES: z.coerce.number().default(30),
  MAX_CLASSES_PER_MENTOR_PER_DAY: z.coerce.number().default(2),
  CLASS_LINK_BASE_URL: z.string().default('https://class.codeyoung-demo.com/trial'),
  NOW_OVERRIDE: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid configuration:', result.error.format());
    process.exit(1);
  }
  return result.data;
}
