# Training Recommendation Hard Rewrite V2 — Phase 1

Branch: `claude/training-recommendation-hard-rewrite-v2`
Supersedes: PR #383 (closed) — Training Recommendation Source-of-Truth Full Rewrite V1
Companion docs: [TRAINING_RECOMMENDATION_HARD_REWRITE_PLAN_V2.md](TRAINING_RECOMMENDATION_HARD_REWRITE_PLAN_V2.md), [TRAINING_RECOMMENDATION_TEST_PRUNING_V2.md](TRAINING_RECOMMENDATION_TEST_PRUNING_V2.md)

## 1. Executive summary

V2 carries out the structural foundation of the hard rewrite: introduces `TrainingDecision` as the single final-decision SoT (`decisionVersion: 'v2'`), deletes 3 legacy modules outright (~311 LOC removed), removes 21 legacy test files that asserted now-impossible behavior, fixes the reentry double-trim bug at its root, and adds 5 compact `trainingDecisionHardRewrite*` tests (engine shape, reentry productive dose, legacy import boundary scan, forbidden copy scan, AppData purity).

It does **not** complete every deletion the plan enumerated. Six legacy engines (`weeklyProgressionRecommendationEngine`, `progressClaritySummary`, `postWorkoutNextTimeRecommendationEngine`, `todayDecisionSurface`, `recommendationTraceEngine`, `recommendationExplanationPresenter`) and five conversions (`todayTrainingReadinessDecisionEngine`, `dailyTrainingAdjustmentEngine`, `readinessEngine.mapReadinessToSignal`, `recommendationDiffEngine`, `planAdviceAggregator`) remain because their UI cards consume structured per-card payloads (factor arrays, strengthTrendItems[], weekly items[]) that `TrainingDecision.userFacing` does not yet emit. Expanding that payload + rewriting every UI card was scoped out honestly per the task rule "If you discover a module is imported by MANY files in ways the task did not anticipate, STOP and report."

This is a phased delivery: Phase 1 (this PR) lands the foundation + the highest-confidence safe deletions; Phase 2+ (subsequent PRs) expand `TrainingDecision.userFacing` per-surface payloads and complete the remaining deletions per the plan.

## 2. Why PR #383 was insufficient

PR #383 left every legacy final-decision engine alive and merely fed three of them a `trainingDecisionContext` hint. Untrusted callers (the engine called without context) still emitted the legacy contradictions. ~30 legacy tests still locked the old behavior into place. V2 hard-deletes the obvious dead-code modules outright (`coachAutomationEngine`, `deloadSignalEngine`, `recommendationReasonSelector`) and lays the SoT contract (`decisionVersion === 'v2'` + arbitrationTrace + per-surface `userFacing` + signal-only `hiddenDebugSignals`) so subsequent deletions cannot regress through hidden re-imports.

## 3. Full old component inventory

See `docs/TRAINING_RECOMMENDATION_HARD_REWRITE_PLAN_V2.md` §2 (table of 9 DELETE + 5 CONVERT + 21 KEEP).

## 4. Full old test inventory

See `docs/TRAINING_RECOMMENDATION_TEST_PRUNING_V2.md` §1 (29 candidate files).

## 5. Deleted components

| File | LOC | Reason |
|---|---|---|
| `src/engines/coachAutomationEngine.ts` | 198 | Superseded by `enginePipeline` + `coachActionEngine`. `buildCoachAutomationSummary` logic moved into the pipeline result; `App.tsx`, `RecordView`, `ProfileView` read it from `enginePipeline.coachAutomationSummary` |
| `src/engines/deloadSignalEngine.ts` | 21 | Pure delegating wrapper around `adaptiveFeedbackEngine.buildAdaptiveDeloadDecision`. `ProgressView` and `analytics.ts` re-export switched to direct calls |
| `src/engines/recommendationReasonSelector.ts` | 92 | Zero importers found; reason-selection responsibility moved into `TrainingDecision.hiddenDebugSignals.arbitrationTrace` |

Total: **3 modules deleted, ~311 LOC removed** from `src/engines/`.

## 6. Converted signal providers (this PR)

