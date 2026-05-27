# Training Recommendation Hard Rewrite Plan V2

Branch: `claude/training-recommendation-hard-rewrite-v2` (off `main` at dbd2964)
Supersedes: PR #383 — Training Recommendation Source-of-Truth Full Rewrite V1 (closed as insufficient)
Companion: [TRAINING_RECOMMENDATION_TEST_PRUNING_V2.md](TRAINING_RECOMMENDATION_TEST_PRUNING_V2.md)

## 1. Why PR #383 was insufficient

PR #383 introduced `trainingDecisionEngine` as a new layer but **kept all 14 legacy final-decision engines alive** and merely fed them a `trainingDecisionContext` hint. The legacy modules still:

- Emit final user-facing strings (`本周先控制风险。`, `力量有进步，但恢复压力偏高`, `下次建议保持重量`, etc.) whenever they are called without the optional context.
- Are imported directly by `App.tsx`, `TodayView.tsx`, `PlanView.tsx`, `RecordView.tsx`, and ~14 `uiOs/` components — so the new SoT covers only the 4 callsites that were rewired.
- Are protected by ~30 test files that assert the **legacy** behavior, locking the old contradictions in place against any future hard removal.

That is layering arbitration on top of the fragmented system, not a source-of-truth rewrite. The user explicitly requires deletion / hard conversion of the legacy modules so the rewrite cannot regress, and a smaller, higher-value test suite that reflects the new contract.

## 2. Full recommendation component inventory

(From `/global-scan` + V1 multi-agent audit, validated by deletion-safety map.)

### 2.1 Modules to DELETE (8 engines + 1 presenter)

| Path | Reason | Importers to rewrite first |
|---|---|---|
| `src/engines/weeklyProgressionRecommendationEngine.ts` | Emits `本周先控制风险。` weekly summary independently | PlanView, RecordView, WeeklyProgressionRecommendationCard |
| `src/engines/progressClaritySummary.ts` | Emits the contradictory triplet (`力量有进步 / 恢复压力偏高 / 下次建议保持重量`) | RecordView, ProgressInsightHero, ReadinessPressureCard, StrengthTrendCards, EffectiveSetsVolumeCard |
| `src/engines/postWorkoutNextTimeRecommendationEngine.ts` | Emits `下次建议` per-exercise text | App.tsx, RecordView, PostWorkoutNextTimeRecommendationCard, guardedRecommendationContractEngine (type only) |
| `src/engines/todayDecisionSurface.ts` | Owns hero label / explanation text path | TodayView, TodayDecisionHero, TodayReadinessDecisionSummary, TodayReadinessSummary |
| `src/engines/coachAutomationEngine.ts` | Superseded by `coachActionEngine` + `enginePipeline`; pure synthesis layer | App.tsx, RecordView, ProfileView |
| `src/engines/deloadSignalEngine.ts` | Thin delegating wrapper around `adaptiveFeedbackEngine.buildAdaptiveDeloadDecision` | ProgressView, analytics.ts re-export |
| `src/engines/recommendationReasonSelector.ts` | Reason-selection logic moves to `TrainingDecision.hiddenDebugSignals.arbitrationTrace` | recommendationTraceEngine (chain delete) |
| `src/engines/recommendationTraceEngine.ts` | Trace logic consolidated into TrainingDecision | recommendationDiffEngine, recommendationExplanationPresenter, TodayView, PlanView, RecommendationExplanationPanel |
| `src/presenters/recommendationExplanationPresenter.ts` | Owns factor-priority ranking + view-model synthesis; replaced by direct `TrainingDecision.userFacing.explanation` consumed by `RecommendationExplanationPanel` | RecommendationExplanationPanel, App.tsx, TodayView/PlanView builders |

### 2.2 Modules to CONVERT to signal-only (strip user-facing text, keep numerics/enums)

| Path | What stays | What goes |
|---|---|---|
| `src/engines/todayTrainingReadinessDecisionEngine.ts` | `decisionKind`, `riskLevel`, `reasonCodes`, `confidence` | `title`, `summary`, `userMessage` |
| `src/engines/dailyTrainingAdjustmentEngine.ts` | `type`, `volumeMultiplier`, `intensityMultiplier`, `reasons[]` (structured codes), `suggestedChanges` (numeric/enum) | `title`, `summary` (user-facing copy) |
| `src/engines/readinessEngine.ts` | `score`, `level`, `trainingAdjustment` enum | `reasons[]` user-facing string list emission via `mapReadinessToSignal`; signal returns enum only |
| `src/engines/recommendationDiffEngine.ts` | Signature stability + numeric diff | All user-facing explanation text |
| `src/presenters/planAdviceAggregator.ts` | Coach-action ranking / dedup, draft filtering | Independent decision logic — formatter only over `TrainingDecision.weeklyAdjustment` |

