---
description: Run the Quad quality gate and fix what fails
---

Run `pnpm verify` (typecheck, lint, unit tests, generated-code check, API integration tests, Playwright smoke journeys, the landing-page Lighthouse budget, dependency audit). It does not run the Maestro flows (`pnpm e2e:mobile`), which run nightly in CI.

If anything fails, find the root cause and fix it. Do not skip, disable or loosen tests, and do not lower lint rules. Re-run until it passes, then summarise what failed and what you changed.
