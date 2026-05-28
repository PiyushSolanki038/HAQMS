# HAQMS — What I Found and What I Fixed

**Submitted by:** Piyush Solanki  
**Email:** piyushsolanki381@gmail.com  
**GitHub:** https://github.com/PiyushSolanki038/HAQMS  
**Live App:** https://haqms-q1qr.vercel.app  
**Date:** May 28, 2026

---

## About the Project

HAQMS is a Hospital Appointment and Queue Management System. The tech stack is Next.js on the frontend, Express.js on the backend, and PostgreSQL with Prisma ORM for the database. The repo was intentionally seeded with bugs across five categories — security, performance, database, frontend, and an incomplete feature — and the task was to find and fix as many as possible.

I started by reading the entire codebase top to bottom before writing a single line of code. I wanted to understand how everything connected before I started changing things. Then I ran the app locally, tested each endpoint manually, and made a list of everything that looked wrong. Below is what I found.

---

## Issues I Found and Fixed

### Security

**1. Anyone could delete patients**

The middleware file had a function called `authorizeAdminOnlyLegacy` that's supposed to restrict certain actions — like deleting patient records — to admins only. But the actual role check was commented out. There was a comment that said a junior developer had commented it out because it was "causing issues during testing." So literally any logged-in user, including a receptionist or a doctor, could hit the DELETE endpoint and it would go through.

The fix was two lines — just uncomment the role check. Now only admin accounts can delete patients.

**2. JWT tokens that never expired**

The authentication middleware was calling `jwt.verify()` with `{ ignoreExpiration: true }`. This meant that even an old, expired token would still be accepted. On top of that, new tokens were being created with a 365-day expiry. A stolen token would work for a whole year.

I removed `ignoreExpiration` so tokens are properly validated, and changed the expiry to 24 hours.

**3. SQL injection in the doctor search**

This was the most serious one. The doctor search endpoint was building SQL queries by concatenating user input directly into a string and then running it with `$queryRawUnsafe`. An attacker could type something like `House' UNION SELECT id, email, password FROM "User" --` into the search field and get back every user's password hash.

I replaced the raw SQL approach with Prisma's `findMany` using a `contains` filter with `mode: 'insensitive'`. Prisma handles parameterization automatically so there's no way to inject SQL through it.

**4. Passwords logged in plaintext, hash returned in response, stack traces leaked**

Three things in the auth routes. First, every login and registration attempt was printing the raw password to the console — meaning anyone with access to the server logs could see user passwords. Second, the registration response was returning the full user object including the hashed password. There's no reason to send that to the client. Third, error responses were including the full Node.js stack trace with file paths, which gives an attacker useful information about the server.

Fixed all three: removed the console logs, filtered the registration response to only return safe fields (id, email, name, role), and removed stack traces from production error responses.

---

### Performance

**5. N+1 query problem in appointments**

The appointments endpoint fetched all appointments first, then looped through each one and ran two separate database queries — one for the patient, one for the doctor. With 50 appointments that's 101 database round trips for one API call. The fix is one line — use Prisma's `include` in the initial query so everything comes back together in a single query regardless of how many appointments there are.

**6. Sequential database calls in doctor stats**

The `/doctors/stats` endpoint ran four completely independent database queries one after another using `await`. Each one waited for the previous to finish even though none of them depended on each other. I wrapped them in `Promise.all()` so they run in parallel. Simple change, noticeably faster.

**7. Reports endpoint was extremely slow**

This was the worst performance bug. The admin reports endpoint looped through every doctor and for each one ran 5 separate database queries sequentially. And then there was an artificial `setTimeout` of 80ms per doctor with a comment saying it was "to make sure the database registers the record." With 5 doctors that's 400ms of fake waiting on top of 25+ database queries. I rewrote it using `Promise.all` so all queries run in parallel and removed the sleep entirely. Response time went from 600ms+ down to under 50ms.

**8. Race condition in queue check-in**

The token number assignment in queue check-in had a race condition. The code read the current max token number, waited 350ms (there was an artificial delay to make the race window wider), then inserted a new token with max + 1. If two requests came in at the same time, both would read the same max and both would try to create the same token number — duplicates in the queue.

I wrapped the read-and-write in a Prisma `$transaction` with `isolationLevel: 'Serializable'`. With serializable isolation, PostgreSQL guarantees that two concurrent transactions can't both succeed if they conflict — one retries automatically. The 350ms sleep was also removed.

---

### Database

**9. Entire patient table loaded into memory for pagination**

