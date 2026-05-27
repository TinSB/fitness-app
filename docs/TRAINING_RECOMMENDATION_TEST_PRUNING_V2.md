# Training Recommendation Test Pruning V2

Branch: `claude/training-recommendation-hard-rewrite-v2`
Companion: [TRAINING_RECOMMENDATION_HARD_REWRITE_PLAN_V2.md](TRAINING_RECOMMENDATION_HARD_REWRITE_PLAN_V2.md)

## 0. Pruning rules (from task spec)

- Delete tests tied to deleted old final-decision components.
- Rewrite tests that should now consume `TrainingDecision`.
- Collapse duplicate UI-copy tests into one static copy scan.
- Collapse repeated scenario tests into table-driven tests.
- Keep high-value safety / data-safety / boundary / regression tests untouched.
- Do not blindly delete safety coverage. Goal: fewer, stronger tests.

## 1. Old recommendation test inventory

29 files match the legacy-module regex. Plus a small set of indirect consumers (e.g. `App.tsx` integration / `TodayView.test.tsx` if any).

| File | Asserts | Classification |
|---|---|---|
| tests/weeklyProgressionRecommendationEngine.test.ts | `buildWeeklyProgressionRecommendation` direct + `本周先控制风险` summary | DELETE |
| tests/weeklyProgressionRecommendationBoundary.test.ts | type boundary | DELETE |
| tests/weeklyProgressionRecommendationDetailDisplay.test.ts | per-item UI copy | DELETE |
| tests/weeklyProgressionRecommendationDisplayIntegration.test.ts | integration display | DELETE |
| tests/progressClaritySummary.test.ts | triplet (`力量有进步`/`恢复压力偏高`/`保持重量`) | DELETE |
| tests/postWorkoutNextTimeRecommendationEngine.test.ts | per-exercise next-time copy | DELETE |
| tests/postWorkoutNextTimeRecommendationAppBoundary.test.ts | App boundary | DELETE |
| tests/postWorkoutNextTimeRecommendationDisplayIntegration.test.ts | display integration | DELETE |
| tests/todayDecisionSurface.test.ts | hero label / explanation | DELETE |
| tests/todayDecisionSurfaceIntegration.test.tsx | integration | DELETE |
| tests/todayTrainingReadinessDecisionEngine.test.ts | text fields (title / summary / userMessage) on the legacy engine | REWRITE (signal-only assertions; move into compact tests) |
| tests/todayTrainingReadinessDecisionBoundary.test.ts | App import boundary — legacy assertion will become irrelevant after delete | DELETE |
| tests/dailyTrainingAdjustmentEngine.test.ts | type + multipliers + reasons + text | REWRITE (signal-only; drop text assertions) |
| tests/recommendationExplanationPresenter.test.ts | factor priority + view-model synthesis | DELETE |
| tests/recommendationExplanationPanel.test.ts | UI rendering of legacy view-model | DELETE |
| tests/recommendationExplanationSourceLabels.test.ts | legacy source labels | DELETE |
| tests/recommendationExplanationUi.test.ts | UI tree of legacy panel | DELETE |
| tests/planAdviceAggregator.test.ts | aggregation logic (becomes formatter only) | REWRITE (consume TrainingDecision.weeklyAdjustment) |
| tests/planAdviceAggregatorFingerprint.test.ts | fingerprint regression | REWRITE (consume TrainingDecision input) |
| tests/recommendationDiffEngine.test.ts | diff signatures + explanation text | REWRITE (drop text; keep signature) |
| tests/recommendationConsistency.test.ts | cross-engine consistency via diff explanation | REWRITE (compare TrainingDecision snapshots) |
| tests/recommendationConfidenceEngine.test.ts | numeric confidence | KEEP (engine retained as signal) |
| tests/recommendationReasonSelector.test.ts | reason selection | DELETE |
| tests/recommendationTraceEngine.test.ts | trace assembly + reasons | DELETE |
| tests/recommendationTraceSoreness.test.ts | soreness factor trace | DELETE |
| tests/coachAutomationEngine.test.ts | automation synthesis | DELETE (move logic into enginePipeline test if needed) |
| tests/coachAutomationHardening.test.ts | automation hardening | DELETE |
| tests/coachAutomationRealWorldFlow.test.ts | real-world automation flow | DELETE |
| tests/trainingIntelligenceSummaryEngine.test.ts | summary user-facing strings | REWRITE (signal-only assertions) |

## 2. Tests deleted (and why)

24 files. Each tests a module being deleted, or asserts a legacy text output that will no longer be emitted anywhere.

