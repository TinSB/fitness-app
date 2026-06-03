# iOS AN-6 — trainingIntelligenceSummaryEngine TOP-LEVEL port + function-level parity (V1)

Status: landed. Track: analytics/insights (AN-1…6). Kind: PURE read-only engine port + function-level parity-pin — the TOP aggregator that CLOSES the analysis engine layer. NOT wired into any UI (that is AN-7). Binding contract: `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` (§11 clean inputs, §19.2 engine-package pure logic + parity goldens, §22 generated-never-hand-edited goldens, §27 milestone registry — AN-6 row).

## 1. Scope

`trainingIntelligenceSummaryEngine.ts` is the top-of-stack aggregator of the analytics/insights track: it CALLs the AN-1~5 leaves (sessionQuality / recommendationConfidence / plateau / volumeAdaptation) over a §11 clean history + an optional latest session + optional opaque summaries, then derives `keyInsights` + `recommendedActions` from their results. Every leaf it consumes was ported in AN-2 / AN-4 / AN-5b (and the cross-module helpers in iOS-17e / SR-1/2). This slice faithfully ports the top aggregator itself and pins it with a generator-produced golden the Swift port COMPUTE-ASSERTS case-by-case. It closes AN-1…6 (the engine layer); nothing is wired into UI and no existing golden changes.

### Ported — `src/engines/trainingIntelligenceSummaryEngine.ts` → `TrainingIntelligenceSummaryEngine.swift`
- `buildTrainingIntelligenceSummary` (`:204`) — the full aggregation: filterAnalyticsHistory → normalLatestSession gate → selectExerciseIds → sessionQuality / recommendationConfidence[] / plateauResults[] / volumeAdaptation → insightCandidates assembly (quality + plateau×2 + volume×2 + confidence×1) → unique/slice(0,4) keyInsights + fallback → buildActions.
- private helpers `unique` (`:68`) / `isNormalSession` (`:70`) / `getExerciseIds` (`:73`) / `exerciseLabelFromHistory` (`:87`) / `selectExerciseIds` (`:96`) / `plateauIsImportant` (`:108`) / `plateauInsight` (`:111`) / `confidenceInsight` (`:121`) / `volumeInsight` (`:127`) / `addAction` (`:135`) / `buildActions` (`:139`); output/input types `TrainingIntelligenceSummary` (`:27`) / `Action` (`:33`) / `BuildTrainingIntelligenceSummaryParams` (`:55`).

### Out of scope (NOT ported)
- The AN-1~5 leaf engines themselves (already ported) and any UI / decision-output wiring (AN-7).

## 2. Reuse — no re-port

Every real call this aggregator makes is to an ALREADY-PORTED engine; nothing is re-ported.

| TS dependency | Reused Swift symbol |
| --- | --- |
| `buildSessionQualityResult` (AN-4) | `SessionQualityEngine.buildSessionQualityResult` |
| `buildRecommendationConfidence` (AN-5b) | `RecommendationConfidenceEngine.buildRecommendationConfidence` |
| `detectExercisePlateau` (AN-2) | `PlateauDetectionEngine.detectExercisePlateau` |
| `buildVolumeAdaptationReport` (AN-5b) | `VolumeAdaptationEngine.buildVolumeAdaptationReport` |
| `formatMuscleName` (AN-5b, volumeInsight fallback) | `VolumeAdaptationEngine.formatMuscleName` |
| `filterAnalyticsHistory` (17e) | `E1RMEngine.filterAnalyticsHistory` |
| `hasInvalidExerciseIdentity` (SR-2, getExerciseIds) | `E1RMEngine.hasInvalidExerciseIdentity` |
| `formatExerciseName(value, fallback='未命名动作')` (formatters.ts:492) | `ExerciseLibrary.formatExerciseDisplayName` (default fallback already "未命名动作"; object form via `ExercisePrescription.encoded()`, string form via `.string(id)`) |
| `SessionQualityResult` / `RecommendationConfidenceResult` / `PlateauDetectionResult` / `VolumeAdaptationReport` types | the AN-4 / AN-5b / AN-2 result types (re-emitted verbatim) |
| `EffectiveVolumeSummary` / `PainPattern` consumed subsets | `PlateauDetectionEngine.EffectiveVolumeSummary` / `.PainPattern` + `PainPatternEngine.PainPattern` |
| `AutoTrainingLevel \| string \| null` | kept as raw `String?` (only passed through to the leaves) |

### Opaque-input fidelity
TS holds the optional external inputs (`effectiveSetSummary` / `loadFeedback` / `painPatterns` / `e1rmProfiles` / `weeklyVolumeSummary`) as runtime duck-typed values and hands the SAME reference to each sub-engine, which read DIFFERENT field subsets off them. The port mirrors this exactly: `Params` carry the raw `JSONValue` / `[JSONValue]`, and this engine converts to the precise typed subset each sub-engine's Swift `Params` demands AT THE CALL SITE — the SAME conversion the sub-engines' own parity tests use (`effectiveVolumeSummary` 3-field decode, `plateauPainPatterns` exerciseId/severityAvg, `fullPainPatterns` full PainPattern, `e1rmProfile` find-by-exerciseId passthrough) — never closing a static type the TS does not assert. `loadFeedback` is `JSONValue?` for ALL four leaves, so it is passed verbatim.

