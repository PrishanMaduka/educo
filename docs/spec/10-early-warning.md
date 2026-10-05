# 10 Early warning

Early warning finds students (and, in the console, schools) who have **started** slipping, so there is still time to help. It explains why in plain words, suggests a next step and an owner, and turns that into a support plan in one click. The tone is supportive, never punitive.

The scoring code lives in `packages/domain/early-warning` as pure functions, with unit tests for every rule.

## Students (staff portal)

### Inputs (computed daily at 06:00 school time by `compute-signals`)
| Factor | Key | Rule | Weight |
|---|---|---|---|
| Attendance | `att` | Term attendance under 90% **and** down at least 3 points over 3 weeks | 3 if under 86%, otherwise 2 |
| Behaviour | `beh` | 2 or more concerns or detentions in the last 14 days | 3 if 3 or more, otherwise 2 |
| Learning | `learn` | A subject's latest assessment average is under 55% **and** at least 10 points below last term (never religion subjects, never Early Years) | 3 if under 45%, otherwise 2 |
| Homework | `hw` | 3 or more missed submissions this month | 2 if 5 or more, otherwise 1 |
| Family finances | `fee` | An invoice unpaid 30+ days with no reply to 2 reminders (shown only to users with `fees.view` or `finance_reports`) | 1 |

Safeguarding and medical data are **never** used.

### Levels
- A student is listed only when the total weight is at least 2.
- **Needs a conversation** (`high`): total weight ≥ 5, or 3 or more factors.
- **Keep an eye on** (`med`): any other listed student.
- **Plan in place**: has an active support plan.
- **Improving**: has a plan and the factor that triggered it improved by at least 5 points (or its count fell below the threshold) for 2 weeks.
- **Not a concern**: dismissed by a staff member with a reason. It comes back automatically if a new factor appears or after 30 days.

### Each factor carries
- `text`: a sentence with the number and trend, for example "Attendance 83% · down 6 points in 3 weeks" or "Mathematics 42% · was 58% last term".
- `why`: context, for example "5 days missed this term, mostly Mondays", "Was settled last term; most entries are in afternoon lessons" or "No reply to two reminders. The family may need support".
- `trend`: up to 6 weekly values for the sparkline, where the factor has a time series.

### Suggested next step and owner
Rules are checked in this order; the first match wins:
1. Behaviour with total ≥ 5: "Refer to the pastoral team", owned by the section head.
2. Attendance: "Class teacher to call home this week", owned by the class teacher.
3. Learning: "Offer {subject} catch-up sessions", owned by the subject teacher (or the class teacher).
4. Behaviour: "Check in with the student, then the parents", owned by the class teacher.
5. Homework: "Agree a homework plan with the parents", owned by the class teacher.
6. Fees only: "Bursar to offer a payment plan", owned by the bursar's office.

### Early warning page
- Page head with **How this works** (a drawer listing the rules above in plain words, "Safeguarding records are never used here", and "Nothing is sent to parents unless you start a plan and choose to tell them").
- A **story card**: "{n} students need a conversation and {m} are worth keeping an eye on. Most started slipping in the last three weeks, so there is still time to help. {k} students you supported last month are improving."
- Level chips with counts: To look at (high + med), Needs a conversation, Keep an eye on, Plan in place, Improving, Not a concern. Filters for signal and year group.
- A grid of **student cards**:
  - a coloured top stripe by level; the avatar, a name link to the profile, the class and class teacher, and the level pill;
  - factor rows (icon, text, why, sparkline);
  - a "Suggested next step" box with the owner, or "Plan" with the owner and review date;
  - actions: **Start a plan** / **Update plan**, **Write to parents** (opens Ask Quad with a draft), and **Not a concern**.
- **Support plan drawer:**
  - the factors at the top;
  - next step (the suggested step plus a list of options);
  - owner (staff list plus the bursar's office), review date (required), and "What we agreed";
  - **Let the parents know**, which sends a kind app message saying who will be in touch and when.
  
  Saving shows a petal burst and the toast "Plan saved for {first name} · parents told who will be in touch".
- Plans have review reminders: the owner gets a notification on the review date, with Close, Extend or "Improving" options.

### Elsewhere
- The dashboard shows the top 3 cards and the "Needs you today" row.
- The student profile shows a banner with the level and reasons.
- The side bar badge shows the "Needs a conversation" count.
- Ask Quad answers "Who needs attention in Year 9?" from this data.

## Parents

Shown on parent Home as a **heads-up card**, and in full on **How {child} is doing**.

- Parent-facing signals use only attendance, learning (subjects and trend), homework, and behaviour/house points the school shared. Fees are never shown as a "signal" to parents (they have the Payments tab).
- Levels shown to parents:
  - "Needs a conversation" when the school has started a plan with "Let the parents know" switched on, or the student meets the high rule and the class teacher has approved sharing;
  - "Keep an eye on" for medium;
  - "Improving" for good news (for example "Sinhala reading is up 9 points – well done").
- The card has: what we noticed (each item with its trend, e.g. "History has slipped from B to C this term · 72% → 63% · teacher says: 'Submit coursework on time.'"), why it matters (one short paragraph), and the teacher's suggestion (a quote). Actions:
  - **Book a 10-minute chat**: opens parents' evening if one is open for the child; otherwise a simple slot picker from the teacher's free periods, which creates a meeting and posts to the thread.
  - **Message {teacher}**: opens the thread with a draft already written.
- Parents see a signal only after the school approves sharing (school setting "Share early warning with parents": Off, After a plan is started (default), Automatically).

## Schools (console)

`compute-school-health` runs daily per tenant and writes `school_health_snapshots`.

| Factor | Rule | Example text |
|---|---|---|
| Staff weekly use | % of staff active in the last 7 days; falling ≥10 points over 6 weeks, or under 60% | "Staff using Quad each week: 58% · down 21 points in 6 weeks" |
| Admin activity | School admin last signed in ≥ 7 days ago | "School admin last signed in 12 days ago" |
| Parent adoption | Families on the app under 50% after 60 days live | "41% of families use the parent app" |
| Billing | Failed payment, or past due | "Card payment failed · $1,449 overdue" |
| Support | 3 or more open tickets, or any older than a week | "6 open support tickets · 2 older than a week" |
| Seats | Over 90% of the seat limit (a growth signal, not a risk) | "1,480 of 1,500 seats used" |
| Trial | Ends within 14 days without a payment method | "Trial ends 19 Oct" |

Levels:
- **At risk of leaving**: billing failed plus falling use, or a score ≥ 5.
- **Keep an eye on**.
- **Thriving**: use ≥ 85% and rising, and parents ≥ 80%.
- **Paused**: suspended.

The early warning page has:
- the story line ("1 school is at risk of leaving, worth $413 a month. 5 more need an eye kept on them, and 5 are thriving.");
- level tiles, filters by level and country, and sorting (most urgent first);
- cards with the school colour badge, plan, country and MRR;
- a staff-use sparkline with the current % and reasons;
- a suggested next step (for example "Book a check-in call with Sanjeewa Senanayake, the principal", "Retry the card, then call the bursar", "Upgrade to Enterprise – 96% seats used", "Say thank you, and ask if they would share their story");
- actions: Plan a check-in (a drawer with date, owner and note), Retry payment, Upgrade, and Draft email (Ask Quad).

The same panel appears at the top of each school's overview.
