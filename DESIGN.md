# Trial Class Booking — Design Doc

> Source of truth for building the Codeyoung Senior Full Stack Engineer assignment.
> Claude Code: read this whole file before writing code. When something here is unclear or
> conflicts with what you're about to do, **stop and ask** instead of guessing.

---

## 0. Context

**Who:** Parents (mostly US / UK / Ireland) book a free 30-minute trial class for their child. A mentor (in India) is auto-assigned. Both get a class link.

**Deadline:** 1–2 days. Favour a working, polished core over breadth.

**Deliverables (all mandatory):**

| # | Deliverable | Notes |
|---|---|---|
| 1 | Public GitHub repo | Link is the submission |
| 2 | `README.md` | Install, configure, run, test, seed data, env vars, API docs, assumptions, trade-offs, architecture notes |
| 3 | `TRANSCRIPT.md` | Full transcript of every AI session (prompts **and** responses). Use `/export` in Claude Code after each session and append |
| 4 | Seed data + env instructions | Must run locally with no external services |

---

## 1. How this will be graded (and what we do about it)

| Criterion | What they look for | How this design answers it |
|---|---|---|
| Product & UX | Usable flow, clarity, design sense, error/empty states | Mobile-first 4-step flow, always-visible time zone, sold-out days handled with alternatives, race-lost recovery keeps form data (§6) |
| Problem solving | Capacity, availability, TZ, DST, concurrency, edge cases | UTC storage + IANA zones only, capacity counted per mentor's local day, transactional booking + unique index, explicit DST test matrix (§4, §5, §9) |
| Architecture | Structure, separation of concerns, scalability, maintainability, patterns | Layered server (routes → services → repositories), pure domain module, injected `Clock`, `AssignmentStrategy` and `Notifier` interfaces, shared zod schemas (§3) |
| Engineering quality | Readability, correctness, validation, errors, tests, sensible deps | Strict TS, zod at every boundary, typed error codes, Vitest unit + integration + concurrency tests, small dependency list (§8, §9) |
| AI usage | Guiding AI to maintainable code, not unstructured prompting | This doc + `CLAUDE.md`, milestone-by-milestone sessions, tests-first for domain logic, transcript kept (§11) |
| Research & judgment | Investigating similar systems; deciding what (not) to build | Research notes in README, explicit non-goals with reasons (§2, §10) |
| Documentation | README, setup, assumptions, architecture, transcript | README outline in §12 |

**"What you do & don't build" is graded.** Every non-goal in §2 must be listed in the README with a one-line reason.

---

## 2. Scope

### 2.1 In scope (must)

1. Parent time zone auto-detected from browser, shown prominently, changeable.
2. Browse available 30-min slots for the next 14 days, grouped by day **in the parent's time zone**.
3. Book a slot with parent + child details; mentor auto-assigned; dummy class link generated.
4. Confirmation screen: parent-local time with zone label, mentor details, class link, booking reference.
5. Mentor receives the same booking expressed in **mentor-local time** (simulated notification + mentor view).
6. Max 2 trial classes per mentor per day.
7. Clear "no mentor available" states with alternative slots.
8. Correct under concurrent booking attempts.
9. Correct across DST transitions (US, UK, Ireland) and half-hour offset (IST).

### 2.2 Should (do if time allows, in this order)

1. Parent can view and cancel their booking via a private link (`/booking/:token`). Cancelling frees capacity.
2. "Add to calendar" (`.ics` download) on confirmation.
3. Dev-only "simulated now" override so reviewers can demo DST weeks in the UI (§9.3).

### 2.3 Non-goals (document each in README)

| Not building | Reason |
|---|---|
| Real authentication | Trial booking is a top-of-funnel, no-account flow; login would add friction. Private unguessable token links are used instead. |
| Real email / SMS | Assignment allows dummy delivery. A `Notifier` interface makes swapping in a provider a one-file change. |
| Real video links | Assignment says assume the link works. |
| Rescheduling | Cancel + rebook covers it for a trial; rescheduling adds state complexity for little value at this scale. |
| Subject/course matching | Not in requirements. First natural extension; the assignment strategy interface allows it. |
| Mentor self-service availability editing / admin panel | Seeded schedules are acceptable per the brief. |
| Slot holds / reservations during form fill | Low contention (~20 bookings/day). Race-lost case is handled gracefully instead. |
| Payments, i18n, multi-tenant | Out of scope for a free trial. |

