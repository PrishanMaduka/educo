# 19 Public site

The public landing page at `https://quad-edu.com/`, the sign-in entry, demo requests and the legal pages. Reference: `design/landing.html` (flat, colourful avatars on a navy and cream page, with a view switch for schools and parents; reference renders in `docs/screenshots/landing/`, `landing-*` for the whole page and `section-*` for each section). Built in **M1b** ([18](18-delivery-plan.md)).

## Where it lives

- `apps/staff`, route group `(public)`: `/`, `/about`, `/security`, `/sign-in`, `/legal/*`, the `/p/*` "Get the Quad app" fallback, `/sitemap.xml`, `/robots.txt` and the `/.well-known/*` app-link files ([02 → Paths](02-architecture.md#paths-on-quad-educom-d14-d15)).
- Public pages are statically rendered (Next.js static generation) and served through CloudFront. Until the AWS deploy exists, a static export of `/`, `/about`, `/security`, the legal pages and `/sitemap.xml` is served from GitHub Pages instead (D30, [Pre-launch site](#pre-launch-site)). They load no signed-in code: the staff portal bundle starts under `/app`.
- Quad-branded only. No school branding appears on public pages (the school is not known yet). The sample schools in the pictures ("Greenfield International", "St. Clare's Academy") are fictional.
- A signed-in visitor who opens `/` sees the landing page with **Open {school}** in place of **Sign in**, linking to `/app`.

## Page structure

Copy comes from the prototype; strings live in `packages/contracts/i18n/en.json` under `public.*`. The page speaks to an international audience. The sample people are fictional, and the footer says so: Maya (Year 4) and her circle, her class teacher Ms. Okafor, Coach Tanaka, Nurse Haddad, her mum Priya, her grandmother Nani Asha (an invited relative in Lisbon) and her dad Daniel, plus Leo (Year 9) and his class teacher Mr. Abara.

The page has two **views**, chosen with the switch in the top bar: **I run a school** (the default) and **I'm a parent**. Most sections have a school and a parent version; the table says what each shows. The accent colour follows the view: lime for schools, pink for parents.

| # | Section | School view | Parent view | Behaviour |
|---|---|---|---|---|
| 1 | **Top bar** | Skip link; the Quad logo (home); section links (The circle, Wellbeing, Modules) and **Sign in**; the view switch; the theme button; **Book a demo** | The same, with **In the app** in place of Modules, **Get the app** (to the hero's app actions, `#getapp`) in place of Sign in, and **Ask your school** in place of Book a demo. Staff sign-in appears only in the school view | Sticky, navy with a blur, above 760 px. At 1100 px and below the section links, Sign in (or Get the app) and the theme move into a **Menu** button (`aria-expanded`, Escape closes). At 760 px and below the bar is not sticky, and the view switch takes a full row under the logo |
| 2 | **Hero** | Kicker "School management, built around the child"; heading "Every child has a *circle.*" (the accent word on an accent-coloured pill); lede; **Book a demo** and **How the circle works** (to `#circle`); "Already on Quad? **Sign in to your school**"; three stats (1 app for every family; 4 relatives invited by parents; 18:00–07:00 quiet hours for teachers). The **stage** beside the text (below it at narrow widths): a phone showing Maya's day at Greenfield International, with Maya's face inside a day ring and a tab bar (Today, Circle, Ask, Pay), and her six people around it as avatars with name pills | The parent view presents the Quad app. Kicker "The Quad app for parents, on iPhone and Android"; "Hear the *good* stuff first, in the app."; a lede on the app; **Get the Quad app ↓** and **Ask your school about Quad** (to the parent form, `#demo`); self-drawn **App Store** and **Google Play** "Coming soon" badges (neutral SVG, not the stores' artwork); "Already have the app? Open it on your phone." (no sign-in); the stats with parent captions (for every child, at any Quad school; you can invite, wherever they live; calm evenings for everyone). The stage shows **two phones**: Today (Maya's day, with a "Tonight" idea card) and a second, tilted phone with Ask Quad (a question and an answer with its source), a fee to pay and "Nani Asha joined" (Family), with four labels around them (Today, as a story; Moments and thank-yous; Ask Quad; Pay fees) that hide below 560 px | Every 3.4 s a message lands on top of the feed (the phone shows the newest three; it opens with two). In the school view the sender lights up and a star or heart flies from them to the phone on an arc; in the parent view the circle is hidden, so nothing lights up or flies. Doodles (stars, a kite, a cloud, a heart, a pencil) float around the stage. The stage is one `role="img"` whose label describes the view's picture; a visually hidden polite live region says each message as it lands ("Nani Asha loved it: …"). **Get the Quad app** does not link to a store: it toggles a status note (`aria-expanded`, `aria-controls`): "Coming soon. The Quad app isn't in the App Store or Google Play yet. When your school joins Quad, it will send you an invite to download it." With reduced motion nothing moves and the phone shows the first messages only |
| 3 | **Ticker** | A tilted lime band of good news ("Maya painted the canteen mural", "Grandma loved it, from Lisbon", "Leo's back on track in History", …) with doodles between | Same | Scrolls sideways without end; still with reduced motion. Decorative (`aria-hidden`): the same moments are told in the sections below |
| 4 | **One week, round the circle** (`#circle`) | Eyebrow "The Quad Circle"; heading; a lede on using what the school already records; four coloured cards in a row (sky, pink, orange, lime), each with a small picture, a numbered place (At school, At home, Together, Back at school), a title and one line: (1) A moment at school; (2) Home says thanks; (3) Try it at home; (4) The teacher sees it, at 07:00 after quiet hours. Under them "Every week, round again" with a turning arrow | A parent lede ("Everyone who looks after your child, in one place…") and the cards told from home: A moment arrives (in your app, for your family only); You say thanks (In the app); Try it at home; The teacher sees it (at 07:00, so evenings stay calm) | The cards are an `<ol>` in reading order; the pictures are `aria-hidden`. Cards lift a little on hover (not with reduced motion). Wraps to two columns, then one. The relatives, photo consent, quiet hours and family pulse rules follow [12](12-moments-messaging.md#quad-circle) |
| 5 | **Wellbeing, early** (`#wellbeing`) | A navy band (a bordered card in dark mode): tag "Wellbeing, early"; "Quad notices the child who's drifting."; a paragraph ending "Try it."; the **Leo card**: Leo's face (worried), "Year 9 · History", a "Needs a conversation" tag, eight weekly bars of his History marks with the last four dipping, a sentence on why ("down 14 points this term, with two missed submissions"), and **Start a support plan** with Mr. Abara, his class teacher | Tag "Every Friday"; "Watch a week of good news grow." ("Every Friday the app brings it together…"); the weekly recap card "A week with Maya": a plant that grows seven leaves (one per moment), three counts (7 moments, 5 of 5 days in school, 2 tried at home), skill chips (Curiosity, Kindness, Persistence) and a weekend idea | **Start a support plan** (a toggle, `aria-pressed`) turns the tag to "Back on track", raises the last bars, smiles Leo's face, changes the sentence ("Six weeks later: … Mr. Abara checks in every Friday") and the button to **Replay**; the sentence is a polite live region. Bars grow in when the card first scrolls into view. Sample data only, no API. With reduced motion the bars and face change without transitions |
| 6 | **Modules and features** (`#more`) | "Everything a school runs, under one roof." with a lede saying year groups follow the curriculum ("Year 4, Grade 4 or Form 1"), then the eight modules (Admissions, Students, Attendance, Timetable & cover, Exams & reports, Pastoral care, Fees & finance, Communication) as a list with an icon and one line each. Then three feature cards: **Story first** (a morning greeting for the principal, Ms. Nakamura, with the count of students in), **Ask Quad** (a question typed into a search line and a short answer naming its sources), **Your school's brand** (two sample school apps, Greenfield International and St. Clare's Academy, wearing their own colours) | "Everything you need, in one app." (the app for iPhone and Android, wearing the school's name, logo and colours; every child under one login), then six app feature cards in three columns, each with a big label, an icon, a kicker, a title and a line: Today (see their day unfold); Circle (hear the good stuff); Family (bring family in); Quiet (calm evenings); Pay (pay in the app); Kids (every child, one login) | The Ask Quad answer types itself letter by letter and repeats (the whole answer shown, still, with reduced motion; the full text is always available to screen readers). Grids wrap to one column at narrow widths |
| 7 | **Kind and safe** | A navy card (bordered in dark mode), "Kind and safe by design": four points with an icon each: families choose who's in (up to four relatives, moments only, removable in one tap); photos only with permission (class, family only or no photos); quiet hours (18:00 to 07:00 and weekends; urgent safety alerts still go through); good news, not records (health and safeguarding never enter the Circle; data hosted in your region) | Titled "You decide who's in", same points | Static |
| 8 | **Demo** (`#demo`) | A rounded panel in the accent colour (lime): "See your school's circle in 30 minutes." with a lede, a row of avatars and doodles, and the school form on a navy card ([Demo requests](#demo-requests)) | The panel turns pink: "Want this at your child's school?", a parent lede ("We never contact other families"), "The Quad app for parents is coming soon to iPhone and Android." with the two store badges (navy), and the parent form | Both forms are rendered; the view shows one. Below 760 px only the first doodle stays. See [Demo requests](#demo-requests) and [Pre-launch site](#pre-launch-site) |
| 9 | **Footer** | The logo (to the top; home on the other public pages); links to About, Security & trust, Privacy, Terms and Sub-processors (D41); Contact `support@quad-edu.com`; "Sample school and families are fictional."; © Quad | Same | Links to the DPA, Cookies and Status (`status.quad-edu.com`) are added when those pages exist. Prototype links to other prototypes are not carried over |

### The view switch

- A two-button group ("Choose your view": **I run a school**, **I'm a parent**) with `aria-pressed`, in the top bar.
- The view is `data-view` on `<html>` (`school` or `parent`). Both versions of every section are in the static HTML and the one for the other view is hidden with CSS (`view-parent:` and `view-school:` variants), so switching needs no request and search engines see the school view.
- It is remembered with `?view=parent` in the address (written with `history.replaceState`, so links can be shared and a reload keeps it) and in `localStorage` (`quad-site-view`). A small inline script in the public layout sets `data-view` before the first paint: the address first, then the stored choice, else `school`. `?view=school` removes the parameter.
- The switch's pressed look comes from `data-view` in CSS, not from React state, so the right button looks pressed from the first paint and never changes colour at hydration.
- The accent (`site-accent`) is lime for schools and pink for parents.

### People and pictures

- **Avatars** are flat and round: a solid circle in the person's role colour (teachers sky, care staff lime, family pink, children orange) with a soft highlight; shoulders in the person's own clothes (a school uniform with a tie for Maya and Leo, a shirt and tie for Mr. Abara, a coach's jacket and whistle, nurse's scrubs, a cardigan, a collar, a necklace, staff lanyards); a head shaped per person with a darker side and shaded neck; hair with a highlight (short, bun, long, pigtails, curly, grey bun, cap, beard, hijab); eyes with catchlights that blink at staggered times; brows; soft cheeks; glasses or earrings where they wear them; and a mood (happy, laughing or worried). Shading is the same colour mixed darker or lighter (`color-mix`), so the art stays on the tokens. One `Face` component draws everyone from `_art/face-markup.ts`; `_art/people.ts` says how each person looks, and each head's shape is defined once by id. Names come from `public.people.*`.
- **Doodles** (star, heart, sun, kite, cloud, pencil) and the small scenes on the circle cards and the Wellbeing card are flat SVG in the same palette.
- Everything is a server component rendering static inline SVG, using only `site-*` colour tokens. Client code exists only where the page reacts: the hero stage, the Leo card, the typed Ask Quad answer, the view switch, the theme button, the menu, the coming-soon note, the Get the app note and the demo forms. Decorative pictures are `aria-hidden`.
- No product screenshots (D29).

### Light and dark

Light mode is the prototype's: a navy hero and top bar, then a cream (`paper`) page with white cards, a navy Wellbeing band and a navy Kind and safe card; the ticker is lime and the demo panel takes the accent colour. Dark mode (the theme button, or the system setting until the visitor chooses) deepens the hero to a darker navy, turns the page navy, makes cards and the band a lighter navy with a thin border, and keeps the vivid colours (lime, pink, sky, orange) unchanged. The theme button and the stored choice (`quad-theme` in `localStorage`) are shared with the apps ([03](03-design-system.md)). Text meets 4.5:1 in both.

### Logo

The Quad logo is four rounded petals (sky, pink, lime and orange) around a centre, with the "quad" wordmark. The sources are `design/brand/*.svg`; the apps use `QuadMark` and `QuadLogo` from `@quad/tokens/logo` (variants `color`, `white`, `mono` and `theme`, which reads the site colours and draws the wordmark in the current text colour). The favicons of the staff and console apps and the parent app's brand assets are copies of the same art.

## Pre-launch site

Until schools go live, the build-time flag `NEXT_PUBLIC_QUAD_PRELAUNCH=true` (D30) builds the page for GitHub Pages:

- Every **Sign in** entry (top bar, menu, "Sign in to your school") opens a small **Coming soon** note (a modal `<dialog>`, Escape closes, focus returns) that says sign-in opens when schools go live and offers **Book a demo**, which closes the note and moves focus to the demo form. Without the flag, Sign in links to `/app`.
- The demo forms open the visitor's email app with a `mailto:support@quad-edu.com` message, with or without the flag, until the demo endpoint ships ([Demo requests](#demo-requests)).
- The export is a second Next.js root, `apps/staff/site-export`, that re-exports the public layout, the landing page, the About, Security & trust and legal pages, the sitemap and the 404 page with `output: 'export'` (no trailing slash: `/about` is `about.html`, `/legal/privacy` is `legal/privacy.html`, which GitHub Pages serves without the extension). `pnpm --filter @quad/staff build:export` builds it into `site-export/out` with `CNAME` and `robots.txt` and checks that every public page is there and nothing from the portal is; `e2e:export` runs the landing and public-page journeys against it. `.github/workflows/pages.yml` publishes it on a push to `main`.

## Sign-in

**Sign in** opens a dialog (`<dialog>`, focus trapped, Escape closes) with the identifier-first flow: work email → password → two-step → **Choose a school** when there are several → "Opening {school}…" and a redirect to `/app`. `/sign-in` is the same flow as a full page (used by links, by `/app` when signed out, and when JavaScript has not loaded). `/#signin` opens the dialog. The flow, endpoints and errors are specified in [05](05-auth-tenancy-rbac.md#staff-portal-quad-educom). Parents are told "Parents: use the Quad app" with store badges. Until launch, Sign in opens the coming-soon note instead ([Pre-launch site](#pre-launch-site)).

## Demo requests

| Item | Specification |
|---|---|
| School form | Your name, Work email, School, Country (optional), Students (Under 300 / 300–1,000 / 1,000–2,500 / More than 2,500), Curriculum (IB, Cambridge, Edexcel, American, National, Other). Button **Request a demo →**. A note: "We'll only use this to arrange a walkthrough." A Cloudflare Turnstile widget (invisible unless challenged) arrives with the endpoint |
| Parent form ("tell my school") | Your name, Your email, Your child's school, City (optional), A note to the school (optional, up to 1,000 characters). Button **Send to my school →**. Quad passes the request on to the school; it never contacts other families |
| Validation | Client and server share the Zod schemas `DemoRequestSchema` and `SchoolIntroRequestSchema` in `packages/contracts` (`demoRequestProblem` and `schoolIntroProblem` give the first problem): name and school 2–120 characters, a valid email, the students band and curriculum from the lists. Errors in place, linked with `aria-describedby`: "Add your name and your school." (parents: "…your child's school.") / "Enter a work email like name@school.org." (parents: "Enter an email like name@example.com.") |
| Until the endpoint (now) | A valid request opens a `mailto:support@quad-edu.com` message: subject "Demo request: {school}" or "Quad for {school}", and a body with a greeting and one "Label: value" line per filled field (RFC 6068 encoding, CRLF line breaks). The form is replaced by "Your email app should open with your request ready to send." (`role="status"`), with the address as a link in case it doesn't open, and **Send another** |
| Endpoint | `POST /api/v1/public/demo-requests` — no session, no tenant (D16). Verifies the Turnstile token with `TURNSTILE_SECRET_KEY`; rate limit **5 per hour per IP** (Redis) and WAF rules; a hidden honeypot field; returns `202` with no body detail either way. Parent requests use the same endpoint; how they are stored and passed on to the school is decided when the endpoint is built |
| Storage | Platform table `platform_leads` (no `tenant_id`; columns in [04](04-data-model.md#platform-no-tenant_id)) with `source = landing`, `status = new`, and a hashed IP and the user agent for abuse checks. A second request from the same email within 24 hours updates the existing lead |
| Notifications | A `demo-request-received` job emails `sales@quad-edu.com` (`SALES_INBOX`) with the details and a console link, and sends the requester a short confirmation email. |
| Success state (with the endpoint) | The form is replaced by "Thank you. We'll email you within one working day to find a time." (`role="status"`) |
| Console | **Leads** in the console ([07](07-platform-console.md)): list with status filter and search, owner, notes, status changes (audited in `platform_audit`), and **Convert to school**, which opens the new-school wizard prefilled with the school name, country and curriculum and links `converted_tenant_id` |
| Retention | Leads that never convert are deleted 24 months after the last update; anyone can ask for deletion through `support@quad-edu.com` (D42) |

## About and Security & trust (D41)

Two pages for schools and reviewers who want to know who is behind Quad and how it protects data. Same look as the landing page: the top bar (links to About, Security and Privacy, the theme button, Menu at 1100 px and below, and **Book a demo** to `/#demo`; no view switch or Sign in), a navy header with the one `<h1>` and a plain story sentence, then sections on the cream page at about 65 characters a line, each heading a link to its own anchor, then the footer. Server components only; the client code is the top bar's theme button and menu.

| Path | Content |
|---|---|
| `/about` | What Quad is (the staff portal, the parent app, the platform console, Ask Quad); who it is for; why; the stage ("In development. We're preparing pilots with schools."); the founder (name, role and a short biography); where Quad is (Sri Lanka, for schools internationally) with the company's legal details; contact `support@quad-edu.com` (the one public address for support, privacy and security, D42) and a link to the demo form |
| `/security` | Only what the spec makes true by design ([16](16-security-privacy.md)): tenant isolation with forced row-level security and an app role that cannot bypass it; TLS and encryption at rest, with field-level encryption for sensitive fields; Argon2id, two-step sign-in (TOTP), lockout and signed links; safeguarding and medical data behind sensitive keys with every view logged; least privilege, audit logs and logged support access; Mumbai region and backups; responsible AI for Ask Quad (read-only, permission-checked tools, answers only from the school's records with sources, never acts by itself, never sees safeguarding or medical data, Claude by Anthropic through the API with no training on the data, schools can turn it off). No certifications, audits or uptime figures; the penetration test is "planned". "Report a security issue": `support@quad-edu.com` (D42) |

**Company facts** (legal entity name, registration number, registered address, founded year, country, founder name, role and biography, governing law and courts, the liability cap, and the contact addresses) live in one typed module, `apps/staff/src/app/(public)/_lib/company.ts`, which every page, the footer and the demo forms read. Values the owner has not confirmed are placeholders that say "to be confirmed"; `unconfirmedFields()` lists them and a unit test keeps the facts from being written anywhere else.

## Legal pages

Plain-English pages written as typed TSX content in `apps/staff/content/` (`about.tsx`, `security.tsx`, `legal/privacy.tsx`, `legal/terms.tsx`, `legal/subprocessors.tsx`; D41: not MDX, which would add a compiler and loader to both Next.js roots, while TSX type-checks the company facts and needs no new dependencies). Each is an `ArticleContent` (path, title, story sentence, meta description, sections) rendered by `ArticlePage`; legal pages carry a "Last updated" date and a version, and the longer pages list their sections under "On this page". The text is English only, like the legal text it is; the page chrome comes from `en.json`. The terms carry a source comment that they need legal review before launch. Material changes are emailed to school admins 30 days ahead.

| Path | Content |
|---|---|
| `/legal/terms` | Terms of service between Quad and the school (the customer); acceptable use; parents and relatives use Quad under the school's agreement |
| `/legal/privacy` | Privacy policy: Quad as processor for school data and controller for site visitors and demo requests; what is collected in each app; residency in `ap-south-1` and the sub-processors that work outside it (D21); retention ([16](16-security-privacy.md#data-protection)); rights and how to ask; contact `support@quad-edu.com` (D42) |
| `/legal/dpa` | Data processing agreement for schools (Sri Lanka PDPA, GDPR-style clauses for EU/UK schools): processing instructions, security measures, breach notice within 72 hours, sub-processor change notice 30 days ahead, deletion and return at end of contract, backups age out within 35 days |
| `/legal/subprocessors` | The table below, with the date it last changed and the line "Email support@quad-edu.com to be told about changes" (the address as text; a subscribe form may come with the demo endpoint). A table on wide screens, one card per sub-processor at 760 px and below |
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
- Open Graph and Twitter cards: `og:title`, `og:description`, `og:image` (1200 × 630, generated at build from the hero in light theme, `/og/landing.png`), `og:url`, `twitter:card=summary_large_image`.
- `canonical` on every public page (`https://quad-edu.com/…`); `www` redirects.
- `/sitemap.xml` (`src/app/sitemap.ts`) lists `/`, `/about`, `/security` and the legal pages, and `/sign-in` once it exists. The pre-launch `robots.txt` allows them and names the sitemap. `/robots.txt` allows `/` and `/legal/`, disallows `/app/`, `/api/`, `/p/`. Staging sends `X-Robots-Tag: noindex` and a disallow-all robots file.
- Structured data (JSON-LD): `Organization` (name, logo, contact) and `SoftwareApplication` (EducationalApplication, operating systems Web, iOS, Android).
- `lang="en"`, `hreflang` added when other languages ship.

## Analytics

Plausible Analytics (cookie-less, no personal data), loaded only when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set and only on public pages, never under `/app`. Events: `Sign in opened`, `Demo requested` (no form values), `Section viewed` for the circle and Wellbeing sections. If a cookie-based tool is ever added, a consent banner must ship with it first.


## Performance budget

| Metric (landing route, mid-range Android on 4G, Lighthouse mobile) | Budget |
|---|---|
| LCP | < 2.5 s |
| CLS | < 0.05 |
| INP | < 200 ms |
| JavaScript (gzip, everything the route loads) | < 150 KB |
| Total transfer before scroll | < 600 KB |

How: static HTML; small client components only where the page reacts (see [People and pictures](#people-and-pictures)); Turnstile and the sign-in dialog loaded on first interaction; pictures inline as static SVG with a fixed `viewBox` (no layout shift, no image requests); animation with CSS keyframes, and one `requestAnimationFrame` loop for the hero stage (none with reduced motion). The page font is **Bricolage Grotesque** (variable, 400–800, latin), self-hosted with `next/font/local` from `(public)/_fonts/` with its OFL licence and `font-display: swap`; the file is Google Fonts' Linux and Windows build, because the macOS build that `next/font/google` serves lacks hinting and sets text about 3% wider on Linux than the prototype. The apps keep Figtree. A Lighthouse CI check in `pnpm verify` fails the build over budget, and a Playwright visual test covers the landing page at 1440 and 390 in light and dark (animations off).

## Accessibility

WCAG 2.2 AA, as in [03](03-design-system.md#accessibility): skip link to main content; landmarks (header, nav, main, footer); every section labelled by its heading; one `<h1>` whose accessible name is the plain sentence (the highlighted pill is visual only); the hero stage as one labelled image with a polite live region for each message; the ticker and decorative pictures `aria-hidden`; the view switch and the support-plan button report `aria-pressed`; the menu button reports `aria-expanded`; the sign-in dialog and the coming-soon note return focus to the button that opened them; the forms have visible labels and errors linked with `aria-describedby`; text meets 4.5:1 in light and dark; everything works at 390 px; all motion stops with `prefers-reduced-motion`. axe reports zero serious or critical issues in both views, at 1440 and 390, light and dark.

## Design tokens to add

The landing page has its own palette in `packages/tokens/src/public-site.ts`. `pnpm tokens:build` turns it into `--quad-site-*` CSS variables (light, and dark under the dark theme) and `site-*` Tailwind colours (`bg-site-navy`, `text-site-page-ink`), so the page uses Tailwind utilities only. They are for public pages; the apps and the parent app's `QuadColors` do not use them. The SVG art reads the same variables (`var(--quad-site-…)`), so there is no raw hex outside the token source.

**Brand colours** (same in light and dark):

| Token | Value | Used for |
|---|---|---|
| `navy`, `navy-2`, `navy-line`, `navy-border` | `#101632`, `#1D2550`, `#2F3870`, `#3A4378` | Brand navy, raised navy surfaces (form fields, the hero kicker), lines and borders on navy |
| `paper` | `#F7F5F0` | Cream page and text on navy |
| `lime`, `pink`, `sky`, `orange` | `#C8F169`, `#FF6FAE`, `#59C3FF`, `#FF9B45` | The four petals; buttons, accents, cards, doodles |
| `on-vivid` | `#101632` | Text on lime, pink, sky and orange |
| `on-navy`, `on-navy-2`, `on-navy-3` | `#F7F5F0`, `#C9CBE0`, `#A9ACC8` | Text on navy: headings, body, small print |
| `phone`, `phone-edge`, `screen-ink-2`, `screen-ink-3`, `screen-track`, `feed-time` | | The hero phone and its feed |
| `tag-bad-*`, `tag-good-*`, `chip-sky-*`, `chip-pink-*`, `chip-orange-*` | background / ink pairs | The Leo tag and the recap chips (each pair meets 4.5:1) |
| `school-green`, `school-maroon`, `pine`, `alert`, `butter`, `pancake`, `pancake-edge`, `peach`, `blush` | | Sample school colours, the Leo bars and the small scenes |
| `skin-1` … `skin-7`, `hair-black`, `hair-dark`, `hair-brown`, `hair-chestnut`, `hair-grey`, `hair-plum` | | Avatar skin and hair (`hair-plum` is the nurse's hijab) |
| `cloth-navy`, `cloth-indigo`, `cloth-teal`, `cloth-blue`, `cloth-plum`, `cloth-sky`, `cloth-line`, `cloth-line-2`, `cloth-trim`, `cloth-cream` | | Avatar clothes and their trims |
| `shade`, `shine-grey`, `brow-grey` | `#1B0F0C`, `#555555`, `#8D8A86` | The colour avatars mix in for shadows, a highlight for dark grey hair, grey brows |

**Theme colours** (light / dark):

| Token | Light | Dark | Used for |
|---|---|---|---|
| `hero-bg` | `#101632` | `#0A0D24` | Hero, top of the page, the document background |
| `nav-bg` | navy at 92% | dark navy at 92% | Sticky top bar (with blur) |
| `page-bg` | `#F7F5F0` | `#0F1330` | The page below the hero |
| `page-ink`, `page-ink-2`, `page-ink-3` | `#101632`, `#3D4263`, `#555A78` | `#F7F5F0`, `#C9CBE0`, `#A9ACC8` | Text on the page |
| `card-bg`, `card-line` | `#FFFFFF`, `#E2E0D8` | `#171D45`, `#2A3266` | Cards on the page |
| `band-bg`, `band-edge` | `#101632`, none | `#161C48`, `#2A3266` | The Wellbeing band and the Kind and safe card |
| `sheet-bg`, `sheet-2`, `sheet-line`, `sheet-ink`, `sheet-ink-2` | cream | navy | The Leo card, the recap card, the coming-soon note |
| `bar-ink` | `#101632` | `#C9CBE0` | Steady bars in the Leo chart |
| `focus` | `#2F6BFF` | `#7FA6FF` | Focus rings |
| `backdrop`, `card-shadow` | | | Dialog backdrop and card shadows |
| `accent` | `lime` | `lime` | Follows the view: `pink` when `data-view="parent"` |

The earlier landing tokens (the watercolour `wc-*` pigments, the `band-*` and `heat-*` tokens and palette B's overrides) are removed.

## Tests

- Unit (Vitest): the avatar markup (tokens only, head shapes, moods, details), the Get the app note, the view bootstrap and URL helpers, the hero feed timing and token flight, the Leo bars, the typed answer, the mail link encoding, the demo forms (both variants: validation, the `mailto` they open, the sent state), the shared demo schemas, and the site tokens (contrast of each text pair in light and dark, the accent per view).
- Playwright (`e2e/public-pages.spec.ts`, desktop and phone, light and dark): each About, Security & trust and legal page has one `<h1>`, its title, description and canonical URL, the navy and cream grounds, no horizontal scroll at 390 px and no serious or critical axe issues; legal pages show "Last updated" and a version; headings link to themselves; the sub-processor list names every row; the footer links every page; Book a demo leads to `/#demo`. Unit tests cover the footer links and the company module.
- Playwright (`e2e/landing.spec.ts`, desktop and phone, light and dark): the story in both views; the view switch, `?view=parent` and reload; the coming-soon note (pre-launch) or the `/app` link; the parent view has no sign-in, Get the app shows the coming-soon note, and the store badges are shown, with no store links; the school and parent forms open the right `mailto`; the Leo card; reduced motion stops the stage and leaves the first live text; the animated stage announces new messages; the menu at 1100 px and below; the theme button; no horizontal scroll at 390 px; axe in both views, light and dark. The same journey runs against the static export (`e2e:export`).
- Later in M1b: the sign-in dialog journeys (one school, two-school picker) from [17](17-testing-quality.md); the demo request journey (valid submit → `platform_leads` row, sales email in Mailpit, lead in the console).
- API (with the endpoint): demo request happy path, validation, captcha failure, rate limit (6th request in an hour is refused with 429), honeypot.
- Lighthouse CI budget and the visual test above. Screenshots of the built page are in `docs/screenshots/landing/app-*.png`, and of the other public pages in `about-1440-light.png`, `security-1440-light.png`, `privacy-390-dark.png`, `subprocessors-1440-dark.png` and `terms-1440-light.png` (`QUAD_SCREENSHOTS=1 pnpm --filter @quad/staff exec playwright test screenshots -g landing`).
