# UI-OS R8.7B Practical Warmup Policy Refinement

## Task Identity

- UI-OS R8.7B
- Practical Warmup Policy Refinement V1
- Implementation task after UI-OS R8.7A actionable load contract alignment.

## Why R8.7B Exists

The real gym flow should not default to a slow five-set progressive warmup. Normal training needs one to three practical warmup sets, and late `×2` / `×1` warmups should appear only for explicit PR, max, test, or very-heavy intent.

## What Changed

- Normal barbell compound warmups remain capped at three sets.
- Normal warmups do not include `×2` or `×1`.
- PR/test/max/very-heavy intent is now explicit before low-rep warmups can appear.
- Machine, dumbbell, and accessory warmups are shortened to at most one default adaptation set.
- Correction and mobility tasks still create no formal warmup sequence.
- Warmup loads continue to resolve through equipment-aware feasible actionable loads before becoming generated prescriptions.

## Non-goals

- No source-of-truth behavior change.
- No persistence behavior change.
- No AppData schema change.
- No stored history migration or mutation.
- No route, cloud, package, script, or lockfile change.

## Boundary Confirmation

R8.7B affects future generated sessions only. Accepted browser mutation routes remain exactly seven. `POST /data-health/repair/apply` remains blocked. Cloud sync, default sync, background sync, Supabase connection, SaaS runtime, and package drift remain out of scope.

UI-OS R8.7C is recommended next and is not started by R8.7B.
