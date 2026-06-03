# iOS AN-3 — effectiveSetEngine (analytics-consumed subset) + analytics.ts dashboard port + function-level parity (V1)

Status: landed. Track: analytics/insights (AN-1…6). Kind: PURE read-only engine port + function-level parity-pin. NOT wired into any UI (that is AN-6/AN-7). Binding contract: `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` (§11 clean inputs, §19.2 engine-package pure logic + parity goldens, §22 generated-never-hand-edited goldens, §27 milestone registry — AN-3 row).

## 1. Scope

Faithfully ports the effective-set functions `analytics.ts` (and the wider analytics track) CALLs, plus the analytics dashboard exports, to Swift in `IronPathTrainingDecision`, and pins each function with a generator-produced golden that the Swift port COMPUTE-ASSERTS case-by-case.

### Ported — `src/engines/effectiveSetEngine.ts` (the analytics-consumed subset) → `EffectiveSetEngine.swift`
- `evaluateEffectiveSet` (`:7`) — every flag/score/confidence branch.
- `countEffectiveSets` (`:104`).
- `getMuscleContribution` (`:116`).
- `buildEffectiveVolumeSummary` (`:141`).
- private helpers `clampScore` (`:5`) / `emptyMuscleSummary` (`:130`); output types `EffectiveSetResult` / `EffectiveVolumeSummary` (`training-model.ts:1250/1258`).

### Ported — `src/engines/analytics.ts` (all CALLed exports) → `AnalyticsDashboardEngine.swift`
- `buildMuscleVolumeDashboard` (`:112`), `buildExerciseTrend` (`:152`), `trendStatus` (`:178`), `buildPrs` (`:188`), `buildWeeklyReport` (`:293`), `buildAdherenceReport` (`:406`), `CORE_TREND_EXERCISES` (`:84`).
- private helpers `ratio` / `analyticsHistory` / `incrementReason` / `mostCommonReason` / `setCountForExercise` / `supportPlannedFromBlock` / `recordQualityForSet` / `combineRecordQuality` / `completedHighQualitySets` / `roundOne` / `getVolumeStatus` / `buildVolumeNotes`.
- the `engineUtils` helpers no prior engine needed (`getSecondaryMuscles` / `sessionVolume` / `sessionCompletedSets` / `exerciseVolume`) ported IN PLACE.

### Out of scope (NOT ported)
- `analytics.ts`: `makeCsv` / `downloadText` (DOM/Blob — UI), `buildMonthStats` / `buildRecentSessionBars` (not CALLed by the analytics track + non-injectable `new Date()`).
- `effectiveSetEngine.ts:214-223` `effectiveSetExplanationEngine` re-exports (not analytics-consumed).
- `AN-5` trainingLevel / `AN-6/AN-7` UI wiring.

## 2. Reuse — no re-port

The ported functions REUSE the already-ported equivalents rather than re-transcribing them:

| TS dependency | Reused Swift symbol |
|---|---|
| `engineUtils.number` / `isCompletedSet` / `completedSets` | `E1RMEngine.number` / `isCompletedSet` / `completedSets` |
| `replacementEngine.hasInvalidExerciseIdentity` | `E1RMEngine.hasInvalidExerciseIdentity` |
| `e1rmEngine.getExerciseRecordPoolId` / `buildE1RMProfile` | `E1RMEngine.getExerciseRecordPoolId` / `buildE1RMProfile` |
| `analytics.analyticsHistory` (dataFlag-only filter) | `E1RMEngine.isAnalyticsSession` (byte-identical predicate) |
| `new Date(value)` parse (weekly window) | `E1RMEngine.safeDateMs` (widened `private`→internal — a reuse-enabling visibility change, NOT a re-port) |
| `engineUtils.getPrimaryMuscles` / `setVolume` | `AnalyticsSupport.getPrimaryMuscles` / `setVolume` |
| `Math.round(x)` / `Math.round(x*10)/10` | `AnalyticsSupport.jsMathRound` (the JS `Math.round` = `floor(x+0.5)`; the analytics rounding uses multiply-then-round, NOT `toFixed`, so AN-1b `roundToFixed` is not needed here) |
| `i18n/formatters.formatExerciseName` | `ExerciseLibrary.formatExerciseDisplayName(exercise.encoded(), bilingual: false, fallback: "未命名动作")` |

## 3. Zero `: Date` — the `buildWeeklyReport` injected-clock seam

`buildWeeklyReport` is the ONLY in-scope function with a wall clock (`const now = new Date(); start = now − 7d; sessions.filter(new Date(session.date) >= start)`), which makes a deterministic golden impossible without injecting the clock. Resolution (the AN-1 `options.nowIso || new Date()` / iOS-17e-6a injected-`asOfDate` precedent):

- **TS seam (minimal, backward-compatible):** `buildWeeklyReport(history, bodyWeights, options?: { nowIso?: string })`. The live UI call site (`ProgressView.tsx:242`, 2-arg) is byte-unchanged and still wall-clock. When `options.nowIso` is injected, `start = new Date(now.getTime() - 7 * 86_400_000)` (exact UTC ms arithmetic).
- **Generator:** passes `nowIso = parityMeta.deterministicClockIso`, so the golden is byte-deterministic.
- **Swift port:** REQUIRES an injected `asOfDate` (zero `: Date`); reproduces the window as `start = E1RMEngine.safeDateMs(asOfDate) − 7·86_400_000` and `E1RMEngine.safeDateMs(session.date) >= start` — the exact `new Date(value)` semantics (bare date → UTC midnight, full ISO → instant), never `Date()` / `Calendar`.

