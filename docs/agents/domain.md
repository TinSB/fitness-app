# Domain Docs

IronPath is a single-context React, Vite, and TypeScript personal training PWA.

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
- History owns calendar and completed-session review.
- Progress owns strength, PR, e1RM, and training trend explanations.
- Settings owns preferences, backup, diagnostics, safety, and equipment profile details.

When a new architecture decision is needed, create a focused ADR under `docs/adr/` only after the decision is approved or clearly requested.
