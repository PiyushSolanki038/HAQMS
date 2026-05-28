# HAQMS – Bug Fixes & Improvements
**Submitted by:** Piyush Solanki  
**Email:** piyushsolanki381@gmail.com  
**Date:** May 28, 2026

---

## What is this project?

HAQMS stands for Hospital Appointment and Queue Management System. It's a full-stack web app built with Next.js on the frontend, Express.js on the backend, and PostgreSQL as the database using Prisma ORM. The repo was intentionally filled with bugs across five different areas — security, performance, database, frontend, and some incomplete features — and the goal was to find and fix as many as I could.

I went through the entire codebase file by file, ran the app locally, tested each endpoint, and made notes on everything that looked wrong. Below is what I found and what I did about it.

---

## Tech Stack

- **Frontend** — Next.js 16 (App Router) + Tailwind CSS
- **Backend** — Node.js + Express.js
- **Database** — PostgreSQL + Prisma ORM
- **Auth** — JWT tokens with bcryptjs
- **Deployed on** — Vercel (both frontend and backend), Neon for PostgreSQL

---

## Issues I Found and Fixed

### 1. Security Issues

---

**Anyone could delete patients (broken admin check)**

When I looked at the middleware file, I saw the `authorizeAdminOnlyLegacy` function had the actual role check commented out. There was a comment saying a junior dev commented it out because it was "causing issues during testing." This meant literally anyone logged in — even a receptionist — could call the DELETE patient endpoint and it would go through.

Fix was simple — just uncomment the two lines that check `req.user.role !== 'ADMIN'`. Now only admin accounts can delete patients.

---

**JWT tokens that never expire**

The `authenticate` middleware had `ignoreExpiration: true` passed to `jwt.verify()`. This means even if someone got hold of an old token, it would work forever — no matter how old it was. On top of that, new tokens were being generated with a 365-day expiry.

I removed `ignoreExpiration` so tokens properly expire, and changed the expiry from 365 days down to 24 hours. Much more reasonable for a hospital staff app.

---

**SQL injection in the doctor search**

This one was serious. The doctor search endpoint was building SQL queries by directly concatenating user input into a string, then running it with `$queryRawUnsafe`. You could literally type `House' UNION SELECT id, email, password FROM "User" --` into the search box and get back every user's password hash from the database.

I replaced the whole raw SQL approach with Prisma's normal `findMany` with a `contains` filter. Prisma handles parameterization automatically so this kind of attack is not possible anymore.

---

**Passwords being logged and hash returned in API response**

Two things I noticed in the auth routes — first, every login and registration attempt was printing the raw password to the console via `console.log`. In production, anyone with log access could see user passwords in plaintext.

Second, the registration endpoint was returning the full user object in the response, which included the hashed password. Even though it's hashed, there's no reason to send that to the client.

Also the login error was returning `error.stack` — the full Node.js stack trace with file paths and everything.

Fixed all three: removed the console logs, filtered the response to only return safe fields (id, email, name, role), and removed the stack trace from error responses.

---

### 2. Performance Issues

---

**N+1 query problem in appointments**

The appointments endpoint was doing something that's a classic backend mistake. It would first fetch all appointments, then loop through each one and run two separate database queries — one for the patient, one for the doctor. So if there were 50 appointments, that's 1 + 100 = 101 database queries for a single API call.

The fix is one line — add `include: { patient: true, doctor: true }` to the initial `findMany` query. Prisma handles the JOIN and everything comes back in a single query.

---

**Sequential database calls in doctor stats**

The `/doctors/stats` endpoint was running four completely independent database queries one after another using `await`. Each one waited for the previous to finish before starting. There's no reason for this since none of them depend on each other.

Wrapped them all in `Promise.all()` so they run in parallel. Response time dropped noticeably.

---

**The reports endpoint was painfully slow**

This was the worst performance bug. The admin reports endpoint looped through every doctor and ran 5 separate database queries per doctor, all sequentially. And on top of that, there was an artificial `setTimeout` delay of 80ms per doctor, supposedly to "ensure the database connection doesn't drop" — which makes no sense.

With 5 doctors that's already 400ms of fake waiting plus 25+ database round trips. I rewrote it to use `Promise.all` so all doctor queries run in parallel, and I removed the sleep entirely. It went from 600ms+ down to under 50ms.

---

**Race condition in queue check-in**

The queue check-in had a textbook race condition. The code would read the current maximum token number, then wait (there was a 350ms artificial delay), then insert a new token with max + 1. If two patients checked in at the same time, both requests would read the same max value, and both would try to create the same token number — resulting in duplicates.

I fixed this by wrapping the read-and-write in a Prisma `$transaction` with `isolationLevel: 'Serializable'`. With serializable isolation, PostgreSQL guarantees that two concurrent transactions can't both read the same max and both succeed. One of them gets forced to retry. The 350ms sleep was also removed.

---

### 3. Database Issues

---

**Fetching everything into memory for pagination**

The patients list endpoint was fetching ALL patients from the database, loading them into a JavaScript array, then filtering and slicing in Node.js to simulate pagination. This completely defeats the purpose of a database.

Replaced it with proper SQL-level filtering using Prisma's `where`, `skip`, and `take`, plus a `count` query running in parallel to get the total. Only the 5 records for the current page ever leave the database.