## 3. Zero `: Date`

- The aggregator reads no wall clock. Its only date-sensitive call is the reused `E1RMEngine.filterAnalyticsHistory`, which parses each session's OWN date strings (never the current time). All other ordering/selection is over already-clean inputs.
- No `new Date()` / `Date.now()` / `: Date` / `Calendar` anywhere in the ported path.

## 4. Goldens — generated, never hand-edited (§22)

1 NEW fixture (`tests/fixtures/parity/{inputs,golden}/intelligence-summary/summary-cases-v1.json`), a `cases` array, GENERATED by `scripts/generate-parity-goldens.mjs` (`generateIntelligenceSummary`, registered in `FIXTURE_IDS` + `GENERATORS`). 11 cases jointly cover the summary branches:

- `empty-no-data` (no latest/history → no sessionQuality, empty rec/plateau, empty volumeAdaptation, fallback keyInsight, keep-observing '继续记录训练')
- `high-quality-latest-no-history` (clean latest → sessionQuality `high` insight, NO review-latest action, sparse-history rec→low confidence insight + exerciseLabelFromHistory '平板卧推')
- `low-quality-latest` (poor+pain+incomplete latest → review-latest-session action + quality insight)
- `plateau-history-squat` (5-session flat squat → important plateau → review-exercise action + plateau insight)
- `volume-increase` (weeklyVolumeSummary low ratio → increase → review-volume + create-adjustment-preview actions + volume insight)
- `volume-decrease-heavy` (byMuscle high ratio + loadFeedback too_heavy summary → decrease)
- `volume-hold` (hold → volume insight only, NO review-volume action)
- `pain-combo` (severe painPatterns fed to sessionQuality / plateau / recommendationConfidence / volumeAdaptation)
- `test-flagged-latest` (latest `dataFlag:"test"` → `isNormalSession` false → no sessionQuality, keep-observing '继续记录训练', exerciseIds from history)
- `e1rm-profiles-multi-cap` (e1rmProfiles + multi-exercise latest → `selectExerciseIds` slice(0,4) cap)
- `full-combo` (low latest + plateau history + decrease volume + pain + loadFeedback + e1rmProfiles → review-latest + review-exercise + review-volume + create-adjustment-preview actions + keyInsights slice(0,4) cap)

`TrainingIntelligenceSummaryEngineParityTests.testSummaryCasesParity` decodes each case's echoed engineInput (optional latestSession + history + the opaque inputs), re-runs the PORTED `buildTrainingIntelligenceSummary`, and COMPUTE-ASSERTs the FULL `TrainingIntelligenceSummary` == golden (sessionQuality? + ordered recommendationConfidence[] + plateauResults[] + the volumeAdaptation report + keyInsights + recommendedActions). This is the INTEGRATION pin closing the engine layer: it proves the ported aggregator + its already-pinned AN-1~5 leaves reproduce the TS pipeline end-to-end.

## 5. Drift + count guards

The 72 pre-existing parity goldens regenerate byte-identically (`generated 73 fixture(s); 1 changed` — only the new fixture); the new golden is a pure ADDITION (`git status --short` shows only the new `??` `intelligence-summary/` input + golden dirs; no existing golden under `tests/fixtures/parity/golden/` modified). The parity fixture-count guards (`parityFixturesContract` own-list + `parityFixturesGenerationConsistency` + `iosBootstrapParityStillGreen` + the ten `iosLocal*` / `iosNative*` `--check` guards) bumped **72 → 73** in sync.

## 6. Verification (all green)

- `node scripts/generate-parity-goldens.mjs` → `generated 73 fixture(s); 1 changed` (GEN=0); `--check` → `checked 73 fixture(s); 0 changed` (byte-deterministic).
- `npm run typecheck` → TC=0.
- `npx vitest run` → 7317 passed / 1373 files (ALL=0).
- `swift test --package-path ios/packages/IronPathTrainingDecision` → 244 tests, 0 failures (SW=0); the new `TrainingIntelligenceSummaryEngineParityTests` passes.
- `xcodebuild … -scheme IronPath … build` → ** BUILD SUCCEEDED ** (XC=0).
- `git diff --check` clean; `project.pbxproj` / `package.json` / `package-lock.json` / `Package.swift` / `.claude` byte-unchanged.

## 7. Boundary / safety

PURE read-only — no IO, no wall clock, no randomness; consumes `[TrainingSession]` history (a §11 clean input) + an optional latest session + optional opaque summaries. SPM-auto-included (no `project.pbxproj` touch). No write path, no `CanonicalSessionWriter` / source-of-truth touch; the AN-1~5 leaves + cross-module helpers + consumed-input types are all reused (no re-port) — only the top aggregator + its private helpers + its three types are added. This closes the AN-1…6 analytics/insights engine layer; the only remaining analytics work is the AN-7 UI wiring. **Source-of-truth impact: none. Data-safety impact: none.**
