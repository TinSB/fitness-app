# UI-OS R8.2 Global Legacy Surface & Information Density Sweep

## Task Identity

UI-OS R8.2 — Global Legacy Surface & Information Density Sweep V1 is an implementation task.

R9 archive is postponed until this sweep passes. UI-OS R9 Archive is recommended next and is not started by R8.2.

## Baseline Evidence

UI-OS R8.1 is complete. PR #289 merged at `035215637a396de83849c24097a33de7109b32fb`.

R8.1 passed validation with `npm test` at 1164 files / 4737 tests, build passed, and the dist token scan was clean. R8.1 fixed the Today bottom-nav overlap and partially compressed Today, but product acceptance still failed.

## Why R8.2 Exists

R8.1 fixed the immediate overlay issue, but global white-card, density, repetition, and theme parity issues remain. The failure is not one isolated card.

User-observed failures:
- White cards still appear in Today details, recommendation confidence, Settings, Progress, and History surfaces.
- Settings copy is still too technical.
- Today still has repeated modules and low-priority system cards.
- Theme parity is incomplete across dark and light surfaces.
- Duplicate information appears across Today, Settings, Progress, and Data Health areas.

## Global Audit Inventory

Legacy white / light surfaces found:
- Today detail/status sections still had legacy `Card`, `MetricCard`, `bg-stone-50`, `bg-white`, and slate text inside dark shell.
- Focus replacement picker still used light rows and controls.
- Training full view still used legacy `Card`, `MetricCard`, white inputs, and stone rows.
- Record / History / Progress detail drawers still mixed raw `bg-white`, `bg-stone-50`, and slate text.
- Settings panels still used light grouped rows and technical status cards.

Duplicated modules found:
- Today repeated decision, preview, recommendation explanation, coach reminders, confidence, action guidance, and status detail concepts.
- Settings repeated local-first, cloud-manual, diagnostics, and data safety paragraphs.
- Data Health summaries appeared both in training flow and Settings.
- Focus and full Training both exposed competing detail/action surfaces.

Verbose technical copy found:
- Settings showed implementation terms such as localStorage fallback wording, route boundaries, service role, AppData, manual candidate only, and cloud operation wording.
- Diagnostics used developer-facing redaction language instead of owner-facing safety copy.
- Equipment profile defaults mixed English/developer phrasing with owner-facing settings.

Modules moved behind details / bottom sheets:
- Today recommendation rationale, status controls, plan details, and recovery rationale.
- Focus actual-set input and replacement details.
- Settings health data import, screening, coach inbox, diagnostics details, equipment draft editor, and backup details.

Modules moved from Today to Settings / Progress / History:
- Data Health details and low-priority diagnostics move to Settings.
- Strength trend and PR / e1RM explanations stay in Progress.
- Calendar and frequency ownership stays in History.
- Safety, backup, cloud candidate, and equipment detail ownership stays in Settings.

Modules hidden in normal state:
- Full local-first safety strip.
- Normal recovery / fatigue card.
- Recommendation confidence card.
- Coach reminder card.
- Automatic adjustment card.
- Full action guide and long training preview.

## Surface Rules

Semantic surfaces now include:
- `app_background`
- `page_surface`
- `dark_glass_card`
- `glass_card`
- `elevated_card`
- `training_hero`
- `health_card`
- `settings_group`
- `warning_surface`
- `danger_surface`
- `bottom_sheet`
- `modal_surface`
- `safety_strip`
- `compact_row`

Dark theme rules:
- No uncontrolled large white or light-gray cards in Today, Focus, Train, History, Progress, or Settings.
- Light surfaces are allowed only through explicit light theme, controlled semantic components, or modal / bottom-sheet surfaces.
- Production UI should use UI-OS primitives and semantic surface tokens instead of raw surface islands.

Light theme rules:
- Apple Health-style white cards remain allowed through semantic surfaces.
- Surface names remain the same across light and dark modes.

## Page Ownership Rules

Today owns the daily decision only:
- Today decision hero
- meaningful recovery / status
- compact `切换目标`
- concise training preview
- severe-risk-only notice

Focus owns current-set action:
- current exercise
- current set
- equipment-aware recommendation
- one dominant primary action
- concise cue
- compact `更多`

History owns calendar and frequency:
- calendar
- week / month / recent 4-week summary
- selected day summary
- PR / e1RM quick access
- recent sessions secondary

Progress owns trend and PR / e1RM:
- strength trend first
- PR / e1RM first
- effective sets / volume explanation next
- recovery pressure secondary
- no raw metric dump as primary

Settings owns safety, cloud, backup, equipment, diagnostics, and app preferences:
- App Preferences / Theme / Units
- Backup & Recovery
- Emergency Local
- Equipment Profiles
- Cloud Candidate
- Diagnostics / Data Safety
- About / Data Safety

## Duplicate Deletion Rules

Only one page/location owns each concern:
- Today: daily decision.
- Focus: current set.
- History: calendar/frequency.
- Progress: trends and PR / e1RM.
- Settings: safety, cloud, backup, equipment, and diagnostics details.

R8.2 consolidates duplicate local-first strips, duplicate Today recommendation cards, duplicate cloud safety paragraphs, duplicate Data Health summaries, duplicate primary CTAs, and repeated detail/action stacks.

## Non-Goals And Safety Boundaries

R8.2 does not change:
- training algorithms
- warmup algorithm
- PR / e1RM / effective-set calculations
- planning or rotation logic
- equipment-aware engine logic
- Data Health detection logic
- source-of-truth behavior
- persistence behavior
- AppData schema
- stored data
- routes or browser mutation routes
- cloud sync, default cloud sync, or background sync
- package dependencies, scripts, or lockfiles

Safety boundaries remain:
- localStorage remains default/fallback/migration/emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- accepted browser mutation routes remain exactly seven.
- `POST /data-health/repair/apply` remains blocked.
- no backup/import/export HTTP routes.
- no reset/recovery HTTP routes.
- no SaaS or multi-user runtime.
- no package/script/lockfile drift.
- `pnpm-lock.yaml` remains absent.
