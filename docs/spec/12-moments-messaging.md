# 12 Circle, moments, messages and notifications

## Quad Circle

Every child has a circle: the people at school and at home who look after them. Circle is how Quad keeps that circle connected. It has seven parts. Each one reuses data the school already records.

| Part | Parent app | Staff portal |
|---|---|---|
| Moments | Circle tab → Moments; a moment dot on the Home day ring | Share a moment (My teaching) |
| The day, as it happens | Day ring on Home, Day screen | (from registers, gate events, pickup scans, canteen, bus) |
| Everyone around the child | Circle tab → People, person screen | – |
| This week in class | Circle tab → Learning, **We tried it** | This week in class card and drawer (My teaching) |
| Family circle (relatives) | Invite family, remove | Student profile (read only) |
| Photo consent | "Photos of {child}" setting | Share drawer respects it; student profile (read only) |
| Good relationships by design | Quiet-hours note in Messages; weekly recap | Family pulse (My teaching), Family connection (leaders), Quiet hours (Communications) |

Prototypes: `design/parent.html` (Circle tab, Home day ring, Day, recap) and `design/admin.html` (My teaching cards, Family connection, Communications → Quiet hours). `design/circle.html` is the original concept page; it is not built as its own app.

## Moments

Teachers share small good things, and parents see them straight away.

