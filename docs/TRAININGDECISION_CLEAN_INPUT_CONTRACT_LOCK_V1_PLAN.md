# TrainingDecision Clean Input Contract Lock V1 — Plan

Status: planning
Branch: `claude/trainingdecision-clean-input-contract-lock-v1`
Predecessors:
- [TRAINING_RECOMMENDATION_HARD_REWRITE_V2.md](TRAINING_RECOMMENDATION_HARD_REWRITE_V2.md)
- [REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md](REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md)
- [DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md](DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md)
- [CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md](CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md)
- [CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md](CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md)

## 1. Executive summary

The cleaning pipeline `processIncomingAppData → CleanAppDataView → buildTrainingDecisionContext` is wired at every AppData ingress (V2) and at app boot / session start / post-session (V1+V2). What is **not** locked is the *function signature* of the TrainingDecision entry points themselves:

- `buildTrainingDecisionContext(data: Partial<AppData>, …)` accepts any AppData shape (clean or raw) — only caller discipline enforces the clean path.
- `buildTrainingDecision(input: TrainingDecisionInput, …)` accepts a structural object whose fields (`todayStatus`, `history`, `screening`, …) can be sourced from raw AppData with no compile-time signal.
- Three feature surfaces (`PlanView`, `RecordView`, `App.tsx finishSession`) still extract these fields directly from raw `data` rather than from the `enginePipeline.context` derived from `CleanAppDataView`.

V1 (this plan) locks the contract at the function-signature level so that future regressions fail at compile/static-test time:

1. A branded `CleanTrainingDecisionInput` type that raw `TrainingDecisionInput` cannot structurally satisfy.
2. A branded `CleanTrainingDecisionContextSource` for `buildTrainingDecisionContext`.
3. Approved factories (`createCleanTrainingDecisionInput`, `createCleanTrainingDecisionContextSource`) that accept only `CleanAppDataView`.
4. Wrappers (`buildTrainingDecisionFromCleanInput`, `buildTrainingDecisionContextFromCleanInput`) that accept only the branded types.
5. Static guards: UI / features / cloud / restore / import paths must use the wrappers, never the raw entry points.
6. Runtime assertion (`assertCleanTrainingDecisionInput`) for defense in depth at the engine boundary.

No recommendation-algorithm change. No UI redesign. No cloud-sync change. No AppData schema change. No localStorage / cloud sync change. kg/lb conversions untouched. package/lockfile untouched.

## 2. Current clean-data architecture (recap)

```
Raw AppData
   │
   ▼  processIncomingAppData (V2 — every ingress: boot / import / cloud restore / etc.)
   │   inside: buildCleanAppDataView + safe-auto repair orchestrator
   ▼
CleanAppDataView { raw, appData (cleaned), guardDiagnostics, todayStatus, healthData, ... }
   │
   ▼  buildEnginePipeline / startSession path
   │   inside: buildTrainingDecisionContext(cleanAppDataView.appData, ...)
   ▼
TrainingDecisionContext (clean, fully derived)
   │
   ▼  buildTrainingDecision(input)
   ▼
TrainingDecision (V2 SoT — userFacing.{today,plan,training,focus,progress,record,explanation})
```

Today this pipeline is *the* canonical clean path, but only `enginePipeline.ts:45` and `App.tsx:629–630` actually enforce CleanAppDataView before TrainingDecision. The other 4–5 places extract fields out of raw `data` and pass them straight into `buildTrainingDecision(...)`.

## 3. Risk of raw AppData re-entry

