# 14 Academics

Prototypes: Timetable, Teachers & classes, My teaching, Staff cover, Courses & gradebook, Exams, Reports and Academic year in `design/admin.html`. Algorithms live in `packages/domain`, with unit tests.

## The curriculum drives everything
- The school's curriculum (set in the console) defines stages, year groups, labels, the grading scale and qualifications. Every screen uses these labels.
- Each stage has a **kind**: `early`, `primary`, `middle`, `exam` or `sixth`. The kind is inferred from the stage name and ages, and can be changed. It sets defaults:
  - **Subjects:** Early Years get Literacy, Numeracy, Understanding the world, Creative play and Physical play. Primary gets English, Mathematics, Science, Sinhala or second language, Art, Music, PE and ICT. Secondary and exam stages get qualification subjects. Sixth form gets option blocks. IB uses PYP units, MYP subject groups, and DP with TOK.
  - **Bell schedule:** for example, Early Years 08:00–12:00 with 2 breaks, Primary 08:00–13:30, Senior 07:50–14:20 with 8 lessons and 2 breaks.
- **Subjects per year group:** in the Subjects drawer, add or remove subjects, set periods per week, and reorder. A warning shows when the total periods do not equal the lessons in the bell schedule × 5 (or × 10 for an A/B week).
- **Bell times per stage:** in the Bell times drawer, add or remove periods and breaks, set times (validated: no overlaps, increasing), and label breaks ("Interval", "Lunch").

## Teachers & classes (staffing)
Tabs:
- **Teachers:**
  - A list with subjects, classes taught, responsibilities (class teacher of …, head of …) and load (periods per week against their maximum, with a bar).
  - The teacher drawer has: subjects (multi-select), primary teacher flag, maximum periods, class-teacher assignment, and section-head role.
- **Classes:**
  - Cards per year group, grouped by stage.
  - Each class card shows: the class teacher, number of students, and subjects with their teacher. A subject with no teacher shows "Not assigned".
  - Assign by picking a teacher from those who teach that subject. The picker shows their current load.
- **Sections:** heads and deputies per stage.

Rules: a primary-stage class teacher teaches most subjects in their class by default. A teacher's load is the sum of periods per week across their assignments.

## Timetable
- Toolbar:
  - a year-group dropdown (grouped by stage), class chips, and the class teacher;
  - the stage's day summary ("Senior School day · 8 lessons · 2 breaks · 08:00–14:20");
  - Week A/B toggle;
  - actions: Subjects, Bell times, Rearrange, Share with parents.
- Grid: days × periods with break rows, subject colour cards showing teacher and room, and today's column with a NOW marker.
  - Click a cell to see the lesson detail (substitute, swap, room change).
  - In Rearrange mode, drag and drop to swap lessons, with a live check for teacher clashes.
- **Generator** (`packages/domain/timetable`):
  - Input: classes, subjects per year group with periods, teaching assignments, bell schedules, rooms, and teacher unavailability.
  - Output: slots for every class and week, built **school-wide at once**.
  - Hard constraints:
    - no teacher in two places at once;
    - no class double-booked;
    - a room's capacity and kind match the subject (labs for sciences, the sports hall for PE).
  - Soft constraints:
    - spread each subject across the week (no more than 2 a day);
    - doubles allowed for practicals;
    - core subjects in the morning for primary;
    - respect the teacher's maximum periods.
  - Approach: place the most constrained items first, then run a repair pass that swaps lessons to resolve clashes. It must finish within 10 s for a 1,500-student school.
  - The result reports zero hard-constraint violations, or lists what could not be placed.
- **Publish:** teachers see it in My teaching, and parents see their child's timetable. Changes after publishing are versioned, and parents are notified of changes from today on.

