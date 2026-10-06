import { z } from 'zod';

/** Whether one dependency answered the readiness check. */
export const HealthState = z.enum(['ok', 'down']);
export type HealthState = z.infer<typeof HealthState>;

/** `GET /health/live`: the process is up. */
export const HealthLive = z.object({ status: z.literal('ok') });
export type HealthLive = z.infer<typeof HealthLive>;

/** `GET /health/ready`: 200 when every dependency is ok, 503 with the failing part otherwise. */
export const HealthReady = z.object({
  status: HealthState,
  db: HealthState,
  redis: HealthState,
});
export type HealthReady = z.infer<typeof HealthReady>;
