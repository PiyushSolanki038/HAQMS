# Video Script — HAQMS Internship Assignment
**Target length:** 10–14 minutes  
**Keep it natural — don't read word for word, just use this as a guide**

---

## Before you start recording

Have these open:
- Browser at https://haqms-q1qr.vercel.app
- VS Code with the HAQMS project
- Terminal (just in case)

---

## Part 1 — Quick Intro (0:00 to 0:45)

Just look at the camera and say something like:

> "Hey, I'm Piyush Solanki and this is my submission for the Figital Labs internship assignment. So the project is called HAQMS — a Hospital Appointment and Queue Management System. The idea was that the repo was intentionally broken in different ways, and I had to go through it, figure out what was wrong, and fix it. In this video I'll walk you through what I found and what I did about it. Let me start by showing the app itself, then I'll go through the code."

---

## Part 2 — Show the App (0:45 to 2:30)

Open the browser at **https://haqms-q1qr.vercel.app**

> "So this is the live deployed app. You've got two options from the homepage — the Staff Portal which is the main dashboard, and a Live Queue Monitor which is a public screen showing which patients are being called."

Click **Live Queue Monitor**

> "This auto-refreshes every 3 seconds. It groups tokens by doctor and shows who's being called right now. This page actually had a pretty bad memory leak which I'll show in a bit."

Go back → click **Staff Portal** → Login page appears

> "There are three roles — Admin, Receptionist, and Doctor. Let me log in as Receptionist first."

Click the **Receptionist** quick-fill button → Sign In → dashboard loads

> "As a receptionist I can register patients, book appointments, and check in walk-in patients to the queue."

Switch to the **Scheduling tab** briefly → then logout

Login as **Doctor (doctor1@haqms.com)**

> "As a doctor I see my scheduled appointments and I can manage the calling queue — moving patients from waiting to calling to completed."

Click a patient name (click **Bruce Wayne** specifically)

> "Notice now it shows 'No medical history on record' — this was actually a crash before. I'll show that in the code."

Logout → Login as **Admin**

> "And the admin gets a reports dashboard and a physician search. The reports endpoint was extremely slow, I'll show that too."

---

## Part 3 — Security Fixes (2:30 to 5:30)

### SQL Injection fix

Open VS Code → open `backend/src/routes/doctors.js`

> "Okay so let me start with the most serious one — there was a SQL injection vulnerability right here in the doctor search. Look, it was using `$queryRawUnsafe` and building the query by just concatenating the user's input directly into a SQL string."

Point to the current code (the fixed version)

> "What I changed it to is Prisma's normal `findMany` with a `contains` filter. Prisma parameterizes everything under the hood, so there's no way to inject SQL through this. The original code could've been exploited to dump the entire users table including password hashes."

---

### Bypassed admin check

Open `backend/src/middleware/auth.js`

> "This one really surprised me. There's a function called `authorizeAdminOnlyLegacy` that's supposed to restrict certain actions to admins only — like deleting patients. But when I looked at it, the actual role check was commented out. There was a comment saying it was 'causing issues during testing.' So essentially any logged-in user could delete any patient record. I just uncommented those two lines and it works correctly now."

---

### Passwords being logged

Open `backend/src/routes/auth.js`

> "In the auth routes I found that every single login attempt was printing the email and password to the console in plaintext. So anyone with access to the server logs could see user passwords. I removed those logs. I also noticed the registration response was sending back the hashed password in the JSON — there's no reason for that, so I filtered it out and only return the safe fields now. And the token expiry was set to 365 days, I changed that to 24 hours."

---

## Part 4 — Performance Fixes (5:30 to 8:00)

### N+1 queries

Open `backend/src/routes/appointments.js`

> "This is a classic N+1 problem. The original code fetched all appointments first, then for every single appointment it ran two more database queries — one for the patient details, one for the doctor details. So with 50 appointments you're doing 101 database queries for one API call. The fix is just using Prisma's `include` in the initial query so everything comes back in one shot."

