# Learning Portal

A white-label learning-management app (student portal + admin console) built
with **React + Vite**. Branding (name and logo) is configurable in **Settings**,
so the same build can be deployed for any client.

## Stack

- React 18 + React Router 6
- Vite 5 (dev server / build)
- lucide-react icons
- Plain CSS design system (`src/styles.css`)

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

Build for production:

```bash
npm run build
npm run preview
```

## Demo accounts

Sign in with any of these emails (tap a card on the login screen):

| Email             | Role          | Notes                  |
| ----------------- | ------------- | ---------------------- |
| `chamira@demo.lk` | Administrator | Full admin console     |
| `ravi@demo.lk`    | Student       | Enrolled in 2 courses  |
| `amara@demo.lk`   | Student       | Enrolled in 3 courses  |
| `dilan@demo.lk`   | Student       | Invited, no courses    |

## Features

**Student portal**
- Dashboard with stat cards + enrolled-course grid
- Course view with Recordings / Links / Materials tabs
- Locked courses shown to make the access boundary visible

**Admin console**
- Access control — enrolment matrix (the source of truth)
- Students — invite / remove, status badges
- Courses — create courses, attach & remove recordings/links/materials
- Settings — white-label branding (portal name, company line, logo)

> All data is in-memory mock data and resets on reload. Branding persists in
> `localStorage`. In production the enrolments table would be enforced by
> row-level security server-side.

## Project structure

```
src/
  main.jsx            entry
  App.jsx             router + role guards
  state.jsx           in-memory store + branding (React context)
  data.js             seed courses + users
  styles.css          design system
  components/Layout.jsx
  pages/Login.jsx
  pages/student/{Dashboard,CourseDetail}.jsx
  pages/admin/{Access,Students,Courses,Settings}.jsx
```
