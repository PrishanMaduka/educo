# 19 Public site

The public landing page at `https://quad-edu.com/`, the sign-in entry, demo requests and the legal pages. Reference: `design/landing.html` and the screenshots in `design/landing/`. Built in **M1b** ([18](18-delivery-plan.md)).

## Where it lives

- `apps/staff`, route group `(public)`: `/`, `/sign-in`, `/legal/*`, the `/p/*` "Get the Quad app" fallback, `/sitemap.xml`, `/robots.txt` and the `/.well-known/*` app-link files ([02 → Paths](02-architecture.md#paths-on-quad-educom-d14-d15)).
- Public pages are statically rendered (Next.js static generation) and served through CloudFront. They load no signed-in code: the staff portal bundle starts under `/app`.
- Quad-branded only. No school branding appears on public pages (the school is not known yet).
- A signed-in visitor who opens `/` sees the landing page with **Open {school}** in place of **Sign in**, linking to `/app`.

## Page structure

Copy comes from the prototype; strings live in `packages/contracts/i18n/en.json` under `public.*`. Sample people (Amaya, Dilhani, Ms. Jayasinghe) are fictional and marked as a sample school in the page.

| # | Section | What it shows | Behaviour |
|---|---|---|---|
| 1 | **Top bar** | Quad mark and wordmark; section links (Quad Circle, Why Quad, Your whole school, Apps, Privacy); **Sign in** (ghost) and **Book a demo** (primary) | Sticky with a blur background. At 390 px the section links collapse into a menu button; Sign in and Book a demo stay visible |
| 2 | **Hero** | Eyebrow "School management, built around the child"; heading "Every child has a *circle.*" (the last word in the serif accent); lede; **Book a demo** and **See a day in the circle ↓**; "Already on Quad? **Sign in to your school**"; two fine-print points (curricula; rupees, PayHere and Poya days) | — |
| 3 | **Hero orbit** | An SVG circle: the child in the centre, three family members on the inner ring, seven school people on the outer ring, spokes; moments travel between people as small sparks | One spark every 3.2 s along a curved path. The **ticker** below (`role="status"`, `aria-live="polite"`) says what just happened ("Ms. Jayasinghe shared a moment · Amaya painted the canteen mural · 08:55"), cycling through six sample events. With `prefers-reduced-motion`, no sparks move and the ticker shows the first event only. The SVG has a `<title>` listing the people |
| 4 | **Strip** | Three short claims: one login for every child; story first; your school's name, logo and colours | Wraps to a column at 390 px |
| 5 | **Circle day band** (`#circle`) | Dark band. "One school day in *Amaya's circle*" with seven timed steps (07:42 arrival and day ring, 08:55 moment, 09:10 grandma hearts it, 12:30 people around the child, 18:20 tried at home, 19:30 quiet hours, Friday recap), each with a coloured tag, heading, sentence and a small illustration | Steps reveal on scroll (fade and rise, none with reduced motion). The band foot says families choose who sees photos and nothing about health or safeguarding goes into Circle, with **Book a demo**. The prototype's links to `circle.html` and `parent.html` are not carried over |
| 6 | **For school leaders** | "Is every family *connected?*" with three ticked points and a heatmap: share of families who heard something positive in the last 2 weeks, year group × class, sample data | Static sample data (no API). Cells use the four heat tokens below; the table has row and column headers for screen readers and a key (Fewer … All families) |
| 7 | **Why Quad** (`#different`) | Three cards: Story first, Early warning, Ask Quad | — |
| 8 | **Your whole school** (`#school`) | Eight modules (Admissions, Students, Attendance, Timetable & cover, Exams & reports, Pastoral care, Fees & finance, Communication) with one line each | Says year groups follow the curriculum ("Year 4, Grade 4 or Form 1") |
| 9 | **Inside Quad** (`#apps`) | Staff portal: a browser frame with four tabs (The school today, Early warning, My teaching, Fees & invoicing). Parent app: four phone frames (Home, Moments, People, Learning) with captions | Tabs follow the ARIA tabs pattern (arrow keys move and select). Each screenshot has a light and a dark image; the one matching the current theme shows, and only the light image carries the alt text. Images are lazy-loaded WebP/AVIF with JPEG fallback, stored in `apps/staff/public/landing/`. Screenshots are regenerated from the seeded apps by a Playwright script (`pnpm --filter @quad/staff landing:shots`) once M9b is done; until then the prototype images are used |
| 10 | **Privacy and safety** (`#trust`) | Four points: only your school; families decide; sensitive stays sensitive; local rules (Sri Lanka PDPA, data kept in the region) | Links to `/legal/privacy` and `/legal/subprocessors` |
| 11 | **Demo** (`#demo`) | "Book a 30-minute *walkthrough*" with the form (below) | Replaces the prototype's "nothing is sent" note |
| 12 | **Footer** | Mark, links (Privacy, Terms, DPA, Sub-processors, Cookies, Status → `status.quad-edu.com`, Contact `hello@quad-edu.com`), "Sample school and families are fictional", © Quad | Prototype links to other prototypes are not carried over |

Theme: follows the system setting, with the same toggle pattern as the apps (stored in a `quad_theme` cookie, no server state). Everything works at 390 px with a 16 px gutter and no horizontal scroll.

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

Plausible Analytics (cookie-less, no personal data), loaded only when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set and only on public pages, never under `/app`. Events: `Sign in opened`, `Demo requested` (no form values), `Section viewed` for the band and Inside Quad. If a cookie-based tool is ever added, a consent banner must ship with it first.

## Performance budget

| Metric (landing route, mid-range Android on 4G, Lighthouse mobile) | Budget |
|---|---|
| LCP | < 2.5 s |
| CLS | < 0.05 |
| INP | < 200 ms |
| JavaScript (gzip, everything the route loads) | < 150 KB |
| Total transfer before scroll | < 600 KB |

How: static HTML; the orbit and ticker in one small client component; Turnstile and the sign-in dialog loaded on first interaction; screenshots lazy-loaded with fixed width and height; fonts self-hosted with `next/font` (Figtree variable and the Fraunces italic subset, `font-display: swap`, the accent font preloaded only for the hero heading). A Lighthouse CI check in `pnpm verify` fails the build over budget, and a Playwright visual test covers the landing page at 1440 and 390 in light and dark (animations off).

## Accessibility

WCAG 2.2 AA, as in [03](03-design-system.md#accessibility): skip link to main content; landmarks (header, nav, main, footer); every section labelled by its heading; the orbit as one labelled image with a text equivalent; the ticker polite and not focusable; tabs with roving focus; the sign-in dialog returns focus to the button that opened it; the form has visible labels and errors linked with `aria-describedby`; dark-band text meets 4.5:1; all motion stops with `prefers-reduced-motion`. axe reports zero serious or critical issues.

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

## Tests

- Playwright: the landing page renders all sections; tabs work by keyboard; the sign-in dialog journeys (one school, two-school picker) from [17](17-testing-quality.md); the demo request journey (valid submit → `platform_leads` row, sales email in Mailpit, lead in the console); validation errors; reduced motion stops animation.
- API: demo request happy path, validation, captcha failure, rate limit (6th request in an hour is refused with 429), honeypot.
- Lighthouse CI budget and the visual test above.
