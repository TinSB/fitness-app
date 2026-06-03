# iOS AN-5b — recommendationConfidenceEngine + volumeAdaptationEngine port + function-level parity (V1)

Status: landed. Track: analytics/insights (AN-1…6). Kind: PURE read-only engine port + function-level parity-pin. NOT wired into any UI (that is AN-6/AN-7). Binding contract: `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` (§11 clean inputs, §19.2 engine-package pure logic + parity goldens, §22 generated-never-hand-edited goldens, §27 milestone registry — AN-5b row).

## 1. Scope

The AN-6 top-level `intelligenceSummary` (`trainingIntelligenceSummaryEngine.ts:225` `recommendationConfidence` + `:246` `buildVolumeAdaptationReport`) CALLs two leaf engines that were the only AN-6 leaves still unported. This slice faithfully ports both to Swift in `IronPathTrainingDecision` and pins each with a generator-produced golden the Swift port COMPUTE-ASSERTS case-by-case. Both are leaves (every dependency already ported); nothing is wired into UI and no existing golden changes.

### Ported — `src/engines/recommendationConfidenceEngine.ts` → `RecommendationConfidenceEngine.swift`
- `buildRecommendationConfidence` (`:220`) — every reason / score / level / summary / missingData branch.
- private helpers `clampScore` / `reason` / `getExerciseIds` / `exerciseMatches` / `relevantSessions` / `relevantSets` / `buildTechniqueSummaryFromSets` / `isLoadFeedbackSummary` / `normalizeLoadFeedback` / `resolveCurrentE1rm` / `countRecentEdits` / `hasRecentReplacement` / `hasMixedUnitsWithSparseHistory` / `levelFromScore` / `levelLabel`; output/input types `RecommendationConfidenceLevel` / `RecommendationConfidenceReason` / `RecommendationConfidenceResult` / `BuildRecommendationConfidenceParams`.

### Ported — `src/engines/volumeAdaptationEngine.ts` → `VolumeAdaptationEngine.swift`
- `buildVolumeAdaptationReport` (`:268`) — every decision (increase / maintain / decrease / hold / insufficient_data) + confidence band + summaryParts branch.
- private helpers `clamp` / `roundOne`(reused) / `normalizeText` / `decisionLabel` / `normalizeWeeklyRows` / `isLoadFeedbackSummary` / `normalizeLoadFeedback` / `hasPainRisk` / `qualitySummary` / `evidenceRatio` / `volumeIsLow` / `volumeIsNearTarget` / `volumeIsHigh` / `increaseDelta` / `decreaseDelta` / `confidenceFor` / `buildDecision`; output/input types `VolumeAdaptationDecision` / `MuscleVolumeAdaptation` / `VolumeAdaptationReport` / `BuildVolumeAdaptationReportParams` + the internal `NormalizedMuscleVolume`.

### Ported — `src/i18n/formatters.ts` (the ONE non-engine helper volumeAdaptation reads)
- `formatMuscleName` (`:219`) + its `lookupLabel` STRING-path (`:35-60`) / `normalizeDisplayKey` (`:27-33`) / `MUSCLE_LABELS` (`:102-122`). Grep confirmed NO equivalent exists in the package — `AnalyticsDashboardEngine` sets `muscleName = muscleId` verbatim and never localizes — so it is faithfully ported here (the `normalizeDisplayKey` / `regexReplaceAll` privates follow the per-engine convention `ReplacementEngine` / `SmartReplacementEngine` already use; only the SHARED `ExerciseLibrary.hasChineseText` is reused).

### Out of scope (NOT ported)
- `completedTrainingSets` (`recommendationConfidenceEngine.ts:70`) — DEAD in the TS source (defined but never reached from `buildRecommendationConfidence`), so not ported.
- The AN-6 `trainingIntelligenceSummaryEngine` top-level itself + any UI wiring.

## 2. Reuse — no re-port

| TS dependency | Reused Swift symbol |
| --- | --- |
| `engineUtils.number` | `E1RMEngine.number` |
| `engineUtils.completedSets` | `E1RMEngine.completedSets` |
| `sessionHistoryEngine.filterAnalyticsHistory` (17e) | `E1RMEngine.filterAnalyticsHistory` |
| `LoadFeedbackValue` canonical values (17e-4) | `LoadFeedbackEngine.{tooHeavy,tooLight,good}` |
| `TechniqueQualitySummary` type (trainingLevel import) | `PlateauDetectionEngine.TechniqueQualitySummary` (typealiased — NOT redefined) |
| `Partial<EffectiveVolumeSummary>` consumed subset | `PlateauDetectionEngine.EffectiveVolumeSummary` (typealiased — same 3 fields) |
| `PainPattern` type (AN-5) | `PainPatternEngine.PainPattern` / `PainSuggestedAction` (canonical) |
| `SessionQualityResult` type (AN-4) | `SessionQualityEngine.SessionQualityResult` (+ its signals) |
| `AutoTrainingLevel` (AN-5) | kept as raw `String?` (engine only `=== 'unknown'` / `'beginner'` compares it) |
| `analytics.roundOne` (AN-3) | `AnalyticsDashboardEngine.roundOne` |
| `${number}` interpolation | `AnalyticsDashboardEngine.jsNumberString` |
| `formatMuscleName` CJK probe | `ExerciseLibrary.hasChineseText` |