- 4 weekly progression (engine + boundary + detail display + integration)
- 1 progress clarity
- 3 post-workout next time
- 2 today decision surface (engine + integration)
- 1 today readiness boundary
- 4 recommendation explanation (presenter + panel + source labels + UI)
- 3 recommendation trace / reason selector / consistency-via-trace (note: consistency test rewritten under §3, not deleted)
- 3 coach automation (engine + hardening + real-world)
- 3 weekly progression display / boundary / detail (already listed above)

(Counted with overlap collapsed: **24 unique files DELETED**.)

## 3. Tests rewritten (and why)

These tests still assert valuable behavior but the engine they call is going away. They are rewritten to consume `buildTrainingDecision` instead, and consolidated into the `trainingDecisionHardRewrite*` family.

| Old file | Reason | New file |
|---|---|---|
| tests/todayTrainingReadinessDecisionEngine.test.ts | Signal contract worth keeping (decisionKind, riskLevel) | `tests/trainingDecisionHardRewriteTodaySignal.test.ts` |
| tests/dailyTrainingAdjustmentEngine.test.ts | Signal contract worth keeping (multipliers, reasonCodes) | `tests/trainingDecisionHardRewriteDailyAdjustment.test.ts` |
| tests/recommendationDiffEngine.test.ts | Stable-signature concept worth keeping | `tests/trainingDecisionHardRewriteDecisionStability.test.ts` |
| tests/recommendationConsistency.test.ts | Cross-input consistency worth keeping | merged into above |
| tests/planAdviceAggregator.test.ts | Coach-action ranking / dedup logic worth keeping | `tests/trainingDecisionHardRewritePlanAggregator.test.ts` |
| tests/planAdviceAggregatorFingerprint.test.ts | Fingerprint dedup worth keeping | merged into above |
| tests/trainingIntelligenceSummaryEngine.test.ts | Signal contract for keyInsights | merged into the engine-shape test |

**6 unique files REWRITTEN** (merging into ~3 new compact files).

## 4. Tests kept (high-value, untouched)

All non-recommendation tests stay. The recommendation-adjacent tests that remain untouched:

- `tests/recommendationConfidenceEngine.test.ts` — engine retained as signal; numerics-only.
- Cycle-gap / phase / reentry: `trainingPhaseEffectiveMapping.test.ts`, `trainingPhaseGapWiringRecommendation.test.ts`, `pplCycleRealWorldRegression.test.ts`.
- FineTune: `fineTuneTrustOverride.test.ts`.
- Sync receipt + per-account safety: `syncEnabledPersistenceRegressionV1.test.ts`, `cloudSyncListRowState.test.ts`, `phase20SyncActivationAcceptance.test.ts`, `cloudSyncRehydrateHashAccuracy.test.ts`, `cloudSyncHashAlgorithmStability.test.ts`.
- Boundary: `appDataRoundTripRegression.test.ts`, `explicitOptInSyncPreflightBoundary.test.ts`, `offlineRollbackBoundary.test.ts`, `silentSchemaLoadFallbackBoundary.test.ts`, `accountScopedAppDataBoundary.test.ts`.
- Engine contract: `engineContract.test.ts`, `engineIdempotency.test.ts`.
- Coach action core: `coachActionEngine.test.ts`, `coachActionDismissEngine.test.ts`, `coachActionIdentityEngine.test.ts`, `coachActionDismissRegression.test.ts`, `coachActionPlanDraft.test.ts`, `coachActionDraftRapidClick.test.ts`, `coachActionDraftDedup.test.ts`.
- Adaptive feedback: `adaptiveFeedbackEngine.test.ts` (if exists) — keep, signal layer.
- Volume adaptation: `volumeAdaptationEngine.test.ts` — keep as signal layer.
- Support plan: `supportPlanEngine.test.ts` — keep as budget signal.
- ~1300 unrelated tests (UI mobile fixes, data health, prototypes, micrupcopy regressions, theme, settings, equipment, screening, etc.) — KEEP.

## 5. Duplicate tests merged

- `recommendationConsistency.test.ts` merged into `trainingDecisionHardRewriteDecisionStability.test.ts` (both test cross-input stability).
- `planAdviceAggregatorFingerprint.test.ts` merged into `trainingDecisionHardRewritePlanAggregator.test.ts` (both test dedup + ranking).
- `trainingIntelligenceSummaryEngine.test.ts` shape assertions merged into `trainingDecisionHardRewriteEngineShape.test.ts`.

## 6. New minimal test matrix (`trainingDecisionHardRewrite*`)

