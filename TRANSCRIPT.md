# TRANSCRIPT.md

AI session transcripts from building the Trial Class Booking system. Each session follows the milestone plan in DESIGN.md §11.1. The prompting approach demonstrates design-first development, tests-before-implementation for domain logic, and explicit review of AI-generated decisions.

---

## Session 0 — Design Phase (2026-11-16)

### Prompt
> I need to build a trial class booking system for the Codeyoung Senior Full Stack Engineer assignment. Parents in the US/UK/Ireland book a free 30-minute trial class, and an Indian mentor is auto-assigned. The main challenges are time zone handling, DST correctness, and concurrent booking safety. I've drafted a DESIGN.md. Review it and tell me if anything is missing or risky before we start building.

### Response (summary)
Claude reviewed DESIGN.md and flagged:
- The IST ambiguity (India vs Ireland) needed explicit handling — added curated zone abbreviation map to §4.6
- Midnight-crossing shifts needed careful mentor-local date assignment for capacity counting — confirmed in §4.4
- The `BEGIN IMMEDIATE` approach for SQLite concurrency was validated as correct for single-process deployments
- Suggested adding `NOW_OVERRIDE` env var for DST demo scenarios — added to §8

### My review
I agreed with all suggestions. The IST disambiguation was something I hadn't fully thought through — the design now explicitly maps zone + offset → abbreviation rather than relying on `Intl.DateTimeFormat` which returns "GMT+1" for BST in `en-US` locale. I also added the DST test matrix dates (§4.5) after researching the actual 2026/2027 transition dates.

---

## Session 1 — M1: Scaffold (2026-11-16)

### Prompt
> Read DESIGN.md and CLAUDE.md. We're on milestone M1 — scaffold the monorepo. Propose a plan first; don't write code until I approve.

### Plan proposed
Claude proposed:
1. Root `package.json` with npm workspaces (`shared`, `server`, `client`)
2. `tsconfig.base.json` with strict mode
3. `shared/` — types, zod schemas, `formatZoneLabel` stub
4. `server/` — Fastify app factory, `Clock` interface (SystemClock + FixedClock), strategy/notifier/repository interfaces, health route
5. `client/` — Vite + React Router + TanStack Query + Tailwind v4, placeholder routes

### My feedback
> Make sure design patterns and SOLID principles are properly used here.

Claude updated the plan to detail:
- **SRP**: routes/services/domain/repositories each have one job
- **OCP**: `AssignmentStrategy` and `Notifier` interfaces allow extension without modification
- **LSP**: `SystemClock`/`FixedClock` and future notifier implementations are interchangeable
- **ISP**: Small interfaces — `Clock` (1 method), `AssignmentStrategy` (1 method), `Notifier` (1 method)
- **DIP**: Services depend on abstractions; `app.ts` is the composition root

### Approved and built
After approval, Claude scaffolded all files. Caught a `rootDir` issue where `test/` was outside `src/` — fixed by setting `rootDir: "."` in server and client tsconfigs.

**Verification:** `npm run typecheck` clean, `npm test` passes (3 tests), `npm run dev` starts both servers.

---

## Session 2 — M2: Database Layer (2026-11-16)

### Prompt
> Read DESIGN.md and CLAUDE.md. We're on milestone M2 — DB schema, migrations, seed data, repositories. Propose a plan first.

### Plan proposed
1. `createDb()` with WAL, foreign_keys, busy_timeout per §7
2. Migration runner with `_migrations` tracking table
3. Schema from §7 verbatim (including partial unique index on bookings)
4. Three concrete repository implementations behind the M1 interfaces
5. Seed: 10 mentors with staggered shifts per §7.1
6. `--scenarios` flag for pre-populated demo states

### Key decisions I reviewed
- **Seed data shifts**: UK-evening (20:00–00:30 IST Mon–Fri), US-evening (02:00–07:00 IST Tue–Sat, crosses midnight), Weekend (14:00–20:00 IST Sat–Sun). I verified these map correctly to parent-friendly hours.
- **Scenario bookings**: mentor at 2/2, slot with 1 mentor left, fully booked day — all verifiable immediately after seeding.

### Approved and built
16 repository tests covering insert, find, count, cancel, partial unique index enforcement, and cancel-frees-capacity.

