# Finance Data Processing and Access Control

A full-stack submission for the assignment with:

- Express + TypeScript backend
- SQLite persistence using better-sqlite3
- Role-based access control (viewer, analyst, admin)
- Financial records CRUD and filtering
- Dashboard summary APIs (overview, category totals, trends, recent activity)
- React + Tailwind UI for interacting with the backend

## Project Structure

- `backend/` - API server, data model, validation, RBAC, persistence
- `frontend/` - Tailwind UI dashboard client

## Tech Choices

- Backend: Node.js, Express, TypeScript, Zod, SQLite
- Frontend: React, Vite, Tailwind CSS
- Auth style: Mock auth via `x-user-id` request header

## Backend Features

### 1. User and Role Management

- Create users (admin only)
- List users
- Update user status active/inactive (admin only)
- Assign/change role (admin only)

### 2. Financial Record Management

- Create record (analyst/admin)
- View record list (all roles)
- Update record (analyst/admin)
- Delete record (admin only)
- Filter list by `type`, `category`, `startDate`, `endDate`
- Pagination via `page`, `pageSize`

### 3. Dashboard Summary APIs

- Overview: total income, total expenses, net balance, total records
- Category totals
- Trends (monthly or weekly)
- Recent activity

### 4. Access Control Logic

Permissions are enforced in middleware.

- Viewer: read records, read users list, read summaries
- Analyst: viewer permissions + create/update records
- Admin: full users and records management

### 5. Validation and Error Handling

- Zod-based request validation
- Structured API errors with proper status codes
- 404 route handler and centralized error middleware

### 6. Persistence

- SQLite database file: `backend/finance.db`
- Auto-creates tables on startup
- Auto-seeds initial users:
  - Admin User (id 1)
  - Analyst User (id 2)
  - Viewer User (id 3)

## API Endpoints

All protected endpoints require header:

- `x-user-id: <seeded-or-created-user-id>`

Public:

- `GET /health`

Auth context:

- `GET /api/auth/me`

Users:

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id/status`
- `PATCH /api/users/:id/role`

Records:

- `GET /api/records?page=1&pageSize=10&type=income&category=Salary&startDate=2026-01-01&endDate=2026-12-31`
- `POST /api/records`
- `PUT /api/records/:id`
- `DELETE /api/records/:id`

Summary:

- `GET /api/summary/overview`
- `GET /api/summary/category-totals`
- `GET /api/summary/trends?period=monthly`
- `GET /api/summary/recent-activity?limit=5`

## Run Locally

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

Server runs at `http://localhost:4000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`.

## Build Validation

Both apps compile successfully:

- Backend: `npm run build`
- Frontend: `npm run build`

## Notes and Assumptions

- Authentication is mocked for assignment simplicity using `x-user-id`.
- Role enforcement is backend-first. The UI also conditionally exposes controls by role.
- The assignment asks for clear structure and correctness over production complexity.
