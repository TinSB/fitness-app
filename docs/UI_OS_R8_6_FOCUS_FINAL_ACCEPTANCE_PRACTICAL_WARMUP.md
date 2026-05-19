# UI-OS R8.6 Focus Final Acceptance & Practical Warmup Alignment

## Task Identity

- UI-OS R8.6
- Focus Final Acceptance & Practical Warmup Alignment V1
- Implementation task for Focus interaction acceptance, practical warmup policy, and actionable load alignment.
- Baseline: UI-OS R8.5 complete, PR #293, merge commit `0b65177e6b3c3ae1ac68e69aefc4a36b97517bbf`.

## Why R8.6 Exists

R8.5 fixed Focus dark surfaces, Training Detail dark surfaces, the single recommendation source, and reps inside `EquipmentAwareLoadCard`. Visual acceptance still found Focus friction and real-gym policy gaps:

- The `更多` panel did not close when tapping the blank background.
- The Focus bottom area still felt like a fixed dead space.
- End-workout confirmation still contained unnecessary helper copy.
- Applied suggestion state could read as a stack of current record, apply, applied, and record actions.
- The old warmup ladder could create five progressive warmups with `×2` and `×1`, which is too slow for normal gym use.
- Theoretical, feasible, and actionable load paths needed one executable prescription.

## What Changed

- Focus secondary actions now use a controlled overlay. Backdrop and outside taps close it, inside taps do not close accidentally, and Escape closes on desktop.
- Training sheets use dismissible dark semantic backdrops, including switch exercise, recommendation basis, weight details, actual record, and end confirmation.
- Focus bottom reserve was reduced to the action bar plus safe-area inset so the home-indicator area blends with the dark app surface.
- End confirmation is reduced to `结束训练`, `继续训练`, and danger action `确认结束训练`.
- `套用建议` now fills equipment-aware actionable weight plus planned reps for the active draft, but does not fill RIR.
- Applied suggestion state shows one concise record line such as `当前记录：45 lb × 10`, then primary `完成一组` with secondary `修改`.
- A practical warmup policy caps normal warmups at one to three sets and avoids default `×2` / `×1` warmup reps.
- Warmup loads resolve through the equipment-aware feasible/actionable path before becoming generated prescriptions.

## Practical Warmup Policy

- Standard strength and hypertrophy work uses at most three warmup sets.
- Machines, dumbbells, and accessories use fewer warmups than heavy barbell compounds.
- Correction and mobility tasks do not create formal warmup sequences.
- Low-rep `×2` / `×1` warmups are reserved for explicit PR, test, or very-heavy intent, not normal sessions.
- Empty-bar and below-bar cases resolve to feasible empty bar loads before display or apply.

## Actionable Load Alignment

- Primary UI display, apply suggestion, and generated warmup prescription use the same actionable load.
- Actionable load means equipment-aware feasible load when available.
- Theoretical load remains detail-only and collapsed.
- No primary UI asks the user to execute an impossible theoretical load.

## Non-Goals

- No source-of-truth change.
- No persistence or AppData schema change.
- No stored history migration or mutation.
- No route, browser mutation route, backup/import/export route, reset/recovery route, or repair/apply route change.
- No cloud sync, default sync, background sync, Supabase connection, package dependency, script, or lockfile change.
- No prototype runtime import.

## Validation

R8.6 must pass targeted regression tests, `npm run api:dev:build`, `npm run typecheck`, `npm test`, `npm run build`, dist token scan, and package/lockfile drift checks.

## Next Task

UI-OS R9 archive remains postponed until visual acceptance passes.

UI-OS R9 is not started by R8.6.