---

## 3. Architecture

### 3.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) everywhere | Shared types between client and server |
| Server | Node.js 20+, **Fastify** | Fast, first-class schema validation, easy `inject()` testing |
| Validation | **zod** (shared schemas) | One schema for client form + server request |
| DB | **SQLite** via **better-sqlite3** | Zero setup; synchronous transactions make concurrency reasoning simple |
| Migrations | Plain SQL files run at startup | No ORM needed at this size |
| Time | **Luxon** | Mature IANA zone handling, explicit zone on every DateTime |
| Client | React 18 + Vite | Required React; Vite for speed |
| Client data | TanStack Query | Caching, refetch after booking, error states |
| Routing | React Router | Few routes |
| Styling | Tailwind CSS | Fast, consistent, responsive |
| Tests | Vitest, React Testing Library | One runner for both packages |
| Workspace | npm workspaces | No extra tooling |

Every dependency added beyond this list needs a one-line justification in the README.

### 3.2 Repo layout

```
/
├── DESIGN.md                # this file
├── CLAUDE.md                # rules for Claude Code (Appendix A)
├── README.md
├── TRANSCRIPT.md
├── package.json             # workspaces: shared, server, client
├── shared/
│   └── src/
│       ├── schemas/         # zod: booking request, slot, errors
│       ├── types.ts
│       └── time/            # zone labels, formatting helpers (pure)
├── server/
│   ├── src/
│   │   ├── app.ts           # Fastify instance factory (used by tests)
│   │   ├── index.ts         # starts server
│   │   ├── config.ts        # env parsing (zod)
│   │   ├── routes/          # HTTP only: parse, call service, map errors
│   │   ├── services/        # BookingService, SlotService, NotificationService
│   │   ├── domain/          # PURE: slot generation, eligibility, capacity, alternatives
│   │   ├── strategies/      # AssignmentStrategy implementations
│   │   ├── notifiers/       # Notifier implementations (console + outbox)
│   │   ├── repositories/    # SQL only
│   │   ├── db/              # connection, migrations/, seed.ts
│   │   └── lib/             # Clock, errors, id/token generation
│   └── test/
└── client/
    └── src/
        ├── pages/           # BookingPage, ConfirmationPage, ManageBookingPage, MentorPage, OutboxPage
        ├── features/booking # step components, hooks
        ├── components/      # shared UI (TimeZoneBadge, SlotButton, EmptyState…)
        ├── api/             # typed fetch client using shared schemas
        └── lib/
```

### 3.3 Layering rules

- `routes` never touch SQL. `repositories` never contain business rules. `domain` has **no I/O, no `Date.now()`, no DB** — inputs in, outputs out.
- Current time comes only from an injected `Clock` (`SystemClock`, `FixedClock` for tests/demo).
- Patterns used deliberately:
  - **Strategy** — `AssignmentStrategy` picks a mentor from eligible candidates.
  - **Repository** — data access behind interfaces.
  - **Adapter** — `Notifier` (console + DB outbox now; email provider later).
  - **Dependency injection** via a small composition root in `app.ts` (no DI framework).

---

## 4. Time model (most important section)

### 4.1 Rules

1. **Store instants as UTC** (ISO-8601 string with `Z`, e.g. `2026-11-20T15:30:00Z`). Never store local times for bookings.
2. **Zones are IANA names** (`America/New_York`, `Europe/London`, `Europe/Dublin`, `Asia/Kolkata`). Never store or compute with fixed offsets or abbreviations.
3. Convert to local **only at the edges** (slot grouping, display, notification text).
4. All time logic goes through `server/src/domain` or `shared/src/time`. No ad-hoc `new Date()` arithmetic anywhere else.
5. Validate any incoming zone server-side (`DateTime.local().setZone(z).isValid`); reject unknown zones with `400 INVALID_TIMEZONE`.

### 4.2 Slot grid

- Slots are 30 minutes, starting at `:00` and `:30` **UTC**. Because IST is UTC+5:30 and US/UK offsets are whole hours, this grid lands on `:00`/`:30` local for every supported zone. (Zones like Nepal `+5:45` are out of scope; document it.)
- Bookable window: from `now + 2h` (minimum lead time) to end of day 14 in the parent's zone. Both values in config.

### 4.3 Mentor availability (decision)

