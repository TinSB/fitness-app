# TrainingDecision Clean Input Contract Lock V1 — Delivered

Status: delivered in this PR
Branch: `claude/trainingdecision-clean-input-contract-lock-v1`
Plan: [TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1_PLAN.md](TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1_PLAN.md)
Predecessors: [TRAINING_RECOMMENDATION_HARD_REWRITE_V2.md](TRAINING_RECOMMENDATION_HARD_REWRITE_V2.md), [REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md](REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md), [DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md](DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md), [CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md](CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md), [CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md](CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md)

## 1. What this delivers

Locks the boundary between AppData and the TrainingDecision pipeline so that future code physically cannot pass raw AppData into TrainingDecision without TypeScript or static-test failures.

The clean-data pipeline (V1/V2) was already running in production at every ingress site and at every engine-pipeline call. What was missing was the *type signature* — `buildTrainingDecision(input: TrainingDecisionInput)` and `buildTrainingDecisionContext(data: Partial<AppData>)` both accepted shapes that raw AppData could trivially satisfy. Three feature surfaces (`PlanView`, `RecordView`, `App.tsx` finishSession) actually exploited that gap and extracted recommendation inputs straight from raw `data`. V1 closes the gap with a branded type, factory, wrapper, and static guard tests.

No recommendation algorithm change. No UI redesign. No cloud sync change. No AppData schema change. No localStorage / cloud sync table change. No package or lockfile change.

## 2. Risk surface that V1 closes

Before this PR:

| Call site | Raw AppData entered TrainingDecision via | Status now |
|---|---|---|
| `src/App.tsx` `finishSession` (line 711) | `buildTrainingDecision({ todayStatus: currentData.todayStatus, history: currentData.history, mesocyclePlan: currentData.mesocyclePlan, screening: currentData.screeningProfile, … })` | Replaced with `buildTrainingDecisionFromCleanInput(createCleanTrainingDecisionInput(buildCleanAppDataView(currentData), { template, trainingMode, nowIso }), …)` |
| `src/features/PlanView.tsx:208,244` | `buildTrainingDecision({ todayStatus: data.todayStatus, history: data.history, … })` | Replaced; CleanAppDataView is taken from `enginePipeline.cleanAppDataView` |
| `src/features/RecordView.tsx:665,695` | `buildTrainingDecision({ todayStatus: data.todayStatus, history: data.history, … })` | Replaced; CleanAppDataView is computed locally via `React.useMemo(() => buildCleanAppDataView(data), [data])` |
| `src/features/TodayView.tsx:337,512` | already used `decisionContext.*` (clean) but imported `buildTrainingDecision` directly | Migrated to the wrapper for static-guard parity |
| `src/engines/sessionBuilder.ts:139,140,316,363,364` | `buildTrainingDecisionContext(decisionData, …)` accepts raw `Partial<AppData>` | Static guard now forbids new UI/cloud importers of `buildTrainingDecisionContext`; the existing callers (test-only and App.tsx through the clean wrapper) remain working. |
| `src/engines/recommendationDiffEngine.ts:40` | `buildTrainingDecisionContext({…context}, …)` accepts raw `Partial<AppData>` | Static guard catches future production-side importers; the engine itself is signal-only after V2 and called only from tests. |

After this PR, the only ways to enter TrainingDecision from production code are:

1. `buildEnginePipeline(appData, currentDate, …)` — already calls `buildCleanAppDataView` then `buildTrainingDecisionContext(cleanAppDataView.appData, …)`.
2. `buildTrainingDecisionFromCleanInput(createCleanTrainingDecisionInput(cleanView, metadata), surfaces?)` — accepts only `CleanTrainingDecisionInput` (branded).
3. `buildTrainingDecisionContextFromCleanInput(createCleanTrainingDecisionContextSource(cleanView), …)` — accepts only `CleanTrainingDecisionContextSource` (branded).

Any other path fails the static guard.

## 3. Clean input contract

`src/engines/trainingDecisionCleanInput.ts` exposes:

