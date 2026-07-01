# Learning Portal

A white-label learning-management app: a student portal plus an admin console.
**React + Vite** frontend, **Node + Express + MySQL** backend. All branding
(name, logos, favicon, email header) is configured in **Settings**, so one build
serves any client.

## Stack

- Frontend: React 18, React Router 6, Vite 5, lucide-react icons, plain CSS (`src/styles.css`)
- Backend: Express (`server.cjs`) + MySQL (`mysql2`); bearer-token sessions stored in the DB
- Auth: bcrypt password hashes (`bcryptjs`), optional TOTP 2FA (`totp.cjs`), optional captcha (hCaptcha / Google reCAPTCHA)
- Email: `nodemailer` (SMTP set in Settings); PDF certificates: `pdfkit`; 2FA QR: `qrcode`
- Uploads: `multer`; backup zips: `adm-zip`; config: `dotenv`

## Quick start (local)

```bash
npm install
npm run build        # builds the frontend into dist/
npm start            # serves API + dist on http://localhost:3000
```

For live UI reload, run the API and Vite together (Vite on :5173 proxies /api to :3000):

```bash
npm start            # terminal 1: API on :3000
npm run dev          # terminal 2: Vite on :5173
```

## Configuration (env)

Database credentials and the first-admin bootstrap come from environment
variables (never committed). Locally use a `.env` file (gitignored); in
production use the cPanel Node.js app "Environment variables" panel.

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name