### 2.3 Modules to KEEP as low-level signal providers

| Path | Output (kept) |
|---|---|
| `src/engines/effectiveTrainingPhaseEngine.ts` | `EffectiveTrainingPhase` (activePhase, effectiveWeek, compactLabel for engine internal use) |
| `src/engines/trainingLapseEngine.ts` | `TrainingLapseSignal` (stage, decay, retention) |
| `src/engines/adaptiveFeedbackEngine.ts` | `DeloadDecision` (triggered, level, strategy, volumeMultiplier) |
| `src/engines/autoDeloadTriggerEngine.ts` | Gate signal |
| `src/engines/recoveryAwareScheduler.ts` | Recovery kind + conflict level signal |
| `src/engines/adherenceAdjustmentEngine.ts` | weeklyVolumeMultiplier + complexity level signal |
| `src/engines/supportPlanEngine.ts` | Weekly muscle budget + dose level signal |
| `src/engines/volumeAdaptationEngine.ts` | Per-muscle direction + setsDelta signal |
| `src/engines/setByRirAdjustmentEngine.ts` | Set delta signal |
| `src/engines/setWeightFineTuneEngine.ts` | Weight projection (PR #377 trust override preserved) |
| `src/engines/adaptiveRecommendationEngine.ts` | Load bias multiplier signal |
| `src/engines/effectiveSetEngine.ts` | Per-set effectiveness numeric |
| `src/engines/recommendationConfidenceEngine.ts` | Confidence numeric per exercise |
| `src/engines/plateauDetectionEngine.ts` | Plateau verdict signal |
| `src/engines/painPatternEngine.ts` | Pain pattern map |
| `src/engines/loadFeedbackEngine.ts` | RIR / effort signal |
| `src/engines/sessionQualityEngine.ts` | Per-session quality score |
| `src/engines/exercisePrescriptionEngine.ts` | Prescription assembler — accepts arbitrated `volumeMultiplier` + `exerciseRoleFloors` parameters; legacy double-trim path removed |
| `src/engines/trainingIntelligenceSummaryEngine.ts` | Numeric / enum keyInsights signal feeding TrainingDecision (loses user-facing recommendedActions strings) |
| `src/engines/focusNextSetRecommendationEngine.ts` | Real-time per-set policy; consumed through `TrainingDecision.nextSetPolicy` |
| `src/engines/coachActionEngine.ts` + dismiss + identity | Coach cards (orthogonal domain); priority capped by TrainingDecision.riskLevel |

### 2.4 UI surfaces to rewire (every legacy import removed)

| File | Drops | Consumes (replacement) |
|---|---|---|
| `src/features/TodayView.tsx` | `todayDecisionSurface`, `todayTrainingReadinessDecisionEngine` (text path), `recommendationTraceEngine`, `recommendationExplanationPresenter` | `useTrainingDecision()` → `decision.userFacing.today` + `decision.exercisePrescriptions` |
| `src/features/PlanView.tsx` | `weeklyProgressionRecommendationEngine`, `recommendationTraceEngine`, `recommendationExplanationPresenter`, `planAdviceAggregator` direct decision use | `decision.userFacing.plan` + `decision.weeklyAdjustment` + `planAdviceAggregator` (formatter only) |
| `src/features/RecordView.tsx` | `progressClaritySummary`, `weeklyProgressionRecommendationEngine`, `postWorkoutNextTimeRecommendationEngine`, `coachAutomationEngine` (type) | `decision.userFacing.progress` + `decision.userFacing.record` + `decision.userFacing.plan` |
| `src/features/ProgressView.tsx` | `deloadSignalEngine` | direct calls to `volumeAdaptationEngine` + `adaptiveFeedbackEngine` signals |
| `src/features/TrainingView.tsx`, `TrainingFocusView.tsx` | `buildSessionRecommendationTrace` (recommendationTraceEngine) | `decision.userFacing.training` + `decision.userFacing.focus` |
| `src/uiOs/today/TodayDecisionHero.tsx` | `TodayDecisionSurfaceResult` type | `decision.userFacing.today` prop |
| `src/uiOs/today/TodayReadinessDecisionSummary.tsx` | `TodayTrainingReadinessDecision` type | `decision.userFacing.today.oneLineAdvice` |
| `src/uiOs/today/TodayReadinessSummary.tsx` | `TodayDecisionSurfaceResult` type | `decision.userFacing.today.micro` |
| `src/uiOs/today/TodayFocusOverridePanel.tsx` | (unchanged data flow — user-input only) | unchanged |
| `src/uiOs/today/TodaySevereRiskNotice.tsx` | (unchanged) | renders only when `decision.riskLevel === 'severe'` |
| `src/uiOs/progress/ProgressInsightHero.tsx` | `progressClaritySummary` type | `decision.userFacing.progress` prop |
| `src/uiOs/progress/ReadinessPressureCard.tsx` | `progressClaritySummary` type | `decision.userFacing.progress.micro` |
| `src/uiOs/progress/EffectiveSetsVolumeCard.tsx` | `progressClaritySummary` type | direct `effectiveSetEngine` signal + `decision.userFacing.progress.micro` |
| `src/uiOs/progress/StrengthTrendCards.tsx` | `progressClaritySummary` type | direct `plateauDetectionEngine` signal |
| `src/uiOs/progress/WeeklyProgressionRecommendationCard.tsx` | `weeklyProgressionRecommendationEngine` types + items | `decision.userFacing.plan` prop |
| `src/uiOs/records/PostWorkoutNextTimeRecommendationCard.tsx` | `postWorkoutNextTimeRecommendationEngine` types + items | `decision.userFacing.record` prop |
| `src/uiOs/training/*` | `buildSessionRecommendationTrace` | `decision.userFacing.training` + `decision.userFacing.focus` |
| `src/ui/RecommendationExplanationPanel.tsx` | `recommendationExplanationPresenter`, `RecommendationTrace`, `RecommendationFactor` | `decision.userFacing.explanation` |
| `src/App.tsx` | `coachAutomationEngine` direct call, `postWorkoutNextTimeRecommendationEngine`, `recommendationExplanationPresenter` | `enginePipeline.trainingDecision` (single field) |

## 3. Full old test inventory (29 files matching legacy modules)

See [TRAINING_RECOMMENDATION_TEST_PRUNING_V2.md §1](TRAINING_RECOMMENDATION_TEST_PRUNING_V2.md) for the full table.

Net counts:
- Total test files now (pre-rewrite): **1357**
- DELETE: **≈ 24** legacy engine + UI display tests
- COLLAPSE / REWRITE: **≈ 6** into compact `trainingDecisionHardRewrite*` tests
- KEEP: everything unrelated (boundary, sync, AppData round-trip, fineTune, cycle-gap state machine)
- Net target: **−18 to −22 test files** (1335–1339 after rewrite), with a small number of new compact files net-zeroing some of the deletes

## 4. Old fragmented dataflow graph

(Identical to V1 plan §2.) Six independent final-advice emitters → presenters → UI surfaces with no arbiter. PR #383 added a hint channel to 3 of them; legacy paths remain.

## 5. Contradiction map

(Identical to V1 plan §3.) The four user-visible contradictions trace to:
- `exercisePrescriptionEngine.ts:347` + `:285-296` (volume × deload double trim → 1-set sessions)
- `weeklyProgressionRecommendationEngine.ts:660-664` (`本周先控制风险` independent emission)
- `progressClaritySummary.ts:144-179` (legacy triplet independent emission)
- 4+ other engines emitting independent risk warnings without coordination

## 6. Components to delete

(See §2.1 table — 9 modules.)

## 7. Components to convert to signal-only

(See §2.2 table — 5 modules.)

## 8. Components to keep only as low-level calculators

(See §2.3 table — 21 modules.)

## 9. New TrainingDecision architecture

Single SoT. Owns all final user-facing training advice + every per-exercise / per-muscle / per-week prescription. Pure-derived from AppData; no persistence, no cloud writes, no localStorage mutation.

```
AppData
  ↓
trainingDecisionContext (input normalizer)
  ↓
[ signal engines run here — pure numerics / enums only ]
effectiveTrainingPhase / trainingLapse / readiness signal /
dailyAdjustment signal / recovery / volumeAdaptation /
adherence / supportPlanBudget / setByRir / fineTune /
adaptiveBias / effectiveSet / confidence / plateau / pain /
loadFeedback / sessionQuality / deloadDecision
  ↓
╔══════════════════════════════════════════════════════════════╗
║  src/engines/trainingDecisionEngine.ts                       ║
║  buildTrainingDecision(input) → TrainingDecision             ║
║  Arbitration rules AR-1..AR-9 (see §10)                      ║
║  Single owner of every userFacing string + every prescription║
╚══════════════════════════════════════════════════════════════╝
  ↓
enginePipeline → trainingDecision field
  ↓
presenters (pure formatters of decision.userFacing.*)
  ↓
UI surfaces (consume TrainingDecision; legacy imports forbidden)
```

## 10. TrainingDecision type shape

(Same as V1 plan §5, expanded.)

```ts
export interface TrainingDecision {
  activePhase: ActivePhase;
  trainingMode: TrainingMode | string;
  sessionIntent: SessionIntent;
  riskLevel: RiskLevel;
  progressionMode: ProgressionMode;
  volumeMode: VolumeMode;
  intensityMode: IntensityMode;
  exercisePrescriptions: ExercisePrescription[];
  workingSetTargets: WorkingSetTarget[];
  muscleGroupVolumeTargets: MuscleGroupVolumeTarget[];
  weeklyAdjustment: WeeklyAdjustmentDecision;
  nextSetPolicy?: NextSetPolicy;
  userFacing: Partial<Record<SurfaceId, UserFacingPerSurface>>;
  hiddenDebugSignals: HiddenDebugSignals;
  computedAtIso: string;
  decisionVersion: 'v2';
}
```

UserFacingPerSurface caps:
- `headline ≤ 60 chars` (single sentence)
- `oneLineAdvice ≤ 80 chars`
- `≤ 1 riskBadge`
- `≤ 1 primaryActionLabel`
- `micro` is a tightly-scoped per-surface flat string map (no nested narrative)

Arbitration rules (AR-1..AR-9) per V1 plan §9 (severe override / reentry-no-double-penalty / productive-floor / weekly-blocked-by-phase / strength-up-fatigue-high coherence / one-risk-badge / headline-cap / permanent-warning downgrade / one-direction-per-screen).

## 11. UI surfaces to reconnect

See §2.4 — 14 UI components + 6 feature shells + 1 App entry.

## 12. Tests to delete

See [TRAINING_RECOMMENDATION_TEST_PRUNING_V2.md §2](TRAINING_RECOMMENDATION_TEST_PRUNING_V2.md). 24+ files.

## 13. Tests to rewrite

See [TRAINING_RECOMMENDATION_TEST_PRUNING_V2.md §3](TRAINING_RECOMMENDATION_TEST_PRUNING_V2.md). 6+ files collapsed into compact `trainingDecisionHardRewrite*` suite.

## 14. Tests to keep

See [TRAINING_RECOMMENDATION_TEST_PRUNING_V2.md §4](TRAINING_RECOMMENDATION_TEST_PRUNING_V2.md). All safety / boundary / data / sync / lockfile / fineTune / cycle-gap / kg-lb tests untouched.

## 15. New compact test suite design

Prefix: `trainingDecisionHardRewrite*`. ~10–12 files total, table-driven, covering:

1. Engine shape contract
2. Reentry productive dose (RGR-1, AR-3)
3. No double penalty (RGR-2, AR-2)
4. Strength-up + fatigue-high coherence + no triplet (RGR-3, AR-5)
5. Normal 4-day/week not permanently conservative (RGR-4)
6. Short gap preserved (RGR-5)
7. No history safe default (RGR-6)
8. Per-surface user-facing caps + AR-7
9. Static import-boundary: features/uiOs cannot import deleted/converted legacy engines
10. Static forbidden-copy scan: `本周先控制风险`, legacy triplet, `原计划 vs 当前建议`, `系统判断` absent
11. AppData schema + localStorage key snapshot stability
12. Production dist forbidden-token scan stability

## 16. Data safety plan

- AppData schema: unchanged. `schemaVersion` not bumped. Verified by snapshot test.
- TrainingSession schema: unchanged.
- localStorage keys: unchanged. No new keys, no removed keys, no mutation by trainingDecisionEngine.
- Cloud sync: untouched. `src/cloudSync/`, `src/cloudProduction/`, `src/sync/` not edited. Boundary tests preserved.
- TrainingDecision is pure-derived, no I/O, no clock except `nowIso` parameter, no DOM, no localStorage / IndexedDB write, no cloud call.
- Production dist scan extended forbidden list (already covered by existing scan + new test).
- No package added; `package-lock.json` unchanged; `pnpm-lock.yaml` remains absent.
- Tokens / env / service-role / API keys / cookies: never logged; `hiddenDebugSignals` contains only structured engine outputs.
- Preserves PR #381 (reentry state machine), PR #377 (fineTune trust override), PR #378/#374/#375/#376 (sync-on receipt + per-account safety).

## 17. Browser smoke plan

Identical to V1 §13.I — seed 4-day/week + 14+ day gap + previous deload via localStorage; visit Today / Plan / Training / Focus / Progress / Record; verify single coherent direction, no all-1-set, no triplet, no console errors.

## 18. Rollback plan

If validation fails or browser smoke discovers regression after merge:

1. `git revert <merge-commit>` on `main` (immediate rollback of code).
2. `npx vercel --prod` to redeploy the reverted main.
3. Cause analysis on the V2 branch (do not delete branch).
4. Issue a follow-up PR with a targeted fix; do not re-attempt the full hard rewrite without the failing scenario captured as a regression test.

If validation fails BEFORE merge: STOP and report per task spec. Do not push or merge.
