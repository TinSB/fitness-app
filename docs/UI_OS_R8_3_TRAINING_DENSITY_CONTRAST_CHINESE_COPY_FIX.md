# UI-OS R8.3 Training Density / Contrast / Chinese Copy Acceptance Fix

## Task identity

UI-OS R8.3 is a UI presentation, information architecture, copy, and contrast acceptance fix.

UI-OS R9 archive remains postponed until the visual acceptance issues pass.

## Why R8.3 exists

UI-OS R8.2 completed the global legacy surface sweep, reduced duplicate information, simplified Settings copy, and added theme parity locks.

Mobile screenshots still showed three remaining acceptance failures:

- Training / Focus repeated the same load recommendation through multiple visible modules.
- Page and section titles had poor contrast against the dark background.
- Settings still contained English or developer-facing copy.

## Screenshot-observed failures

- Focus showed `推荐处方`, `器械可做重量`, feasible load, per-side plates, base-weight warning, actual-record missing copy, card-level `套用建议`, sticky `套用建议`, sticky `记录本组`, `记录详情`, and `查看动作顺序` together.
- Headings such as `今日决策`, `训练记录中心`, `统计`, and `力量趋势 / PR / e1RM` were too muted for dark theme.
- Settings showed English labels such as `Backup / Recovery`, `Emergency Local Mode`, `Equipment Profiles`, `Olympic barbell`, `Smith machine`, `Dumbbell`, `Selectorized machine`, and `Plate-loaded`.
- Developer copy such as route/source/storage terminology does not belong in production Settings UI.

## What R8.3 fixes

- Focus / Train recommendation compression: one visible `本组建议` with one primary load label.
- Equipment details are collapsed behind `重量详情`.
- Duplicate card-level `套用建议` is removed when the sticky Focus action bar owns the action.
- `记录详情` and action order controls are moved into secondary `更多` paths.
- Global heading contrast tokens are added for page titles, section titles, card titles, primary text, secondary text, muted text, accent text, warning text, and danger text.
- Settings copy is Chinese-first and owner-facing.
- Equipment profile rows use Chinese labels:
  - 奥林匹克杠铃
  - 史密斯机
  - 哑铃
  - 插片器械
  - 挂片器械

## Non-goals

- No training algorithm change.
- No warmup algorithm change.
- No PR / e1RM / effective-set calculation change.
- No planning or rotation logic change.
- No equipment-aware engine calculation change.
- No Data Health detection or repair semantic change.
- No source-of-truth behavior change.
- No persistence or AppData schema change.
- No route, cloud, package, script, or lockfile change.

## Safety boundaries

- localStorage remains default/fallback/migration/emergency.
- Backend/cloud candidate remains explicit opt-in and reversible.
- Cloud pull does not auto-apply.
- Cloud push requires manual confirmation.
- Accepted browser mutation routes remain exactly seven.
- `POST /data-health/repair/apply` remains blocked.
- No default cloud sync.
- No background sync.
- No SaaS/multi-user runtime.
- No package/script/lockfile drift.
- `pnpm-lock.yaml` remains absent.

## Recommended next task

UI-OS R9 — Interaction OS Remediation Archive V1.

UI-OS R9 is not started by R8.3.