| # | Call site | Input today | Risk |
|---|---|---|---|
| R1 | `src/App.tsx:711` (`finishSession` → post-workout `buildTrainingDecision`) | `currentData.todayStatus`, `currentData.history`, `currentData.mesocyclePlan`, `currentData.screeningProfile`, `currentData.trainingMode` (all raw) | post-workout `record.userFacing` rebuilt from raw AppData. If raw `history` contains lifecycle residue (V1 fixture: 10/10 sessions), or `todayStatus` is stale-from-yesterday, the post-workout recommendation can poison the next session's plan. |
| R2 | `src/features/PlanView.tsx:208,244` (`buildTrainingDecision` for plan explanation + weekly progression) | `data.todayStatus`, `data.history`, `data.mesocyclePlan`, `data.screeningProfile` (raw) | Plan-view recommendation built from raw AppData; bypasses runtime guard. |
| R3 | `src/features/RecordView.tsx:665,695` (`buildTrainingDecision` for `progress` + `plan` surfaces) | `data.todayStatus`, `data.history`, `data.mesocyclePlan`, `data.screeningProfile` (raw) | Record / progress surface narrative built from raw AppData. |
| R4 | `src/engines/sessionBuilder.ts:139,140,316,363,364` (`buildTrainingDecisionContext` in `createSession`, `scoreSuggestedTemplates`, `pickSuggestedTemplate`) | `decisionData: Partial<AppData>` extracted from caller's `(data, …)` params | `App.tsx:494` calls `pickSuggestedTemplate(data, decisionContext)` with raw `data`. The full clean `decisionContext` override saves most fields, but `data.settings`, `data.adaptiveCalibration`, `data.userProfile` still come from raw. |
| R5 | `src/engines/recommendationDiffEngine.ts:40` (`buildTrainingDecisionContext` inside `recommendationSignature`) | `Partial<AppData>` from caller | Diff-engine signature reads raw history if caller passes raw context. |

All five risks share the same shape: the caller has either a raw AppData reference or extracts raw fields, and the TrainingDecision entry accepts them with no type-level pushback.

R1, R2, R3 are *active* leaks in feature code today.
R4, R5 are *latent* leaks — the existing tests work because callers happen to pass cleaned overrides, but the function signature does not require that.

## 4. All TrainingDecision input paths found

### `buildTrainingDecisionContext` (`src/engines/trainingDecisionContext.ts:144`)
**Signature today:** `(data: Partial<AppData>, currentDateOrOverrides?, maybeOverrides?) → TrainingDecisionContext`
**Callers in src/:**
- `src/engines/enginePipeline.ts:45` — `buildTrainingDecisionContext(cleanAppDataView.appData, …)` ✅ clean
- `src/App.tsx:630` — `buildTrainingDecisionContext(cleanWorkingData, …)` (via `buildCleanAppDataView(workingData).appData`) ✅ clean
- `src/engines/sessionBuilder.ts:139,140,316,363,364` — `buildTrainingDecisionContext(decisionData, …)` ⚠️ caller-discipline
- `src/engines/recommendationDiffEngine.ts:40` — `buildTrainingDecisionContext({…context}, …)` ⚠️ caller-discipline

### `buildTrainingDecision` (`src/engines/trainingDecisionEngine.ts:1872`)
**Signature today:** `(input: TrainingDecisionInput, surfaces?: TrainingDecisionSurfaceInputs) → TrainingDecision`
**Callers in src/:**
- `src/App.tsx:711` — fields from `currentData.*` ⚠️ raw
- `src/features/TodayView.tsx:337,512` — fields from `decisionContext.*` (clean derived) ✅
- `src/features/PlanView.tsx:208,244` — fields from `data.*` ⚠️ raw
- `src/features/RecordView.tsx:665,695` — fields from `data.*` ⚠️ raw

### `buildCleanAppDataView` (`src/dataHealth/cleanAppDataView.ts:86`)
Callers today:
- `src/engines/enginePipeline.ts:44` ✅
- `src/dataHealth/appDataIngressPipeline.ts:153` ✅
- `src/App.tsx:629` ✅

The CleanAppDataView producer side is already in good shape — what's missing is forcing every TrainingDecision consumer to pass through it.

## 5. Proposed type contract

New file: `src/engines/trainingDecisionCleanInput.ts`.

### 5.1 Branded clean input (for `buildTrainingDecision`)

