# Task UI-OS 2B — v0 Prototype Review & Boundary Lock V1

## Task identity

- Task UI-OS 2B.
- v0 Prototype Review & Boundary Lock V1.
- This is a review, validation, and boundary-lock task for the Apple-inspired UI-OS 2 v0 prototype.
- This task keeps the prototype isolated before real App integration.

## Prototype files reviewed

- `src/prototype/IronPathOS2.tsx`.
- `src/prototypePreview.tsx`.
- `prototype.html`.
- `docs/UI_OS_2B_V0_PROTOTYPE_REVIEW_BOUNDARY_LOCK.md`.
- `vite.config.ts` was reviewed only to keep the prototype preview entry buildable without duplicate build configuration.

The prototype was pulled from PR #273, branch `ironpath-ui-prototype`, head `96ef57aa73c4e22dc397e5ab9d0df8ec23d78b99`.

## Apple-inspired direction summary

The prototype follows the UI-OS 2 Apple-inspired mobile training direction:

- near-black background `#0a0a0b`.
- glass cards / translucent cards using blur material.
- `backdrop-blur-xl` and related glass blur markers.
- floating bottom nav / `FloatingBottomNav`.
- iOS-style `SegmentedControl`.
- bottom sheet / `BottomSheet`.
- large readable training numbers.
- `EquipmentAwareLoadCard` hero on the Train page.
- `SafetyStrip`-style local-first safety status.
- Chinese-first safe copy.

## Prototype isolation

- The prototype is isolated in `src/prototype/IronPathOS2.tsx`.
- The preview entry is isolated in `src/prototypePreview.tsx`.
- The preview HTML is isolated in `prototype.html`.
- The production app entry remains `index.html` -> `src/main.tsx`.
- `App.tsx` is not integrated with the prototype.
- App.tsx is not integrated with the prototype.
- The production runtime is not switched to the prototype.
- No runtime source-of-truth change was made.
- No training algorithm change was made.
- No persistence change was made.
- No cloud sync was added.
- No route change was made.
- No package dependency change was made.

## Reviewed visual markers

- near-black background.
- glass cards.
- floating bottom nav.
- segmented control.
- bottom sheet.
- EquipmentAwareLoadCard.
- SafetyStrip.

## Reviewed training markers

- The Train page has an `EquipmentAwareLoadCard`.
- The primary visual uses feasible load.
- The prototype shows `空杆 45 lb × 10`.
- The detail copy shows `理论 17 lb -> 实际 45 lb`.
- The prototype does not use 17 lb as the main actionable prescription.

## Reviewed safety copy

- 当前使用本地数据.
- 云端候选不会自动同步.
- 需要手动确认.
- 紧急本地模式可用.
- 本地训练记录仍可继续.

The required safe phrase `云端候选不会自动同步` is allowed because it is a negative safety statement. UI-OS 2B still blocks positive or standalone automatic sync claims.

## Blocked dangerous copy and behavior

The prototype must not claim:

- 后台同步.
- 云端已成为默认.
- SaaS.
- 已上传成功.
- default cloud sync.
- background sync.
- source-of-truth behavior changed.

The prototype must not perform:

- localStorage writes.
- Supabase calls.
- fetch/backend calls.
- cloud sync.
- source-of-truth changes.
- AppData mutation.
- real personal training data usage.
- package dependency requirement.

## Next recommended task

UI-OS 3 — Codex App Shell Integration V1 is recommended next.

UI-OS 3 is not started by UI-OS 2B.

## Final statement

Task UI-OS 2B reviews and locks the v0 prototype only. It does not integrate the prototype into the real app, does not replace the existing runtime UI, does not change routing, and does not authorize source-of-truth, cloud, route, package, or algorithm changes.
