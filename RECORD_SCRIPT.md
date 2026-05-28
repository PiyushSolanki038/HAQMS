# Video Script — HAQMS Walkthrough
**Target length:** 10–14 minutes  
**Don't read this word for word — just use it as a guide. Talk naturally.**

---

## Before you hit record

Have these ready:
- Browser open at **https://haqms-q1qr.vercel.app**
- VS Code with the HAQMS project open
- This file open on the side so you can glance at it

---

## Part 1 — Introduce yourself (0:00 – 0:45)

Look at the camera, keep it casual:

> "Hey, I'm Piyush Solanki and this is my submission for the Figital Labs internship assignment. The project is HAQMS — a Hospital Appointment and Queue Management System. The codebase was intentionally broken in a bunch of different ways and the goal was to find the issues and fix them. I'll walk through what I found, show the fixes in the code, and demo the working app. Let's get into it."

---

## Part 2 — Show the live app (0:45 – 2:30)

Go to **https://haqms-q1qr.vercel.app** in the browser.

> "So this is the app running live. From the homepage you've got two options — Staff Portal which is the main dashboard, and a Live Queue Monitor which is a public display showing which patients are being called by each doctor."

Click **Live Queue Monitor**.

> "This auto-refreshes every 3 seconds and groups tokens by doctor. This page had a memory leak — every time you navigated here a new interval timer was created and the old one never got cleaned up. I'll show that in the code."

Go back. Click **Staff Portal** → login page.

> "There are three roles — Admin, Receptionist, and Doctor. Let me show each one quickly."

Click the **Receptionist** quick-fill → Sign In.

> "As a receptionist I can register patients, book appointments, and check in walk-in patients to the queue."

Click the **Scheduling tab** briefly, then logout.

Login as **Doctor** (doctor1@haqms.com).

> "As a doctor I can see my scheduled appointments for the day and manage the queue — calling patients in, marking them done, skipping no-shows."

Click on **Bruce Wayne** in the appointments list.

> "Notice this shows 'No medical history on record' — that used to crash the entire page. I'll explain that in a second."

Logout → login as **Admin**.

> "Admin gets a reports view and physician search. The reports endpoint was genuinely painful to use before I fixed it — I'll show the timing."

---

## Part 3 — Security fixes (2:30 – 5:30)

### SQL injection

Open VS Code → `backend/src/routes/doctors.js`

> "Okay, the most serious bug first. The doctor search was building SQL queries by directly concatenating user input into a string and running it with `$queryRawUnsafe`. So you could type something like `House' UNION SELECT id, email, password FROM User --` into the search box and get every user's password hash back from the database. Classic SQL injection."

Point to the current fixed code.

> "What I changed it to is Prisma's normal findMany with a contains filter. Prisma parameterizes everything automatically so there's no way to inject SQL through this. The original approach should never appear in production code."

---

### Bypassed admin check

Open `backend/src/middleware/auth.js`

> "This one surprised me. There's a function called authorizeAdminOnlyLegacy that's supposed to make sure only admins can do things like delete patient records. But when I opened it, the role check was commented out. The comment said a junior dev commented it out because it was causing issues during testing. So any logged-in user — receptionist, doctor, anyone — could delete any patient. I just uncommented those two lines."

---

### Passwords being logged and other auth issues

Open `backend/src/routes/auth.js`

> "A few things here. First — every login attempt was printing the password to the console in plaintext. Anyone with log access could see user credentials. Second — the registration response was sending back the hashed password in the JSON. No reason for that. Third — tokens were set to expire after 365 days, and the verification was using ignoreExpiration: true, so even expired tokens worked forever. I removed the console logs, filtered the response to only return safe fields, changed expiry to 24 hours, and removed the ignoreExpiration flag."

---

## Part 4 — Performance fixes (5:30 – 8:00)

### N+1 queries

Open `backend/src/routes/appointments.js`

