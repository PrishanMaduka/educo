/** Browsers in the order they must be tested: Edge and Opera also say "Chrome", Chrome "Safari". */
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\b(?:OPR|Opera)\//, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\b(?:Firefox|FxiOS)\//, 'Firefox'],
  [/\b(?:Chrome|CriOS|Chromium)\//, 'Chrome'],
  [/\bSafari\//, 'Safari'],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/\b(?:iPhone|iPad|iPod)\b/, 'iOS'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
];

const match = (text: string, table: readonly (readonly [RegExp, string])[]) =>
  table.find(([pattern]) => pattern.test(text))?.[1];

/**
 * A short device description for the new-device email ("Chrome on Windows"), never the raw user
 * agent (which can carry identifying detail). Unknown parts fall back to plain words.
 */
export function describeDevice(userAgent: string | null): string {
  const text = userAgent ?? '';
  const browser = match(text, BROWSERS);
  const system = match(text, SYSTEMS);
  if (browser !== undefined && system !== undefined) return `${browser} on ${system}`;
  if (browser !== undefined) return browser;
  if (system !== undefined) return `a browser on ${system}`;
  return 'a web browser';
}