**Verification:** `npm run seed:scenarios` creates DB with 10 mentors, 44 rules, 6 scenario bookings. 17 server tests pass.

---

## Session 3 — M3: Domain Logic, Tests First (2026-11-16)

### Prompt
> Read DESIGN.md and CLAUDE.md. We're on milestone M3 — domain logic. DESIGN.md §11.2 says to write tests before implementation for domain logic. Write the full §9.1 test suite first, then implement to make them pass.

### Tests written first
Claude wrote 61 domain tests across 6 test files before any implementation:

1. **slots.test.ts** — normal expansion, midnight-crossing with correct mentor-local dates, grid alignment, multi-day, US-evening shift
2. **eligibility.test.ts** — rule coverage, booking overlap, capacity per day, lead time, mixed eligibility
3. **dst.test.ts** — the full DST matrix from §9.1:
   - NY spring forward Mar 14 2027: no 2:xx AM slots
   - NY fall back Nov 7 2027: two 1:30 AM slots (EDT vs EST)
   - London spring/fall
   - Dublin: IST never bare
   - Mismatch week Mar 14–27 2027
   - Phoenix and Honolulu unchanged
   - Transition boundary labels
4. **alternatives.test.ts** — same day, same time next days, earliest overall, dedup, limit
5. **strategy.test.ts** — least-loaded, tie-breaks on window, tie-breaks on id
6. **zone-labels.test.ts** — every curated zone in summer and winter

### Implementation
Then implemented `slots.ts`, `eligibility.ts`, `alternatives.ts`, `LeastLoadedStrategy`.

### Bug found and fixed
Initial zone label tests failed: Luxon's `ZZZZ` format uses Intl which returns "GMT+1" instead of "BST" for London summer. This was exactly what DESIGN.md §4.6 warned about. Fixed by creating a curated `ZONE_ABBRS` map keyed by zone + offset, bypassing Intl entirely. Exported `getZoneAbbr()` for use in slot display.

**Verification:** 78 server tests pass (61 new domain + 17 existing). Typecheck clean.

### Trade-off noted
The `eligibleMentors()` function re-expands mentor slots for each eligibility check. This is O(mentors × rules × days) per slot query. For 10 mentors and 14 days this is fast. At scale, pre-computed slot availability would be needed — noted in README scaling section.

---

## Session 4 — M4: Services + Routes + Concurrency (2026-11-16)

### Prompt
> Read DESIGN.md and CLAUDE.md. We're on milestone M4 — wire domain into services and routes, full §9.2 integration test suite including concurrency. Propose a plan.

### Plan proposed
- `SlotService` — groups by parent-local day, adds labels
- `BookingService` — full §5.3 transaction with BEGIN IMMEDIATE
- `NotificationService` — dual-zone notifications
- `ConsoleNotifier` adapter
- All routes from §8
- Integration tests: happy path, errors, idempotency, cancel, concurrency

### Critical bug found during testing
All booking requests returned 409 SLOT_UNAVAILABLE even for valid slots. Root cause: `expandMentorSlots` generates `2026-11-16T14:30:00.000Z` (with `.000Z`) but the request sends `2026-11-16T14:30:00Z` (without). String comparison `===` failed.

**Fix:** Normalize incoming `startUtc` through `DateTime.fromISO().toISO()` to match the canonical format. Added the normalization at the service layer entry point.

### Concurrency test design
- File-based SQLite (not `:memory:`) so connections genuinely contend
- 1 mentor + 10 parallel POST → exactly 1 success, 9 × 409
- 3 mentors + 10 parallel POST → exactly 3 successes, all different mentors
- Both pass, confirming `BEGIN IMMEDIATE` serialisation works correctly

### My pushback
The initial "mentor at 2/2" test assumed two sequential bookings would both go to mentor 1. But `LeastLoadedStrategy` distributes across mentors — first booking goes to M1 (lowest id tie-break), second to M2 (M1 has 1, M2 has 0). Fixed test to book 3 slots (M1 gets 2 via tie-breaks), then verify 4th goes to M2.

**Verification:** 96 server tests pass (18 new integration + concurrency). Typecheck clean.

---

## Session 5 — M5: Client Booking Flow (2026-11-16)

### Prompt
> Read DESIGN.md and CLAUDE.md. We're on milestone M5 — client booking flow with all §6.3 error states. Propose a plan.

