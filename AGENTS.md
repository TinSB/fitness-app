# IronPath Agent Instructions

You are working on IronPath, a mobile-first personal training PWA built with React, Vite, and TypeScript, now migrating toward native iOS SwiftUI.

## ⚠️ Read First — Master Technical Architecture (binding)

**Before making any change, read and obey [`docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`](docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md).** It is the canonical, highest-level engineering contract and outranks every other doc (including this one and `ARCHITECTURE.md`) on architecture, source-of-truth boundaries, forbidden changes, validation, and the branch/PR workflow.

If a requested task **conflicts** with that document, **stop and require explicit architecture approval before writing any code.** Do not silently introduce new persistence, network, cloud, auth, or platform dependencies, or any source-of-truth change. In particular (see the master doc for the full, authoritative list):

- Native iOS stays **local-first** (on-device JSON files via Foundation only); the SwiftUI app layer stays **thin**; logic lives in **Swift packages**.
- **Draft restore is an in-memory draft, not a full AppData restore** (full restore is gated behind DataHealth `buildCleanAppDataView`).
- **TrainingDecision** consumes only a clean `CleanTrainingDecisionInput` — never raw AppData. The `IronPathLocalSnapshot` history store must never touch canonical AppData.
- Do **not** introduce CloudKit/iCloud/Supabase/HealthKit/URLSession/WebView/auth/UserDefaults/SQLite/CoreData/SwiftData into native iOS without an approved architecture task that amends the master doc.
- Do **not** change `package.json`/lockfiles or `project.pbxproj` without explicit justification.
- Use a normal branch from latest `origin/main` (no `git worktree`); never work on `main`; open a PR; wait for checks; no `--admin`; no branch-protection bypass.

## Product Direction

IronPath must feel like a polished, restrained, professional mobile training app, not an admin dashboard, engineering demo, or data-heavy panel.

The app has five main navigation entries:

1. 今日
2. 训练
3. 记录
4. 计划
5. 我的

Each page has a strict responsibility:

- 今日 answers: should I train today, what should I train, where do I start?
- 训练 answers: how do I record the workout now?
- 记录 answers: what did I train before?
- 计划 answers: how will I train in the future?
- 我的 answers: where are my settings, screening, data, units, and backup?

## Design Principles

- Mobile first.
- Clean, restrained, professional.
- Do not create admin-style layouts.
- Do not create dense dashboard pages.
- Do not stack many cards.
- Do not repeat the same information across pages.
- Do not expose raw exercise metadata unless the user opens details.
- User UI must label Focus Mode as “专注训练”; technical docs may still mention Focus Mode when referring to the implementation shell.
- Desktop layouts must use the full workspace with main content and auxiliary panels.

## UI Rules

- Use consistent spacing, buttons, badges, cards, and list rows.
- Prefer grouped sections over many floating cards.
- Primary actions should be visually clear.
- Dangerous actions require confirmation.
- Status badges must be short.
- Empty states must include a title, short explanation, and one clear action.

## Exercise Data Display Rules

Default display only:
- exercise name
- movement pattern
- primary muscle group
- prescription summary
- set type
- weight / reps / RIR
- recommended rest

Collapsed or detail-only:
- technique standards
- substitutions
- regressions / progressions
- fatigue cost
- evidence tags
- muscle contribution weights

Never dump all exercise metadata into the main UI.

## Implementation Rules

- Preserve existing training logic unless explicitly asked.
- Prefer refactoring UI structure over changing business logic.
- Keep components reusable.
- Do not introduce large new dependencies without justification.
- After changes, run available typecheck, lint, and build commands if present.
- If unsure about existing code behavior, inspect the relevant files before editing.

## Agent skills

### Issue tracker

IronPath tracks product and engineering work in GitHub Issues for `TinSB/fitness-app`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use existing GitHub labels where available and document missing suggested workflow labels without creating them automatically. See `docs/agents/triage-labels.md`.

### Domain docs

IronPath uses a single-context docs layout with `docs/` for product and engineering documents and `docs/adr/` reserved for ADRs when needed. See `docs/agents/domain.md`.
