# Video Recording Script — HAQMS Internship Assignment
**Figital Labs Full Stack Web Development Internship**  
**Target Duration:** 10–14 minutes  
**Tool:** Loom / OBS / any screen recorder

---

## Before You Start Recording

Open these things on your screen before pressing Record:
- VS Code with the HAQMS project open
- A browser at `http://localhost:3000`
- A terminal with the backend running

---

## PART 1 — Introduction (0:00 – 1:00)

**Say:**

> "Hi, my name is Piyush Solanki. This is my submission for the Figital Labs full stack internship assignment. The project is HAQMS — a Hospital Appointment and Queue Management System built with Next.js, Express.js, and PostgreSQL.
>
> The repo was intentionally seeded with bugs across five categories: security vulnerabilities, backend performance problems, database inefficiencies, frontend issues, and an incomplete feature. In this video, I'll walk through the major issues I found, the fixes I implemented, and then show the working application."

---

## PART 2 — Application Overview (1:00 – 2:30)

**Show the running app in the browser.**

**Say:**

> "Let me quickly show you what the application does. This is the landing page — you have two entry points: the Staff Portal and the Live Public Monitor."

→ Click **Live Public Monitor**

> "This is the public queue board. It polls the backend every 3 seconds and shows which patients are currently being called by each doctor. As we'll see shortly, this page had a serious memory leak."

→ Go back, click **Staff Portal → Login**

> "The staff login supports three roles: Admin, Receptionist, and Doctor. Let me log in as a Receptionist first."

→ Click the quick-fill button for **Receptionist** → Login

> "As a receptionist I can manage the patient directory, book appointments, and check in walk-in patients to the queue."

→ Click **Scheduling / Check-in Portal**

> "I can book appointment slots and generate queue tokens. Now let me switch to the Doctor role."

→ Logout → Login as **Doctor (doctor1@haqms.com)**

> "As a doctor I see my scheduled bookings and can control the calling queue — moving patients from waiting to calling to completed."

→ Logout → Login as **Admin**

> "And as admin I have a reports dashboard and can search the physician registry."

---

## PART 3 — Security Fixes (2:30 – 5:30)

### 3A — SQL Injection (Show in VS Code)

**Open `backend/src/routes/doctors.js`**

**Say:**

> "The most critical bug was a SQL injection vulnerability in the doctor search endpoint. Look at the original code — it was concatenating user input directly into a raw SQL string using `$queryRawUnsafe`. An attacker could type something like `House' UNION SELECT id, email, password FROM User --` and leak every user's password hash from the database."

→ Show the **fixed code** (the current file with `prisma.doctor.findMany`)

> "My fix was to eliminate raw SQL entirely and use Prisma's parameterized `findMany` with `mode: 'insensitive'` for case-insensitive search. Prisma handles parameterization automatically — there's no way to inject SQL through the `contains` filter."

→ **Demonstrate in the browser**: Go to Admin → Physician Registry → type a normal search like "House" → shows results correctly.

---

### 3B — Broken Admin Authorization (Show in VS Code)

**Open `backend/src/middleware/auth.js`**

**Say:**

> "The second security issue was in the `authorizeAdminOnlyLegacy` middleware. A junior developer had commented out the role check because it was 'causing issues during testing.' This meant any authenticated user — a receptionist or doctor — could call the admin-only DELETE patient endpoint."

→ Show the **fixed code** (current file with `role !== 'ADMIN'` check)

> "The fix was simple — restore the two lines that were commented out. Now only users with the ADMIN role can delete patient records."

---

### 3C — JWT & Password Issues (Show in VS Code)

**Open `backend/src/routes/auth.js`**

**Say:**

> "In the auth route I found three problems: passwords were being printed to the console in plaintext on every login, the registration response was returning the hashed password to the client — which is a security leak — and JWT tokens were set to expire after 365 days, meaning a stolen token would work for a year. I fixed all three: removed the console logs, filtered the registration response to only return safe fields, and changed the expiry to 24 hours."

---

## PART 4 — Performance Fixes (5:30 – 8:00)

### 4A — N+1 Query Problem (Show in VS Code)

**Open `backend/src/routes/appointments.js`**

**Say:**

> "The appointments endpoint had a classic N+1 query problem. It fetched all appointments, then looped through each one and issued two separate database queries to get the patient and doctor details. With 50 appointments that's 101 database round-trips. With 500 it's 1001."

→ Show the **fixed code** with `include`

> "The fix is one line — use Prisma's `include` to join the related data in the initial query. Now it's always exactly one database query regardless of how many appointments exist."

---

### 4B — Race Condition in Queue Check-In (Show in VS Code)

**Open `backend/src/routes/queue.js`**

**Say:**

> "The queue check-in had a race condition in token number assignment. The original code read the max token number, then waited 350 milliseconds — artificially — and then created the new token. If two patients checked in at the same time, both requests would read the same max value and both create token number 6, resulting in duplicates in the queue."

→ Show the **fixed code** with `$transaction({ isolationLevel: 'Serializable' })`

> "I fixed this using a PostgreSQL serializable transaction. The serializable isolation level ensures that two concurrent transactions can never read the same max value and both commit successfully — one of them will be forced to retry. And I removed the fake 350ms sleep entirely."

---

### 4C — Reports Nested Loop (Briefly mention)

**Say:**

