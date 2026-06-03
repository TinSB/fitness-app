# iOS AN-4 — sessionDetailSummaryEngine (sessionQuality-consumed subset) + sessionQualityEngine port + function-level parity (V1)

Status: landed. Track: analytics/insights (AN-1…6). Kind: PURE read-only engine port + function-level parity-pin. NOT wired into any UI (that is AN-7). Binding contract: `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` (§11 clean inputs, §19.2 engine-package pure logic + parity goldens, §22 generated-never-hand-edited goldens, §27 milestone registry — AN-4 row).

## 1. Scope

Faithfully ports `buildSessionQualityResult` (`src/engines/sessionQualityEngine.ts:122`) + the TWO `sessionDetailSummaryEngine.ts` functions it CALLs to Swift in `IronPathTrainingDecision`, and pins each with a generator-produced golden the Swift port COMPUTE-ASSERTS case-by-case.

### Ported — `src/engines/sessionDetailSummaryEngine.ts` (the sessionQuality-consumed subset) → `SessionDetailSummaryEngine.swift`
- `groupSessionSetsByType` (`:154`) — the per-exercise warmup/working/uncategorized grouping + focusWarmup merge.
- `buildWorkingOnlySession` (`:218`) — the `{ ...session, dataFlag:'normal', focusWarmupSetLogs:[], exercises:<working-only> }` clone.
- private helpers `setTypeText` (`:84`) / `exerciseIdentity` (`:94`) / `parseWarmupExerciseId` (`:101`) / `classifySet` (`:108`) + the `WORKING_SET_TYPES` / `SUPPORT_SET_TYPES` constants (`:81/82`); grouping types `SessionSetCategory` / `SessionSetEntry` / `SessionExerciseSetGroup` / `GroupedSessionSets` (`:9/11/21/29`).

### Ported — `src/engines/sessionQualityEngine.ts` → `SessionQualityEngine.swift`
- `buildSessionQualityResult` (`:122`) — every level/signal/confidence/score-cap branch.
- private helpers `clamp` / `roundScore` / `isRecordedCompletedSet` / `hasRecordedRir` / `levelLabel` / `dataFlagLabel` / `isLoadFeedbackSummary` / `normalizeLoadFeedback` / `makeSignal` / `unique` (`:52-120`); output/input types `SessionQualityLevel` / `SessionQualitySignal` / `SessionQualityResult` / `LoadFeedbackInput` / `BuildSessionQualityParams` (`:16-50`).
- `engineUtils.isIncompleteSet` (`engineUtils.ts:95`) — no prior ported engine needed it, ported IN PLACE beside its sibling `E1RMEngine.isCompletedSet`.

### Out of scope (NOT ported — NOT CALLed by sessionQuality)
- `sessionDetailSummaryEngine.ts`: `buildSessionDetailSummary` (`:244`) + `getSessionWarmupSets` / `getSessionWorkingSets` / `getSessionSupportSets` (`:212/214/216`) + `withStrictCompletionState` (`:231`) + the display helpers (`isCompletedDisplaySet` / `completedVolume` / `completedCount` / `incompleteCount` / `excludedFromStatsReason` / `effectiveGapReasons`) + the `SessionDetailSummary` type + the `effectiveSetExplanationEngine` / `unitConversionEngine` / `i18n/formatters` cross-calls. `buildSessionQualityResult` references NONE of them.
- `AN-5`+ engines / `AN-7` UI wiring. `BuildSessionQualityParams.unitSettings` is UNUSED by `buildSessionQualityResult` and omitted.

## 2. Reuse — no re-port

| TS dependency | Reused Swift symbol |
|---|---|
| `sessionDetailSummaryEngine.{groupSessionSetsByType,buildWorkingOnlySession}` | `SessionDetailSummaryEngine.{groupSessionSetsByType,buildWorkingOnlySession}` (this slice) |
| `effectiveSetEngine.buildEffectiveVolumeSummary` | `EffectiveSetEngine.buildEffectiveVolumeSummary` (AN-3) |
| `engineUtils.{completedSets,isCompletedSet,number,setWeightKg}` | `E1RMEngine.{completedSets,isCompletedSet,number,setWeightKg}` |
| `replacementEngine.hasInvalidExerciseIdentity` | `E1RMEngine.hasInvalidExerciseIdentity` |
| `Math.round(clamp(x))` | `AnalyticsSupport.jsMathRound` (JS `Math.round` = `floor(x+0.5)`) |
| `loadFeedbackEngine.LoadFeedbackSummary` (duck-typed) | consumed structurally as raw `JSONValue` (AN-2 `normalizeLoadFeedback` precedent), never forced into the static type |

`engineUtils.isIncompleteSet` is the only newly-needed helper; ported in place (a small pure sibling of the already-ported `isCompletedSet`).

## 3. Runtime-union inputs — duck-typed, not coerced

`buildSessionQualityResult`'s external params are genuine TS runtime unions consumed by duck-typing — they are kept as raw `JSONValue` and re-discriminated exactly as the TS does (the AN-2 plateau precedent):
- `loadFeedback: LoadFeedback[] | LoadFeedbackSummary | LoadFeedbackSummary[] | Record<string, LoadFeedbackSummary | LoadFeedbackValue> | null` → `normalizeLoadFeedback` dispatches on `Array.isArray` → `'feedback' in item` (LoadFeedback) vs summary; `isLoadFeedbackSummary` (`'counts' in v && 'adjustment' in v`); else `Object.values` (string `LoadFeedbackValue` vs summary). `session.loadFeedback` is always folded in first.
- `effectiveSetSummary?: Partial<EffectiveVolumeSummary> | null` → JS `||` truthy: a provided (non-null) summary wins and its `effectiveSets` / `highConfidenceEffectiveSets` / `completedSets` are read via `number(...)`; else `buildEffectiveVolumeSummary([buildWorkingOnlySession(session)])` is computed.
- `painPatterns?: PainPattern[]` → raw objects; matched by `exerciseId ∈ exerciseIds || severityAvg >= 3.5`.

