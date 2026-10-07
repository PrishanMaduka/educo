import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

export interface WebAppE2eOptions {
  /** The port the app's production server listens on (staff 3000, console 3001). */
  port: number;
}

const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };

/**
 * Shared Playwright settings for the web apps: Chromium at 1440×900 and 390×844, each in light and dark
 * (through the system colour scheme), against a production build started by `webServer`.
 */
export function defineWebAppConfig({ port }: WebAppE2eOptions): PlaywrightTestConfig {
  const baseURL = `http://localhost:${port}`;
  const isCi = Boolean(process.env.CI);
  return defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: isCi,
    retries: isCi ? 1 : 0,
    reporter: isCi ? [['list'], ['html', { open: 'never' }]] : 'list',
    timeout: 30_000,
    use: { ...devices['Desktop Chrome'], baseURL, trace: 'retain-on-failure' },
    projects: [
      { name: 'desktop-light', use: { viewport: desktop, colorScheme: 'light' } },
      { name: 'desktop-dark', use: { viewport: desktop, colorScheme: 'dark' } },
      { name: 'phone-light', use: { viewport: phone, colorScheme: 'light', hasTouch: true } },
      { name: 'phone-dark', use: { viewport: phone, colorScheme: 'dark', hasTouch: true } },
    ],
    webServer: {
      command: `pnpm exec next build && pnpm exec next start --port ${port}`,
      // A port check, not a URL: Playwright treats a 404 at the URL as "not ready".
      port,
      reuseExistingServer: !isCi,
      timeout: 240_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  });
}