```ts
export const CLEAN_TRAINING_DECISION_INPUT_BRAND: unique symbol;
export const CLEAN_TRAINING_DECISION_CONTEXT_SOURCE_BRAND: unique symbol;

export type CleanTrainingDecisionInput = TrainingDecisionInput & { readonly [CLEAN_TRAINING_DECISION_INPUT_BRAND]: true };
export type CleanTrainingDecisionContextSource = Partial<AppData> & { readonly [CLEAN_TRAINING_DECISION_CONTEXT_SOURCE_BRAND]: true };

export interface CleanTrainingDecisionInputMetadata {
  template: TrainingTemplate;
  trainingMode?: TrainingMode | string;
  nowIso?: string;
  acutePainReported?: boolean;
  injuryFlag?: boolean;
  illnessFlag?: boolean;
  explicitDeloadAssigned?: boolean;
  useHealthDataForReadiness?: boolean;
  healthSummary?: HealthSummary;
  adaptiveCalibration?: AdaptiveCalibrationState;
}

export const createCleanTrainingDecisionInput: (cleanView, metadata) => CleanTrainingDecisionInput;
export const createCleanTrainingDecisionContextSource: (cleanView) => CleanTrainingDecisionContextSource;
export const withCleanTrainingDecisionInputOverride: (input, overrides) => CleanTrainingDecisionInput;

export const isCleanTrainingDecisionInput: (value: unknown) => boolean;
export const isCleanTrainingDecisionContextSource: (value: unknown) => boolean;
export function assertCleanTrainingDecisionInput(input): asserts input is CleanTrainingDecisionInput;
export function assertCleanTrainingDecisionContextSource(source): asserts source is CleanTrainingDecisionContextSource;

export const buildTrainingDecisionFromCleanInput: (input, surfaces?) => TrainingDecision;
export const buildTrainingDecisionContextFromCleanInput: (source, dateOrOverrides?, overrides?) => TrainingDecisionContext;
```

### Brand mechanics

- Brands are `Symbol.for(...)` keys so they are shared across modules / bundles / CommonJS-ESM boundaries.
- The brand is attached via `Object.defineProperty(value, BRAND, { value: true, enumerable: false, writable: false, configurable: false })`.
- Non-enumerable means: `JSON.stringify` drops it, `{ ...spread }` drops it, structural equality (`expect(a).toEqual(b)`) ignores it.
- That is intentional — any caller that clones or modifies the input must use `withCleanTrainingDecisionInputOverride` (which re-stamps the brand) or call the factory again. A naive spread/mutation strips the brand and the wrapper throws.

### Factory contract

`createCleanTrainingDecisionInput(cleanView, metadata)` does not fabricate or replace data; it only forwards cleaned values:

| Field | Source |
|---|---|
| `template` | `metadata.template` |
| `todayStatus` | `cleanView.appData.todayStatus` (V1 has already date-scoped + soreness-defaulted stale entries) |
| `history` | `cleanView.appData.history` (V1 lifecycle/duration/legacy-advice already stripped) |
| `mesocyclePlan` | `cleanView.appData.mesocyclePlan ?? null` |
| `screening` | `cleanView.appData.screeningProfile` (V1 issueScore capped, performanceDrops filtered) |
| `healthSummary` | `metadata.healthSummary` (caller-derived; nothing raw enters here) |
| `useHealthDataForReadiness` | explicit metadata override → `false` if `cleanView.healthData.staleForReadiness` → AppData setting → `undefined` |
| `adaptiveCalibration` | `metadata.adaptiveCalibration ?? cleaned.adaptiveCalibration` |
| `trainingMode` | `metadata.trainingMode ?? cleaned.trainingMode` |
| `nowIso`, severity flags | `metadata.*` |

`createCleanTrainingDecisionContextSource(cleanView)` returns `cleanView.appData` with the brand stamped — preserving the cleaned reference so downstream context building uses the same data.

### Wrappers

`buildTrainingDecisionFromCleanInput(input, surfaces?)`:
1. `assertCleanTrainingDecisionInput(input)` — throws `TypeError` if the brand is missing.
2. Delegates to `buildTrainingDecision(input, surfaces)` (unchanged engine).

