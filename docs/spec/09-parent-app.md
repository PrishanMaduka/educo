# 09 Parent app

App: `apps/parent` (Flutter, Dart 3; packages in [02](02-architecture.md#parent-app-flutter)). Prototype: `design/parent.html` (shown in a phone frame, with a side panel of simulation controls that are **not** part of the product).

## Principles
- **Display only.** The app shows what the API computes (summaries, levels, totals, grades). It never recalculates business rules.
- **One login for every child.** A child switcher appears on screens that are about one child (chips, plus a swipe on the Home card).
- **Story first.** Each screen opens with one plain sentence ("Amaya's average is 87%, 6 points above her class. Strongest in Art and Mathematics."), then one main element, then grouped cards.
- **Fast.** Home loads from one call (`GET /family/home`) and is cached for offline use. It refreshes on pull-down and on realtime events.

## Navigation
Tab bar: **Home**, **Circle** (unread moments badge), **Payments** (due badge), **Messages** (unread badge), **More**. The active tab is a coral pill with a small dot. Children's profiles are under More and in the "Profiles" chip after the child switcher on Home.

## Start-up
1. Splash in the school's brand colour, with its logo and name, and "powered by Quad".
2. **Lock screen** (returning users): "Welcome back", Face ID or fingerprint, and "Use passcode".
3. **Sign-in** (first time): phone number, then OTP (6 boxes, auto-advance, resend after 30 s), then the choice of school when there is more than one, then "Turn on Face ID?" and "Allow notifications?".

## Home
Order from top to bottom:
1. **Greeting header:** no card or illustration: a small amber sun dot with the date, "Good morning, {first name}" on one line (22 px), and the notifications bell on the right.
2. **Stories:** round tiles (Sports, STEM lab, Lunch, Principal, Art week). Tapping one opens full-screen slides: tap to advance, hold to pause, swipe down to close, and double-tap for a heart.
3. **Child switcher:** small pills (24 px avatar and first name) and a round Profiles icon button at the end of the row.
4. **{child}'s day** (the day ring, see [12](12-moments-messaging.md#the-day-as-it-happens)): a ring of today's lessons from the start to the end of the school day, done lessons solid and upcoming ones faded, a "now" hand and event dots (arrived, registered, moment, lunch, bus). Beside it a LIVE headline ("Two of seven lessons done") and a sentence ("Arrived 07:42, registered present and a moment from Ms. Jayasinghe"); under it "Right now: Science with Ms. Fernando". Tap → **Day** screen: the larger ring, "So far today" timeline, and "Still to come".
5. **Needs you:** a heads-up from early warning when the level is "Needs a conversation" or "Keep an eye on" (it opens How {child} is doing, which holds the full heads-up card), then forms to sign, parents' evening to book, an exam timetable published, and a report ready. Each opens its screen.
6. **School bus:** status line ("On the way · 7 min from home"), with LIVE when the bus is moving.
7. **Fees:** "{amount} due · next due {date}" with Pay now, or "All fees paid".
8. **Quick actions:**
    - Attendance, Results, Timetable, Homework;
    - Track bus, Pickup pass, Canteen, Report absence;
    - Rewards, Trips, Reports, Calendar.
9. **Coming up:** the next three events, including holidays such as Poya days.
10. **School news:** a horizontal scroll of cards.
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
| Results | Average and a bar against the class average | Term grades and Progress views; per-subject grade badge, mark bar and trend (↗ +9); tap a subject for the teacher's comment |
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
  - Shows the invoice and the amount (full, or a part payment if the school allows it). The methods shown follow the school's payment settings: card via PayHere (saved card or add card/wallet), Stripe for international cards, bank transfer (shows the details and a reference), and "Pay in 3 instalments".
  - The parent confirms with **slide to pay** and Face ID, and sees a success state with confetti and a receipt.
- **Canteen wallet:** balance, top-up amounts, daily limit, recent purchases.

## Messages
Threads with teachers and offices: unread first, swipe for actions (mark read, mute), a new message to a staff member from the child's contacts, quick replies, "Seen" receipts and a typing indicator. Under the composer, a quiet-hours line (see [12](12-moments-messaging.md#good-relationships-by-design)). A school bulletins section is included.

## School life (from More and from to-dos)
- **Parents' evening:**
  - Shows the event details, then one card per teacher who teaches the child, each with time-slot buttons.
  - Taken slots are disabled. You can book only one slot per teacher and never two at the same time.
  - Your bookings are listed at the top with cancel.
- **Forms:** the question, Yes / No, "Type your full name to sign", and "Sign and send". If the form has a fee and the answer is yes, it shows "{amount} added to Payments". Signed forms show the answer, name and time.
- **Trips:** details, consent and payment.
- **Calendar:** month and list views with filters (school events, my child's class, holidays).
- **Report absence:** child, dates, reason chips (illness, appointment, family, other), a note, then send. The school acknowledges it.
- **Pickup pass:**
  - A QR code that rotates every 5 minutes, so screenshots cannot be reused.
  - Choose the person collecting (from the approved list) and which children.
  - Brightness is boosted while the pass is shown.
- **Bus:**
  - A live map with the route, stops and the bus position, the ETA and a list of stops.
  - Push alerts for "one stop away" and "dropped off".
  - In v1 the position comes from a provider adapter; a simulator plays a trip in staging and demos.

## More
- A profile card with the guardian and child chips.
- **School life:** evenings, forms, exams, trips, calendar.
- **Children:** profiles and "How {child} is doing" for each child.
- **Settings:**
  - contact details;
  - notification preferences by category (absence, rewards, finance, news, moments, messages, events) and SMS fallback;
  - Face ID;
  - dark mode (system, light or dark);
  - language: "English · Sinhala and Tamil coming soon".
- **Help:** staff directory, help.
- Sign out.

## Notifications
- Push categories map to the preferences above. Each push deep-links to its screen (`quad://moments/{id}`, `quad://circle/learning`, `quad://circle/recap/{week}`, `quad://pay/{invoiceId}`).
- There is also an in-app notification list.
- Pushes go to every signed-in device of the guardian. A bounced token is removed.

## Offline and performance
- Cache Home, the timetable, the last 50 moments, messages and invoices (Riverpod providers backed by a `drift` SQLite cache). Show "Updated at …" and an offline banner.
- Payments, bookings and form signing need a connection; queue nothing for them.
- Images: thumbnails at 2× the display size, served as WebP or AVIF from the CDN.

## Accessibility
Text scaling up to 200% (`MediaQuery.textScaler`) without clipping. `Semantics` labels on every control for VoiceOver and TalkBack (copy them from the prototype's `aria-label`s). Reduced motion turns off the sunrise, petals and confetti.
