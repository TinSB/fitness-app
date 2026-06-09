# Rede Agent Instructions

You are working on Rede, a native iOS SwiftUI personal training product under a clean rewrite baseline. The former PWA, Node/Vite runtime, TypeScript source, browser tests, Supabase/Vercel implementation candidates, and cloud-sync scaffolding have been removed. Treat the living docs as the active product and engineering truth. Existing `ios/` code is legacy/reference inventory only; use it for evidence, naming, and tests only when a rewrite slice explicitly approves reuse. iOS-native account/cloud/sync/CRDT decisions remain in the living docs; they are not first-version runtime code.

## ⚠️ Read First — Master Technical Architecture (binding)

**Before making any change, read and obey [`docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md`](docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md).** It is the canonical, highest-level engineering contract and outranks every other doc (including this one and `ARCHITECTURE.md`) on architecture, source-of-truth boundaries, forbidden changes, validation, and the branch/PR workflow.

If a requested task **conflicts** with that document, **stop and require explicit architecture approval before writing any code.** Do not silently introduce new persistence, network, cloud, auth, or platform dependencies, or any source-of-truth change. In particular (see the master doc for the full, authoritative list):

- The clean native iOS runtime stays **local-first** (on-device JSON files via Foundation only); the SwiftUI app layer stays **thin**; logic lives in **Swift packages**.
- **Draft restore is an in-memory draft, not a full AppData restore** (full restore is gated behind DataHealth `buildCleanAppDataView`).
- **TrainingDecision** consumes only a clean `CleanTrainingDecisionInput` — never raw AppData. The `RedeLocalSnapshot` history store must never touch canonical AppData.
- Do **not** introduce CloudKit/iCloud/Supabase runtime clients/URLSession/WebView/auth runtime/UserDefaults/SQLite/CoreData/SwiftData, or expand HealthKit beyond the already-approved adapters, without an approved architecture task that amends the master doc.
- Do **not** change `project.pbxproj` or package manifests without explicit justification.
- Use a normal branch from latest `origin/main` (no `git worktree`); never work on `main`; open a PR; wait for checks; no `--admin`; no branch-protection bypass.

## ⚠️ Doc Discipline — Living-Doc System (binding)

This repo follows a **small fixed set of living docs**, governed by [`docs/DOCS_MANIFEST.md`](docs/DOCS_MANIFEST.md). **New agents/sessions must read `DOCS_MANIFEST.md` first.**

1. **Code change → sync the docs.** Any change must also update the affected canonical living doc (architecture / system-logic / decisions / roadmap / changelog). During the clean rewrite phase, living docs define the target truth; legacy code drift does not override them. Docs out of sync with approved runtime changes = the task is **not done**.
2. **No new top-level `.md` files.** To add a doc, first register it in `DOCS_MANIFEST.md` (state its role + why no existing doc fits); otherwise the PR is rejected.
3. **Superseded / stale content** is archived into the matching canonical doc or deleted — **never** spun off into a new "v2 / final / final-2" file.
4. **Throwaway artifacts** (one-off analysis, audits, headless prompts, slices) go in `_scratch/`, `.ai-tmp/` (local gitignored scratch), or outputs — **never** into the repo doc tree.

## Product Direction

Rede must feel like a polished, restrained, professional mobile training app, not an admin dashboard, engineering demo, or data-heavy panel.

The commercial target has four bottom navigation entries:

1. 今日
2. 训练
3. 进展
4. 计划

Each page has a strict responsibility:

- 今日 answers: should I train today, what should I train, where do I start?
- 训练 answers: how do I record the workout now?
- 进展 answers: did training work, what changed, and is the data trustworthy?
- 计划 answers: how will I train in the future, and what changes are proposed?

Profile / Settings is a low-frequency entry, not a bottom tab. It owns settings, screening, data, units, HealthKit permissions, backup/export, and subscription surfaces. Account or sync controls require a future architecture amendment and are not part of the first clean runtime. Legacy iOS code may contain a `我的` tab; target work must implement the commercial navigation directly.

**MVP execution entry.** The first shippable version's scope, slice queue (M0–M6), per-slice acceptance, and TestFlight launch gate live in [`docs/REDE_MVP_IMPLEMENTATION_PLAN.md`](docs/REDE_MVP_IMPLEMENTATION_PLAN.md) — the execution layer for roadmap P1 (locked baseline: TestFlight free-first, core training-loop only, bilingual zh/en UI). During MVP the `计划` tab is an honest empty-state placeholder; the core loop is 今日 / 训练 / 进展. This doc does not outrank the master architecture or system-logic docs. It is a **bounded-lifecycle doc**: once the user explicitly confirms the MVP is fully complete, follow its §11 termination flow (record in changelog → absorb into canonical docs → de-register → delete); successor planning lives in a PRD plus a development plan based on the PRD and MVP completion, registered separately at that time.

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

- Preserve approved product/system logic unless the living docs are explicitly amended.
- Do not preserve legacy runtime behavior by default. Inspect old code only as reference and only reuse it through an approved rewrite slice.
- Keep components reusable.
- Do not introduce large new dependencies without justification.
- After docs-only changes, run `git diff --check`; after runtime slices, run relevant Swift package tests and Xcode build commands if present.
- If unsure about existing code behavior, inspect the relevant files before editing.

## Agent skills

### Issue tracker

Rede tracks product and engineering work in GitHub Issues for `TinSB/fitness-app`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use existing GitHub labels where available and document missing suggested workflow labels without creating them automatically. See `docs/agents/triage-labels.md`.

### Domain docs

Rede uses a single-context docs layout with `docs/` for product and engineering documents and `docs/adr/` reserved for ADRs when needed. See `docs/agents/domain.md`.
