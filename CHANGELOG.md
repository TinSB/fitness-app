# IronPath Changelog

All notable frontend governance and product-structure changes should be recorded here.

## 2026-06-07

- Retired the former Web/PWA implementation surface from the active repository: removed the Node/Vite runtime, TypeScript source/tests/scripts, browser assets, Supabase/Vercel implementation candidates, dev API, `IronPathCloudSync` stub package, and package/lockfile tooling.
- Rebased the active project guidance to Swift/iOS: CI now runs Swift package tests and Xcode build, PWA validation routes are no longer current, and Swift test fixtures live under `ios/ParityFixtures`.
- Preserved the iOS-native account/cloud/sync/CRDT decision docs as canonical future architecture input; only the old implementation candidates were removed.
- Rewrote repository meta docs (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, `docs/agents/domain.md`) to stop instructing agents or contributors to use npm, Vite, browser tests, or old PWA routes.
- Added `docs/IRONPATH_PRODUCT_COPY_BASELINE.md` as the canonical product-copy baseline for IronPath, then tightened it from a string inventory into a brand-language baseline: core line, voice model, signature sentence patterns, commercial copy posture, v0 generation rules, and health/privacy/AI-risk guardrails.
- Registered the product-copy baseline in `docs/DOCS_MANIFEST.md` so future user-facing copy, locale, onboarding, paywall, App Store, and prototype-generation copy changes have a single living reference.
- Added `docs/IRONPATH_PRODUCT_DESIGN_LANGUAGE.md` as the canonical product design-language baseline: replaced the AI-coach / command-center direction with a stronger decision-led `Forged Graphite + Emberline` brand system, four-tab IA guardrails, signature visual components, v0 generation prompt, and design QA checklist.
- Added the Share / Growth System direction to the iOS system logic and commercialization roadmap: local privacy-safe share cards first, muscle-level and PR growth assets, plan/routine sharing later, and account/cloud/feed/attribution behind explicit architecture gates.
- Expanded the Muscle Level Estimator into an engineering-ready contract: package boundary, clean input contract, output types, scoring pipeline, personal calibration, confidence, decision integration, share projection, implementation slices, and Swift test matrix.
- Folded the legacy beginner/intermediate/advanced training-level model into the Muscle Level Estimator target: `overallTier` replaces the parallel user-facing level, self-reported training level becomes only a cold-start prior, and recognized strength milestones such as bench 100kg / 225lb become level/tier breakthrough inputs.

## 2026-06-06

- Added an isolated `/site` marketing surface for P0 commercialization validation: bilingual IronPath + Larder positioning, product-path split, early-access/TestFlight intent form, and transparent founder-beta/price-intent smoke-test UI. The default PWA route and training business logic remain unchanged; the form and pricing actions are local prototypes with no backend charge path.
- Reconciled the iOS system-logic living spec with the master architecture contract: `docs/IRONPATH_iOS_SYSTEM_LOGIC.md` now separates current implementation, target product direction, and architecture-gated work.
- Clarified that Supabase, CRDT sync, watchOS, WatchConnectivity, full restore, and source-of-truth changes are target directions only until `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` is explicitly amended.
- Updated `AGENTS.md` product direction from the legacy five-tab shell to the commercial four-tab target (`今日 / 训练 / 进展 / 计划`) with Profile / Settings as a low-frequency entry.
- Extended the system-logic baseline with exercise catalog/equipment authority, gym equipment packs, load calibration, in-session set-shape learning, and warm-up execution boundaries.
- Tightened repo-facing guidance in `docs/DOCS_MANIFEST.md`, `README.md`, `docs/agents/domain.md`, and `docs/IRONPATH_iOS_DECISION_CIRCUIT.html` so future agents do not treat the legacy five-tab shell or visual HTML as the target source of truth.
- Aligned `COMMERCIALIZATION_ROADMAP.md` with the local-first system contract: App Store subscription can ship before first-party account/cloud sync, while auth and cloud sync remain opt-in gated infrastructure.
- Rewrote `README.md` as a GitHub-facing native iOS project overview and removed the old Web/PWA operating guide.
- This changelog entry covers only the documentation files intentionally edited in this pass. Any existing `project.pbxproj`, source, or package/lockfile diffs in the working tree are outside this entry and require separate justification before inclusion.