```ts
const CLEAN_TRAINING_DECISION_INPUT_BRAND = Symbol.for(
  'ironpath.trainingDecision.cleanInput.v1',
);

export type CleanTrainingDecisionInput = TrainingDecisionInput & {
  readonly [CLEAN_TRAINING_DECISION_INPUT_BRAND]: true;
};

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

export const createCleanTrainingDecisionInput = (
  cleanView: CleanAppDataView,
  metadata: CleanTrainingDecisionInputMetadata,
): CleanTrainingDecisionInput;

export const isCleanTrainingDecisionInput = (value: unknown): value is CleanTrainingDecisionInput;

export const assertCleanTrainingDecisionInput: (
  input: TrainingDecisionInput,
) => asserts input is CleanTrainingDecisionInput;

export const buildTrainingDecisionFromCleanInput = (
  input: CleanTrainingDecisionInput,
  surfaces?: TrainingDecisionSurfaceInputs,
) => TrainingDecision;
```

### 5.2 Branded source for `buildTrainingDecisionContext`

```ts
const CLEAN_TRAINING_DECISION_CONTEXT_SOURCE_BRAND = Symbol.for(
  'ironpath.trainingDecision.cleanContextSource.v1',
);

export type CleanTrainingDecisionContextSource = Partial<AppData> & {
  readonly [CLEAN_TRAINING_DECISION_CONTEXT_SOURCE_BRAND]: true;
};

export const createCleanTrainingDecisionContextSource = (
  cleanView: CleanAppDataView,
): CleanTrainingDecisionContextSource;

export const isCleanTrainingDecisionContextSource = (
  value: unknown,
): value is CleanTrainingDecisionContextSource;

export const buildTrainingDecisionContextFromCleanInput = (
  source: CleanTrainingDecisionContextSource,
  currentDateOrOverrides?: string | Partial<TrainingDecisionContext>,
  maybeOverrides?: Partial<TrainingDecisionContext>,
) => TrainingDecisionContext;
```

Both brands use **Symbol.for(...)** so the brand is the same across module boundaries / bundles.
Both brands are added via `Object.defineProperty(value, BRAND, { value: true, enumerable: false, configurable: false })` — non-enumerable, non-iterable, untouched by JSON.stringify or `{...spread}`.

### 5.3 Why raw AppData cannot structurally satisfy the brand

- TypeScript: the `readonly [Symbol]: true` member is a phantom property. A raw `AppData` literal does not have it and the compiler refuses the assignment.
- Runtime: `Object.spread` / JSON round-trip drops the brand (the symbol is non-enumerable). `assertCleanTrainingDecisionInput` reads the symbol back; raw inputs fail.

### 5.4 What the factory does

`createCleanTrainingDecisionInput(cleanView, metadata)`:
1. Reads `cleanView.appData` (already cleaned by `buildCleanAppDataView`).
2. Constructs a `TrainingDecisionInput` from the cleaned values:
   - `todayStatus` ← `cleanView.appData.todayStatus`. If `cleanView.todayStatus.ignoredForCurrentReadiness`, fall back to DEFAULT or the cleaned value (cleaning already scopes to the current date).
   - `history` ← `cleanView.appData.history` (lifecycle / duration / legacy-advice already stripped).
   - `mesocyclePlan` ← `cleanView.appData.mesocyclePlan`.
   - `screening` ← `cleanView.appData.screeningProfile`.
   - `trainingMode` ← `metadata.trainingMode ?? cleanView.appData.trainingMode`.
   - `useHealthDataForReadiness` ← `metadata.useHealthDataForReadiness ?? (cleanView.healthData.staleForReadiness ? false : appData.settings?.healthIntegrationSettings?.useHealthDataForReadiness)`.
   - `healthSummary` ← `metadata.healthSummary` (caller can pass derived summary; nothing raw forced in).
   - `adaptiveCalibration` ← `metadata.adaptiveCalibration ?? cleanView.appData.adaptiveCalibration`.
   - `nowIso`, severity flags ← from `metadata`.
3. Stamps the brand and returns.

`createCleanTrainingDecisionContextSource(cleanView)`:
1. Takes `cleanView.appData` as-is (still a `Partial<AppData>` shape).
2. Stamps the brand and returns.

