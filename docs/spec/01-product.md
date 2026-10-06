# 01 Product

## Vision

Quad runs a whole school (admissions, records, timetable, teaching, pastoral care, fees and communication with families) and makes it feel like *your* school. It differs from Classe365 and iSAMS in four ways:

1. **Story first.** Every home screen opens with what is happening and what needs doing, in plain sentences, before tables or charts.
2. **Early warning.** Quad notices students (and, in the console, schools) that have started slipping, says why, and suggests who should act. One click starts a support plan.
3. **Ask Quad.** An assistant in every app answers plain-English questions from the school's own records, with sources, and drafts letters.
4. **Moments.** Teachers share a photo or a line of praise in two taps. Parents see it straight away and can say thanks. This brings the "Quad Circle" concept into the product in a simple way.

## People

| Person | App | What they need |
|---|---|---|
| Platform owner and Quad staff (super admin, support) | Platform console | Create and manage schools, plans and curricula, keep schools healthy, support schools safely |
| School admin, principal | Staff portal | See the school today, act on what needs them, configure the school |
| Teacher, class teacher, section head | Staff portal (My teaching) | Their day, registers, marks and comments, cover requests, moments |
| Admissions officer, front desk | Staff portal | Enquiries, applications, interviews, offers |
| Finance officer, bursar | Staff portal | Fee structures, billing runs, payments, accounting |
| Counsellor, safeguarding lead | Staff portal (Pastoral) | Behaviour, medical, restricted safeguarding records |
| Parent or guardian | Parent app (iOS, Android) | One login for all their children: the child's day, moments, payments, messages, bookings, forms |
| Student (later) | Staff portal student view | Out of scope for v1 (see non-goals) |

## The three apps

| App | Users | Prototype | Platform |
|---|---|---|---|
| Platform console | Quad staff | `design/platform.html` | Web (desktop first, works on phone) |
| Staff portal | School staff | `design/admin.html` | Web (desktop first, works on phone) |
| Parent app | Parents and guardians | `design/parent.html` | iOS and Android, built with Flutter |

Supporting design files: `design/index.html` (launcher), `design/brand.html` (logo guide), `design/brand/*.svg` (logo files), `design/circle.html` (the original Circle concept, for reference only; do not build it as a separate app).

## Feature map

| Area | Console | Staff portal | Parent app |
|---|---|---|---|
| Home | Overview: greeting, summary, needs you today, early warning for schools, revenue, plan mix, status | The school today: greeting, summary, needs you today, good news, early warning, the numbers | Greeting, today with child (story), latest moment, heads-up, to-dos, live class, bus, fees, quick actions, coming up, news |
| Tenancy | Schools, new-school wizard, stages, curricula, plans and billing, branding, security, danger zone, support access, audit log | Branding is applied from the console | Branding is applied from the console |
| People | Platform users; each school's users and roles | Users and roles, teachers and classes, students, guardians | Children, contacts |
| Admissions and CRM | – | Pipeline, applicant drawer, leads, campaigns, enquiry forms | – |
| Communication | – | Inbox, broadcasts, Moments sharing, parents' evenings, consent forms | Messages, Moments tab, push, bookings, forms |
| Academics | Curriculum templates | Timetable, subjects and bells per year group, staffing, cover, courses and gradebook, exams, reports, academic year | Timetable, homework, results, reports, exams |
| Attendance | – | Registers, school attendance | Attendance calendar, report absence |
| Pastoral | – | Behaviour, house points, medical, sick bay, safeguarding | Rewards, medical details |
| Early warning | Schools at risk | Students who need a conversation, support plans | Heads-up card, "How is my child doing" |
| Money | Plans, subscriptions, platform invoices | Fee structures, billing runs, invoices, online payments, accounting | Payments, pay sheet, wallet, trips |
| Transport | Module switch | Routes (v2) | Live bus, pickup pass |
| Assistant | Ask Quad (platform data) | Ask Quad (school data) | Ask Quad (my children) |

## Glossary

- **Tenant / school**: one school, with its own subdomain (`colombo-intl.quad.school`), data, users, branding and plan.
- **Curriculum template**: Cambridge International, Pearson Edexcel, IB, Sri Lankan national, American, or a custom one. It holds stages, year groups, grading scale and exam milestones.
- **Stage**: a group of year groups with an age range and a colour (Early Years, Junior School…). Each stage has its own default subjects and bell schedule.
- **Class / section**: a teaching group in a year group, named by the school (Emerald, Ruby or A, B).
- **Class teacher**: the teacher responsible for a class. **Section head**: the head of a stage. **Deputy**: a deputy section head.
- **Signal**: an early-warning factor with a reason and a trend. **Support plan**: the agreed next step, owner and review date.
- **Moment**: a short post from a teacher (photo, praise or great work) for one child or a whole class.
- **Billing run**: a guided process that creates draft invoices for a term from fee structures.
- **Cover**: a teacher assigned to an absent colleague's lesson.

## Scope for v1

Everything in the feature map, except what is listed below.

## Non-goals for v1

- A student login and student app.
- Full transport management (routes, drivers, GPS hardware). The parent bus screen uses a provider adapter with a simulator.
- A payroll or HR system. Staff records cover what the school apps need.
- Sinhala and Tamil interfaces. The app is built ready for localisation (see [15](15-cross-cutting.md#localisation)), but only English ships. The parent app says "Sinhala and Tamil coming soon".
- Native desktop apps.
- Building `design/circle.html` as its own app. Its idea ships as Moments.

## Success measures

- A new school is live (wizard finished, first admin signed in) in under 15 minutes.
- 80% of parents in a live school sign in to the parent app within 30 days.
- Teachers take a register in under 30 seconds on a phone.
- 90% of early-warning "Needs a conversation" students have a plan within 5 school days.
- p95 API latency under 300 ms for reads and under 600 ms for writes; parent app Home is interactive in under 2 s on a mid-range Android phone over 4G.