---

### Race condition in queue

Open `backend/src/routes/queue.js`

> "This was an interesting one. The queue check-in was reading the max token number, then — and there's literally an artificial `setTimeout` of 350ms here to make it worse — then inserting a new token with max + 1. If two patients check in at the same time, both requests read the same max value and both try to create the same token number. Classic race condition. I wrapped the whole read-and-write in a serializable database transaction. PostgreSQL handles the rest — if two transactions try to do the same thing, one of them retries automatically. And obviously I removed the fake delay."

---

### Reports endpoint

Open `backend/src/routes/reports.js`

> "The reports endpoint was doing something similar — looping through every doctor and running 5 separate database queries per doctor, all one after another. Plus there was an 80ms fake sleep per doctor. I switched it to Promise.all so all the queries run in parallel instead of waiting for each other."

Show in the browser — login as Admin → load the report → point to the `timeTakenMs` value

> "You can see the execution time here. It's now fast."

---

## Part 5 — Frontend and Database (8:00 to 10:00)

### Memory leak

Open `frontend/src/app/queue/page.js`

> "The queue monitor page had a memory leak. It sets up a `setInterval` that polls every 3 seconds, but there was no cleanup function in the `useEffect`. Every time you navigate to this page and back, a new interval gets created on top of the old one. After a while you've got dozens of timers all running. The fix is one line — return a cleanup function that calls `clearInterval`."

---

### Null crash

Back to the browser — show the appointment list as Doctor → click Bruce Wayne

> "This one was causing the whole dashboard to crash. The code was calling `.toUpperCase()` directly on the medical history field without checking if it was null first. Several patients in the seed data have no medical history — Bruce Wayne, Clark Kent, Diana Prince. Clicking any of them would throw an error and break the page. I added a null check so it shows a fallback message instead."

---

### Pagination

> "The patients list endpoint was loading every single patient from the database into memory and then filtering and paginating in JavaScript. I moved all of that into the SQL query using Prisma's skip and take, so only the records you actually need are fetched. I also added proper database indexes to the schema for columns that are frequently used in queries."

---

## Part 6 — Missing Feature (10:00 to 11:30)

In the browser as Doctor → click a patient → click **"View Diagnostic Reports Details"** link

> "This link was going to a 404 before — the page just didn't exist. I built it. It shows the patient's profile, their medical history if they have one, and a full table of all their past appointments. It handles the case where there's no history, and it has a back button to the dashboard."

---

## Part 7 — Wrap Up (11:30 to 13:00)

> "So to summarize what I fixed — four security issues including a SQL injection and a completely bypassed admin check, four performance issues including an N+1 problem and a race condition in the queue, two database improvements around pagination and missing indexes, three frontend bugs including a memory leak and a null crash, and I built the missing patient history page."

> "I deployed everything on Vercel — backend is a serverless Express app, frontend is Next.js, and the database is on Neon which is a managed PostgreSQL service. The first request might be a bit slow because Neon's free tier goes to sleep after inactivity, but after that it's fine."

> "The full documentation with all the details is in DOCUMENTATION.md in the repo. My GitHub is github.com/PiyushSolanki038/HAQMS. Thanks for watching."

---

## Quick Reference

**Login credentials (all use password123):**
- Admin → admin@haqms.com
- Receptionist → reception1@haqms.com
- Doctor → doctor1@haqms.com

**Live URLs:**
- Frontend → https://haqms-q1qr.vercel.app
- Backend → https://haqms-backend-eight.vercel.app
- GitHub → https://github.com/PiyushSolanki038/HAQMS

**Recording tips:**
- Talk at a normal pace, don't rush
- It's okay to pause and think — makes it sound real
- You don't need to read this script word for word, just follow the flow
- If you mess up, just keep going — minor mistakes are fine
- Keep browser zoom at around 110% so everything is readable