> "This is a classic N+1 problem. The code was fetching all appointments, then for each appointment running two more queries — one for the patient, one for the doctor. With 50 appointments that's 101 database queries for one API call. The fix is adding Prisma's include in the initial query so everything comes back together in a single query."

---

### Race condition in queue

Open `backend/src/routes/queue.js`

> "This was an interesting bug. The queue check-in was reading the max token number, then — and there's a literal 350 millisecond setTimeout here to make it worse — then inserting a new token with max plus one. If two people check in at exactly the same time, both requests read the same max, both add one, and both try to insert the same token number. Duplicate tokens in the queue."

Point to the transaction code.

> "The fix is wrapping the read and write in a serializable database transaction. PostgreSQL guarantees that two concurrent transactions can't both read the same max and both commit — one of them will automatically retry. The fake delay is also gone."

---

### Reports

Open `backend/src/routes/reports.js`

> "The reports endpoint was looping through every doctor and running 5 database queries per doctor sequentially, plus an 80ms artificial sleep per doctor. Five doctors, that's already 400ms of fake waiting before even counting real database time. I rewrote it with Promise.all so all queries run in parallel."

In the browser — go to Admin → System Reports → click Load Report.

> "Look at the execution time here. Before this fix it was over 600ms, now it's under 50."

---

## Part 5 — Database and frontend (8:00 – 10:00)

### Memory leak

Open `frontend/src/app/queue/page.js`

> "The queue page was starting a setInterval to poll every 3 seconds but never cleaning it up when the component unmounts. Navigate back and forth 10 times and you've got 10 timers all running at the same time. The fix is one line — return a cleanup function from the useEffect that calls clearInterval."

---

### Null crash

In browser as Doctor → click **Bruce Wayne** → show the medical history.

> "The crash was here — the code was calling .toUpperCase() directly on the medicalHistory field without checking if it was null. Several patients in the seed data have no medical history. I added a simple null check so it shows a fallback message instead of crashing."

---

### Pagination and indexes

> "Two database things — first, the patients list was loading every single patient into memory in Node.js and then filtering and slicing in JavaScript. I moved all of that into the SQL query using Prisma's skip and take. Second, the schema had no indexes on several heavily-used columns like specialization, department, doctorId with status, etc. I added those to the schema."

---

## Part 6 — The missing page (10:00 – 11:30)

In browser as Doctor → click a patient → click **"View Diagnostic Reports Details"**.

> "This link used to give a 404 because the page didn't exist at all. I built it — it shows the patient profile, their medical history with a fallback if it's empty, and a full table of their appointment history. It handles loading and error states properly and has a back button."

---

## Part 7 — Wrap up (11:30 – 13:00)

> "So that's everything. Security — SQL injection, bypassed admin check, plaintext password logging, and the token issues. Performance — N+1 queries, race condition in the queue, the slow reports endpoint, and sequential database calls. Database — in-memory pagination and missing indexes. Frontend — the memory leak and the null crash. And the missing patient history page."

> "The app is deployed on Vercel — frontend and backend both on Vercel's free tier, database on Neon. The first request after the database goes idle might take a second or two because Neon's free tier sleeps after inactivity. That's just a free tier thing."

> "Everything's documented in DOCUMENTATION.md in the repo if you want to read the full details. Thanks."

---

## Quick reference

**Test accounts (password: password123)**
- admin@haqms.com
- reception1@haqms.com
- doctor1@haqms.com

**Links**
- App: https://haqms-q1qr.vercel.app
- Backend: https://haqms-backend-eight.vercel.app
- GitHub: https://github.com/PiyushSolanki038/HAQMS

**Tips**
- Talk at a normal pace, you don't need to rush
- It's fine to pause for a second before moving to the next thing
- If you stumble on a word just keep going, minor mistakes are completely fine
- Keep the browser at around 110% zoom so the UI is readable on screen
- You don't have to follow this script exactly — if you want to explain something differently, do it
