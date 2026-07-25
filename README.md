# The Press Conference — QR Code Attendance Management System

A QR-code attendance and certification system for school Friday Press
Conference sessions, built for the journalism categories: News Writing,
Feature Writing, Editorial Writing, Column Writing, Copy Editing,
Sci-Tech Writing, Photojournalism, Editorial Cartooning, Radio Broadcasting.

- **Frontend:** Angular 21 (standalone components, lazy-loaded routes)
- **Backend:** Node.js + Express (modular routes/controllers/utils)
- **Database:** PostgreSQL
- **Hosting:** Render.com (Web Service + Static Site + Postgres)

Both the ID card and the certificate are DepEd-aligned in layout (header
block for "Republic of the Philippines / Department of Education / Division
/ School", signature lines for Adviser and Principal, and a placeholder
circle where your school pastes its own official DepEd/school seal — no
official seal artwork is bundled, since that belongs to your school/division).

---

## 1. Project structure

```
qr-attendance-system/
├── backend/                  Express API
│   ├── src/
│   │   ├── config/           db.js (pg Pool), schema.sql
│   │   ├── routes/           auth, students, categories, attendance, certificates
│   │   ├── middleware/       auth.middleware.js (JWT)
│   │   ├── utils/            qrGenerator, idCardGenerator, certificateGenerator (pdfkit)
│   │   ├── seed/             seed.js (categories + first admin login)
│   │   ├── app.js / server.js
│   ├── Dockerfile
│   └── .env.example
├── frontend/                  Angular app
│   └── src/app/
│       ├── core/              services (api, auth), guards, interceptors, models
│       ├── shared/            masthead header
│       └── features/          login, teacher-dashboard, register-student,
│                               scanner, progress, certificates
└── render.yaml                Render Blueprint (backend + frontend + Postgres)
```

## 2. How it works (matches your screenshots)

1. **Register Student** → teacher enters Full Name, Grade & Section, LRN
   (optional); backend generates a UUID `qr_token` and the QR PNG encodes
   *only* that token — never personal data.
2. **Scanner** → teacher picks a category, opens the camera, scans the
   student's QR. Backend records `(student, category, date, time)` and
   blocks duplicate scans for the same category/day.
3. **Progress** → live table of distinct categories completed per student.
4. **Certificates** → students with 6+ completed categories qualify; teacher
   downloads a generated PDF certificate per student.

---

## 3. Local development

### Backend
```bash
cd backend
cp .env.example .env        # then edit DATABASE_URL, JWT_SECRET
npm install
npm run seed                # creates tables + a default tenant + 9 categories + admin login
npm run dev                 # http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
npm start                   # http://localhost:4200, proxies to localhost:4000
```

Default seeded login (change immediately): `admin@school.edu.ph` /
whatever you set as `SEED_ADMIN_PASSWORD` (default `ChangeMe123!`).

---

## 4. Deploying to Render (you already have an account + Postgres ready)

You have two options. **Option A (fastest)** uses the `render.yaml`
Blueprint already included at the project root to create all three pieces
in one go. **Option B** is the manual click-by-click path if you'd rather
attach your *existing* Postgres instance instead of letting the Blueprint
create a new one.

### Option A — One-shot Blueprint deploy

1. Push this whole `qr-attendance-system/` folder to a GitHub repo.
2. In the Render dashboard: **New → Blueprint** → connect that repo.
   Render reads `render.yaml` and shows 3 resources: `qr-attendance-db`
   (Postgres), `qr-attendance-backend` (web service), `qr-attendance-frontend`
   (static site).
3. Click **Apply**. Render provisions the DB, builds the backend Docker
   image, and builds/publishes the Angular static site.
4. Once the backend is live, open its **Shell** tab (or use a one-off job)
   and run:
   ```bash
   npm run seed
   ```
   This applies `schema.sql` and creates the categories + first admin login.
5. In the backend service → **Environment**, set `SEED_ADMIN_PASSWORD`
   (it's marked `sync: false` so it isn't committed to git) before seeding.
6. Open the frontend's `.onrender.com` URL and log in.

### Option B — Manual steps with your existing Postgres

1. **Backend web service**
   - New → Web Service → connect repo → set **Root Directory** to `backend`.
   - Runtime: Docker (uses `backend/Dockerfile`) — or pick Node runtime with
     Build Command `npm install` and Start Command `node src/server.js`.
   - Environment variables:
     - `DATABASE_URL` → your existing Postgres **Internal Database URL**
       (same Render region = free, low-latency; use External URL only if
       the DB is on a different provider/region).
     - `JWT_SECRET` → any long random string.
     - `CORS_ORIGIN` → your frontend's URL, e.g.
       `https://qr-attendance-frontend.onrender.com`.
     - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` → your first login.
   - Deploy, then open **Shell** and run `npm run seed` once.

2. **Frontend static site**
   - Before deploying, edit `frontend/src/environments/environment.prod.ts`
     and set `apiBaseUrl` to your backend's live URL + `/api`, e.g.
     `https://qr-attendance-backend.onrender.com/api`.
   - New → Static Site → connect repo → **Root Directory**: leave at repo
     root (build command below `cd`s into `frontend`).
   - Build Command: `cd frontend && npm install && npm run build -- --configuration production`
   - Publish Directory: `frontend/dist/frontend/browser`
   - Add a rewrite rule `/*` → `/index.html` (Angular client-side routing).

3. Visit the frontend URL, log in with the seeded admin account, and start
   registering students.

### Upgrading an already-deployed database (multi-tenant migration)

If you deployed before multi-tenancy was added, your database already has
data but no `tenants`/`tenant_id` columns yet. Bring it up to date with a
**one-time** run, in this order:

```bash
npm run migrate   # adds tenants + tenant_id, backfills existing rows into
                   # one "Default School" tenant — safe to re-run, it tracks
                   # what's already applied and skips it
```

Then, in the backend service's **Environment** tab, generate a new
`JWT_SECRET` and save (this redeploys the service). Existing 12h login
tokens don't carry a `tenant_id`, so rotating the secret forces everyone to
log back in and get a token that does — otherwise tenant-scoped queries
would silently return empty results for anyone still on an old token.
Anyone already registering students/scanning can keep working right after
they log back in.

---

## 5. What to customize before your event

- **School branding:** put your school's real name in each student's
  `school_name` field (set at registration) and, if you want the actual
  DepEd/school seal instead of the placeholder circle, replace the circle
  in `backend/src/utils/idCardGenerator.js` and `certificateGenerator.js`
  with `doc.image('path/to/seal.png', x, y, { width, height })`.
- **Categories:** edit the `CATEGORIES` array in `backend/src/seed/seed.js`
  if your press conference uses different category names.
- **Qualifying threshold:** `QUALIFYING_THRESHOLD = 6` in
  `backend/src/routes/certificates.routes.js`.
- **Colors:** the navy/gold press theme lives in `frontend/src/styles.scss`
  as CSS variables (`--navy`, `--gold`, etc.) — change once, applies everywhere.

## 6. Security notes

- QR codes encode only an opaque `qr_token` (UUID) — scanning one reveals
  nothing about the student without a matching database lookup.
- All data-returning endpoints require a teacher/admin JWT (`Authorization:
  Bearer <token>`), obtained via `/api/auth/login`.
- Change the default seeded password immediately after first login (there's
  no self-service "change password" screen yet — update it directly via the
  `users` table or extend the API if you need one).
- All students/categories/attendance/rankings/user accounts are scoped by
  `tenant_id`, taken from the logged-in user's JWT — never from request
  input — so one login can only ever see and modify its own tenant's data.