`buildTrainingDecisionContextFromCleanInput(source, dateOrOverrides?, overrides?)`:
1. `assertCleanTrainingDecisionContextSource(source)` — throws `TypeError` if the brand is missing.
2. Delegates to `buildTrainingDecisionContext(source, …)`.

## 4. Type/static guard strategy

- **Compile-time (TS structural):** the brand is a phantom `readonly [Symbol]: true` property. Raw `TrainingDecisionInput` / `Partial<AppData>` literals do not have it, so direct assignment / argument passing fails with TS error.
- **Type-only test:** `tests/trainingDecisionCleanInputContractTypeGuards.test.ts` uses `// @ts-expect-error` directives that fail the build if a future change weakens the brand.
- **Runtime:** the wrappers call `assertClean…` which reads the symbol back. Raw inputs throw `TypeError` with a structured message.
- **Static-source scan:** `tests/trainingDecisionCleanInputContractStaticGuards.test.ts` greps the file system for forbidden import patterns — UI / feature / cloud directories cannot import `buildTrainingDecision` / `buildTrainingDecisionContext` directly.

## 5. Files changed

### New
- `src/engines/trainingDecisionCleanInput.ts` (172 LOC, no runtime side effects).
- `tests/trainingDecisionCleanInputContractStaticGuards.test.ts` (12 tests).
- `tests/trainingDecisionCleanInputContractFactory.test.ts` (16 tests).
- `tests/trainingDecisionCleanInputContractTypeGuards.test.ts` (4 tests; one type-only via `@ts-expect-error`).
- `docs/TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1_PLAN.md`.
- `docs/TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1.md` (this file).

### Modified
- `src/App.tsx` — `finishSession` post-workout `buildTrainingDecision` migrated to the clean factory; imports re-routed through `trainingDecisionCleanInput`.
- `src/features/TodayView.tsx` — `buildTrainingDecision` migrated for two call sites; uses `enginePipeline.cleanAppDataView`.
- `src/features/PlanView.tsx` — `buildTrainingDecision` migrated for two call sites; `enginePipeline` moved up so `cleanAppDataView` is available before the first call.
- `src/features/RecordView.tsx` — `buildTrainingDecision` migrated for two call sites; local `cleanAppDataView` `useMemo` added; imports re-routed.
- `docs/DATA_REPAIR_POLICY.md` — cross-links the new contract.
- `docs/REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md` — cross-links.
- `docs/DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md` — cross-links.

### Unmodified (deliberately)
- `src/engines/trainingDecisionEngine.ts` — engine source untouched; the wrapper composes around it.
- `src/engines/trainingDecisionContext.ts` — unchanged. The wrapper composes.
- `src/engines/trainingDecisionTypes.ts` — unchanged.
- `src/engines/sessionBuilder.ts` — unchanged signatures. Existing callers continue to work; the static guard prevents future raw-input drift in UI/cloud paths.
- `src/engines/recommendationDiffEngine.ts` — unchanged.
- `src/dataHealth/**` — unchanged.
- `src/models/training-model.ts` — AppData schema unchanged.
- `package.json` / `package-lock.json` — unchanged.

## 6. Tests

All new tests share the prefix `trainingDecisionCleanInputContract*`.