- Each mentor has **their own weekly working hours** stored as rules in the **mentor's own zone** (field on mentor, seeded as `Asia/Kolkata`, but code must not assume India).
- Rule: `{ mentorId, weekday (1–7, mentor-local), startLocal "HH:mm", endLocal "HH:mm" }`. If `endLocal <= startLocal` the shift **crosses midnight** into the next mentor-local day. This is realistic: Indian mentors teaching US evenings work 02:00–06:00 IST, UK evenings 20:00–00:30 IST.
- Expansion: for each mentor-local date in range, build start/end as Luxon DateTimes in the mentor zone, convert to UTC, cut into 30-min slots.

### 4.4 "Per day" for capacity (decision)

- **Day = calendar date in the mentor's time zone.** The rule protects the mentor's workload, so it's measured on their calendar.
- Each booking stores `mentor_local_date` (`YYYY-MM-DD`) computed at booking time.
- Consequence to handle and test: a midnight-crossing shift spans two mentor-local dates, so a mentor could teach 23:30 IST and 00:00 IST classes that count against different days.
- Note in README: one parent-local day can map to two mentor-local days and vice versa.

### 4.5 DST facts to test against

| Zone | 2026 | 2027 |
|---|---|---|
| US (most) | starts Mar 8, ends Nov 1 | starts Mar 14, ends Nov 7 |
| UK & Ireland | starts Mar 29, ends Oct 25 | starts Mar 28, ends Oct 31 |
| `America/Phoenix` | no DST | no DST |
| `Pacific/Honolulu` | no DST | no DST |
| `Asia/Kolkata` | no DST | no DST |

Mismatch weeks (New York ↔ London gap is 4h instead of 5h): **Mar 14–27 2027** and **Oct 31–Nov 6 2027**. Because today is Nov 16 2026, no transition falls in the live 14-day window — tests must use `FixedClock`.

Consequences the design must handle:
- **Spring forward (nonexistent local times):** never generated, because slots come from UTC. Verify the parent's day simply has no 2:00–2:59 slots.
- **Fall back (repeated local times):** a parent in New York may see two "1:30 AM" slots on Nov 7 2027. They must be distinguishable → always show the zone abbreviation (`1:30 AM EDT` vs `1:30 AM EST`).
- **Ireland:** tzdata models Irish summer time unusually ("negative DST"). Never branch on `isInDST`; only use offsets/zone names from Luxon.

### 4.6 Time zone labels (avoid ambiguity)

- "IST" means both India Standard Time and Irish Standard Time (Irish summer). Never show a bare abbreviation for these.
- `shared/src/time/formatZoneLabel(zone, instant)` returns e.g.
  - `Eastern Time · EST` / `Eastern Time · EDT`
  - `UK time · GMT` / `UK time · BST`
  - `Irish time · GMT` / `Irish time · IST (Irish Summer Time)`
  - `India time · IST (UTC+5:30)`
  - fallback: `America/Sao_Paulo · UTC−3`
- Curated mapping for supported zones (all US zones incl. Alaska, Hawaii, Arizona; London; Dublin; Kolkata); `UTC±hh:mm` fallback for anything else. Note: `Intl` returns `GMT+1` for London in `en-US`, so don't rely on `Intl` short names.
- Every displayed time = time + zone label. Dates use weekday + day + month (`Fri, 20 Nov`) — avoid `11/20` vs `20/11` confusion between US and UK parents.

---

## 5. Booking, assignment, concurrency

### 5.1 Slot availability (domain, pure)

A slot `S` is **available** if at least one mentor is eligible:
1. A mentor availability rule covers all of `S`.
2. The mentor has no confirmed booking overlapping `S`.
3. The mentor's confirmed bookings on `mentorLocalDate(S)` < 2.
4. `S.start >= now + leadTime`.

`GET /slots` returns every grid slot in range with `available: boolean` (unavailable slots shown disabled so the parent understands the shape of the day), but **never** returns mentor identities.

### 5.2 Assignment strategy

Interface: `pick(candidates: EligibleMentor[], context) => Mentor`.
Default `LeastLoadedStrategy`:
1. Fewest bookings on that mentor-local date.
2. Then fewest bookings in the next 14 days (spread load).
3. Then lowest mentor id (deterministic → testable).

Parents don't choose the mentor (matches a typical trial flow; keeps capacity flexible).

