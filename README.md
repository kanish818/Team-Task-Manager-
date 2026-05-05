# Team Task Manager

A full-stack **team task manager** for organizing projects, members, and work items in one place. Built for clarity: role-based access, validated APIs, and a focused dashboard for progress at a glance.

---

## Features

| Area | What you get |
|------|----------------|
| **Authentication** | Sign up, sign in (JWT session cookie), sign out; passwords hashed with bcrypt |
| **Roles** | `ADMIN` and `MEMBER` — admins manage projects, members, and tasks; members update status on assigned work |
| **Projects** | List, search, create, view, update, delete (admin); membership and activity timeline |
| **Tasks** | Create, assign, filter, paginate; status and priority; overdue filters; comments and mentions |
| **Dashboard** | Totals (including pending & overdue), per-project completion |
| **Activity** | Project-scoped activity log for auditing changes |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js](https://nextjs.org) **16** (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| UI | [React](https://react.dev) **19**, [Tailwind CSS](https://tailwindcss.com) **4** |
| Database | [PostgreSQL](https://www.postgresql.org/) |
| ORM | [Prisma](https://www.prisma.io) **7** with [`pg`](https://node-postgres.com/) adapter |
| Auth | [NextAuth.js](https://next-auth.js.org) **v4** (JWT strategy + credentials) |
| Validation | [Zod](https://zod.dev) **4** |

---

## Architecture (high level)

```text
Browser  →  Next.js (App Router + Route Handlers)
                 ↓
            getServerSession / JWT (NextAuth)
                 ↓
            Prisma + PostgreSQL
```

- **Pages** under `src/app` use server components where helpful; interactive areas use client components in `src/components`.
- **API routes** under `src/app/api` enforce auth via shared helpers in `src/lib/rbac.ts`.
- **Middleware** (`src/middleware.ts`) protects routes and APIs (public: `/`, `/login`, `/signup`, `/api/auth/*`).

---

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **PostgreSQL** 14+ (local or hosted, e.g. Neon, Supabase, Railway Postgres)
- **npm** (or compatible package manager)

---

## Getting started

### 1. Clone and install

```bash
git clone <your-repo-url> task-manager
cd task-manager
npm install
```

### 2. Environment variables

Copy the example file and fill in real values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (SSL params as required by your host) |
| `NEXTAUTH_URL` | Yes | App origin, e.g. `http://localhost:3000` in dev, **`https://your-domain`** in production |
| `NEXTAUTH_SECRET` | Yes | Random secret for signing JWTs — e.g. `openssl rand -base64 32` |

> **Important:** `NEXTAUTH_URL` must match the URL users open in the browser (including `https` in production), or session cookies and auth callbacks can misbehave.

### 3. Database schema

Generate the Prisma client and apply migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

For local development against a fresh database, you can use:

```bash
npx prisma migrate dev
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. First account = admin

The **first registered user** in the database is assigned the **`ADMIN`** role; subsequent signups are **`MEMBER`**. Use `/signup` once on an empty database, then `/login`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js in development mode |
| `npm run build` | Production build (requires `DATABASE_URL` for Prisma config during build) |
| `npm run start` | Start production server (uses `PORT` if set, e.g. on Railway) |
| `npm run lint` | Run ESLint |

---

## Deployment (Railway)

1. **Create** a Railway project with **PostgreSQL** and a **web service** from this repository.
2. Set **`DATABASE_URL`** on the web service (reference the Postgres plugin variable). It must be available at **build time** as well as runtime (Prisma 7 loads `prisma.config.ts` during `next build`).
3. Set **`NEXTAUTH_URL`** to your service’s **public HTTPS URL** (Railway → *Networking* → generate domain).
4. Set **`NEXTAUTH_SECRET`** to a strong production-only secret.
5. **Release / migrate:** run `npx prisma migrate deploy` on each deploy (Railway *Release Command* or equivalent) **before** the app starts.
6. **Start command:** `npm run start` (after `npm run build` in the build phase).

Suggested build command:

```bash
npx prisma generate && npm run build
```

---

## Project structure

```text
task-manager/
├── prisma/
│   ├── schema.prisma          # Data models & enums
│   └── migrations/            # SQL migrations
├── prisma.config.ts           # Prisma 7 datasource / migrations path
├── src/
│   ├── app/                   # App Router: pages + API routes
│   │   ├── api/               # REST-style route handlers
│   │   ├── dashboard/
│   │   ├── login/ | signup/
│   │   ├── projects/
│   │   └── tasks/
│   ├── components/            # React UI (clients + layout)
│   ├── lib/                   # prisma, auth, rbac, validation, helpers
│   ├── middleware.ts          # Auth gate for pages & APIs
│   └── types/                 # NextAuth module augmentation
├── .env.example               # Environment template
└── package.json
```

---

## API overview

All JSON APIs under `/api` (except `/api/auth/*`) expect an authenticated session unless noted.

| Method | Path | Summary |
|--------|------|---------|
| `POST` | `/api/auth/signup` | Register (public) |
| `POST` | `/api/auth/login` | Sign in, sets session cookie |
| `POST` | `/api/auth/logout` | Clears session cookie |
| `*` | `/api/auth/[...nextauth]` | NextAuth handler |
| `GET` | `/api/projects` | List / search projects (cursor pagination) |
| `POST` | `/api/projects` | Create project (admin) |
| `GET` `PATCH` `DELETE` | `/api/projects/[id]` | Project CRUD (access rules apply) |
| `POST` | `/api/projects/[id]/members` | Add member (admin) |
| `DELETE` | `/api/projects/[id]/members/[memberId]` | Remove member by user id (admin) |
| `GET` | `/api/projects/[id]/timeline` | Activity log for project |
| `GET` `POST` | `/api/tasks` | List / create tasks |
| `PATCH` `DELETE` | `/api/tasks/[id]` | Update / delete task |
| `GET` `POST` | `/api/tasks/[id]/comments` | Task comments |
| `GET` | `/api/dashboard` | Dashboard aggregates |

Request bodies are validated with **Zod** schemas in `src/lib/validation/`.

---

## Security notes

- Passwords are never stored in plain text (`bcrypt`).
- Use a unique, long **`NEXTAUTH_SECRET`** per environment.
- Prefer **HTTPS** in production so secure cookie settings align with `NEXTAUTH_URL`.
- The first-user-admin bootstrap is convenient for demos; lock down **signup** or seed admins differently for public production if needed.

---

## License

Private / unpublished — add a `LICENSE` file when you decide how this project is shared.

---

<p align="center">
  <strong>Team Task Manager</strong> — ship work with clarity.
</p>
