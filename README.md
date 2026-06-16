# Learning Portal

A white-label learning-management app (student portal + admin console) with a
**React + Vite** frontend and a **Node + MySQL** backend. Branding (name and
logo) is configurable in **Settings**, so the same build serves any client.

## Stack

- Frontend: React 18 + React Router 6, Vite 5, lucide-react icons
- Backend: Express server (`server.cjs`) + MySQL (`mysql2`)
- Email: `nodemailer` (SMTP configured in Settings); certificates: `pdfkit`; QR for 2FA: `qrcode`
- Uploads: `multer`; backup archives: `adm-zip`; config: `dotenv`
- Auth: bcrypt-hashed passwords (`bcryptjs`), bearer-token sessions in the DB
- Plain CSS design system (`src/styles.css`)

## Configuration

Database credentials come from environment variables (never committed):

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
```

Set these in the cPanel Node.js App "Environment variables" panel. For local
development, put them in a `.env` file (gitignored). Tables and any new columns
are created automatically on startup (idempotent migrations), and existing data
is preserved across deploys.

On a fresh database the first administrator is created from optional env vars
(falling back to `admin` / `admin123`):

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=admin@example.com
ADMIN_NAME=Administrator
```

No demo students or courses are seeded. The `/setup` page can also create the
first admin from the browser while none exists, and `node create-admin.cjs`
creates or resets the admin from the `.env` values.

## Run locally

```bash
npm install
npm run build        # build the frontend into dist/
npm start            # serves API + dist on http://localhost:3000
```

For live frontend reloading, run the API and Vite together (the dev server
proxies /api to port 3000):

```bash
npm start            # terminal 1: API on :3000
npm run dev          # terminal 2: Vite on :5173
```

Note: `dist/` is committed so the production host only needs to serve it. Always
run `npm run build` before committing UI changes.

## Features

**Student portal**
- Dashboard with stat cards, recent courses, certificates, and a payments summary
- Course view with separate Recordings / Course links / Materials tabs
- Exams: timed multiple-choice papers with auto-submit and instant scoring
- Browse and request enrolment in other courses
- Account: edit profile, avatar, password, and enable two-factor authentication
- Registration number shown on the dashboard; locked courses display a clear notice

**Admin console**
- Students: invite by email (they set their own password via a link), search and
  filter (status, course, gender, payment status), optional NIC, auto-generated
  registration numbers, and per-student manage tabs (Profile / Courses / Payments / Overview)
- Courses: create courses, manage Recordings / Course links / Materials, assign
  instructors, and manage enrolment with a unified searchable student list
- Instructors: profiles with optional portal logins
- Requests: approve or decline student enrolment requests (searchable)
- Exams: per-exam question bank (single or multiple answer, partial marks),
  CSV import/export, time limits, and paginated results
- Certificates: issue PDF certificates (selectable templates), send by email, and unlock re-downloads
- Payments: per-course installment plans, recorded payments, balance and due dates,
  a payments list with search and paid/unpaid/overdue filters, per-course access
  lock, and overdue reminder emails (manual or daily scheduled)
- Settings: white-label branding, SMTP, hCaptcha, registration-number format,
  overdue-reminder schedule, administrator management, and database/file backup and restore

## Data & auth

All data lives in MySQL. Passwords are stored as bcrypt hashes and never sent to
the browser. Sessions are stored in the database (with optional 30-day "remember
me"), so a server restart does not log users out. After sign-in the client holds
a bearer token; students only ever receive their own enrolled courses from the
API, and content for a locked course is withheld until it is unlocked.

## Project structure

```
server.cjs            Express API + serves the built frontend (Passenger entry)
db.cjs                MySQL pool, schema, idempotent migrations, query helpers
cert.cjs              pdfkit certificate generator + template loader
email.cjs             branded HTML email shell
totp.cjs              RFC 6238 TOTP (two-factor) helpers
create-admin.cjs      CLI to create or reset the admin from .env
cert-templates/       selectable certificate designs (one .cjs each)
src/
  main.jsx            entry
  App.jsx             router + role guards + load gate
  state.jsx           API-backed store (React context)
  styles.css          design system
  lib/image.js        client-side avatar/logo resize
  components/         Layout, Pagination, SearchSelect, PhoneInput, HCaptcha, TwoFactor
  pages/              Login, Register, Setup, Forgot, Reset, Account
  pages/student/      Dashboard, MyCourses, CourseDetail, Browse, ExamTake
  pages/instructor/   Dashboard, CourseView
  pages/admin/        Students, StudentManage, Courses, CourseManage, Instructors,
                      InstructorManage, Requests, Exams, ExamManage, Certificates,
                      Payments, Settings
```