## 4. Zero `: Date`

Every ported function is clockless: `buildSessionQualityResult` and the two `sessionDetailSummaryEngine` functions never read the wall clock (no `new Date()` / `Date.now()` in their paths). The Swift port reproduces every set-state / identity / scoring decision over the session's OWN fields — no `Date()` / `Calendar`. The open-bag `type` rewrites (`{ ...set, type: 'warmup' }`, `{ ...set, type: type || 'straight' }`, focusWarmup `done: set.done === true`) mirror the TS object spreads via encode→set-key→decode on the full JSON shape.

## 5. Goldens — generated, never hand-edited (§22)

2 NEW fixtures (each a `cases` array), GENERATED via `scripts/generate-parity-goldens.mjs` → `generateSessionQuality` (routed both ids). Each case materialises a synthetic session via the shared `materializeAnalyticsSession` (ONLY date fields derive from `deterministicClockIso`; every other field passes through verbatim), runs the REAL `buildSessionQualityResult`, and echoes BOTH the engineInput and the result PLUS `grouped` / `workingOnly` structural probes for the two CALLed `sessionDetailSummaryEngine` functions:

- `session-quality/quality-cases-v1` — `buildSessionQualityResult` level/signal/confidence/cap branches: insufficient-data-warmup-only (`totalCompletedSets<=0` early return + warmup-visible positive) / high-clean-4sets (mainCompletion≥0.9 + effective-quality + technique-good + confidence high) / medium-incomplete-cap72 (mainCompletion 0.5 → main-completion-low + skipped cap 72 + main-incomplete + confidence medium) / low-mostly-incomplete-cap55 (mainCompletion<0.5 cap 55 + completed<2 confidence low) / degraded-pain-poor-abnormal-missingrir (effective-quality-low + pain-flag + poor-technique + rir-missing + abnormal-input + safetyScore + confidence low + 3 nextSuggestions).
- `session-quality/grouping-and-input-cases-v1` — `groupSessionSetsByType` classification (working via `type`/`setType`/`stepType`/inferred · warmup via `type`/`isWarmup`/`:warmup:`-id · support+corrective→uncategorized + the warmup `type` rewrite) · `buildWorkingOnlySession` reconstruction (dataFlag→normal · focusWarmup cleared · set `type` → straight) · focusWarmup merge+dedup (`parseWarmupExerciseId` explicit + `:warmup:`-prefix + `byIdentity` fallback + dedup by `set.id` + strict `done`) · number-form `sets` plannedWorkingSets · `supportExerciseLogs` passthrough + supportSkipped · `normalizeLoadFeedback` array / summary-object / record-of-values / `session.loadFeedback` · painPatterns `exerciseId` match · provided `effectiveSetSummary` override + `earlyEndReason` cap+issue · `dataFlag: test` cap 82 + data-flag issue + `buildWorkingOnlySession` dataFlag→normal effective compute.

Swift `SessionQualityEngineParityTests` decodes each case's echoed engineInput, re-runs the PORTED functions, and COMPUTE-ASSERTS: `buildSessionQualityResult` == golden `result` (full `SessionQualityResult` `==`) + `groupSessionSetsByType` == golden `grouped` probe (counts + per-group counts + post-classification `set.type` lists, nulls preserved) + `buildWorkingOnlySession` == golden `workingOnly` probe (dataFlag / focusWarmup cleared / per-exercise set-type defaulting).

## 6. Drift + count guards

- `node scripts/generate-parity-goldens.mjs` → `generated 68 fixture(s); 2 changed` (only the 2 new); a re-run prints `0 changed` (idempotent). The 66 pre-existing goldens regenerate byte-identically — `git diff --diff-filter=M -- tests/fixtures/parity` empty; the 2 new goldens are `--diff-filter=A`.
- Parity fixture-count guards bumped **66 → 68** in sync: `parityFixturesContract` (own `FIXTURE_IDS` + inventory title), `parityFixturesGenerationConsistency` (`checked 68`), `iosBootstrapParityStillGreen`, and the ten `iosLocal*` / `iosNative*` `--check` guards.

## 7. Verification (all green)

- `node scripts/generate-parity-goldens.mjs` → `generated 68 fixture(s); 2 changed` (existing zero drift, new additive; re-run `0 changed`).
- `npm run typecheck` → 0.
- `npx vitest run` → 1373 files / 7282 tests pass.
- `swift test --package-path ios/packages/IronPathTrainingDecision` → 239 tests pass (incl. the 2 AN-4 parity cases).
- `xcodebuild … build` → `** BUILD SUCCEEDED **`.
- `git diff --check` clean; `project.pbxproj` / lockfile / `Package.swift` / `package.json` byte-unchanged.

## 8. Boundary / safety

PURE engine — consumes a single `TrainingSession` (§11 clean input) + optional external summaries; no IO, no randomness, zero `: Date`. No write path, no `CanonicalSessionWriter`, no source-of-truth touch. Only the CALLed `sessionDetailSummaryEngine` subset is ported (`buildSessionDetailSummary` and the display/explanation re-exports are NOT). SPM-auto-included (no `project.pbxproj` / `Package.swift` / deps / lockfile change). Source-of-truth impact: none (no engine-output change, no write path; §8/§11 semantics unchanged). Data-safety impact: none.
