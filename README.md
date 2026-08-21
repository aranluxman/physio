# Physio Tracker

A private, mobile-first web app for tracking a hip-impingement rehab regimen: what's
due today, what's been logged, pain levels, and how long until the next physio
appointment.

- **Frontend** — Next.js 14 (App Router, TypeScript), Tailwind CSS, exported as a
  fully static site (`output: 'export'`).
- **Backend** — Supabase (PostgreSQL + Auth) with row level security, queried directly
  from the browser with the anon key.
- **Hosting** — Cloudflare Pages, deployed automatically by GitHub Actions on every
  push to `main`.

---

## What it does

**Today (`/`)** — the daily checklist. Each exercise is resolved against its own
frequency rule and lands in one of four states:

| State | Meaning |
| --- | --- |
| **Due** | Owed today, not yet logged. |
| **Done** | Every session scheduled for today is logged. |
| **Optional** | Weekly minimum already met — an extra session is welcome, not required. |
| **Rest** | Not scheduled today (e.g. the day after a Dead Bug session). |

A 3x/day exercise renders three separate tick boxes, so each session of the day is
logged independently. The progress bar counts *sessions*, not exercises, so ticking one
of three 90:90 sets moves it by the right amount. Optional and rest-day exercises still
show a tick box — an extra session is never blocked — but they don't inflate the
denominator.

Below the checklist: the next appointment with a live day/hour/minute countdown, and
the pinned therapist notes.

**Schedule (`/schedule`)** — the whole prescribed regimen, grouped by frequency
(daily/multi-daily, every 2 days, 2–3x per week) with dosage and technique cues.

**History (`/history`)** — a 28-day completion grid plus the most recent pain-level and
note entries.

### The scheduling rules

| Frequency | Rule | Used by |
| --- | --- | --- |
| `daily` | Due every day, one session. | Hip CAR |
| `times_per_day` | Due every day, N sessions. | 90:90 rotations, all three stretches |
| `every_n_days` | Due when N days have passed since the last logged session; **Rest** otherwise. Never logged ⇒ due now. Flagged *overdue* once it slips past. | Dead Bug |
| `times_per_week` | Counts sessions in the current Mon–Sun week. Below the minimum ⇒ **Due**; between min and max ⇒ **Optional**; at max ⇒ **Rest** until Monday. Flagged *don't skip* when the sessions still owed match the days left in the week. | Kettlebell hip flexor hold, lateral step down |

All calendar maths runs in **your local timezone** (dates are derived from the browser
clock, not UTC), so a 10pm session is logged against today, not tomorrow.

### The seeded regimen

| Exercise | Category | Dosage | Schedule |
| --- | --- | --- | --- |
| Hip CAR | Hip Mobility | 3 sets × 8 reps | Daily |
| Hip 90:90 Rotations | Hip Mobility | 10 reps | 3x per day |
| Kneeling Hip Flexor Stretch | Mobility / Stretch | 30s hold | 3x per day |
| Hip Adductor Stretch | Mobility / Stretch | 30s hold | 3x per day |
| Hamstring Stretch | Mobility / Stretch | 30s hold | 3x per day |
| Dead Bug | Core / Hip Flexors | 3 sets × 6 reps | Every 2 days |
| Kettlebell Hip Flexor Hold | Hip Strength | 3 sets × 8 reps, 30 lbs | 2–3x per week |
| Lateral Step Down | Hip Strength | 4 sets × 10 reps, 25 lbs | 2x per week |

Next appointment: **Tuesday 8 September 2026, 5:30 PM** (stored as an absolute instant,
`2026-09-08 17:30 America/Toronto`).

---

## Setup

### Step 1 — Create the Supabase project and run the schema

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
   Pick a region close to you and save the database password somewhere safe.
2. Open **SQL Editor** → **New query**.
3. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and click
   **Run**.

That one file creates everything: the `exercises`, `logs`, `appointments` and
`therapist_notes` tables, the RLS policies, and the seed function that loads your
regimen. It is idempotent — re-running it is safe.

It also installs a trigger on `auth.users`, so **every new signup is seeded
automatically**. If your project blocks triggers on `auth.users`, delete section 9 of
the file; the app shows a **Load my regimen** button that calls the same seed function
over RPC instead.

### Step 2 — Configure Auth

In **Authentication → Providers**, make sure **Email** is enabled.

Since this is a personal app, turn off public signups once your account exists:
**Authentication → Sign In / Providers → Allow new users to sign up → off**.

In **Authentication → URL Configuration**, add your site to **Redirect URLs** so magic
links come back to the right place:

```
http://localhost:3000/**
https://<your-project>.pages.dev/**
```

### Step 3 — Collect the Supabase environment variables

