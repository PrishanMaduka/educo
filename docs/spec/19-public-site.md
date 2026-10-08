# 19 Public site

The public landing page at `https://quad-edu.com/`, the sign-in entry, demo requests and the legal pages. Reference: `design/landing.html` (watercolour picture-book illustrations, no product screenshots, background palette B "Sky blue"; reference renders in `docs/screenshots/landing/`). Built in **M1b** ([18](18-delivery-plan.md)).

## Where it lives

- `apps/staff`, route group `(public)`: `/`, `/sign-in`, `/legal/*`, the `/p/*` "Get the Quad app" fallback, `/sitemap.xml`, `/robots.txt` and the `/.well-known/*` app-link files ([02 → Paths](02-architecture.md#paths-on-quad-educom-d14-d15)).
- Public pages are statically rendered (Next.js static generation) and served through CloudFront. Until the AWS deploy exists, a static export of `/` is served from GitHub Pages instead (D30). They load no signed-in code: the staff portal bundle starts under `/app`.
- Quad-branded only. No school branding appears on public pages (the school is not known yet).
- A signed-in visitor who opens `/` sees the landing page with **Open {school}** in place of **Sign in**, linking to `/app`.

## Page structure

Copy comes from the prototype; strings live in `packages/contracts/i18n/en.json` under `public.*`. Sample people (Amaya, her family and her teachers) are fictional and marked as a sample school in the page.

The page is concept-led (D29): it explains Quad Circle and the four ideas through illustrations, not product screenshots. Every section is carried by an inline SVG illustration in a **watercolour picture-book style**: loose, translucent washes with blooms, uneven pigment and darker dried edges; visible paper grain; muted, earthy colours (dusty peach and apricot skies, sky-blue and lilac washes, teal, ochre, olive, charcoal); lots of open sky; small, soft figures, often seen from behind or in three-quarter view, with a rosy cheek and no outlined cartoon faces; and fine dry-brush details (grass, birds, tea rows). Scenes are set in Sri Lanka (palms, tea-country hills, a stupa, a Poya flag) and fade into the page through a painted vignette instead of sitting in boxed cards. In dark mode (Soft charcoal) each scene becomes a dusk version: a dimmed charcoal sky, a moon, stars and lit windows.

| # | Section | What it shows | Behaviour |
|---|---|---|---|
| 1 | **Top bar** | Skip link; Quad mark and wordmark; section links (Quad Circle, A school day, Why Quad, Your whole school, Privacy); theme toggle; **Sign in** (ghost) and **Book a demo** (primary) | Sticky with a blur background. At 900 px and below the section links and the theme toggle move into a **Menu** button (`aria-expanded`, Escape closes); Sign in and Book a demo stay visible |
| 2 | **Hero** | Eyebrow "School management, built around the child"; heading "Every child has a *circle.*" (the last word in the serif accent); lede naming the people around a child; **Book a demo** and **See a day in the circle ↓** (to `#day`); "Already on Quad? **Sign in to your school**"; two fine-print points (curricula; rupees, PayHere and Poya days) | — |
| 3 | **Hero scene** | A large watercolour scene beside the text (above it at 900 px and below): Amaya, small, seen from behind in her white uniform with plaits and her school bag, stands on a hill path under a big peach sky. Her school is in the distance on one side, and her home with a lit window on the other, among tea hills, palms, a stupa and a Poya flag. Her circle drifts around her in the sky as eight translucent kites, each carrying a tiny silhouette of one person (at school: Ms. Jayasinghe, Mr. Perera, Coach Herath, Nurse Dias, Sunethra on the bus; at home: Mum, Dad, Grandma), with faint threads trailing down towards her | Every 3.2 s a small glint travels from one kite past Amaya to another. The **ticker** below (`role="status"`, `aria-live="polite"`) shows the sender's kite and says what just happened ("Ms. Jayasinghe shared a moment · Amaya painted the canteen mural · 08:55"), cycling through six sample events. Under it: "A sample school. Amaya and her circle are fictional." Kites bob gently. With `prefers-reduced-motion` nothing moves and the ticker shows the first event only. The SVG is one labelled image whose `<title>` describes the scene and lists the people |
| 4 | **Strip** | Three short claims, each with a small painted icon (a mum and Amaya, a school crest with a lotus, the island of Sri Lanka): one Quad app for every family; your school's name, logo and colours; made in Sri Lanka for local curricula, rupees and Poya days | Wraps to a column at 820 px |
| 5 | **What is the Quad Circle?** (`#circle`) | Heading "What is the Quad *Circle?*" and one sentence: "The Circle is the small group of people at school and at home who care for one child, and the simple ways Quad keeps them in touch." Then three parts in the watercolour style. **Who:** a painted circle diagram with Amaya at the centre, an inner ring "AT HOME" (Dilhani, Mum; Ruwan, Dad; Kamala, Grandma, invited) and an outer ring "AT SCHOOL" (class teacher, maths teacher, swimming coach, counsellor, school nurse, bus aunty), each a small painted figure with name and role. Two painted arrows between the rings show both directions: "moments & learning" go home, and "thanks & tries" come back. **How it works:** a painted loop, not a stepper. Four soft painted vignettes sit clockwise (1 at the top, 2 right, 3 bottom, 4 left) around a watercolour brush-stroke path with arrows that closes back to 1 around the words "Every week, round again". Each has a painted serif numeral, a short title and one line: (1) A moment at school: two taps, and only Amaya's family sees her mural; (2) Home says thanks: Mum taps thank you, and Grandma, invited, loves it; (3) Try it at home: one small idea from class, and they tap We tried it; (4) The teacher sees it: her family pulse shows who needs good news next. Amaya, at the centre of the diagram and in the scenes, wears a painted school uniform: a white frock with collar, belt and pleated skirt, the school tie, white socks, black shoes, a satchel and plaits with rose ribbons. **What keeps it kind and safe:** four painted icons with one line each: families choose who's in (up to four relatives, moments only, removable in one tap); photo consent (class, family only, or no photos); quiet hours (18:00 to 07:00 and weekends; urgent safety alerts still go through); good news, not records (health and safeguarding never enter the Circle; relatives never see fees, marks or attendance) | The diagram is `aria-hidden`; its text equivalent is a list of the people under it (visually hidden above 620 px, shown below 620 px, where the diagram's role labels hide). The steps are a real `<ol>` in reading order; the painted path is an `aria-hidden` layer behind it. A glint travels round the loop, and not with reduced motion. Layout: the diagram beside the loop at 980 px and above. At 620 px and below the loop becomes a painted vertical path (pictures down the left, captions beside them, a dotted return line to 1), stacked after the diagram and the people list, then the rules. The relatives, photo consent, quiet hours and family pulse rules follow [12](12-moments-messaging.md#quad-circle) |
| 6 | **A day in the circle** (`#day`) | Dark band. "One school day in *Amaya's circle*" as an ordered list of seven timed steps (07:42 arrival and day ring, 08:55 moment, 09:10 grandma loves it, 12:30 everyone around the child, 18:20 tried at home, 19:30 quiet hours, Friday recap), each with a coloured tag, heading, sentence and its own painted vignette on paper that fades into the band: Amaya walking in through the school gate with a painted day ring; Amaya painting the mural while Ms. Jayasinghe shares it; Grandma in her armchair by the window onto Kandy's tea hills; Dad at his desk sending up kites for the people around Amaya; Mum and Amaya writing the postcard at the kitchen table; Ms. Jayasinghe reading at home under a night window while a message waits for 07:00; the family on the sofa under bunting with the recap card | Steps reveal on scroll (fade and rise, none with reduced motion). The band foot says families choose who sees photos and nothing about health or safeguarding goes into Circle, with **Book a demo** and a painted shield |
| 7 | **Why Quad** (`#ideas`) | "Four ideas that put *people first*": four cards, each with a painted scene, a title, a sentence and a quoted plain-English example: **Story first** (the principal at his morning desk with tea, a window onto the tea hills and a short painted story card), **Early warning** (a classroom where the trend dips on the chalkboard, a worry cloud over one child and Mr. Mendis stepping in with a heart note), **Ask Quad** (Ms. Fernando's question on a paper note and an answer card with two source tabs), **Your school's own brand** (three painted school crests joined to one Quad mark, with children whose ties match each crest) | Two columns; one column at 820 px |
| 8 | **For school leaders** | "Is every family *connected?*" with three ticked points, and a card with a painted village in the tea hills (homes with lit windows for families who heard good news, two still dark, Ms. Jayasinghe sending a heart to one of them) above the heatmap: share of families who heard something positive in the last 2 weeks, year group × class, sample data | Static sample data (no API). Cells use the four heat tokens below with `heat-ink` text on the two teal steps; the table has row and column headers for screen readers and a key (Fewer … All families) |
| 9 | **Your whole school** (`#school`) | "Everything a school runs, *under one roof*": a painted campus (the gate with a parent and child, a white two-storey school with a clay-tile roof and clock tower, an office window marked Rs, a sick-bay window with a heart, exam papers in the upper windows, a notice board, the school bus, a tuk-tuk, palms, trees, tea hills and children in the yard) with eight painted numbered pins, and a numbered list of the eight modules (Admissions, Students, Attendance, Timetable & cover, Exams & reports, Pastoral care, Fees & finance, Communication) with one line each | Says year groups follow the curriculum ("Year 4, Grade 4 or Form 1"). The list carries the meaning; the pins are decorative |
| 10 | **Privacy and safety** (`#trust`) | Four cards, each with a painted scene: only your school (the school inside its own painted ring, with a padlock, other schools faint outside); families decide (Mum holding a photo of Amaya, with Grandma and Grandpa ticked and an empty place crossed); sensitive stays sensitive (a locked folder with a heart, and a log of who viewed it); local rules (Sri Lanka in teal with a pin, inside the region, data in the cloud ticked) | Links to `/legal/privacy` and `/legal/subprocessors` |
| 11 | **Demo** (`#demo`) | "Book a 30-minute *walkthrough*" with a painted walkthrough over tea (a Quad guide and the principal at a table with a closed laptop, cups and a teapot), and the form (below) | Replaces the prototype's "nothing is sent" note |
| 12 | **Footer** | Mark, links (Privacy, Terms, DPA, Sub-processors, Cookies, Status → `status.quad-edu.com`, Contact `support@quad-edu.com`), "Sample school and families are fictional", © Quad | Prototype links to other prototypes are not carried over |

How the illustrations ship: each is a React server component that renders static SVG markup (the prototype builds the same markup with a small script). People come from one shared figure and portrait component, so the style stays consistent. The same characters appear throughout: Amaya, her mum Dilhani, her grandmother Kamala and her class teacher Ms. Jayasinghe. No illustration code runs on the client except the hero sparks and ticker.

The watercolour look comes from shared SVG filters, defined once on the page and reused by every scene:

| Filter | What it does | Used on |
|---|---|---|
| `wcBig` | `feTurbulence` + `feDisplacementMap` for soft, irregular edges; a slight `feGaussianBlur` bleed; a turbulence alpha mask for uneven pigment and blooms; `feMorphology` erode + `feComposite` out for the darker dried edge (tide line) | Sky and land washes, the path |
| `wcSky` | A wide displacement and a 12-unit blur with mild pigment and no dried edge | The big sky washes, so the hero sky stays soft |
| `wcMid` | The same as `wcBig` at a smaller scale | Buildings, hills, kites, furniture |
| `wcFig` | A light wobble and pigment variation, mostly opaque | Figures (normal blending, so a white uniform still covers what is behind it) |
| `wcInk` | A fine displacement on thin strokes | Dry-brush and ink details: grass, birds, tea rows, window frames |
| `wcBloom` | A wide blur | Lit-window and moon glow |
| `wcFeather`, `wcFeatherS` | A displaced, blurred white shape used as a mask | The painted vignette that fades each scene into the page (large scenes and band vignettes) |
| `wcPaper` | Fine fractal noise at about 30% with `multiply` | Paper grain over each scene |

Washes are translucent fills (opacity 0.15–0.6) with `mix-blend-mode: multiply` in light mode, so overlapping washes build up pigment; dark mode uses normal blending. Blue washes never overlap peach ones, because that turns grey. The heavy filters run only on the large scenes; the 390 px page scrolls without errors in Chromium.

Keep these cheap: two octaves of turbulence at most, filter regions close to the object, and no animated filters. The 390 px page must scroll smoothly on a mid-range Android.

### Background palette: B "Sky blue" (chosen)

The product owner chose palette B, "Sky blue", from three options (A Morning paper, B Sky blue, C Garden). The palette switcher and the other two palettes have been removed. Light: a pale sky page (`#EEF5FB`) with lilac and butter washes and a deep twilight-blue band. Dark: **Soft charcoal** (the product owner's choice), a warm near-black page (`#18181D`) with charcoal surfaces and a near-black band. The palette sets only the background, surface, wash and band tokens; brand colours and the characters are unchanged. Text meets 4.5:1 in light and dark.

## Sign-in

**Sign in** opens a dialog (`<dialog>`, focus trapped, Escape closes) with the identifier-first flow: work email → password or SSO → two-step → **Choose a school** when there are several → "Opening {school}…" and a redirect to `/app`. `/sign-in` is the same flow as a full page (used by links, by `/app` when signed out, and when JavaScript has not loaded). `/#signin` opens the dialog. The flow, endpoints and errors are specified in [05](05-auth-tenancy-rbac.md#staff-portal-quad-educom). Parents are told "Parents: use the Quad app" with store badges.

## Demo requests

| Item | Specification |
|---|---|
| Form | Your name, Work email, School, Students (Under 300 / 300–1,000 / 1,000–2,500 / More than 2,500), Curriculum (Cambridge, Edexcel, IB, Sri Lankan national, Other), plus Country (default Sri Lanka). A Cloudflare Turnstile widget (invisible unless challenged). A note: "We'll only use this to arrange your demo." with a link to the privacy policy |
| Validation | Client and server share the Zod schema `DemoRequest` in `packages/contracts`: name and school 2–120 characters, valid email, students band and curriculum from the lists. Errors in place: "Add your name and your school." / "Enter a work email like name@school.lk." |
| Endpoint | `POST /api/v1/public/demo-requests` — no session, no tenant (D16). Verifies the Turnstile token with `TURNSTILE_SECRET_KEY`; rate limit **5 per hour per IP** (Redis) and WAF rules; a hidden honeypot field; returns `202` with no body detail either way |
| Storage | Platform table `platform_leads` (no `tenant_id`; columns in [04](04-data-model.md#platform-no-tenant_id)) with `source = landing`, `status = new`, and a hashed IP and the user agent for abuse checks. A second request from the same email within 24 hours updates the existing lead |
| Notifications | A `demo-request-received` job emails `sales@quad-edu.com` (`SALES_INBOX`) with the details and a console link, and sends the requester a short confirmation email. |
| Success state | The form is replaced by "Thank you. We'll email you within one working day to find a time." (`role="status"`) |
| Console | **Leads** in the console ([07](07-platform-console.md)): list with status filter and search, owner, notes, status changes (audited in `platform_audit`), and **Convert to school**, which opens the new-school wizard prefilled with the school name, country and curriculum and links `converted_tenant_id` |
| Retention | Leads that never convert are deleted 24 months after the last update; anyone can ask for deletion through `privacy@quad-edu.com` |

## Legal pages

Plain-English pages written in MDX in `apps/staff/content/legal/`, each with a "Last updated" date and a version. Material changes are emailed to school admins 30 days ahead.

| Path | Content |
|---|---|
| `/legal/terms` | Terms of service between Quad and the school (the customer); acceptable use; parents and relatives use Quad under the school's agreement |
| `/legal/privacy` | Privacy policy: Quad as processor for school data and controller for site visitors and demo requests; what is collected in each app; residency in `ap-south-1` and the sub-processors that work outside it (D21); retention ([16](16-security-privacy.md#data-protection)); rights and how to ask; contact `privacy@quad-edu.com` |
| `/legal/dpa` | Data processing agreement for schools (Sri Lanka PDPA, GDPR-style clauses for EU/UK schools): processing instructions, security measures, breach notice within 72 hours, sub-processor change notice 30 days ahead, deletion and return at end of contract, backups age out within 35 days |
| `/legal/subprocessors` | The table below, with the date it last changed and a form to subscribe to changes |
| `/legal/cookies` | Cookie notice: strictly necessary cookies only (session `__Host-` cookie, CSRF, `quad_theme`, `quad_last_school`, Turnstile); no tracking cookies, so no consent banner |

### Sub-processors (D21)

| Sub-processor | Purpose | Data | Location |
|---|---|---|---|
| Amazon Web Services | Hosting, database, storage, email (SES) | All school data; email address and message content for email | India (`ap-south-1`); SES sends from the same region; backup snapshots copied to Singapore (`ap-southeast-1`) |
| Anthropic | Ask Quad answers (schools can turn Ask Quad off) | The question and the tool results needed to answer it; never safeguarding or medical data. No training on the data; zero retention where available | United States |
| Google Firebase (FCM) | Push notifications | Device push token and notification title and text | Global |
| Sentry | Error tracking | Error details with personal data scrubbed | United States or EU (chosen at setup) |
| Notify.lk | SMS in Sri Lanka | Phone number and SMS text | Sri Lanka |
| Twilio | SMS outside Sri Lanka | Phone number and SMS text | United States |
| Cloudflare (Turnstile) | Captcha on the demo form | IP address and browser signals for the check | Global |
| Grafana Labs | Metrics, traces and logs (no personal data) | Technical telemetry with tenant ids | Chosen region nearest `ap-south-1` |
| Plausible Analytics | Landing-page visit counts (public site only) | No cookies, no personal data | EU |
| PayHere, Stripe | Card payments — contracted by each school directly (D20), listed for transparency | Payer name, email, amount | Sri Lanka; global |

## SEO

- `<title>`: "Quad – School management built around the child". Meta description from the hero lede (≤ 155 characters). One `<h1>` per page.
- Open Graph and Twitter cards: `og:title`, `og:description`, `og:image` (1200 × 630, generated at build from the hero orbit in light theme, `/og/landing.png`), `og:url`, `twitter:card=summary_large_image`.
- `canonical` on every public page (`https://quad-edu.com/…`); `www` redirects.
- `/sitemap.xml` lists `/`, `/sign-in` and the legal pages. `/robots.txt` allows `/` and `/legal/`, disallows `/app/`, `/api/`, `/p/`. Staging sends `X-Robots-Tag: noindex` and a disallow-all robots file.
- Structured data (JSON-LD): `Organization` (name, logo, contact) and `SoftwareApplication` (EducationalApplication, operating systems Web, iOS, Android).
- `lang="en"`, `hreflang` added when other languages ship.

## Analytics

Plausible Analytics (cookie-less, no personal data), loaded only when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set and only on public pages, never under `/app`. Events: `Sign in opened`, `Demo requested` (no form values), `Section viewed` for the circle section and the band. If a cookie-based tool is ever added, a consent banner must ship with it first.

## Performance budget

| Metric (landing route, mid-range Android on 4G, Lighthouse mobile) | Budget |
|---|---|
| LCP | < 2.5 s |
| CLS | < 0.05 |
| INP | < 200 ms |
| JavaScript (gzip, everything the route loads) | < 150 KB |
| Total transfer before scroll | < 600 KB |

How: static HTML; the orbit and ticker in one small client component; Turnstile and the sign-in dialog loaded on first interaction; illustrations inline as static SVG with a fixed `viewBox` (no layout shift, no image requests); fonts self-hosted with `next/font` (Figtree variable and the Fraunces italic subset, `font-display: swap`, the accent font preloaded only for the hero heading). A Lighthouse CI check in `pnpm verify` fails the build over budget, and a Playwright visual test covers the landing page at 1440 and 390 in light and dark (animations off).

## Accessibility

WCAG 2.2 AA, as in [03](03-design-system.md#accessibility): skip link to main content; landmarks (header, nav, main, footer); every section labelled by its heading; the orbit as one labelled image with a text equivalent; the ticker polite and not focusable; decorative illustrations `aria-hidden`; the menu button reports `aria-expanded`; the sign-in dialog returns focus to the button that opened it; the form has visible labels and errors linked with `aria-describedby`; dark-band text meets 4.5:1; all motion stops with `prefers-reduced-motion`. axe reports zero serious or critical issues.

## Design tokens to add

The landing page uses tokens that [03](03-design-system.md) must define in `packages/tokens` (light and dark), so the page uses Tailwind utilities only:

| Token | Light | Dark | Used for |
|---|---|---|---|
| `font-accent` | "Fraunces", Georgia, serif — italic 500/600 | same | One or two words in headings on public pages only (`.serif` in the prototype). Not used in the apps |
| `band` | `#1F2559` | `#0D0E22` | Circle day band background |
| `band-2` | `#2A3170` | `#181A38` | Band cards and illustrations |
| `band-ink` | `#F3F2FB` | `#F3F2FB` | Band headings |
| `band-ink-2` | `#C9C6EC` | `#B8B6DC` | Band body text |
| `band-line` | `#3A4285` | `#2E3260` | Band dividers and timeline |
| `band-tag-teal`, `band-tag-coral`, `band-tag-amber`, `band-tag-lilac` | background / text pairs from the prototype tags (`#1D4F4A`/`#9BEADF`, `#5A2430`/`#FFC3BC`, `#5A4317`/`#FFDDA1`, `#3A3170`/`#D9D2FF`) | same | Step tags in the band |
| `heat-0` … `heat-3` | coral 30%, teal 30%, teal 60%, teal on surface | computed the same way on the dark surface | Leaders heatmap cells and key |
| `heat-ink` | `#1C1B2E` | `#000000` | Numbers on the `heat-2` and `heat-3` cells (white or `ink` on teal 60% misses 4.5:1 on the dark surface) |
| `coral-ink` | `#C23A33` | `#FF8F84` | Coral text on public pages (eyebrows, links, the hero accent word) and the primary button fill in light mode (`#C23A33` in both themes for buttons and the hero name tag), so coral text and white-on-coral meet 4.5:1 |
| `wash-1`, `wash-2` | `#E8E3FA` (lilac), `#FAF0C8` (butter) | `#24232C`, `#2C2A24` | Section washes (hero, the circle section, the whole-school section) and scene backgrounds |

**Palette B tokens (chosen).**

| Token | Light | Dark |
|---|---|---|
| `bg` | `#EEF5FB` | `#18181D` |
| `surface` | `#FFFFFF` | `#222228` |
| `surface-2` | `#E4EDF7` | `#2A2A31` |
| `line` | `#D2DEEC` | `#36363F` |
| `band` | `#1A2A5E` | `#0F0F13` |
| `band-2` | `#24387A` | `#1D1D23` |
| `band-line` | `#34498F` | `#33333C` |
| `band-ink-2` | `#CDD5F2` | `#D0CFCA` |
| `ink`, `ink-2`, `ink-3` | app values | `#F3F2EE`, `#CFCDC6`, `#9C9A93` |
| `coral-soft`, `amber-soft`, `teal-soft`, `lilac-soft` | app values | `#3A2526`, `#342B1D`, `#1C302E`, `#2A2638` |

**Watercolour pigments** (`wc-*`, light / dark): `wc-paper` `#F4F1EA` / `#1F1F25`; `wc-peach` `#E8B79C` / `#4E4550`; `wc-apricot` `#F0C899` / `#7A5A58`; `wc-sky` `#9CBAD5` / `#33384A`; `wc-lilac` `#B7A8D4` / `#4A4466`; `wc-teal` `#5F9C95` / `#2E5250`; `wc-sea` `#3F8783` / `#2A4244`; `wc-ochre` `#D29A4C` / `#8C6B3C`; `wc-olive` `#8B8F52` / `#3F4234`; `wc-charcoal` `#4A4850` / `#0E0E12`; `wc-rose` `#D98B7C` / `#8A5458`; `wc-roof` `#C4673F` / `#6E3A30`; `wc-white` `#FBFAF5` / `#C4C2BC`; `wc-window` `#F5C15A` / `#FFD47C`; `wc-skin` `#B67C56` / `#94653F`; `wc-hair` `#3A2B2A` / `#1A1216`; `wc-uniform` `#FDFCF8` / `#D9D7D0`; and `wc-blend` (`multiply` / `normal`). In the build they live under `public-site` alongside the illustration tokens.

Every illustration uses only the `wc-*` watercolour pigments below (skin, hair, uniform white and the earthy colours), plus white for highlights and the brand mark's own colours in the Quad logo. People are drawn by one shared figure (`wfig`) with options for clothes, hair, glasses, plaits and a school tie; Amaya has one dedicated figure in her school kit, front and back view, used everywhere she appears.

## Tests

- Playwright: the landing page renders all sections; the menu button works by keyboard at 390 px; the sign-in dialog journeys (one school, two-school picker) from [17](17-testing-quality.md); the demo request journey (valid submit → `platform_leads` row, sales email in Mailpit, lead in the console); validation errors; reduced motion stops animation.
- API: demo request happy path, validation, captcha failure, rate limit (6th request in an hour is refused with 429), honeypot.
- Lighthouse CI budget and the visual test above.