## 6. Proposed static guard tests

New file: `tests/trainingDecisionCleanInputContractStaticGuards.test.ts`.

The static guards scan the repo file system (no runtime needed) and assert:

1. **No UI feature imports `buildTrainingDecision` from `trainingDecisionEngine` directly.** Only `buildTrainingDecisionFromCleanInput` from `trainingDecisionCleanInput`.
2. **No UI feature imports `buildTrainingDecisionContext` from `trainingDecisionContext` directly.** Only `buildTrainingDecisionContextFromCleanInput` or the `enginePipeline` re-export.
3. **`src/cloudProduction/**`, `src/cloudSync/**`, `src/storage/**` do not import `buildTrainingDecision`, `buildTrainingDecisionContext`, or any `sessionBuilder` recommendation entry directly.** Cloud / restore paths must always go through `processIncomingAppData → CleanAppDataView`.
4. **`src/engines/sessionBuilder.ts` does not read legacy live-advice fields** (`session.explanations` as live recommendation, `exercise.suggestion`, `exercise.adjustment`, `exercise.warning`, `prescription.weeklyAdjustment`, `session.deloadDecision` as live state). These are snapshot-only.
5. **`src/engines/trainingDecisionEngine.ts` only reads whitelisted input fields** (`input.template`, `input.todayStatus`, `input.history`, …) — no `input.appData` / `input.raw` / new free-form fields.
6. **`src/App.tsx` finishSession path uses the clean factory.** Static regex: `createCleanTrainingDecisionInput(` appears in `App.tsx`.
7. **`PlanView.tsx`, `RecordView.tsx` use the clean factory.** Same regex.
8. **No production file calls `buildTrainingDecisionContext` with literal `data.` raw reference in features.** Regex tripwire.
9. **`trainingDecisionCleanInput.ts` itself does not import storage / cloud / sync** (purity invariant matches V2).
10. **No code path reads `session.explanations[...]` / `exercise.suggestion` / `exercise.adjustment` / `exercise.warning` / `prescription.weeklyAdjustment` / `session.deloadDecision` as live recommendation input** outside of presenter-only render code already approved by V2.

## 7. Runtime guard / factory design

Runtime defenses:
- `assertCleanTrainingDecisionInput(input)` at the head of `buildTrainingDecisionFromCleanInput`. Type guard via the Symbol; raw inputs throw a structured error (`TypeError: TrainingDecision input must be created by createCleanTrainingDecisionInput`).
- `buildTrainingDecisionFromCleanInput` and `buildTrainingDecisionContextFromCleanInput` are thin pass-through wrappers that *return the same value as the underlying engine*. No behavior change for clean inputs.
- `createCleanTrainingDecisionInput` is the only call site that adds the symbol. It does *not* fabricate data — it only forwards cleaned values from CleanAppDataView, so raw fields cannot sneak in via the factory.
- The brand survives shallow normalization (Object.assign, spread). Spread drops non-enumerable properties, *which is what we want* — the moment a caller manually edits/clones the input, the brand is gone and the engine rejects it.

Failure modes intentionally surfaced:
- Caller passes raw `TrainingDecisionInput` literal → TS compile error.
- Caller bypasses TS (e.g. `as CleanTrainingDecisionInput`) → runtime assertion throws.
- Caller spreads (`{ …cleanInput, template: x }`) → brand dropped → assertion throws → caller must re-run factory or use `withCleanTrainingDecisionInputOverride(input, partialMeta)` helper (also exported, also brand-preserving).

## 8. Files to change

### New
- `src/engines/trainingDecisionCleanInput.ts` (the contract module).

### Modified — production code
- `src/App.tsx`: finishSession `buildTrainingDecision` call → use clean factory. Keep `startSession` path unchanged (already clean). Replace direct `buildTrainingDecision` import with `buildTrainingDecisionFromCleanInput`.
- `src/features/PlanView.tsx`: two `buildTrainingDecision` calls → use clean factory; derive CleanAppDataView once via existing `enginePipeline.cleanAppDataView` (already returned by `buildEnginePipeline`).
- `src/features/RecordView.tsx`: two `buildTrainingDecision` calls → use clean factory similarly.
- `src/features/TodayView.tsx`: minimal change — its callers already use `decisionContext.*` which is the clean derived context. Migrate the imports to point at the clean wrapper to satisfy the static guard.