## My teaching (teacher view)
- A "view as teacher" picker for admins; teachers see their own view.
- Greeting with today's lesson count and weekly periods.
- **Hero:** the current lesson (time left) or the next lesson.
- Stats: lessons done today, reports to write, my class.
- **Today timeline:** each lesson with its time, subject, class, room and period. Actions: Register, and Marks & comments. Past lessons are greyed out and the current one is highlighted. Cover lessons have a "Cover" pill.
- **Needs you:**
  - cover requests (Accept / Can't cover);
  - report comments to write per class;
  - morning registration for my class;
  - parent messages waiting.
- **Moments:** see [12](12-moments-messaging.md#staff-side-my-teaching--moments-card-and-a-share-a-moment-button).
- **My class:** students, absent today, report-comment progress, faces, and links.
- **My week:** five columns of lessons, with clashes highlighted (there should be none after generation).

## Staff cover
- Shows today's absent staff: name, reason, part of the day, and the number of lessons. **Report absence** opens a drawer with teacher, date, full day / morning / afternoon, and reason.
- **Cover board:** every lesson that needs cover (time, absent teacher, class and subject, room), each with a "Cover" picker. The picker lists only free teachers, sorted by:
  1. subject specialists first;
  2. fewest covers today;
  3. fewest covers this term.
  
  Each option shows "teaches {subject}" and "{n} this term".
- **Auto-assign** fills every lesson using the same order and never gives a teacher two lessons at the same time.
- **Publish cover sheet** is turned off until every lesson is covered. Publishing notifies the cover teachers, adds the lessons to their My teaching and the timetable, and prints a sheet (PDF).
- **Fair share** list: covers this term per teacher.

## Courses & gradebook
- Course spaces per class and subject, with cover colour, teacher, average and assignments due.
- Assignments: create (title, due date, marks, weight, type); submissions (missing, submitted, late, excused).
- **Weighted gradebook:**
  - students × assignments, with marks editable inline;
  - the weighted average recalculates as you type and is converted to a grade on the school's scale;
  - missing work is highlighted;
  - export CSV.

## Exams
- **Series:** an internal Term 1 series plus one series per qualification in the curriculum (for example Checkpoint, IGCSE and A Level for Cambridge; Scholarship, O/L and A/L for the Sri Lankan curriculum). Each series has dates and status.
- **Generator** (`packages/domain/exams`):
  - Each year group gets sequential sessions (AM 08:30 and PM 12:30 on school days), one paper per session, so there are never two papers for the same year group in a session.
  - Room allocation by capacity: Main hall 220, Sports hall 160, classrooms 30 each. Candidates are the year group's student count, or the qualification entries.
- **Timetable view:** papers laid out by day and session, each with subject, paper, year group, duration, room and candidates. Add or edit a paper in a drawer.
- **Clash check:** the same year group in the same session, or a room over capacity. Clashing papers are flagged in red with a reason, and **Publish** is turned off while any exist.
- Publishing makes the series visible in the parent app (Exams, and a to-do on Home) and notifies parents.

## Reports
- **Report cycle**, for example "Term 1 report", due 11 Dec.
- Per class, the steps are:
  1. **marks and comments**: subject teachers enter a mark (with the grade derived from the scale), effort and a comment;
  2. **class teacher comment**;
  3. **head review**: approve, or send back with a note;
  4. **publish**.
  
  Progress bars per class show the comments completed.
- Comment helpers: a comment bank per subject, plus Ask Quad "Suggest a comment from marks and notes", which the teacher must edit and confirm (never auto-filled).
- Publishing renders a PDF per student (school letterhead, grades, comments, attendance) with the `render-report-pdfs` job. Parents get "{child}'s Term 1 report is ready" on Home, and the report appears under Reports.
- Grades always come from the curriculum's scale (`gradeFor(mark)`).

## Academic year and rollover
- The current year shows a term timeline with a today marker, students by year group, and holidays (with Poya days for Sri Lanka).
- **Pre-rollover checks** (each passes or warns):
  - reports published;
  - invoices settled or carried forward;
  - next year's classes set up;
  - final-year students marked as leaving;
  - timetable drafted for next year.
- **Rollover** (a job with a preview of every change):
  - promotes each student one year group, keeping the same class name by default (editable);
  - graduates the final year;
  - archives the year as read-only;
  - copies structure, subjects and bells to the new year;
  - carries forward open balances;
  - resets registers.
- Past years stay browsable read-only from the year picker.
