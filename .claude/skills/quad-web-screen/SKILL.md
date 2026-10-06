---
name: quad-web-screen
description: Recipe for building a staff portal or platform console screen in Next.js 15 + Tailwind v4 + packages/ui that matches the design/ prototypes (story-first page, drawers, filters, tables, empty states, 390px, dark mode, accessibility, Playwright screenshots). Use whenever you build or change a page in apps/staff or apps/console.
---

# Building a web screen

## 1. Study the prototype
Open the matching view in `design/admin.html` or `design/platform.html` (the `V.<route>` function) and note: the summary sentence, the "needs you" items, sections, filters, table columns, drawers, empty states, toasts and copy. Then read the screen's section in spec 07 or 08. **Spec wins over prototype.**

## 2. Page structure (story first)
1. Page head: title and the one-sentence story ("12 invoices are overdue, 3 of them over 30 days"), computed by the API.
2. What needs doing: action cards or a short list, each with a button that says what happens.
3. Detail: filters, then the table/cards, then secondary sections.

## 3. Build it
- The route `page.tsx` is a server component that fetches through the typed client and passes data down. Interactive parts are small client components.
- Use `packages/ui` only: Card, KPI, Table, Dropdown filter, Segmented, Pill, Empty state, Drawer (+ Stepper), Toast. Missing a piece → add it to `packages/ui` with a style-guide entry (see `quad-reuse`).
- Forms open in a right-side Drawer; React Hook Form + the contract schema; server errors map to fields from `{ code, fields }`.
- Mutations: TanStack Query mutations from `packages/client`; invalidate the affected queries; toast confirms what happened.
- Respect permissions: hide or disable actions using `GET /me/permissions` (and the role preview) — the API still enforces them.
- Plan modules: hide nav items for modules not in the plan.
- All copy from `en.json`; numbers, dates, money via the shared formatters; year-group labels from data.

## 4. Styling rules
- Tailwind utilities from the token `@theme` only (`bg-surface`, `text-ink-2`, `border-line`, `bg-brand`, `rounded-card`, `shadow-card`). No raw hex, no arbitrary colour values, no inline styles except CSS variables.
- Mobile first: works at 390 px (tables collapse to cards or scroll inside their card; drawers go full width).
- Dark mode works through the variables; avoid `dark:` overrides unless needed.
- Motion 150–280 ms, transform/opacity only, off with `prefers-reduced-motion`.

## 5. Accessibility
Labels on every control, visible focus ring, keyboard paths (drawers trap focus and return it), `aria-live` for toasts and counters, contrast AA in both themes, 44 px targets on mobile.

## 6. Prove it
- Playwright journey for the milestone (spec 17 numbering) + axe check.
- Screenshots at 1440×900 and 390×844, light and dark. Put them side by side with the prototype at the same size and fix visible differences (spacing, weights, copy, colours).
- Loading (skeletons), empty and error states all rendered once in the screenshots or the style guide.