### Modified — docs
- `docs/TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1.md` (delivery summary).
- `docs/TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1_PLAN.md` (this file).
- `docs/DATA_REPAIR_POLICY.md` (cross-link the new contract).
- `docs/REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md` (cross-link).
- `docs/DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md` (cross-link).

### Unmodified
- `src/engines/trainingDecisionEngine.ts` — the engine itself is untouched. `buildTrainingDecision` remains exported for tests / internal use; the clean wrapper composes around it.
- `src/engines/trainingDecisionContext.ts` — unchanged. Wrapper composes.
- `src/engines/sessionBuilder.ts` — unchanged signatures. Static guard catches future raw-input drift; the existing callers (App.tsx, scoreSuggestedTemplates tests) keep working.
- `src/engines/recommendationDiffEngine.ts` — unchanged (it is signal-only after V2; its callers are tests).
- `src/dataHealth/**` — unchanged.
- `src/models/training-model.ts` — AppData schema unchanged.
- Storage / cloud sync / packaging / lockfile — untouched.

## 9. Tests

All new tests carry prefix `trainingDecisionCleanInputContract*`.

### Static (file-system scan)
- `trainingDecisionCleanInputContractStaticGuards.test.ts`:
  1. `trainingDecisionCleanInputContractCleanInputFactoryExists` — module exports the documented symbols.
  2. `trainingDecisionCleanInputContractFeaturesUseCleanFactory` — `src/features/**/*.tsx` (TodayView, PlanView, RecordView, TrainingFocusView, TrainingView, ProgressView) that import any TrainingDecision entry import only from `trainingDecisionCleanInput`.
  3. `trainingDecisionCleanInputContractAppUsesCleanFactory` — `src/App.tsx` finishSession block uses `createCleanTrainingDecisionInput(`.
  4. `trainingDecisionCleanInputContractCloudPathsDoNotImportEngine` — `src/cloudProduction/**`, `src/cloudSync/**`, `src/storage/**` do not import `buildTrainingDecision` / `buildTrainingDecisionContext` / sessionBuilder.
  5. `trainingDecisionCleanInputContractEnginePipelineRemainsCanonical` — `buildTrainingDecisionContext(cleanAppDataView.appData` still present.
  6. `trainingDecisionCleanInputContractTrainingDecisionEngineNoLegacyFields` — engine source contains no read of `exercise.suggestion` / `exercise.adjustment` / `exercise.warning` / `.prescription.weeklyAdjustment` / `session.explanations` (already enforced by V1; re-asserted here so the V1 invariant is part of this contract).
  7. `trainingDecisionCleanInputContractSessionBuilderNoLiveLegacyAdviceRead` — `sessionBuilder.ts` does not read `session.explanations` / `exercise.suggestion` / `exercise.adjustment` / `exercise.warning` as *live* recommendation input (write-side snapshot fields are allowed).
  8. `trainingDecisionCleanInputContractCleanInputModuleIsPure` — no imports from `cloudSync` / `cloudProduction` / `productionApi` / `storage` / `localStorage`.