---

**Missing indexes on important columns**

Looking at the Prisma schema, several columns that are heavily used in WHERE clauses had no indexes at all — things like `Doctor.specialization`, `Doctor.department`, `Appointment.doctorId` + `status` together, `Appointment.patientId`, and `QueueToken.status`. Without indexes, every filter query does a full table scan.

Added `@@index` declarations for all of them in the schema.

---

### 4. Frontend Issues

---

**Memory leak in the queue monitor page**

The public queue page polls the backend every 3 seconds using `setInterval`. The problem was that the `useEffect` hook never returned a cleanup function. So every time you navigated to the queue page and back, a new interval was created. Navigate 10 times and you have 10 timers all hammering the server simultaneously, and React would throw warnings about state updates on unmounted components.

Fix is literally one line — `return () => clearInterval(intervalId)` at the end of the `useEffect`.

---

**App crashing when a patient has no medical history**

The doctor dashboard was calling `.toUpperCase()` directly on `patient.medicalHistory` without checking if it was null first. Four patients in the seed data have `medicalHistory: null` (Bruce Wayne, Clark Kent, Diana Prince, and one more). Clicking any of them in the appointment list would throw a runtime error and crash the whole page.

Added a null check — if medical history is null, show "No medical history on record." instead of crashing.

---

**API URL hardcoded in source code**

The backend URL `http://localhost:5000/api` was hardcoded in two different places — `AuthContext.js` and `queue/page.js`. This makes the app impossible to deploy without manually editing source code.

Moved it to a `NEXT_PUBLIC_API_BASE_URL` environment variable with a localhost fallback. The value gets set in `.env.local` for local development and in Vercel's environment settings for production.

---

### 5. Incomplete Feature

---

**Missing patient history page**

The doctor's appointment list had a "View Diagnostic Reports Details" link for each patient that pointed to `/patients/[id]/history-records`. This route didn't exist — clicking it gave a 404.

I built the page from scratch. It shows the patient's basic info (name, age, gender, contact), their full medical history with a proper fallback if none is recorded, and a table of all their past appointments with dates, reasons, and statuses. It also has proper loading and error states, and a back button to return to the dashboard.

---

## Summary Table

| # | Category | File | Bug | Fix |
|---|---|---|---|---|
| 1 | Security | auth.js (middleware) | Admin check commented out | Restored the role check |
| 2 | Security | auth.js (middleware) | Tokens never expire | Removed ignoreExpiration, set 24h expiry |
| 3 | Security | routes/doctors.js | SQL injection via raw query | Replaced with Prisma findMany |
| 4 | Security | routes/auth.js | Password logging + hash in response | Removed logs, filtered response |
| 5 | Performance | routes/appointments.js | N+1 queries | Used Prisma include |
| 6 | Performance | routes/doctors.js | Sequential async calls | Used Promise.all |
| 7 | Performance | routes/reports.js | Nested loop + fake delays | Parallel Promise.all, removed sleep |
| 8 | Performance | routes/queue.js | Race condition + 350ms sleep | Serializable transaction, removed sleep |
| 9 | Database | routes/patients.js | In-memory pagination | SQL skip/take/count |
| 10 | Database | prisma/schema.prisma | Missing indexes | Added @@index to 7 columns |
| 11 | Frontend | app/queue/page.js | Memory leak (no clearInterval) | Added cleanup return |
| 12 | Frontend | app/dashboard/page.js | Null crash on medicalHistory | Added null check |
| 13 | Frontend | AuthContext.js + queue/page.js | Hardcoded localhost URL | NEXT_PUBLIC_API_BASE_URL env var |
| 14 | Feature | patients/[id]/history-records | Page didn't exist (404) | Built the full page |

---

## What I didn't fix (and why)

There were a few things I noticed but chose not to fix because the assignment explicitly says you're not expected to fix everything, and I wanted to be honest about prioritization.

**Patient search re-fetches on every keystroke** — The `useEffect` that calls `fetchPatients` runs on every character typed in the search box. A debounce of 300ms would fix this. I skipped it because it's a UX improvement rather than a bug and the backend search is fast enough.

**No rate limiting on login** — The login endpoint has no protection against brute force attempts. In production you'd add `express-rate-limit`. I didn't implement it because it would add a dependency and wasn't part of the five bug categories.

**Token refresh not implemented** — After 24 hours the user gets logged out. A proper refresh token flow would handle this silently. Left it out because it's a significant feature addition.

---

## How to run locally

```bash
# Start the database
docker-compose up -d

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Set up environment
cd backend && cp .env.example .env

# Push schema and seed data
cd backend && npx prisma db push && node prisma/seed.js

# Start both servers
cd backend && npm run dev       # runs on http://localhost:5000
cd frontend && npm run dev      # runs on http://localhost:3000
```

Test accounts (password is `password123` for all):
- **Admin** — admin@haqms.com
- **Receptionist** — reception1@haqms.com  
- **Doctor** — doctor1@haqms.com

---

## Deployed URLs

- **Frontend** — https://haqms-q1qr.vercel.app
- **Backend** — https://haqms-backend-eight.vercel.app
- **GitHub** — https://github.com/PiyushSolanki038/HAQMS
