# iOS AN-5 — painPatternEngine (trainingLevel-consumed subset) + trainingLevelEngine port + function-level parity (V1)

Status: landed. Track: analytics/insights (AN-1…6). Kind: PURE read-only engine port + function-level parity-pin. NOT wired into any UI (that is AN-7). Binding contract: `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` (§11 clean inputs, §19.2 engine-package pure logic + parity goldens, §22 generated-never-hand-edited goldens, §27 milestone registry — AN-5 row).

## 1. Scope

Faithfully ports the auto-training-level assessment chain — `buildTrainingLevelAssessment` and the ONE painPattern function it CALLs (`buildPainPatterns`) — to Swift in `IronPathTrainingDecision`, and pins each with a generator-produced golden the Swift port COMPUTE-ASSERTS case-by-case.

### Ported — `src/engines/painPatternEngine.ts` (the trainingLevel-consumed subset) → `PainPatternEngine.swift`
- `buildPainPatterns` (`:58`) — the per-area / per-exercise pain aggregation + the multi-area combined pattern + the severityAvg-desc / frequency-desc stable sort.
- private helpers `recentNormalSessions` (`:31`) / `painSeverityFromSet` (`:51`) / `sessionSortKey` (`:23`) / `toTime` (`:25`) / `excludedFlags` (`:18`); types `PainPattern` / `PainSuggestedAction` (the FULL canonical shape, `training-model.ts:1028/151`) + `BuildPainPatternsOptions` (`:12`) + the `PainAccumulator` tally (`:4`).

### Ported — `src/engines/trainingLevelEngine.ts` → `TrainingLevelEngine.swift`
- `buildTrainingLevelAssessment` (`:150`) — every level band + signal + limitation + readiness branch.
- `buildTechniqueQualitySummary` (`:94`) / `formatAutoTrainingLevel` (`:78`).
- private helpers `clampScore` / `signal` / `levelLabels` / `confidenceFromSessionCount` / `uniqueExerciseIds` / `buildFallbackE1RMProfiles` / `buildFrequencyScore` (`:61-148`); output/input types `AutoTrainingLevel` / `TrainingLevelSignal` / `ReadinessForAdvancedFeatures` / `TrainingLevelAssessment` / `Params` (`:18-59`).

### Out of scope (NOT ported)
- `painPatternEngine.ts`: `getExercisePainPattern` (`:142`) — read by `exercisePrescriptionEngine`, NOT by trainingLevel. Out of the trainingLevel-consumed subset.
- `trainingLevelEngine.ts`: `e1rmConfidenceScore` (`:119`) — DEAD in the TS source (defined but never CALLed; the sole reader of `EstimateConfidence`), so neither it nor `EstimateConfidence` is ported.
- `TrainingCalendarData` (`trainingCalendarEngine.ts`) — modelled **TYPE-ONLY** (the single `weeklyFrequency[].sessionCount` field `buildFrequencyScore` reads); the calendar ENGINE is NOT ported. The real call sites (`sessionBuilder` / `trainingDecisionContext`) never pass `calendarData`, so the own-history week-bucketing `||` fallback is the live path.
- `AN-6`/`AN-7` UI wiring.

## 2. Reuse — no re-port

| TS dependency | Reused Swift symbol |
| --- | --- |
| `analytics.buildAdherenceReport` (AN-3) | `AnalyticsDashboardEngine.buildAdherenceReport` |
| `e1rmEngine.buildE1RMProfile` (17e-1) | `E1RMEngine.buildE1RMProfile` |
| `effectiveSetEngine.buildEffectiveVolumeSummary` (AN-3) | `EffectiveSetEngine.buildEffectiveVolumeSummary` |
| `engineUtils.completedSets` / `number` | `E1RMEngine.completedSets` / `E1RMEngine.number` |
| `sessionHistoryEngine.filterAnalyticsHistory` (17e) | `E1RMEngine.filterAnalyticsHistory` |
| `TechniqueQualitySummary` type (AN-2) | `PlateauDetectionEngine.TechniqueQualitySummary` (typealiased — NOT redefined) |
| `new Date().getTime()` / week-bucketing (AN-1 civil) | `AnalyticsSupport.{daysFromCivil,civilFromDays,weekdayFromDays,jsMathRound}` |
| `${number}` interpolation | `AnalyticsDashboardEngine.jsNumberString` |

`PainPattern` is ported as the FULL canonical 6-field type — this slice is its first full port; the AN-2 `PlateauDetectionEngine.PainPattern` / `SmartReplacementPainPattern` partial subsets are left untouched.

## 3. Zero `: Date`

