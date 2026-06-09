# Domain Docs

IronPath is a native iOS SwiftUI product under a clean rewrite baseline. The former Web/PWA implementation, Node runtime, browser tests, and cloud-sync runtime candidates have been removed. The living docs are the active truth; existing `ios/` code is legacy/reference inventory unless an approved rewrite slice says otherwise. `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` is the architecture contract and `docs/IRONPATH_iOS_SYSTEM_LOGIC.md` is the clean rewrite system-logic baseline.

## Layout

- Product and engineering docs live under `docs/`.
- ADRs should live under `docs/adr/` when they are needed.
- No root `CONTEXT.md` or `CONTEXT-MAP.md` existed when the skills were configured.
- Do not move existing docs to satisfy a skill convention.

## Consumer Rules

Before using `/grill-with-docs`, `/to-prd`, `/to-issues`, `/tdd`, `/diagnose`, `/improve-codebase-architecture`, or `/zoom-out`, read the relevant docs under `docs/` for the task area.

Use IronPath's existing product language:

- Today owns the daily training decision.
- Focus owns the active set action.
- Progress owns completed-session review, calendar continuity, strength, PR, e1RM, training trends, and data-quality explanations.
- Plan owns future schedule, program structure, proposed adjustments, and rollback/review of accepted plan changes.
- Profile / Settings owns preferences, backup, diagnostics, safety, subscription surfaces, equipment profile details, and future account/sync controls after an approved implementation slice.

When a new architecture decision is needed, create a focused ADR under `docs/adr/` only after the decision is approved or clearly requested.
