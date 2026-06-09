# Learning Portal

A white-label learning-management app (student portal + admin console) with a
**React + Vite** frontend and a small **Node + SQLite** backend. Branding (name
and logo) is configurable in **Settings**, so the same build serves any client.

## Stack

- Frontend: React 18 + React Router 6, Vite 5, lucide-react icons
- Backend: Express server (`server.cjs`) + SQLite (`better-sqlite3`)
- Auth: bcrypt-hashed passwords (`bcryptjs`), bearer-token sessions
- Plain CSS design system (`src/styles.css`)

## Run locally

The frontend and API run together through the Node server:

```bash
npm install
npm run build        # build the frontend into dist/
npm start            # serves API + dist on http://localhost:3000
```

For live frontend reloading during development, run the API and Vite together
(the dev server proxies /api to port 3000):

```bash
npm start            # terminal 1: API on :3000
npm run dev          # terminal 2: Vite on :5173
```

## Seed accounts

Sign in with a username and password (both students and admins use the same form):

| Username  | Password    | Role          | Notes                 |
| --------- | ----------- | ------------- | --------------------- |
| `admin`   | `admin123`  | Administrator | Full admin console    |
| `ravi`    | `ravi123`   | Student       | Enrolled in 2 courses |
| `amara`   | `amara123`  | Student       | Enrolled in 3 courses |
| `dilan`   | `dilan123`  | Student       | No courses yet        |

## Features

**Student portal**
- Dashboard with stat cards + enrolled-course grid
- Course view with Recordings / Links / Materials tabs
- Locked courses shown to make the access boundary visible

**Admin console**
- Access control: enrolment matrix (the source of truth)
- Students: add with username + password, remove, status badges
- Courses: create courses, attach & remove recordings/links/materials
- Settings: white-label branding (portal name, company line, logo)

## Data & auth

All data lives in a SQLite database (`data.sqlite`, created on first run and
gitignored so it persists across deploys). Passwords are stored as bcrypt
hashes and never sent to the browser. After sign-in the client holds a bearer
token; students only ever receive their enrolled courses from the API.

## Project structure

```
server.cjs            Express API + serves the built frontend (Passenger entry)
db.cjs                SQLite schema, seed data, and query helpers
src/
  main.jsx            entry
  App.jsx             router + role guards + load gate
  state.jsx           API-backed store (React context)
  styles.css          design system
  components/Layout.jsx
  pages/Login.jsx
  pages/student/{Dashboard,CourseDetail}.jsx
  pages/admin/{Access,Students,Courses,Settings}.jsx
```