## 2026-06-05

- Established the **living-doc system**: added `docs/DOCS_MANIFEST.md` as the single constraint list of canonical living docs, and a binding "Doc Discipline" section in `AGENTS.md` (no new top-level `.md`, code change → sync docs, archive-or-delete instead of new "v2" files, throwaway artifacts to `_scratch/`).
- Cleaned up 457 stale docs (legacy PWA design/audit docs + iOS-native-migration slices) via `git rm` (recoverable); kept only the manifest-registered canonical/reference docs. Migration directory `docs/ios-native-migration/` removed.
- Ignored local scratch trees `_slices/` and `_scratch/` in `.gitignore`.
- Fixed `ios/IronPathWidget/Info.plist` to declare the required `CFBundleExecutable` and `CFBundlePackageType` keys.
- Docs-and-config only; no engine, source, `project.pbxproj`, or `package.json` changes.

## 2026-04-29

- Added `PLAN_PAGE_CLEANUP.md` to audit current Plan page sections, identify duplicate schedule/recommendation/draft/rollback surfaces, and define the target structure: current plan, weekly schedule, pending recommendations, and adjustment drafts.
- Added Plan Page Cleanup backlog tasks for view-model grouping, schedule-section consolidation, recommendation/draft de-duplication, and experimental-template rollback presentation.
- Confirmed this Plan audit pass is documentation-only and does not modify UI, training algorithms, engines, or data models.
- Added `COACH_ACTION_WORKFLOW.md` for Coach Action Workflow V1 planning, including the CoachAction contract, action types, status flow, confirmation/undo rules, active-session-only boundaries, Program Adjustment Preview handoff, follow-up tracking, implementation order, and testing strategy.
- Added Coach Action Workflow V1 backlog tasks for action contract/status flow, navigation-only actions, confirmation-gated active-session actions, Program Adjustment Preview handoff, local dismissal/undo, and outcome tracking.
- Confirmed this planning pass does not modify business logic, training algorithms, data models, or runtime UI.

## 2026-04-28

- Added `TRAINING_INTELLIGENCE_PLAN.md` for Training Intelligence V1 planning, including engine boundaries, display-only analysis, Program Adjustment Preview handoff rules, confirmation rules, protected core algorithms, implementation order, and testing strategy.
- Added Training Intelligence V1 backlog tasks for `sessionQualityEngine`, `recommendationConfidenceEngine`, `plateauDetectionEngine`, `volumeAdaptationEngine`, and `trainingIntelligenceSummaryEngine`.
- Added `COACH_AUTOMATION_PLAN.md` for Coach Automation V1 planning, including engine boundaries, confirmation rules, protected data, implementation order, and testing strategy.
- Added Coach Automation V1 backlog tasks for `dataHealthEngine`, `nextWorkoutScheduler`, `setAnomalyEngine`, `dailyTrainingAdjustmentEngine`, `smartReplacementEngine`, and `coachAutomationEngine`.

- Added frontend governance baseline: `FRONTEND_PLAN.md`, `UI_SPEC.md`, `COMPONENT_GUIDE.md`, `ROUTES.md`, `TASKS.md`.
- Added `API_CONTRACT.md` to document the current no-backend contract, localStorage persistence fields, backup import/export, health import boundaries, and program-adjustment mutation rules.
- Documented the current five-page IA: 今日, 训练, 记录, 计划, 我的.
- Documented that 计划 owns future plan/experimental template/rollback work, while 我的 owns settings/health import/backup and 记录 owns training-record management.
- No business implementation files or package files were intentionally changed.
