# UI-OS Interaction Remediation Archive

## Task Identity

- UI-OS R9
- Interaction OS Remediation Archive V1
- Docs and static regression tests only.

## Original Problem

The UI-OS work was technically complete but did not pass product acceptance. The app had partial reskins, old white-card surfaces inside dark training flows, repeated modules, dense explanations, bottom navigation and safe-area issues, inconsistent Focus interactions, and training recommendations that did not match real gym execution.

## Remediation Sequence

- R0: v0 design system extraction and production parity.
- R1: product specification from real user answers.
- R2: Focus state machine and one-dominant-action rules.
- R3: Today decision surface.
- R4: History calendar, frequency priority, and PR/e1RM access.
- R5: Progress and Data Health owner-friendly clarity.
- R6: Settings, Safety, Theme, and Equipment Profile control center.
- R7: mobile safe-area and component state regression lock, PR #287, merge `b60b2a65ff72b6dc8ced63d379b8491b4a8d4f3b`.
- R8: information density reduction and theme parity remediation, PR #288, merge `790872f215d77b63206aa8081f5cb4298dec2295`.
- R8.1: mobile Today safe-area and density fix, PR #289, merge `035215637a396de83849c24097a33de7109b32fb`.
- R8.2: global legacy surface and density sweep, PR #290, merge `07227b486e8453302515c10b150a485a58b23144`.
- R8.3: training density, contrast, and Chinese-first copy fix, PR #291, merge `bb1240c17748488796ee8873077c5da850a987fc`.
- R8.4: mobile chrome gap and microcopy deletion, PR #292, merge `ccb7ddff25276bfdb7e1ab651819e7c73b714504`.
- R8.5: Focus and Training Detail dark surface fix, PR #293, merge `0b65177e6b3c3ae1ac68e69aefc4a36b97517bbf`.
- R8.6: Focus final interaction and practical warmup alignment, PR #294, merge `b4c2e738665c55815ff3f25442e1c5273b133e0b`.
- R8.7A: actionable load contract and validation alignment, PR #295, merge `1eb64ef`.
- R8.7B: practical warmup policy refinement, PR #296, merge `4ed2853`.
- R8.7C: one-layer sheet interaction standard, PR #297, merge `9edc514`.
- R8.7D: Focus More menu and microcopy final purge, PR #298, merge `f3cb1e5`.
- R8.7E: Focus final acceptance regression lock, PR #299, merge `78d2774`.

## Completion Status

Interaction OS remediation is complete through R9. The final acceptance locks preserve:

- actionable load as the display, apply, current-record, and validation baseline;
- raw theoretical load as detail-only;
- practical warmups capped for normal training;
- one-layer training sheets;
- backdrop and handle dismissal;
- no long Focus microcopy in default state;
- dark Focus and training detail surfaces;
- safe mobile bottom area and bottom navigation behavior;
- component state and theme parity regression coverage.

## Boundaries Preserved

- Source-of-truth behavior unchanged.
- Persistence behavior unchanged.
- AppData schema unchanged.
- Stored workout history not mutated.
- No routes added.
- Accepted browser mutation routes remain exactly seven.
- `POST /data-health/repair/apply` remains blocked.
- No backup/import/export HTTP routes.
- No reset/recovery HTTP routes.
- No cloud sync, default cloud sync, or background sync.
- No Supabase connection.
- No package, package script, or lockfile drift.
- pnpm-lock.yaml remains absent.
- Personal-only remains active.
- SaaS and multi-user runtime remain deferred.

## Recommended Next Task

UI-OS 10A — Real Gym Use Acceptance & Bug Intake V1.

UI-OS 10A is recommended next but is not started by R9.
