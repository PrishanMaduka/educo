# 03 Design system

The app design system is defined in `design/system.html` with the shared files `design/system/tokens.css` (every token, light and dark), `design/system/brand.js` (the school colour) and `design/system/faces.js` (flat illustrated people and initials). The redesigned prototypes in `design/` (`admin.html`, `platform.html`, `parent.html`) use them, and renders are in `docs/screenshots/redesign/`. This document turns them into the tokens and components that the web apps and the mobile app share. The redesign is decision [D34](02-architecture.md#decision-log). It replaces palette A (indigo, coral and lilac, D6).

## Principles

1. **Story first.** Pages open with a plain-language summary sentence and the one thing that needs attention, then detail.
2. **Calm surfaces, colour that means something.** Cream pages, white cards and a Quad navy side bar. Colour only does three jobs: **status** (green, orange, red, blue), **categories** (lime, pink, sky, orange) and **the school's own colour** (actions and where you are).
3. **Two typefaces.** Bricolage Grotesque speaks (greetings, titles, big numbers) and Figtree works (everything you read and fill in).
4. **Plain words.** Name things the way staff and parents do. Buttons say exactly what happens ("Send 6 to parents", "Save plan"). No jargon such as "tenant" in school-facing apps.
5. **State is visible.** Status pairs a colour with a word and a dot or icon, never colour alone.
6. **Works on a phone.** Every staff and console page works at 390 px wide with no sideways scrolling.

## Tokens (`packages/tokens`)

Tokens are defined once in TypeScript. `pnpm tokens:build` generates (1) a Tailwind v4 CSS file with an `@theme` block and the light and dark CSS variables for web, and (2) `apps/parent/lib/theme/tokens.g.dart` (a `QuadTokens` class plus `ThemeExtension`s for light and dark) for the Flutter app. The names match `design/system/tokens.css`.

**Porting rule.** The existing names in `packages/tokens/src/colors.ts` stay, so components keep compiling, and their values change to the ones below. The new tokens are added, and `deriveBrand()` is replaced by the rules in `design/system/brand.js` ([School brand colour](#school-brand-colour)). Until that port lands, the values in `packages/tokens` are the old palette A. The port is a D34 follow-up.

### Colour: existing names, new values

| Token | Light | Dark | Use and notes |
|---|---|---|---|
| `canvas` | `#F7F5F0` | `#0F1330` | Page background (cream, the landing page's paper) |
| `surface` | `#FFFFFF` | `#171D45` | Cards, drawers, inputs |
| `surface-2` | `#F0EEE7` | `#1D2550` | Table heads, quiet fills |
| `line` | `#E4E1D8` | `#2A3266` | Card borders, table rows. Decorative |
| `line-strong` | `#CDC8BA` | `#3A4378` | **Decorative only** (about 1.7:1): dividers, dashed card-header rules, and button and chip outlines (a button is named by its label). Never the only edge of a control |
| `ink` | `#101632` | `#F7F5F0` | Headings and body text (navy; cream in dark) |
| `ink-2` | `#3D4263` | `#C9CBE0` | Secondary text |
| `ink-3` | `#5A5F7B` | `#A9ACC8` | Captions and labels. 4.5:1 on `canvas`, `surface` and `surface-2` (was 3.9:1 on `surface-2`) |
| `brand` | derived | derived | Kept for compatibility. It carries the same value as `brand-fill` (as `brand.js` writes it). New code uses `brand-fill`, `brand-text` or `brand-raw` |
| `brand-strong` | derived | derived | Same as `brand-fill-strong` (hover) |
| `brand-soft` | derived | derived | Tint for selected rows, chips and icon tiles |
| `brand-ink` | derived | derived | Text on `brand-fill`: white or navy, chosen per colour (no longer always white) |
| `brand-fill` | derived | derived | Primary buttons, the active tab, badges, checked controls |
| `brand-fill-strong` | derived | derived | Hover on `brand-fill` |
| `rail` | `#101632` | `#0A0D24` | Side bar. Fixed Quad navy for every school (no longer tinted by the school colour) |
| `rail-2` | `#1D2550` | `#161C48` | Side bar hover |
| `rail-ink` | `#F7F5F0` | `#F7F5F0` | Side bar text |
| `rail-ink-2` | `#A9ACC8` | `#A9ACC8` | Side bar group labels and captions |
| `rail-active` | derived | derived | The active side-bar item: the school colour, lifted to stand out 3:1 from the bar. The console has no school, so it uses the default, Quad lime with navy text (was violet `#6D5AE6`) |
| `good` / `good-soft` | `#16703F` / `#DDF4E4` | `#5FD394` / `#12382A` | Present, paid, done |
| `warn` / `warn-soft` | `#A04A00` / `#FFE9D3` | `#FFB066` / `#3D2610` | Late, due soon |
| `bad` / `bad-soft` | `#C4234A` / `#FFE3E9` | `#FF7C9C` / `#401A2A` | Absent, overdue, errors, risk |
| `info` / `info-soft` | `#0B67A8` / `#DDF0FF` | `#7CCBFF` / `#12304F` | Invited, new, tips. **Blue, no longer violet** |
| `c1` | `#E0478A` | `#FF6FAE` | Pink (was coral) |
| `c2` | `#4048B8` | `#8C93FF` | Indigo |
| `c3` | `#1F8ACF` | `#59C3FF` | Sky (was lilac) |
| `c4` | `#D9640B` | `#FF9B45` | Orange (was amber) |
| `c5` | `#4E8A12` | `#C8F169` | Green, lime in dark (was teal) |
| `gold` | `#C8F169` | `#C8F169` | The highlight (lime; the name is historical) |
| `gold-soft` | `#E6F6B5` | `#41504E` | The marker under a key word |

Status text and icons (`good`, `warn`, `bad`, `info`) are 4.5:1 or more on `canvas`, `surface`, `surface-2` and their own `-soft`. `c1`–`c5` are 3:1 or more on cards in both themes, and keep their order so the greeting scenes still work.

### Colour: new tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `surface-3` | `#E8E5DC` | `#242C5C` | Pressed and selected fills |
| `field-line` | `#8E8A7D` | `#636DAA` | Edges of inputs, selects, checkboxes and radios: 3:1 on cards |
| `switch-off` | = `field-line` | = `field-line` | The track of a switch that is off: 3:1 on cards. The knob is the card colour |
| `navy`, `navy-2`, `navy-line` | `#101632`, `#1D2550`, `#2F3870` | same | Story cards, toasts and Ask Quad. The same in both themes |
| `on-navy`, `on-navy-2`, `on-navy-3` | `#F7F5F0`, `#C9CBE0`, `#A9ACC8` | same | Text on navy: headings, body, small print |
| `navy-card`, `navy-card-ring` | `navy`, transparent | `navy-2`, `navy-line` | Navy surfaces that must stay distinct in dark mode (story cards, the Ask Quad button, save bars) |
| `inverse`, `on-inverse` | `navy`, `on-navy` | `on-navy`, `navy` | Toasts and tooltips: navy with cream text in light, cream with navy text in dark |
| `on-fill` | `#FFFFFF` | `#101632` | Text and icons on a filled status colour. On `c1`–`c5` fills, only for icons and large or bold text |
| `rail-line` | `#2A3266` | `#232A5C` | Dividers in the side bar |
| `rail-active-ink` | derived | derived | Text on `rail-active` |
| `brand-text` | derived | derived | The brand as text, links, icons and the selected tab underline: 4.5:1 on `canvas`, `surface`, `surface-2` and `brand-soft`. Text never uses `brand-fill` directly |
| `brand-raw` | the saved colour | the saved colour | Logos, swatches, the colour picker and decoration |
| `lime`, `pink`, `sky`, `orange` | `#C8F169`, `#FF6FAE`, `#59C3FF`, `#FF9B45` | same | The four petals: categories, people, illustrations |
| `lime-soft`, `pink-soft`, `sky-soft`, `orange-soft` | `#EDF8CC`, `#FFE3EF`, `#DCF1FF`, `#FFE8D2` | `#37434B`, `#452D5A`, `#243E6A`, `#453645` | Accent tints |
| `lime-ink`, `pink-ink`, `sky-ink`, `orange-ink` | `#3D5410`, `#8A1D4C`, `#0D4F7A`, `#7A3A07` | `#D8F59A`, `#FFB3D3`, `#A8DDFF`, `#FFC694` | Text on the accent tints, 7:1 or more |
| `gold-ink` | `#3D5410` | `#D8F59A` | Text in the highlight colour |
| `heat-0`…`heat-3` | `#FFD4E7`, `#ECFACB`, `#DBF69E`, `#C8F169` | `#683A6A`, `#4C5D50`, `#819C5B`, `#C8F169` | Family connection heatmap: none, a little, some, a lot. Added with that screen |
| `heat-0-ink`…`heat-3-ink` | `#101632` (all four) | `#F7F5F0`, `#F7F5F0`, `#101632`, `#101632` | Text on each heat step |
| `focus` | `#2F6BFF` | `#7FA6FF` | Focus rings, in every school |
| `scrim` | `rgba(16,22,50,.45)` | `rgba(5,8,26,.6)` | Behind drawers and dialogs |

`QuadBrand.PALETTE` in `brand.js` (the named school colours, see below) is part of the same port: it moves into `packages/tokens` next to `deriveBrand()`.

### Theme rules
- Follow the system setting by default. The user can override it (stored per user, and per device on mobile).
- On web, set `data-theme="light|dark"` on `<html>` for overrides. System mode uses `prefers-color-scheme` (`:root:not([data-theme="light"])`).
- Dark mode is deep navy, not grey: cream pages become `#0F1330`, white cards become `#171D45`, and the text turns cream. The petals (`lime`, `pink`, `sky`, `orange`) and the navy tokens keep their values, so illustrations and the side bar look the same in both themes. Navy surfaces that sit on the dark canvas use `navy-card` (lifted to `navy-2` with a `navy-line` ring) so they do not disappear.
- Status, chart and brand colours have their own dark values (above), and every contrast rule in this document holds in both themes.

### School brand colour

A school picks one colour in the console (Branding). Inside its staff portal, and in the parent app after sign-in, it replaces the `brand*` and `rail-active*` tokens. Quad's navy, the petals and the type stay the same.

- **Default.** A school that has not picked a colour gets **Quad lime `#C8F169`**. The console itself always uses the default. Colours saved by older prototypes (`#2F6FED`, `#A0412D`) and invalid values map to the default. A school that explicitly saved `#DD4A42` keeps it.
- **Named palette.** The console offers `QuadBrand.PALETTE`, Quad lime first: Quad lime `#C8F169` (default), Greenfield green `#1B7F53`, Maroon `#7A1F3D`, Sunflower `#F2B705`, Teal `#0F7C86`, Indigo `#3B4AA8`, Orange `#D9640B`, Violet `#5B3FA8`. Any other hex is allowed too. The demo school, Greenfield International School, uses Greenfield green.
- **Derivation** (`deriveBrand(colour, mode)`, ported from `design/system/brand.js`; `mix(a, share, b)` is a per-channel sRGB mix, like CSS `color-mix(in srgb)`; contrast is WCAG 2 relative luminance). The base surfaces are light `surface #FFFFFF`, `canvas #F7F5F0`, `surface-2 #F0EEE7`, `rail #101632`, and dark `#171D45`, `#0F1330`, `#1D2550`, `#0A0D24`.
  1. **Lift (dark only).** Move the colour toward white, 1% at a time, until it is 3:1 against the dark `surface`. A maroon or navy school still gets a visible button.
  2. **`brand-ink`.** White if the (lifted) colour is 3:1 or more against white, otherwise navy `#101632`. Navy button text for light school colours is allowed.
  3. **`brand-fill`.** Move the colour away from its ink (toward black under white text, toward white under navy text), 1% at a time, until the ink is **4.5:1** on it.
  4. **`brand-fill-strong`** (hover) = `mix(fill, 0.86, the away colour)`, so contrast only goes up.
  5. **`brand-soft`.** The raw colour at 16% (light) or 20% (dark) over `surface`. The share is lowered 1% at a time until `ink-3` captions are still 4.5:1 on it.
  6. **`brand-text`.** The raw colour moved toward black (light) or white (dark) until it is **4.5:1** on `surface`, `canvas`, `surface-2` and `brand-soft`.
  7. **`rail-active`.** The raw colour lifted toward white until it is 3:1 against the navy `rail`. Then its ink is chosen and its fill adjusted to 4.5:1 exactly as in steps 2 and 3 (`rail-active-ink`).
  8. **`brand-raw`** is the saved colour, unchanged.
- **Guarantees, for any input colour in both themes:** button and badge text 4.5:1 on `brand-fill` and `brand-fill-strong`; brand-coloured text and icons 4.5:1 on every page surface and on `brand-soft`; captions 4.5:1 on `brand-soft`; the active side-bar item 3:1 against the bar with 4.5:1 text; dark-mode fills 3:1 against cards. `deriveBrand` returns the measured `checks` (ink, text, rail), and `packages/tokens` unit-tests every palette colour plus edge cases (white, black, pure yellow, navy) against these limits.
- **Worked examples** (light / dark):

| Colour | `brand-fill` · `brand-ink` | `brand-text` | `brand-soft` | `rail-active` |
|---|---|---|---|---|
| Quad lime `#C8F169` | `#C8F169` · navy / same | `#5E7131` / `#C8F169` | `#F6FDE7` / `#37434B` | `#C8F169` |
| Greenfield green `#1B7F53` | `#1B7F53` · white / same | `#19764D` / `#5DA485` | `#DBEBE3` / `#183148` | `#1B7F53` |
| Maroon `#7A1F3D` | `#7A1F3D` · white / `#9B576E` · white | `#7A1F3D` / `#B58292` | `#EADBE0` / `#2B1D43` | `#964E66` / `#924760` |
| Orange `#D9640B` | `#BF580A` · white / same | `#A94E09` / `#E08037` | `#F9E6D8` / `#3E2B39` | `#BF580A` |

- **Runtime.** Web writes the derived values for both themes into one `<style id="quad-brand">` (`:root{…}`, the dark media query and `:root[data-theme="dark"]{…}`), so switching theme needs no recalculation and a published brand change re-themes the page live (`tenant.branding.updated`). Flutter applies the same derived values to its `QuadColors` theme extension. Whether it gets them from a Dart port of `deriveBrand()`, tested against the same cases as the TypeScript one, or as derived values from the API is decided with the token port (a D34 follow-up).
- **What does not take the school colour:** the side bar background, focus rings, Ask Quad (navy with a lime spark in every school), toasts, status colours, categories, illustrations and the Quad logo. In the parent app, sign-in screens are Quad-branded (navy and pink) and the school colour applies after sign-in (D13).

### Type

- **Bricolage Grotesque** (`fontFamily.display`, new): weights 600–800, optical size on (12–96). Use it for greetings, page titles, section and card titles, drawer and dialog titles, and big numbers. **Figtree** (`fontFamily.sans`, unchanged, 400–800) for body, tables, forms, labels and buttons. Fallback stack: `system-ui, -apple-system, "Segoe UI", sans-serif`. Self-host both with `next/font/local` on web and bundle them as assets in the Flutter app. **Fraunces (`fontFamily.accent`) is retired.**
- Scale:

| Role | Style | Use |
|---|---|---|
| Display (`type.size.display`, new) | Bricolage 800 · 44/46 · −0.035em | Web greetings and the Today title in the story card |
| Page title (`type.size.pageTitle`) | Bricolage 800 · 30/34 · −0.025em | Staff and console page heads |
| Section | Bricolage 800 · 22/26 · −0.02em | Drawer and dialog titles |
| Card title (`type.size.cardTitle`) | Bricolage 700 · 17/22 · −0.015em (was 18) | Card headers |
| Stat | Bricolage 800 · 32 · tabular | KPI tiles |
| Body | Figtree 400 · 14.5/22 (web), 15/22 (phone) | Text |
| Label and button | Figtree 700 · 13–14 | Field labels, buttons |
| Caption | Figtree 500 · 12.5 · `ink-3` | Meta lines |
| Eyebrow and table head | Figtree 800 · 11.5 · +0.1em · uppercase | Crumbs, group labels, table heads |

- The parent app's Home greeting is Bricolage 800 at 27 px on one line (the prototype's phone header). The story-card greeting on the web uses Display.
- Numbers in tables and tiles use `font-variant-numeric: tabular-nums`.
- **Highlight.** A key word in a sentence gets a lime marker: `box-shadow: inset 0 -0.32em 0 var(--gold-soft)`. In story cards and on navy, the highlighted word is a lime pill with navy text, rotated −2°. On the greeting card the greeted name is the same pill, straight (D38).

### Space, shape, elevation and focus

- **Spacing:** a 4 px grid. 4 (icon gaps), 8 (chip gaps), 12 (list gaps), 16 (card padding on phones), 20 (card padding, grid gaps), 24 (page padding), 32 (story padding), 40 (section gaps on phones), 48 (section gaps).
- **Radii:** `r-xs` 8 (keyboard hints, swatches), `r-sm` 12 (inputs, tiles; `radius.input`, unchanged), `r` 20 (cards; `radius.card`, was 16), `r-lg` 28 (story cards, drawers, dialogs; `radius.scene`, was 24), `r-pill` 999 (buttons, chips, tabs, segmented controls, toasts). Corners get rounder as things get bigger.
- **Shadows** (navy-tinted): `shadow-sm` `0 1px 2px rgba(16,22,50,.06)` for tiles and chips; `shadow` `0 1px 2px rgba(16,22,50,.05), 0 10px 28px -18px rgba(16,22,50,.30)` for cards; `shadow-lg` `0 30px 70px -24px rgba(16,22,50,.45)` for drawers, menus, dialogs and toasts. Dark: `0 1px 2px rgba(0,0,0,.3)`, `0 1px 2px rgba(0,0,0,.3), 0 12px 30px -18px rgba(0,0,0,.7)` and `0 30px 70px -24px rgba(0,0,0,.8)`.
- **Dividers:** card headers and setting rows use a dashed `1px dashed var(--line-strong)`.
- **Focus:** a 2 px `focus` outline with a 2 px offset on every interactive element, always blue (`#2F6BFF` light, `#7FA6FF` dark), never the brand. Inputs also show a 3 px halo (`focus` at 25%) with a `focus` border.

## Logo (`packages/tokens/logo`)

- The mark is four petals on a 30-unit grid: each is a 13.5-unit square with a 10-unit round outer corner and 3.5-unit inner corners, mirrored into the four quarters with a 3-unit gap. Top left sky `#59C3FF`, top right pink `#FF6FAE`, bottom left lime `#C8F169`, bottom right orange `#FF9B45`.
- The wordmark is lowercase "quad" in navy `#101632` (cream `#F7F5F0` on dark backgrounds, `quad-logo-white.svg`); the petals keep their colours on dark. `quad-mark-white.svg` is the all-white mark for single-colour use.
- `QuadMark` and `QuadLogo` take a variant: `color`, `white`, `mono` (all white) and `theme` (the public site's colour tokens, with the wordmark in the current text colour).
- Source files: `design/brand/quad-logo.svg`, `quad-logo-white.svg`, `quad-mark.svg`, `quad-mark-white.svg`, `quad-app-icon.svg`. Export them as React components for web, and use the SVG files with `flutter_svg` in the parent app. Usage rules are in `design/brand.html`.
- A school's own logo (uploaded in the console) is shown in its staff portal side bar and in the parent app after sign-in. Without a logo, the school shows its initials on a `brand-fill` tile with `brand-ink` text. Quad's mark appears as "powered by Quad", in the console, on the public landing page and sign-in, and on the parent app's splash and sign-in screens before a school is known (the parent app is one Quad app for every school; see [09](09-parent-app.md#start-up)).
- The parent app icon is `quad-app-icon.svg` (the petals on navy) for every school; dev and staging builds add a small "DEV" or "STG" badge.

## Colour rules

- **Status** (`good`, `warn`, `bad`, `info`) is only for state, and always with a word plus a dot or icon. Pills are the status colour on its `-soft` tint. A filled status colour carries `on-fill` text. Present, paid and done are `good`; late and due soon are `warn`; absent, overdue, errors and risk are `bad`; invited, new and tips are `info` (blue).
- **Categories** use the four petals, never for status:
  - **sky:** teaching and teachers;
  - **lime:** care (nurse, counsellor, coaches, support staff) and highlights;
  - **pink:** family and parents;
  - **orange:** students and children.

  Tags put `-ink` text on the `-soft` tint. The same mapping colours people in the Circle orbit, illustrated backgrounds and icon tiles.
- **The school colour** marks actions (primary buttons, checked controls, the active tab and side-bar item) and selection (`brand-soft` rows, `brand-text` links). One primary action per view.
- **Charts and subjects** use `c1`–`c5` in order (pink, indigo, sky, orange, green).
- **Avatars and badges:** counts in the side bar sit on a translucent white pill; red `bad` badges mean "needs you"; the parent tab bar's badges are pink with navy text.

## Illustration and avatars

- **Flat illustrated people** (`faces.js`, ported from the landing page) are for the **sample cast, onboarding and empty states only**. The cast is Ms. Okafor, Coach Tanaka, Nurse Haddad, Priya (Mum), Nani Asha, Daniel (Dad), Maya, Leo and Mr. Abara. Each face sits on its category colour (teaching sky, care lime, home pink, child orange). Moods are happy, laugh and worried. There is no blinking or other motion.
- **Real people get their photo, or flat initials.** Quad never guesses what a real child or parent looks like. The initials avatar is a flat accent circle (sky, pink, lime or orange, chosen by a stable hash of the name) with navy Bricolage initials, 6.8:1 or more on every accent. Titles (Mr, Mrs, Ms, Miss, Dr, Coach, Nurse) are skipped, and the letters are the first and last names' initials. Sizes 28, 36, 48 and 72. Stacks overlap by a quarter with a 2.5 px ring in the card colour.
- **Doodles** (star, heart, sun, squiggle, kite, plane, pencil, book, cloud, coin, bubble, moon) in the petal colours decorate story cards, the parent welcome and empty states. They are `aria-hidden` and hidden on phones where they would crowd text.
- On web, faces and doodles are server-rendered SVG strings (as on the landing page, D33). In Flutter they are bundled SVG assets exported from `faces.js`.

## Page patterns

### Staff and console shell
- **Side bar:** Quad navy (`rail`) for every school, 248 px (collapsible to 72 px). It has the school logo or initials tile and name at the top ("Staff portal · powered by Quad"); the console shows the Quad logo with a lime "CONSOLE" badge. Grouped nav has uppercase `rail-ink-2` group labels and pill-shaped items with count badges. The active item is a `rail-active` pill with `rail-active-ink` text. The signed-in user and sign-out sit at the bottom above a `rail-line` divider. On phones it becomes a slide-over menu.
- **Top bar:** sticky and translucent cream (`canvas` at 86% with a blur) with a `line` bottom border. It holds the collapse button, search (a pill on `surface-2` with a Ctrl K hint), the **Ask Quad** pill (`navy-card`, cream text, a lime spark and a `/` hint), the academic year picker (staff), the theme toggle, notifications (a pink dot for new) and the profile menu.
- **Content:** max width 1480 px, 24 px padding (16 px on phones), 20 px gaps.

### Story card

- Every page opens with a **story card**: navy (`navy-card`), `r-lg` corners, cream text. An eyebrow, a Bricolage headline with one lime-highlighted word, one or two sentences with the key numbers in bold, and two or three actions. The primary action on navy uses `rail-active`, and secondary actions are outlined in `navy-line`. **On the greeting card** (the staff Dashboard and the console home) the primary action is **cream** instead: `on-navy` fill and border with `navy` text (16:1 on navy, 13:1 on `navy-2`), hover `on-navy-2`, and a 2 px `on-navy` focus ring offset 3 px, so it never clashes with the lime name (D38). The school colour stays on primary buttons everywhere else.

### The greeting section (time of day)

- **Greeting and scene follow the time of day**, in the school's time zone on the web and the phone's time in the parent app:

| Period | Hours | Words | Scene |
|---|---|---|---|
| Morning | 05:00–11:59 | Good morning | An orange sun with a dashed ring, a `navy-line` cloud, birds, an orange kite, a sky back hill, a lime front hill and a lime sparkle |
| Afternoon | 12:00–16:59 | Good afternoon | A lime sun high up with a dashed ring, two clouds, the kite, a sky back hill, an orange front hill and a pink sparkle |
| Evening | 17:00–19:59 | Good evening | A pink sun setting behind violet and `navy-line` hills, birds, an orange sparkle and a pink heart |
| Night | 20:00–04:59 | Good evening (until midnight), then Hello | A cream crescent, twinkling stars (cream and lime) and `navy-line` and `navy-2` hills |

- The scenes are **flat** (D38): solid fills only, with no gradients, glows, opacity layers or see-through hills, in the landing-page palette (navy, `navy-2`, `navy-line`, cream, lime `#C8F169`, pink `#FF6FAE`, sky `#59C3FF`, orange `#FF9B45`, violet `#8C93FF`). Each scene is drawn in a 600 × 300 box at the bottom right of the 1200 × 320 view box and is transparent elsewhere, so the card colour shows through. On the staff Dashboard and the console home the scene sits inside the navy story card.
- **Palettes:** `scenes.js` names the flat colours as keys, plus a few roles that depend on the backdrop: `muted` (birds, kite string), `cloud`, `hill` (the sky back hill), `moon`, `star` and `deep` (the front night hill). `DARK` is for navy (cloud `navy-line`, cream moon and stars); `LIGHT` is for cream (a pale cloud, a deeper sky hill, an orange moon and violet stars), as shown in `design/brand.html#greeting`. The prototypes colour the scene with CSS variables, and a container can retune a role with `--gs-*` (the dark-mode navy-2 card sets `--gs-deep` to navy so the front night hill still shows).
- **Assets** (source of truth `design/brand/greeting/`): `scenes.js` (one generator for every scene, palette-driven), the exported `{morning,afternoon,evening,night}-{light,dark}.svg` (1200 × 320), PNG renders in `png/` at @1x and @2x (transparent outside the drawing), and 24 px icons `icon-{period}.svg`. Re-export with `node design/brand/greeting/export.js`. The brand page (`design/brand.html#greeting`) shows them all.
- **Web** (`packages/ui`): `<GreetingScene period>` is a port of `scenes.js` (same flat shapes) that colours the SVG with the theme tokens (CSS variables): `c1`–`c5` for pink, violet, sky, orange and lime, and `rail`, `rail-2`, `ink-2`, `ink-3` and `line-strong` for the roles, so it follows light and dark mode without separate files. `greetingPeriod(date, timeZone)` lives in `packages/domain/greeting`, with unit tests for every boundary (04:59, 05:00, 11:59, 12:00, 16:59, 17:00, 19:59, 20:00, 23:59, 00:00).
- **Flutter:** the parent header uses the icons (`assets/greeting/icon-*.svg` via `flutter_svg`, on a 20 px round tint): `c4` orange for morning and afternoon, `c1` pink for evening and `c3` sky for night. The API's `GET /family/home` returns the period computed for the device's time zone header, and the app falls back to the device clock offline.
- The scene is one SVG with `preserveAspectRatio="xMaxYMax slice"`, positioned `absolute; inset: 0`, behind the whole section. Text always sits on the calm left side (max width about 64%); the hills rise on the right. The card is about 40 px shorter than before D38: 26 px top and about 70 px bottom padding on the staff Dashboard (50 px on the console home, which has the calendar note).
- On narrow screens the scene shrinks to a band about 130 px tall along the bottom, and the text uses the full width.
- Motion: the sun or moon rises once on load (1.4 s) and the stars twinkle slowly; nothing moves with reduced motion.
- Content: a small date line, then "Good morning, {first name}" with the highlighted name, a one- or two-sentence summary computed from live data, a context line (week of term, next break) and up to three actions.

### Page head
Small uppercase crumb, page title, optional one-line description, and actions on the right (they wrap under on phones).

### Drawers ("form drawers") and dialogs
- All create and edit forms open in a right-side drawer (520 px; 760 px for wide drawers), never in a centred modal. The drawer body is `canvas`, with `r-lg` corners on the left, over a `scrim`. On phones it is a full-screen sheet with square corners.
- Header (`surface`): a 44 px icon tile (`brand-soft` with a `brand-text` icon), a section eyebrow, the title (Bricolage 22) and subtitle, and a close button. Multi-step forms show a numbered stepper in the header: the current step is a `brand-fill` circle, done steps are `good-soft` with a `good` check, and later steps are `surface-2`.
- Body: fields grouped in white `r` cards in a two-column grid (one column under 600 px). Footer (`surface`): Cancel (ghost) and the primary action, right-aligned.
- Escape closes the drawer; focus goes to the first field and returns to the opener on close. Unsaved changes prompt "Discard changes?" inline.
- Danger drawers (suspend, delete) use the `bad` accent and require the school's name to be typed.
- **Dialogs** are only for confirming something you cannot undo: 440 px wide, `r-lg`, a 48 px `bad-soft` tile, the question as the title ("Remove {name}'s access?"), one sentence on what happens, and two buttons that say what happens ("Keep access", "Remove access").

### Filters
- Toolbar filters are custom dropdowns, not native selects. A dropdown shows an icon, the label and the value. An active filter shows its value and a × to clear it, and the menu shows a count next to each option. It can have search (for long lists) and option groups (year groups grouped by stage). "Clear filters" appears with an "N of M" count when any filter is active.
- Filter chips are 32 px pills with a `line-strong` outline and a count; a pressed chip is filled `ink` with `surface` text.
- A segmented control (a `surface-2` pill track, the selected segment a raised `surface` pill) is used for 2–6 mutually exclusive views (statuses, levels), each with a count.

### Tables and list rows
- Uppercase 11.5 px heads on `surface-2`, 14 px rows with 11 px vertical padding and `line` borders, tabular numbers. Rows are clickable when they open a record, with a `brand-soft` hover tint (60% over `surface`), and selected rows are `brand-soft`. Columns hide progressively on phones, or the table switches to cards.
- List rows: a 38 px rounded icon tile (category or status tint), a bold line and a caption, and a time or one action on the right.

### Empty states
A small flat illustration (faces or doodles) or icon, a Bricolage title, one warm sentence, and the next action ("No overdue invoices. Every family is up to date…", **See all invoices**).

### Toasts and celebrations
- Toasts are `inverse` pills at the bottom centre with a lime check circle, and say what happened ("Plan saved for Leo"). At most two are shown at a time, for 2.8 s each.
- A petal burst (lime, pink, indigo and green petals: `gold`, `c1`, `c2`, `c5`) marks good moments: a payment completed, cover complete, a plan created, a school going live, birthday wishes sent, or a thank-you sent. There is no burst with reduced motion.

### Charts
- Bars and lines use `c1`–`c5`. The grid is faint (`line`), the latest point is labelled, the target line is dashed `ink-2`, and tooltips show exact values. Every tick label is a value the chart actually reaches.
- Progress bars are 10 px pills on `surface-2` with a `line` inset, filled `c5` (or the status colour when they show a state).
- Sparklines in early-warning cards: 64×24, with the end point marked; `bad` for falling and `good` for rising.
- **The day ring** (parent Today): one arc per period, filled as the day goes, with the child's photo or initials inside.

### Heatmap
The staff Family connection heatmap uses `heat-0` (pink, no contact) to `heat-3` (lime, a lot), with the matching `heat-N-ink` text (were coral and teal). The tokens are added to `packages/tokens` with that screen.

### Ask Quad
- **Staff and console:** the top-bar pill and a floating pill at the bottom right, both `navy-card` with cream text and a lime spark, the same in every school. The floating pill moves up 92 px when a sticky save bar is shown, and is hidden while the panel is open.
- **Parent app:** a 56 px round floating button (`navy-card` with a lime spark, the same in every school) at the bottom right, 12 px above the tab bar, on the four tab pages only (D36). Ask Quad is also a row in Profile and opens with the `/` key where a keyboard is attached. The panel is a navy-and-lime bottom sheet; the parent's own messages take the school colour (`brand-fill`).

### Public landing page
Reference: `design/landing.html`. The public site is specified in [19](19-public-site.md#design-tokens-to-add) and speaks the same language as the apps (navy, cream, lime, pink, sky and orange, Bricolage Grotesque, flat avatars). Its `site-*` tokens stay public-only and are not used in the apps; the apps use the tokens in this document.

## Components (`packages/ui`)

These are the 28 components in `design/system.html`, plus the app-specific ones:
- **Button:** pills, 40 px (md) and 32 px (sm), 44 px touch targets on phones. Variants: primary (`brand-fill` / `brand-ink`, hover `brand-fill-strong`), secondary (`surface` with a `line-strong` outline), ghost, danger (`bad` with `surface` text), danger-soft (`bad-soft` with `bad` text), primary on navy (`rail-active`), and secondary on navy (`navy-line` outline). Icon buttons are 38–40 px circles. Disabled is 50% opacity.
- **IconButton**.
- **Input, Textarea, Select:** 42 px, `r-sm`, a 1.5 px `field-line` border (`ink-3` on hover, `focus` with a halo on focus, `bad` when invalid). A visible label (13 px, 700, `ink-2`), an optional hint, and errors in words in `bad`, linked with `aria-describedby`. The select has a native fallback.
- **Checkbox and Radio:** 20 px with a `field-line` edge, checked in `brand-fill` with a `brand-ink` mark.
- **Switch:** 42 × 24, the track `switch-off` when off and `brand-fill` when on, with a card-coloured knob (`brand-ink` when on).
- **Dropdown:** the filter variant, with search and groups.
- **Segmented control, Tabs:** tabs have a 2.5 px `brand-text` underline and a count pill.
- **Chip** (filter), **Pill** (status, with a dot), **Badge** (count), **Tag** (category).
- **Card:** `r`, `line` border and `shadow`, with a dashed header. **Story card:** navy.
- **KPI tile:** a label, a 34 px icon tile, a Bricolage 32 value and a delta in `good` or `bad`.
- **Table:** sortable and selectable. **List row**.
- **Drawer** (with Stepper), **Dialog**, **Toast**, **Tooltip** (`inverse`).
- **Avatar:** photo, initials, or an illustrated face for the sample cast only; and **AvatarStack**.
- **Empty state**, **Progress**, **Day ring**, **Greeting scene**, **Sparkline**, **Bar chart**, **Line chart**, **Donut**, **Heatmap** (attendance, Family connection), **Timeline**.
- **Command palette**, **Ask Quad panel**, **Petal burst**, **Side bar**, **Top bar**.

The Flutter equivalents live in `apps/parent/lib/ui` (for example `QuadButton`, `QuadCard`, `QuadPill`, `QuadTag`, `QuadAvatar` (photo or initials), `GreetingIcon` (time-of-day icon), `DayRing`, `PetalBurst`, `Sparkline`, and the tab bar). They read colours only from the generated tokens through `Theme.of(context).extension<QuadColors>()`, and type from the bundled Bricolage Grotesque and Figtree.

### Parent tab bar
A `surface` bar with rounded top corners. The active tab is a 54 × 30 `brand-fill` pill around the icon, with `brand-ink` icon colour and the label in `ink`; inactive labels are `ink-3`. Each tab is 48 px or taller. Badges are pink with navy text and a `surface` ring. Before sign-in the app is Quad navy and pink; after sign-in the pill takes the school colour. The tabs themselves are listed in [09](09-parent-app.md#navigation).

## Tailwind CSS (web)
- All web styling uses Tailwind CSS v4 utility classes. The generated `@theme` maps tokens to utilities (`bg-canvas`, `bg-surface`, `text-ink-2`, `border-line`, `border-field-line`, `bg-brand-fill`, `text-brand-ink`, `text-brand-text`, `bg-navy`, `text-on-navy`, `bg-lime-soft`, `text-lime-ink`, `outline-focus`, `rounded-card`, `rounded-scene`, `shadow-card`, `font-sans`, `font-display`).
- Dark mode uses a custom variant tied to `data-theme` and `prefers-color-scheme`. Because the colours are CSS variables, components rarely need `dark:` classes.
- The school brand colour is set at runtime by writing the derived `brand*` and `rail-active*` variables for both themes (see [School brand colour](#school-brand-colour)). Tailwind utilities read the variables, so a published brand change re-themes the page live.
- Component variants use `class-variance-authority`, and class strings are merged with `tailwind-merge` (`cn()` helper in `packages/ui`).
- Not allowed: raw hex values in class names (`bg-[#C8F169]`), inline styles except CSS variables, CSS modules and CSS-in-JS. A lint rule (`eslint-plugin-tailwindcss` or a custom rule) flags arbitrary colour values. The fixed hex values inside the illustration art (skin, hair) live in the face generator, not in class names.

## Icons

A single stroke icon set (Lucide), stroke width 1.9, round caps and joins. Icons are decorative and `aria-hidden` unless they are the only content of a button, which then needs an `aria-label`.

## Motion

Durations of 150–280 ms with `cubic-bezier(.2,.8,.2,1)`. Animate transform and opacity only. Respect `prefers-reduced-motion` everywhere: turn off count-ups, the sunrise, petals, confetti and the shimmer on the live class bar.

## Accessibility

- WCAG 2.2 AA: contrast of 4.5:1 for text and 3:1 for UI parts, in both themes and for any school colour (see the guarantees above). Control edges and off switches meet 3:1 through `field-line` and `switch-off`; `line` and `line-strong` are never the only cue.
- Visible focus rings (2 px `focus` outline, 2 px offset). Everything works with the keyboard. Drawers trap focus.
- Live regions for toasts, the Ask Quad answer list and realtime counters.
- Touch targets at least 44 px on mobile.
- Each interactive prototype element has a role and label; copy them across.
- The redesigned prototypes are checked with axe (0 serious or critical issues) on every top-level screen in light and dark, at 1440 and 390 px for staff and console and at 390 px for the parent app. The apps keep the same bar ([17](17-testing-quality.md)).