The optional external inputs `e1rmProfile` (`E1RMProfile | EstimatedOneRepMax | null`) / `loadFeedback` (`LoadFeedbackInput`) / `recentEdits` (`RecentEditInput`) for recommendationConfidence, and `weeklyVolumeSummary` (`WeeklyVolumeItem[] | { muscles }`) / `effectiveSetSummary` (`Partial<…>`, read as `byMuscle?.[muscleId]`) / `adherenceReport` (`Partial<AdherenceReport>`) / `loadFeedback` for volumeAdaptation, are genuine TS runtime UNIONS consumed by DUCK-TYPING — kept as raw `JSONValue?` and structurally re-discriminated (the AN-2 `PlateauDetectionEngine` precedent), never forced into a static type.

## 3. Zero `: Date`

- Neither engine reads the wall clock. recommendationConfidence's only ordering is `relevantSessions`' `localeCompare`-descending over the session's OWN `finishedAt || startedAt || date` keys, reproduced with `>` over ASCII ISO strings (the `PlateauDetectionEngine` precedent). volumeAdaptation consumes only opaque summaries (no history, no dates).
- No `new Date()` / `Date.now()` / `: Date` / `Calendar` anywhere in either ported path. `clampScore`'s `Math.round` reuses `AnalyticsSupport.jsMathRound`; `roundOne` reuses `AnalyticsDashboardEngine.roundOne`.

## 4. Goldens — generated, never hand-edited (§22)

2 NEW fixtures (`tests/fixtures/parity/{inputs,golden}/`), each a `cases` array, GENERATED by `scripts/generate-parity-goldens.mjs` (`generateRecommendationConfidence` / `generateVolumeAdaptation`, registered in `FIXTURE_IDS` + `GENERATORS`):

- `recommendation-confidence/assessment-cases-v1` (11 cases) — buildRecommendationConfidence: the level bands (forced-low ≤1 session [incl. one where score 86 but level still low] / high / medium-plain) + every reason branch (history sparse-0/sparse-1/stable/building · technique missing/stable/poor · rir missing/complete/incomplete · pain-pattern/no-pain · load-feedback volatile/stable-good-dominant/stable-other/total-0 · e1rm high-quality/low-confidence/medium/absent · effective-sets stable/weak · recent-replacement · recent-edits + the 92 cap · mixed-units-sparse · training-baseline unknown/beginner) + the pain 74 cap + every missingData string + the loadFeedback array/summary-object/record-of-values + recentEdits number/array union shapes + session.loadFeedback exerciseId-filter + the no-exerciseId match-all path. PURE / clockless apart from history dates derived from `parityMeta.deterministicClockIso`.
- `volume-adaptation/report-cases-v1` (10 cases) — buildVolumeAdaptationReport: every decision (insufficient_data no-evidence + dataSparse · hold trainingLevelUnknown + final-inconsistent · decrease volumeHigh + strongRisk-multi-reason · increase volumeLow · maintain nearTarget) + the confidence bands (low/medium/high) + formatMuscleName (mapped 胸/股四头肌/腘绳肌/背 · unmapped 'forearms'→未标注肌群 · row.muscleName override · CJK '腿' passthrough · `byMuscle` lookup) + the `weeklyVolumeSummary` array vs `{muscles}` shapes + the `muscle`-alias key + the multi-muscle summaryParts join. PURE / clockless (`generatedAtPolicy: "none"`).

`RecommendationConfidenceEngineParityTests` / `VolumeAdaptationEngineParityTests` decode each case's echoed engineInput, re-run the PORTED functions, and COMPUTE-ASSERT the full result == golden (RecommendationConfidenceResult level/score/title/summary + ordered reasons + missingData · VolumeAdaptationReport ordered muscles muscleId/decision/setsDelta/title/reason/confidence/ordered suggestedActions + summary).

## 5. Drift + count guards

The 70 pre-existing parity goldens regenerate byte-identically (`generated 72 fixture(s); 2 changed`); the 2 new goldens are pure ADDITIONS (no existing golden under `tests/fixtures/parity/golden/` modified — `git status --short` shows only the two new `??` dirs). The parity fixture-count guards (`parityFixturesContract` own-list + `parityFixturesGenerationConsistency` + `iosBootstrapParityStillGreen` + the ten `iosLocal*` / `iosNative*` `--check` guards) bumped **70 → 72** in sync.

## 6. Verification (all green)

- `node scripts/generate-parity-goldens.mjs` → `generated 72 fixture(s); 2 changed` (GEN=0).
- `npm run typecheck` → TC=0.
- `npx vitest run` → 7310 passed / 1373 files (ALL=0).
- `swift test --package-path ios/packages/IronPathTrainingDecision` → 243 tests, 0 failures (SW=0); the two new `*ParityTests` pass.
- `xcodebuild … -scheme IronPath … build` → ** BUILD SUCCEEDED ** (XC=0).
- `git diff --check` clean; `project.pbxproj` / `package.json` / `package-lock.json` / `Package.swift` / `.claude` byte-unchanged.

## 7. Boundary / safety

PURE read-only — no IO, no wall clock, no randomness; recommendationConfidence consumes `[TrainingSession]` history (a §11 clean input) + optional external summaries, volumeAdaptation consumes only opaque summaries. SPM-auto-included (no `project.pbxproj` touch). No write path, no `CanonicalSessionWriter` / source-of-truth touch; already-ported helpers + the AN-2 `TechniqueQualitySummary` / `EffectiveVolumeSummary` types + the AN-5 `PainPatternEngine.PainPattern` + the AN-4 `SessionQualityEngine.SessionQualityResult` reused (no re-port); only these two engines + `formatMuscleName` ported. **Source-of-truth impact: none. Data-safety impact: none.**