> "The admin reports endpoint was looping through every doctor and running 5 sequential database queries per doctor, plus an 80ms artificial delay per doctor. With 5 doctors that was already 400ms of fake waiting. I replaced this with `Promise.all` to run all doctor queries in parallel, cutting the response time from 600ms+ down to under 50ms. I'll show this in the demo — look at the `timeTakenMs` value in the report."

→ **Demonstrate in browser:** Login as Admin → System Audit Reports → click **Load Doctor System Audit Report** → point to the `timeTakenMs` in the performance diagnostic banner (should now be very fast).

---

## PART 5 — Database & Frontend Fixes (8:00 – 10:00)

### 5A — In-Memory Pagination (Briefly)

**Say:**

> "The patient listing was fetching every single patient from the database into memory and then filtering and paginating in JavaScript. I moved all filtering and pagination into the SQL query using Prisma's `skip`, `take`, and `count` — so only the 5 records needed for the current page ever cross the network."

---

### 5B — Frontend Memory Leak (Show in VS Code)

**Open `frontend/src/app/queue/page.js`**

**Say:**

> "The public queue monitor had a memory leak. The `useEffect` started a 3-second polling interval but never returned a cleanup function. Every time you navigated away from and back to this page, a new interval was created without the old one being cleared. After 10 navigations you'd have 10 timers running simultaneously. The fix is one line — `return () => clearInterval(intervalId)`."

---

### 5C — Null Crash on Medical History (Show in Browser)

**Say:**

> "The doctor dashboard was crashing whenever you clicked a patient with no medical history. The code called `.toUpperCase()` directly on `medicalHistory` without checking for null first. Patients like Bruce Wayne and Clark Kent have null medical history — clicking them would crash the entire dashboard. I fixed this with a simple null check and a fallback message."

→ **Demonstrate in browser:** Login as Doctor → click a patient without history (Bruce Wayne or Clark Kent) → show it now displays "No medical history on record." instead of crashing.

---

## PART 6 — Incomplete Feature Demo (10:00 – 11:30)

**Say:**

> "Finally, the assignment had a missing route. The doctor worklist had a 'View Diagnostic Reports Details' link for each patient that pointed to `/patients/[id]/history-records` — but this page didn't exist. Clicking it would give a 404."

→ **Demonstrate in browser:** Login as Doctor → click a patient name → click **View Diagnostic Reports Details** → the new page opens showing patient info, medical history, and appointment history.

> "I built this page from scratch. It fetches the patient's full profile including their appointment history, handles loading and error states, and has a 'Back to Dashboard' link. It's fully integrated with the auth system and only accessible to logged-in staff."

---

## PART 7 — Deployment & Final Summary (11:30 – 13:30)

**Say:**

> "The application is also deployed. I deployed the backend as a Vercel serverless Node.js app and the frontend as a standard Next.js Vercel deployment. The database is hosted on Neon — free-tier managed PostgreSQL. The backend exports the Express app as `module.exports = app` for Vercel's serverless runtime, and CORS is configured to only accept requests from the deployed frontend URL via an environment variable."

→ **Show the live deployed URL** in the browser

> "Let me do a final quick demo on the deployed version — login as admin, load the report, and show the queue monitor."

---

**Final words:**

> "To summarize — I identified and fixed 14 bugs across all five categories: 4 security issues including a SQL injection, 4 performance issues including a race condition and N+1 problem, 2 database optimizations, 3 frontend bugs including a memory leak and a null crash, and I built the missing patient history page. The approach I took was to prioritize by severity — security and data integrity first, performance and UX second. All fixes are in my forked GitHub repository and the full documentation is in `DOCUMENTATION.md` in the project root. Thank you for reviewing my submission."

---

## Recording Tips

- Use **1080p** resolution minimum
- Speak clearly and at a **steady pace** — don't rush
- Keep your browser **zoomed to 110%** so the UI is readable
- Use **VS Code's split-pane view** when comparing before/after code
- Have your `.env` files ready — the app should start in under 5 seconds
- Keep Loom/OBS open — record the whole screen, not just a window
- Aim for **10–14 minutes** — don't go over 15 minutes

---

## Quick Reference — Login Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@haqms.com | password123 |
| Receptionist | reception1@haqms.com | password123 |
| Doctor | doctor1@haqms.com | password123 |

---

## Quick Reference — Key Files Changed

| File | What was fixed |
|---|---|
| `backend/src/middleware/auth.js` | Admin role check, token expiry |
| `backend/src/routes/auth.js` | Password logging, hash in response, JWT expiry |
| `backend/src/routes/doctors.js` | SQL injection, sequential async calls |
| `backend/src/routes/appointments.js` | N+1 queries, double-booking check |
| `backend/src/routes/queue.js` | Race condition, removed 350ms sleep |
| `backend/src/routes/reports.js` | Nested loop, removed 80ms×N sleep |
| `backend/src/routes/patients.js` | In-memory pagination, phone validation |
| `backend/prisma/schema.prisma` | Added 7 missing database indexes |
| `frontend/src/app/queue/page.js` | Memory leak (clearInterval), env var |
| `frontend/src/app/dashboard/page.js` | Null crash, Link import, UI banners |
| `frontend/src/context/AuthContext.js` | Hardcoded URL → env variable |
| `frontend/src/app/patients/[id]/history-records/page.js` | **New** — patient history page |
