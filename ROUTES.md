# IronPath Routes

Last updated: 2026-04-28

## Routing Model

The current app is a Vite SPA without `react-router`. Routing is implemented as app state inside `src/App.tsx`:

- Primary route state: `activeTab`
- Secondary profile state: `profileSection`
- Record deep-link state: `progressTarget`
- Training focus shell state: `useFocusTrainingShell`

Vercel rewrites all URL paths to `/index.html`, but the app itself does not currently map URL paths to pages.

## Primary Routes

| Logical route | State | Label | Component | Responsibility |
| --- | --- | --- | --- | --- |
| `/today` | `activeTab = 'today'` | 今日 | `TodayView` | Today's training decision, recommendation, readiness, start/resume. |
| `/training` | `activeTab = 'training'` | 训练 | `TrainingFocusView` or `TrainingView` | Current workout recording. |
| `/record` | `activeTab = 'record'` | 记录 | `RecordView` | Calendar, history, PR/e1RM, stats, training-record data management. |
| `/plan` | `activeTab = 'plan'` | 计划 | `PlanView` | Future plan, templates, weekly structure, suggestions, experimental templates, rollback. |
| `/profile` | `activeTab = 'profile'`, `profileSection = 'home'` | 我的 | `ProfileView` | Settings center, units, health import, backup/restore, local data explanation. |
| `/profile/assessment` | `activeTab = 'profile'`, `profileSection = 'assessment'` | 筛查 | `AssessmentView` | Body profile, posture flags, movement flags, program settings. |

The URL paths above are logical documentation names. They are not implemented as browser routes yet.

## Secondary Sections

### 记录

`RecordView` has internal sections:

- `calendar`: training calendar, default entry.
- `list`: history list.
- `pr`: personal records and e1RM.
- `stats`: statistics.
- `data`: training-record data management.

Legacy/compatibility targets from `App.tsx` are normalized:

- `history` -> `list`
- `dashboard` -> `stats`

### 我的

`ProfileView` links to `AssessmentView` through `profileSection = 'assessment'`.

Profile also links to record data management:

- `ProfileView` -> `onOpenRecordData()` -> `activeTab = 'record'`, `progressTarget.section = 'data'`

### 训练

Training route chooses the component based on state:

- Mobile active session and no forced full view: `TrainingFocusView`.
- No active session or full mode requested: `TrainingView`.

## Navigation Relationships

| From | Action | To |
| --- | --- | --- |
| 今日 | Start training | 训练 |
| 今日 | Resume active training | 训练 |
| 今日 | View completed session | 记录 -> `list` with selected session |
| 今日 | View calendar date | 记录 -> `calendar` with selected date |
| 训练 | Finish session | 记录 -> `list` by default |
| 训练 | Finish to calendar | 记录 -> `calendar` |
| 训练 | Finish to today | 今日 |
| 训练 | Discard current session | 今日 |
| 记录 | Start training | 训练 |
| 计划 | Start selected template | 训练 |
| 我的 | Open screening | 我的 -> `profileSection = 'assessment'` |
| 我的 | Open training data management | 记录 -> `data` |
| 筛查 | Go program | 计划 |
| Any primary page | Bottom nav / desktop side nav | Corresponding `activeTab` |

## Route Ownership Constraints

- Do not add `progress` or `assessment` as primary tabs.
- Do not move backup/restore into 记录.
- Do not move health import into 记录 or 计划.
- Do not move workout logging controls into 我的 or 计划.
- Do not make PR/statistics a primary surface on 今日 or 计划.
- Do not make plan adjustment the default entry of 记录.

## Future Router Notes

If real URL routing is added later:

- Add the mapping to this file before implementation.
- Preserve the five primary page responsibilities.
- Keep state restoration compatible with local persistence.
- Update `vercel.json` rewrite only if non-SPA behavior is introduced.

