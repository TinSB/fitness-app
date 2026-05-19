# Task UI-OS R0 v0 Design System Extraction & Production Parity

## Task Identity

Task UI-OS R0 — v0 Design System Extraction & Production Parity V1.

R0 exists because UI-OS integration failed product acceptance: the production app received a partial shell/reskin, but the stronger v0 Apple-inspired design-system components from PR #273 were not fully applied to the real app. product acceptance failed because the real app did not apply the full v0 component system. UI-OS R2 is paused until design-system parity is established.

## Baseline Evidence

- UI-OS R1 completed in PR #280.
- UI-OS R1 merge commit: 5136de81f417d19804a80ff579dd31787e69c085.
- v0 prototype PR #273 created `prototype.html`, `src/prototype/IronPathOS2.tsx`, `src/prototypePreview.tsx`, and `vite.config.ts`.
- Prototype remains isolated and preview-only.

## v0 Component Inventory

The reviewed v0 prototype contains:

- `GlassCard`
- `ActionButton`
- `SegmentedControl`
- `StatusBadge`
- `SafetyStrip`
- `EquipmentAwareLoadCard`
- `BottomSheet`
- `FloatingBottomNav`
- `SettingsRow`
- page mockups for Today, Train, History, Progress, and Settings

## Production Extraction Map

| v0 component | Production target |
| --- | --- |
| `GlassCard` | `src/uiOs/primitives/GlassCard.tsx` |
| `ActionButton` | `src/uiOs/primitives/ActionButton.tsx` |
| `SegmentedControl` | `src/uiOs/primitives/SegmentedControl.tsx` |
| `StatusBadge` | `src/uiOs/primitives/StatusBadge.tsx` |
| `BottomSheet` | `src/uiOs/surfaces/BottomSheet.tsx` |
| `SafetyStrip` | `src/uiOs/surfaces/SafetyStrip.tsx` |
| `FloatingBottomNav` | `src/uiOs/navigation/FloatingBottomNav.tsx` |
| `EquipmentAwareLoadCard` | `src/uiOs/training/EquipmentAwareLoadCard.tsx` |
| Training focus hero | `src/uiOs/training/TrainingFocusHero.tsx` |
| Settings grouped cards | `src/uiOs/settings/SettingsGroupCard.tsx` |

## Extracted Components

R0 extracts the production-safe v0 component system as reusable, prop-driven React components. Extracted components preserve the v0 material language: near-black surfaces, translucent `rgba(...)` backgrounds, minimal borders, `backdrop-blur-xl`, rounded 2xl/3xl forms, large training numerals, bottom-sheet material, and floating bottom navigation.

The extracted components do not own training logic, do not read or write localStorage, do not call fetch/backend APIs, do not import Supabase, do not import Node-only modules, and do not mutate AppData.

## Production Surfaces Updated

- `MobileAppShell` now uses the extracted `FloatingBottomNav` and extracted `SafetyStrip`.
- The local-first safety strip now uses the extracted production `SafetyStrip`.
- Training UI-OS wrappers now use extracted `GlassCard` / `TrainingFocusHero` material.
- Settings grouped cards now use extracted `SettingsGroupCard`.
- History/Progress UI-OS overview uses extracted `GlassCard` material.
- `EquipmentAwareLoadDisplay` now renders the extracted `EquipmentAwareLoadCard` while keeping the existing equipment-aware display helper and recommendation values unchanged.

## Deferred Components And Work

- The prototype page mockups remain reference-only and are not copied into production.
- `SettingsRow` remains deferred because production Settings needs a later page-level rewrite.
- Broad replacement of legacy `src/ui/Card.tsx`, `src/ui/ActionButton.tsx`, and all page internals is deferred.
- Focus Mode operation state-machine changes are deferred to UI-OS R2.
- Actual record bottom sheet behavior, skip/correction primary-action rules, discomfort flow, and full page-level redesigns remain deferred to UI-OS R2-R6.

## Prototype Isolation

Production runtime may import extracted `src/uiOs` components, but must not import `src/prototype/IronPathOS2.tsx` directly. Production runtime must not import `src/prototypePreview.tsx`. `prototype.html` remains preview-only.

## Boundaries Preserved

- No training algorithm change.
- No warmup algorithm change.
- No PR/e1RM/effective-set logic change.
- No equipment-aware engine logic change.
- No source-of-truth behavior change.
- No persistence behavior change.
- No AppData migration.
- No historical data mutation.
- No routes or browser mutation routes added.
- No cloud sync/default/background sync.
- No Supabase connection.
- No package/dependency/script/lockfile change.
- No real personal training data in tests.
- `pnpm-lock.yaml` remains absent.
- Accepted browser mutation routes remain exactly seven.

## Next Task

UI-OS R2 — Focus Mode Interaction State Machine Rewrite V1 is recommended next.

UI-OS R2 is not started by R0.
