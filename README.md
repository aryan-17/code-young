# Trial Class Booking — Codeyoung

A full-stack trial class booking system where parents (US/UK/Ireland) book a free 30-minute session and a mentor (India) is auto-assigned. Built with React, Fastify, SQLite, and TypeScript.

## Quick Start

**Prerequisites:** Node.js 20+ and npm 10+.

```bash
git clone https://github.com/aryan-17/code-young.git
cd code-young
npm install
npm run seed:scenarios   # seed 10 mentors + demo bookings
npm run dev              # starts server (:3000) + client (:3001)
```

Open [http://localhost:3001](http://localhost:3001) to book a trial class.

| URL | Purpose |
|-----|---------|
| `http://localhost:3001` | Parent booking flow |
| `http://localhost:3001/mentor` | Mentor view (demo) |
| `http://localhost:3001/outbox` | Simulated email outbox |
| `http://localhost:3000/api/health` | API health check |

## Configuration

All config is via environment variables, validated with zod at startup. See `server/.env.example`.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATABASE_PATH` | `data.db` | SQLite file path |
| `LEAD_TIME_MINUTES` | `120` | Minimum hours before a bookable slot |
| `BOOKING_HORIZON_DAYS` | `14` | How many days ahead parents can book |
| `SLOT_MINUTES` | `30` | Slot duration |
| `MAX_CLASSES_PER_MENTOR_PER_DAY` | `2` | Capacity cap per mentor per day |
| `CLASS_LINK_BASE_URL` | `https://class.codeyoung-demo.com/trial` | Dummy class link prefix |
| `NOW_OVERRIDE` | — | Dev only: freeze time to an ISO instant for DST demos |

## Running Tests

```bash
npm test              # all tests (server + client)
npm run test:server   # server only (domain, API, concurrency)
npm run test:client   # client only
npm run typecheck     # TypeScript strict across all packages
```

**99 tests** covering domain logic, DST edge cases, API integration, concurrency, and client rendering.

## Demo Guide

After `npm run seed:scenarios`, the following states are pre-populated:

| What to see | Where to look |
|-------------|---------------|
| Mentor at 2/2 capacity | Mentor 1 (Priya Sharma) on 2026-11-17 — fully booked |
| Slot with 1 mentor left | 2026-11-18 at 15:00 UTC — only Mentor 4 (Rohan Desai) available |
| Fully booked day | Mentor 4 on 2026-11-19 |
| Race-lost booking | Book a slot, then try the same slot in another tab |
| DST demo | Set `NOW_OVERRIDE=2027-03-10T12:00:00Z` and restart — mismatch week visible |
| Mentor view | `/mentor` — pick any mentor to see their schedule |
| Outbox | `/outbox` — all simulated notifications after booking |
| Cancel + rebook | `/booking/:token` — cancel, then book the freed slot |
| .ics download | `/booking/:token` — "Add to calendar" button |

## API Reference

All responses JSON. Errors: `{ "error": { "code": string, "message": string, "details"?: object } }`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness |
| GET | `/api/slots?timezone=&from=&to=` | Slots grouped by parent-local date |
| POST | `/api/bookings` | Create booking |
| GET | `/api/bookings/:token` | Booking detail |
| POST | `/api/bookings/:token/cancel` | Cancel booking |
| GET | `/api/bookings/:token/ics` | Calendar file (.ics) |
| GET | `/api/mentors` | Mentor list |
| GET | `/api/mentors/:id/bookings` | Mentor's upcoming classes |
| GET | `/api/notifications` | Notification outbox |

**Error codes:** `VALIDATION_ERROR` (400), `INVALID_TIMEZONE` (400), `SLOT_OUT_OF_RANGE` (400), `SLOT_NOT_ON_GRID` (400), `BOOKING_NOT_FOUND` (404), `SLOT_UNAVAILABLE` (409), `ALREADY_BOOKED` (409), `ALREADY_CANCELLED` (409), `INTERNAL` (500).

<details>
<summary>POST /api/bookings — request body</summary>

```json
{
  "startUtc": "2026-11-20T21:00:00Z",
  "timezone": "America/New_York",
  "idempotencyKey": "uuid",
  "parent": { "name": "Jane", "email": "jane@example.com", "phone": null },
  "child": { "name": "Billy", "age": 9 }
}
```
</details>

<details>
<summary>GET /api/slots — response shape</summary>

```json
{
  "timezone": "America/New_York",
  "zoneLabelNow": "Eastern Time · EST",
  "days": [
    {
      "date": "2026-11-20",
      "label": "Fri, 20 Nov",
      "availableCount": 6,
      "slots": [
        { "startUtc": "...", "localTime": "4:00 PM", "zoneAbbr": "EST", "available": true }
      ]
    }
  ]
}
```
</details>

## Architecture

```
client/               React 18 + Vite + Tailwind v4 + TanStack Query
  ├── pages/          BookingPage, ConfirmationPage, ManageBookingPage, MentorPage, OutboxPage
  ├── features/       booking step components + hooks
  └── components/     shared UI (SlotButton, ProgressBar, EmptyState, etc.)

server/               Fastify + better-sqlite3 + Luxon
  ├── routes/         HTTP layer — parse, call service, map errors
  ├── services/       Orchestration — SlotService, BookingService, NotificationService
  ├── domain/         PURE business rules — slot expansion, eligibility, alternatives (no I/O)
  ├── strategies/     AssignmentStrategy (LeastLoadedStrategy)
  ├── notifiers/      Notifier adapter (ConsoleNotifier)
  ├── repositories/   SQL data access behind interfaces
  ├── db/             Connection, migrations, seed
  └── lib/            Clock, errors, types

shared/               Shared between client and server
  ├── schemas/        Zod schemas for request/response validation
  ├── time/           formatZoneLabel, getZoneAbbr, formatTimeLabel, formatDateLabel
  └── types.ts        Error codes, response types
```

### Patterns & SOLID Principles

| Principle/Pattern | Implementation |
|-------------------|----------------|
| **Single Responsibility** | Routes handle HTTP only; services orchestrate; domain is pure; repos do SQL |
| **Open/Closed** | New assignment strategies or notifiers = new class, no modification to services |
| **Liskov Substitution** | SystemClock/FixedClock, ConsoleNotifier/future EmailNotifier — interchangeable |
| **Interface Segregation** | Clock (1 method), AssignmentStrategy (1 method), Notifier (1 method) |
| **Dependency Inversion** | Services depend on abstractions; composition root in `app.ts` wires concretions |
| **Strategy** | `LeastLoadedStrategy` — pluggable mentor assignment |
| **Repository** | Data access behind `MentorRepository`, `BookingRepository`, `NotificationRepository` |
| **Adapter** | `Notifier` interface — console now, email later |
| **Composition Root** | `buildApp()` wires all deps; tests override with `FixedClock`, mock notifiers |
| **Factory** | `buildApp(options)` creates configured Fastify instance |

## Time Zone & DST Approach

- **UTC storage:** All booking times stored as ISO-8601 UTC strings. Never store local times.
- **IANA zones only:** `America/New_York`, `Europe/London`, `Asia/Kolkata`, etc. Never fixed offsets.
- **Convert at edges:** Local times computed only for display and notification text.
- **Curated zone labels:** Hand-mapped abbreviations (BST, IST, EST, etc.) because Intl returns "GMT+1" for BST in en-US. Dublin IST always disambiguated as "(Irish Summer Time)". India IST always shows "(UTC+5:30)".
- **Slot grid:** 30-min slots at :00/:30 UTC — lands on :00/:30 local for all supported zones.
- **Mentor availability:** Rules stored in mentor-local time. Midnight-crossing shifts handled correctly (end <= start = next day).
- **Per-day capacity:** "Day" = calendar date in mentor's timezone, protecting the mentor's workload.
- **DST handling:** Spring-forward days have no slots during the skipped hour. Fall-back days show two slots at the repeated hour with different zone abbreviations (e.g., "1:30 AM EDT" vs "1:30 AM EST").
- **Nepal/Chatham caveat:** Zones with :45 offsets are out of scope (slots would land at :15/:45 local).

One parent-local day can map to two mentor-local days and vice versa.

## Concurrency Approach

Booking creation runs inside a SQLite `BEGIN IMMEDIATE` transaction:

1. Takes write lock up front (serialises concurrent bookers)
2. Loads eligible mentors inside the transaction
3. Strategy picks mentor → INSERT booking
4. If unique index fires (race), retries once with remaining candidates
5. COMMIT

Defence in depth:
- `UNIQUE(mentor_id, start_utc) WHERE status='confirmed'` partial index
- Capacity check inside the same transaction
- Client sends UUID `idempotencyKey` to absorb double-clicks
- Tested: 10 parallel requests with 1 mentor → exactly 1 success, 9 × 409

## Product Decisions & Assumptions

| Decision | Rationale |
|----------|-----------|
| 30-minute slots at :00/:30 UTC | Aligns with IST (+5:30) and all whole-hour-offset zones |
| 2-hour lead time | Gives mentors preparation time; configurable |
| 14-day booking horizon | Balances availability vs. no-show risk; configurable |
| Max 2 classes per mentor per day | Protects mentor workload; measured on mentor-local calendar |
| One trial per (email, child name) | Prevents accidental duplicates; cancel + rebook covers re-scheduling |
| Parents don't choose mentors | Keeps capacity flexible; matches typical trial flow |
| Mentor assignment: least-loaded | Fewest on day → fewest in window → lowest id (deterministic) |
| No slot holds/reservations | Low contention (~20 bookings/day); race-lost handled gracefully |
| Date format: "Fri, 20 Nov" | Avoids US (11/20) vs UK (20/11) confusion |

## Not Built and Why

| Feature | Reason |
|---------|--------|
| Real authentication | Trial booking is top-of-funnel, no-account flow; login adds friction. Unguessable token links used instead. |
| Real email/SMS | Assignment allows dummy delivery. `Notifier` interface makes swapping in a provider a one-file change. |
| Real video links | Assignment says assume the link works. |
| Rescheduling | Cancel + rebook covers it for trials; rescheduling adds state complexity for little value. |
| Subject/course matching | Not in requirements. First natural extension; the strategy interface allows it. |
| Mentor admin panel | Seeded schedules acceptable per the brief. |
| Slot holds during form fill | Low contention. Race-lost case handled gracefully (form data kept, alternatives shown). |
| Payments, i18n, multi-tenant | Out of scope for a free trial. |

## Research Notes

> Section to be filled by Aryan after walking through Codeyoung's own flow, Calendly, Cal.com, and other ed-tech trial booking pages — see DESIGN.md §10.

## Scaling Notes

For production scale beyond SQLite:

| Area | Change |
|------|--------|
| **Database** | Postgres with `SELECT ... FOR UPDATE` or advisory locks for booking transactions. Alternatively, exclusion constraints for non-overlapping slots. |
| **Email** | Replace `ConsoleNotifier` with a queue-backed `EmailNotifier` (SQS/Bull + SendGrid/SES). Outbox table already exists for at-least-once delivery. |
| **Auth** | Add session-based or JWT auth. Mentor page gets proper access control. |
| **Multi-instance** | Move from SQLite `BEGIN IMMEDIATE` to Postgres row-level locks. Stateless Fastify instances behind a load balancer. |
| **Search performance** | Index optimization, materialized slot availability, or Redis cache for hot slot data. |

## AI Usage

This project was built using Claude Code in milestone-scoped sessions with a design-first approach. DESIGN.md was the source of truth; CLAUDE.md enforced coding rules. Domain logic was written tests-first.

See [TRANSCRIPT.md](./TRANSCRIPT.md) for the full AI session transcript.

## Dependencies

All dependencies justified per DESIGN.md §3.1:

| Dependency | Why |
|------------|-----|
| `fastify` | Fast, first-class schema validation, easy `inject()` testing |
| `better-sqlite3` | Zero setup, synchronous transactions for simple concurrency reasoning |
| `luxon` | Mature IANA zone handling, explicit zone on every DateTime |
| `zod` | Shared schemas between client and server |
| `uuid` | Idempotency keys and class link generation |
| `react` + `react-dom` | Required per assignment |
| `react-router-dom` | Client routing (few routes) |
| `@tanstack/react-query` | Caching, refetch after booking, error states |
| `tailwindcss` | Fast, consistent, responsive styling |
| `vite` | Fast dev server and build |
| `vitest` | One test runner for both packages |