# First admin on an empty DB (defaults: admin / admin123)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=admin@example.com
ADMIN_NAME=Administrator
```

Tables and any new columns are created automatically on boot (idempotent
migrations); existing data survives deploys. The `/setup` page creates the first
admin from the browser while none exists, and `node create-admin.cjs` creates or
resets the admin from the `.env` values.

## Build & deploy

- `dist/` is committed on purpose so the production host never has to build.
  **Always run `npm run build` before committing UI changes.**
- Host: cPanel + LiteSpeed running the Node app. Entry point: `server.cjs`.
- Deploy on the server with `redeploy.sh` (pull -> npm install -> kill the stale
  LiteSpeed worker -> restart -> verify):

```bash
sh redeploy.sh
```

- Backend changes (`server.cjs` / `db.cjs`) need the full restart (`redeploy.sh`).
  Frontend-only changes just need the new `dist/` served.

## Conventions (read before changing code)

- Match the surrounding code style; the design system is plain CSS in `src/styles.css`.
- **White-label:** never hard-code a client name or logo; anything brandable lives in Settings.
- **Money** is handled in integer cents in the payment waterfall so totals never drift.
- **Dates:** a payment's date is stored as the local-midnight timestamp of the chosen
  day. Format timestamps with `fmtDateMs()` (local time), not `toISOString()` (UTC),
  or dates shift back a day for timezones ahead of UTC.
- **Per-batch:** fees, content unlocking, exam unlocking and rosters are per batch, not per course.

## Roles

- **Student** and **Admin** (with a **super admin** tier that unlocks Settings).
- **Instructors** exist as profiles assigned to courses (their name/title shows to
  students) but they do **not** have portal logins.

## Features

### Student portal
- Dashboard: enrolled courses, stats, and certificates (download once, then locked).
- Course view tabs: Recordings, Course links, Materials, Payments, Certificate, Exams.
  The course description opens from an info (i) icon beside the title (popup).
  Switching tabs scrolls back to the top.
- Recordings can carry a per-recording link passcode; a "Copy Link Password" button
  copies it to the clipboard (the passcode itself is never shown).
- Content can be gated by payment stage (unlocks after a given installment).
- Payments tab: the student's own schedule, with each installment and the payments that funded it.
- Certificate tab: download once, only when the course is fully paid AND the certificate
  is issued; "Request re-download" asks the admin to re-enable it.
- Exams: timed multiple-choice with instant scoring and retakes (per-exam attempt limit,
  0 = unlimited). Exams can be locked until a payment level is reached (per batch).
- Browse and request enrolment; account page (profile, avatar, password, 2FA).

### Admin console
- Students: invite by email (they set their own password via a link), search/filter,
  and per-student manage tabs (Profile, Courses, Payments, Payment history, Activity, Overview).
  Rich delete warning; lock (set inactive). Moving a student to another batch keeps their
  old batch price. Removing a course deletes that one course's payment data. Activity log per student.
- Courses: create with a rich-text description; course cards show a word-limited preview.
- Manage a course (per batch): batch selector + Start new batch; Details (title,
  rich-text description, certificate template); Payment plan (fees + "Unlock exams" level);
  Enrolled students (read-only roster of the selected batch); Instructors; Recordings /
  Links / Materials (each with an "unlocks at" payment stage; recordings also have a link
  password); Certificates (scoped to this course + batch: issue, email, unlock re-download).
- Exams: per-exam question bank (single or multiple answer, partial marks), CSV
  import/export, time limit, attempts (0 = unlimited), and paginated results.
- Requests: approve or decline enrolment requests. Payments overview: overdue list and reminders.
  Backup: download and restore. Settings (super admin only).
- Settings: branding (name, company, logo, light-background logo, email logo, favicon),
  login-page description (rich text), course-card word limit, SMTP, captcha,
  registration-number format, overdue reminders, administrator management, and backup/restore.

## Key concepts

- **Batches:** each course runs in numbered batches (cohorts). Fees, content, exams and
  rosters are per batch. Starting a new batch copies the previous batch's content and plan
  (students are not copied).
- **Payment plans:** a per-batch template (registration fee + N installments + dates) is
  applied to every enrolled student. Recorded payments fill the schedule as a waterfall
  (each installment filled before the next), computed live in integer cents.
- **Content gating:** recordings/links/materials have an "unlocks at" stage (everyone /
  registration fee / installment N); students see them locked until that stage is paid.
- **Exam gating:** per batch, "Unlock exams" is fully paid (default), everyone, or after a
  given installment; enforced on the exam start endpoint and shown as locked in the UI.
- **Certificates:** issued per student for a course (stamped with the student's batch);
  one-time download gated on full payment; the admin can unlock a re-download.

## Data & auth

All data lives in MySQL. Passwords are bcrypt hashes and never sent to the browser.
Sessions are stored in the database (optional 30-day "remember me"), so a server
restart does not log users out. After sign-in the client holds a bearer token;
students only ever receive their own enrolled courses, and content for a locked
course is withheld by the API until it is unlocked.

## Project structure

```
server.cjs           Express API + serves the built frontend (host entry)
db.cjs               MySQL pool, schema, idempotent migrations, query helpers
cert.cjs             pdfkit certificate generator + template loader
email.cjs            branded HTML email shell (blue header, white text)
totp.cjs             RFC 6238 TOTP (two-factor) helpers
create-admin.cjs     CLI to create or reset the admin from .env
redeploy.sh          server-side pull + restart script
cert-templates/      selectable certificate designs (one .cjs each)
src/
  main.jsx           entry
  App.jsx            router + role guards + load gate
  state.jsx          API-backed store (React context; brand, favicon, session)
  styles.css         design system
  lib/payments.js    payment formatting, waterfall allocation, date helpers (fmtDate, fmtDateMs)
  lib/text.js        HTML-to-text preview and word limiting for course cards
  lib/image.js       client-side logo/avatar/favicon resize (WebP)
  components/        Layout, Popup, Pagination, SearchSelect, Button, RichTextEditor,
                     PhoneInput, Captcha, TwoFactor
  pages/             Login, Register, Setup, Forgot, Reset, Account
  pages/student/     Dashboard, MyCourses, CourseDetail, Browse, ExamTake
  pages/instructor/  Dashboard, CourseView   (view-only; instructors cannot log in)
  pages/admin/       Students, StudentManage, Courses, CourseManage (includes certificates),
                     Instructors, InstructorManage, Requests, Exams, ExamManage, Payments, Settings
```
