---
description: Build one milestone from the Quad delivery plan (for example /build-milestone M3)
argument-hint: M<number>[b] (for example M3, M0b, M9b)
---

Build milestone $ARGUMENTS of Quad.

1. Read `docs/spec/18-delivery-plan.md` and find the section for $ARGUMENTS (ids with a letter, such as `M0b`, `M1b` and `M9b`, are milestones of their own). Read every spec file it lists under **Read**, and skim `CLAUDE.md` again.
2. Open the matching prototype screens in `design/` (admin.html, parent.html, platform.html) to see the exact layout, copy and behaviour.
3. Check what already exists in the repo, so you build on it rather than duplicate it.
4. Write a short plan: the files to add or change, the migrations, the endpoints, the screens, and the tests. Use the `quad-architecture` and `quad-reuse` skills to place each piece and to reuse what exists. Show the plan to me and wait for my approval before writing code.
5. Implement the scope in small, reviewable steps. Follow `quad-tdd` and the recipe skill for each piece:
   - `quad-tenant-table` for tables;
   - `quad-domain-logic` for rules;
   - `quad-api-endpoint` for routes;
   - `quad-web-screen` for web pages;
   - `quad-flutter-screen` for the parent app.
   
   Follow `quad-coding-standards` throughout. Business logic goes in `packages/domain` with unit tests first. Every endpoint gets integration tests (happy path, validation, permission denied, cross-tenant). Add the Playwright or Maestro journeys the milestone names (numbered in `docs/spec/17-testing-quality.md`).
6. Run `pnpm verify`. Fix every failure with `quad-debugging`; do not skip or disable tests. Then go through `quad-review` on the whole diff and fix what it finds.
7. Take screenshots of the new screens and compare them with the prototype: web at 1440×900 and 390×844 in light and dark (Playwright); the Flutter app with golden tests and a simulator screenshot at 390×844 in light and dark. Fix visible differences.
8. Update the Progress checklist in `docs/spec/18-delivery-plan.md`, and add any new decisions to the decision log in `docs/spec/02-architecture.md`.
9. Report back: what was built, the test results, any differences from the spec and why, and what is left for later.
