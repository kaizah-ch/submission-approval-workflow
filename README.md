# Submission & Approval Workflow

A full-stack technical assessment implementing **Assignment B**: a two-sided request submission and approval workflow with server-enforced roles, a strict status state machine, and an immutable audit trail.

Applicants create and submit requests; reviewers move them through the workflow (start review, approve, reject, or return for changes). Every status change is recorded with the actor, timestamp, and an optional comment.

## Live Demo

- Frontend: _TODO after deployment_
- Backend API: _TODO after deployment_

## Test Credentials

| Role | Email | Password |
|---|---|---|
| Applicant | applicant@example.com | Password123! |
| Reviewer | reviewer@example.com | Password123! |

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form
- **Backend:** Node.js, Express, TypeScript, Prisma
- **Database:** PostgreSQL
- **Testing:** Jest, Supertest
- **Local infrastructure:** Docker Compose

## Local Setup

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)

### 1. Install dependencies

```bash
npm --prefix backend install
npm --prefix frontend install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL on host port `5434` (mapped to the container's `5432`).

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

The defaults match the Docker Compose database, so no edits are needed for local development.

### 4. Migrate and seed the database

```bash
cd backend
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

The seed creates the two users above and one sample draft application.

### 5. Run the backend

```bash
npm run dev
```

Backend runs on `http://localhost:4000`.

### 6. Run the frontend

In a second terminal:

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Data Model

Three tables, defined in `backend/prisma/schema.prisma`.

### User

A seeded account with a role that determines what they can do.

| Field | Notes |
|---|---|
| `id` | UUID primary key |
| `name` | Display name |
| `email` | Unique login identifier |
| `passwordHash` | bcrypt hash; never returned to the client |
| `role` | `APPLICANT` or `REVIEWER` |

### Application

A single submission and its current workflow state.

| Field | Notes |
|---|---|
| `id` | UUID primary key |
| `title` | Required, minimum 3 characters |
| `category` | Enum: `PROCUREMENT`, `GRANT`, `TRAVEL`, `TRAINING`, `OTHER` |
| `description` | Optional |
| `amount` | Optional, stored as `Decimal(12,2)` |
| `status` | Workflow state (see below), defaults to `DRAFT` |
| `ownerId` | The applicant who owns it |
| `createdAt` / `updatedAt` | Timestamps |

Indexed on `ownerId` and `status` to keep the applicant list and reviewer queue efficient.

### AuditLog

An append-only record of every status change.

| Field | Notes |
|---|---|
| `id` | UUID primary key |
| `applicationId` | The application that changed |
| `oldStatus` / `newStatus` | The transition |
| `comment` | Optional note (required for reject/return) |
| `performedById` | The user who made the change |
| `createdAt` | Timestamp |

Audit rows are only ever created, never updated or deleted, so the history is immutable.

## Workflow / State Machine

Statuses:

- `DRAFT`
- `SUBMITTED`
- `UNDER_REVIEW`
- `APPROVED`
- `REJECTED`
- `RETURNED_FOR_CHANGES`

Allowed transitions (the only legal moves):

| Action | From | To | Role | Comment |
|---|---|---|---|---|
| Submit | `DRAFT`, `RETURNED_FOR_CHANGES` | `SUBMITTED` | Applicant | — |
| Start review | `SUBMITTED` | `UNDER_REVIEW` | Reviewer | — |
| Approve | `SUBMITTED`, `UNDER_REVIEW` | `APPROVED` | Reviewer | — |
| Reject | `SUBMITTED`, `UNDER_REVIEW` | `REJECTED` | Reviewer | **Required** |
| Return for changes | `SUBMITTED`, `UNDER_REVIEW` | `RETURNED_FOR_CHANGES` | Reviewer | **Required** |

When a reviewer returns an application, the applicant can edit it (which moves it back to `DRAFT`) and resubmit, closing the loop. `APPROVED` and `REJECTED` are terminal states.

The rules live in a single state machine (`backend/src/services/workflowService.ts`). Every transition endpoint calls it, so the logic cannot drift between routes. Each rule check maps to a specific HTTP status:

- Wrong role → `403`
- Illegal transition for the current status → `409`
- Missing required comment → `400`

