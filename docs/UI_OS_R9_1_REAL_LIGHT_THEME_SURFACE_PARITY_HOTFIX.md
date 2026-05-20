# UI-OS R9.1 Real Light Theme Surface Parity Hotfix

## Task Identity

UI-OS R9.1 — Real Light Theme Surface Parity Hotfix V1.

This is a UI/theme presentation hotfix after the Interaction OS remediation archive. UI-OS 10A is recommended next, but it is not started by this task.

## Why This Exists After R9

UI-OS R9 archived the full remediation sequence, and the first R9.1 hotfix connected the theme selector to the app shell. Mobile acceptance still failed because light theme only changed the outer background while Training, Training Detail, record detail panels, inputs, buttons, and cards still carried dark-theme primitives.

## Screenshot-Observed Failures

- Light shell with dark Training cards.
- Training Detail and Record Detail surfaces still rendered dark blocks in light mode.
- Form fields and buttons mixed gray/dark surfaces with low-contrast text.
- Normal pages used light background plus dark content cards instead of one coherent light theme.

## What Was Fixed

- The semantic surface model now includes `input_surface`, `action_surface`, `record_detail_surface`, and `training_detail_surface`.
- Shared surface owners (`Card`, `MetricCard`, `ActionButton`, `SafeAreaHeader`, `BottomSheet`, `Drawer`, `WorkoutActionBar`, `ListItem`, and equipment-aware load display surfaces) resolve light and dark classes from the active UI theme.
- Normal Training uses `training_detail_surface` and stops applying dark descendant overrides when the active theme is light.
- Training Detail and Record Detail use semantic light surfaces in light mode, while dark mode keeps the existing dark UI.
- Inputs, selects, textareas, and secondary action buttons use readable light backgrounds, dark text, readable placeholders, subtle borders, and emerald focus rings.
- Bottom sheets and drawers follow the active normal-page theme. Focus remains an explicit immersive dark exception.

## Focus Immersive Exception

Focus Mode can remain dark when the global theme is light. The exception is constrained to the immersive Focus shell and its sheets/action bars; normal Training and Training Detail must follow the selected light/dark/system theme.

## Non-Goals

- No training algorithm change.
- No warmup policy change.
- No planning or rotation logic change.
- No PR, e1RM, effective-set, or Data Health calculation change.
- No source-of-truth behavior change.
- No persistence or AppData schema change.
- No route, cloud, package, script, or lockfile change.

## Safety Boundaries

- Theme preference remains UI-only.
- AppData is not modified for theme rendering.
- Stored workout history is not mutated.
- Browser mutation routes remain unchanged.
- Cloud sync remains absent.
- `pnpm-lock.yaml` remains absent.

## Recommended Next Task

UI-OS 10A — Real Gym Use Acceptance & Bug Intake V1.

UI-OS 10A - Real Gym Use Acceptance & Bug Intake V1.

UI-OS 10A is recommended but not started by R9.1.
