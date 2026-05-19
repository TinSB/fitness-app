# UI-OS R8 — Information Density Reduction & Theme Parity Remediation V1

UI-OS R8 is an implementation task. The previously planned archive is postponed; the next archive task is renamed to UI-OS R9.

## Baseline Evidence

- UI-OS R7 complete.
- UI-OS R7 PR: #287.
- UI-OS R7 merge commit: b60b2a65ff72b6dc8ced63d379b8491b4a8d4f3b.
- npm test passed: 1153 files / 4701 tests.
- dist token scan clean.
- R7 added mobile safe-area and component state regression locks.

## Problem Being Fixed

The UI components improved, but information density remained too high. Repeated and legacy modules still existed beside the newer UI-OS surfaces. Component appearance needed stronger theme parity across light and dark themes. Today and Focus needed deletion and compression, not more cards.

## User Decisions Captured

- Today first screen is the hero decision plus recovery only when meaningful.
- The main card can say `保持训练：上肢 A`.
- Recovery appears prominently only when meaningful; normal recovery becomes compact.
- `今天想练` becomes `切换目标` and options are hidden by default.
- Training preview stays concise: count, top 1-2 key exercises, estimated duration where available.
- `为什么这样推荐？` is collapsed by default.
- Data Health and system suggestions are removed from Today primary flow except severe risk.
- Local-first safety strip appears only when source is unclear or risky.
- Bottom nav hides on downward scroll and reappears on upward scroll or near top/bottom.
- Dark theme forbids large uncontrolled white cards.
- Focus main screen shows only current exercise, current set, recommendation, one primary action, and concise instruction.
- Actual input opens through bottom sheet.
- Secondary actions move behind `更多`.
- History starts with calendar and frequency.
- Progress starts with strength trend / PR / e1RM.
- Settings needs further top-level reduction.
- Duplicate information must be deleted or consolidated.

## What R8 Changes

- Today compression: decision hero first, compact recovery in normal state, compact `切换目标`, concise preview, collapsed recommendation details, no normal repeated safety strip.
- Focus compression: full actual input stays in bottom sheet, recommendation remains primary, equipment details are collapsed by default, secondary actions are under `更多`.
- Bottom nav auto-hide: normal shell hides the nav on downward scroll and restores it on upward/edge scroll; Focus remains immersive and never renders global nav.
- Duplicate information consolidation: normal local-first copy is not repeated in Today, duplicate recommendation and cloud-safety paragraphs are guarded by tests.
- Theme surface parity: semantic surface model covers app background, page surface, glass/elevated cards, training hero, health card, settings group, warning/danger, bottom sheet, modal, and safety strip.
- Settings reduction: grouped top-level panels remain visible, lower-frequency health import, screening, coach inbox, and about/data safety are behind secondary details.

## Non-Goals

- No training algorithm change.
- No warmup algorithm change.
- No planning or rotation logic change.
- No PR/e1RM/effective-set calculation change.
- No equipment-aware engine change.
- No Data Health detection or repair semantic change.
- No source-of-truth behavior change.
- No AppData schema or persistence change.
- No route or browser mutation route change.
- No cloud sync, default cloud sync, or background sync.
- No package dependency, script, or lockfile change.

## Safety Boundaries

- localStorage remains default/fallback/migration/emergency.
- Backend/cloud candidate remains explicit opt-in and reversible.
- Cloud pull does not auto-apply.
- Cloud push requires manual confirmation.
- Accepted browser mutation routes remain exactly seven.
- No default cloud sync.
- No background sync.
- No SaaS/multi-user runtime.
- No package/script/lockfile drift.
- pnpm-lock.yaml remains absent.

## Recommended Next Task

UI-OS R9 — Interaction OS Remediation Archive V1 is recommended next.

UI-OS R9 is not started by R8.
