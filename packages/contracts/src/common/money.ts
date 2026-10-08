import { z } from 'zod';

/** Money is integer minor units with an ISO 4217 currency code. Never floats. */
export const MoneySchema = z.object({
  amountMinor: z.number().int(),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
});
export type Money = z.infer<typeof MoneySchema>;