### Behavioral
- `trainingDecisionCleanInputContractFactory.test.ts`:
  1. `factoryReturnsBrandedInput` — `createCleanTrainingDecisionInput(...)` returns a value where `isCleanTrainingDecisionInput` is true.
  2. `factoryStripsLegacyAdviceFromHistory` — feeding the V1 fixture (every session carries `suggestion`/`adjustment`/`warning`) yields a clean input whose history has no live legacy-advice fields readable as recommendation input (test scans the input's history sessions for the legacy fields).
  3. `factoryDropsStaleTodayStatus` — when CleanAppDataView marks `todayStatus.ignoredForCurrentReadiness=true`, the input's `todayStatus` is scoped to current date with default soreness (matches V1 behavior).
  4. `factoryDropsStaleHealthForReadiness` — when CleanAppDataView marks `healthData.staleForReadiness=true`, the input's `useHealthDataForReadiness=false`.
  5. `factoryDropsLifecycleResidueFromActiveSession` — for the V1 fixture's completed-session-with-rest-timer pattern, the input's history sessions have no `restTimerState.isRunning=true`.
  6. `assertCleanTrainingDecisionInputThrowsOnRawInput` — `assertCleanTrainingDecisionInput({template, todayStatus, history})` throws `TypeError`.
  7. `buildTrainingDecisionFromCleanInputAcceptsBrandedInput` — happy path: factory → wrapper → returns a `TrainingDecision` equivalent to the raw-engine call on the same cleaned values.
  8. `buildTrainingDecisionFromCleanInputRejectsSpreadedInput` — `{ ...cleanInput, template: x }` drops the brand → wrapper throws.

### Compile-time (type-only)
- `trainingDecisionCleanInputContractTypeGuards.test.ts`:
  9. `rawTrainingDecisionInputDoesNotStructurallySatisfyCleanInput` — `// @ts-expect-error` snippets confirm:
     - `buildTrainingDecisionFromCleanInput({template, todayStatus, history})` — TS error.
     - `buildTrainingDecisionContextFromCleanInput({history: []})` — TS error.
     - These are checked via the `// @ts-expect-error` reverse comment which fails the build if the line *doesn't* error.

### Regression
- Existing tests must keep passing:
  - `trainingDecisionHardRewrite*.test.ts` (V2 SoT invariants).
  - `realDataHealthRepair*.test.ts` (V1 immunity).
  - `dataHealthCloudRestoreLinkage*.test.ts` (V2 ingress).
  - `cloudUploadEligibilityEnforcement*.test.ts` (V3).
  - `cloudSubsequentUploadFlow*.test.ts` (V4).

## 10. Data safety

- No AppData schema change.
- No persisted-state shape change.
- No new localStorage key, IndexedDB table, or cloud table.
- No migration.
- The brand symbols are runtime-only and non-persisted.
- The cleaning logic is unchanged; we are only locking the *typing* around it.
- The factory uses `cleanView.appData` (already cleaned in V1+V2). It does not mutate raw.

## 11. Browser smoke

Three scenarios using the local dev build (`npm run build` → preview, or `npm run dev`):

1. **Dirty local AppData** (load the V1 fixture-style state):
   - Today / Plan / Training / Record / Focus surfaces render through CleanAppDataView.
   - No legacy advice text leaks into recommendation surfaces.
   - No console errors / warnings.

2. **Clean AppData**:
   - All surfaces render exactly as on `main` (visual / numeric parity).
   - No console errors.

3. **Session start + finish**:
   - `startSession` path (already clean) keeps working.
   - `finishSession` post-workout recommendation is produced via the clean factory.
   - No raw-input runtime assertion error in console.

## 12. Remaining risks

- A future caller can bypass the static guard if they add a *new* feature directory not covered by the regex. Mitigation: the guard list explicitly enumerates `src/features/**`, `src/cloudProduction/**`, `src/cloudSync/**`, `src/storage/**`, `src/App.tsx`. A new top-level directory will need to be added to the guard or a CODEOWNERS rule.
- The runtime `assertCleanTrainingDecisionInput` only triggers when the wrapper is called. Anyone calling `buildTrainingDecision` directly still bypasses the runtime check. Mitigation: the static guard forbids direct imports in UI/feature/cloud paths; the engine module itself is internal.
- Tests intentionally import `buildTrainingDecision` from the engine for behavioral coverage. The static guard scopes are limited to production directories, not `tests/`. This is by design.
- `recommendationDiffEngine.ts` is signal-only after V2. Locking its input contract is deferred to a follow-up because its existing callers are tests, not production surfaces. Captured as residual risk; documented in delivery doc.

End of plan.
