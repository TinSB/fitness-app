# UI-OS R8.7E Focus Final Acceptance Regression Lock

## Task Identity

- UI-OS R8.7E
- Focus Final Acceptance Regression Lock V1
- Regression lock / acceptance hardening task after UI-OS R8.7D.

## What R8.7E Locks

- Raw theoretical load stays detail-only.
- Equipment-aware actionable load is the display, apply, current-record, and validation baseline.
- `45 lb × 10` applied from an empty-bar recommendation does not trigger abnormal confirmation because raw theoretical was `27 lb`.
- `套用建议` fills actionable weight and planned reps, does not fill RIR, and does not save or complete the set.
- After apply, Focus shows `当前记录：45 lb × 10` and the primary action becomes `完成一组`.
- Normal warmups stay at one to three sets and do not use `×2` / `×1`.
- More menu default items remain `替代动作`, `标记不适`, and `动作顺序`.
- Training sheets remain one-layer, dark, and dismissable from backdrop or handle.
- End workout remains one-layer confirmation.
- Focus default screen has no long microcopy, no duplicate recommendation load, and a clean bottom safe area.
- Theoretical load stays hidden from the default Focus UI.

## Boundary Confirmation

R8.7E is a docs and tests lock. It does not change runtime UI, training algorithms, warmup policy, source-of-truth behavior, persistence, AppData schema, stored workout history, routes, cloud behavior, package scripts, dependencies, or lockfiles.

## Next

UI-OS R9 Interaction OS Remediation Archive is recommended next and is not started by R8.7E.
