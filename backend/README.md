# Smart Appointment Backend

A small, REST-first backend for the Smart Appointment and Queue Management assignment. It uses Node.js, TypeScript, Express, MongoDB, and Mongoose, with a lightweight Domain-Driven Design (DDD) layout.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB, or a MongoDB Atlas connection string

## Run locally

```bash
npm install
Copy-Item .env.example .env
```

Open `.env` and set `JWT_SECRET` to a private random value at least 24 characters long. Set `MONGODB_URI` if MongoDB is not using the local replica-set default. Then start the API:

```bash
npm run dev
```

The TypeScript API listens on `http://localhost:3000`. Check `GET /health` to see whether the server is responding. MongoDB must be reachable before the API starts.

For a production-style JavaScript build:

```bash
npm run build
npm start
```

### Create the first administrator

Public registration always creates a **Customer**; it never accepts a role. For the first administrator only, set `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PHONE`, and `ADMIN_PASSWORD` (at least 8 characters) in `.env`, then run:

```bash
npm run seed:admin
```

The script refuses to overwrite an existing account. Clear the four bootstrap values after the administrator has been created.

### Optional email

Emails are sent for appointment confirmation, cancellation, and rescheduling when `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASSWORD` are set. Leave them blank for local development without SMTP. Email sending errors are returned as request errors and logged by the server.

## Tests

```bash
npm test
```

The current workspace does not contain the test files referenced by this script, so `npm test` currently fails until those files are restored or replaced. Database-backed booking validation requires a reachable MongoDB instance.

To exercise appointment concurrency against the real API with disposable data,
set `TEST_MONGODB_URI` to a reachable MongoDB server URI and run:

```powershell
$env:TEST_MONGODB_URI = "mongodb://127.0.0.1:27017/?replicaSet=rs0"
npm run test:appointment-concurrency
```

The test creates a uniquely named database, seeds temporary customer/staff/
service data, sends two identical bookings concurrently, tries a separate
overlapping booking, and races direct writes against the unique index. It logs
the outcomes and drops only the database it created. Do not point
`TEST_MONGODB_URI` at a production MongoDB server.

## Project structure

```text
src/
  domain/                  Appointment, queue, time rules, and domain errors
  application/
    services/              Booking, customer, staff, queue, and dashboard workflows
    jobs/                  Scheduled no-show processing
  infrastructure/
    config/                Validated environment settings
    database/              MongoDB connection, Mongoose models, admin bootstrap
    email/                 SMTP email adapter
  presentation/
    controllers/           HTTP request and response handling
    middleware/            Authentication, permissions, errors
    routes/                REST API routes
  app.ts                   Express application
  server.ts                HTTP server and application startup
test/
  domain/                  Fast, database-free domain tests

TypeScript configuration lives in `tsconfig.json`. Source and test files use `.ts`; `npm run build` compiles them to the ignored `dist/` directory.
```

The domain contains business rules and does not depend on Express or MongoDB. Application services coordinate use cases; the infrastructure folder contains database and external-service details; the presentation layer handles HTTP requests. Request-schema validation middleware is temporarily removed. Mongoose schema validation and application business rules remain, but this temporary state does not meet the assignment requirement to validate every input on the server.

For a short presentation script and common questions, see [backend-presentation-guide.md](../docs/backend-presentation-guide.md). For detailed function explanations, see [backend-function-guide.md](../docs/backend-function-guide.md). For diagrams showing appointment requests through the code, see [appointment-booking-flow.md](../docs/appointment-booking-flow.md). For how appointment slot uniqueness works and when MongoDB transactions are needed, see [mongodb-session-guide.md](../docs/mongodb-session-guide.md).

## API

All routes below are prefixed with `/api`. Successful responses use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "error": { "code": ..., "message": ... } }`. Validation errors also include a `details` array. Protected routes use `Authorization: Bearer <token>`.

The OpenAPI specification is in [`docs/openapi.yaml`](./docs/openapi.yaml).

### Authentication and staff

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/auth/register` | Public; creates a Customer |
| `POST` | `/auth/login` | Public |
| `GET` | `/auth/me` | Signed in |
| `POST` | `/auth/logout` | Signed in; remove the token on the client |
| `GET` | `/users/staff?serviceId=<id>` | Signed in |
| `POST` | `/users/staff` | Admin |
| `POST` | `/users/receptionists` | Admin |

Registration body: `{ "fullName": "Maya Haddad", "email": "maya@example.com", "phone": "+961 71 123456", "password": "at-least-8-characters" }`. Login body: `{ "email": "maya@example.com", "password": "..." }`. Staff creation uses the registration fields; the server assigns the Staff role.
Receptionist creation uses the same registration fields; the server assigns the Receptionist role.

