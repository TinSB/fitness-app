# UI-OS R8.7D Focus More Menu & Microcopy Final Purge

## Task Identity

- UI-OS R8.7D
- Focus More Menu & Microcopy Final Purge V1
- Implementation task after UI-OS R8.7C one-layer sheet interaction standard.

## Why R8.7D Exists

Focus should be the simplest training screen in the app. After R8.7C standardized sheet behavior, the default Focus screen and More menu still carried low-value actions and helper copy that made the training moment feel heavier than necessary.

## Focus Default Screen Rule

The ordinary Focus screen owns only:

- current exercise
- current set
- actionable recommendation
- one primary action
- required severe warning only when meaningful

Ordinary explanatory text, recommendation paragraphs, equipment algorithm copy, record-detail prompts, and repeated warnings are hidden from the default state.

## More Menu Rule

The default More menu contains only:

- `替代动作`
- `标记不适`
- `动作顺序`

`记录详情`, `查看详情`, `复制上组`, and ordinary skip/detail actions are not default More menu items. State-specific handling may still exist in the primary flow or detail surfaces when required.

## Weight Details Rule

Weight details remain collapsed by default. The concise detail sheet owns only gym setup facts such as bar weight, per-side plates, and whether base weight is included. Raw theoretical load and algorithm paragraphs remain hidden from the default user flow.

## Non-goals

- No source-of-truth behavior change.
- No persistence behavior change.
- No AppData schema change.
- No stored history migration or mutation.
- No route, cloud, package, script, or lockfile change.

## Boundary Confirmation

R8.7D changes only Focus presentation, menu ownership, and visible copy. It does not complete sets, save sets, migrate history, add routes, enable cloud sync, or change packages.

UI-OS R8.7E is recommended next and is not started by R8.7D.