| # | File | Coverage |
|---|---|---|
| 1 | `trainingDecisionHardRewriteEngineShape.test.ts` | TrainingDecision has every owned field; userFacing caps; determinism; arbitrationTrace contains AR-* entries; `decisionVersion === 'v2'` |
| 2 | `trainingDecisionHardRewriteReentryProductiveDose.test.ts` | RGR-1 + RGR-2 + AR-2 + AR-3: 14-day gap + deload → reentry-productive; compounds ≥ 2 sets; finalVolumeMultiplier ≥ 0.65; weeklyAdjustment.direction !== decrease; AR-1 severe override; AR-4 weekly-blocked |
| 3 | `trainingDecisionHardRewriteArbitrationCoherence.test.ts` | RGR-3 + AR-5: strength-up + fatigue-high → controlled-reload; no triplet in concatenated user-facing strings |
| 4 | `trainingDecisionHardRewriteNormalSession.test.ts` | RGR-4 + RGR-5 + RGR-6: normal 4-day/week not permanently `保守`; short gap preserves persisted phase; empty history safe default |
| 5 | `trainingDecisionHardRewriteUserFacingShape.test.ts` | AR-6 (≤ 1 risk badge per surface); AR-7 (headline ≤ 60, oneLineAdvice ≤ 80); AR-9 (one direction per surface) |
| 6 | `trainingDecisionHardRewriteLegacyImportBoundary.test.ts` | Static scan: `src/features/**`, `src/uiOs/**`, `src/presenters/**` import none of the deleted legacy modules; the only allowed importer of signal engines is `src/engines/trainingDecisionEngine.ts` |
| 7 | `trainingDecisionHardRewriteForbiddenCopyScan.test.ts` | Static scan: `src/uiOs/**` + `src/features/**` contain none of `本周先控制风险`, `原计划 vs 当前建议`, `原计划阶段 vs 当前建议`, `系统判断`, `AI 教练`, or the legacy triplet co-occurrence (`力量有进步` ∧ `恢复压力偏高` ∧ `下次建议保持重量`) |
| 8 | `trainingDecisionHardRewriteTodaySignal.test.ts` | Signal-only contract for `todayTrainingReadinessDecisionEngine` (decisionKind enum, riskLevel enum, no text exports) |
| 9 | `trainingDecisionHardRewriteDailyAdjustment.test.ts` | Signal-only contract for `dailyTrainingAdjustmentEngine` (type enum, multipliers, reasonCodes, no text exports) |
| 10 | `trainingDecisionHardRewriteDecisionStability.test.ts` | Determinism + diff-signature stability across identical inputs and minor input perturbations |
| 11 | `trainingDecisionHardRewritePlanAggregator.test.ts` | `planAdviceAggregator` is pure formatter of TrainingDecision.weeklyAdjustment; coach-action dedup + ranking preserved |
| 12 | `trainingDecisionHardRewriteAppDataStability.test.ts` | AppData schema snapshot unchanged; localStorage key set unchanged; no new writes by trainingDecisionEngine; no cloud imports |

Net: **12 new files**, **24 deleted**, **6 rewritten-into the 12 new**, net −18 test files.

## 7. Coverage risks

- The deleted engines lose their direct unit coverage. **Mitigation**: their behavior was either contradictory (we want it gone) or has been folded into the new engine. The new test #2 covers reentry productive dose, #3 covers strength+fatigue coherence, #5 covers user-facing caps — these jointly assert the same product invariants the old tests purported to assert, but in terms of the new SoT.
- `recommendationDiffEngine.test.ts` was the only test of decision-signature stability. **Mitigation**: new test #10 covers determinism + signature stability directly on `TrainingDecision`.
- The static import-boundary test (#6) becomes the load-bearing guarantee that no UI/feature can ever again import a deleted/converted legacy module. If a follow-up PR tries, the test fails immediately.
- The static forbidden-copy test (#7) becomes the load-bearing guarantee that the user-visible contradictions cannot re-appear via copy-paste in any future UI change.

## 8. Exact test count before / after

| | Before | After |
|---|---|---|
| Total `.test.ts*` files | 1357 | ~ **1345** (estimated −12 net: 24 deleted, 12 new) |
| Recommendation-domain files matching legacy module regex | 29 | 0 (all deleted or merged into `trainingDecisionHardRewrite*`) |
| `trainingDecisionHardRewrite*` files | 0 | 12 |
| `recommendationConfidenceEngine.test.ts` (kept as signal) | 1 | 1 |
| Cycle-gap / fineTune / sync / boundary / coach-action / data-safety / unrelated | ≈ 1327 | ≈ 1327 (untouched) |

Test count delta will be reported precisely at PR time after the implementation lands.