**Project Settings → API** gives you two values:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, e.g. `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The **anon / public** key |

The anon key is designed to be public — it ships in the browser bundle, and row level
security is what actually protects the data. **Never** put the `service_role` key in
this project; it bypasses RLS entirely.

### Step 4 — Run it locally

```bash
npm install
cp .env.example .env.local     # then fill in the two values from step 3
npm run dev                    # http://localhost:3000
```

Sign up with your email on first load. The trigger from step 1 seeds the regimen, so
the checklist is populated the moment you land on the dashboard.

Other useful commands:

```bash
npm run typecheck   # tsc --noEmit
npm test            # 36 assertions against the scheduling rules
npm run build       # static export into ./out
npm run preview     # build, then serve ./out through wrangler locally
```

### Step 5 — Create the Cloudflare Pages project

1. In the [Cloudflare dashboard](https://dash.cloudflare.com) go to
   **Workers & Pages → Create → Pages → Create using direct upload**.
2. Name it `physio-tracker` (this is the **project name** the workflow deploys to) and
   create it. Ignore the upload prompt — GitHub Actions does the uploading from here on.

> Using a different project name? Add a repository **variable** called
> `CLOUDFLARE_PROJECT_NAME` in step 6 and the workflow will use it instead.

**Do not** connect the Pages project to your GitHub repo through Cloudflare's own Git
integration — that would run a second, competing build. The GitHub Actions workflow is
the only thing that should deploy.

### Step 6 — Add the GitHub repository secrets

**Account ID** — Cloudflare dashboard → **Workers & Pages**; the Account ID is in the
right-hand sidebar (it's also the hex string in your dashboard URL).

**API token** — Cloudflare dashboard → **My Profile → API Tokens → Create Token →
Custom token**:

- Permissions: `Account` → `Cloudflare Pages` → **Edit**
- Account Resources: include your account
- Create the token and copy it — it is shown exactly once.

Now in GitHub: **Settings → Secrets and variables → Actions → New repository secret**,
and add all four:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | The token you just created |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `NEXT_PUBLIC_SUPABASE_URL` | From step 3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From step 3 |

The two Supabase values must be **Actions secrets**, not just a local `.env.local`.
They're inlined into the JavaScript bundle at build time, so the build machine needs
them — a build without them produces a site that shows a "Supabase is not configured"
notice instead of the app.

Optionally, under the **Variables** tab, add `CLOUDFLARE_PROJECT_NAME` if your Pages
project isn't called `physio-tracker`.

### Step 7 — Push to `main` and watch it deploy

```bash
git add .
git commit -m "Set up physio tracker"
git push -u origin main
```

That push triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which typechecks, runs the tests, builds the static export, and uploads `./out` to
Cloudflare Pages. Follow it in the repo's **Actions** tab; when it goes green the site
is live at `https://<project-name>.pages.dev`.

Every later push to `main` — direct or via a merged pull request — redeploys the same
way. Pull requests run [`ci.yml`](.github/workflows/ci.yml) instead, which typechecks,
tests and builds but does not deploy.

Add the site to your phone's home screen (Share → Add to Home Screen) and it opens
full-screen like a native app.

---

## Project layout

```
src/
  app/
    layout.tsx           Root layout: auth provider + app shell
    page.tsx             Today — the daily checklist
    schedule/page.tsx    Full regimen grouped by frequency
    history/page.tsx     28-day completion grid and pain log
    globals.css          Tailwind entry + shared component classes
  components/
    AppShell.tsx         Env check -> auth gate -> chrome
    LoginForm.tsx        Password / signup / magic-link
    NavBar.tsx           Header + mobile tab bar
    ExerciseCard.tsx     One exercise: tick boxes, pain picker, notes
    SessionToggle.tsx    A single session tick box
    ProgressBar.tsx      Daily session progress
    AppointmentCard.tsx  Next appointment + live countdown
    NotesPanel.tsx       Therapist notes
    EmptyRegimen.tsx     "Load my regimen" fallback
  hooks/
    useAuth.tsx          Supabase session context
    usePhysio.ts         Fetching, optimistic logging, midnight rollover
  lib/
    schedule.ts          The scheduling engine (pure functions)
    date.ts              Local-timezone date maths
    supabase.ts          Lazily-created browser client
    types.ts             Shared types, mirroring the SQL schema
supabase/
  schema.sql             Everything: tables, RLS, seed function, trigger
  tests/                 psql scripts that verify seeding and RLS isolation
tests/
  schedule.test.js       Assertions covering every frequency rule
.github/workflows/
  deploy.yml             main -> Cloudflare Pages
  ci.yml                 Pull requests: typecheck, test, build
```

## Testing

`npm test` compiles the scheduling engine and runs 36 assertions over it — every
frequency type, week boundaries, overdue detection, partial sessions, ordering and
progress maths.

The SQL in `supabase/tests/` verifies the schema against a local Postgres with a
Supabase-shaped stub: that both users get seeded, that re-seeding doesn't duplicate,
that the appointment lands on 5:30 PM Toronto time, that a user can't read or write
another user's rows, that duplicate session ticks are rejected, and that `anon` sees
nothing. Run them against a local Postgres 16:

```bash
psql -f supabase/tests/00_supabase_stub.sql
psql -f supabase/schema.sql
psql -f supabase/tests/01_seed_and_rls_test.sql
```

## Changing the regimen

Exercises live in the database, not in the code, so the fastest edit is in the Supabase
table editor — change `target_sets`, `sessions_per_day`, `interval_days`, or flip
`is_active` to `false` to retire an exercise without losing its history. The dashboard
picks up the change on the next load.

To change what a *fresh* account gets seeded with, edit
`public.seed_default_regimen()` in `supabase/schema.sql` and re-run the file.

To move the appointment, update the row in `appointments` (or add a new one — the app
shows the next future appointment).