### Services and schedules

| Method | Route | Access |
| --- | --- | --- |
| `GET` | `/services` | Public; active services only |
| `GET` | `/services?includeInactive=true` | Admin |
| `POST` | `/services` | Admin |
| `PUT` | `/services/:id` | Admin |
| `PATCH` | `/services/:id/status` | Admin |
| `GET` | `/staff/:id/schedule` | Signed in; Staff may view their own |
| `PUT` | `/staff/:id/schedule` | Admin |

Service body: `{ "name": "General Consultation", "description": "Initial consultation", "durationMinutes": 30, "price": 25 }`. A status update uses `{ "active": false }`.

Schedule body: `{ "weeklyIntervals": [{ "day": 1, "from": "09:00", "to": "17:00" }], "daysOff": [0, 6], "services": ["<serviceId>"] }`. Weekdays use JavaScript numbering: Sunday `0` through Saturday `6`. Intervals use local business time and may not overlap.

### Appointments

| Method | Route | Access |
| --- | --- | --- |
| `GET` | `/appointments/availability?serviceId=<id>&staffId=<id>&date=YYYY-MM-DD` | Public |
| `POST` | `/appointments` | Customer |
| `GET` | `/appointments` | Signed in; scoped to the caller |
| `GET` | `/appointments/:id` | Owner, assigned Staff, or Admin |
| `PATCH` | `/appointments/:id/confirm` | Admin or Receptionist |
| `PATCH` | `/appointments/:id/cancel` | Owner, assigned Staff, or Admin |
| `PATCH` | `/appointments/:id/reschedule` | Owner, assigned Staff, or Admin |

Availability returns start/end timestamps in UTC and the local `HH:mm` slot time. Create and reschedule accept either `{ "service": "<serviceId>", "staff": "<staffId>", "date": "2026-10-14", "time": "10:30" }` or the corresponding ISO 8601 `start` timestamp. The service duration determines the appointment end. Appointment times are interpreted in `BUSINESS_TIME_ZONE`.

Appointment statuses are `Pending`, `Confirmed`, `Checked In`, `In Service`, `Completed`, `Cancelled`, and `No-show`. The server rejects invalid lifecycle changes. Customers only see and change their own bookings; Staff only see and change bookings assigned to them.

### Queue and dashboard

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/queue/check-in` | Admin or Receptionist; body `{ "reference": "APT-ABC123" }` |
| `GET` | `/queue/today` | Admin, Staff, or Receptionist (read-only) |
| `PATCH` | `/queue/:id/call` | Assigned Staff or Admin; a staff member cannot call an entry while another appointment assigned to them is in service |
| `PATCH` | `/queue/:id/complete` | Assigned Staff or Admin |
| `GET` | `/dashboard/stats?from=YYYY-MM-DD&to=YYYY-MM-DD` | Admin |

Check-in numbers increase atomically per local business date. Socket.IO broadcasts persisted appointment and queue changes to authenticated clients; the frontend refreshes active queue, appointment, dashboard, and slot availability views when updates arrive. See [socket-io-guide.md](../docs/socket-io-guide.md) for the event contract and test command. The no-show job runs using `NO_SHOW_CRON` and marks only still-Confirmed appointments after `CHECK_IN_GRACE_MINUTES`.

## Booking safety and time zone

Booking and rescheduling check the overlap rule (`newStart < existingEnd && newEnd > existingStart`) and save one reserved UTC minute array on the appointment. A unique multikey index on staff and reserved minute prevents concurrent overlapping bookings. Cancellation unsets the array. These appointment slot updates are atomic single-document writes and do not require transactions. Adjacent appointments are allowed.

At startup, the backend backfills reserved minute arrays for existing future appointments and creates the appointment indexes before accepting requests. MongoDB transactions are not required for appointment booking. Queue numbering uses an atomic MongoDB counter, and a unique appointment index prevents duplicate check-in.

Configure `BUSINESS_TIME_ZONE` with an IANA time-zone name such as `Asia/Beirut`. Store appointment timestamps in MongoDB as UTC; send schedule intervals and date/time booking choices in the configured business time zone.

## Security notes

- Passwords are hashed with bcrypt; password hashes are never returned by user queries.
- JWTs are signed using `JWT_SECRET` and are not stored in the database. Logout is stateless: the client discards its token.
- Public registration cannot select a privileged role.
- Admin, Receptionist, Staff, and Customer routes are checked by server-side middleware and ownership checks.
- `.env` is ignored by Git; do not commit real credentials.