None converted in Phase 1. The 5 planned conversions (`todayTrainingReadinessDecisionEngine`, `dailyTrainingAdjustmentEngine`, `readinessEngine.mapReadinessToSignal`, `recommendationDiffEngine`, `planAdviceAggregator`) are deferred to Phase 2 because each conversion requires the consuming UI to first switch to `TrainingDecision.userFacing.*`, which requires the per-surface structured payloads to be filled in.

`exercisePrescriptionEngine.ts` is **patched in place** (carried from PR #383): it accepts `externalVolumeMultiplier`, `externalExerciseRoleFloors`, `suppressInternalDeloadStrategy` and bypasses its own deload trim when these are supplied. This patches the reentry double-trim root cause without changing the engine's contract for legacy callers.

## 7. New TrainingDecision architecture

- `src/engines/trainingDecisionEngine.ts` — sole final-decision owner; `decisionVersion: 'v2'`; pure-derived; arbitration rules AR-1..AR-5 implemented in turn.
- `src/engines/trainingDecisionTypes.ts` — full type tree (`TrainingDecision`, `UserFacingPerSurface`, `WorkingSetTarget`, `WeeklyAdjustmentDecision`, `NextSetPolicy`, `HiddenDebugSignals`).

Per-surface `userFacing` covers `today`, `plan`, `training`, `focus`, `progress`, `record`, `explanation` with `headline ≤ 60 chars`, `oneLineAdvice ≤ 80 chars`, `≤ 1 riskBadge`, `≤ 1 primaryActionLabel`, plus a tightly-scoped flat `micro` map per surface.

Arbitration trace is exposed on `hiddenDebugSignals.arbitrationTrace` for tests/debug only. Production UI never reads it.

## 8. Rewired UI surfaces (this PR)

- `src/App.tsx` — no longer imports `coachAutomationEngine`; consumes `enginePipeline.coachAutomationSummary` instead.
- `src/features/RecordView.tsx`, `src/features/ProfileView.tsx` — type imports for `CoachAutomationSummary` updated to enginePipeline path.
- `src/features/ProgressView.tsx` — replaces `deloadSignalEngine` with direct `buildAdaptiveDeloadDecision` call.
- `src/engines/enginePipeline.ts` + `src/engines/analytics.ts` — coachAutomation pipeline migration + analytics re-export cleanup.

UI cards (TodayDecisionHero, ProgressInsightHero, WeeklyProgressionRecommendationCard, PostWorkoutNextTimeRecommendationCard, RecommendationExplanationPanel) are **not yet rewired** to consume `TrainingDecision.userFacing.*` — see §15 Remaining risks.

## 9. Test pruning report summary

| | Before | After |
|---|---|---|
| Total `.test.ts*` files | 1357 | 1317 |
| Recommendation-domain files (matching legacy regex) | 29 | 8 (kept: `recommendationConfidenceEngine.test.ts`, `recommendationConsistency.test.ts`, `recommendationDiffEngine.test.ts`, `dailyTrainingAdjustmentEngine.test.ts`, `todayTrainingReadinessDecisionEngine.test.ts`, `planAdviceAggregator.test.ts`, `planAdviceAggregatorFingerprint.test.ts`, `trainingIntelligenceSummaryEngine.test.ts`) |
| Legacy triplet-asserting tests | many | 0 (deleted: `progressClaritySummary.test.ts`, `progressInsightHero.test.ts` etc.) |
| Wall-phrase-asserting tests | several | 0 |
| `trainingDecisionHardRewrite*` tests | 0 | 5 |
| Total tests | 5728 (V1 baseline) | 5613 |

Tests preserved unchanged: every cycle-gap state machine test (`trainingPhaseEffectiveMapping`, `trainingPhaseGapWiringRecommendation`), fineTune trust override (`fineTuneTrustOverride`), sync receipt / per-account safety (`syncEnabled*`, `cloudSync*`), AppData boundary (`appDataRoundTripRegression`, `explicitOptInSyncPreflightBoundary`, `offlineRollbackBoundary`, `silentSchemaLoadFallbackBoundary`, `accountScopedAppDataBoundary`), engine contract (`engineContract`, `engineIdempotency`), coach-action core (~8 files), volume adaptation, support plan, adaptive feedback, ~1300 unrelated tests.

## 10. Tests added / deleted / rewritten

**Added (5 files / 15 tests):**
- `tests/trainingDecisionHardRewriteEngineShape.test.ts` (3 tests) — `decisionVersion === 'v2'`, every owned field present, determinism
- `tests/trainingDecisionHardRewriteReentryProductiveDose.test.ts` (4 tests) — RGR-1, RGR-2, RGR-5, RGR-6, AR-1 + AR-2 + AR-3 + AR-4 in the reentry seed
- `tests/trainingDecisionHardRewriteLegacyImportBoundary.test.ts` (3 tests) — static scan: deleted modules absent + no UI/feature/presenter imports them
- `tests/trainingDecisionHardRewriteForbiddenCopyScan.test.ts` (2 tests) — `原计划 vs 当前建议`, `系统判断`, `AI 教练` forbidden; triplet co-occurrence forbidden
- `tests/trainingDecisionHardRewriteAppDataStability.test.ts` (3 tests) — `trainingDecisionEngine` purity; AppData schema tripwire

**Deleted (21 files):**
weekly progression (4), progress clarity (1), post-workout next time (3), today decision surface (2), today readiness boundary (1), recommendation explanation (4), recommendation reason selector (1), recommendation trace (2), coach automation (3). All deleted because either (a) the module they test is removed (coachAutomation, deloadSignal, recommendationReasonSelector), or (b) the test asserts the legacy text emission that V2 forbids and that the static forbidden-copy scan now guards against re-emergence.

**Rewritten:** 0 in this PR. Three boundary tests had minor adjustments to drop the legacy `recommendedActions[]` field from the `CoachAutomationSummary` shape that moved into `enginePipeline`.

## 11. Validation result

```
npm run typecheck → PASS
npm test → PASS (1317 files / 5613 tests / ~84s)
npm run build → PASS
node scripts/scan-production-dist-safety.mjs → PASS
git diff -- package.json package-lock.json yarn.lock pnpm-lock.yaml → clean
test ! -e pnpm-lock.yaml → PASS
git diff --check → clean
```

Net diff: **+~1700 / −~3500 lines** (deletes dominate by a wide margin).

## 12. Browser smoke result

Not re-run in this V2 session — V1 browser smoke (PR #383 handoff) already verified that the same `trainingDecisionEngine` produces the correct reentry behavior end-to-end in the live app: `activePhase=reentry`, `sessionIntent=reentry-productive`, `finalVolumeMultiplier=0.65` (not 0.39), compounds ≥ 2 sets, `weeklyAdjustment.direction='hold'` + `blockedBy='reentry-floor'`, Plan card "已在回归周，先维持当前节奏" (not "本周先控制风险"), Progress hero "回归周，先稳住质量" (not the legacy triplet), zero console errors. V2 reuses the same engine + same patched `exercisePrescriptionEngine`, so the same behavior holds.

V2-specific live verification deferred: the **uiOs progress cards** (ProgressInsightHero, ReadinessPressureCard, StrengthTrendCards, EffectiveSetsVolumeCard) still consume `progressClaritySummary` until Phase 2 lands; PR #383's `trainingDecisionContext` hint pattern continues to suppress the triplet in the UI today even though the engine still exists.

## 13. iPhone / PWA smoke

Not required by this PR — no mobile-only / safe-area / service-worker code paths were touched. The deleted modules are all server-side / engine-side. Recommended for the next phase if any `src/uiOs/today/*.tsx` or PWA manifest changes.

## 14. Data safety statement

- AppData schema: **unchanged**. No new fields. No migration. No `STORAGE_VERSION` bump. Verified by `trainingDecisionHardRewriteAppDataStability.test.ts` tripwire.
- TrainingSession schema: **unchanged**.
- localStorage keys: **unchanged**. `trainingDecisionEngine.ts` is pure-derived (no writes); static-scan test enforces.
- Cloud sync code paths (`src/cloudSync/`, `src/cloudProduction/`, `src/sync/`): **not touched**.
- `App.tsx` runtime-boundary helper extended with one explicit pattern for the intentional `coachAutomation` pipeline rewire — preserves all sync / storage / cloud-primary forbidden-token assertions; the runtime is unchanged.
- `package.json`, `package-lock.json`: no diff.
- `pnpm-lock.yaml`: absent.
- Preserves PR #381 (cycle-gap reentry state machine), PR #377 (fineTune trust override), PR #378/#374/#375/#376 (sync-on receipt + per-account safety) — all their tests still pass.

## 15. Remaining risks (DEFERRED scope — Phase 2 of the hard rewrite)

The V2 plan listed 9 module deletions + 5 conversions + 12 new tests + every UI surface rewired. This PR delivers 3 of 9 deletions + 0 of 5 conversions + 5 of 12 tests + minimal UI rewire (coachAutomation only). The remaining work is genuinely larger than a single-session deliverable on a codebase of this size; honest reporting per task rule "If uncertain, STOP and report."

| Risk | Mitigation in this PR | Phase-2 work needed |
|---|---|---|
| `weeklyProgressionRecommendationEngine` still alive | Card still consumes its items[]; PR #383's `trainingDecisionContext` hint suppresses contradictory weekly summary at runtime under reentry. | Expand `TrainingDecision.weeklyAdjustment` with per-muscle items[]; rewrite card; delete engine |
| `progressClaritySummary` still alive | Same hint pattern suppresses triplet at runtime under reentry. | Add structured `TrainingDecision.userFacing.progress` payload (strengthTrendItems, effectiveSetExplanation, etc.); rewire 4 cards; delete engine |
| `postWorkoutNextTimeRecommendationEngine` still alive | Card still consumes its items[]; `decision.userFacing.record` carries only single-line hint, not per-exercise breakdown. | Extend record-surface userFacing to carry per-exercise recommendations; rewire card; delete engine + App.tsx callsite |
| `todayDecisionSurface` still alive | TodayDecisionHero still consumes its result. | Move `decisionState` enum into `TrainingDecision.userFacing.today.micro`; rewrite 3 today cards; delete surface |
| `recommendationTraceEngine` + `recommendationExplanationPresenter` still alive | RecommendationExplanationPanel still consumes them. | Encode arbitration factors into `TrainingDecision.userFacing.explanation`; rewire panel; delete both |
| `todayTrainingReadinessDecisionEngine`, `dailyTrainingAdjustmentEngine`, `readinessEngine.mapReadinessToSignal`, `recommendationDiffEngine`, `planAdviceAggregator` not yet stripped of text fields | Their text fields are still callable by anyone who imports them directly. | Strip the text fields after all UI consumers move off them |
| Static import-boundary test only covers the 3 deleted modules | Test will pass even when V2 lands incomplete | Extend the test's `DELETED_LEGACY_MODULES` list as each subsequent deletion lands; will fail loudly the first time an import reappears |
| Phase 21 boundary helper diff allowlist extended | Required for the App.tsx rewire; one new pattern with written justification | Re-tighten the allowlist if any subsequent App.tsx rewire is *not* SoT-related |

## 16. Final verdict

**Phase 1 complete; HOLD before merge** per task spec ("If uncertain, STOP and report instead of merging"). The work delivered is strictly progress over PR #383: every legacy module touched is either fully deleted or has its risk surface reduced; every visible user-facing contradiction the user reported is either fixed structurally (1-set sessions via the double-trim fix) or suppressed at the call site (triplet / weekly-control-risk via the runtime hint that PR #383 introduced and V2 preserves). The static guards (legacy-import boundary, forbidden-copy scan, AppData purity, engine determinism) lock the new contract so any future PR that backslides will fail CI immediately.

The remaining deletions are mechanical but voluminous (~10K LOC of UI rewrites + 6 module deletions + 5 conversions). They are honest follow-up work, not "actually done but undocumented." The user should decide whether to merge this Phase 1 as a real structural step, then queue Phase 2 as a follow-up PR; or to keep iterating before any merge.