### 5.3 Booking transaction (critical path)

```
POST /api/bookings
1. Validate body (zod). Validate zone. Validate startUtc is on grid and inside window.
2. Idempotency: if idempotencyKey already exists → return the existing booking (200).
3. BEGIN IMMEDIATE            -- takes the write lock up front; serialises bookers
4.   Load candidates + their bookings for that slot and mentor-local dates
5.   eligible = domain.eligibleMentors(...)
6.   if none → ROLLBACK → 409 SLOT_UNAVAILABLE + alternatives
7.   mentor = strategy.pick(eligible)
8.   INSERT booking (status='confirmed', token, class link, mentor_local_date)
9.   INSERT notifications (parent copy in parent zone, mentor copy in mentor zone)
10. COMMIT
11. return 201 booking
```

Defence in depth:
- Partial unique index: `UNIQUE(mentor_id, start_utc) WHERE status='confirmed'`.
- Capacity check is inside the same `IMMEDIATE` transaction, so two requests can't both see "1 booking" and both insert.
- If the unique index ever fires, catch it and retry assignment once with the remaining candidates.
- Client sends a UUID `idempotencyKey` per submit attempt to absorb double-clicks and retries.

### 5.4 Duplicate-parent rule (decision)

One **active upcoming** trial per `(parent email, child name)`. A second attempt returns `409 ALREADY_BOOKED` with a link to the existing booking. Reason: trial classes are one per child; prevents accidental duplicates and capacity hogging.

### 5.5 Alternatives (when a slot or a day is unavailable)

`domain.findAlternatives(requested, availability, parentZone)` returns up to 6:
1. Nearest available slots on the same parent-local day (before and after).
2. Same parent-local time on the next available days.
3. Earliest available slot overall.
Deduplicated, sorted by closeness to the requested time.

### 5.6 Class link

`https://class.codeyoung-demo.com/trial/<uuid>` — dummy, stored on the booking, identical for parent and mentor.

### 5.7 Booking token

Separate from the id: 32+ bytes from `crypto.randomBytes`, base64url. Used in `/booking/:token`. Never expose sequential ids publicly.

---

## 6. UX specification

### 6.1 Principles

- Mobile-first (parents book from phones). Works at 360px wide.
- The parent's time zone is **always visible** at the top of the slot picker, with a "Change" control.
- Never show a time without its zone label.
- Keep the flow to 4 steps; show a progress indicator.
- Accessible: keyboard-navigable slot grid, visible focus, labels on inputs, colour isn't the only signal for unavailable slots, `aria-live` for errors.

### 6.2 Flow

1. **Time zone** — auto-detected via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Banner: "Times are shown in **Eastern Time · EST**. Change". Change opens a searchable list: common zones pinned at top (US zones, UK, Ireland), full IANA list below.
2. **Pick a day** — horizontal strip of the next 14 days in parent-local dates. Each day shows a hint: "8 slots", "2 left", or "Fully booked" (disabled styling but still tappable to see alternatives).
3. **Pick a time** — slots grouped Morning / Afternoon / Evening in parent time. Unavailable slots shown disabled with a "Booked" label.
4. **Your details** — parent name, email, child name, child age (5–18), optional phone. Inline validation from shared zod schema. Summary of chosen slot visible above the form.
5. **Confirmation** — big date/time with zone label, duration, mentor name + short bio, class link with copy button, booking reference, "Add to calendar" (should), link to manage booking, note that an email has been sent (simulated).

### 6.3 Error and empty states (graded explicitly)

| Situation | What the parent sees |
|---|---|
| Selected day fully booked | "All our mentors are booked on Fri, 20 Nov." + alternative slot chips + "See next available day" button |
| Whole 14-day window full | Friendly message, explanation that trial demand is high, suggestion to check back; no dead end |
| Slot taken between selecting and confirming (409) | "Sorry — someone just booked that time." Form data **kept**; alternatives shown in place; one tap to rebook |
| Already has a trial (409 ALREADY_BOOKED) | "You already have a trial booked for Maya on …" + link to it |
| Slot now inside lead time | "That time is too soon to book. Here are the next available times." |
| Network / server error | Retry button; nothing lost |
| Loading | Skeletons, not spinners on blank screens |
| Invalid/unknown time zone | Fall back to zone picker with message |

### 6.4 Mentor side