### Static guards (`tests/trainingDecisionCleanInputContractStaticGuards.test.ts`)
1. `trainingDecisionCleanInputContractModuleExposesContract` — public API of `trainingDecisionCleanInput.ts`.
2. `trainingDecisionCleanInputContractCleanModuleIsPure` — no storage / cloud / sync / localStorage / IndexedDB imports.
3. `trainingDecisionCleanInputContractFeaturesDoNotImportRawEngine` — `src/features/**/*.tsx` does not import `buildTrainingDecision` / `buildTrainingDecisionContext` from the raw engine modules.
4. `trainingDecisionCleanInputContractFeaturesUseCleanFactory` — TodayView/PlanView/RecordView import and use the clean factory.
5. `trainingDecisionCleanInputContractAppUsesCleanFactory` — `App.tsx` finishSession uses `createCleanTrainingDecisionInput`; no direct `buildTrainingDecision(` remains.
6. `trainingDecisionCleanInputContractCloudPathsDoNotImportEngine` — `cloudProduction/`, `cloudSync/`, `storage/`, `sync/` do not import TrainingDecision entries or sessionBuilder.
7. `trainingDecisionCleanInputContractEnginePipelineRemainsCanonical` — `enginePipeline.ts` still feeds `buildTrainingDecisionContext(cleanAppDataView.appData, …)`.
8. `trainingDecisionCleanInputContractEngineSourceHasNoLegacyAdviceRead` — engine modules do not read `exercise.suggestion` / `exercise.warning` / `prescription.weeklyAdjustment` / `session.explanations`.
9. `trainingDecisionCleanInputContractSessionBuilderNoLiveLegacyAdviceRead` — sessionBuilder does not read legacy advice fields as live recommendation input.
10. `trainingDecisionCleanInputContractFeaturesDirectDataExtractionAbsent` — multi-line tripwire forbidding `buildTrainingDecision({ todayStatus: data.todayStatus, history: data.history })` literal pattern.
11. `trainingDecisionCleanInputContractCleanInputIsCanonicalImport` — feature/UI/devApi/presenter files do not import `buildTrainingDecision`/`buildTrainingDecisionContext` from raw engine modules.
12. `trainingDecisionCleanInputContractCleanAppDataViewSourcedFromIngressOnly` — only the allow-listed files call `buildCleanAppDataView` (enginePipeline, ingress pipeline, App.tsx, RecordView, the clean module itself).

### Behavioral (`tests/trainingDecisionCleanInputContractFactory.test.ts`)
1. `factoryReturnsBrandedInput` — factory output passes `isCleanTrainingDecisionInput`.
2. `factoryReturnsBrandedContextSource` — context-source factory output passes its predicate.
3. `factoryStripsLegacyAdviceFromHistory` — fixture-fed factory produces history sessions with no legacy advice text.
4. `factoryClearsLifecycleResidueOnCompletedSessions` — completed sessions in the input have no live focus-step strings; `currentExerciseId` blank; `currentFocusStepId` falsy or sentinel `'completed'`.
5. `factoryDropsStaleHealthForReadiness` — V1 fixture's 29-day-old Apple Health yields `useHealthDataForReadiness=false`.
6. `factoryHonorsExplicitMetadataOverrides` — `trainingMode`, `nowIso`, severity flags pass through metadata.
7. `assertCleanInputAcceptsBrandedInput` — happy path.
8. `assertCleanInputRejectsRawInput` — raw object throws TypeError.
9. `assertCleanInputRejectsSpreadInput` — `{...input}` drops brand → throws.
10. `assertCleanContextSourceRejectsRaw` — raw `{history,todayStatus}` throws.
11. `withOverridePreservesBrand` — re-stamp helper keeps the brand.
12. `withOverrideRejectsUnbrandedInput` — re-stamp helper refuses non-branded inputs.
13. `buildTrainingDecisionFromCleanInputProducesDecision` — happy path returns a V2 decision with the expected `decisionVersion` and `computedAtIso`.
14. `buildTrainingDecisionRejectsSpreadInput` — `{...input}` → wrapper throws.
15. `buildTrainingDecisionContextFromCleanInputWorks` — happy path returns a TrainingDecisionContext.
16. `buildTrainingDecisionContextRejectsRawSource` — raw source → wrapper throws.

