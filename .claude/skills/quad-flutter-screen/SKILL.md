---
name: quad-flutter-screen
description: Recipe for building a Quad parent app screen in Flutter (feature folder, Riverpod providers, go_router, generated quad_api client, QuadColors tokens, ARB strings, offline cache, widget and golden tests) that matches design/parent.html. Use whenever you work in apps/parent.
---

# Building a parent app screen

## 1. Study the prototype
Open `design/parent.html` (the `SCR.<screen>` function) and spec `09-parent-app.md`. Note states, copy, deep links and which data comes from which endpoint.

## 2. Folder
```
lib/features/<area>/
  screens/<thing>_screen.dart      layout + state switching only
  widgets/<part>.dart              small, const where possible
  providers/<thing>_provider.dart  @riverpod; calls quad_api; maps to view models
```
Shared widgets go to `lib/ui/` (`QuadCard`, `QuadButton`, `QuadPill`, `GreetingIcon`…). Look there first.

## 3. Rules
- **No business rules in Dart.** Totals, statuses, levels, eligibility and sentences come from the API. If a value is missing, add it to the API and regenerate `quad_api` (`pnpm api:client`); never edit `packages/quad_api` by hand.
- **Tokens only.** `final c = Theme.of(context).extension<QuadColors>()!;` — no `Color(0x…)`, no hard-coded font sizes outside the generated type scale.
- **Strings only from ARB** (`AppLocalizations.of(context)`), generated from `packages/contracts/i18n/en.json` by `pnpm i18n:build`. Plurals via ICU.
- **Every screen has four states:** loading (skeleton), empty (friendly copy + next step), error (retry), data. Use `AsyncValue.when`.
- **Offline:** screens listed in spec 02 read from the encrypted `drift` cache first, then refresh.
- **Navigation:** routes and deep links in `lib/router.dart` (`go_router`); universal links `/p/*` and `quad://` as in spec 09.
- **Accessibility:** `Semantics` labels on icon-only buttons, 44 px targets, works at text scale 2.0, honours reduce motion.
- **School branding** after sign-in comes from the API and is applied through the theme extension; never per-school code.

## 4. Tests
- Widget tests for all four states with provider overrides and a mocked `quad_api`.
- Goldens at 390×844, light and dark, text scale 1.0 and 2.0 for screens listed in spec 17 (`flutter test --update-goldens` only when the change is intended; review the diff images).
- Parent journeys in `integration_test/` and Maestro flows when the milestone names them.

## 5. Check
```bash
cd apps/parent
fvm flutter analyze        # zero issues
fvm dart format --set-exit-if-changed .
fvm flutter test
```