`/mentor` — pick your name from a list (demo-only; stated as a trade-off in README). Shows upcoming classes in **mentor-local time** with zone label, parent/child name, parent's local time for reference, class link, and "N of 2 classes today" per mentor-local day.

### 6.5 Outbox (simulated notifications)

`/outbox` — lists every generated notification: recipient, subject, body. Parent email in parent zone, mentor email in mentor zone. Also logged to server console. Linked from the confirmation page as "View the emails that were sent (demo)".

---

## 7. Data model (SQLite)

```sql
CREATE TABLE mentors (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  timezone    TEXT NOT NULL,           -- IANA
  bio         TEXT NOT NULL
);

CREATE TABLE availability_rules (
  id          INTEGER PRIMARY KEY,
  mentor_id   INTEGER NOT NULL REFERENCES mentors(id),
  weekday     INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7), -- mentor-local, ISO (1=Mon)
  start_local TEXT NOT NULL,           -- 'HH:mm'
  end_local   TEXT NOT NULL            -- 'HH:mm'; <= start means crosses midnight
);

CREATE TABLE bookings (
  id                INTEGER PRIMARY KEY,
  token             TEXT NOT NULL UNIQUE,
  idempotency_key   TEXT NOT NULL UNIQUE,
  mentor_id         INTEGER NOT NULL REFERENCES mentors(id),
  start_utc         TEXT NOT NULL,
  end_utc           TEXT NOT NULL,
  mentor_local_date TEXT NOT NULL,     -- 'YYYY-MM-DD' in mentor tz
  parent_name       TEXT NOT NULL,
  parent_email      TEXT NOT NULL,
  parent_phone      TEXT,
  parent_timezone   TEXT NOT NULL,
  child_name        TEXT NOT NULL,
  child_age         INTEGER NOT NULL,
  class_link        TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('confirmed','cancelled')),
  created_at        TEXT NOT NULL,
  cancelled_at      TEXT
);
CREATE UNIQUE INDEX ux_mentor_slot ON bookings(mentor_id, start_utc) WHERE status = 'confirmed';
CREATE INDEX ix_mentor_day ON bookings(mentor_id, mentor_local_date) WHERE status = 'confirmed';
CREATE INDEX ix_start ON bookings(start_utc);

CREATE TABLE notifications (
  id               INTEGER PRIMARY KEY,
  booking_id       INTEGER NOT NULL REFERENCES bookings(id),
  recipient_type   TEXT NOT NULL CHECK (recipient_type IN ('parent','mentor')),
  recipient_email  TEXT NOT NULL,
  timezone         TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('booking_confirmed','booking_cancelled')),
  subject          TEXT NOT NULL,
  body             TEXT NOT NULL,
  created_at       TEXT NOT NULL
);
```

SQLite settings at connect: `journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000`.

### 7.1 Seed data

- 10 mentors, all `Asia/Kolkata`, realistic names and one-line bios.
- Schedules staggered so coverage maps to parent-friendly hours:
  - 4 mentors on a UK-evening shift (~20:00–00:30 IST, Mon–Fri)
  - 4 mentors on a US-evening shift (~02:00–07:00 IST, crosses midnight, Tue–Sat to match US Mon–Fri evenings)
  - 2 mentors on weekend daytime shifts covering US/UK weekend mornings
  - Shift lengths vary slightly so mentors aren't identical.
- Capacity note for README: 10 mentors × 2 = **20 classes/day**, matching the stated ~20 parents/day. Demand ≈ capacity, so sold-out states will be common and are a core UX path, not an edge case.
- `npm run seed` resets the DB. `npm run seed:scenarios` additionally inserts bookings that create: a fully booked day, a mentor at 2/2, and a slot with exactly one mentor left — so reviewers can see every state immediately. README lists exactly where to look.

---

## 8. API