Every other in-scope function is clockless (date comparisons are over the session's OWN date strings).

## 4. Goldens — generated, never hand-edited (§22)

7 NEW fixtures (each a `cases` array), GENERATED via `scripts/generate-parity-goldens.mjs` (`parityGoldensEntry.ts` `generateEffectiveSetEvaluate` / `generateEffectiveSetVolume` / `generateMuscleVolumeDashboard` / `generateExerciseTrend` / `generatePrs` / `generateWeeklyReport` / `generateAdherenceReport`). Each case echoes its engineInput (a synthetic history materialised from a verbatim spec — only `date`/`startedAt`/`finishedAt` derive from `deterministicClockIso`) + the REAL TS function output:

- `effective-set/evaluate-cases-v1` — evaluateEffectiveSet: identity-invalid (exercise + set) / warmup / incomplete (not-done + zero-weight + zero-reps) / poor_technique / pain / unknown_rir (empty + undefined) / too_easy (rir≥5 + rir==4) / valid_effort (rir 1-3) / near-failure else (rir==0 + rir==null→0) / below-repMin (exercise.repMin + context.plannedReps) / combined-low.
- `effective-set/volume-summary-cases-v1` — buildEffectiveVolumeSummary (byMuscle 1.0/0.5/explicit muscleContribution, high/medium/low buckets, corrective+functional skip, warmup-counted-zero, `Math.round(x*10)/10` rounding, reasons dedup, dataFlag + dateRange filter, invalid-identity reason) + countEffectiveSets probes (default 0.75 + minScore override) + getMuscleContribution probes (primary-only / primary+secondary / explicit map / muscle-only / primary==secondary).
- `analytics/muscle-volume-dashboard-cases-v1` — getVolumeStatus four bands + target≤0 (high/low), weekStart window vs `slice(0,7)`, buildVolumeNotes, byMuscle-not-in-targets append, status+remaining sort.
- `analytics/exercise-trend-cases-v1` — buildExerciseTrend topSet (max-weight then max-reps) / low-quality (pain) exclusion / `topWeight||volume` filter / `slice(0,6)` / formatExerciseName + trendStatus 4 states + the `coreTrendExercises` constant.
- `analytics/prs-cases-v1` — buildPrs four metrics (max_weight / reps_at_weight / volume / estimated_1rm via buildE1RMProfile.best) + quality + non-warmup filter + invalid-identity skip + e1rm confidence→quality + date-desc sort + `slice(0,8)`.
- `analytics/weekly-report-cases-v1` — buildWeeklyReport injected-clock 7-day window (boundary daysAgo==7 in, >7 out) + sessionVolume/sessionCompletedSets/effectiveSummary + `focus||templateName` distribution (暂无) + latestWeight (未记录 / 0→未记录).
- `analytics/adherence-report-cases-v1` — buildAdherenceReport setCountForExercise vs completedSets, support correction/functional planned+min, the `||supportPlannedFromBlock` fallback, ratio rates, every suggestion branch, supportCoverage→confidence high/medium/low, skipped main (baseId||id) + support (moduleId:exerciseId:blockType) count-desc sort.

Swift `EffectiveSetEngineParityTests` / `AnalyticsDashboardEngineParityTests` decode each case's echoed engineInput, re-run the PORTED function, and COMPUTE-ASSERT the result == golden item-by-item (EXACT Double `==`; `EffectiveVolumeSummary.byMuscle` compared order-independently since the golden canonicalises keys).

## 5. Drift + count guards

- `node scripts/generate-parity-goldens.mjs` → `generated 66 fixture(s); 7 changed` (only the 7 new). The 59 pre-existing goldens regenerate byte-identically — `git diff --diff-filter=M -- tests/fixtures/parity` is empty; the 7 new goldens are `--diff-filter=A`.
- Parity fixture-count guards bumped **59 → 66** in sync: `parityFixturesContract` (own `FIXTURE_IDS` + inventory title), `parityFixturesGenerationConsistency` (`checked 66`), `iosBootstrapParityStillGreen`, and the ten `iosLocal*` / `iosNative*` `--check` guards.

## 6. Verification (all green)

- `node scripts/generate-parity-goldens.mjs` → `generated 66 fixture(s); 7 changed` (existing zero drift, new additive).
- `npm run typecheck` → 0.
- `npx vitest run` → 1373 files / 7268 tests pass.
- `swift test --package-path ios/packages/IronPathTrainingDecision` → 237 tests pass (incl. the 7 AN-3 parity cases).
- `xcodebuild … build` → succeeds.
- `git diff --check` clean; `project.pbxproj` / lockfile byte-unchanged.

## 7. Boundary / safety

PURE engine — consumes `[TrainingSession]` (§11 clean input); no IO, no randomness, zero `: Date`. No write path, no `CanonicalSessionWriter`, no source-of-truth touch. SPM-auto-included (no `project.pbxproj` / `Package.swift` / deps / lockfile change). The only non-`IronPathTrainingDecision` source edit is the backward-compatible `buildWeeklyReport` `options.nowIso` injected-clock param (production 2-arg path byte-unchanged). Source-of-truth impact: none. Data-safety impact: none.
