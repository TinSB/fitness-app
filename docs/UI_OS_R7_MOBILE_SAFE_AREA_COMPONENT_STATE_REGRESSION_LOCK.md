# UI-OS R7 — Mobile Safe Area / Component State Regression Lock V1

Task type: regression lock / acceptance hardening task.

## Baseline Evidence

- UI-OS R6 complete.
- UI-OS R6 PR #286.
- UI-OS R6 merge commit: `0ddb2b17c78ecb6b34cb914e70429b4f3822dedb`.
- R6 validation included `npm test`: 1146 files / 4669 tests.
- R6 validation included `dist token scan clean`.
- R6 completed the Settings / Safety / Theme / Equipment Profile control center.

## Why R7 Exists

The previous UI-OS product acceptance failed because the system still felt like a partial reskin and retained interaction issues. R0-R6 corrected the app shell, Focus Mode state machine, Today decision surface, History calendar priority, Progress/Data Health clarity, and Settings control center. R7 locks mobile safe area, component states, copy boundaries, page hierarchy, and source/cloud/route/package boundaries against regression.

## Mobile Safe Area Rules

- Normal pages show bottom nav.
- Focus Mode hides bottom nav and uses immersive layout.
- Scroll content has bottom padding so the last card can sit above the bottom nav; scroll content has bottom padding is a locked acceptance phrase.
- Primary actions must not be hidden behind bottom navigation or sticky bars.
- Sticky action bars coordinate with bottom nav and safe-area bottom inset.
- Focus action bar remains visible while global bottom nav is hidden.
- Actual-record BottomSheet can render above Focus content without requiring global nav.

## Component State Coverage

R7 locks state coverage for:

- ActionButton: default, disabled, loading, success, danger, and dominant primary styling.
- StatusBadge: safe, info, warning, danger, disabled, and manual-required.
- SegmentedControl: default, selected, disabled.
- BottomSheet: closed, open, confirm-required, danger.
- FloatingBottomNav: active tab, inactive tab, active session badge, exactly five items.
- GlassCard: default, highlighted, glass/material markers.
- SettingsGroupCard: grouped Settings surfaces.
- EquipmentAwareLoadCard: empty bar 45 lb, barbell total/per-side context, dumbbell per-hand, machine stack, plate-loaded warning.

## Interaction OS Regression Locks

- Focus Mode correction primary action remains `完成纠偏`, not `完成一组`.
- Focus Mode mobility primary action remains `完成动作`, not `完成一组`.
- Focus Mode skip primary action remains `确认跳过`, not `完成一组`.
- Focus Mode keeps one dominant primary action and visually secondary tools.
- End workout still requires second confirmation.
- Apply suggestion remains feasible weight only and does not fill reps/RIR.
- Equipment-aware prescription remains primary.
- Today remains a decision surface, not a full diagnostics stack.
- History keeps calendar training frequency and weekly/monthly/recent 4-week counts before recent sessions.
- Progress keeps insight hero and human explanation instead of raw-only metrics.
- Data Health keeps owner-friendly issue cards, no automatic repair, and no full AppData/secrets exposure.
- Settings keeps grouped control center hierarchy.

## Theme Regression Locks

- Theme selector supports system/light/dark.
- System theme resolves to dark when system prefers dark and light when system prefers light.
- Explicit light and explicit dark resolve directly.
- Focus Mode may remain immersive dark.
- Theme remains UI-only/session-local unless explicitly authorized later.
- Theme selection does not mutate AppData, source-of-truth, training data, account state, or cloud state.

## Copy Boundaries

Allowed negative safety phrases:

- `云端候选不会自动同步`
- `不会自动同步`
- `不启用自动同步`
- `没有自动同步`

Forbidden positive claims:

- `自动同步已启用`
- `后台同步`
- `多设备自动同步`
- `云端已成为默认数据源`
- `已自动上传成功`
- `已上传成功`
- `云端同步完成`
- `自动修复已应用`
- `已自动修复数据`
- `自动应用云端数据`
- `自动上传`

## Route / Cloud / Source Boundaries

- Accepted browser mutation routes remain exactly seven; accepted browser mutation routes remain exactly seven is a locked acceptance phrase:
  1. `POST /data-health/issues/:issueId/dismiss`
  2. `POST /history/:id/data-flag`
  3. `POST /history/:id/edit`
  4. `POST /sessions/start`
  5. `POST /sessions/active/patches`
  6. `POST /sessions/active/complete`
  7. `POST /sessions/active/discard`
- No eighth browser mutation route is accepted.
- `POST /data-health/repair/apply` remains blocked.
- Backup/import/export HTTP routes remain blocked.
- Reset/recovery HTTP routes remain blocked.
- localStorage remains default/fallback/migration/emergency.
- Backend/cloud candidate remains explicit opt-in and reversible.
- Cloud pull does not auto-apply.
- Cloud push requires manual confirmation.
- No default cloud sync.
- No background sync.
- No automatic sync worker.
- No external monitoring upload.
- No SaaS/multi-user runtime.
- No package/script/lockfile drift.
- `pnpm-lock.yaml` remains absent; pnpm-lock.yaml remains absent is a locked acceptance phrase.
- Production runtime must not import `src/prototype/IronPathOS2.tsx` or `src/prototypePreview.tsx`.

## Recommended Next Task

Recommended next task: UI-OS R8 — Interaction OS Remediation Archive V1.

UI-OS R8 is not started by R7.
