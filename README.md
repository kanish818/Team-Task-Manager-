# Team Task Manager

Full-stack task manager with authentication, project/team management, task assignment, role-based access control, and a dashboard for overdue and status tracking.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Deployment: Backend on Railway, frontend on Vercel

## Features

- Signup and login with JWT authentication
- Create and manage projects
- Add members as `ADMIN` or `MEMBER`
- Create, assign, update, and delete tasks
- Dashboard summary for total, in-progress, done, overdue, and personal workload
- Validation with Zod and database relations via Prisma

## Local Setup

1. Install dependencies:

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

2. Configure environment files:

- Backend: create `backend/.env` from `backend/.env.example`
- Frontend: create `frontend/.env` from `frontend/.env.example`

3. Generate Prisma client:

```bash
cd backend
npm run prisma:generate
```

4. Run migrations when using an accessible PostgreSQL URL:

```bash
cd backend
npm run prisma:migrate
```

5. Start both apps:

```bash
npm run dev
```

## Environment Variables

### Backend

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `CORS_ORIGIN`

### Frontend

- `VITE_API_URL`

## Deployment

### Railway backend

- Create a Railway service from the `backend` directory
- Set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`
- The Railway internal Postgres URL works on Railway itself. For local DB access, use a public connection string instead.
- Build command: `npm install && npm run prisma:generate && npm run build`
- Start command: `npm run prisma:deploy && npm run start`

### Vercel frontend

- Import the repo and set the root directory to `frontend`
- Set `VITE_API_URL` to the deployed Railway backend URL plus `/api`

## Submission Checklist

- Live frontend URL
- Live backend URL
- GitHub repository URL
- README
- 2 to 5 minute demo video