## Authorization Rules

Authorization is enforced **server-side on every request**. The UI hides actions a user can't take, but the API never trusts the client.

- All `/api` routes (except login) require a valid JWT.
- Only **applicants** can create, edit, or submit applications.
- An applicant can only act on applications they **own**, and can only view their own.
- An applicant can only edit an application while it is `DRAFT` or `RETURNED_FOR_CHANGES`; editing after submission returns `409`.
- Only **reviewers** can start review, approve, reject, or return.
- An applicant calling a reviewer endpoint directly receives `403`, even with a valid token.
- The create/edit input schema only accepts `title`, `category`, `description`, and `amount`, so a client cannot set `status` or `ownerId` directly.

### HTTP status codes

| Code | Meaning |
|---|---|
| `400` | Validation error (invalid body or query) |
| `401` | Missing or invalid token |
| `403` | Authenticated but not allowed |
| `404` | Resource not found |
| `409` | Illegal workflow transition |

All errors return a structured JSON body: `{ "message": "..." }` (validation errors also include field details).

## Testing Strategy

Run the suite:

```bash
cd backend
npm test
```

Tests are split into two layers:

- **Unit tests (`tests/workflowService.test.ts`)** exercise the state machine in isolation: every legal transition returns the correct next status, and every illegal one throws with the right HTTP status — covering role restrictions (`403`), illegal transitions (`409`), and required comments (`400`).
- **API tests (`tests/authz.test.ts`)** use Supertest against the real Express app and database to prove authorization is enforced, not assumed:
  - unauthenticated and invalid-token requests return `401`;
  - role segregation on list endpoints (`403`);
  - an applicant cannot approve/reject/return/start-review via direct API calls (`403`);
  - reject/return without a comment return `400`;
  - illegal transitions return `409`;
  - an applicant cannot view or edit another applicant's application (`403`);
  - **positive controls**: an owner can edit their own draft, and a reviewer's approval succeeds **and writes the expected audit log row**.

The positive controls matter as much as the negative ones: they confirm the workflow actually works and that the audit trail is written, rather than only checking that bad requests fail.

## Design Decisions

- **Centralized state machine.** All transition rules live in one service that controllers call, so behaviour is consistent across endpoints and easy to unit test.
- **Server-side authorization.** Role and ownership checks run on every mutation; the frontend is treated as untrusted.
- **Atomic status change + audit log.** Each transition updates the status and writes the audit row inside a single Prisma transaction, so a status can never change without being recorded.
- **Async error handling.** Express 4 does not forward rejected promises to error middleware, so async handlers are wrapped in a small `asyncHandler` utility. This ensures invalid actions return structured HTTP errors instead of hanging the request.
- **Input validation at the boundary.** Zod validates request bodies and query params, returning `400` for bad input rather than letting it reach the database.
- **PostgreSQL + Prisma.** Relational integrity fits the user/application/audit relationships, and Prisma keeps the schema explicit and access type-safe.

## Trade-offs and What I Would Add With More Time

Deliberate scope decisions for this assessment:

- **Authentication is intentionally simple** — JWT login with seeded users. Production would add refresh tokens, password reset, login auditing, and stronger session management.
- **File uploads were omitted** to keep the core workflow, authorization, audit trail, and tests solid.
- **Reviewer queue search/filtering is server-side** but unpaginated, which is fine for the assessment's data volume.

With more time I would add:

- Pagination on the reviewer queue.
- In-app notifications on status changes.
- A frontend route guard and automatic redirect to login on `401`.
- More API integration tests covering the full return-for-changes resubmission loop.
- A CI pipeline running lint, build, and tests on every push.
- Production Dockerfiles for the backend and frontend.

## AI Usage

I used AI assistance during development and was responsible for reviewing, testing, and understanding all output.

- **ChatGPT** — architecture planning, workflow design, debugging guidance, README drafting, and code review.
- **Claude** — frontend UX review, refactoring suggestions, README improvement, and test review.

All AI-assisted code and documentation were reviewed, tested, and understood by me before submission. I can explain every design decision, workflow rule, authorization check, and test in this project.
# submission-approval-workflow