### Staff side (My teaching → Moments card, and a "Share a moment" button)
- The card lists the teacher's recent moments, each with its thumbnail, who it is about, the text and the time. Parent reactions show as "♥ parent loved this" and the thank-you text.
- **Share a moment** drawer:
  - **Class:** the teacher's classes; class-teacher classes first.
  - **Who is it about:** the whole class, or one student from the class list.
  - **Type** (segmented): Photo, Praise or Great work.
  - **Photo** (for the Photo type): take a photo or choose one (mobile web: camera capture; desktop: file picker). Up to 4 images, each resized to 2048 px on the long edge, EXIF location removed. Until a photo is chosen, an illustrated tile can be used (art keys: mural, science, sports, reading, music, garden, maths, drama).
  - **What happened?** 5–240 characters.
  - **Skill** (optional): one of Confidence, Kindness, Teamwork, Creativity, Curiosity, Perseverance, Reading, Problem solving. Shown as a tag on the moment; parents see a term tally of skills in Circle → Learning.
  - **Audience line:** who will see it ("Amaya's parents and Kamala Perera (Grandmother)", or "Only Amaya's family will see this photo" when the child's photo consent is `family`).
  - **Photo consent check:** each child's photo consent is set by their guardians (see [Photo consent](#photo-consent)). When the selected student's consent is `none`, the Photo type is disabled for that student with the reason, and Praise or Great work stay available. If any student in a whole-class photo has consent `none`, the drawer warns "{n} students in this class don't have photo consent. Choose a photo without them, or share praise instead." It blocks sharing to the whole class until the teacher confirms that those students are not in the photo. (Automatic face blurring is v2.)
  - **Share with parents**: shows a petal burst and the toast "Shared with {child}'s parents" or "Shared with parents of {class}".
- **Quiet hours:** inside the school's quiet hours the button reads "Schedule for 07:00" and the moment is delivered when quiet hours end.
- Moderation: school admins can hide a moment (with a reason). Teachers can delete their own moments within 24 hours. Every moment is in the audit log.
- Limits: 20 moments per teacher per day.

### Parent side
See [09](09-parent-app.md#moments). Who receives a moment: the guardians of the selected student, or of every student in the class for a whole-class moment. A thank-you creates a message in the thread with that teacher ("Thank you, Ms. Jayasinghe! …"), and the teacher also sees it on the moment.

## The day, as it happens
The parent's Home shows a **day ring** for the selected child: today's lessons as arcs from the start to the end of the school day (done lessons solid, upcoming faded), a "now" hand, and event dots. Events come from records the school already keeps:
- arrived at the gate (a `gate_events` row from a card reader or the front desk, or else the register's arrival time);
- registered present (register mark);
- a moment shared;
- lunch bought (canteen wallet purchase);
- the bus leaving school and the drop-off (bus tracking);
- collected at the gate (a pickup-pass scan).

Under the ring: "Right now: {subject} with {teacher}". Tapping opens the **Day** screen, with a larger ring, a timeline of today's events in plain sentences, and "Still to come". The API builds the timeline (`GET /family/day`); the app only draws it. Absences, late marks and health-room visits never appear as ring events; they keep their own notifications.

## Everyone around the child
Circle tab → **People** shows, for the selected child, an orbit with the child in the centre: the school ring (class teacher, subject teachers, coaches, the school nurse) and the family ring (guardians, family-circle relatives, people on the pickup list). The same people are listed below it for screen readers and small screens.

A school person's screen shows their role, "Working on with {child}" (a short line the teacher keeps up to date in My teaching, defaulting to their subject's current topic), reply hours, their recent moments for this child, and three actions: **Message**, **Say thanks** (a one-tap thank-you posted into the thread) and **Ask for a 10-minute chat**.

## This week in class
- **Staff:** My teaching → **This week in class** card lists the teacher's posts for this week with "{n} families tried it at home" and any notes parents left. **Post this week's learning** opens a drawer: class, subject, topic, why (one sentence), one thing to try at home (no purchases), and minutes (5–20). The toast says who will see it ("Parents of Year 4 Emerald will see this in Circle").
- **Parents:** Circle tab → **Learning** shows this week's posts for the selected child, one card per subject with topic, why, and **Try at home** with the minutes. **We tried it** (with an optional short note) records the try; the card then shows "Tried · Tue 18:20" and the teacher sees it. Below: **What teachers noticed this term**, a tally of the skill tags on that child's moments; each skill opens the matching moments.
- One post per class, subject and week. Posts are kept for the academic year.

## Family circle
- A guardian can invite up to four relatives (for example a grandparent abroad) from Circle → People → **Invite family**: name, relation, phone, and which of their children.
- Relatives sign in to the parent app with phone and OTP and see a reduced app: the Moments feed of the linked children only, where they can heart. They never see or send messages, and never see fees, results, attendance, reports, health or the heads-up card.
- The inviting guardian, any other guardian of the child, or the school can remove a relative at any time; removal takes effect at once (sessions revoked).
- The school can turn family circle off in Settings → School settings → Families ([08](08-staff-portal.md#school-settings)). Children with a court order or a safeguarding flag that restricts contact cannot have relatives added; the API refuses quietly with a generic message.
- The staff portal student profile lists relatives read-only ("Family circle: Kamala Perera (Grandmother) sees moments").

## Photo consent
Guardians choose, per child, in Circle → People or the child's profile → **Photos of {child}**:
- **Class** (default): photos that include the child can be shared with the class's parents.
- **Family only:** photos that tag this child go only to this child's family.
- **No photos:** teachers cannot tag the child in photo moments; praise and great work are still allowed.

The choice is stored in `consents` (type `photo`) with who changed it and when. A school sets the default for new students in Settings → School settings → Families. Class photos (no child tagged) depend on the teacher's check in the share drawer.

## Good relationships by design
- **Family pulse** (My teaching, class teachers only): each family in the class with their last positive moment, last heads-up and whether they replied. Families with nothing positive in 14 days come first with a gentle nudge and **Share a moment about {child}**, which opens the share drawer prefilled. It is for the teacher only and is never used to compare teachers.
- **Family connection** (leaders; permission `circle.connection.read`): "{n} of {N} families heard something positive in the last two weeks", stat tiles, a heatmap of year group × class (labels from the curriculum), and a **Families not reached** list with **Remind {class teacher}** and **Send a note from the office**. It shows families and classes, never a ranking of teachers.
- **Quiet hours** (Communications; school-wide, default 18:00–07:00 and weekends): staff pushes are held, and moments and messages from staff to parents sent inside quiet hours are delivered when quiet hours end. Parents see a calm line under the message composer ("Teachers read messages 07:00–18:00. Sent now, it reaches Ms. Jayasinghe at 07:00 tomorrow."). Urgent safety alerts always go through.
- **Weekly recap** (parents): on Friday at 15:00 the `build-weekly-recaps` job builds "Last week with {child}": moments, skills noticed, days in school, learning tried at home, and one thing for the weekend (from the week's Try at home). It shows at the top of Circle → Moments and as one push.

### Data and events
Tables `moments` (with `skill`), `learning_posts`, `learning_tries`, `family_circle_members`, `consents` (type `photo`), `chat_requests`, `staff_office_hours`, `teaching_notes`, `gate_events` and the quiet-hours columns of `school_settings` (see [04](04-data-model.md#communication-t)). Held moments and messages are released by the `deliver-held` job. Events `learning.posted`, `learning.tried`, `family_circle.changed`, `consent.photo.changed`. The family-pulse and connection figures are computed in `packages/domain/circle` from moments, early-warning plans shared with parents, and message replies.

## Moments data and events
Tables `moments`, `moment_reactions` and `moment_reads` (see [04](04-data-model.md#communication-t)). Events `moment.created` and `moment.reaction.created`. Push category `moments` ("Ms. Jayasinghe shared a moment of Amaya").

## Messages
- In the parent app, Messages is not a tab: it opens from the messages button (with the unread badge) in the Today header and from the top of Profile ([09](09-parent-app.md#navigation), D35).
- Threads between guardians and staff, or between guardians and an office (Finance Office, Admissions).
- A parent can start a thread with the class teacher, the child's subject teachers, or an office.
- A teacher can start one with the guardians of a student in their classes.
- Rich text (bold, lists, links), attachments (PDF and images, up to 10 MB), read receipts ("Seen"), a typing indicator, and quick replies.
- Quiet hours: see [Good relationships by design](#good-relationships-by-design). Outside quiet hours parents see "Ms. Jayasinghe usually replies within the school day". Urgent messages go to the office.
- Expectation shown to staff: "Reply within two school days." Threads waiting longer than this show on the staff dashboard as a "Needs you" row (row 7 in [08](08-staff-portal.md#dashboard-the-school-today)).
- Thread actions, for staff and parents: mark read or unread, **archive** (`thread_participants.archived_at`; a new message unarchives) and **mute** (`muted_until`; no push, the badge still counts). They apply to the person, not the thread, and sync across their devices (`thread.updated`).
- Staff reply templates (`message_templates`): shared by the school or private to a teacher, inserted from the composer and editable before sending.
- Safeguarding: messages are retained and auditable. Staff cannot delete parent messages.

## Broadcasts
See [08](08-staff-portal.md#communications). Channels:
- **App push:** always used for guardians with the app.
- **SMS:** for guardians without the app, or when the broadcast is marked urgent.
- **Email:** optional.

The cost of SMS is shown before sending (`POST /broadcasts/preview`), at the school's SMS rate. **Urgent** broadcasts (safety, closures) override preferences and quiet hours and add SMS for everyone with a phone.

## Notifications
| Category | Examples | Default channels |
|---|---|---|
| `absence` | "Kavindu is not in the register" (09:00) | push + SMS |
| `rewards` | "Amaya earned 5 house points" | push |
| `finance` | new invoice, reminder, payment received | push + email |
| `news` | news posts, stories | push (no sound) |
| `moments` | new moment, weekly recap | push |
| `messages` | new message | push |
| `events` | booking opens, form to sign, report ready, exam timetable published | push |

- Guardians control each category in Profile → Notifications, plus **SMS backup** (`guardians.sms_backup`), which also sends `absence` alerts and urgent broadcasts by SMS. The prototype groups the switches differently; these seven categories win. The school can mark a broadcast "urgent", which overrides the preferences.
- Push uses Firebase Cloud Messaging (HTTP v1 API via `firebase-admin` in the API), with one Firebase project per environment (`quad-dev`, `quad-staging`, `quad-prod`); iOS delivery goes through APNs with an APNs auth key uploaded to each Firebase project. A token that FCM reports as unregistered is removed.
- Every notification is also stored in `notifications` for the in-app list.
- The quiet hours rule applies to staff pushes, not to guardians.

## Delivery providers
Every outbound message goes through the `send-email`, `send-sms` and `send-push` queues, behind a provider interface in `apps/api/src/messaging` so a provider can be swapped. Locally, email goes to Mailpit and SMS and push are written to the API log.

| Channel | Provider | Details |
|---|---|---|
| Email | Amazon SES (ap-south-1) from `mail.quad-edu.com` | SPF, DKIM and DMARC (`p=quarantine`) on `mail.quad-edu.com`; the apex domain keeps Google Workspace for Quad staff mail. From: "{School name} via Quad <no-reply@mail.quad-edu.com>"; Reply-To: the school's office email from School settings (Quad's own mail uses `support@quad-edu.com`). Bounces and complaints arrive through SNS and add the address to a suppression list; the guardian's record shows "Email bouncing" to the school |
| SMS, Sri Lanka (+94) | Notify.lk | A registered sender ID per school where approved, otherwise "QUAD". OTPs always use "QUAD" |
| SMS, other countries | Twilio | Alphanumeric sender where the country allows it, otherwise a Twilio number |
| Push | Firebase Cloud Messaging (HTTP v1) | One Firebase project per environment; APNs auth key in Firebase for iOS |

- **SMS costs** are counted per school and month (segments × the provider rate) and passed on to the school as a usage line on Quad's platform invoice ([13](13-fees-payments-finance.md#platform-billing-console)). The broadcast preview shows the estimate at the school's rate before sending.
- Delivery receipts update the message status (sent, delivered, failed) where the provider reports it. Failed SMS are retried once on the other provider when the country allows it.
- Message text in logs is never stored; only ids, the channel and the status.