- `painPatternEngine.toTime` (`new Date(value).getTime()`) → integer civil-day + time-of-day arithmetic over `AnalyticsSupport.daysFromCivil` (date-only → UTC midnight; full `…Z` ISO → exact UTC instant — the only §11/fixture shapes).
- `trainingLevelEngine.buildFrequencyScore`'s `new Date(\`${date}T00:00:00\`).getDay()` Monday-week bucketing → `weekdayFromDays` (= `getDay`/`getUTCDay`) + `civilFromDays`. The week-bucket KEY is a Map grouping handle only (never output); the grouping is by civil week regardless of timezone, so the resulting per-week counts — hence `average`/`score` — are timezone-independent.
- The `frequency.average.toFixed(1)` reason interpolation uses a FAITHFUL `toFixed(1)` (round-half-away on the EXACT `%.340f` decimal), NOT `String(format:"%.1f")` (which rounds half-to-even: `(2.25).toFixed(1) === "2.3"`, not "2.2"). Proven by the `calendar-frequency-override` golden (avg 4.25 → "4.3").
- No `new Date()` / `Date.now()` anywhere in either ported path. (`buildPainPatterns`'s only "clock" is the OPTIONAL injected `options.currentDate`; with no option — the trainingLevel call — the anchor is the most-recent session's own date string.)

## 4. Goldens — generated, never hand-edited (§22)

2 NEW fixtures (`tests/fixtures/parity/{inputs,golden}/`), each a `cases` array, GENERATED by `scripts/generate-parity-goldens.mjs` (`generatePainPattern` / `generateTrainingLevel`, registered in `FIXTURE_IDS` + `GENERATORS`):

- `pain-pattern/aggregation-cases-v1` (10 cases) — buildPainPatterns: exercise watch/substitute/deload · area watch/deload/seek_professional (incl. the freq≥6 area-before-exercise tiebreak) · multi-area `' / '` combined · painSeverityFromSet (painSeverity>0 / `/sharp|刺痛|剧烈/`→4 / `/ache|酸|不适/`→2 / default 2) · 30-day lookback exclusion · maxSessions slice + explicit currentDate anchor · test+excluded dataFlag filter · empty.
- `training-level/assessment-cases-v1` (12 cases) — buildTrainingLevelAssessment all five level bands (unknown count 0/≤2 · beginner · novice_plus · intermediate · advanced) + every signal name/score/confidence/reason + highPain/poorTechnique/lowAdherence/unstableFrequency limitations & downgrades + readinessForAdvancedFeatures + nextDataNeeded + the painPatterns/techniqueQualitySummary/calendarData provided-vs-computed short-circuit; each case echoes a `buildTechniqueQualitySummary` + `formatAutoTrainingLevel` probe.

`PainPatternEngineParityTests` / `TrainingLevelEngineParityTests` decode each case's echoed engineInput, re-run the PORTED functions, and COMPUTE-ASSERT the full result == golden (ordered `[PainPattern]` · `TrainingLevelAssessment` + technique-summary + level-label probes).

## 5. Drift + count guards

The 68 pre-existing parity goldens regenerate byte-identically (`generated 70 fixture(s); 2 changed`); the 2 new goldens are pure ADDITIONS (`git diff --diff-filter=MD origin/main -- tests/fixtures/parity` empty; existing decision / SR / e1rm / 17e / AN-1 / AN-2 / AN-3 / AN-4 goldens byte-unchanged). The parity fixture-count guards (`parityFixturesContract` own-list + `parityFixturesGenerationConsistency` + `iosBootstrapParityStillGreen` + the ten `iosLocal*` / `iosNative*` `--check` guards) bumped **68 → 70** in sync.

## 6. Verification (all green)

- `node scripts/generate-parity-goldens.mjs` → `generated 70 fixture(s); 2 changed` (GEN=0).
- `npm run typecheck` → TC=0.
- `npx vitest run` → 7296 passed / 1373 files (ALL=0).
- `swift test --package-path ios/packages/IronPathTrainingDecision` → 241 tests, 0 failures (SW=0); the two new `*ParityTests` pass.
- `xcodebuild … -scheme IronPath … build` → ** BUILD SUCCEEDED ** (XC=0).
- `git diff --check` clean; `project.pbxproj` / `package.json` / `package-lock.json` / `Package.swift` / `.claude` byte-unchanged.

## 7. Boundary / safety

PURE read-only — no IO, no wall clock, no randomness; consumes `[TrainingSession]` history (a §11 clean input) + optional external summaries. SPM-auto-included (no `project.pbxproj` touch). No write path, no `CanonicalSessionWriter` / source-of-truth touch; already-ported helpers + the AN-2 `TechniqueQualitySummary` type reused (no re-port); only the trainingLevel-CALLed painPattern subset ported, `TrainingCalendarData` type-only. **Source-of-truth impact: none. Data-safety impact: none.**
