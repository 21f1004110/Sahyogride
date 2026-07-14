# SahyogRide — Scrum Meeting Schedule and Minutes

**Team member names are placeholders** (`TM1`–`TM5`) — replace with real names/roles before
submission:

| Placeholder | Suggested role |
|---|---|
| TM1 | Scrum Master / Backend |
| TM2 | Backend |
| TM3 | Frontend |
| TM4 | Frontend |
| TM5 | AI Integration / QA / Docs |

## Meeting cadence

| Ceremony | When | Duration | Attendees |
|---|---|---|---|
| Daily Standup | Every day, 09:30 | 15 min | All 5 |
| Sprint Planning | 11 Jul, 17 Jul (start of each sprint) | 45 min | All 5 |
| Sprint Review + Retro | 16 Jul, 22 Jul (end of each sprint) | 45 min | All 5 |

Format for each standup: *Yesterday / Today / Blockers*, tied to `docs/TICKETS.md` ticket IDs.

---

## Sprint 1 Planning — 11 Jul 2026, 09:00

**Attendees:** TM1–TM5
**Goal set:** Ship working registration → search → hold → confirm → cancel by end of Sprint 1,
with the concurrency star test green.
**Decisions:**
- Core booking (SAHYOG-15–19) is never cut, per CLAUDE.md priority order.
- Branch-per-ticket, one commit per ticket, PRs reviewed against `docs/API_CONTRACT.md`.
- AI work (Phase 4) does not start until Phases 0–3 are solid.

---

## Daily Standups — Sprint 1

| Date | Yesterday | Today | Blockers |
|---|---|---|---|
| 11 Jul | — (Sprint Planning) | TM1/TM2: SAHYOG-01 scaffolding, SAHYOG-02 schema+migrations; TM1: SAHYOG-03 API contract | None |
| 12 Jul | SAHYOG-01, 02, 03 merged | Local Postgres+pgvector setup on dev machines; review `/docs/API_CONTRACT.md` as a team before Phase 1 starts | TM4: pgvector extension missing locally — resolved by installing via conda, documented in README |
| 13 Jul | Env setup done | TM1/TM2: SAHYOG-04 auth, SAHYOG-05 create trip; TM3/TM4: SAHYOG-06 search, SAHYOG-07 trip detail + seat map; TM2: SAHYOG-15 hold service; TM1: SAHYOG-16 hold endpoint + UI | TM3: seat accessibility requirement (44×44px, aria-label, icon+colour) needed clarifying — resolved against CLAUDE.md accessibility section |
| 14 Jul | SAHYOG-04–07, 15, 16 merged | TM2: SAHYOG-17 confirm reservation; TM1: SAHYOG-18 hold expiry sweep | TM2: confirming after expiry must return 410 `HOLD_EXPIRED`, not 409 — flagged and fixed same day |
| 15 Jul | SAHYOG-17, 18 in review | TM5/TM1: SAHYOG-19 concurrency stress test — 50-iteration run of `test_two_riders_one_seat_only_one_wins` | None — test green on first full run after fixing a lock-ordering issue found during pairing |
| 16 Jul | SAHYOG-19 merged, star test green | TM3/TM4: SAHYOG-20 cancel reservation, SAHYOG-21 history page, SAHYOG-22 empty/error states | None |

## Sprint 1 Review & Retro — 16 Jul 2026, 16:00

**Demoed:** register → search → hold (with 409 on contested seat) → confirm → cancel, plus the
concurrency test run live (50/50 pass).
**What went well:** Locking the concurrency design (3 layers) early in Sprint Planning avoided
rework; ticket-per-branch kept PRs small.
**What to improve:** Sprint 1 Day 2 (12 Jul) was mostly lost to local Postgres/pgvector setup
across machines — document the setup once and share it, rather than each dev debugging it
independently (action: `README.md` "Local Postgres" section, owner TM1).
**Carried over:** none — all Sprint 1 tickets closed on schedule.

---

## Sprint 2 Planning — 17 Jul 2026, 09:00

**Attendees:** TM1–TM5
**Goal set:** AI features land as pure additions (never break the AI-disabled path); passenger
list ships; app is deployed and demo-ready by 22 Jul.
**Decisions:**
- `AI_ENABLED=false` regression test (SAHYOG-24) must pass before SAHYOG-25/26/27 are started.
- AI has zero write powers — enforced by code review, not just tests.

---

## Daily Standups — Sprint 2

| Date | Yesterday | Today | Blockers |
|---|---|---|---|
| 17 Jul | — (Sprint Planning) | TM5: SAHYOG-23 AI service skeleton (isolated module, 5s timeout, kill switch); TM1: SAHYOG-24 AI-disabled regression test | None |
| 18 Jul | SAHYOG-23, 24 merged, AI-off path proven | TM5: SAHYOG-25 background AI urgency triage (post-commit only) | TM5: confirmed triage fires after commit, not inside `confirm_reservation()` — reviewed against CLAUDE.md rule #2 explicitly |
| 19 Jul | SAHYOG-25 merged | TM5/TM2: SAHYOG-26 trip embeddings + semantic search fallback, `backfill_embeddings.py` | None |
| 20 Jul | SAHYOG-26 merged | TM3/TM4: SAHYOG-27 assistant search UI (read-only); TM1/TM2: SAHYOG-28 passenger list endpoint | TM3: needed to confirm AssistantBox has zero write powers by design — confirmed, it only calls the search endpoint |
| 21 Jul | SAHYOG-27, 28 merged | TM3/TM4: SAHYOG-29 passenger list + my-trips UI; TM5: full regression pass incl. both star tests; mobile check at 375px | None |
| 22 Jul | SAHYOG-29 merged | All: final QA, deploy to Render (API) + Vercel (frontend), demo rehearsal, docs freeze | None |

## Sprint 2 Review & Retro — 22 Jul 2026, 15:00

**Demoed:** full flow incl. AI-assisted search and urgency triage, then the same flow again with
`AI_ENABLED=false` to show graceful degradation; coordinator passenger list.
**What went well:** Isolating all AI calls to `ai_service.py` from the start meant the
AI-disabled regression test (SAHYOG-24) needed no special-casing elsewhere in the codebase.
**What to improve:** Passenger list (lowest priority) was tight against the deadline — if
repeated, start Sprint 2 Day 1 planning with a firmer time-box on SAHYOG-26 (semantic search),
which historically is the ticket most likely to run long.
**Action items closed out before submission:** README install/run instructions verified on a
clean clone; `docs_vaibhav` documentation folder assembled.
