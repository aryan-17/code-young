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