### Key design decisions
- **State machine in BookingPage**: step derived from `selectedDate` and `selectedSlot` state, not an explicit step counter. Simpler, no sync bugs.
- **Slot grouping**: parsed from `localTime` string ("4:00 PM") into morning/afternoon/evening. Pragmatic — avoids passing extra data from server.
- **Error preservation**: on 409 SLOT_UNAVAILABLE, `BookingForm` keeps all form data and shows alternatives inline. User taps alternative → slot updates, form stays.
- **Idempotency key**: generated once per BookingForm mount via `useState(() => uuid())`. Survives re-renders, absorbs double-clicks.

### §6.3 error states covered
1. Day fully booked → `EmptyState` with "All mentors booked" + alternative chips + "See next available day"
2. 14-day window full → friendly message, no dead end
3. 409 race-lost → form data kept, alternatives shown in red alert
4. 409 ALREADY_BOOKED → message + link to existing booking
5. Network/server error → retry via TanStack Query refetch
6. Loading → skeleton placeholders (not spinners on blank screens)
7. Invalid timezone → falls back to timezone picker

### Accessibility
- `aria-label` on all interactive elements
- `role="listbox"` / `role="option"` on day picker
- `aria-pressed` on selected slots
- `aria-live="polite"` on empty states, `aria-live="assertive"` on errors
- Keyboard-navigable slot grid

**Verification:** 98 tests pass. Manual walkthrough confirmed all error states.

---

## Session 6 — M6: Mentor Page, Outbox, Manage/Cancel (2026-11-16)

### Prompt
> Proceed with M6 — mentor page, outbox, manage/cancel booking, .ics download.

### Built
- **ManageBookingPage**: view booking details, cancel with confirmation dialog, .ics download link
- **MentorPage**: demo-only mentor picker (noted as trade-off in README), upcoming classes in mentor-local time with zone labels, parent's local time reference, "N of 2 today" counter
- **OutboxPage**: all notifications with recipient type/kind badges, full email body, timezone
- **ICS endpoint**: `GET /api/bookings/:token/ics` generates standards-compliant VCALENDAR

### Type mismatch caught
OutboxPage initially used camelCase property names (`recipientType`) but the API returns snake_case from SQLite rows. Fixed by defining `NotificationItem` interface in the API client matching the actual response shape, rather than force-converting on the server.

**Verification:** 99 tests pass. End-to-end flow works: book → confirm → view outbox → mentor view → manage → cancel → rebook.

---

## Session 7 — M7: README + Polish (2026-11-16)

### Prompt
> Proceed with M7 — README, API docs, assumptions, final test run.

### README structure (following §12)
1. What this is + quick start
2. Configuration table with all env vars
3. Test commands
4. Demo guide — exactly where to see each state after `seed:scenarios`
5. API reference with error codes
6. Architecture diagram + SOLID patterns table
7. Time zone & DST approach (condensed from §4)
8. Concurrency approach (condensed from §5.3)
9. Product decisions & assumptions with rationale
10. Non-goals with reasons (from §2.3)
11. Research notes (placeholder for manual walkthrough per §10)
12. Scaling notes (Postgres, email queue, auth, multi-instance)
13. AI usage summary
14. Dependency justification

### Final verification
```
npm run typecheck     # clean across all 3 packages
npm test              # 99 tests pass (96 server + 3 client)
npm run seed:scenarios && npm run dev  # manual end-to-end walkthrough
```

---

## Notable decisions across sessions

| Decision | Context | Outcome |
|----------|---------|---------|
| Curated zone abbreviation map | Intl returns "GMT+1" for BST | Hand-mapped zone+offset→abbr, bypassing Intl |
| UTC normalization in booking service | `.000Z` vs `Z` string mismatch | Normalize through Luxon at service entry point |
| Slot expansion per eligibility check | Simple but O(mentors × slots) | Acceptable at this scale; noted scaling path |
| State-derived steps (not counter) | BookingPage step management | Cleaner than syncing explicit step state |
| File DB for concurrency tests | `:memory:` doesn't genuinely contend | File DB proves real serialisation behavior |
| Snake_case in notification API response | SQLite returns raw column names | Client type matches actual response, not ideal camelCase |
