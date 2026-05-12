# Today Training Focus Override

## Scope

Today can now resolve a session-only training focus choice before the user starts training. The override is a UI/session selection layer only. It does not change templates, program structure, progression rules, PR, e1RM, effective-set logic, localStorage storage, backend, auth, sync, or deployment behavior.

## Options

- 系统推荐
- 胸
- 背
- 腿
- 肩
- 手臂
- 核心
- 全身
- 恢复 / 活动度

## Behavior

When the user chooses 系统推荐, Today uses the system recommendation.

When the user chooses another target, Today keeps the system recommendation visible as 原计划 and shows the selected target as 已切换为. Existing templates are selected where possible, for example 胸 maps to 推 A and 背 maps to 拉 A. 核心 and 恢复 / 活动度 use generated session-only templates so the permanent template list is not mutated.

Warnings are advisory and begin with 可能影响恢复. If the selected focus overlaps soreness, readiness, pain/recovery signals, or very recent load, Today shows a warning and keeps the start action available. Existing recovery safety behavior is not broadened into a new blocker.

## Persistence

The selected override itself is React session state and resets to 系统推荐 on reload. If the user starts and completes a workout while an override is active, the active session and completed history item include optional `todayFocusOverride` metadata with the selected focus, selected template, original system template, and applied time. Older records without this field remain valid.

## Validation

Focused coverage lives in:

- `tests/todayTrainingFocusOverride.test.ts`
- `tests/todayTrainingFocusOverrideUi.test.ts`
- `tests/todayTrainingFocusOverrideBoundary.test.ts`
