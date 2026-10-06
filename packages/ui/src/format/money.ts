export interface Money {
  /** Integer minor units (cents). Never a float. */
  amountMinor: number;
  /** ISO 4217 code. */
  currency: string;
}

/** Sri Lankan rupees are written "Rs" in school copy, not "LKR". */
const SYMBOLS: Record<string, string> = { LKR: 'Rs' };

export function formatMoney({ amountMinor, currency }: Money, locale: string): string {
  if (!Number.isInteger(amountMinor)) {
    throw new RangeError(
      `amountMinor must be an integer number of minor units, got ${amountMinor}`,
    );
  }
  const reference = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const digits = reference.resolvedOptions().maximumFractionDigits ?? 2;
  const value = amountMinor / 10 ** digits;
  const symbol = SYMBOLS[currency];
  if (!symbol) return reference.format(value);

  const whole = amountMinor % 10 ** digits === 0;
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: whole ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(value));
  return `${amountMinor < 0 ? '-' : ''}${symbol} ${number}`;
}
