# 09 Parent app

App: `apps/parent` (Flutter, Dart 3; packages in [02](02-architecture.md#parent-app-flutter)). Prototype: `design/parent.html` (shown in a phone frame, with a side panel of simulation controls that are **not** part of the product).

There is **one Quad parent app** for every school, listed in the stores as **"Quad – School & Family"** (bundle id `com.quadedu.parent`). It is not white-labelled. The app opens Quad-branded and takes on the school's logo, colour and name once the parent signs in.

## Principles
- **Display only.** The app shows what the API computes (summaries, levels, totals, grades). It never recalculates business rules.
- **One login for every child.** A child switcher appears on screens that are about one child (chips, plus a swipe on the Home card).
- **Story first.** Each screen opens with one plain sentence ("Amaya's average is 87%, 6 points above her class. Strongest in Art and Mathematics."), then one main element, then grouped cards.
- **Fast.** Home loads from one call (`GET /family/home`) and is cached for offline use. It refreshes on pull-down and on realtime events.

## Navigation
Tab bar: **Home**, **Circle** (unread moments badge), **Payments** (due badge), **Messages** (unread badge), **More**. The active tab is a coral pill with a small dot. Children's profiles are under More and in the "Profiles" chip after the child switcher on Home.

## Start-up
1. **Splash.** First launch: Quad-branded (the Quad mark on the indigo background, no school). Later launches: the remembered school's logo, colour and name with "powered by Quad", read from the cached branding of the last school used. The native splash (set at build time) is always the Quad mark; the school splash is drawn by Flutter as soon as the cache is read.
2. **Lock screen** (returning users with biometrics on): "Welcome back", Face ID or fingerprint, and "Use passcode". It is shown at launch and when the app returns after more than 5 minutes in the background.
3. **Sign-in** (first time, Quad-branded; flow and rules in [05](05-auth-tenancy-rbac.md#parent-app)):
   - **Welcome:** the Quad mark, "Welcome to Quad", "Attendance, results, fees and messages for your children, in one app.", **Sign in** and **I have an invite code**.
   - **Phone:** a country-code picker and the mobile number, **Send code**, and "Use email instead".
   - **Code:** 6 boxes with auto-advance, paste and SMS autofill (`one-time-code`), "It works for 10 minutes", and resend after 30 s.
   - **Found you:** "You're signed in. Welcome, Dilhani. We found 2 children at Colombo International School." with the children's avatars. From here the app uses the school's branding. With several schools, the school picker (logo, name, children) comes first.
   - **Unlock with Face ID?** (Turn on Face ID / Not now), then **Allow notifications?** (the system prompt, preceded by one sentence on what the school sends).
4. **Invite code:** a QR scanner with "Paste your invite link instead". A valid invite shows "{school} invited {name}" and continues at the phone step with the number filled in.

## Home
Order from top to bottom:
1. **Greeting header:** no card or illustration: a small time-of-day icon (sunrise, sun, sunset or moon; see [03](03-design-system.md#the-greeting-section-time-of-day)) with the date, "Good morning / afternoon / evening, {first name}" on one line (22 px), and the notifications bell on the right.
2. **Stories:** round tiles (Sports, STEM lab, Lunch, Principal, Art week). Tapping one opens full-screen slides: tap to advance, hold to pause, swipe down to close, double-tap or the heart button for a heart (`POST /family/stories/:id/heart`), and "Reply to the school" (sent to the office as a message).
3. **Child switcher:** small pills (24 px avatar and first name) and a round Profiles icon button at the end of the row.
4. **{child}'s day** (the day ring, see [12](12-moments-messaging.md#the-day-as-it-happens)): a ring of today's lessons from the start to the end of the school day, done lessons solid and upcoming ones faded, a "now" hand and event dots (arrived, registered, moment, lunch, bus). Beside it a LIVE headline ("Two of seven lessons done") and a sentence ("Arrived 07:42, registered present and a moment from Ms. Jayasinghe"); under it "Right now: Science with Ms. Fernando". Tap → **Day** screen: the larger ring, "So far today" timeline, and "Still to come".
5. **Needs you:** a heads-up from early warning when the level is "Needs a conversation" or "Keep an eye on" (it opens How {child} is doing, which holds the full heads-up card), then forms to sign, trips needing consent, parents' evening to book, an exam timetable published, and a report ready. Each opens its screen.
6. **School bus:** status line ("On the way · 7 min from home"), with LIVE when the bus is moving.
7. **Fees:** "{amount} due · next due {date}" with Pay now, or "All fees paid".
8. **Quick actions:**
    - Attendance, Results, Timetable, Homework;
    - Track bus, Pickup pass, Canteen, Report absence;
    - Rewards, Trips, Reports, Calendar.
9. **Coming up:** the next three events, including holidays such as Poya days.
10. **School news:** a horizontal scroll of cards; each opens the article.
11. "Updated at {time} · pull down to refresh".

Moments and the "Improving" good news are not on Home; they live in the Circle tab and on How {child} is doing.

A floating round Ask Quad button sits at the bottom right and never covers content.

## Circle tab
The tab opens with a segmented control: **Moments · People · Learning**. The Moments segment shows its own unseen count when another segment is open. Moments are marked seen only while the Moments segment is showing. Specification of the parts: [12](12-moments-messaging.md#quad-circle).

### Moments
- At the top, on and after Friday 15:00: **Last week with {child}** → the recap screen (moments, skills noticed, days in school, learning tried at home, and "One thing for the weekend" with its own **We tried it**).
- A header line such as "Ten moments from Amaya's and Kavindu's teachers this fortnight."
- Filter chips: All children, then one per child.
- The feed is grouped by day (Today, Yesterday, then the date). Each card has:
  - the teacher's avatar, name, role and class, and the time;
  - a photo, or a large praise or work tile;
  - the child tag ("Kavindu's class" for whole-class moments);
  - a "New" marker until it has been seen;
  - a "Skill noticed" chip when the teacher tagged a skill.
- Actions:
  - **Love**, which toggles a heart and shows a petal burst;
  - **Say thanks**, which sends a thank-you to the teacher. A sent bubble appears under the card, and the button turns into "Thanks sent".
- New moments arrive live with an in-app banner ("Ms. Jayasinghe shared a moment of Amaya") and push.

### People
- Child chips, then a sentence: "Seven people look after Amaya at school, and three at home."
- The orbit: the child in the centre, family on the inner ring (amber), school on the outer ring (indigo). Each node can be tapped. The SVG has a label naming everyone; the lists below are the accessible equivalent.
- **At school:** name, role, and the "working on" line. Tap → **person screen** (role, working on with {child}, reply hours, their recent moments for this child; **Message**, **Say thanks**, **Ask for a 10-minute chat**).
- **Ask for a 10-minute chat** opens a sheet "A 10-minute chat with {name}" ("{role} · in person at school or by phone. Pick a time that suits you.") with day headings and time buttons. Slot rules (computed by the API, `GET …/chat-slots`):
  - 10-minute slots inside the person's office hours (`staff_office_hours`; default 15:00–16:00) on the next 5 school days, skipping holidays, the teacher's lessons and cover, and their cover absences;
  - slots already booked by anyone are shown disabled ("taken");
  - one open request per guardian, child and staff member; the parent can cancel it.
  
  Choosing a slot books it, posts "I've booked a 10-minute chat for {day, time} about {child}" into the thread with that teacher, and shows the toast "Booked: {name} · {day, time}". The same sheet is used by **Book a 10-minute chat** on How {child} is doing when no parents' evening is open.
- **Family:** guardians, relatives (with "Invited" until they join) and pickup people. **Invite family** opens a sheet (name, relation, phone, children) that says what relatives can and can never see. Tapping a relative opens a sheet with **Remove from circle**.
- **Photos of {child}:** the photo-consent setting (Class, Family only, No photos), also reachable from the child's profile.

### Learning
- Child chips, then a sentence: "This week Amaya's class is learning writing a postcard, fractions of a shape and how plants drink." with "Three ideas to try at home, about 30 minutes in all".
- **This week in class:** one card per subject (subject pill, teacher, topic, why, a **Try at home · 15 min** box, and **We tried it**, which opens a sheet for an optional note; afterwards "Tried · Mon 18:20 · Ms. Jayasinghe can see this").
- **What teachers noticed this term:** skill bars from the child's moments; each opens the moments with that skill.

## Children (profile)
Overview of each child: class, class teacher, house, attendance, average, house points, and links to every child screen, plus **Circle** (people) and **Photos** tiles.

## Child screens
Each one opens with a one-sentence summary and works for both children.

| Screen | Main element | Detail |
|---|---|---|
| Attendance | A large percentage against the 95% target | Month calendar (present/absent/late/excused/holiday), absences with reasons, and "fill in a form" for unexplained days |
| Results | Average and a bar against the class average | Term grades and Progress views; per-subject grade badge, mark bar and trend (↗ +9); tap a subject for the teacher's comment. Only marks the teacher has published |
| Timetable | The live lesson card | Day chips (Mon–Fri), a period timeline with intervals, and today's "now" highlight |
| Homework | The next item due | Due / done groups, subject colour, mark as seen |
| Rewards | House points and merits | Timeline of behaviour entries visible to parents |
| Reports | The newest published report | List by cycle; the PDF opens in the viewer |
| Exams | The first paper | Papers by series, with date, session, duration and room; "Arrive 15 minutes early" |
| Medical | Conditions and medication | Read-only; "Ask the school to update" sends a message |
| How {child} is doing | A summary | Attendance meter, learning by subject with trend, homework, behaviour, wellbeing; plain-language status for each |

## Payments
- Total due with Pay now; invoices (due, paid); trips with consent and cost; payment history with receipts.
- **Pay sheet** (bottom sheet):
  - Shows the invoice and the amount (full, or a part payment if the school allows it). The methods shown follow the school's payment settings: card via PayHere (saved card or add card/wallet), Stripe for international cards, Apple Pay or Google Pay where the school's gateway supports them, bank transfer (shows the details and a reference), and "Pay in 3 instalments".
  - The parent confirms with **slide to pay** and Face ID, and sees a success state with confetti and a receipt.
  - The handshake with the gateway is in [Payments handshake](#payments-handshake).
- **Canteen wallet** (per child, from Home quick actions): "{child} has {balance} on their canteen card – about {n} days of lunches.", the balance with a bar ("Running low – a top-up would help this week"), **Top up** amounts (500, 1,000, 2,000, 5,000; minimum 1,000 unless the school sets lower) paid through the school's gateway exactly like an invoice, a **daily spending limit** slider (200–2,000 in steps of 50, saved with `PUT /family/wallet/limit`), **Today's lunch** from the canteen menu, and recent purchases. Balance changes arrive live (`wallet.updated`).

## Messages
Threads with teachers and offices: unread first, a new message to a staff member from the child's contacts or the directory, quick replies, "Seen" receipts and a typing indicator. Swipe a thread for **Mark read / unread**, **Mute** (for a day, a week or until turned back on; muted threads get no push) and **Archive** (moves it to "Archived" at the bottom of the list; a new message brings it back). Under the composer, a quiet-hours line (see [12](12-moments-messaging.md#good-relationships-by-design)). A school bulletins section is included.

## School life (from More and from to-dos)
- **Parents' evening:**
  - Shows the event details, then one card per teacher who teaches the child, each with time-slot buttons.
  - Taken slots are disabled. You can book only one slot per teacher and never two at the same time.
  - Your bookings are listed at the top with cancel.
  - With no evening open: "There's no parents' evening open for {child}'s class yet." and a link to book a 10-minute chat.
- **Forms:** the question, Yes / No, "Type your full name to sign", and "Sign and send". If the form has a fee and the answer is yes, it shows "{amount} added to Payments". Signed forms show the answer, name and time. Closed forms show "Closed".
- **Trips & bookings:** "{n} trips need your consent: {trip} on {date}." Each trip card has an illustration, the child tag, title, date, cost and status (Consent needed / Booked), a consent checkbox ("I give consent for {child} to attend and confirm the medical details are current.") and **Sign & pay {amount}**, which signs the trip's consent form and opens the pay sheet for the invoice it creates. Booked trips say "{child} is going. We'll send the timings and what to pack the week before."
- **School calendar:** "Next up: {event}, {date}." and "Next day off: {holiday}, {date}", a hero card for the next event, filter chips **Everything · Events · Days off**, and a list grouped by month (date chip, title, detail; Poya days and holidays highlighted). Each event has **Add to phone calendar** (an `.ics` file for that event, opened with the system calendar), and the page has **Subscribe to the school calendar** (a signed `webcal://quad-edu.com/api/v1/calendar/{token}.ics` feed of events for the guardian's children and holidays; it can be revoked from Settings).
- **Report absence:** child, dates, reason chips (illness, appointment, family, other), a note, then send. The school acknowledges it. A note says "If {child} is away for more than three days, the school may ask for a doctor's note."
- **Pickup pass:**
  - "Show this pass at the gate. {person} is collecting {children}." and "The code changes every 5 minutes, so a screenshot can't be reused."
  - **Who is collecting?** chips: you and the approved pickup people, plus **Add**. Adding a person asks for full name, relationship, phone and an optional photo; "The school office checks new people before their first pickup." The person shows "Waiting for approval" and cannot be chosen until the office approves.
  - **Children:** tick which children.
  - The pass: school logo and name, "Pickup pass · today only", a QR code that rotates every 5 minutes, the person and children, a countdown and progress bar. **New code** rotates it at once ("The old one no longer works"). **Share pass** sends the pass to that person as a link that works for today only (or saves it to the wallet when it is for you). Brightness is boosted while the pass is shown.
  - When the gate scans it, the parent gets "{child} was collected by {person} at {time}".
- **Bus:**
  - A live map with the route, stops and the bus position, the ETA and a list of stops, the driver and a call button to the transport desk, and who is on board.
  - Push alerts for "one stop away" and "dropped off".
  - In v1 the position comes from a provider adapter; a simulator plays a trip in staging and demos.
- **News:** a featured story and "Earlier" list; each opens the **article screen** (cover image, tag, date, title, lead paragraph, body, and "More news").
- **Staff directory:** "Message the right person directly. Most staff reply within the school day.", a search box, and rows for the child's teachers, the principal and the offices (finance, admissions, sick bay, transport desk) with their role and hours. Tapping a row starts or opens a thread.

## More
- A profile card with the guardian and child chips.
- **Children:** My children (profiles), How {child} is doing for each child, Circle.
- **School life:** Ask Quad, parents' evening, forms, exams, trips & bookings.
- **Information:** school calendar, news, staff directory.
- **Account:**
  - **Contact details:** mobile, email and home address with **Submit changes**. "The school office reviews changes before they reach student records." Pending changes show "Waiting for the school" until approved. A new mobile or email also needs a code sent to it (see [05](05-auth-tenancy-rbac.md#account-edge-cases));
  - **Notifications:** one switch per category (absence, rewards, finance, news, moments, messages, events) plus **SMS backup** ("Also send urgent alerts by text"); "Urgent safety alerts always come through." The prototype groups these differently; the spec's seven categories win;
  - Face ID;
  - dark mode (system, light or dark);
  - language: "English · Sinhala and Tamil coming soon";
  - **Switch school** (only with more than one).
- **Help:** help articles and **Contact Quad support** (creates a support ticket).
- Sign out.
- Footer: "Quad {version} · {school} · powered by Quad".

## Notifications
- Push categories map to the preferences above. Each push carries a deep link (see [Deep links](#deep-links)).
- There is also an in-app notification list (Today, Earlier) with "Choose what you get".
- Pushes go to every signed-in device of the guardian. A bounced token is removed.

## Deep links
Every link exists in two forms: the custom scheme `quad://…` (used in push payloads) and the universal / app link `https://quad-edu.com/p/…` (used in emails and SMS; it opens the app when installed, otherwise the "Get the Quad app" page). `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` cover only `/p/*`. Both forms route through `go_router`. Links never carry the tenant: the app opens the path in the signed-in school, and if the item belongs to another of the guardian's schools the API answers with that school's id so the app can switch after asking. A link opened while signed out is kept and opened after sign-in.

| Path (after `quad://` or `https://quad-edu.com/p/`) | Opens |
|---|---|
| `home` | Home |
| `moments/{momentId}` | Circle → Moments, scrolled to the moment |
| `circle/people?child={id}`, `circle/learning?child={id}` | Circle → People or Learning |
| `circle/recap/{week}?child={id}` | Last week with {child} |
| `threads/{threadId}` | The conversation |
| `forms/{formId}` | The form |
| `evenings/{eventId}` | Parents' evening booking |
| `chats/{requestId}` | The person screen with the booked chat |
| `exams/{seriesId}?child={id}` | Exams |
| `reports/{cycleId}?child={id}` | Reports, with that report open |
| `attendance?child={id}&date={date}` | Attendance, on that day |
| `bus/{routeId}` | Bus |
| `pay/{invoiceId}` | Payments, with the pay sheet open |
| `payments/{paymentId}` | Payment result and receipt |
| `wallet?child={id}` | Canteen wallet |
| `trips/{tripId}` | Trips & bookings |
| `news/{postId}` | News article |
| `calendar` | School calendar |
| `doing?child={id}` | How {child} is doing |
| `invite/{token}` | Invite code step (signed token) |
| `pickup/{passToken}` | A shared pickup pass (today only) |

## Offline and performance
- Cache Home, the timetable, the last 50 moments, messages and invoices (Riverpod providers backed by a `drift` SQLite cache). Show "Updated at …" and an offline banner.
- Payments, bookings and form signing need a connection; queue nothing for them.
- Images: thumbnails at 2× the display size, served as WebP or AVIF from the CDN.

## Flutter specifics

### Cache security
- The `drift` database is encrypted with SQLCipher (`sqlcipher_flutter_libs`), with a random 256-bit key created on first run and kept in `flutter_secure_storage` (Keychain, and Android Keystore-backed `EncryptedSharedPreferences`).
- **Wipe** the database, image cache, secure-storage tokens and the FCM token registration on sign-out, on a revoked refresh family, and when the app sees an account change. **Switching school** clears all cached rows for the previous school (each row carries its tenant id), so nothing from one school shows in another.
- iOS: exclude the database from backups; Android: `allowBackup="false"`. Screens with the pickup pass, payment sheet and medical details set `FLAG_SECURE` on Android and blur in the iOS app switcher.

### Re-lock
With biometrics on, the app shows the lock screen at launch and after more than **5 minutes in the background** (measured from `AppLifecycleState.paused`). Payments always ask again, whatever the timer.

### Flavors and configuration
Values come from `--dart-define-from-file=env/{flavor}.json` (checked in, no secrets; keys `APP_ENV` (`local`, `staging`, `production`), `API_URL`, `SOCKET_URL`, `SENTRY_DSN`) and the Firebase files per flavor.

| Flavor | Bundle id / application id | API_URL | SOCKET_URL | Firebase project |
|---|---|---|---|---|
| `dev` | `com.quadedu.parent.dev` | `http://localhost:4000/api/v1` (`10.0.2.2` on the Android emulator; LAN address on devices) | `ws://localhost:4000` | `quad-dev` |
| `staging` | `com.quadedu.parent.staging` | `https://staging.quad-edu.com/api/v1` | `wss://staging.quad-edu.com` | `quad-staging` |
| `prod` | `com.quadedu.parent` | `https://quad-edu.com/api/v1` | `wss://quad-edu.com` | `quad-prod` |

`SOCKET_URL` is a bare origin in every flavor; the realtime client sets the `/socket.io` path itself ([D15, D27](02-architecture.md#decision-log)), and the app refuses a `SOCKET_URL` with a path at launch.

Each flavor has its own app name suffix ("Quad Dev", "Quad Staging"), icon badge, `google-services.json` / `GoogleService-Info.plist`, associated domains (`applinks:staging.quad-edu.com` for staging) and PayHere/Stripe sandbox or live mode (the mode follows the school's gateway account, not the flavor).

### Payments handshake
The app never sees gateway secrets and never decides that a payment succeeded.
1. `POST /family/payments/intent {invoiceId | walletTopUp, amountMinor, method}` → the API loads the school's gateway account ([13](13-fees-payments-finance.md#who-owns-the-money)), creates a `payments` row (`pending`) and returns the session.
2. **PayHere:** the API returns the checkout parameters (merchant id, order id = payment id, amount, currency, items, customer, `notify_url` = our webhook) and the server-computed `hash` (MD5 of merchant id, order id, amount, currency and the hashed merchant secret). The app calls `PayHere.startPayment` from `payhere_mobilesdk_flutter` with `sandbox` set from the account mode.
3. **Stripe:** the API creates a PaymentIntent on the school's Stripe account and returns `clientSecret`, the publishable key and the account id. The app initialises `flutter_stripe` with them and presents the **PaymentSheet** (cards, Apple Pay with merchant id `merchant.com.quadedu.parent`, Google Pay).
4. When the SDK returns (success, cancel or error) the app shows "Checking your payment…" and waits for `payment.succeeded` or polls `GET /family/payments/:id` for up to 60 s. Only the webhook marks the payment `succeeded`. If it is still pending, the app says "We're waiting for {gateway} to confirm. We'll let you know." and a push follows.

### Minimum version and forced update
At launch and on resume (at most hourly) the app calls `GET /app/config`. If the installed version is below `minVersion`, a full-screen "Please update Quad" with **Update** (store link) blocks the app. If a newer version exists, a dismissible banner shows once a week. The API also returns `426 app_update_required` to clients that send an `X-App-Version` header below the minimum.

### Store publishing
- Accounts: Apple Developer Program and Google Play Console under Quad's company. One listing each: "Quad – School & Family".
- Builds: `fastlane` lanes in GitHub Actions (macOS runner for iOS) produce signed `prod` builds to TestFlight and the Play internal track; `staging` builds (bundle id `com.quadedu.parent.staging`) also go to TestFlight and the Play internal track ([20](20-infrastructure-operations.md#app-store-publishing), D28). Signing credentials come only from the GitHub `staging` environment secrets or fastlane `match`; nothing is committed.
- Privacy: App Store privacy labels and the Google Play data-safety form declare contact info (phone, email), user content (messages, photos), identifiers (push token) and purchases, used for app functionality, not tracking. The privacy policy URL is `https://quad-edu.com/legal/privacy`.
- Review: a demo account for app review uses a reserved phone number whose OTP is fixed and works only on the production review school (an isolated demo tenant with sample data). It is set by environment variables and listed in the review notes.
- Permissions strings: camera (invite and pickup scanning, moments photos are staff-only), Face ID, notifications, photo library (profile photo of a pickup person).

## Accessibility
Text scaling up to 200% (`MediaQuery.textScaler`) without clipping. `Semantics` labels on every control for VoiceOver and TalkBack (copy them from the prototype's `aria-label`s). Reduced motion turns off the sunrise, petals and confetti.
