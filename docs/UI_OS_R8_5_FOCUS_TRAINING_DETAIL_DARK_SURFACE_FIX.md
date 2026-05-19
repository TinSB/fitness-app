# UI-OS R8.5 Focus Training Detail Dark Surface Fix

## Task identity

UI-OS R8.5 — Focus & Training Detail Dark Surface Acceptance Fix V1.

This is a UI presentation, copy, and surface parity remediation task. UI-OS R9 archive remains postponed and is not started by R8.5.

## Baseline

R8.4 completed in PR #292 at merge commit `ccb7ddff25276bfdb7e1ab651819e7c73b714504`. R8.4 fixed part of the mobile chrome gap and deleted some primary-flow microcopy, but visual acceptance still failed on Focus and training detail surfaces.

## Screenshot-observed failures

- Focus still exposed a white bottom area in dark mode.
- The `切换动作` sheet was white in dark mode.
- The `推荐依据` sheet was white in dark mode.
- Training Detail / `训练详情` still rendered as an entirely light surface in dark mode.
- Detail rows, notes, correction/function rows, action buttons, and danger controls were mixed with legacy light cards.
- The Focus recommendation repeated the same load in two places: a top `加重 30 lb × 10 次` line and a lower equipment card `加重 30 lb`.
- Focus still showed low-value default microcopy such as actual-record helper text.

## What R8.5 fixes

- Focus bottom controls now use dark semantic bottom-sheet surfaces and keep the safe-area bottom dark.
- Legacy training sheets and drawers now render as semantic dark `bottom_sheet` / `modal_surface` surfaces.
- Training Detail and Record Detail are dark by default, including root, header, inner cards, row surfaces, notes, correction/function rows, and danger actions.
- `EquipmentAwareLoadCard` owns the primary recommendation line and accepts a UI-only `reps` prop, so recommendations render as `加重 30 lb × 10`, `空杆 45 lb × 10`, `40 lb 每只手 × 10`, or `插片 80 lb × 10`.
- The duplicate Focus top weight line was removed.
- `重量详情`, `推荐依据`, `更多`, and actual-record entry remain available but collapsed or sheet-owned by default.
- Default Focus microcopy was removed from the visible primary screen.

## Non-goals

- No training algorithm change.
- No warmup algorithm change.
- No PR/e1RM or effective-set calculation change.
- No planning or rotation logic change.
- No equipment-aware calculation logic change.
- No source-of-truth change.
- No persistence or AppData schema change.
- No route, cloud, package, script, or lockfile change.

## Validation expectation

R8.5 should pass targeted R8.5 tests, `npm run api:dev:build`, `npm run typecheck`, `npm test`, `npm run build`, the production dist token scan, package/lockfile drift checks, and mobile browser smoke checks for Focus, training sheets, Training Detail, Record Detail, and dark bottom safe-area behavior.

## Next task

Recommended next task: UI-OS R9 — Interaction OS Remediation Archive V1.

UI-OS R9 remains postponed until this visual acceptance fix passes, and R9 is not started by R8.5.
