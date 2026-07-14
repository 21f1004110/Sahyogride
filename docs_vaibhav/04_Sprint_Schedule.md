# SahyogRide — Sprint Schedule

Team size: 5. Duration: 12 days (11 July – 22 July 2026), per CLAUDE.md's "11-day" framing and
the repo's actual first commit (`first commit`, 11 July 2026) through the hard deadline
(22 July 2026). Two sprints, split around the mid-point so Sprint 1 ends once the two star tests
(`test_two_riders_one_seat_only_one_wins`, `test_app_works_completely_with_ai_disabled`) are both
green — that is the project's real go/no-go gate, not the calendar midpoint.

Ticket numbers refer to `docs/TICKETS.md`. **Team member names are placeholders** (`TM1`–`TM5`)
— replace with real names/roles before submission.

---

## Sprint 1 — Foundation → Core Booking (11–16 July 2026)

**Sprint goal:** Registration, trip search, and the seat-hold flow work end-to-end, and the seat
is never double-booked under concurrent load.

| Day | Date | Focus | Tickets | Owner (placeholder) |
|---|---|---|---|---|
| 1 | Sat 11 Jul | Repo scaffolding, DB schema & migrations, API contract | SAHYOG-01, 02, 03 | TM1 (Scrum Master/Backend), TM2 (Backend) |
| 2 | Sun 12 Jul | Env setup, local Postgres+pgvector, review Phase 0 | — (buffer/setup day) | All |
| 3 | Mon 13 Jul | Auth, trip creation, search, trip detail + seat map, hold service + endpoint | SAHYOG-04, 05, 06, 07, 15, 16 | TM1/TM2 (backend), TM3/TM4 (frontend) |
| 4 | Tue 14 Jul | Confirm reservation, hold expiry sweep | SAHYOG-17, 18 | TM2 (backend), TM5 (QA support) |
| 5 | Wed 15 Jul | Concurrency stress test suite (the star test), bug bash | SAHYOG-19 | TM5 (QA/backend), TM1 |
| 6 | Thu 16 Jul | Cancellation + reservation history, **Sprint 1 Review & Retro** | SAHYOG-20, 21, 22 | TM3/TM4 (frontend), TM2 (backend) |

**Sprint 1 exit criteria:** `pytest tests/test_concurrency.py -v` passes 50/50 iterations;
register → search → hold → confirm → cancel works manually end-to-end.

---

## Sprint 2 — AI Features → Passenger List → Hardening (17–22 July 2026)

**Sprint goal:** AI triage/semantic search are additive only (app still works with
`AI_ENABLED=false`); coordinators can see their passenger lists; app is demo-ready.

| Day | Date | Focus | Tickets | Owner (placeholder) |
|---|---|---|---|---|
| 7 | Fri 17 Jul | **Sprint 2 Planning.** AI service skeleton + kill switch, AI-disabled regression test (2nd star test) | SAHYOG-23, 24 | TM5 (AI), TM1 |
| 8 | Sat 18 Jul | Background AI urgency triage on reservation | SAHYOG-25 | TM5 (AI), TM2 |
| 9 | Sun 19 Jul | Trip embeddings + semantic search fallback | SAHYOG-26 | TM5 (AI), TM2 |
| 10 | Mon 20 Jul | Assistant search UI, passenger list endpoint | SAHYOG-27, 28 | TM3/TM4 (frontend), TM1 (backend) |
| 11 | Tue 21 Jul | Passenger list & my-trips UI, full regression pass, mobile (375px) check | SAHYOG-29 | TM3/TM4, TM5 (QA) |
| 12 | Wed 22 Jul | Final QA, docs freeze, deploy (Render + Vercel), demo rehearsal, **submission**, **Sprint 2 Review & Retro** | — (hardening) | All |

**Sprint 2 exit criteria:** both star tests still green; `AI_ENABLED=false` end-to-end flow
verified manually; app deployed and reachable; documentation (this folder + `/docs`) complete.

---

## Scope-cut order (if the deadline forces it)

Per CLAUDE.md, cut from the bottom of this list up, and **never** cut core booking:

1. Passenger list (SAHYOG-28, 29)
2. AI features (SAHYOG-23–27)
3. Cancellation / history (SAHYOG-20–22)
4. Auth & Trips (SAHYOG-04–07) — only as a last resort
5. Core booking (SAHYOG-15–19) — **never cut**

See the Gantt chart (`diagrams/gantt_chart.svg`) for the same schedule laid out visually, and the
Kanban board (`diagrams/kanban_board.svg`) for a snapshot of ticket status as of 13 July 2026.
