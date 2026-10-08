# 03 Design system

The prototypes in `design/` are the visual reference. This document turns them into tokens and components that both the web apps and the mobile app share.

## Principles

1. **Story first.** Pages open with a plain-language summary sentence and the one thing that needs attention, then detail.
2. **Calm surfaces, one bold accent.** Off-white pages, white cards, an indigo side bar, coral for actions and lilac for highlights.
3. **Plain words.** Name things the way staff and parents do. Buttons say exactly what happens ("Send 6 to parents", "Save plan"). No jargon such as "tenant" in school-facing apps.
4. **State is visible.** Status uses pills, coloured stripes and icons as well as numbers.
5. **Works on a phone.** Every staff and console page works at 390 px wide with no sideways scrolling.

## Tokens (`packages/tokens`)

Tokens are defined once in TypeScript. `pnpm tokens:build` generates (1) a Tailwind v4 CSS file with an `@theme` block and the light/dark CSS variables for web, and (2) `apps/parent/lib/theme/tokens.g.dart` (a `QuadTokens` class plus `ThemeExtension`s for light and dark) for the Flutter app. Names match the prototypes.

### Colour, light theme

| Token | Value | Use |
|---|---|---|
| `canvas` | `#FAF8F5` | Page background |
| `surface` | `#FFFFFF` | Cards, drawers |
| `surface-2` | `#F6F3EF` | Table headers, subtle fills |
| `line` | `#ECE8E3` | Borders |
| `line-strong` | `#DCD6CF` | Inputs, dashed dividers |
| `ink` | `#1C1B2E` | Text |
| `ink-2` | `#4E4C63` | Secondary text |
| `ink-3` | `#7D7A90` | Labels, captions |
| `brand` | `#DD4A42` (default school colour; replaced by the school's brand colour) | Primary buttons, active nav |
| `brand-strong` | `#C23B34` | Hover |
| `brand-soft` | `#FDE7E5` | Tinted backgrounds |
| `brand-ink` | `#FFFFFF` | Text on brand |
| `rail` | `#1F2559` (staff), `#15173A` (console) | Side bar |
| `rail-2` | `#2C3370` / `#23265A` | Side bar hover |
| `rail-ink` / `rail-ink-2` | `#E6E7F5` / `#A3A6CC` | Side bar text |
| `rail-active` | brand (staff) / `#6D5AE6` (console) | Active nav item |
| `good` / `good-soft` | `#1F8A5B` / `#E3F4EC` | Success |
| `warn` / `warn-soft` | `#B26A00` / `#FFF1DC` | Warning |
| `bad` / `bad-soft` | `#D13A3A` / `#FDE6E6` | Error, risk |
| `info` / `info-soft` | `#6D5AE6` / `#EEEAFE` | Information |
| `c1`…`c5` | `#E5534B` coral, `#3B4AA8` indigo, `#8B7CF6` lilac, `#F2A93B` amber, `#2BB0A0` teal | Charts, subject colours |
| `gold` / `gold-soft` | `#8B7CF6` / `#EEEAFE` | Highlight (the name is historical; it is lilac) |

### Colour, dark theme

`canvas #13142A`, `surface #1B1D3A`, `surface-2 #22254A`, `line #2E3260`, `line-strong #3D4277`, `ink #F1F1FA`, `ink-2 #C4C5DD`, `ink-3 #9395B5`, `brand #FF7A6E`, `brand-strong #FF978C`, `brand-soft #3D1F2A`, `brand-ink #1B1D3A`, `rail #0E0F22` (console `#0C0D20`), `good #4CC992/#123326`, `warn #F0B357/#3A2A10`, `bad #FF7A7A/#3D1A1E`, `info #A99BFF/#262046`, `c1 #FF7A6E`, `c2 #7B8BF0`, `c3 #A99BFF`, `c4 #F5B95A`, `c5 #3CC7B5`, `gold #A99BFF`, `gold-soft #262046`.

Theme rules:
- Follow the system setting by default; the user can override (stored per user, and per device on mobile).
- On web, set `data-theme="light|dark"` on `<html>` for overrides; system mode uses `prefers-color-scheme`.

### School brand colour

- A school sets one brand colour in the console (swatches or any hex). It replaces `brand`, `rail-active` and the brand tints in that school's staff portal and parent app.
- Derive: `brand-strong = mix(brand 80%, black)`, `brand-soft = mix(brand 13%, surface)`, `rail = mix(brand 6%, #1F2559)`, `rail-2 = mix(brand 10%, #2C3370)`.
- Accessibility: if white text on the brand colour is below 4.5:1, darken the brand for buttons until it passes, and keep the original for decoration.
- Legacy colours `#2F6FED` and `#A0412D` saved by older prototypes map to `#DD4A42`.

### Type

- Font: **Figtree** (400, 500, 600, 700, 800). Fallback stack: `system-ui, -apple-system, "Segoe UI", sans-serif`. Self-host the font files with `next/font` on web, and bundle them as assets in the Flutter app.
- Headings use weight 800 and letter-spacing −0.02em. Page title 30 px (staff, console) and 29 px (parent Home); card title 18 px; body 14.5 px (web) and 15 px (mobile); captions 12–12.5 px; labels in uppercase are 11 px, weight 800, letter-spacing 0.08–0.12em.
- Numbers in tables use `font-variant-numeric: tabular-nums`.
- Highlight a key word in greetings with a lilac marker: `box-shadow: inset 0 -0.3em 0 var(--gold-soft)`.

### Shape, space and elevation

- Radius: cards 16 px; the greeting section 24–28 px; inputs 12 px; buttons and chips 999 px (pills).
- Spacing scale: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32.
- Shadow: `0 1px 2px rgba(28,27,46,.05), 0 8px 24px -12px rgba(28,27,46,.18)`; large: `0 24px 60px -18px rgba(28,27,46,.35)`.
- Card headers use a dashed divider (`1px dashed var(--line-strong)`).

## Logo (`packages/tokens/logo`)

- The mark is four petals on a 30-unit grid: each is a 13.5-unit square with a 10-unit round outer corner and 3.5-unit inner corners, mirrored into the four quarters with a 3-unit gap. Top left sky `#59C3FF`, top right pink `#FF6FAE`, bottom left lime `#C8F169`, bottom right orange `#FF9B45`.
- The wordmark is lowercase "quad" in navy `#101632` (cream `#F7F5F0` on dark backgrounds, `quad-logo-white.svg`); the petals keep their colours on dark. `quad-mark-white.svg` is the all-white mark for single-colour use.
- `QuadMark` and `QuadLogo` take a variant: `color`, `white`, `mono` (all white) and `theme` (the public site's colour tokens, with the wordmark in the current text colour).
- Source files: `design/brand/quad-logo.svg`, `quad-logo-white.svg`, `quad-mark.svg`, `quad-mark-white.svg`, `quad-app-icon.svg`. Export them as React components for web, and use the SVG files with `flutter_svg` in the parent app. Usage rules are in `design/brand.html`.
- A school's own logo (uploaded in the console) is shown in its staff portal side bar and in the parent app after sign-in. Quad's mark appears as "powered by Quad", in the console, on the public landing page and sign-in, and on the parent app's splash and sign-in screens before a school is known (the parent app is one Quad app for every school; see [09](09-parent-app.md#start-up)).
- The parent app icon is `quad-app-icon.svg` (the petals on navy) for every school; dev and staging builds add a small "DEV" or "STG" badge.

## Page patterns

### Staff and console shell
- Side bar: 248 px (collapsible to 72 px), grouped nav with uppercase group labels, count badges, the school logo and name at the top, and the signed-in user and sign-out at the bottom. On phones it becomes a slide-over menu.
- Top bar: sticky, translucent; collapse button, search (Ctrl K), Ask Quad button with a `/` hint, academic year picker (staff), theme toggle, notifications, and the profile menu.
- Content: max width 1480 px, 24 px padding, 20 px gaps.

### The greeting section (time of day)
- **Greeting and scene follow the time of day**, in the school's time zone on the web and the phone's time in the parent app:

| Period | Hours | Words | Scene |
|---|---|---|---|
| Morning | 05:00–11:59 | Good morning | Coral sun rising behind lilac and indigo hills, birds; sky `surface` → lilac → coral |
| Afternoon | 12:00–16:59 | Good afternoon | High amber sun with a dotted halo and a few clouds; teal and indigo hills |
| Evening | 17:00–19:59 | Good evening | Amber-to-coral sun setting behind the far hill, short rays, birds; sky lilac → coral → amber |
| Night | 20:00–04:59 | Good evening (until midnight), then Hello | Crescent moon, twinkling stars, deep indigo sky on the right, dark hills |

- **Assets** (source of truth `design/brand/greeting/`): `scenes.js` (one generator for every scene, palette-driven), the exported `{morning,afternoon,evening,night}-{light,dark}.svg` (1200 × 320), PNG renders in `png/` at @1x and @2x, and 24 px icons `icon-{period}.svg`. Re-export with `node design/brand/greeting/export.js`. The brand page (`design/brand.html#greeting`) shows them all and opens the staff portal at any period.
- **Web** (`packages/ui`): `<GreetingScene period>` is a port of `scenes.js` that colours the SVG with the theme tokens (CSS variables), so it follows light and dark mode and the school's brand colour without separate files. `greetingPeriod(date, timeZone)` lives in `packages/domain/greeting` with unit tests for every boundary (04:59, 05:00, 11:59, 12:00, 16:59, 17:00, 19:59, 20:00, 23:59, 00:00).
- **Flutter**: the parent header uses the icons (`assets/greeting/icon-*.svg` via `flutter_svg`, tinted amber for morning and afternoon, coral for evening, lilac for night). The API's `GET /family/home` returns the period computed for the device's time zone header, and the app falls back to the device clock offline.
- The scene is one SVG with `preserveAspectRatio="xMaxYMax slice"`, positioned `absolute; inset: 0`, behind the whole section. Text always sits on the calm left side of the sky (max width about 64%), with the hills below the buttons (bottom padding of about 70 px).
- On narrow screens the scene shrinks to a band about 130 px tall along the bottom, and the text uses the full width.
- Motion: the sun or moon rises once on load (1.4 s) and the stars twinkle slowly; nothing moves with reduced motion.
- Content: a small date line, then "Good morning, {first name}" with the highlighted name, a one- or two-sentence summary computed from live data, a context line (week of term, next holiday) and up to three actions.

### Page head
Small uppercase crumb, page title, optional one-line description, and actions on the right (they wrap under on phones).

### Drawers ("form drawers")
- All create and edit forms open in a right-side drawer (520 px; 760 px for wide drawers), never in a centred modal. On phones it is a full-screen sheet.
- Header: a coloured icon tile, a section eyebrow, the title and subtitle, and a close button. Multi-step forms show a numbered stepper in the header.
- Body: fields grouped in a white card. Footer: Cancel and the primary action, right-aligned.
- Escape closes the drawer; focus goes to the first field and returns to the opener on close. Unsaved changes prompt "Discard changes?" inline.
- Danger drawers (suspend, delete) use the `bad` accent and require the school's name to be typed.

### Filters
- Toolbar filters are custom dropdowns, not native selects. A dropdown shows an icon, the label and the value. An active filter shows its value and a × to clear it, and the menu shows a count next to each option. It can have search (for long lists) and option groups (year groups grouped by stage). "Clear filters" appears with an "N of M" count when any filter is active.
- Chip groups are used for 2–6 mutually exclusive views (statuses, levels), each with a count.

### Tables
Uppercase 11 px headers on `surface-2`. Rows are clickable when they open a record, with a hover tint. Columns hide progressively on phones, or the table switches to cards.

### Empty states
A small illustration or icon, one warm sentence, and the next action.

### Toasts and celebrations
- Toasts are dark pills at the bottom centre that say what happened ("Plan saved for Hasini"). At most two are shown at a time, for 2.8 s each.
- A petal burst (coral, indigo, lilac and teal petals) marks good moments: a payment completed, cover complete, a plan created, a school going live, birthday wishes sent, or a thank-you sent. There is no burst with reduced motion.

### Charts
- Bars and lines use `c1`–`c5`. The grid is faint, the latest point is emphasised, the target line is dashed, and tooltips show exact values. Every tick label is a value the chart actually reaches.
- Sparklines in early-warning cards: 64×24, with the end point marked; `bad` for falling and `good` for rising.

### Public landing page
Reference: `design/landing.html`. The public site has its own palette, font and components, described in [19](19-public-site.md#design-tokens-to-add): `site-*` colour tokens (navy, cream, lime, pink, sky blue and orange, light and dark), Bricolage Grotesque, flat avatars, and a school/parent view switch. They are used only on public pages, never in the apps.

- **Heatmap** (the staff Family connection heatmap): `heat-0` (coral at 30% on `surface`), `heat-1` (teal at 30%), `heat-2` (teal at 60%) and `heat-3` (teal), computed the same way on the dark surface. They are added to `packages/tokens` with that screen.

### Floating Ask Quad button
- Staff and console: a coral pill at the bottom right with a sparkle icon and "Ask Quad". It moves up 92 px when a sticky save bar is shown, and is hidden while the panel is open.
- Parent app: a round coral icon button on Home only, placed so it never covers content.

## Components (`packages/ui`)

Button (primary, secondary, ghost, danger; sizes sm and md; icon), IconButton, Input, Textarea, Select (native fallback), Dropdown (filter variant with search and groups), Segmented control, Switch, Checkbox, Chip, Pill (status), Card (with header), KPI tile, Table (sortable, selectable), Drawer (with Stepper), Toast, Tooltip, Tabs, Avatar (initials with a deterministic colour from a fixed palette that passes AA), Empty state, Morning scene, Sparkline, Bar chart, Line chart, Donut, Heatmap (attendance), Timeline, Command palette, Ask Quad panel, Petal burst.

The Flutter equivalents live in `apps/parent/lib/ui` (for example `QuadButton`, `QuadCard`, `QuadPill`, `GreetingIcon` (time-of-day icon), `PetalBurst`, `Sparkline`) and read colours only from the generated tokens through `Theme.of(context).extension<QuadColors>()`.

## Tailwind CSS (web)
- All web styling uses Tailwind CSS v4 utility classes. The generated `@theme` maps tokens to utilities (`bg-canvas`, `bg-surface`, `text-ink-2`, `border-line`, `bg-brand`, `text-brand-ink`, `rounded-card`, `shadow-card`, `font-sans`).
- Dark mode uses a custom variant tied to `data-theme` and `prefers-color-scheme`. Because the colours are CSS variables, components rarely need `dark:` classes.
- The school brand colour is set at runtime by writing `--brand` and its derived variables on `<html>`. Tailwind utilities read the variables, so a published brand change re-themes the page live.
- Component variants use `class-variance-authority`, and class strings are merged with `tailwind-merge` (`cn()` helper in `packages/ui`).
- Not allowed: raw hex values in class names (`bg-[#DD4A42]`), inline styles except CSS variables, CSS modules and CSS-in-JS. A lint rule (`eslint-plugin-tailwindcss` or a custom rule) flags arbitrary colour values.

## Icons

A single stroke icon set (Lucide), stroke width 1.9, round caps and joins. Icons are decorative and `aria-hidden` unless they are the only content of a button, which then needs an `aria-label`.

## Motion

Durations of 150–280 ms with `cubic-bezier(.2,.8,.2,1)`. Animate transform and opacity only. Respect `prefers-reduced-motion` everywhere: turn off count-ups, the sunrise, petals and the shimmer on the live class bar.

## Accessibility

- WCAG 2.2 AA: contrast of 4.5:1 for text and 3:1 for UI parts, in both themes.
- Visible focus rings (2 px brand outline, 2 px offset). Everything works with the keyboard. Drawers trap focus.
- Live regions for toasts, the Ask Quad answer list and realtime counters.
- Touch targets at least 44 px on mobile.
- Each interactive prototype element has a role and label; copy them across.