The patients list endpoint fetched every single patient from the database, loaded them all into a JavaScript array, filtered in Node.js, then sliced for pagination. This is fine with 10 patients, but completely breaks at scale. I replaced it with proper SQL-level filtering using Prisma's `where`, `skip`, and `take`, with a parallel `count` query. Only the records needed for the current page ever leave the database.

**10. Missing database indexes**

The Prisma schema had no indexes on several columns that are heavily used in WHERE clauses — `Doctor.specialization`, `Doctor.department`, `Appointment.(doctorId, status)`, `Appointment.patientId`, `Appointment.appointmentDate`, `QueueToken.(doctorId, createdAt)`, and `QueueToken.status`. Without indexes, every filter query does a full table scan. I added `@@index` declarations for all of them.

---

### Frontend

**11. Memory leak in the queue monitor**

The public queue page polls the backend every 3 seconds using `setInterval`. The `useEffect` hook never returned a cleanup function, so every time you navigated to the page and came back, a new interval was added on top of the existing ones. Navigate 10 times and you've got 10 timers all hammering the server. React also throws warnings about state updates on unmounted components. The fix is literally one line — `return () => clearInterval(intervalId)` at the end of the `useEffect`.

**12. App crashing when a patient has no medical history**

The doctor dashboard was calling `.toUpperCase()` directly on `patient.medicalHistory` without checking if it was null. Four patients in the seed data have no medical history — Bruce Wayne, Clark Kent, Diana Prince, and Peter Parker. Clicking any of them in the appointment list would throw a runtime error and crash the whole page. I added a null check that shows "No medical history on record." instead.

**13. Hardcoded API URL in two different files**

The backend URL `http://localhost:5000/api` was hardcoded directly in the source code in two places. This makes it impossible to deploy without editing source files. I moved it to a `NEXT_PUBLIC_API_BASE_URL` environment variable with a localhost fallback, and set the actual deployed URL in Vercel's environment settings.

---

### Incomplete Feature

**14. Missing patient history page (404)**

The doctor's appointment list had a "View Diagnostic Reports Details" link for each patient that pointed to `/patients/[id]/history-records`. This route didn't exist — clicking it gave a 404. I built the page from scratch. It shows the patient's full profile, their medical history with a fallback if it's null, and a table of all their appointments with dates and statuses. It handles loading and error states and has a back button to the dashboard.

---

## What I Didn't Fix

A few things I noticed but didn't fix because they were lower priority:

- **Search re-fetches on every keystroke** — the patient search runs a new API call with every character typed. A debounce would help but it's not broken, just slightly inefficient.
- **No rate limiting on login** — the login endpoint has no protection against brute force. In production you'd want something like `express-rate-limit` on `/api/auth/login`.
- **No token refresh** — after 24 hours users get logged out silently. A refresh token flow would be better UX but it's a larger feature.

---

## How I Thought About This

I prioritized by severity. Security issues first — a SQL injection that can dump the whole database is more urgent than a slow endpoint. Then performance issues that could corrupt data (the race condition) before ones that just slow things down. Frontend crashes before cosmetic issues. The missing page last since it's a UX gap, not a functional failure.

For the race condition specifically, I chose a database-level serializable transaction over an application-level lock because it works without additional infrastructure, scales across multiple server instances, and PostgreSQL's implementation is battle-tested. Some candidates might try to fix it by adding a unique constraint to the schema — that would also help, but the transaction approach is cleaner and handles the "what happens next" automatically.

For the SQL injection I chose to eliminate raw SQL entirely rather than try to sanitize the input. Input sanitization has edge cases. Using Prisma's query builder makes it impossible to construct SQL injection by design.

---

## Deployment

- **Frontend** — Next.js deployed on Vercel at https://haqms-q1qr.vercel.app
- **Backend** — Express.js deployed on Vercel (serverless) at https://haqms-backend-eight.vercel.app
- **Database** — PostgreSQL on Neon (free tier managed PostgreSQL)

Note: The first request after a period of inactivity may take 2-3 seconds because Neon's free tier database goes to sleep. This is a known limitation of free tier hosting and not a code issue.

---

## Running Locally

```bash
# Start database
docker-compose up -d

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Set up environment (copy .env.example to .env in backend folder)
cd backend && cp .env.example .env

# Push schema and seed data
cd backend && npx prisma db push && node prisma/seed.js

# Start both servers
cd backend && npm run dev      # runs on http://localhost:5000
cd frontend && npm run dev     # runs on http://localhost:3000
```

Test accounts (all use `password123`):
- admin@haqms.com
- reception1@haqms.com  
- doctor1@haqms.com
