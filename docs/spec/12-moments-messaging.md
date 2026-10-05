# 12 Moments, messages and notifications

## Moments

Moments bring the Quad Circle idea into the existing apps: teachers share small good things, and parents see them straight away.

### Staff side (My teaching → Moments card, and a "Share a moment" button)
- The card lists the teacher's recent moments, each with its thumbnail, who it is about, the text and the time. Parent reactions show as "♥ parent loved this" and the thank-you text.
- **Share a moment** drawer:
  - **Class:** the teacher's classes; class-teacher classes first.
  - **Who is it about:** the whole class, or one student from the class list.
  - **Type** (segmented): Photo, Praise or Great work.
  - **Photo** (for the Photo type): take a photo or choose one (mobile web: camera capture; desktop: file picker). Up to 4 images, each resized to 2048 px on the long edge, EXIF location removed. Until a photo is chosen, an illustrated tile can be used (art keys: mural, science, sports, reading, music, garden, maths, drama).
  - **What happened?** 5–240 characters.
  - **Photo consent check:** if any student in a whole-class photo, or the selected student, has no photo consent, the drawer warns "{n} students in this class don't have photo consent. Choose a photo without them, or share praise instead." It blocks sharing to the whole class until the teacher confirms that those students are not in the photo. (Automatic face blurring is v2.)
  - **Share with parents**: shows a petal burst and the toast "Shared with {child}'s parents" or "Shared with parents of {class}".
- Moderation: school admins can hide a moment (with a reason). Teachers can delete their own moments within 24 hours. Every moment is in the audit log.
- Limits: 20 moments per teacher per day.

### Parent side
See [09](09-parent-app.md#moments-tab). Who receives a moment: the guardians of the selected student, or of every student in the class for a whole-class moment. A thank-you creates a message in the thread with that teacher ("Thank you, Ms. Jayasinghe! …"), and the teacher also sees it on the moment.

### Data and events
Tables `moments`, `moment_reactions` and `moment_reads` (see [04](04-data-model.md#communication-t)). Events `moment.created` and `moment.reaction.created`. Push category `moments` ("Ms. Jayasinghe shared a moment of Amaya").

## Messages
- Threads between guardians and staff, or between guardians and an office (Finance Office, Admissions).
- A parent can start a thread with the class teacher, the child's subject teachers, or an office.
- A teacher can start one with the guardians of a student in their classes.
- Rich text (bold, lists, links), attachments (PDF and images, up to 10 MB), read receipts ("Seen"), a typing indicator, and quick replies.
- Office hours: when a teacher has quiet hours set (default 18:00–07:00 and weekends), parents see "Ms. Jayasinghe usually replies within school hours". Pushes to the teacher are held until morning; urgent messages go to the office.
- Expectation shown to staff: "Reply within two school days." Threads waiting longer than this show on the staff dashboard as a "Needs you" row.
- Safeguarding: messages are retained and auditable. Staff cannot delete parent messages.

## Broadcasts
See [08](08-staff-portal.md#communications). Channels:
- **App push:** always used for guardians with the app.
- **SMS:** for guardians without the app, or when the broadcast is marked urgent.
- **Email:** optional.

The cost of SMS is shown before sending, at the school's SMS rate.

## Notifications
| Category | Examples | Default channels |
|---|---|---|
| `absence` | "Kavindu is not in the register" (09:00) | push + SMS |
| `rewards` | "Amaya earned 5 house points" | push |
| `finance` | new invoice, reminder, payment received | push + email |
| `news` | news posts, stories | push (no sound) |
| `moments` | new moment | push |
| `messages` | new message | push |
| `events` | booking opens, form to sign, report ready, exam timetable published | push |

- Guardians control each category in More, Notifications. The school can mark a broadcast "urgent", which overrides the preferences.
- Push uses Expo Push (FCM and APNs behind it). Retry invalid tokens once, then remove them.
- Every notification is also stored in `notifications` for the in-app list.
- The quiet hours rule applies to staff pushes, not to guardians.