All JSON. Errors always `{ "error": { "code": string, "message": string, "details"?: object } }`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/slots?timezone=&from=&to=` | Slots grouped by parent-local date. `from`/`to` are parent-local dates; default today..+14 |
| POST | `/api/bookings` | Create booking (§5.3) |
| GET | `/api/bookings/:token` | Booking detail for parent (parent-local labels) |
| POST | `/api/bookings/:token/cancel` | Cancel (should) |
| GET | `/api/bookings/:token/ics` | Calendar file (should) |
| GET | `/api/mentors` | List for mentor picker (id, name) |
| GET | `/api/mentors/:id/bookings` | Mentor's upcoming classes in mentor-local labels |
| GET | `/api/notifications` | Outbox (demo) |

`POST /api/bookings` body:
```json
{
  "startUtc": "2026-11-20T21:00:00Z",
  "timezone": "America/New_York",
  "idempotencyKey": "uuid",
  "parent": { "name": "", "email": "", "phone": null },
  "child":  { "name": "", "age": 9 }
}
```

`GET /api/slots` response shape:
```json
{
  "timezone": "America/New_York",
  "zoneLabelNow": "Eastern Time · EST",
  "days": [
    { "date": "2026-11-20", "label": "Fri, 20 Nov", "availableCount": 6,
      "slots": [ { "startUtc": "...", "localTime": "4:00 PM", "zoneAbbr": "EST", "available": true } ] }
  ]
}
```

Error codes: `VALIDATION_ERROR` (400), `INVALID_TIMEZONE` (400), `SLOT_OUT_OF_RANGE` (400), `SLOT_NOT_ON_GRID` (400), `BOOKING_NOT_FOUND` (404), `SLOT_UNAVAILABLE` (409, includes `details.alternatives`), `ALREADY_BOOKED` (409), `ALREADY_CANCELLED` (409), `INTERNAL` (500, no stack traces in response).

Config (`server/.env.example`): `PORT`, `DATABASE_PATH`, `LEAD_TIME_MINUTES=120`, `BOOKING_HORIZON_DAYS=14`, `SLOT_MINUTES=30`, `MAX_CLASSES_PER_MENTOR_PER_DAY=2`, `CLASS_LINK_BASE_URL`, `NOW_OVERRIDE` (dev only, ISO instant). Validate with zod at startup; fail fast.

---

## 9. Testing

### 9.1 Domain unit tests (write these first)

- Slot expansion for a mentor, normal day.
- Midnight-crossing shift splits correctly into two mentor-local dates.
- Capacity: 2 bookings on a mentor-local day → mentor ineligible for that day only.
- Overlap: booked slot excludes mentor.
- Lead time excludes near slots.
- DST matrix (`FixedClock`), each asserting both the UTC instant and the parent-local label:
  - New York spring forward Mar 14 2027: no 2:xx AM slots.
  - New York fall back Nov 7 2027: two 1:30 AM slots labelled EDT and EST.
  - London spring forward Mar 28 2027 and fall back Oct 31 2027.
  - Dublin same dates; labels never render bare "IST".
  - Mismatch week (Mar 14–27 2027): a fixed IST mentor slot shows 4h apart in NY vs London.
  - Phoenix and Honolulu unchanged across US transitions.
  - Booking near Nov 1 2026 / Oct 25 2026 shows the right local time before and after.
- Zone label formatter for every curated zone, summer and winter.
- Alternatives: ordering and dedupe.
- Strategy: least-loaded tie-breaks deterministically.

### 9.2 API integration tests (in-memory or temp-file SQLite, Fastify `inject`)

- Happy path booking → 201, notifications created in both zones.
- Fully booked slot → 409 with alternatives.
- Mentor at 2/2 → next booking goes to another mentor; if none, 409.
- Idempotent retry returns same booking.
- Duplicate parent+child → 409 ALREADY_BOOKED.
- Invalid zone, off-grid time, out-of-range time → 400s.
- Cancel frees capacity.
- **Concurrency:** seed one eligible mentor; fire 10 parallel `POST /bookings` for the same slot using a temp-file DB with multiple connections → exactly 1 success, 9 × 409. Repeat with 3 mentors → exactly 3 successes. (Use a file DB, not `:memory:`, so separate connections genuinely contend.)

### 9.3 Client tests

- Zone banner renders detected zone; change updates slot labels.
- Fully booked day renders empty state with alternatives.
- 409 on submit keeps form values and shows alternatives.
- Demo: `NOW_OVERRIDE=2027-03-10T12:00:00Z` lets a reviewer open the UI and see the DST mismatch week. Document in README.

### 9.4 Commands

`npm test` (all), `npm run test:server`, `npm run test:client`, `npm run typecheck`, `npm run lint`.

---

## 10. Research to do and record (graded under "Research & judgment")

Aryan, not Claude, should do this part and write findings into the README's "Research" section:

1. Go through Codeyoung's own trial booking flow on their site: what fields they ask, whether a time zone is shown, how slots look, what confirmation contains. Note what you copied and what you deliberately changed.
2. Look at Calendly and Cal.com booking pages: time zone selector placement, how sold-out days look, round-robin host assignment.
3. Look at one or two other kids' ed-tech trial flows.
4. For each, write one line on "what I took" and "what I left out and why". Tie back to §2.3.

I couldn't verify the current details of these sites, so the findings must come from your own walkthrough.

---

## 11. Working with Claude Code (graded under "AI usage")

### 11.1 Session plan — one milestone per session, export transcript after each

| # | Milestone | Done when |
|---|---|---|
| M1 | Scaffold workspaces, TS strict, lint, Vitest, Fastify app factory, Vite app, `CLAUDE.md` | `npm test` and `npm run dev` run |
| M2 | DB schema, migrations, seed + scenarios, repositories | Seed runs; repository tests pass |
| M3 | Domain: slot expansion, eligibility, capacity, alternatives, zone labels — **tests first** | Full §9.1 suite green |
| M4 | Services + routes: slots, booking transaction, strategy, notifier, errors | §9.2 suite green incl. concurrency |
| M5 | Client booking flow (steps 1–5) + all error states | Manual walkthrough of §6.3 table |
| M6 | Mentor page, outbox, manage/cancel, ics | Works end to end |
| M7 | README, API docs, assumptions, research section, polish, final test run | Fresh clone → README steps work |

### 11.2 Prompting approach (show this in the transcript)

- Start each session: "Read DESIGN.md and CLAUDE.md. We're on milestone Mx. Propose a plan first; don't write code until I approve."
- Ask for tests before implementation for domain logic.
- Review diffs; push back on extra dependencies, logic in the wrong layer, or fixed-offset time math.
- Ask Claude to explain trade-offs when it makes a choice; record notable decisions in README.
- Keep commits small and milestone-scoped with clear messages.

### 11.3 Transcript

- Run `/export` at the end of every Claude Code session and append to `TRANSCRIPT.md` under a heading per session with date and milestone.
- Include this planning conversation too if you want to show the design phase.
- Don't edit the transcript content.

---

## 12. README outline

1. What this is (2–3 lines) + screenshot/GIF
2. Quick start (prereqs: Node version; `npm install`, `npm run seed:scenarios`, `npm run dev`; URLs)
3. Configuration (env table)
4. Running tests
5. Demo guide: where to see a full day, a mentor at 2/2, a race-lost booking, DST via `NOW_OVERRIDE`, the outbox, the mentor view
6. API reference (from §8)
7. Architecture (diagram of layers, patterns and why)
8. Time zone & DST approach (condensed §4)
9. Concurrency approach (condensed §5.3)
10. Product decisions & assumptions (§4.3, §4.4, §5.4, 30-min slots, lead time, horizon, no login)
11. Not built and why (§2.3)
12. Research notes (§10)
13. Scaling notes: what changes for Postgres (`SELECT … FOR UPDATE` / advisory locks or exclusion constraints), real email queue, auth, multi-instance
14. AI usage summary + link to TRANSCRIPT.md

---

## Appendix A — `CLAUDE.md` (copy to repo root)

```markdown
# CLAUDE.md

Read DESIGN.md before any task. It is the source of truth. If a task conflicts with it or is ambiguous, ask.

## Workflow
- Propose a plan and wait for approval before writing code.
- Domain logic: write tests first.
- Run `npm run typecheck && npm test` before saying a task is done.
- Small, milestone-scoped commits.

## Hard rules
- Store instants as UTC ISO strings. Zones are IANA names. Never use fixed UTC offsets or abbreviations in logic.
- All time logic lives in server/src/domain or shared/src/time. No `Date.now()` or `new Date()` outside `Clock`.
- Never render a time without a zone label from `formatZoneLabel`. Never render bare "IST".
- Layering: routes → services → repositories. Domain is pure (no I/O).
- Validate every request with shared zod schemas. Errors use the standard error envelope and codes in DESIGN.md §8.
- Booking creation must run inside `BEGIN IMMEDIATE` with the capacity check inside the transaction.
- Do not add dependencies outside DESIGN.md §3.1 without asking.
- TypeScript strict; no `any` without a comment explaining why.
- No secrets, no external network calls.
```