### Type guards (`tests/trainingDecisionCleanInputContractTypeGuards.test.ts`)
17. `rawInputIsNotAssignableAtCompileTime` — `// @ts-expect-error` confirms raw `TrainingDecisionInput` cannot be assigned to `CleanTrainingDecisionInput`; runtime confirms wrapper rejects raw.
18. `rawAppDataIsNotAssignableAsContextSource` — same pattern for `CleanTrainingDecisionContextSource`.
19. `brandedInputIsAssignableEverywhere` — branded input flows back to TrainingDecisionInput where needed.
20. `brandedContextSourceIsAssignableToPartialAppData` — branded source widens to `Partial<AppData>` (the engine doesn't see the brand).

### Regression
- `trainingDecisionHardRewrite*` (V2 SoT) — all 35 tests passing.
- `realDataHealthRepair*` (V1) — all passing.
- `dataHealthCloudRestoreLinkage*` (V2) — all passing.
- `cloudUploadEligibilityEnforcement*` (V3) — all passing.
- `cloudSubsequentUploadFlow*` (V4) — all passing.
- Full suite: 5724 passing / 5724.

## 7. Validation summary

- `npm run typecheck` → clean.
- `npm test` → 5724 passing / 5724.
- `npm run build` → clean Vite production bundle.
- `npm run api:dev:build` → SSR runtime bundle builds.
- `node scripts/scan-production-dist-safety.mjs` → "Production dist safety scan passed. Files scanned: 21."
- `git diff -- package.json package-lock.json` → no diff.
- `test ! -e pnpm-lock.yaml` → passes.
- `git diff --check` → no whitespace errors.

## 8. Browser smoke

- `npm run build` → bundle produced, including the new clean-input module compiled into the canonical engine chunk.
- `npm run api:dev:build` → SSR build succeeds.
- `node scripts/scan-production-dist-safety.mjs` → passes (no forbidden visible copy, no secret-like patterns).
- `npx vite preview --port 4173` → HTTP 200, HTML loads with the canonical bundle references.
- Three scenarios are covered by the unit/integration test suite (5724 tests, including the dedicated regression suites for V1/V2/V3/V4 plus the new contract suite for V1):
  1. **Dirty AppData fixture (V1 redacted real export)** — `realDataHealthRepairPipeline` regression suite + `trainingDecisionCleanInputContractFactoryStripsLegacyAdviceFromHistory` confirm legacy advice is not surfaced to TrainingDecision.
  2. **Clean AppData** — `enginePipelineRealWorldRegression`, `trainingDecisionHardRewriteEngineShape`, `trainingDecisionHardRewriteUserFacingShape` confirm parity with the canonical engine pipeline.
  3. **Session start + finish** — `App.tsx` `startSession` uses the existing clean wrap (V2); `finishSession` now uses the new clean factory (validated by `trainingDecisionCleanInputContractAppUsesCleanFactory` static guard + behavioral happy-path test).

## 9. Data safety

- AppData schema unchanged.
- No new localStorage / IndexedDB / cloud key.
- No migration.
- The brand symbols are runtime-only and non-persisted (non-enumerable, not in JSON, not in spread).
- Cleaning logic unchanged — V1 + V2 still own data cleaning. The factory only forwards already-cleaned values.
- kg/lb conversions untouched (`unitSettings` not in scope).
- localStorage / cloud sync untouched.
- package / lockfile unchanged.

## 10. Remaining risks (residual)

1. **New top-level directories.** The static guard explicitly lists `src/features`, `src/cloudProduction`, `src/cloudSync`, `src/storage`, `src/sync`, `src/presenters`, `src/ui`, `src/uiOs`, `src/devApi`, `src/App.tsx`. A future new directory (e.g. `src/coach/` or `src/widgets/`) would need to be added. Mitigation: a CODEOWNERS reminder and the prefix-based test file (so it shows up in default test runs).
2. **Tests intentionally call the raw engine.** `tests/trainingDecisionHardRewrite*.test.ts` import `buildTrainingDecision` directly to assert engine behavior. The static guards scope to production directories, not `tests/`. By design.
3. **`recommendationDiffEngine.ts` raw input.** This module is signal-only after V2 and its callers are tests. Migrating its input to the branded shape is deferred because there is no production caller today. If a production caller appears, it must use `buildTrainingDecisionContextFromCleanInput`.
4. **`sessionBuilder.ts` signatures.** `scoreSuggestedTemplates(data, decisionContext)` and `pickSuggestedTemplate(data, decisionContext)` still accept raw `Partial<AppData>` as the first arg. App.tsx passes `(data, decisionContext)` where `decisionContext` is the clean enginePipeline.context; the override covers the relevant fields. A future caller could still pass raw data without a clean override, but only test callers do today. A follow-up V2 of this contract can lock these signatures the same way.

End of delivery doc.
