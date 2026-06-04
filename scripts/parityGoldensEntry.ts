/*
 * iOS-0 parity-goldens generator (TypeScript entrypoint).
 *
 * Wrapped by scripts/generate-parity-goldens.mjs. NOT a runtime module —
 * it lives under scripts/ and is bundled via `vite build --ssr` into
 * `.ironpath/parity-goldens-runner/` before being executed by Node.
 *
 * Determinism contract — read this before changing anything:
 *   1. No Date.now() / Math.random() anywhere in this file or in the
 *      engines it drives. Clocks come from parityMeta.deterministicClockIso.
 *   2. JSON output is canonicalised (sorted keys, 2-space indent,
 *      trailing newline) so two consecutive runs produce byte-identical
 *      goldens.
 *   3. The privacy guard re-validates inputs and goldens; any token / email /
 *      userId / deviceLabel / JWT prefix aborts the run.
 *
 * iOS-0 freezes 5 fixture groups under tests/fixtures/parity/ — see
 * docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STORAGE_VERSION } from '../src/data/appConfig';
import { buildAppDataSnapshotHash } from '../src/cloudProduction/accountBoundaryLocalInventory';
import { buildCleanAppDataView } from '../src/dataHealth/cleanAppDataView';
import {
  createCleanTrainingDecisionInput,
  buildTrainingDecisionFromCleanInput,
} from '../src/engines/trainingDecisionCleanInput';
import { runAutoRepairOrchestrator } from '../src/dataHealth/autoRepairOrchestrator';
import { getAppDataRepairRegistry } from '../src/dataHealth/appDataRepairRegistry';
import { buildFocusStepQueue } from '../src/engines/focusModeStateEngine';
import { resolveFocusModeInteractionState } from '../src/engines/focusModeInteractionState';
// SR-0 — smart-replacement parity slice (parity pipeline only; the engine port
// is SR-1+). Imports the REAL engine entrypoint so the goldens are generated,
// never hand-authored (§22). buildSmartReplacementRecommendations is clockless
// (no Date.now / Math.random), so its fixtures use generatedAtPolicy 'none'.
import {
  buildSmartReplacementRecommendations,
  type SmartReplacementPriority,
} from '../src/engines/smartReplacementEngine';
import type { AppData, ExercisePrescription, TrainingSession, TrainingTemplate } from '../src/models/training-model';
// SR-1 — exercise-library data port parity slice. Imports the REAL frozen
// library tables (src/data/exerciseLibrary.ts) so the library-snapshot golden
// is GENERATED from TS truth, never hand-authored (§22). The Swift port mirrors
// these four tables + the pure resolve/format functions; the golden
// mechanically reconciles every entry. Only the KEY SET of
// EXERCISE_KNOWLEDGE_OVERRIDES is snapshotted (it is the
// resolveExerciseReferenceToId known-id fast path) — the override VALUES
// (engine knowledge) are NOT ported here; that is SR-2/3.
import {
  EXERCISE_DISPLAY_NAMES,
  EXERCISE_ENGLISH_NAMES,
  EXERCISE_EQUIPMENT_TAGS,
  EXERCISE_ALIASES,
  EXERCISE_EQUIVALENCE_CHAINS,
  EXERCISE_KNOWLEDGE_OVERRIDES,
  type ExerciseEquipmentTag,
} from '../src/data/exerciseLibrary';
// SR-2 — replacement-engine port parity slice. Imports the REAL engine functions
// (buildReplacementOptions / validateReplacementExerciseId /
// isSyntheticReplacementExerciseId) so the replacement-engine goldens are
// GENERATED from TS truth, never hand-authored (§22). The Swift port
// (ReplacementEngine / ReplacementEngineKnowledge) reproduces the SAME outputs and
// transcribes the engine-used EXERCISE_EQUIVALENCE_CHAINS / EXERCISE_KNOWLEDGE_OVERRIDES
// subset — both reconciled item-by-item. Does NOT touch the WRITE PATH
// (applyExerciseReplacement / restoreOriginalExercise) or smartReplacement (SR-3).
import {
  buildReplacementOptions,
  isSyntheticReplacementExerciseId,
  validateReplacementExerciseId,
  type ReplacementContext,
} from '../src/engines/replacementEngine';
// iOS-17e-1 — per-exercise e1RM engine port parity slice. Imports the REAL
// e1rmEngine functions so the e1rm goldens are GENERATED from TS truth, never
// hand-authored (§22). The Swift port (E1RMEngine) reproduces the SAME outputs
// over the SAME echoed engineInput.history / probe inputs — reconciled
// function-by-function (poolId / estimate / profile / confidence). PURE — no
// write path, no decision-output wiring (that is 17e-5).
import {
  getExerciseRecordPoolId,
  estimateOneRepMaxForExercise,
  buildE1RMProfile,
  getE1RMConfidence,
} from '../src/engines/e1rmEngine';
// iOS-17e-2 — adaptiveFeedbackEngine performance-lookup port parity slice. Imports
// the REAL performance-lookup functions so the adaptive-feedback goldens are
// GENERATED from TS truth, never hand-authored (§22). The Swift port
// (AdaptiveFeedbackEngine) re-runs the ported functions over the SAME echoed
// engineInput.history + screening seed and asserts equality function-by-function
// (findLast/findPrevious/findRecent snapshots + buildAdaptiveState issueScores /
// painByExercise / performanceDrops / improvingIssues / moduleDose). PURE — no write
// path, no decision-output wiring (that is 17e-5). `buildAdaptiveState` stamps
// `lastUpdated` from the wall clock, so the generator substitutes the deterministic
// clock date below (mirrors generateDataRepair omitting the clock-derived createdAt).
import {
  findLastPerformance,
  findPreviousPerformance,
  findRecentPerformances,
  buildAdaptiveState,
} from '../src/engines/adaptiveFeedbackEngine';
import type { PerformanceSnapshot } from '../src/models/training-model';
import { DEFAULT_SCREENING_PROFILE } from '../src/data/defaults';
// PA-S3 — trainingData data-constant port parity slice. Imports the REAL frozen
// data constants (src/data/defaults.ts DEFAULT_PROGRAM_TEMPLATE +
// src/data/defaultTemplates.ts INITIAL_TEMPLATES + src/data/supportModules.ts
// CORRECTION_MODULES / FUNCTIONAL_ADDONS; DEFAULT_SCREENING_PROFILE above) so the
// default-program-data snapshot golden is GENERATED from TS truth, never hand-
// authored (§22). INITIAL_TEMPLATES carries the REAL makeExercise output
// (alternativeIds/alternativePriorities derived from the REAL
// EXERCISE_KNOWLEDGE_OVERRIDES), so the Swift port (DefaultTrainingData /
// SupportModules), which reuses the SR-1/SR-2 entry points, reconciles every
// template/module/exercise field item-by-item. Pure data, no clock →
// generatedAtPolicy 'none'.
import { DEFAULT_PROGRAM_TEMPLATE } from '../src/data/defaults';
import { INITIAL_TEMPLATES } from '../src/data/defaultTemplates';
import { CORRECTION_MODULES, FUNCTIONAL_ADDONS } from '../src/data/supportModules';
import { number, setWeightKg } from '../src/engines/engineUtils';
// PA-S2 — engineUtils enrichExercise/buildExerciseMetadata port parity slice. Imports
// the REAL enrich functions so the enrich-exercise goldens are GENERATED from TS truth,
// never hand-authored (§22). The Swift port (EngineUtils.enrichExercise /
// buildExerciseMetadata) reproduces the SAME outputs over the SAME echoed input
// exercises. The fixture uses SYNTHETIC ids absent from EXERCISE_KNOWLEDGE_OVERRIDES /
// EXERCISE_EQUIVALENCE_CHAINS, so the REAL TS engine runs the EMPTY-seam (default-branch)
// logic — exactly the branch this slice ports; the override DATA tables are PA-S3. PURE —
// no write path, no clock.
import { enrichExercise, buildExerciseMetadata } from '../src/engines/engineUtils';
// iOS-17e-3 — progressionRulesEngine progressive-suggestion port parity slice.
// Imports the REAL makeSuggestion / shouldUseTopBackoff / buildSetPrescription so the
// progression-suggestion goldens are GENERATED from TS truth, never hand-authored
// (§22). The Swift port (ProgressionRulesEngine) re-runs the ported functions over
// the SAME echoed engineInput.exercise + history and asserts equality function-by-
// function (suggestion weight/reps/lastSummary/targetSummary/note + shouldUseTopBackoff
// + setPrescription top/backoff weight+reps+summary). PURE — no write path, no
// decision-output wiring (that is 17e-5).
//
// fineTune NEUTRALITY: makeSuggestion calls buildSetWeightFineTune WITHOUT asOfDate
// (setWeightFineTuneEngine.ts:119 → wall clock). These fixtures anchor their history
// far in the past (old deterministicClockIso) so the live 8-week window is ALWAYS
// empty → fineTune returns 'insufficient_history' and applyFineTuneIfDataRich
// (progressionRulesEngine.ts:88) is a no-op → byte-deterministic golden regardless of
// generation time. We import buildSetWeightFineTune ONLY to echo that fallbackReason
// so the parity test can assert the deferral premise holds (the live projection port
// is a later slice; the Swift port DEFERS it golden-neutral, mirroring the
// TrainingDecisionExercisePrescription precedent).
import {
  makeSuggestion,
  shouldUseTopBackoff,
  buildSetPrescription,
} from '../src/engines/progressionRulesEngine';
import { buildSetWeightFineTune } from '../src/engines/setWeightFineTuneEngine';
// iOS-17e-4 — setWeightFineTuneEngine + loadFeedbackEngine port parity slice.
// Imports the REAL buildSetWeightFineTune (above) + the loadFeedbackEngine functions
// so the fine-tune / load-feedback goldens are GENERATED from TS truth, never hand-
// authored (§22). The Swift ports (SetWeightFineTuneEngine / LoadFeedbackEngine) re-run
// the ported functions over the SAME echoed engineInput and assert equality function-
// by-function (suggestedWeightKg + basis; collect/summary/adjustment + upsert array).
// PURE — every fine-tune fixture passes an explicit asOfDate (= the deterministic
// clock) so the goldens are byte-deterministic; no write path, no decision-output
// wiring (that is 17e-5).
import {
  collectLoadFeedback,
  upsertLoadFeedback,
  buildLoadFeedbackSummary,
  getLoadFeedbackAdjustment,
} from '../src/engines/loadFeedbackEngine';
import type { LoadFeedback, LoadFeedbackValue } from '../src/models/training-model';
// AN-1 — leaf-analytics engines parity slice. Imports the REAL pure analytics engines
// (trainingStreakEngine / recentPRDeltaEngine / weeklyMuscleBalanceEngine) so the
// analytics goldens are GENERATED from TS truth, never hand-authored (§22). Each engine
// is PURE + clockless given an injected `options.nowIso` (every analytics fixture passes
// the deterministic clock, so the goldens are byte-deterministic). The Swift ports
// (TrainingStreakEngine / RecentPRDeltaEngine / WeeklyMuscleBalanceEngine) re-run the
// ported functions on the SAME echoed engineInput.history + options and COMPUTE-ASSERT
// the result function-by-function (streak counts / PR-delta list+order / muscle-balance
// entries). PURE — no write path, no decision-output wiring.
import { computeTrainingStreak } from '../src/engines/trainingStreakEngine';
import { computeRecentPRDeltas } from '../src/engines/recentPRDeltaEngine';
import { computeWeeklyMuscleBalance } from '../src/engines/weeklyMuscleBalanceEngine';
// AN-2 — plateauDetectionEngine parity slice. Imports the REAL detectExercisePlateau so
// the plateau goldens are GENERATED from TS truth, never hand-authored (§22). The engine
// is PURE + clockless (every date comparison is over the session's OWN date strings; no
// `new Date()` / Date.now() anywhere in its path), so its history fixtures derive their
// session dates from the deterministic clock and the goldens are byte-deterministic. The
// Swift port (PlateauDetectionEngine) re-runs detectExercisePlateau on the SAME echoed
// engineInput (history + optional external summaries) and COMPUTE-ASSERTs the result
// (status / signals / suggestedActions / title / summary / confidence) == golden.
import { detectExercisePlateau } from '../src/engines/plateauDetectionEngine';
// AN-3 — effectiveSetEngine (analytics-consumed subset) + analytics.ts dashboard parity
// slice. Imports the REAL effective-set + analytics functions so the goldens are GENERATED
// from TS truth, never hand-authored (§22). The Swift ports (EffectiveSetEngine /
// AnalyticsDashboardEngine) re-run the SAME functions over each case's echoed engineInput and
// COMPUTE-ASSERT the result. PURE / clockless apart from buildWeeklyReport's INJECTED
// `options.nowIso` (= the deterministic clock) so its 7-day-window golden is byte-deterministic.
import {
  evaluateEffectiveSet,
  countEffectiveSets,
  getMuscleContribution,
  buildEffectiveVolumeSummary,
} from '../src/engines/effectiveSetEngine';
import {
  buildMuscleVolumeDashboard,
  buildExerciseTrend,
  trendStatus,
  buildPrs,
  buildWeeklyReport,
  buildAdherenceReport,
  CORE_TREND_EXERCISES,
} from '../src/engines/analytics';
import type { BodyWeightEntry } from '../src/models/training-model';
// AN-4 — sessionDetailSummaryEngine (sessionQuality-consumed subset) + sessionQualityEngine
// port parity slice. Imports the REAL engine functions so the session-quality goldens are
// GENERATED from TS truth, never hand-authored (§22). The Swift ports (SessionDetailSummaryEngine /
// SessionQualityEngine) re-run the SAME functions over each case's echoed engineInput and
// COMPUTE-ASSERT the result (buildSessionQualityResult full result + groupSessionSetsByType /
// buildWorkingOnlySession structural probes). PURE / clockless — every session date derives from
// parityMeta.deterministicClockIso so the goldens are byte-deterministic.
import { buildSessionQualityResult } from '../src/engines/sessionQualityEngine';
import {
  groupSessionSetsByType,
  buildWorkingOnlySession,
} from '../src/engines/sessionDetailSummaryEngine';
// AN-5 — painPatternEngine (trainingLevel-consumed subset) + trainingLevelEngine port
// parity slice. Imports the REAL engine functions so the pain-pattern / training-level
// goldens are GENERATED from TS truth, never hand-authored (§22). The Swift ports
// (PainPatternEngine / TrainingLevelEngine) re-run the SAME functions over each case's
// echoed engineInput and COMPUTE-ASSERT the result (buildPainPatterns full pattern list +
// buildTrainingLevelAssessment full assessment + buildTechniqueQualitySummary /
// formatAutoTrainingLevel probes). PURE / clockless — every session date derives from
// parityMeta.deterministicClockIso so the goldens are byte-deterministic.
import { buildPainPatterns } from '../src/engines/painPatternEngine';
import {
  buildTrainingLevelAssessment,
  buildTechniqueQualitySummary,
  formatAutoTrainingLevel,
} from '../src/engines/trainingLevelEngine';
// AN-5b — recommendationConfidenceEngine + volumeAdaptationEngine port parity slice (the two
// AN-6 intelligenceSummary leaves not yet ported). Imports the REAL engine functions so the
// recommendation-confidence / volume-adaptation goldens are GENERATED from TS truth, never
// hand-authored (§22). The Swift ports (RecommendationConfidenceEngine / VolumeAdaptationEngine)
// re-run the SAME functions over each case's echoed engineInput and COMPUTE-ASSERT the result.
// recommendation-confidence is PURE / clockless apart from history dates derived from
// parityMeta.deterministicClockIso; volume-adaptation consumes only opaque summaries (no clock).
import { buildRecommendationConfidence } from '../src/engines/recommendationConfidenceEngine';
import { buildVolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
// AN-6 — trainingIntelligenceSummaryEngine TOP-LEVEL port parity slice (closes the analysis
// engine layer). Imports the REAL buildTrainingIntelligenceSummary so the intelligence-summary
// goldens are GENERATED from TS truth, never hand-authored (§22). The top aggregator consumes
// the already-ported AN-1~5 leaves (sessionQuality / recommendationConfidence / plateau /
// volumeAdaptation / e1rm / filterAnalyticsHistory / replacement / formatExerciseName) and
// re-emits their results + derived keyInsights/recommendedActions. The Swift port
// (TrainingIntelligenceSummaryEngine) re-runs buildTrainingIntelligenceSummary over each case's
// echoed engineInput and COMPUTE-ASSERTs the FULL summary (sessionQuality? +
// recommendationConfidence[] + plateauResults[] + volumeAdaptation + keyInsights +
// recommendedActions) == golden. PURE / clockless apart from history dates derived from
// parityMeta.deterministicClockIso.
import { buildTrainingIntelligenceSummary } from '../src/engines/trainingIntelligenceSummaryEngine';
// PA-S0 — i18n/terms data port parity slice. Imports the REAL frozen label
// tables (src/i18n/terms.ts) so the terms-snapshot golden is GENERATED from TS
// truth, never hand-authored (§22). terms.ts is the one clean leaf of the PA
// track (zero imports, zero runtime logic — pure `as const` label data). The
// Swift port (IronPathL10n.Terms) mirrors these 11 tables + term(); the golden
// mechanically reconciles every entry item-by-item. No engine call, no clock →
// generatedAtPolicy 'none'.
import {
  TERMS,
  PHASE_LABELS,
  EFFECTIVE_PHASE_DISPLAY_LABELS,
  INTENSITY_BIAS_LABELS,
  TECHNIQUE_QUALITY_LABELS,
  SUPPORT_BLOCK_LABELS,
  SKIP_REASON_LABELS,
  DELOAD_LEVEL_LABELS,
  DELOAD_STRATEGY_LABELS,
  READINESS_ADJUSTMENT_LABELS,
  MUSCLE_LABELS,
  term,
} from '../src/i18n/terms';
// PA-S4 — i18n/formatters PA-subset port parity slice. Imports the REAL
// formatters (src/i18n/formatters.ts) so the formatters-pa snapshot golden is
// GENERATED from TS truth, never hand-authored (§22). Only the 3 formatters the
// programAdjustmentEngine consumes are exercised here (formatProgramTemplateName
// / formatDayTemplateName / formatAdjustmentChangeLabel). Their private tables
// (TEMPLATE_NAME_MAP / the inline change-label record) are NOT exported by
// formatters.ts, so the golden reconstructs them by routing each key through the
// REAL formatter (every key normalizes to itself and hits the map, so the
// readback equals the raw table value). No engine call, no clock →
// generatedAtPolicy 'none'.
import {
  formatProgramTemplateName,
  formatDayTemplateName,
  formatAdjustmentChangeLabel,
} from '../src/i18n/formatters';
// iOS-4B0: synthetic AppData builders reused from the test fixture helpers so
// the expanded TrainingDecision parity fixtures stay small + deterministic +
// engine-valid. tests/fixtures.ts is plain TS (no test-runner imports) and
// bundles cleanly under `vite build --ssr`.
import { makeAppData, makeSession, makeStatus, getTemplate } from '../tests/fixtures';
// PA-S5 — coachActionIdentityEngine fingerprint port parity slice. Imports the REAL
// pure FNV-1a fingerprint functions so the coach-action-identity goldens are GENERATED
// from TS truth, never hand-authored (§22). The Swift port (CoachActionIdentityEngine)
// re-runs the SAME functions over the SAME echoed engineInput (action+context / draft /
// item / drafts) and EXACT-asserts each fingerprint string + the deduped id order.
// PURE / clockless — zero Date, no write path → generatedAtPolicy 'none'. Only the
// 7-field FingerprintAction Pick (ts:4-7) is exercised; coachActionEngine is NOT imported.
import {
  buildCoachActionFingerprint,
  buildProgramAdjustmentDraftFingerprint,
  buildProgramAdjustmentHistoryFingerprint,
  dedupeProgramAdjustmentDraftsByFingerprint,
  type CoachActionFingerprintContext,
} from '../src/engines/coachActionIdentityEngine';
import type { ProgramAdjustmentDraft, ProgramAdjustmentHistoryItem } from '../src/models/training-model';
// PA-S6 — planAdjustmentIdentityEngine port parity slice. Imports the REAL pure
// identity functions so the plan-adjustment-identity goldens are GENERATED from TS
// truth, never hand-authored (§22). The Swift port (PlanAdjustmentIdentityEngine)
// re-runs the SAME functions over the SAME echoed engineInput (input/action+context/
// draft/item/change → fingerprint, sourceFingerprint+revision+parentDraftId →
// instanceId, drafts+history+candidate → upsert result, sourceDraft+drafts →
// findReusable/regenerate) and EXACT/canonical-asserts each output. PURE / read-only;
// only `buildRegeneratedPlanAdjustmentDraft` is time-aware and takes an INJECTED now
// (no wall clock) → the regenerate fixture uses generatedAtPolicy 'deterministic-clock';
// the rest are clockless ('none'). Reuses the PA-S5 fingerprint family + PA-S1 types.
import {
  buildPlanAdjustmentFingerprint,
  buildPlanAdjustmentFingerprintFromCoachAction,
  buildPlanAdjustmentFingerprintFromDraft,
  buildPlanAdjustmentFingerprintFromHistory,
  buildPlanAdjustmentFingerprintFromChange,
  buildPlanAdjustmentDraftInstanceId,
  upsertPlanAdjustmentDraftByFingerprint,
  findReusablePlanAdjustmentDraft,
  buildRegeneratedPlanAdjustmentDraft,
  dedupePlanAdjustmentDraftsByFingerprint,
} from '../src/engines/planAdjustmentIdentityEngine';
import type { AdjustmentChange } from '../src/models/training-model';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// The "phase19b-" prefix used by buildAppDataSnapshotHash. The parity
// tests assert any snapshot-hash golden carries this prefix.
const SNAPSHOT_HASH_PREFIX = 'phase19b-';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const INPUT_ROOT = resolve(REPO_ROOT, 'tests/fixtures/parity/inputs');
const GOLDEN_ROOT = resolve(REPO_ROOT, 'tests/fixtures/parity/golden');

const GENERATOR_VERSION = 'v1';

const FIXTURE_IDS = [
  'app-data/snapshot-hash-stable-v1',
  'training-decision/normal-session-v1',
  'data-repair/session-lifecycle-residue-v1',
  'real-export/redacted-2026-05-27',
  'focus-mode/golden-path-session-v1',
  // iOS-4B0 TrainingDecision parity fixture expansion — synthetic inputs that
  // each lock a distinct engine path before the Swift TrainingDecision port.
  'training-decision/severe-rest-v1',
  'training-decision/controlled-reload-v1',
  'training-decision/deload-week-v1',
  'training-decision/stale-today-status-v1',
  'training-decision/stale-health-data-v1',
  'training-decision/restart-28d-gap-v1',
  'training-decision/productive-floor-v1',
  'training-decision/no-legacy-advice-v1',
  'training-decision/clean-input-contract-v1',
  // iOS-17e-0 progression parity scaffold — 3 synthetic fixtures whose history
  // carries performed sets (history[].exercises[].sets non-empty) so the REAL
  // TS engine emits its history-driven adaptive output (progressionMode /
  // weeklyAdjustment). They route through the SAME generateTrainingDecisionExpanded
  // projection as the iOS-4B0 fixtures (no new golden shape). The Swift side
  // DECODE-ONLY-pins these (compute-assert lands as 17e-1~5 port the progression
  // cluster — the static native template cannot reproduce them yet). Additive;
  // generated, never hand-edited (§22).
  'training-decision/progressive-overload-v1',
  'training-decision/plateau-stall-v1',
  'training-decision/insufficient-history-v1',
  // SR-0 smart-replacement parity scaffold — 4 synthetic fixtures whose
  // generated goldens collectively cover all four SmartReplacementPriority
  // values (primary / secondary / angle_variation / avoid). Engine logic is
  // ported in SR-1+; SR-0 builds only the parity pipeline.
  'smart-replacement/explicit-priority-spread-v1',
  'smart-replacement/bench-press-natural-v1',
  'smart-replacement/low-readiness-fatigue-v1',
  'smart-replacement/pain-history-substitute-v1',
  // SR-1 exercise-library data port — one snapshot golden that dumps the four
  // frozen library tables (display/english/equipment/alias) keyed by id, plus
  // the EXERCISE_KNOWLEDGE_OVERRIDES key set, so the Swift port reconciles every
  // entry item-by-item. Additive; generated, never hand-edited (§22).
  'exercise-library/library-snapshot-v1',
  // SR-2 replacement-engine port — 1 knowledge snapshot (the engine-used
  // EXERCISE_EQUIVALENCE_CHAINS + EXERCISE_KNOWLEDGE_OVERRIDES subset, reconciled
  // item-by-item) + 4 OUTPUT fixtures whose generated goldens pin
  // buildReplacementOptions / validateReplacementExerciseId /
  // isSyntheticReplacementExerciseId across the explicit-alternatives,
  // chain-derivation, equipment-context, and validation/synthetic branches. The
  // Swift port runs the SAME engine and must reproduce every result. Additive;
  // generated, never hand-edited (§22).
  'replacement-engine/knowledge-snapshot-v1',
  'replacement-engine/bench-press-explicit-v1',
  'replacement-engine/lat-pulldown-equipment-v1',
  'replacement-engine/hack-squat-chain-v1',
  'replacement-engine/validation-synthetic-v1',
  // iOS-17e-1 per-exercise e1RM port — 5 OUTPUT fixtures whose generated goldens
  // FUNCTION-LEVEL pin the ported e1rmEngine: each echoes the engineInput history
  // + probe inputs and the REAL TS outputs (buildE1RMProfile / estimateOneRepMaxForExercise
  // per-exercise estimate + getExerciseRecordPoolId pool-id probes + getE1RMConfidence
  // probes). The Swift E1RMEngine re-runs the ported functions on the SAME inputs and
  // asserts equality. progressive-overload (median_recent current + high best) /
  // plateau-stall (flat trend) / insufficient-history (single_recent low) /
  // low-quality-filtered (low-confidence branches + filterAnalyticsHistory exclusion of
  // a test-flagged + a backfilled session) / pool-confidence-probes (all
  // getExerciseRecordPoolId + getE1RMConfidence branches). Generated; never hand-edited (§22).
  'e1rm-engine/progressive-overload-v1',
  'e1rm-engine/plateau-stall-v1',
  'e1rm-engine/insufficient-history-v1',
  'e1rm-engine/low-quality-filtered-v1',
  'e1rm-engine/pool-confidence-probes-v1',
  // iOS-17e-2 adaptiveFeedbackEngine performance-lookup port — 4 OUTPUT fixtures
  // whose generated goldens FUNCTION-LEVEL pin the ported performance-lookup engine:
  // each echoes the engineInput history + screening issueScores seed and the REAL TS
  // outputs (findLast/findPrevious/findRecent snapshot projections + buildAdaptiveState).
  // performance-drop (drop branch + baseline moduleDose) / pain-accumulation (both
  // hasPainFlag branches + multi-rule duplicate issue bump + boost/baseline) /
  // improving-and-seed (improve branch + seeded issueScores merge + boost/taper) /
  // lookup-edge (findLast/findPrevious-skip/findRecent-limit edge probes + no-op
  // buildAdaptiveState). Generated; never hand-edited (§22).
  'adaptive-feedback/performance-drop-v1',
  'adaptive-feedback/pain-accumulation-v1',
  'adaptive-feedback/improving-and-seed-v1',
  'adaptive-feedback/lookup-edge-v1',
  // iOS-17e-3 progressionRulesEngine progressive-suggestion port — 6 OUTPUT fixtures
  // whose generated goldens FUNCTION-LEVEL pin the ported progressionRulesEngine: each
  // echoes the engineInput (templateExercise + history) and the REAL TS outputs
  // (makeSuggestion weight/reps/lastSummary/targetSummary/note + shouldUseTopBackoff +
  // buildSetPrescription top/backoff weight+reps+summary), plus a fineTuneNeutrality
  // guard proving the deferred live fineTune projection is inert (insufficient_history).
  // no-history-baseline (first-session baseline + conservative + isolation rangeNote) /
  // increase-double-top (hit-ceiling twice → +increment) / hold-stable (hold at top) /
  // backoff-volume-drop (volume regression backoff) / backoff-technique-streak (poor
  // technique streak backoff + regression hint) / top-backoff-compound (top+backoff set
  // prescription). The Swift ProgressionRulesEngine re-runs the ported functions on the
  // SAME inputs and asserts equality. Generated; never hand-edited (§22).
  'progression-suggestion/no-history-baseline-v1',
  'progression-suggestion/increase-double-top-v1',
  'progression-suggestion/hold-stable-v1',
  'progression-suggestion/backoff-volume-drop-v1',
  'progression-suggestion/backoff-technique-streak-v1',
  'progression-suggestion/top-backoff-compound-v1',
  // iOS-17e-6a fineTune LIVE — 2 NEW function-level fixtures that pass an injected
  // asOfDate (= deterministicClockIso) over RECENT in-window history so the ported
  // SetWeightFineTuneEngine projection actually FIRES (the 17e-3 stub is removed). They
  // exercise the live applyFineTuneIfDataRich body: `fine-tune-uptrend-applied` returns the
  // ±10%-clamped / 2.5-rounded projection (legacy-respect skipped) and PROVES the live path
  // changes the output vs the nil/legacy baseline; `fine-tune-legacy-respect` fires the
  // legacy-respect guard (flat trend defers to legacy) while a data-rich fineTuneNeutrality
  // proves the projection RAN. Additive; generated, never hand-edited (§22).
  'progression-suggestion/fine-tune-uptrend-applied-v1',
  'progression-suggestion/fine-tune-legacy-respect-v1',
  // iOS-17e-4 setWeightFineTuneEngine port — 4 OUTPUT fixtures whose generated goldens
  // FUNCTION-LEVEL pin the ported setWeightFineTuneEngine: each echoes the engineInput
  // (scalar fine-tune params + history) and the REAL TS buildSetWeightFineTune output
  // (suggestedWeightKg + basis: samplesUsed/windowWeeks/currentE1rmKg/projectedE1rmKg/
  // weeklySlopeKg/fallbackReason), plus param-only probes over the same history. The
  // Swift SetWeightFineTuneEngine re-runs the ported function on the SAME inputs and
  // asserts equality. upward-trend (uncapped + non-noisy) / downward-capped (lower
  // clamp) / noisy-trend (noisy_trend + trim + upper clamp + rir/reps/window filters) /
  // insufficient-history (< MIN_SAMPLES + 0-sample + clamp). Every fixture passes an
  // explicit asOfDate so the goldens are byte-deterministic. Generated; never hand-edited (§22).
  'set-weight-fine-tune/upward-trend-v1',
  'set-weight-fine-tune/downward-capped-v1',
  'set-weight-fine-tune/noisy-trend-v1',
  'set-weight-fine-tune/insufficient-history-v1',
  // iOS-17e-4 loadFeedbackEngine port — 3 OUTPUT fixtures whose generated goldens
  // FUNCTION-LEVEL pin the ported loadFeedbackEngine: collect-summary (collectLoadFeedback
  // ordering/dataFlag filter/exerciseId filter/slice + buildLoadFeedbackSummary counts/
  // dominant/total + adjustment) / adjustment-branches (getLoadFeedbackAdjustment
  // conservative + slightly_aggressive + normal-default) / upsert (upsertLoadFeedback
  // insert/insert-with-note/replace-keep-others-append). The Swift LoadFeedbackEngine
  // re-runs the ported functions on the SAME inputs and asserts equality. Generated;
  // never hand-edited (§22).
  'load-feedback/collect-summary-v1',
  'load-feedback/adjustment-branches-v1',
  'load-feedback/upsert-v1',
  // AN-1 leaf-analytics engines port — 3 OUTPUT fixtures (one per metric) whose generated
  // goldens FUNCTION-LEVEL pin the ported analytics engines. Each carries a `cases` array;
  // every case echoes its engineInput (history + options) and the REAL TS engine output, and
  // the Swift port re-runs the ported function on the SAME inputs and asserts equality.
  // training-streak (no-history / active-week / carry-last-week / broken-streak / filtering+
  // months) / recent-pr-delta (up-down-flat / new+skip / sort-new-first+limit / window-
  // boundary+pickBest-tie) / weekly-muscle-balance (no-data / balanced / imbalanced over+
  // under / muscleContribution+secondary+filtering). Generated; never hand-edited (§22).
  'training-streak/streak-cases-v1',
  'recent-pr-delta/delta-cases-v1',
  'weekly-muscle-balance/balance-cases-v1',
  // AN-1b boundary/coverage-debt fixtures — additive NEW fixtures (one per metric, run
  // through the SAME three generators) pinning the AN-1 audit's untested branches
  // (finishedAt-precedence + full-ISO→noon safeDate + non-Monday week start / prevMonthKey
  // cross-year underflow / sort both-new NaN-tie + equal-deltaKg tie / pickBest full-equality
  // tie / non-focus muscle + Map insertion order + count<2 + ±12 threshold) AND the
  // `roundToFixed` `.XX5` ties that exercise the AN-1b fidelity fix (deltaKg 5.55 /
  // effectiveSets 2.67 — the old multiply-then-round would mis-round these). Generated;
  // never hand-edited (§22).
  'training-streak/streak-boundary-cases-v1',
  'recent-pr-delta/delta-boundary-cases-v1',
  'weekly-muscle-balance/balance-boundary-cases-v1',
  // AN-2 plateauDetectionEngine port — 2 OUTPUT fixtures (each a `cases` array) FUNCTION-
  // LEVEL pinning the ported detectExercisePlateau. plateau-status-cases covers ALL eight
  // PlateauStatus values (none / possible_plateau / plateau / fatigue_limited /
  // technique_limited / volume_limited / load_too_aggressive / insufficient_data) via the
  // status-arbitration precedence; plateau-boundary-cases pins the branch/coverage debt
  // (count<4 sets/perf boundaries + flatE1rm-via-recentValues + e1rm current/best & e1rmKg
  // union shapes + painPatterns-param fatigue + techniqueQualitySummary-param override +
  // loadFeedback array / summary-object / record-of-values input shapes). Generated; never
  // hand-edited (§22).
  'plateau-detection/plateau-status-cases-v1',
  'plateau-detection/plateau-boundary-cases-v1',
  // AN-3 effectiveSetEngine (analytics-consumed subset) + analytics.ts dashboard port — 7
  // OUTPUT fixtures (each a `cases` array) FUNCTION-LEVEL pinning the ported functions.
  // effective-set: evaluate-cases (evaluateEffectiveSet every flag/score/confidence branch) +
  // volume-summary-cases (buildEffectiveVolumeSummary byMuscle/reasons/dateRange/dataFlag/
  // corrective+functional skip/rounding + countEffectiveSets + getMuscleContribution probes).
  // analytics: muscle-volume-dashboard-cases (status low/near/on/high + target≤0 + weekStart vs
  // slice(0,7) + notes + sort) · exercise-trend-cases (buildExerciseTrend topSet/slice(0,6)/filter
  // + trendStatus 数据不足/推进中/回落/可能停滞 + CORE_TREND_EXERCISES) · prs-cases (buildPrs
  // maxWeight/fixedReps/sessionTotals/estimatedMaxes + quality + sort+slice(0,8)) · weekly-report-
  // cases (buildWeeklyReport injected-nowIso 7-day window + focus + latestWeight) · adherence-
  // report-cases (buildAdherenceReport rates/suggestions/confidence/skipped + supportPlannedFromBlock).
  // Generated; never hand-edited (§22).
  'effective-set/evaluate-cases-v1',
  'effective-set/volume-summary-cases-v1',
  'analytics/muscle-volume-dashboard-cases-v1',
  'analytics/exercise-trend-cases-v1',
  'analytics/prs-cases-v1',
  'analytics/weekly-report-cases-v1',
  'analytics/adherence-report-cases-v1',
  // AN-8 sort-stability tie fixture — an ADDITIVE (§22) single-case fixture whose
  // skippedExercises count tie pins the JS-stable insertion order the Swift stableSorted
  // port reproduces (Array.sort is not contractually stable). Generated, never hand-edited.
  'analytics/adherence-report-tie-cases-v1',
  // AN-4 sessionDetailSummaryEngine (sessionQuality-consumed subset) + sessionQualityEngine
  // port — 2 OUTPUT fixtures (each a `cases` array) FUNCTION-LEVEL pinning the ported functions.
  // quality-cases pins buildSessionQualityResult across the level/signal/confidence/early-return
  // branches (insufficient_data / high / medium / low + every positive+issue signal + score caps +
  // confidence bands); grouping-and-input-cases pins groupSessionSetsByType classification
  // (warmup by type/isWarmup/:warmup: id/setType+stepType · support→uncategorized · inferred
  // working · focusWarmup merge+dedup · supportExerciseLogs passthrough) + buildWorkingOnlySession
  // reconstruction (dataFlag→normal · focusWarmup cleared · set type→straight) AND the
  // normalizeLoadFeedback union shapes (LoadFeedback[] / LoadFeedbackSummary / record-of-values /
  // session.loadFeedback) + painPatterns match + effectiveSetSummary provided-vs-computed +
  // number-form prescription/sets. Each case echoes the result + a `grouped`/`workingOnly` probe
  // so the two sessionDetail functions are pinned directly. Generated; never hand-edited (§22).
  'session-quality/quality-cases-v1',
  'session-quality/grouping-and-input-cases-v1',
  // AN-5 painPatternEngine (trainingLevel-consumed subset) + trainingLevelEngine port — 2
  // OUTPUT fixtures (each a `cases` array) FUNCTION-LEVEL pinning the ported functions.
  // pain-pattern/aggregation-cases pins buildPainPatterns across the suggestedAction matrix
  // (exercise watch/substitute/deload · area watch/deload/seek_professional · multi-area
  // combined), painSeverityFromSet (painSeverity>0 · note sharp/刺痛 → 4 · ache/酸 → 2 ·
  // default 2), the lookback-window + maxSessions slice, the excluded-dataFlag filter, and
  // the severityAvg-desc/frequency-desc stable sort. training-level/assessment-cases pins
  // buildTrainingLevelAssessment across the level bands (unknown count 0 / ≤2 · beginner ·
  // novice_plus · intermediate · advanced-attempt) + every signal (score/confidence/reason)
  // + the highPain/poorTechnique/lowAdherence/unstableFrequency limitations & downgrades +
  // readinessForAdvancedFeatures + nextDataNeeded, plus the provided-vs-computed override
  // short-circuit (painPatterns / techniqueQualitySummary / calendarData) and a
  // buildTechniqueQualitySummary + formatAutoTrainingLevel probe per case. Generated; never
  // hand-edited (§22).
  'pain-pattern/aggregation-cases-v1',
  'training-level/assessment-cases-v1',
  // AN-5b recommendationConfidenceEngine + volumeAdaptationEngine port — the two AN-6
  // intelligenceSummary leaves (trainingIntelligenceSummaryEngine.ts:225 recommendationConfidence +
  // :246 buildVolumeAdaptationReport) not yet ported. 2 OUTPUT fixtures (each a `cases` array)
  // FUNCTION-LEVEL pinning the ported functions. recommendation-confidence/assessment-cases pins
  // buildRecommendationConfidence across the level bands (forced-low at ≤1 session · high ·
  // medium-plain) + every reason branch (history sparse/stable/building · technique
  // missing/stable/poor · rir missing/complete/incomplete · pain-pattern/no-pain · load-feedback
  // volatile/stable-good-dominant/stable-other/total-0 · e1rm high-quality/low-confidence/medium/
  // absent · effective-sets stable/weak · recent-replacement · recent-edits + the 92 cap ·
  // mixed-units-sparse · training-baseline) + the pain 74 cap + the loadFeedback array/summary/
  // record-of-values + recentEdits number/array union shapes + the no-exerciseId match-all path.
  // volume-adaptation/report-cases pins buildVolumeAdaptationReport across every decision
  // (insufficient_data no-evidence + dataSparse · hold trainingLevelUnknown + final-inconsistent ·
  // decrease volumeHigh + strongRisk-multi · increase volumeLow · maintain nearTarget) + the
  // confidence bands + formatMuscleName (mapped/unmapped→未标注肌群/row.muscleName override/byMuscle
  // lookup) + the weeklyVolumeSummary array vs {muscles} shapes + multi-muscle summaryParts.
  // Generated; never hand-edited (§22).
  'recommendation-confidence/assessment-cases-v1',
  'volume-adaptation/report-cases-v1',
  // AN-6 trainingIntelligenceSummaryEngine TOP-LEVEL port — 1 OUTPUT fixture (a `cases` array)
  // FUNCTION-LEVEL pinning the ported buildTrainingIntelligenceSummary. The cases jointly cover
  // the summary's branches: empty (no latest/history → fallback insight + keep-observing
  // '继续记录训练') · high-quality latest (sessionQuality high insight, no review-latest action) ·
  // low-quality latest (review-latest action + quality insight) · important plateau (review-exercise
  // action + plateau insight + label-from-history) · volume increase/decrease (review-volume +
  // create-adjustment-preview actions + volume insight) · volume hold (insight only, no action) ·
  // pain patterns (fed to sessionQuality/plateau/recommendationConfidence/volumeAdaptation) ·
  // test-flagged latest (dataFlag filter → no sessionQuality, keep-observing '继续记录训练') ·
  // e1rmProfiles-driven + multi-exercise selection (slice(0,4) cap) · full-combo (every action +
  // keyInsights slice(0,4) cap). Each case echoes the engineInput + the full summary. Generated
  // from src/engines/trainingIntelligenceSummaryEngine.ts via scripts/generate-parity-goldens.mjs;
  // the Swift TrainingIntelligenceSummaryEngine compute-asserts each summary == golden. Generated;
  // never hand-edited (§22).
  'intelligence-summary/summary-cases-v1',
  // PA-S0 i18n/terms data port — 1 snapshot fixture dumping the eleven frozen
  // label tables (TERMS / PHASE_LABELS / EFFECTIVE_PHASE_DISPLAY_LABELS /
  // INTENSITY_BIAS_LABELS / TECHNIQUE_QUALITY_LABELS / SUPPORT_BLOCK_LABELS /
  // SKIP_REASON_LABELS / DELOAD_LEVEL_LABELS / DELOAD_STRATEGY_LABELS /
  // READINESS_ADJUSTMENT_LABELS / MUSCLE_LABELS) keyed by their TS keys + every
  // TERMS key routed through term(), so the Swift port (IronPathL10n.Terms)
  // reconciles every label entry-by-entry. Pure data, no clock. Generated;
  // never hand-edited (§22).
  'i18n/terms-snapshot-v1',
  // PA-S2 engineUtils enrichExercise/buildExerciseMetadata port — 1 OUTPUT fixture (a
  // `cases` array) FUNCTION-LEVEL pinning the ported enrich tools over the EMPTY override /
  // equivalence seam (synthetic ids, default branches). The Swift EngineUtils re-runs
  // enrichExercise/buildExerciseMetadata on each echoed input and reconciles metadata +
  // enriched field-by-field. The override DATA tables are PA-S3. Generated; never hand-edited (§22).
  'enrich-exercise/default-branches-v1',
  // PA-S3 trainingData data-constant port — 1 snapshot fixture dumping the six
  // frozen data constants (DEFAULT_PROGRAM_TEMPLATE + INITIAL_TEMPLATES with the
  // REAL makeExercise output + CORRECTION_MODULES + FUNCTIONAL_ADDONS +
  // DEFAULT_SCREENING_PROFILE) + per-constant counts, so the Swift port
  // (DefaultTrainingData / SupportModules) reconciles every template / module /
  // exercise / makeExercise field item-by-item (reusing the SR-1/SR-2 entry
  // points, never re-porting the override tables). Generated; never hand-edited (§22).
  'default-program-data/snapshot-v1',
  // PA-S4 i18n/formatters PA-subset port — 1 snapshot fixture dumping the two
  // private formatters.ts tables (TEMPLATE_NAME_MAP / the inline change-label
  // record, reconstructed by routing each key through the REAL formatter) +
  // per-table counts + a branch-covering probe set (input→output for
  // formatProgramTemplateName / formatDayTemplateName / formatAdjustmentChangeLabel),
  // so the Swift port (IronPathL10n.Formatters) reconciles every table entry +
  // every branch. formatExerciseName/formatMuscleName reuse the IronPathTrainingDecision
  // ported items; riskLevel/reviewStatus are not used by the PA engine and not ported.
  // Pure display, no clock. Generated; never hand-edited (§22).
  'i18n/formatters-pa-snapshot-v1',
  // PA-S5 coachActionIdentityEngine fingerprint port — 3 OUTPUT fixtures (each a
  // `cases` array) FUNCTION-LEVEL pinning the ported pure FNV-1a engine. Each case
  // echoes its engineInput + the REAL TS output; the Swift CoachActionIdentityEngine
  // re-runs the SAME function on the SAME input and EXACT-asserts the result string.
  // fingerprint-cases pins buildCoachActionFingerprint (context muscle/exercise/template
  // target precedence · action.targetType/targetId fallback · suggestedChange.muscleId/
  // exerciseIds[0] target fallback · all literal fallbacks coach-action/template-unknown/
  // muscle-none/exercise-none/current-cycle/target-none · suggestedChangeType add_sets/
  // remove_sets/swap_exercise/support_*/keep/none + fallback-wins · exerciseIds join ·
  // weekId vs cycleId · textDigest from reason/description/title + normalizePart regex
  // segments). draft-history-fingerprint-cases pins the two wrapper fns
  // (sourceFingerprint short-circuit · firstChange→targetFromChange muscle/exercise/
  // template/plan · sourceFromRecommendationId volume/plateau/recovery/default · the
  // HistoryItem mainChangeSummary/experimentalProgramTemplateName/'计划调整' fallback
  // chain). dedupe-cases pins dedupeProgramAdjustmentDraftsByFingerprint (skip
  // 'recommendation' · same-fingerprint rank win · rank-tie time win · computed-fingerprint
  // collapse · final time-DESC sort · equal-time JS-stable insertion order). PURE /
  // clockless → generatedAtPolicy 'none'. Generated; never hand-edited (§22).
  'coach-action-identity/fingerprint-cases-v1',
  'coach-action-identity/draft-history-fingerprint-cases-v1',
  'coach-action-identity/dedupe-cases-v1',
  // PA-S6 planAdjustmentIdentityEngine port — 4 fixtures, all routed through the single
  // dispatch-by-kind generatePlanAdjustmentIdentity. fingerprint-cases pins the 6
  // fingerprint exports (buildPlanAdjustmentFingerprint targetFromInput muscle/exercise/
  // template/plan precedence + suggestedChange.muscleId/exerciseIds[0] fallback +
  // sourceFromInput plateau/recovery/dataHealth/dailyAdjustment/default + the title/
  // description/reason '计划调整' fallback chains; FromCoachAction sourceFingerprint
  // short-circuit vs S5; FromDraft/FromHistory forwarders; FromChange field mapping +
  // change.reason||previewNote; the dedupe alias). instance-id-cases pins
  // buildPlanAdjustmentDraftInstanceId (stableIdPart regex/slice(0,48)/stableHash
  // empty-fallback + parentDraftId slice(0,24) + Math.max(1,Math.round(revision))
  // half-up/clamp boundaries). upsert-cases pins every upsert branch+outcome
  // (parent existingChild / activeDraft / appliedDraft / appliedHistory / handledDraft /
  // rolledBackDraft / create + newestDraft time-DESC tie + normalizeDraftForUpsert
  // revision + prepend-dedupe). regenerate-cases pins findReusablePlanAdjustmentDraft
  // (id-skip / fingerprint / reusable status / rolled_back parent guard) and
  // buildRegeneratedPlanAdjustmentDraft (existing short-circuit / nextRevision /
  // INJECTED now / cleared appliedAt+rolledBackAt+experimentalProgramTemplateId).
  // Generated, never hand-edited (§22).
  'plan-adjustment-identity/fingerprint-cases-v1',
  'plan-adjustment-identity/instance-id-cases-v1',
  'plan-adjustment-identity/upsert-cases-v1',
  'plan-adjustment-identity/regenerate-cases-v1',
] as const;

type FixtureId = (typeof FIXTURE_IDS)[number];

// ---------------------------------------------------------------------------
// Canonical JSON helpers
// ---------------------------------------------------------------------------

const sortKeysDeep = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, sortKeysDeep(v)] as const);
  return Object.fromEntries(entries);
};

const canonicalStringify = (value: unknown): string =>
  `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;

const readJson = (path: string): unknown => {
  if (!existsSync(path)) {
    throw new Error(
      `parityGoldensEntry: input fixture missing — ${path}. ` +
        `Re-author the fixture before re-running the generator.`,
    );
  }
  return JSON.parse(readFileSync(path, 'utf8'));
};

const writeIfChanged = (
  path: string,
  contents: string,
  mode: GeneratorMode,
): { wrote: boolean; changed: boolean } => {
  const onDisk = existsSync(path) ? readFileSync(path, 'utf8') : null;
  const changed = onDisk !== contents;
  if (mode === 'check') return { wrote: false, changed };
  if (!changed) return { wrote: false, changed };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, 'utf8');
  return { wrote: true, changed };
};

// ---------------------------------------------------------------------------
// Privacy guard
// ---------------------------------------------------------------------------

const PRIVACY_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'supabase_service_role_key', pattern: /SUPABASE_SERVICE_ROLE_KEY/i },
  { name: 'sb_secret_prefix', pattern: /sb_secret_/ },
  { name: 'service_role_literal', pattern: /service_role/i },
  // JWT prefix common to Supabase access tokens.
  { name: 'jwt_prefix', pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXV/ },
  { name: 'stripe_or_api_key', pattern: /sk_(live|test)_/ },
  { name: 'api_key_literal', pattern: /api[_-]?key\s*[:=]/i },
  { name: 'email', pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { name: 'bearer_token', pattern: /\bbearer\s+[A-Za-z0-9._\-=+]+/i },
  { name: 'authorization_header', pattern: /authorization\s*:/i },
  { name: 'cookie_header', pattern: /(set-cookie|cookie)\s*:/i },
];

// Allowed placeholder values. Anything matching these is exempt from the
// "userId / deviceLabel literal" guard so the goldens can document the
// allowed placeholder shape without tripping the scanner.
const PRIVACY_ALLOWLIST_VALUES = new Set([
  '<redacted>',
  'synthetic-user',
  // The canonical synthetic local-only user id baked into the app defaults
  // (DEFAULT_USER_PROFILE.id / DEFAULT_PROGRAM_TEMPLATE.userId /
  // DEFAULT_SCREENING_PROFILE.userId, src/data/defaults.ts) — a committed
  // constant, not PII. Surfaced by the PA-S3 default-program-data snapshot.
  'local-user',
  'iPhone',
  'iPad',
  'redacted-device',
]);

class PrivacyGuardError extends Error {
  constructor(fixtureId: string, hits: string[]) {
    super(
      `parityGoldensEntry: privacy guard failed for ${fixtureId}\n` +
        hits.map((h) => `  - ${h}`).join('\n'),
    );
  }
}

const runPrivacyGuard = (fixtureId: string, jsonText: string): void => {
  const hits: string[] = [];
  for (const { name, pattern } of PRIVACY_PATTERNS) {
    const match = jsonText.match(pattern);
    if (match) {
      hits.push(`pattern '${name}' matched substring: ${truncate(match[0], 80)}`);
    }
  }
  // Targeted userId / deviceLabel guard — find any "userId": "<value>" or
  // "deviceLabel": "<value>" pair and reject unless the value is in the
  // allowlist or starts with `synthetic-`.
  const idPair = /"(userId|deviceLabel)"\s*:\s*"([^"]+)"/g;
  for (const m of jsonText.matchAll(idPair)) {
    const value = m[2];
    if (PRIVACY_ALLOWLIST_VALUES.has(value)) continue;
    if (value.startsWith('synthetic-')) continue;
    if (value === '<redacted>') continue;
    hits.push(`raw ${m[1]} '${truncate(value, 40)}' is not in the allowlist`);
  }
  if (hits.length > 0) throw new PrivacyGuardError(fixtureId, hits);
};

const truncate = (s: string, n: number): string =>
  s.length <= n ? s : `${s.slice(0, n)}…`;

// ---------------------------------------------------------------------------
// parityMeta validation
// ---------------------------------------------------------------------------

type ParityMeta = {
  id: FixtureId;
  schemaVersion: number;
  describes: string;
  privacy: 'synthetic' | 'redacted' | 'redacted-pointer';
  generatedFrom: string;
  tsCommit: string;
  generatedAtPolicy: 'none' | 'deterministic-clock';
  deterministicClockIso?: string;
  sourceNotes?: string;
};

const validateParityMeta = (fixtureId: FixtureId, raw: unknown): ParityMeta => {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`parityGoldensEntry: ${fixtureId} missing parityMeta object`);
  }
  const meta = (raw as Record<string, unknown>).parityMeta as
    | Record<string, unknown>
    | undefined;
  if (!meta) {
    throw new Error(`parityGoldensEntry: ${fixtureId} missing parityMeta object`);
  }
  if (meta.id !== fixtureId) {
    throw new Error(
      `parityGoldensEntry: ${fixtureId} parityMeta.id mismatch — got ${String(
        meta.id,
      )}`,
    );
  }
  if (meta.schemaVersion !== STORAGE_VERSION) {
    throw new Error(
      `parityGoldensEntry: ${fixtureId} parityMeta.schemaVersion=${String(
        meta.schemaVersion,
      )} must equal STORAGE_VERSION=${STORAGE_VERSION}`,
    );
  }
  if (typeof meta.tsCommit !== 'string' || meta.tsCommit.length === 0) {
    throw new Error(`parityGoldensEntry: ${fixtureId} parityMeta.tsCommit missing`);
  }
  if (meta.generatedAtPolicy === 'deterministic-clock' && typeof meta.deterministicClockIso !== 'string') {
    throw new Error(
      `parityGoldensEntry: ${fixtureId} parityMeta.deterministicClockIso required when generatedAtPolicy=deterministic-clock`,
    );
  }
  if (meta.privacy !== 'synthetic' && meta.privacy !== 'redacted' && meta.privacy !== 'redacted-pointer') {
    throw new Error(
      `parityGoldensEntry: ${fixtureId} parityMeta.privacy must be one of synthetic|redacted|redacted-pointer`,
    );
  }
  return meta as unknown as ParityMeta;
};

// ---------------------------------------------------------------------------
// Per-fixture generators
// ---------------------------------------------------------------------------

const generateSnapshotHash = (input: any, meta: ParityMeta) => {
  const payload = input.payload as Record<string, unknown>;
  const snapshotHash = buildAppDataSnapshotHash(payload);
  // 1-line shape summary so the Swift port can sanity-check input shape
  // without re-deriving the hash twice.
  const stableStringifyHashInputSummary = {
    topLevelKeys: Object.keys(payload).sort(),
    schemaVersion: payload.schemaVersion,
    unitSettingsWeightUnit:
      (payload.unitSettings as Record<string, unknown> | undefined)?.weightUnit ?? null,
    settingsTopLevelKeys:
      payload.settings && typeof payload.settings === 'object'
        ? Object.keys(payload.settings as Record<string, unknown>).sort()
        : [],
  };
  return {
    sourceFixtureId: meta.id,
    schemaVersion: STORAGE_VERSION,
    snapshotHash,
    snapshotHashPrefix: SNAPSHOT_HASH_PREFIX,
    stableStringifyHashInputSummary,
  };
};

const loadPointerAppData = (input: any): AppData => {
  const path = input.pointer?.path;
  if (typeof path !== 'string') {
    throw new Error('parityGoldensEntry: pointer fixture missing pointer.path');
  }
  return readJson(resolve(REPO_ROOT, path)) as AppData;
};

const generateTrainingDecision = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: training-decision requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const appData = loadPointerAppData(input);
  const templateId = input.decisionMetadata?.templateId;
  const template = (appData.templates || []).find(
    (t: TrainingTemplate) => t.id === templateId,
  );
  if (!template) {
    throw new Error(
      `parityGoldensEntry: template ${templateId} not found in pointer AppData`,
    );
  }
  const clock = { now: () => new Date(nowIso) };
  const cleanView = buildCleanAppDataView(appData, clock);
  const cleanInput = createCleanTrainingDecisionInput(cleanView, {
    template,
    nowIso,
    trainingMode: input.decisionMetadata?.trainingMode,
  });
  const decision = buildTrainingDecisionFromCleanInput(cleanInput);
  return {
    sourceFixtureId: meta.id,
    decisionVersion: decision.decisionVersion,
    userFacing: decision.userFacing,
    hiddenDebugSignals: {
      arbitrationTrace: decision.hiddenDebugSignals?.arbitrationTrace ?? [],
    },
    // Useful auxiliary surfaces for the Swift parity port:
    finalDose: decision.finalDose,
    decisionCategory: decision.decisionCategory,
    decisionStrength: decision.decisionStrength,
    arbitrationReasonCode: decision.arbitrationReasonCode,
  };
};

const generateDataRepair = async (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: data-repair requires deterministicClockIso');
  }
  const nowDate = new Date(meta.deterministicClockIso);
  const baseAppData = input.payload as AppData;
  // Dry-run: invoke the orchestrator with detection only. There's no
  // dedicated dry-run flag — the orchestrator always applies safe-auto
  // repairs, so we re-derive the detection summary directly from the
  // registry to surface it in the golden alongside the apply result.
  const registry = getAppDataRepairRegistry();
  const detected = registry.byLayer('safe_auto')
    .map((definition) => definition.detect(baseAppData))
    .filter((r) => r.detected)
    .map((r) => ({
      repairId: r.repairId,
      occurrences: r.occurrences,
      affectedIds: r.affectedIds,
      severity: r.severity,
      userMessage: r.userMessage,
    }));
  // Apply pass.
  const applied = await runAutoRepairOrchestrator({
    appData: baseAppData,
    triggeredBy: 'startup',
    now: () => nowDate,
  });
  // Idempotency: second pass over already-repaired AppData should detect
  // no further occurrences (or, if it does, the receipt should match an
  // idempotent prior entry).
  const second = await runAutoRepairOrchestrator({
    appData: applied.appData,
    triggeredBy: 'startup',
    now: () => nowDate,
  });
  const ledger = (applied.appData as AppData).settings?.dataHealthRepairLedger ?? [];
  const lastReceipt = applied.results.find((r) => r.receipt)?.receipt ?? null;
  return {
    sourceFixtureId: meta.id,
    detected,
    dryRun: {
      summary: `${detected.length} repair(s) would apply`,
      detectedRepairIds: detected.map((d) => d.repairId),
    },
    applied: {
      changed: applied.changed,
      appliedCount: applied.results.filter((r) => r.status === 'applied').length,
      results: applied.results.map((r) => ({
        repairId: r.repairId,
        status: r.status,
        occurrences: r.occurrences,
        affectedIds: r.affectedIds,
      })),
      appDataHashBefore: applied.appDataHashBefore,
      appDataHashAfter: applied.appDataHashAfter,
    },
    receipt: lastReceipt
      ? {
          // Shape mirrors DataRepairLogEntry (src/models/training-model.ts).
          // createdAt is intentionally omitted from the golden — it is the
          // deterministic clock injected via parityMeta and already lives
          // in `parityGolden.deterministicClockIso`.
          id: lastReceipt.id,
          repairId: lastReceipt.repairId,
          category: lastReceipt.category,
          action: lastReceipt.action,
          affectedIds: lastReceipt.affectedIds,
          beforeSummary: lastReceipt.beforeSummary,
          afterSummary: lastReceipt.afterSummary,
        }
      : null,
    ledger: {
      length: Array.isArray(ledger) ? ledger.length : 0,
      lastEntryRepairId:
        Array.isArray(ledger) && ledger.length > 0
          ? ledger[ledger.length - 1]?.repairId
          : null,
    },
    postRepair: {
      historyLength: (applied.appData as AppData).history?.length ?? 0,
      restTimerCleared: !(applied.appData as AppData).history?.some(
        (s: TrainingSession) => s.restTimerState?.isRunning === true,
      ),
      currentExerciseCleared: !(applied.appData as AppData).history?.some(
        (s: TrainingSession) => typeof s.currentExerciseId === 'string' && s.currentExerciseId.length > 0,
      ),
    },
    idempotencySecondRun: {
      changed: second.changed,
      detectedCount: second.results.filter((r) => r.status === 'applied').length,
    },
  };
};

const generateRealExport = async (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: real-export requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const appData = loadPointerAppData(input);
  const clock = { now: () => new Date(nowIso) };
  const cleanView = buildCleanAppDataView(appData, clock);
  // Detection counts from the registry, not raw payloads.
  const registry = getAppDataRepairRegistry();
  const dataHealthScan = registry.list().map((definition) => {
    const r = definition.detect(appData);
    return {
      repairId: r.repairId,
      detected: r.detected,
      occurrences: r.occurrences,
      severity: r.severity,
    };
  });
  return {
    sourceFixtureId: meta.id,
    fixtureLoaded: true,
    privacyGuardPassed: true,
    expectedSchemaVersion: STORAGE_VERSION,
    actualSchemaVersion: appData.schemaVersion,
    snapshotHash: buildAppDataSnapshotHash(appData),
    cleanAppDataViewBuilt: cleanView !== null && cleanView !== undefined,
    cleanedHistoryLength: cleanView.appData.history?.length ?? 0,
    dataHealthScan,
  };
};

const generateFocusMode = (input: any, meta: ParityMeta) => {
  const session = input.session as TrainingSession;
  const queue = buildFocusStepQueue(session);
  const interactionState = resolveFocusModeInteractionState({
    session,
    focusStepQueue: queue,
    activeStep: queue[0],
    primaryAction: 'log-set',
    isActiveSession: true,
  } as any);
  return {
    sourceFixtureId: meta.id,
    focusStepQueueLength: queue.length,
    focusStepQueue: queue,
    stepIds: queue.map((s) => s.id),
    primaryActions: {
      forActiveStep: interactionState?.primaryAction ?? null,
    },
    terminalState: {
      lastStepId: queue[queue.length - 1]?.id ?? null,
      lastStepType: queue[queue.length - 1]?.stepType ?? null,
    },
  };
};

// ---------------------------------------------------------------------------
// iOS-4B0 — synthetic TrainingDecision fixtures (expanded path coverage)
//
// These fixtures carry a compact declarative `synthetic` spec instead of a
// redacted-pointer AppData. The spec is materialised into an engine-valid
// AppData via the test fixture helpers (makeAppData/makeSession/makeStatus),
// keeping the committed input tiny while still driving the REAL Clean Input
// Contract pipeline. All dates are computed relative to the deterministic
// clock so two runs are byte-identical.
//
// generateTrainingDecisionExpanded() is a SEPARATE generator from
// generateTrainingDecision() so the existing normal-session-v1 golden stays
// byte-identical (it keeps its narrower projection). The expanded golden adds
// structured engine fields (sessionIntent, activePhase, modes, riskLevel,
// finalVolumeMultiplier, exerciseRoleFloors, per-exercise set counts, clean
// input evidence) so the Swift port has real baselines to match.
// ---------------------------------------------------------------------------

const dateOnlyDaysBefore = (nowIso: string, days: number): string => {
  const base = new Date(nowIso).getTime();
  return new Date(base - days * 86_400_000).toISOString().slice(0, 10);
};

const isoDaysBefore = (nowIso: string, days: number): string => {
  const base = new Date(nowIso).getTime();
  return new Date(base - days * 86_400_000).toISOString();
};

type SyntheticSessionSpec = {
  id: string;
  daysAgo: number;
  templateId?: string;
  exerciseId?: string;
  sets?: Array<{ weight: number; reps: number; rir?: number; painFlag?: boolean; painArea?: string; painSeverity?: number; techniqueQuality?: 'good' | 'acceptable' | 'poor' }>;
  legacyAdvice?: boolean;
  dirty?: 'lifecycle' | 'duration';
};

type SyntheticSpec = {
  selectedTemplateId?: string;
  trainingMode?: string;
  sessions?: SyntheticSessionSpec[];
  todayStatus?: { daysAgo?: number; sleep?: string; energy?: string; soreness?: string[]; time?: string };
  healthMetricSamples?: Array<{ daysAgo: number; type?: string; value?: number; unit?: string }>;
  mesocyclePlan?: Record<string, unknown> | null;
  screeningProfile?: Record<string, unknown>;
  settings?: Record<string, unknown>;
};

const buildSyntheticAppData = (spec: SyntheticSpec, nowIso: string): AppData => {
  const selectedTemplateId = spec.selectedTemplateId ?? 'push-a';
  const history: TrainingSession[] = (spec.sessions ?? []).map((s) => {
    const templateId = s.templateId ?? selectedTemplateId;
    const exerciseId = s.exerciseId ?? getTemplate(templateId).exercises[0].id;
    const session = makeSession({
      id: s.id,
      date: dateOnlyDaysBefore(nowIso, s.daysAgo),
      templateId,
      exerciseId,
      setSpecs: s.sets ?? [{ weight: 60, reps: 6 }, { weight: 60, reps: 6 }],
    }) as TrainingSession & Record<string, unknown>;
    if (s.legacyAdvice) {
      // Legacy "final advice" residue that stripLegacyAdviceFromSession must
      // remove before the decision sees it. Seeded on the exercise + session.
      session.exercises = session.exercises.map((ex) => ({
        ...ex,
        suggestion: '历史建议：下次加重（legacy，不应进入 live 决策）',
        warning: '历史警告：注意肩部（legacy）',
        adjustment: '历史调整：减少一组（legacy）',
      })) as TrainingSession['exercises'];
      session.explanations = [
        { id: 'legacy-explain-1', summary: '历史最终建议（legacy final advice）', source: 'legacy' },
      ];
    }
    if (s.dirty === 'lifecycle') {
      // Active-session lifecycle residue on a completed history session.
      session.restTimerState = { isRunning: true, startedAt: isoDaysBefore(nowIso, s.daysAgo), remainingSeconds: 90 };
      session.currentExerciseId = exerciseId;
    }
    if (s.dirty === 'duration') {
      // Impossible duration (> DATA_HEALTH_IMPOSSIBLE_DURATION_MIN=240).
      session.durationMin = 9999;
    }
    return session as TrainingSession;
  });

  const todayStatus = spec.todayStatus
    ? ({
        ...makeStatus({
          ...(spec.todayStatus.sleep ? { sleep: spec.todayStatus.sleep as never } : {}),
          ...(spec.todayStatus.energy ? { energy: spec.todayStatus.energy as never } : {}),
          ...(spec.todayStatus.soreness ? { soreness: spec.todayStatus.soreness as never } : {}),
          ...(spec.todayStatus.time ? { time: spec.todayStatus.time } : {}),
        }),
        date: dateOnlyDaysBefore(nowIso, spec.todayStatus.daysAgo ?? 0),
      } as never)
    : undefined;

  const healthMetricSamples = spec.healthMetricSamples
    ? spec.healthMetricSamples.map((h, i) => ({
        id: `synthetic-health-${i + 1}`,
        type: h.type ?? 'restingHeartRate',
        value: h.value ?? 58,
        unit: h.unit ?? 'count/min',
        startDate: isoDaysBefore(nowIso, h.daysAgo),
        endDate: isoDaysBefore(nowIso, h.daysAgo),
        source: 'synthetic',
      }))
    : undefined;

  const overrides: Partial<AppData> = {
    history,
    selectedTemplateId,
    trainingMode: (spec.trainingMode ?? 'hybrid') as never,
  };
  if (todayStatus) (overrides as Record<string, unknown>).todayStatus = todayStatus;
  if (healthMetricSamples) (overrides as Record<string, unknown>).healthMetricSamples = healthMetricSamples;
  if (spec.mesocyclePlan !== undefined) (overrides as Record<string, unknown>).mesocyclePlan = spec.mesocyclePlan;
  if (spec.screeningProfile) (overrides as Record<string, unknown>).screeningProfile = spec.screeningProfile;
  if (spec.settings) (overrides as Record<string, unknown>).settings = spec.settings;

  return makeAppData(overrides);
};

const generateTrainingDecisionExpanded = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: expanded training-decision requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const md = input.decisionMetadata ?? {};
  const appData = buildSyntheticAppData((input.synthetic ?? {}) as SyntheticSpec, nowIso);
  const templateId = md.templateId ?? (input.synthetic?.selectedTemplateId ?? 'push-a');
  const template = (appData.templates || []).find((t: TrainingTemplate) => t.id === templateId);
  if (!template) {
    throw new Error(`parityGoldensEntry: template ${templateId} not found in synthetic AppData`);
  }
  const clock = { now: () => new Date(nowIso) };
  const cleanView = buildCleanAppDataView(appData, clock);
  const cleanInput = createCleanTrainingDecisionInput(cleanView, {
    template,
    nowIso,
    trainingMode: md.trainingMode ?? input.synthetic?.trainingMode,
    acutePainReported: md.acutePainReported,
    injuryFlag: md.injuryFlag,
    illnessFlag: md.illnessFlag,
    explicitDeloadAssigned: md.explicitDeloadAssigned,
    useHealthDataForReadiness: md.useHealthDataForReadiness,
  }) as Record<string, unknown>;
  const decision = buildTrainingDecisionFromCleanInput(cleanInput as never) as any;
  const hidden = decision.hiddenDebugSignals ?? {};
  const effectivePhase = hidden.effectivePhase ?? {};
  const workingSetTargets: any[] = Array.isArray(decision.workingSetTargets) ? decision.workingSetTargets : [];
  const diag = cleanView.guardDiagnostics;

  return {
    sourceFixtureId: meta.id,
    decisionVersion: decision.decisionVersion,
    // Top-level engine decision fields (structured — not UI text).
    sessionIntent: decision.sessionIntent,
    activePhase: decision.activePhase,
    volumeMode: decision.volumeMode,
    intensityMode: decision.intensityMode,
    progressionMode: decision.progressionMode,
    riskLevel: decision.riskLevel,
    trainingMode: decision.trainingMode,
    weeklyAdjustment: decision.weeklyAdjustment ?? null,
    finalVolumeMultiplier: hidden.finalVolumeMultiplier ?? null,
    exerciseRoleFloors: hidden.exerciseRoleFloors ?? null,
    weeklyBlockReasons: hidden.weeklyBlockReasons ?? [],
    progressClarityTripletSuppressed: hidden.progressClarityTripletSuppressed ?? null,
    effectivePhase: {
      activePhase: effectivePhase.activePhase ?? null,
      gapDays: effectivePhase.gapDays ?? null,
      mode: effectivePhase.mode ?? null,
      severity: effectivePhase.severity ?? null,
      overridden: effectivePhase.overridden ?? null,
      hasHistory: effectivePhase.hasHistory ?? null,
    },
    // Per-exercise set-count summary — catches all-1-set regressions.
    perExercise: workingSetTargets.map((w) => ({
      exerciseId: w.exerciseId,
      role: w.role,
      targetSets: w.targetSets,
    })),
    allTargetSets: workingSetTargets.map((w) => w.targetSets),
    minTargetSets: workingSetTargets.length ? Math.min(...workingSetTargets.map((w) => Number(w.targetSets) || 0)) : null,
    userFacing: decision.userFacing,
    hiddenDebugSignals: {
      arbitrationTrace: hidden.arbitrationTrace ?? [],
    },
    // Clean Input Contract evidence — proves the dirty raw AppData was passed
    // through buildCleanAppDataView before the decision saw it.
    cleanInput: {
      cleanViewBuilt: cleanView !== null && cleanView !== undefined,
      useHealthDataForReadiness:
        (cleanInput as Record<string, unknown>).useHealthDataForReadiness ?? null,
      diagnostics: {
        lifecycleResidueSessionIds: diag.lifecycleResidueSessionIds,
        legacyAdviceSessionIds: diag.legacyAdviceSessionIds,
        invalidDurationSessionIds: diag.invalidDurationSessionIds,
        cappedIssueScoreKeys: diag.cappedIssueScoreKeys,
        staleTodayStatus: diag.staleTodayStatus,
        staleHealthData: diag.staleHealthData,
        filteredPerformanceDropIds: diag.filteredPerformanceDropIds,
      },
    },
    inputEvidence: {
      historyLength: appData.history?.length ?? 0,
      healthMetricSampleCount: (appData.healthMetricSamples || []).length,
      rawHealthSamplesPreserved: (appData.healthMetricSamples || []).length === (cleanView.appData.healthMetricSamples || []).length,
    },
  };
};

const TRAINING_DECISION_EXPANDED_IDS = new Set<FixtureId>([
  'training-decision/severe-rest-v1',
  'training-decision/controlled-reload-v1',
  'training-decision/deload-week-v1',
  'training-decision/stale-today-status-v1',
  'training-decision/stale-health-data-v1',
  'training-decision/restart-28d-gap-v1',
  'training-decision/productive-floor-v1',
  'training-decision/no-legacy-advice-v1',
  'training-decision/clean-input-contract-v1',
]);

// ---------------------------------------------------------------------------
// SR-0 — smart-replacement parity slice
//
// buildSmartReplacementRecommendations (src/engines/smartReplacementEngine.ts)
// is clockless and library-driven: given SmartReplacementParams it returns a
// SmartReplacementRecommendation[] (exerciseId, exerciseName, priority,
// fatigueCost, reason, warnings — see smartReplacementEngine.ts:22-31). SR-0
// only PINS that output as a golden; the engine itself is ported to Swift in
// SR-1+. The payload wraps the array with a recommendationCount + a stable
// priorityCounts map (all four priorities, including zeros) so the Swift decode
// mirror can assert count integrity + 4-priority coverage without recomputing.
// ---------------------------------------------------------------------------

const SMART_REPLACEMENT_PRIORITIES: SmartReplacementPriority[] = [
  'primary',
  'secondary',
  'angle_variation',
  'avoid',
];

// Mirror of the engine's internal getExerciseId() (smartReplacementEngine.ts:90)
// — used only to echo the resolved current-exercise id into the golden so the
// Swift mirror can read it without re-deriving. NOT engine logic.
const smartReplacementCurrentId = (currentExercise: unknown): string => {
  if (!currentExercise) return '';
  if (typeof currentExercise === 'string') return currentExercise;
  const ex = currentExercise as Record<string, unknown>;
  return String(
    ex.actualExerciseId ||
      ex.replacementExerciseId ||
      ex.canonicalExerciseId ||
      ex.baseId ||
      ex.id ||
      '',
  );
};

const generateSmartReplacement = (input: any, meta: ParityMeta) => {
  const params = (input.params ?? {}) as Parameters<
    typeof buildSmartReplacementRecommendations
  >[0];
  const recommendations = buildSmartReplacementRecommendations(params);
  const priorityCounts = Object.fromEntries(
    SMART_REPLACEMENT_PRIORITIES.map((p) => [p, 0]),
  ) as Record<SmartReplacementPriority, number>;
  for (const rec of recommendations) {
    priorityCounts[rec.priority] += 1;
  }
  return {
    sourceFixtureId: meta.id,
    currentExerciseId: smartReplacementCurrentId(params?.currentExercise),
    recommendationCount: recommendations.length,
    priorityCounts,
    recommendations,
  };
};

// ---------------------------------------------------------------------------
// SR-1 — exercise-library data port snapshot
//
// Dumps the four frozen library tables (src/data/exerciseLibrary.ts:20/117/181/247)
// into one id-keyed snapshot so the Swift port (IronPathTrainingDecision) can
// reconcile EVERY entry item-by-item against TS truth. The id universe is the
// UNION of keys across the four tables; per id we emit only the fields that
// table actually carries (an absent field is `undefined`, which canonicalStringify
// drops). Array order (equipmentTags / aliases) is preserved verbatim — the Swift
// tables store the same order and the parity test compares arrays element-wise.
// `knowledgeOverrideIds` is the SORTED KEY SET of EXERCISE_KNOWLEDGE_OVERRIDES
// (keys ONLY — the override VALUES are engine knowledge, ported in SR-2/3); it
// exists so the Swift resolveExerciseReferenceToId mirror pins its known-id
// fast-path term to TS. This generator COMPUTES NOTHING about replacement — it
// only transcribes frozen data.
// ---------------------------------------------------------------------------

type ExerciseLibrarySnapshotEntry = {
  displayName?: string;
  englishName?: string;
  equipmentTags?: ExerciseEquipmentTag[];
  aliases?: string[];
};

const generateExerciseLibrarySnapshot = (_input: any, _meta: ParityMeta) => {
  const ids = Array.from(
    new Set<string>([
      ...Object.keys(EXERCISE_DISPLAY_NAMES),
      ...Object.keys(EXERCISE_ENGLISH_NAMES),
      ...Object.keys(EXERCISE_EQUIPMENT_TAGS),
      ...Object.keys(EXERCISE_ALIASES),
    ]),
  );
  const exercises: Record<string, ExerciseLibrarySnapshotEntry> = {};
  for (const id of ids) {
    exercises[id] = {
      displayName: EXERCISE_DISPLAY_NAMES[id],
      englishName: EXERCISE_ENGLISH_NAMES[id],
      equipmentTags: EXERCISE_EQUIPMENT_TAGS[id],
      aliases: EXERCISE_ALIASES[id],
    };
  }
  const knowledgeOverrideIds = Object.keys(EXERCISE_KNOWLEDGE_OVERRIDES).sort((a, b) =>
    a.localeCompare(b),
  );
  return {
    counts: {
      distinctIds: ids.length,
      displayNames: Object.keys(EXERCISE_DISPLAY_NAMES).length,
      englishNames: Object.keys(EXERCISE_ENGLISH_NAMES).length,
      equipmentTags: Object.keys(EXERCISE_EQUIPMENT_TAGS).length,
      aliases: Object.keys(EXERCISE_ALIASES).length,
      knowledgeOverrideIds: knowledgeOverrideIds.length,
    },
    exercises,
    knowledgeOverrideIds,
  };
};

// ---------------------------------------------------------------------------
// SR-2 — replacement-engine knowledge snapshot
//
// Dumps the engine knowledge replacementEngine.ts actually reads: the
// EXERCISE_EQUIVALENCE_CHAINS values (id + members, keyed by exercise id) and the
// engine-used SUBSET of every EXERCISE_KNOWLEDGE_OVERRIDES value. The Swift
// ReplacementEngineKnowledge tables reconcile every entry item-by-item. This
// transcribes frozen data — it COMPUTES no replacement.
// ---------------------------------------------------------------------------

// The EXERCISE_KNOWLEDGE_OVERRIDES fields the replacement engine reads
// (replacementEngine.ts:73 equipmentTags, :185 fatigueCost, :307-318
// equivalenceChainId / alternativeIds / alternativePriorities / regressionIds /
// progressionIds). No override currently carries `equipmentTags`, so it never
// appears in the snapshot — but it is listed so the field set documents the full
// engine-used contract (and the Swift equipmentTagsFor mirror).
const REPLACEMENT_ENGINE_KNOWLEDGE_FIELDS = [
  'fatigueCost',
  'equivalenceChainId',
  'alternativeIds',
  'alternativePriorities',
  'regressionIds',
  'progressionIds',
  'equipmentTags',
] as const;

const generateReplacementEngineKnowledge = (_input: any, _meta: ParityMeta) => {
  const equivalenceChains: Record<string, { id: string; members: string[] }> = {};
  for (const [exerciseId, chain] of Object.entries(EXERCISE_EQUIVALENCE_CHAINS)) {
    equivalenceChains[exerciseId] = { id: chain.id, members: chain.members };
  }
  const knowledge: Record<string, Record<string, unknown>> = {};
  for (const [id, override] of Object.entries(EXERCISE_KNOWLEDGE_OVERRIDES)) {
    const entry: Record<string, unknown> = {};
    for (const field of REPLACEMENT_ENGINE_KNOWLEDGE_FIELDS) {
      const value = (override as Record<string, unknown>)[field];
      if (value !== undefined) entry[field] = value;
    }
    knowledge[id] = entry;
  }
  return {
    counts: {
      equivalenceChainKeys: Object.keys(equivalenceChains).length,
      knowledgeOverrideIds: Object.keys(knowledge).length,
    },
    equivalenceChains,
    knowledge,
  };
};

// ---------------------------------------------------------------------------
// SR-2 — replacement-engine OUTPUT parity
//
// Runs the REAL buildReplacementOptions over a fixture's exercise + context and
// pins the full ReplacementOption[] (id / name / rank / rankLabel / reason /
// fatigueCost / fatigueCostLabel / prIndependent) in engine order. Echoes the
// engineInput verbatim so the Swift port re-runs its ported engine on the SAME
// input and asserts equality. `validation` / `synthetic` pin
// validateReplacementExerciseId / isSyntheticReplacementExerciseId over the
// fixture's probe lists. Clockless (no Date.now / Math.random) → policy 'none'.
// ---------------------------------------------------------------------------

const generateReplacementEngine = (input: any, meta: ParityMeta) => {
  const exercise = (input.exercise ?? {}) as ExercisePrescription;
  const context = (input.context ?? {}) as ReplacementContext;
  const unavailableEquipment = (context.unavailableEquipment ?? []) as ExerciseEquipmentTag[];
  const options = buildReplacementOptions(exercise, context);
  const validateProbes: string[] = Array.isArray(input.validateProbes) ? input.validateProbes : [];
  const syntheticProbes: string[] = Array.isArray(input.syntheticProbes) ? input.syntheticProbes : [];
  return {
    sourceFixtureId: meta.id,
    engineInput: {
      exercise,
      context: { unavailableEquipment },
    },
    optionCount: options.length,
    optionIds: options.map((o) => o.id),
    options,
    validation: validateProbes.map((id) => ({ id, valid: validateReplacementExerciseId(id) })),
    synthetic: syntheticProbes.map((id) => ({ id, synthetic: isSyntheticReplacementExerciseId(id) })),
  };
};

// ---------------------------------------------------------------------------
// iOS-17e-1 — per-exercise e1RM OUTPUT parity
//
// Builds a synthetic, performed-set history via the SAME makeSession fixture
// helper the iOS-4B0/17e-0 decision fixtures use (so the history shape is
// engine-valid + deterministic from parityMeta.deterministicClockIso), then runs
// the REAL e1rmEngine over it and echoes BOTH the engineInput (history +
// exerciseId, verbatim — the Swift port decodes it and re-runs the ported
// functions) AND the computed outputs:
//   - profile  = buildE1RMProfile(history, exerciseId)            (E1RMProfile)
//   - estimate = estimateOneRepMaxForExercise(history, exerciseId)(EstimatedOneRepMax | null)
//   - poolIdProbes     = getExerciseRecordPoolId(probe.exercise) over arbitrary
//                        exercise-identity shapes (pool-id + invalid-identity branches)
//   - confidenceProbes = getE1RMConfidence(sourceSet, recentSets) over crafted
//                        (low / medium / high) inputs
// Optional per-session `dataFlag` / `startedAtDaysAgo` exercise the
// filterAnalyticsHistory exclusion (test/excluded flag + back-filled session).
// PURE / clockless engine (the clock is only the fixture-date seed) — no decision
// output is touched. Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

type E1RMSessionSpec = {
  id: string;
  daysAgo: number;
  templateId?: string;
  exerciseId?: string;
  dataFlag?: string;
  startedAtDaysAgo?: number;
  sets?: Array<{ weight: number; reps: number; rir?: number; painFlag?: boolean; painArea?: string; painSeverity?: number; techniqueQuality?: 'good' | 'acceptable' | 'poor' }>;
};

const generateE1RMEngine = (input: any, meta: ParityMeta) => {
  const exerciseId: string = input.exerciseId ?? getTemplate('push-a').exercises[0].id;
  const sessions: E1RMSessionSpec[] = Array.isArray(input.sessions) ? input.sessions : [];
  // History-bearing fixtures derive their session dates from the deterministic
  // clock; a pure-probe fixture (no sessions) may use generatedAtPolicy 'none'.
  if (sessions.length > 0 && !meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: e1rm-engine history fixtures require deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso ?? '';

  const history: TrainingSession[] = sessions.map((s) => {
    const templateId = s.templateId ?? 'push-a';
    const session = makeSession({
      id: s.id,
      date: dateOnlyDaysBefore(nowIso, s.daysAgo),
      templateId,
      exerciseId: s.exerciseId ?? exerciseId,
      setSpecs: s.sets ?? [{ weight: 60, reps: 6 }],
    }) as TrainingSession & Record<string, unknown>;
    if (s.dataFlag !== undefined) session.dataFlag = s.dataFlag;
    if (s.startedAtDaysAgo !== undefined) session.startedAt = isoDaysBefore(nowIso, s.startedAtDaysAgo);
    return session as TrainingSession;
  });

  const profile = buildE1RMProfile(history, exerciseId);
  const estimate = estimateOneRepMaxForExercise(history, exerciseId);

  const poolIdProbes = (Array.isArray(input.poolIdProbes) ? input.poolIdProbes : []).map(
    (p: { label?: string; exercise: ExercisePrescription }) => ({
      label: p.label ?? null,
      exercise: p.exercise,
      poolId: getExerciseRecordPoolId(p.exercise),
    }),
  );

  const confidenceProbes = (Array.isArray(input.confidenceProbes) ? input.confidenceProbes : []).map(
    (p: { label?: string; sourceSet: any; recentSets?: any[] }) => {
      const recentSets = Array.isArray(p.recentSets) ? p.recentSets : [];
      return {
        label: p.label ?? null,
        sourceSet: p.sourceSet,
        recentSets,
        confidence: getE1RMConfidence(p.sourceSet, recentSets),
      };
    },
  );

  return {
    sourceFixtureId: meta.id,
    engineInput: { exerciseId, history },
    profile,
    estimate: estimate ?? null,
    poolIdProbes,
    confidenceProbes,
  };
};

// ---------------------------------------------------------------------------
// iOS-17e-2 — adaptiveFeedbackEngine performance-lookup OUTPUT parity
//
// Builds a synthetic, performed-set history via the SAME makeSession fixture helper
// the iOS-4B0/17e-0/17e-1 fixtures use (engine-valid + deterministic from
// parityMeta.deterministicClockIso), then runs the REAL performance-lookup functions
// and echoes BOTH the engineInput (history + seedIssueScores, verbatim — the Swift
// port decodes them and re-runs the ported functions) AND the computed outputs:
//   - lastProbes      = findLastPerformance(history, exerciseId)          (snapshot|null)
//   - previousProbes  = findPreviousPerformance(history, id, skipSessionId)(snapshot|null)
//   - recentProbes    = findRecentPerformances(history, id, limit)         (snapshot[])
//   - adaptiveState   = buildAdaptiveState(history, screening)             (AdaptiveState)
// Each PerformanceSnapshot is projected to a stable shape (sessionId / exerciseId /
// baseId / setCount / per-completed-set weightKg+reps) — enough to pin which session,
// which exercise, and which completed sets matched, byte-for-byte. `screening` carries
// only the issueScores seed (the ONLY screening field buildAdaptiveState reads,
// adaptiveFeedbackEngine.ts:172). PURE / clockless engine apart from the wall-clock
// `lastUpdated` stamp, which is replaced with the deterministic clock date so the
// golden is reproducible. No decision output is touched. Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

type AdaptiveSessionSpec = {
  id: string;
  daysAgo: number;
  templateId?: string;
  exerciseId?: string;
  sets?: Array<{ weight: number; reps: number; rir?: number; note?: string; painFlag?: boolean; painArea?: string; painSeverity?: number; techniqueQuality?: 'good' | 'acceptable' | 'poor' }>;
};

const projectAdaptiveSnapshot = (snapshot: PerformanceSnapshot | null) => {
  if (!snapshot) return null;
  return {
    sessionId: snapshot.session.id ?? null,
    exerciseId: snapshot.exercise.id ?? null,
    baseId: (snapshot.exercise as Record<string, unknown>).baseId ?? null,
    setCount: snapshot.sets.length,
    sets: snapshot.sets.map((s) => ({ weightKg: setWeightKg(s), reps: number(s.reps) })),
  };
};

const generateAdaptiveFeedback = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: adaptive-feedback requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const defaultExerciseId: string = input.exerciseId ?? getTemplate('push-a').exercises[0].id;
  const sessions: AdaptiveSessionSpec[] = Array.isArray(input.sessions) ? input.sessions : [];

  const history: TrainingSession[] = sessions.map((s) =>
    makeSession({
      id: s.id,
      date: dateOnlyDaysBefore(nowIso, s.daysAgo),
      templateId: s.templateId ?? 'push-a',
      exerciseId: s.exerciseId ?? defaultExerciseId,
      setSpecs: s.sets ?? [{ weight: 60, reps: 6 }],
    }) as TrainingSession,
  );

  // The only screening field buildAdaptiveState reads is adaptiveState.issueScores.
  const seedIssueScores = (input.screening?.issueScores ?? {}) as Record<string, number>;
  const screening = {
    ...DEFAULT_SCREENING_PROFILE,
    adaptiveState: { ...DEFAULT_SCREENING_PROFILE.adaptiveState!, issueScores: seedIssueScores },
  };

  const lastProbes = (Array.isArray(input.lastProbes) ? input.lastProbes : []).map(
    (p: { label?: string; exerciseId: string }) => ({
      label: p.label ?? null,
      exerciseId: p.exerciseId,
      snapshot: projectAdaptiveSnapshot(findLastPerformance(history, p.exerciseId)),
    }),
  );

  const previousProbes = (Array.isArray(input.previousProbes) ? input.previousProbes : []).map(
    (p: { label?: string; exerciseId: string; skipSessionId?: string }) => ({
      label: p.label ?? null,
      exerciseId: p.exerciseId,
      skipSessionId: p.skipSessionId ?? null,
      snapshot: projectAdaptiveSnapshot(findPreviousPerformance(history, p.exerciseId, p.skipSessionId)),
    }),
  );

  const recentProbes = (Array.isArray(input.recentProbes) ? input.recentProbes : []).map(
    (p: { label?: string; exerciseId: string; limit?: number }) => {
      const limit = p.limit ?? 3;
      const snaps = findRecentPerformances(history, p.exerciseId, limit);
      return {
        label: p.label ?? null,
        exerciseId: p.exerciseId,
        limit,
        count: snaps.length,
        snapshots: snaps.map(projectAdaptiveSnapshot),
      };
    },
  );

  const adaptiveRaw = buildAdaptiveState(history, screening);
  // buildAdaptiveState stamps lastUpdated from the wall clock (adaptiveFeedbackEngine.ts:224);
  // substitute the deterministic clock date so the golden is byte-reproducible (the Swift
  // port injects the SAME `today`). Mirrors generateDataRepair omitting the clock-derived createdAt.
  const adaptiveState = { ...adaptiveRaw, lastUpdated: nowIso.slice(0, 10) };

  return {
    sourceFixtureId: meta.id,
    engineInput: { exerciseId: defaultExerciseId, seedIssueScores, history },
    lastProbes,
    previousProbes,
    recentProbes,
    adaptiveState,
  };
};

// ---------------------------------------------------------------------------
// PA-S2 — engineUtils enrichExercise / buildExerciseMetadata OUTPUT parity
//
// Runs the REAL `enrichExercise` / `buildExerciseMetadata` over a set of representative
// ExerciseTemplate-shaped inputs and echoes BOTH the engineInput (each raw exercise,
// verbatim — the Swift port decodes it and re-runs the ported functions) AND the computed
// outputs (`metadata` = buildExerciseMetadata, `enriched` = {...exercise, ...metadata}).
//
// EMPTY-SEAM PIN: every input id is SYNTHETIC and asserted absent from both
// EXERCISE_KNOWLEDGE_OVERRIDES and EXERCISE_EQUIVALENCE_CHAINS, so the TS engine takes
// `override = {}` / `equivalence = undefined` — the default-derivation branches this slice
// ports. The override DATA tables (~1000-line value table) are PA-S3 and are NOT exercised
// here. The cases jointly cover: compound (kind compound + kind machine) vs isolation ·
// bigMuscle (胸/背/腿) vs not · the progressionUnitKg ||-chain (bigMuscle 2.5 default /
// startWeight>=40 2.5 / isolation-small 1 / parsed-string 0.5 / explicit kg) · the
// techniqueStandard default rom branch (compound→完整 / isolation→受控) + exercise.techniqueStandard
// overlay · alternativeIds/alternativePriorities exercise fallback · a non-schema open-bag key
// round-trip. Generated; never hand-edited (§22). PURE — no write path, no clock.
// ---------------------------------------------------------------------------

const generateEnrichExercise = (input: any, meta: ParityMeta) => {
  const cases: any[] = Array.isArray(input.cases) ? input.cases : [];
  const projected = cases.map((c: any, i: number) => {
    const exercise = (c?.exercise ?? {}) as Record<string, unknown>;
    const id = String(exercise.id ?? '');
    // PA-S2 pins the EMPTY-seam branch: reject any id that would pull real override /
    // equivalence DATA (that is PA-S3), so the golden cannot silently capture override output.
    if (EXERCISE_KNOWLEDGE_OVERRIDES[id]) {
      throw new Error(
        `parityGoldensEntry: enrich-exercise input id "${id}" must be absent from ` +
          `EXERCISE_KNOWLEDGE_OVERRIDES (PA-S2 pins the empty-seam branch; override data is PA-S3)`,
      );
    }
    if (EXERCISE_EQUIVALENCE_CHAINS[id]) {
      throw new Error(
        `parityGoldensEntry: enrich-exercise input id "${id}" must be absent from ` +
          `EXERCISE_EQUIVALENCE_CHAINS (PA-S2 pins the empty-seam branch; equivalence data is PA-S3)`,
      );
    }
    const label = String(c?.label ?? id ?? `case-${i}`);
    return {
      label,
      exercise,
      metadata: buildExerciseMetadata(exercise as never),
      enriched: enrichExercise(exercise as never),
    };
  });
  return {
    sourceFixtureId: meta.id,
    engineInput: { cases: projected.map((p) => ({ label: p.label, exercise: p.exercise })) },
    results: projected.map((p) => ({ label: p.label, metadata: p.metadata, enriched: p.enriched })),
  };
};

// ---------------------------------------------------------------------------
// iOS-17e-3 — progressionRulesEngine progressive-suggestion OUTPUT parity
//
// Builds a synthetic, performed-set history via the SAME makeSession fixture helper
// the iOS-4B0/17e-0/17e-1/17e-2 fixtures use, then runs the REAL progressionRulesEngine
// over an explicit `templateExercise` (ExerciseForProgression) and echoes BOTH the
// engineInput (exercise + history, verbatim — the Swift port decodes them and re-runs
// the ported functions) AND the computed outputs:
//   - suggestion          = makeSuggestion(exercise, history)        (Suggestion)
//   - shouldUseTopBackoff = shouldUseTopBackoff(exercise)            (boolean)
//   - setPrescription     = buildSetPrescription(exercise, {weight,reps})
//   - fineTuneNeutrality  = buildSetWeightFineTune(...).basis fallbackReason+samplesUsed
//   - optional topBackoffProbes / setPrescriptionProbes pin extra exercise shapes so
//     the conservative / adaptive-factor / fatigueCost branches of buildSetPrescription
//     and the kind/sets/startWeight boundary of shouldUseTopBackoff are covered.
// The `exercise.id` is normalised to the history exercise id so findRecentPerformances
// matches. Session dates derive from parityMeta.deterministicClockIso. iOS-17e-6a threads
// an OPTIONAL `input.asOfDate` into makeSuggestion + the fineTuneNeutrality probe:
//   * existing 17e-3 fixtures OMIT it → makeSuggestion reads the WALL CLOCK and their
//     deep-2020 history is outside any plausible live window → fineTune insufficient →
//     legacy baseline → goldens byte-identical (zero drift).
//   * NEW fine-tune-* fixtures SET asOfDate = deterministicClockIso (the §11.2 injected
//     clock) with RECENT in-window history → the LIVE fineTune projection fires, so the
//     ±10%-clamp / 2.5-round / legacy-respect body of applyFineTuneIfDataRich is exercised
//     and the golden is still byte-deterministic (clock is fixed, not wall).
// No decision output is touched. Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

type ProgressionSessionSpec = {
  id: string;
  daysAgo: number;
  sets?: Array<{ weight: number; reps: number; rir?: number; note?: string; painFlag?: boolean; techniqueQuality?: 'good' | 'acceptable' | 'poor' }>;
};

const generateProgression = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: progression-suggestion requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  // iOS-17e-6a: OPTIONAL injected fineTune clock. Omitted by the 17e-3 fixtures (wall-clock
  // → insufficient → byte-identical); set to deterministicClockIso by the fine-tune-* live
  // fixtures so the projection fires deterministically. A literal `true` means "use nowIso".
  const asOfDate: string | undefined =
    input.asOfDate === true ? nowIso : (typeof input.asOfDate === 'string' ? input.asOfDate : undefined);
  const templateId: string = input.templateId ?? 'push-a';
  const exerciseId: string = input.exerciseId ?? getTemplate(templateId).exercises[0].id;
  const sessions: ProgressionSessionSpec[] = Array.isArray(input.sessions) ? input.sessions : [];

  const history: TrainingSession[] = sessions.map((s) =>
    makeSession({
      id: s.id,
      date: dateOnlyDaysBefore(nowIso, s.daysAgo),
      templateId,
      exerciseId,
      setSpecs: s.sets ?? [{ weight: 60, reps: 6 }],
    }) as TrainingSession,
  );

  // The templateExercise (ExerciseForProgression) the engine consumes. `id` is
  // normalised to the history exercise id so findRecentPerformances/findPreviousPerformance
  // match; every other field is the fixture's verbatim spec (the Swift port decodes the
  // SAME echoed object and applies the identical number()/?? defaults).
  const exercise = { ...(input.exercise ?? {}), id: exerciseId };

  const suggestion = makeSuggestion(exercise as any, history, asOfDate);
  const topBackoff = shouldUseTopBackoff(exercise as any);
  const setPrescription = buildSetPrescription(exercise as any, {
    weight: suggestion.weight,
    reps: suggestion.reps,
  });

  // Echo the live fineTune fallbackReason so the parity test can ASSERT the deferral
  // premise (golden-neutral / inert) holds for this fixture. Mirrors the same call
  // makeSuggestion makes (progressionRulesEngine.ts:202); fallbackReason depends only on
  // in-window sample count, so the exact targetReps does not matter here.
  const historyId = (exercise as any).baseId || (exercise as any).id;
  const fineTune = buildSetWeightFineTune({
    history,
    exerciseId: historyId,
    baseExerciseId: (exercise as any).baseId,
    targetReps: number((exercise as any).repMin),
    repMin: number((exercise as any).repMin),
    repMax: number((exercise as any).repMax),
    asOfDate,
  });

  const topBackoffProbes = (Array.isArray(input.topBackoffProbes) ? input.topBackoffProbes : []).map(
    (p: { label?: string; exercise: any }) => ({
      label: p.label ?? null,
      exercise: p.exercise,
      shouldUseTopBackoff: shouldUseTopBackoff(p.exercise),
    }),
  );

  const setPrescriptionProbes = (Array.isArray(input.setPrescriptionProbes) ? input.setPrescriptionProbes : []).map(
    (p: { label?: string; exercise: any; suggestion: { weight: number; reps: number } }) => ({
      label: p.label ?? null,
      exercise: p.exercise,
      suggestion: p.suggestion,
      setPrescription: buildSetPrescription(p.exercise, p.suggestion),
    }),
  );

  return {
    sourceFixtureId: meta.id,
    engineInput: { exercise, history },
    suggestion,
    shouldUseTopBackoff: topBackoff,
    setPrescription,
    fineTuneNeutrality: {
      fallbackReason: fineTune.basis.fallbackReason ?? null,
      samplesUsed: fineTune.basis.samplesUsed,
    },
    topBackoffProbes,
    setPrescriptionProbes,
  };
};

// ---------------------------------------------------------------------------
// iOS-17e-4 — setWeightFineTuneEngine OUTPUT parity
//
// Builds a synthetic, performed-set history via the SAME makeSession fixture helper the
// iOS-17e-1..3 fixtures use, then runs the REAL buildSetWeightFineTune over an explicit
// `asOfDate` (= deterministicClockIso — see the import note) and echoes BOTH the
// engineInput (scalar params + history, verbatim — the Swift port decodes them and
// re-runs the ported function) AND the computed result (SetWeightFineTuneResult). An
// optional `probes` array runs param-only variations over the SAME history (different
// targetReps / repMin / repMax / windowWeeks / baseExerciseId / exerciseId) so the
// targetIds-membership, window-override, clamp and 0-sample branches are covered without
// fabricating extra sessions. No decision output is touched. Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

type FineTuneSessionSpec = {
  id: string;
  daysAgo: number;
  templateId?: string;
  exerciseId?: string;
  sets?: Array<{ weight: number; reps: number; rir?: number }>;
};

type FineTuneScalarInput = {
  exerciseId?: string;
  baseExerciseId?: string;
  targetReps: number;
  repMin: number;
  repMax: number;
  windowWeeks?: number;
  asOfDate?: string;
};

const echoFineTuneInput = (i: FineTuneScalarInput) => ({
  exerciseId: i.exerciseId,
  baseExerciseId: i.baseExerciseId,
  targetReps: i.targetReps,
  repMin: i.repMin,
  repMax: i.repMax,
  windowWeeks: i.windowWeeks,
  asOfDate: i.asOfDate,
});

const generateSetWeightFineTune = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: set-weight-fine-tune requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const exerciseId: string = input.exerciseId ?? getTemplate('push-a').exercises[0].id;
  const sessions: FineTuneSessionSpec[] = Array.isArray(input.sessions) ? input.sessions : [];

  const history: TrainingSession[] = sessions.map((s) =>
    makeSession({
      id: s.id,
      date: dateOnlyDaysBefore(nowIso, s.daysAgo),
      templateId: s.templateId ?? 'push-a',
      exerciseId: s.exerciseId ?? exerciseId,
      setSpecs: s.sets ?? [{ weight: 60, reps: 6 }],
    }) as TrainingSession,
  );

  const baseScalar: FineTuneScalarInput = {
    exerciseId: input.exerciseId ?? exerciseId,
    baseExerciseId: input.baseExerciseId,
    targetReps: number(input.targetReps),
    repMin: number(input.repMin),
    repMax: number(input.repMax),
    windowWeeks: input.windowWeeks,
    asOfDate: input.asOfDate ?? nowIso,
  };
  const result = buildSetWeightFineTune({ history, ...baseScalar });

  const probes = (Array.isArray(input.probes) ? input.probes : []).map(
    (p: { label?: string; input: Partial<FineTuneScalarInput> }) => {
      const scalar: FineTuneScalarInput = { ...baseScalar, ...p.input };
      // asOfDate defaults to the base (deterministic clock) unless the probe overrides it.
      scalar.asOfDate = p.input.asOfDate ?? baseScalar.asOfDate;
      return {
        label: p.label ?? null,
        input: echoFineTuneInput(scalar),
        result: buildSetWeightFineTune({ history, ...scalar }),
      };
    },
  );

  return {
    sourceFixtureId: meta.id,
    engineInput: { input: echoFineTuneInput(baseScalar), history },
    result,
    probes,
  };
};

// ---------------------------------------------------------------------------
// iOS-17e-4 — loadFeedbackEngine OUTPUT parity
//
// Builds a synthetic history via makeSession and attaches per-session `loadFeedback`
// arrays (+ optional `dataFlag`) the way the e1rm generator attaches dataFlag, then runs
// the REAL collectLoadFeedback / buildLoadFeedbackSummary / getLoadFeedbackAdjustment per
// `probes[].exerciseId`, and upsertLoadFeedback per `upsertProbes[]`. Echoes the
// engineInput history verbatim (the Swift port decodes the SAME sessions — loadFeedback /
// dataFlag ride in the `_unknown` open bag) + every computed output. No decision output
// is touched. Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

type LoadFeedbackSessionSpec = {
  id: string;
  daysAgo: number;
  dataFlag?: string;
  loadFeedback?: Array<{ exerciseId: string; feedback: LoadFeedbackValue; note?: string }>;
};

const generateLoadFeedback = (input: any, meta: ParityMeta) => {
  const sessions: LoadFeedbackSessionSpec[] = Array.isArray(input.sessions) ? input.sessions : [];
  if (sessions.length > 0 && !meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: load-feedback history fixtures require deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso ?? '';
  const defaultExerciseId = getTemplate('push-a').exercises[0].id;

  const history: TrainingSession[] = sessions.map((s) => {
    const date = dateOnlyDaysBefore(nowIso, s.daysAgo);
    const session = makeSession({
      id: s.id,
      date,
      templateId: 'push-a',
      exerciseId: defaultExerciseId,
      setSpecs: [{ weight: 60, reps: 6 }],
    }) as TrainingSession & Record<string, unknown>;
    if (s.dataFlag !== undefined) session.dataFlag = s.dataFlag;
    if (Array.isArray(s.loadFeedback)) {
      session.loadFeedback = s.loadFeedback.map((f) => ({
        exerciseId: f.exerciseId,
        sessionId: s.id,
        date,
        feedback: f.feedback,
        ...(f.note !== undefined ? { note: f.note } : {}),
      })) as LoadFeedback[];
    }
    return session as TrainingSession;
  });

  const probes = (Array.isArray(input.probes) ? input.probes : []).map(
    (p: { label?: string; exerciseId?: string }) => ({
      label: p.label ?? null,
      exerciseId: p.exerciseId ?? null,
      collect: collectLoadFeedback(history, p.exerciseId),
      summary: buildLoadFeedbackSummary(history, p.exerciseId),
      adjustment: getLoadFeedbackAdjustment(history, p.exerciseId),
    }),
  );

  const upsertProbes = (Array.isArray(input.upsertProbes) ? input.upsertProbes : []).map(
    (p: {
      label?: string;
      session: { id: string; date: string; loadFeedback?: LoadFeedback[] };
      exerciseId: string;
      feedback: LoadFeedbackValue;
      note?: string;
    }) => {
      const baseSession = {
        id: p.session.id,
        date: p.session.date,
        ...(Array.isArray(p.session.loadFeedback) ? { loadFeedback: p.session.loadFeedback } : {}),
      } as unknown as TrainingSession;
      const next = upsertLoadFeedback(baseSession, p.exerciseId, p.feedback, p.note);
      return {
        label: p.label ?? null,
        session: baseSession,
        exerciseId: p.exerciseId,
        feedback: p.feedback,
        note: p.note ?? null,
        resultLoadFeedback: next.loadFeedback ?? [],
      };
    },
  );

  return {
    sourceFixtureId: meta.id,
    engineInput: { history },
    probes,
    upsertProbes,
  };
};

// ---------------------------------------------------------------------------
// AN-1 — leaf-analytics engines OUTPUT parity (trainingStreak / recentPRDelta /
// weeklyMuscleBalance)
//
// Each fixture carries a compact `cases` array; per case the generator materialises a
// synthetic, deterministic `history` (dates derive from parityMeta.deterministicClockIso
// via dateOnlyDaysBefore / isoDaysBefore — the SAME helpers the e1rm/decision fixtures
// use) from a minimal session spec, runs the REAL analytics engine over it with an
// explicit `options.nowIso` (= the deterministic clock), and echoes BOTH the engineInput
// (history + options, verbatim — the Swift port decodes them and re-runs the ported
// function) AND the computed result. PURE / clockless given the injected nowIso — no
// decision output is touched. Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

type AnalyticsSetSpec = { weight: number; reps: number; done?: boolean; actualWeightKg?: number };
type AnalyticsExerciseSpec = {
  id: string;
  name?: string;
  canonicalExerciseId?: string;
  baseId?: string;
  muscle?: string;
  primaryMuscles?: string[];
  muscleContribution?: Record<string, number>;
  sets?: AnalyticsSetSpec[];
};
type AnalyticsSessionSpec = {
  id: string;
  daysAgo: number;
  completed?: boolean;
  dataFlag?: string;
  startedAtDaysAgo?: number;
  finishedAtDaysAgo?: number;
  exercises?: AnalyticsExerciseSpec[];
};

// Materialise a session spec into a TrainingSession-shaped object. Only the fields the
// analytics engines read are emitted (completed / dataFlag / finishedAt / startedAt / date
// / exercises[].sets / .name / .canonicalExerciseId / .baseId / .muscle / .primaryMuscles /
// .muscleContribution). The Swift TrainingSession decodes typed fields + the open bag.
const buildAnalyticsSession = (spec: AnalyticsSessionSpec, nowIso: string): TrainingSession => {
  const session: Record<string, unknown> = {
    id: spec.id,
    date: dateOnlyDaysBefore(nowIso, spec.daysAgo),
    completed: spec.completed ?? true,
  };
  if (spec.dataFlag !== undefined) session.dataFlag = spec.dataFlag;
  if (spec.startedAtDaysAgo !== undefined) session.startedAt = isoDaysBefore(nowIso, spec.startedAtDaysAgo);
  if (spec.finishedAtDaysAgo !== undefined) session.finishedAt = isoDaysBefore(nowIso, spec.finishedAtDaysAgo);
  if (Array.isArray(spec.exercises)) {
    session.exercises = spec.exercises.map((ex) => {
      const exercise: Record<string, unknown> = { id: ex.id };
      if (ex.name !== undefined) exercise.name = ex.name;
      if (ex.canonicalExerciseId !== undefined) exercise.canonicalExerciseId = ex.canonicalExerciseId;
      if (ex.baseId !== undefined) exercise.baseId = ex.baseId;
      if (ex.muscle !== undefined) exercise.muscle = ex.muscle;
      if (ex.primaryMuscles !== undefined) exercise.primaryMuscles = ex.primaryMuscles;
      if (ex.muscleContribution !== undefined) exercise.muscleContribution = ex.muscleContribution;
      exercise.sets = (ex.sets ?? []).map((s, i) => ({
        id: `${ex.id}-${i + 1}`,
        weight: s.weight,
        reps: s.reps,
        done: s.done ?? true,
        ...(s.actualWeightKg !== undefined ? { actualWeightKg: s.actualWeightKg } : {}),
      }));
      return exercise;
    });
  }
  return session as unknown as TrainingSession;
};

const generateTrainingStreak = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: training-streak requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map(
    (c: { label?: string; options?: { weekStartDayOfWeek?: number }; sessions?: AnalyticsSessionSpec[] }) => {
      const history = (c.sessions ?? []).map((s) => buildAnalyticsSession(s, nowIso));
      const options: Record<string, unknown> = { nowIso };
      if (c.options?.weekStartDayOfWeek !== undefined) options.weekStartDayOfWeek = c.options.weekStartDayOfWeek;
      const result = computeTrainingStreak(history, options as any);
      return { label: c.label ?? null, options, history, result };
    },
  );
  return { sourceFixtureId: meta.id, cases };
};

const generateRecentPRDelta = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: recent-pr-delta requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map(
    (c: { label?: string; options?: { windowDays?: number; limit?: number }; sessions?: AnalyticsSessionSpec[] }) => {
      const history = (c.sessions ?? []).map((s) => buildAnalyticsSession(s, nowIso));
      const options: Record<string, unknown> = { nowIso };
      if (c.options?.windowDays !== undefined) options.windowDays = c.options.windowDays;
      if (c.options?.limit !== undefined) options.limit = c.options.limit;
      const result = computeRecentPRDeltas(history, options as any);
      return { label: c.label ?? null, options, history, result };
    },
  );
  return { sourceFixtureId: meta.id, cases };
};

const generateWeeklyMuscleBalance = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: weekly-muscle-balance requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map(
    (c: { label?: string; options?: { weekStartDayOfWeek?: number; focusMuscles?: string[] }; sessions?: AnalyticsSessionSpec[] }) => {
      const history = (c.sessions ?? []).map((s) => buildAnalyticsSession(s, nowIso));
      const options: Record<string, unknown> = { nowIso };
      if (c.options?.weekStartDayOfWeek !== undefined) options.weekStartDayOfWeek = c.options.weekStartDayOfWeek;
      if (c.options?.focusMuscles !== undefined) options.focusMuscles = c.options.focusMuscles;
      const result = computeWeeklyMuscleBalance(history, options as any);
      return { label: c.label ?? null, options, history, result };
    },
  );
  return { sourceFixtureId: meta.id, cases };
};

// ---------------------------------------------------------------------------
// AN-2 — plateauDetectionEngine OUTPUT parity (detectExercisePlateau)
//
// Each fixture carries a compact `cases` array; per case the generator materialises a
// synthetic, deterministic `history` (session dates derive from
// parityMeta.deterministicClockIso via dateOnlyDaysBefore / isoDaysBefore — the SAME
// helpers the AN-1 / e1rm fixtures use) from a session spec that carries the rich
// per-set fields the plateau engine reads (techniqueQuality / rir / painFlag / set `type`)
// + per-session loadFeedback / dataFlag / identity fields, runs the REAL
// detectExercisePlateau over it with the case's optional external inputs echoed VERBATIM,
// and emits BOTH the engineInput (history + the optional params the Swift port re-runs
// against) AND the computed result. PURE / clockless. Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

type PlateauSetSpec = {
  weight?: number;
  reps?: number;
  done?: boolean;
  actualWeightKg?: number;
  rir?: number | string;
  techniqueQuality?: 'good' | 'acceptable' | 'poor';
  painFlag?: boolean;
  type?: string;
};
type PlateauExerciseSpec = {
  id: string;
  name?: string;
  canonicalExerciseId?: string;
  baseId?: string;
  actualExerciseId?: string;
  originalExerciseId?: string;
  replacementExerciseId?: string;
  replacedFromId?: string;
  sets?: PlateauSetSpec[];
};
type PlateauSessionSpec = {
  id: string;
  daysAgo: number;
  dataFlag?: string;
  startedAtDaysAgo?: number;
  finishedAtDaysAgo?: number;
  loadFeedback?: Array<{ exerciseId: string; feedback: LoadFeedbackValue; note?: string }>;
  exercises?: PlateauExerciseSpec[];
};

// Materialise a plateau session spec into a TrainingSession-shaped object. Only the
// fields the plateau engine reads are emitted; the Swift TrainingSession decodes the
// typed fields + the open bag (loadFeedback / dataFlag / set.type / exercise identity
// aliases ride in `_unknown`).
const buildPlateauSession = (spec: PlateauSessionSpec, nowIso: string): TrainingSession => {
  const date = dateOnlyDaysBefore(nowIso, spec.daysAgo);
  const session: Record<string, unknown> = { id: spec.id, date, completed: true };
  if (spec.dataFlag !== undefined) session.dataFlag = spec.dataFlag;
  if (spec.startedAtDaysAgo !== undefined) session.startedAt = isoDaysBefore(nowIso, spec.startedAtDaysAgo);
  if (spec.finishedAtDaysAgo !== undefined) session.finishedAt = isoDaysBefore(nowIso, spec.finishedAtDaysAgo);
  if (Array.isArray(spec.loadFeedback)) {
    session.loadFeedback = spec.loadFeedback.map((f) => ({
      exerciseId: f.exerciseId,
      sessionId: spec.id,
      date,
      feedback: f.feedback,
      ...(f.note !== undefined ? { note: f.note } : {}),
    }));
  }
  if (Array.isArray(spec.exercises)) {
    session.exercises = spec.exercises.map((ex) => {
      const exercise: Record<string, unknown> = { id: ex.id };
      if (ex.name !== undefined) exercise.name = ex.name;
      if (ex.canonicalExerciseId !== undefined) exercise.canonicalExerciseId = ex.canonicalExerciseId;
      if (ex.baseId !== undefined) exercise.baseId = ex.baseId;
      if (ex.actualExerciseId !== undefined) exercise.actualExerciseId = ex.actualExerciseId;
      if (ex.originalExerciseId !== undefined) exercise.originalExerciseId = ex.originalExerciseId;
      if (ex.replacementExerciseId !== undefined) exercise.replacementExerciseId = ex.replacementExerciseId;
      if (ex.replacedFromId !== undefined) exercise.replacedFromId = ex.replacedFromId;
      exercise.sets = (ex.sets ?? []).map((s, i) => {
        const set: Record<string, unknown> = { id: `${ex.id}-${i + 1}`, done: s.done ?? true };
        if (s.weight !== undefined) set.weight = s.weight;
        if (s.actualWeightKg !== undefined) set.actualWeightKg = s.actualWeightKg;
        if (s.reps !== undefined) set.reps = s.reps;
        if (s.rir !== undefined) set.rir = s.rir;
        if (s.techniqueQuality !== undefined) set.techniqueQuality = s.techniqueQuality;
        if (s.painFlag !== undefined) set.painFlag = s.painFlag;
        if (s.type !== undefined) set.type = s.type;
        return set;
      });
      return exercise;
    });
  }
  return session as unknown as TrainingSession;
};

const generatePlateauDetection = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: plateau-detection requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map(
    (c: {
      label?: string;
      exerciseId: string;
      sessions?: PlateauSessionSpec[];
      e1rmProfile?: unknown;
      loadFeedback?: unknown;
      effectiveSetSummary?: unknown;
      techniqueQualitySummary?: unknown;
      painPatterns?: unknown;
    }) => {
      const history = (c.sessions ?? []).map((s) => buildPlateauSession(s, nowIso));
      // Build the engine params, threading through ONLY the optional external inputs the
      // case provides (so canonicalStringify drops the absent ones — the Swift port reads
      // each optionally). The engine treats these as opaque external inputs.
      const params: Parameters<typeof detectExercisePlateau>[0] = { exerciseId: c.exerciseId, history };
      if (c.e1rmProfile !== undefined) params.e1rmProfile = c.e1rmProfile as never;
      if (c.loadFeedback !== undefined) params.loadFeedback = c.loadFeedback as never;
      if (c.effectiveSetSummary !== undefined) params.effectiveSetSummary = c.effectiveSetSummary as never;
      if (c.techniqueQualitySummary !== undefined) params.techniqueQualitySummary = c.techniqueQualitySummary as never;
      if (c.painPatterns !== undefined) params.painPatterns = c.painPatterns as never;
      const result = detectExercisePlateau(params);
      const echoed: Record<string, unknown> = { label: c.label ?? null, exerciseId: c.exerciseId, history };
      if (c.e1rmProfile !== undefined) echoed.e1rmProfile = c.e1rmProfile;
      if (c.loadFeedback !== undefined) echoed.loadFeedback = c.loadFeedback;
      if (c.effectiveSetSummary !== undefined) echoed.effectiveSetSummary = c.effectiveSetSummary;
      if (c.techniqueQualitySummary !== undefined) echoed.techniqueQualitySummary = c.techniqueQualitySummary;
      if (c.painPatterns !== undefined) echoed.painPatterns = c.painPatterns;
      echoed.result = result;
      return echoed;
    },
  );
  return { sourceFixtureId: meta.id, cases };
};

// ---------------------------------------------------------------------------
// AN-3 — effectiveSetEngine (analytics-consumed subset) + analytics.ts dashboard
// OUTPUT parity. Each fixture carries a `cases` array; per case the generator
// materialises a synthetic history/exercise/set from a verbatim spec (ONLY
// `date`/`startedAt`/`finishedAt` are derived from parityMeta.deterministicClockIso via
// dateOnlyDaysBefore/isoDaysBefore — every other field is the fixture's own value, passed
// through), runs the REAL effectiveSet/analytics function, and echoes BOTH the engineInput
// and the computed result. PURE / clockless apart from buildWeeklyReport's INJECTED
// `options.nowIso`. Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

type AnalyticsAnySpec = Record<string, any>;

// Materialise a near-final session spec: convert `daysAgo`/`startedAtDaysAgo`/
// `finishedAtDaysAgo` to deterministic date strings; pass every other field through
// verbatim (dataFlag / templateName / focus / supportExerciseLogs / correctionBlock /
// functionalBlock ride in the open bag). Sets get an auto id (`${ex.id}-${i+1}`) when none
// is given, and `done:true` ONLY when neither `done` nor `completedAt` is provided (so the
// incomplete + legacy-completed branches stay reachable).
const materializeAnalyticsSession = (spec: AnalyticsAnySpec, nowIso: string): TrainingSession => {
  const { daysAgo, startedAtDaysAgo, finishedAtDaysAgo, exercises, ...rest } = spec;
  const session: AnalyticsAnySpec = { ...rest };
  if (daysAgo !== undefined) session.date = dateOnlyDaysBefore(nowIso, daysAgo);
  if (startedAtDaysAgo !== undefined) session.startedAt = isoDaysBefore(nowIso, startedAtDaysAgo);
  if (finishedAtDaysAgo !== undefined) session.finishedAt = isoDaysBefore(nowIso, finishedAtDaysAgo);
  if (Array.isArray(exercises)) {
    session.exercises = exercises.map((ex: AnalyticsAnySpec) => {
      const { sets, ...exRest } = ex;
      const exercise: AnalyticsAnySpec = { ...exRest };
      if (Array.isArray(sets)) {
        exercise.sets = sets.map((s: AnalyticsAnySpec, i: number) => {
          const set: AnalyticsAnySpec = { ...s, id: s.id ?? `${ex.id}-${i + 1}` };
          if (s.done === undefined && s.completedAt === undefined) set.done = true;
          return set;
        });
      } else if (sets !== undefined) {
        exercise.sets = sets; // integer/template form passes through (setCountForExercise reads number(sets))
      }
      return exercise;
    });
  }
  return session as unknown as TrainingSession;
};

const resolveAnalyticsDateRange = (raw: any, nowIso: string) => {
  if (!raw) return undefined;
  const range: { from?: string; to?: string } = {};
  if (raw.fromDaysAgo !== undefined) range.from = dateOnlyDaysBefore(nowIso, raw.fromDaysAgo);
  else if (raw.from !== undefined) range.from = raw.from;
  if (raw.toDaysAgo !== undefined) range.to = dateOnlyDaysBefore(nowIso, raw.toDaysAgo);
  else if (raw.to !== undefined) range.to = raw.to;
  return range;
};

const generateEffectiveSetEvaluate = (input: any, meta: ParityMeta) => {
  const cases = (Array.isArray(input.cases) ? input.cases : []).map(
    (c: { label?: string; set: any; exercise?: any; context?: { plannedReps?: [number, number] } }) => {
      const result = evaluateEffectiveSet(c.set, c.exercise, c.context);
      const echoed: Record<string, unknown> = { label: c.label ?? null, set: c.set };
      if (c.exercise !== undefined) echoed.exercise = c.exercise;
      if (c.context !== undefined) echoed.context = c.context;
      echoed.result = result;
      return echoed;
    },
  );
  return { sourceFixtureId: meta.id, cases };
};

const generateEffectiveSetVolume = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: effective-set/volume-summary requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map((c: any) => {
    const history = (c.sessions ?? []).map((s: any) => materializeAnalyticsSession(s, nowIso));
    const dateRange = resolveAnalyticsDateRange(c.dateRange, nowIso);
    const summary = buildEffectiveVolumeSummary(history, dateRange);
    const countProbes = (Array.isArray(c.countProbes) ? c.countProbes : []).map((p: any) => ({
      label: p.label ?? null,
      sessionIndex: p.sessionIndex,
      minScore: p.minScore,
      count: countEffectiveSets(history[p.sessionIndex], p.minScore !== undefined ? { minScore: p.minScore } : undefined),
    }));
    const contributionProbes = (Array.isArray(c.contributionProbes) ? c.contributionProbes : []).map((p: any) => ({
      label: p.label ?? null,
      exercise: p.exercise,
      contribution: getMuscleContribution(p.exercise),
    }));
    const echoed: Record<string, unknown> = { label: c.label ?? null, history };
    if (dateRange !== undefined) echoed.dateRange = dateRange;
    echoed.summary = summary;
    if (countProbes.length) echoed.countProbes = countProbes;
    if (contributionProbes.length) echoed.contributionProbes = contributionProbes;
    return echoed;
  });
  return { sourceFixtureId: meta.id, cases };
};

const generateMuscleVolumeDashboard = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: analytics/muscle-volume-dashboard requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map((c: any) => {
    const history = (c.sessions ?? []).map((s: any) => materializeAnalyticsSession(s, nowIso));
    // weekStart derives from `weekStartDaysAgo` (deterministic, nowIso-relative) when given;
    // an explicit `weekStart` string is used verbatim. number(target) is the fixture value.
    let wp: any = null;
    if (c.weeklyPrescription) {
      const { weekStartDaysAgo, ...rest } = c.weeklyPrescription;
      wp = { ...rest };
      if (weekStartDaysAgo !== undefined) wp.weekStart = dateOnlyDaysBefore(nowIso, weekStartDaysAgo);
    }
    const result = buildMuscleVolumeDashboard(history, wp);
    const echoed: Record<string, unknown> = { label: c.label ?? null, history };
    if (wp !== null) echoed.weeklyPrescription = wp;
    echoed.result = result;
    return echoed;
  });
  return { sourceFixtureId: meta.id, cases };
};

const generateExerciseTrend = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: analytics/exercise-trend requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map((c: any) => {
    const history = (c.sessions ?? []).map((s: any) => materializeAnalyticsSession(s, nowIso));
    const trend = buildExerciseTrend(history, c.exerciseId);
    const status = trendStatus(trend);
    return { label: c.label ?? null, exerciseId: c.exerciseId, history, trend, status };
  });
  return { sourceFixtureId: meta.id, coreTrendExercises: CORE_TREND_EXERCISES, cases };
};

const generatePrs = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: analytics/prs requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map((c: any) => {
    const history = (c.sessions ?? []).map((s: any) => materializeAnalyticsSession(s, nowIso));
    const result = buildPrs(history);
    return { label: c.label ?? null, history, result };
  });
  return { sourceFixtureId: meta.id, cases };
};

const generateWeeklyReport = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: analytics/weekly-report requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map((c: any) => {
    const history = (c.sessions ?? []).map((s: any) => materializeAnalyticsSession(s, nowIso));
    const bodyWeights = (Array.isArray(c.bodyWeights) ? c.bodyWeights : []) as BodyWeightEntry[];
    // asOfDate: `true` (or omitted) → the deterministic clock; an explicit string is used verbatim.
    const asOfDate = c.asOfDate === true || c.asOfDate === undefined ? nowIso : String(c.asOfDate);
    const result = buildWeeklyReport(history, bodyWeights, { nowIso: asOfDate });
    return { label: c.label ?? null, asOfDate, bodyWeights, history, result };
  });
  return { sourceFixtureId: meta.id, cases };
};

const generateAdherenceReport = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: analytics/adherence-report requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map((c: any) => {
    const history = (c.sessions ?? []).map((s: any) => materializeAnalyticsSession(s, nowIso));
    const result = buildAdherenceReport(history);
    return { label: c.label ?? null, history, result };
  });
  return { sourceFixtureId: meta.id, cases };
};

// ---------------------------------------------------------------------------
// AN-4 — sessionDetailSummaryEngine (sessionQuality-consumed subset) +
// sessionQualityEngine OUTPUT parity. Each case materialises a synthetic session
// (via the shared materializeAnalyticsSession — ONLY date fields derive from the
// deterministic clock; every other field passes through verbatim), runs the REAL
// buildSessionQualityResult, and echoes BOTH the engineInput and the computed
// result PLUS structural probes for the two CALLed sessionDetail functions
// (groupSessionSetsByType / buildWorkingOnlySession). Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

const buildGroupedProbe = (grouped: ReturnType<typeof groupSessionSetsByType>) => ({
  warmupSetCount: grouped.warmupSets.length,
  workingSetCount: grouped.workingSets.length,
  uncategorizedSetCount: grouped.uncategorizedSets.length,
  supportSetCount: grouped.supportSets.length,
  groups: grouped.exerciseGroups.map((g) => ({
    exerciseId: g.exerciseId ?? null,
    warmup: g.warmupSets.length,
    working: g.workingSets.length,
    uncategorized: g.uncategorizedSets.length,
  })),
  // `item.set.type` after classification (warmup entries → 'warmup'; working entries keep
  // their original type, undefined → null) — pins classifySet + the warmup type rewrite.
  workingSetTypes: grouped.workingSets.map((it: any) => it.set.type ?? null),
  warmupSetTypes: grouped.warmupSets.map((it: any) => it.set.type ?? null),
});

const buildWorkingOnlyProbe = (workingOnly: any) => ({
  dataFlag: workingOnly.dataFlag ?? null,
  focusWarmupSetLogsLength: Array.isArray(workingOnly.focusWarmupSetLogs) ? workingOnly.focusWarmupSetLogs.length : 0,
  exercises: (workingOnly.exercises ?? []).map((ex: any) => ({
    id: ex.id ?? null,
    setCount: Array.isArray(ex.sets) ? ex.sets.length : 0,
    // `item.set.type || 'straight'` — pins the working-only set type defaulting.
    setTypes: Array.isArray(ex.sets) ? ex.sets.map((s: any) => s.type ?? null) : [],
  })),
});

const generateSessionQuality = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: session-quality requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map((c: any) => {
    const session = materializeAnalyticsSession(c.session ?? {}, nowIso);
    // Thread ONLY the optional params the case provides (so canonicalStringify drops absent
    // ones — the Swift port reads each optionally). The engine treats these as opaque inputs.
    const params: Parameters<typeof buildSessionQualityResult>[0] = { session };
    if (c.effectiveSetSummary !== undefined) params.effectiveSetSummary = c.effectiveSetSummary;
    if (c.loadFeedback !== undefined) params.loadFeedback = c.loadFeedback;
    if (c.painPatterns !== undefined) params.painPatterns = c.painPatterns;
    const result = buildSessionQualityResult(params);
    const grouped = groupSessionSetsByType(session);
    const workingOnly = buildWorkingOnlySession(session);
    const echoed: Record<string, unknown> = { label: c.label ?? null, session };
    if (c.effectiveSetSummary !== undefined) echoed.effectiveSetSummary = c.effectiveSetSummary;
    if (c.loadFeedback !== undefined) echoed.loadFeedback = c.loadFeedback;
    if (c.painPatterns !== undefined) echoed.painPatterns = c.painPatterns;
    echoed.result = result;
    echoed.grouped = buildGroupedProbe(grouped);
    echoed.workingOnly = buildWorkingOnlyProbe(workingOnly);
    return echoed;
  });
  return { sourceFixtureId: meta.id, cases };
};

// ---------------------------------------------------------------------------
// AN-5 — painPatternEngine (trainingLevel-consumed subset) + trainingLevelEngine
// OUTPUT parity. Each case materialises a synthetic history (via the shared
// materializeAnalyticsSession — ONLY date fields derive from the deterministic clock;
// every other field passes through verbatim), runs the REAL engine, and echoes BOTH the
// engineInput and the computed result. The optional external inputs (currentDate /
// lookbackDays / maxSessions for pain-pattern; painPatterns / techniqueQualitySummary /
// calendarData overrides for training-level) are threaded through ONLY when the case
// provides them (so canonicalStringify drops absent ones — the Swift port reads each
// optionally). PURE / clockless apart from the OPTIONAL injected currentDate.
// Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

const generatePainPattern = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: pain-pattern requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map((c: any) => {
    const history = (c.sessions ?? []).map((s: any) => materializeAnalyticsSession(s, nowIso));
    // Build the options bag, threading ONLY what the case provides. `currentDateDaysAgo`
    // derives a deterministic date-only anchor; an explicit `currentDate` is used verbatim.
    const options: { currentDate?: string; lookbackDays?: number; maxSessions?: number } = {};
    if (c.currentDateDaysAgo !== undefined) options.currentDate = dateOnlyDaysBefore(nowIso, c.currentDateDaysAgo);
    else if (c.currentDate !== undefined) options.currentDate = c.currentDate;
    if (c.lookbackDays !== undefined) options.lookbackDays = c.lookbackDays;
    if (c.maxSessions !== undefined) options.maxSessions = c.maxSessions;
    const patterns = buildPainPatterns(history, options);
    const echoed: Record<string, unknown> = { label: c.label ?? null, history };
    if (Object.keys(options).length) echoed.options = options;
    echoed.patterns = patterns;
    return echoed;
  });
  return { sourceFixtureId: meta.id, cases };
};

const generateTrainingLevel = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: training-level requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map((c: any) => {
    const history = (c.sessions ?? []).map((s: any) => materializeAnalyticsSession(s, nowIso));
    // Thread ONLY the optional external inputs the case provides (so canonicalStringify drops
    // absent ones — the Swift port reads each optionally and falls back to computing). The
    // engine treats these as opaque external summaries.
    const params: Parameters<typeof buildTrainingLevelAssessment>[0] = { history };
    if (c.painPatterns !== undefined) params.painPatterns = c.painPatterns;
    if (c.techniqueQualitySummary !== undefined) params.techniqueQualitySummary = c.techniqueQualitySummary;
    if (c.calendarData !== undefined) params.calendarData = c.calendarData;
    const assessment = buildTrainingLevelAssessment(params);
    // Per-case probes pinning the other two exported functions directly.
    const techniqueQualitySummaryProbe = buildTechniqueQualitySummary(history);
    const levelLabelProbe = formatAutoTrainingLevel(assessment.level);
    const echoed: Record<string, unknown> = { label: c.label ?? null, history };
    if (c.painPatterns !== undefined) echoed.painPatterns = c.painPatterns;
    if (c.techniqueQualitySummary !== undefined) echoed.techniqueQualitySummary = c.techniqueQualitySummary;
    if (c.calendarData !== undefined) echoed.calendarData = c.calendarData;
    echoed.assessment = assessment;
    echoed.techniqueQualitySummaryProbe = techniqueQualitySummaryProbe;
    echoed.levelLabelProbe = levelLabelProbe;
    return echoed;
  });
  return { sourceFixtureId: meta.id, cases };
};

// ---------------------------------------------------------------------------
// AN-5b — recommendationConfidenceEngine OUTPUT parity. Each case materialises a synthetic
// history (via the shared materializeAnalyticsSession — ONLY date fields derive from the
// deterministic clock; every other field passes through verbatim), threads ONLY the optional
// external inputs the case provides (exerciseId / e1rmProfile / effectiveSetSummary /
// loadFeedback / techniqueQualitySummary / painPatterns / trainingLevel / recentEdits — so
// canonicalStringify drops absent ones; the Swift port reads each optionally), runs the REAL
// buildRecommendationConfidence, and echoes BOTH the engineInput and the computed result.
// PURE / clockless apart from the history dates. Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

const generateRecommendationConfidence = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: recommendation-confidence requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map((c: any) => {
    const history = (c.sessions ?? []).map((s: any) => materializeAnalyticsSession(s, nowIso));
    const params: Parameters<typeof buildRecommendationConfidence>[0] = { history };
    if (c.exerciseId !== undefined) params.exerciseId = c.exerciseId;
    if (c.e1rmProfile !== undefined) params.e1rmProfile = c.e1rmProfile;
    if (c.effectiveSetSummary !== undefined) params.effectiveSetSummary = c.effectiveSetSummary;
    if (c.loadFeedback !== undefined) params.loadFeedback = c.loadFeedback;
    if (c.techniqueQualitySummary !== undefined) params.techniqueQualitySummary = c.techniqueQualitySummary;
    if (c.painPatterns !== undefined) params.painPatterns = c.painPatterns;
    if (c.trainingLevel !== undefined) params.trainingLevel = c.trainingLevel;
    if (c.recentEdits !== undefined) params.recentEdits = c.recentEdits;
    const result = buildRecommendationConfidence(params);
    const echoed: Record<string, unknown> = { label: c.label ?? null };
    if (c.exerciseId !== undefined) echoed.exerciseId = c.exerciseId;
    echoed.history = history;
    if (c.e1rmProfile !== undefined) echoed.e1rmProfile = c.e1rmProfile;
    if (c.effectiveSetSummary !== undefined) echoed.effectiveSetSummary = c.effectiveSetSummary;
    if (c.loadFeedback !== undefined) echoed.loadFeedback = c.loadFeedback;
    if (c.techniqueQualitySummary !== undefined) echoed.techniqueQualitySummary = c.techniqueQualitySummary;
    if (c.painPatterns !== undefined) echoed.painPatterns = c.painPatterns;
    if (c.trainingLevel !== undefined) echoed.trainingLevel = c.trainingLevel;
    if (c.recentEdits !== undefined) echoed.recentEdits = c.recentEdits;
    echoed.result = result;
    return echoed;
  });
  return { sourceFixtureId: meta.id, cases };
};

// ---------------------------------------------------------------------------
// AN-5b — volumeAdaptationEngine OUTPUT parity. Each case threads ONLY the optional external
// summaries it provides (weeklyVolumeSummary / effectiveSetSummary / adherenceReport /
// painPatterns / loadFeedback / sessionQualityResults / trainingLevel — all opaque inputs the
// engine duck-types), runs the REAL buildVolumeAdaptationReport, and echoes BOTH the engineInput
// and the computed report. PURE / clockless (the engine consumes no history and reads no clock).
// Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

const generateVolumeAdaptation = (input: any, meta: ParityMeta) => {
  const cases = (Array.isArray(input.cases) ? input.cases : []).map((c: any) => {
    const params: Parameters<typeof buildVolumeAdaptationReport>[0] = {};
    if (c.weeklyVolumeSummary !== undefined) params.weeklyVolumeSummary = c.weeklyVolumeSummary;
    if (c.effectiveSetSummary !== undefined) params.effectiveSetSummary = c.effectiveSetSummary;
    if (c.adherenceReport !== undefined) params.adherenceReport = c.adherenceReport;
    if (c.painPatterns !== undefined) params.painPatterns = c.painPatterns;
    if (c.loadFeedback !== undefined) params.loadFeedback = c.loadFeedback;
    if (c.sessionQualityResults !== undefined) params.sessionQualityResults = c.sessionQualityResults;
    if (c.trainingLevel !== undefined) params.trainingLevel = c.trainingLevel;
    const report = buildVolumeAdaptationReport(params);
    const echoed: Record<string, unknown> = { label: c.label ?? null };
    if (c.weeklyVolumeSummary !== undefined) echoed.weeklyVolumeSummary = c.weeklyVolumeSummary;
    if (c.effectiveSetSummary !== undefined) echoed.effectiveSetSummary = c.effectiveSetSummary;
    if (c.adherenceReport !== undefined) echoed.adherenceReport = c.adherenceReport;
    if (c.painPatterns !== undefined) echoed.painPatterns = c.painPatterns;
    if (c.loadFeedback !== undefined) echoed.loadFeedback = c.loadFeedback;
    if (c.sessionQualityResults !== undefined) echoed.sessionQualityResults = c.sessionQualityResults;
    if (c.trainingLevel !== undefined) echoed.trainingLevel = c.trainingLevel;
    echoed.report = report;
    return echoed;
  });
  return { sourceFixtureId: meta.id, cases };
};

// ---------------------------------------------------------------------------
// AN-6 — trainingIntelligenceSummaryEngine TOP-LEVEL OUTPUT parity. Each case materialises an
// OPTIONAL latest session + a synthetic history (via the shared materializeAnalyticsSession —
// ONLY date fields derive from the deterministic clock; every other field passes through
// verbatim), threads ONLY the optional external inputs the case provides (weeklyVolumeSummary /
// e1rmProfiles / effectiveSetSummary / loadFeedback / painPatterns / trainingLevel — all opaque
// inputs the engine + its leaves duck-type; so canonicalStringify drops absent ones and the
// Swift port reads each optionally), runs the REAL buildTrainingIntelligenceSummary, and echoes
// BOTH the engineInput and the full computed summary. PURE / clockless apart from the history
// dates. Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

const generateIntelligenceSummary = (input: any, meta: ParityMeta) => {
  if (!meta.deterministicClockIso) {
    throw new Error('parityGoldensEntry: intelligence-summary requires deterministicClockIso');
  }
  const nowIso = meta.deterministicClockIso;
  const cases = (Array.isArray(input.cases) ? input.cases : []).map((c: any) => {
    const latestSession = c.latestSession !== undefined ? materializeAnalyticsSession(c.latestSession, nowIso) : undefined;
    const history = (c.history ?? []).map((s: any) => materializeAnalyticsSession(s, nowIso));
    const params: Parameters<typeof buildTrainingIntelligenceSummary>[0] = { history };
    if (latestSession !== undefined) params.latestSession = latestSession;
    if (c.weeklyVolumeSummary !== undefined) params.weeklyVolumeSummary = c.weeklyVolumeSummary;
    if (c.e1rmProfiles !== undefined) params.e1rmProfiles = c.e1rmProfiles;
    if (c.effectiveSetSummary !== undefined) params.effectiveSetSummary = c.effectiveSetSummary;
    if (c.loadFeedback !== undefined) params.loadFeedback = c.loadFeedback;
    if (c.painPatterns !== undefined) params.painPatterns = c.painPatterns;
    if (c.trainingLevel !== undefined) params.trainingLevel = c.trainingLevel;
    const summary = buildTrainingIntelligenceSummary(params);
    const echoed: Record<string, unknown> = { label: c.label ?? null };
    if (latestSession !== undefined) echoed.latestSession = latestSession;
    echoed.history = history;
    if (c.weeklyVolumeSummary !== undefined) echoed.weeklyVolumeSummary = c.weeklyVolumeSummary;
    if (c.e1rmProfiles !== undefined) echoed.e1rmProfiles = c.e1rmProfiles;
    if (c.effectiveSetSummary !== undefined) echoed.effectiveSetSummary = c.effectiveSetSummary;
    if (c.loadFeedback !== undefined) echoed.loadFeedback = c.loadFeedback;
    if (c.painPatterns !== undefined) echoed.painPatterns = c.painPatterns;
    if (c.trainingLevel !== undefined) echoed.trainingLevel = c.trainingLevel;
    echoed.summary = summary;
    return echoed;
  });
  return { sourceFixtureId: meta.id, cases };
};

// ---------------------------------------------------------------------------
// PA-S0 — i18n/terms snapshot
//
// Dumps the eleven frozen label tables from src/i18n/terms.ts verbatim (keyed by
// their TS export name) + per-table counts + every TERMS key routed through
// term() (so the ported term(key) === TERMS[key] equivalence is pinned). The
// Swift IronPathL10n.Terms tables reconcile every entry item-by-item. This
// transcribes frozen DATA — it COMPUTES nothing (no clock, no engine).
// ---------------------------------------------------------------------------

const generateI18nTermsSnapshot = (_input: any, _meta: ParityMeta) => {
  const tables = {
    TERMS,
    PHASE_LABELS,
    EFFECTIVE_PHASE_DISPLAY_LABELS,
    INTENSITY_BIAS_LABELS,
    TECHNIQUE_QUALITY_LABELS,
    SUPPORT_BLOCK_LABELS,
    SKIP_REASON_LABELS,
    DELOAD_LEVEL_LABELS,
    DELOAD_STRATEGY_LABELS,
    READINESS_ADJUSTMENT_LABELS,
    MUSCLE_LABELS,
  };
  const counts: Record<string, number> = { tables: Object.keys(tables).length };
  for (const [name, table] of Object.entries(tables)) {
    counts[name] = Object.keys(table).length;
  }
  // term() probes — every TERMS key routed through term() (terms.ts:103). Each
  // value === TERMS[key], so this pins the ported lookup over the full key set.
  const termProbes: Record<string, string> = {};
  for (const key of Object.keys(TERMS)) {
    termProbes[key] = term(key as keyof typeof TERMS);
  }
  return { counts, tables, termProbes };
};

// ---------------------------------------------------------------------------
// PA-S4 — i18n/formatters PA-subset snapshot
//
// Dumps the two private formatters.ts tables the Swift IronPathL10n.Formatters
// port mirrors (TEMPLATE_NAME_MAP / the inline formatAdjustmentChangeLabel
// record) + per-table counts + a branch-covering probe set. formatters.ts does
// NOT export those tables, so each table is reconstructed by routing its full
// key universe through the REAL formatter — every key normalizes to itself and
// hits the map directly, so the readback equals the raw table value (and a typo'd
// key would route to the fallback and be caught by the Swift reconciliation).
// The probes freeze input→output of the REAL formatters over every documented
// branch (map hit / normalize / camelCase / parens-strip / localize / already-CJK
// / residual-English-word fallback / object id+nameZh / no-hit fallback / empty /
// null / all 7 change labels + unknown). All outputs are deterministic, no clock →
// generatedAtPolicy 'none'. Only the 3 engine-consumed formatters are exercised;
// formatExerciseName/formatMuscleName reuse the IronPathTrainingDecision ports,
// and riskLevel/reviewStatus are not used by the PA engine — none re-ported here.
// ---------------------------------------------------------------------------

const generateI18nFormattersPaSnapshot = (_input: any, _meta: ParityMeta) => {
  // (a) Reconstruct the two private formatters.ts tables from TS truth. The key
  // universe is transcribed from formatters.ts:62-83 (TEMPLATE_NAME_MAP) and
  // :498-506 (the inline change-label record); each value is read back through
  // the REAL formatter so the golden is GENERATED, never hand-authored (§22).
  const templateNameKeys = [
    'push-a', 'pusha', 'push',
    'pull-a', 'pulla', 'pull',
    'legs-a', 'legsa', 'legs',
    'upper-a', 'uppera', 'upper',
    'lower-a', 'lowera', 'lower',
    'full-body', 'fullbody',
    'arms', 'quick-30', 'crowded-gym',
  ];
  const templateNameMap: Record<string, string> = {};
  for (const key of templateNameKeys) {
    templateNameMap[key] = formatProgramTemplateName(key);
  }
  const adjustmentChangeKeys = [
    'add_sets', 'remove_sets', 'add_new_exercise', 'swap_exercise',
    'reduce_support', 'increase_support', 'keep',
  ];
  const adjustmentChangeLabels: Record<string, string> = {};
  for (const key of adjustmentChangeKeys) {
    adjustmentChangeLabels[key] = formatAdjustmentChangeLabel(key);
  }

  const tables = { templateNameMap, adjustmentChangeLabels };
  const counts = {
    tables: Object.keys(tables).length,
    templateNameMap: Object.keys(templateNameMap).length,
    adjustmentChangeLabels: Object.keys(adjustmentChangeLabels).length,
  };

  // (b) Branch-covering probes — input echoed verbatim + the REAL formatter's
  // output. Inputs are kept space/dash-delimited so the ported NSRegularExpression
  // \b boundaries match JS \b exactly (JS \b is ASCII-word-only; ICU \w includes
  // CJK, so an English template word glued directly to a CJK char would diverge —
  // none of these inputs do that, matching the engine's real id/name shapes).
  const probe = (fn: (v: any) => string, input: unknown) => ({ input, expected: fn(input) });
  const probes = {
    formatProgramTemplateName: [
      probe(formatProgramTemplateName, 'push-a'),                            // id-style string → map hit
      probe(formatProgramTemplateName, 'Push A'),                            // normalize (space→dash) → map hit
      probe(formatProgramTemplateName, 'pushA'),                             // camelCase split → map hit
      probe(formatProgramTemplateName, 'Push(高级)'),                        // parens stripped → 'push' map hit
      probe(formatProgramTemplateName, 'Pull A 计划'),                       // localize → '拉 A …'
      probe(formatProgramTemplateName, '胸部专项'),                          // already CJK → returned as-is
      probe(formatProgramTemplateName, 'Push 强化'),                         // CJK but residual English word → fallback
      probe(formatProgramTemplateName, { id: 'pull-a', name: 'whatever' }),  // object id → map hit
      probe(formatProgramTemplateName, { id: 'custom-xyz', nameZh: '自定义训练' }), // object nameZh CJK
      probe(formatProgramTemplateName, { id: 'custom-xyz' }),                // no candidate hits → fallback
      probe(formatProgramTemplateName, null),                                // null → fallback '未知模板'
      probe(formatProgramTemplateName, ''),                                  // '' → fallback '未知模板'
    ],
    formatDayTemplateName: [
      probe(formatDayTemplateName, 'legs-a'),                                // map hit → '腿 A'
      probe(formatDayTemplateName, '深蹲日'),                                // already CJK → as-is
      probe(formatDayTemplateName, 'Lower A'),                               // normalize → map hit '下肢 A'
      probe(formatDayTemplateName, { name: 'full-body' }),                   // object name → map hit '全身训练'
      probe(formatDayTemplateName, null),                                    // null → fallback '未指定训练日'
      probe(formatDayTemplateName, ''),                                      // '' → fallback '未指定训练日'
    ],
    formatAdjustmentChangeLabel: [
      probe(formatAdjustmentChangeLabel, 'add_sets'),
      probe(formatAdjustmentChangeLabel, 'remove_sets'),
      probe(formatAdjustmentChangeLabel, 'add_new_exercise'),
      probe(formatAdjustmentChangeLabel, 'swap_exercise'),
      probe(formatAdjustmentChangeLabel, 'reduce_support'),
      probe(formatAdjustmentChangeLabel, 'increase_support'),
      probe(formatAdjustmentChangeLabel, 'keep'),
      probe(formatAdjustmentChangeLabel, 'totally_unknown'),                 // unknown → '计划调整'
      probe(formatAdjustmentChangeLabel, ''),                                // '' → '计划调整'
      probe(formatAdjustmentChangeLabel, null),                              // null → '计划调整'
    ],
  };

  return { counts, tables, probes };
};

// ---------------------------------------------------------------------------
// PA-S3 — trainingData data-constant snapshot
//
// Dumps the six frozen data constants the PA-S3 Swift port mirrors:
// DEFAULT_PROGRAM_TEMPLATE (the rich projection over INITIAL_TEMPLATES) +
// INITIAL_TEMPLATES (with the REAL makeExercise output) + CORRECTION_MODULES +
// FUNCTIONAL_ADDONS + DEFAULT_SCREENING_PROFILE, plus per-constant counts. It
// transcribes frozen data + the REAL makeExercise transform — it COMPUTES no
// decision. No engine call, no clock → generatedAtPolicy 'none'.
// ---------------------------------------------------------------------------

const generateDefaultProgramData = (_input: any, _meta: ParityMeta) => {
  const correctionExerciseCount = CORRECTION_MODULES.reduce(
    (n, m) => n + m.exercises.length,
    0,
  );
  const functionalExerciseCount = FUNCTIONAL_ADDONS.reduce(
    (n, a) => n + a.exercises.length,
    0,
  );
  const totalTemplateExercises = INITIAL_TEMPLATES.reduce(
    (n, t) => n + t.exercises.length,
    0,
  );
  return {
    counts: {
      initialTemplates: INITIAL_TEMPLATES.length,
      totalTemplateExercises,
      dayTemplates: (DEFAULT_PROGRAM_TEMPLATE.dayTemplates ?? []).length,
      weeklyMuscleTargets: Object.keys(DEFAULT_PROGRAM_TEMPLATE.weeklyMuscleTargets ?? {}).length,
      correctionModules: CORRECTION_MODULES.length,
      functionalAddons: FUNCTIONAL_ADDONS.length,
      correctionExercises: correctionExerciseCount,
      functionalExercises: functionalExerciseCount,
    },
    defaultProgramTemplate: DEFAULT_PROGRAM_TEMPLATE,
    initialTemplates: INITIAL_TEMPLATES,
    correctionModules: CORRECTION_MODULES,
    functionalAddons: FUNCTIONAL_ADDONS,
    defaultScreeningProfile: DEFAULT_SCREENING_PROFILE,
  };
};

// ---------------------------------------------------------------------------
// PA-S5 — coachActionIdentityEngine fingerprint OUTPUT parity
//
// Each fixture carries a compact `cases` array; per case the generator dispatches on
// `kind` to the matching REAL pure function, echoes the engineInput VERBATIM (the
// objects the Swift port re-decodes + re-runs), and writes the REAL TS output:
//   kind 'fingerprint' → buildCoachActionFingerprint(action, context) → `fingerprint`
//   kind 'draft'       → buildProgramAdjustmentDraftFingerprint(draft) → `fingerprint`
//   kind 'history'     → buildProgramAdjustmentHistoryFingerprint(item) → `fingerprint`
//   kind 'dedupe'      → dedupeProgramAdjustmentDraftsByFingerprint(drafts) → `dedupedIds`
// The fingerprint is a deterministic FNV-1a string (EXACT `==` on the Swift side); the
// dedupe result is echoed as the ordered surviving-draft `id` list. PURE / clockless —
// the engine carries no Date, so the goldens are byte-deterministic regardless of
// generation time. Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

const generateCoachActionIdentity = (input: any, meta: ParityMeta) => {
  const cases = (Array.isArray(input.cases) ? input.cases : []).map((c: any) => {
    const kind = c.kind as string;
    if (kind === 'fingerprint') {
      const action = c.action ?? {};
      const context = (c.context ?? {}) as CoachActionFingerprintContext;
      const fingerprint = buildCoachActionFingerprint(action, context);
      return { label: c.label ?? null, kind, action, context: c.context ?? {}, fingerprint };
    }
    if (kind === 'draft') {
      const draft = c.draft as ProgramAdjustmentDraft;
      const fingerprint = buildProgramAdjustmentDraftFingerprint(draft);
      return { label: c.label ?? null, kind, draft: c.draft, fingerprint };
    }
    if (kind === 'history') {
      const item = c.item as ProgramAdjustmentHistoryItem;
      const fingerprint = buildProgramAdjustmentHistoryFingerprint(item);
      return { label: c.label ?? null, kind, item: c.item, fingerprint };
    }
    if (kind === 'dedupe') {
      const drafts = (Array.isArray(c.drafts) ? c.drafts : []) as ProgramAdjustmentDraft[];
      const deduped = dedupeProgramAdjustmentDraftsByFingerprint(drafts);
      const dedupedIds = deduped.map((d) => d.id);
      return { label: c.label ?? null, kind, drafts: c.drafts ?? [], dedupedIds };
    }
    throw new Error(`parityGoldensEntry: coach-action-identity unknown case kind '${String(kind)}'`);
  });
  return { sourceFixtureId: meta.id, cases };
};

// ---------------------------------------------------------------------------
// PA-S6 — planAdjustmentIdentityEngine OUTPUT parity
//
// Each fixture carries a compact `cases` array; per case the generator dispatches on
// `kind` to the matching REAL pure function, echoes the engineInput VERBATIM, and
// writes the REAL TS output:
//   kind 'input'        → buildPlanAdjustmentFingerprint(input)                     → `fingerprint`
//   kind 'coachAction'  → buildPlanAdjustmentFingerprintFromCoachAction(action,ctx) → `fingerprint`
//   kind 'draft'        → buildPlanAdjustmentFingerprintFromDraft(draft)            → `fingerprint`
//   kind 'history'      → buildPlanAdjustmentFingerprintFromHistory(item)           → `fingerprint`
//   kind 'change'       → buildPlanAdjustmentFingerprintFromChange(change,input)    → `fingerprint`
//   kind 'dedupe'       → dedupePlanAdjustmentDraftsByFingerprint(drafts)           → `dedupedIds`
//   kind 'instanceId'   → buildPlanAdjustmentDraftInstanceId(fp,revision,parent)    → `instanceId`
//   kind 'upsert'       → upsertPlanAdjustmentDraftByFingerprint(...)               → `result` (+createdDraft)
//   kind 'findReusable' → findReusablePlanAdjustmentDraft(sourceDraft,drafts)       → `foundId`
//   kind 'regenerate'   → buildRegeneratedPlanAdjustmentDraft(sourceDraft,drafts,{now,draftId})
//                                                                                   → `sourceFingerprint`/`existingDraftId`/`draft`
// Fingerprints + instanceIds are deterministic strings (EXACT `==`); upsert/regenerate
// drafts are echoed in full for canonical-equality on the Swift side. The injected
// `now` (regenerate) is the ONLY time input — taken from the case (else
// meta.deterministicClockIso); NO wall clock is read, so the goldens stay
// byte-deterministic. Generated, never hand-edited (§22).
// ---------------------------------------------------------------------------

const generatePlanAdjustmentIdentity = (input: any, meta: ParityMeta) => {
  const cases = (Array.isArray(input.cases) ? input.cases : []).map((c: any) => {
    const kind = c.kind as string;
    const label = c.label ?? null;
    if (kind === 'input') {
      const fingerprint = buildPlanAdjustmentFingerprint(c.input ?? {});
      return { label, kind, input: c.input ?? {}, fingerprint };
    }
    if (kind === 'coachAction') {
      const fingerprint = buildPlanAdjustmentFingerprintFromCoachAction(c.action ?? {}, c.context ?? {});
      return { label, kind, action: c.action ?? {}, context: c.context ?? {}, fingerprint };
    }
    if (kind === 'draft') {
      const fingerprint = buildPlanAdjustmentFingerprintFromDraft(c.draft as ProgramAdjustmentDraft);
      return { label, kind, draft: c.draft, fingerprint };
    }
    if (kind === 'history') {
      const fingerprint = buildPlanAdjustmentFingerprintFromHistory(c.item as ProgramAdjustmentHistoryItem);
      return { label, kind, item: c.item, fingerprint };
    }
    if (kind === 'change') {
      const fingerprint = buildPlanAdjustmentFingerprintFromChange(c.change as AdjustmentChange, c.input ?? {});
      return { label, kind, change: c.change, input: c.input ?? {}, fingerprint };
    }
    if (kind === 'dedupe') {
      const drafts = (Array.isArray(c.drafts) ? c.drafts : []) as ProgramAdjustmentDraft[];
      const deduped = dedupePlanAdjustmentDraftsByFingerprint(drafts);
      return { label, kind, drafts: c.drafts ?? [], dedupedIds: deduped.map((d) => d.id ?? null) };
    }
    if (kind === 'instanceId') {
      const instanceId = buildPlanAdjustmentDraftInstanceId(c.sourceFingerprint, c.revision, c.parentDraftId);
      return {
        label, kind,
        sourceFingerprint: c.sourceFingerprint,
        revision: c.revision ?? null,
        parentDraftId: c.parentDraftId ?? null,
        instanceId,
      };
    }
    if (kind === 'upsert') {
      const result = upsertPlanAdjustmentDraftByFingerprint(
        (c.drafts ?? []) as ProgramAdjustmentDraft[],
        (c.adjustmentHistory ?? []) as ProgramAdjustmentHistoryItem[],
        c.candidateDraft as ProgramAdjustmentDraft,
        c.sourceFingerprint,
      );
      return {
        label, kind,
        drafts: c.drafts ?? [],
        adjustmentHistory: c.adjustmentHistory ?? [],
        candidateDraft: c.candidateDraft,
        sourceFingerprint: c.sourceFingerprint ?? null,
        result: {
          outcome: result.outcome,
          sourceFingerprint: result.sourceFingerprint,
          draftIds: result.drafts.map((d) => d.id ?? null),
          targetDraftId: result.targetDraft?.id ?? null,
          historyItemId: result.historyItem?.id ?? null,
          createdDraftId: result.createdDraft?.id ?? null,
        },
        createdDraft: result.createdDraft ?? null,
      };
    }
    if (kind === 'findReusable') {
      const found = findReusablePlanAdjustmentDraft(
        c.sourceDraft as ProgramAdjustmentDraft,
        (c.drafts ?? []) as ProgramAdjustmentDraft[],
      );
      return { label, kind, sourceDraft: c.sourceDraft, drafts: c.drafts ?? [], foundId: found?.id ?? null };
    }
    if (kind === 'regenerate') {
      const now = c.now ?? meta.deterministicClockIso;
      const result = buildRegeneratedPlanAdjustmentDraft(
        c.sourceDraft as ProgramAdjustmentDraft,
        (c.drafts ?? []) as ProgramAdjustmentDraft[],
        { now, draftId: c.draftId },
      );
      return {
        label, kind,
        sourceDraft: c.sourceDraft,
        drafts: c.drafts ?? [],
        now: now ?? null,
        draftId: c.draftId ?? null,
        sourceFingerprint: result.sourceFingerprint,
        existingDraftId: result.existingDraft?.id ?? null,
        draft: result.draft ?? null,
      };
    }
    throw new Error(`parityGoldensEntry: plan-adjustment-identity unknown case kind '${String(kind)}'`);
  });
  return { sourceFixtureId: meta.id, cases };
};

const GENERATORS: Record<FixtureId, (input: any, meta: ParityMeta) => unknown | Promise<unknown>> = {
  'app-data/snapshot-hash-stable-v1': generateSnapshotHash,
  'training-decision/normal-session-v1': generateTrainingDecision,
  'data-repair/session-lifecycle-residue-v1': generateDataRepair,
  'real-export/redacted-2026-05-27': generateRealExport,
  'focus-mode/golden-path-session-v1': generateFocusMode,
  'training-decision/severe-rest-v1': generateTrainingDecisionExpanded,
  'training-decision/controlled-reload-v1': generateTrainingDecisionExpanded,
  'training-decision/deload-week-v1': generateTrainingDecisionExpanded,
  'training-decision/stale-today-status-v1': generateTrainingDecisionExpanded,
  'training-decision/stale-health-data-v1': generateTrainingDecisionExpanded,
  'training-decision/restart-28d-gap-v1': generateTrainingDecisionExpanded,
  'training-decision/productive-floor-v1': generateTrainingDecisionExpanded,
  'training-decision/no-legacy-advice-v1': generateTrainingDecisionExpanded,
  'training-decision/clean-input-contract-v1': generateTrainingDecisionExpanded,
  // iOS-17e-0 progression parity scaffold — reuse the expanded projection so the
  // history-driven progressionMode / weeklyAdjustment land in the golden.
  'training-decision/progressive-overload-v1': generateTrainingDecisionExpanded,
  'training-decision/plateau-stall-v1': generateTrainingDecisionExpanded,
  'training-decision/insufficient-history-v1': generateTrainingDecisionExpanded,
  'smart-replacement/explicit-priority-spread-v1': generateSmartReplacement,
  'smart-replacement/bench-press-natural-v1': generateSmartReplacement,
  'smart-replacement/low-readiness-fatigue-v1': generateSmartReplacement,
  'smart-replacement/pain-history-substitute-v1': generateSmartReplacement,
  'exercise-library/library-snapshot-v1': generateExerciseLibrarySnapshot,
  'replacement-engine/knowledge-snapshot-v1': generateReplacementEngineKnowledge,
  'replacement-engine/bench-press-explicit-v1': generateReplacementEngine,
  'replacement-engine/lat-pulldown-equipment-v1': generateReplacementEngine,
  'replacement-engine/hack-squat-chain-v1': generateReplacementEngine,
  'replacement-engine/validation-synthetic-v1': generateReplacementEngine,
  'e1rm-engine/progressive-overload-v1': generateE1RMEngine,
  'e1rm-engine/plateau-stall-v1': generateE1RMEngine,
  'e1rm-engine/insufficient-history-v1': generateE1RMEngine,
  'e1rm-engine/low-quality-filtered-v1': generateE1RMEngine,
  'e1rm-engine/pool-confidence-probes-v1': generateE1RMEngine,
  'adaptive-feedback/performance-drop-v1': generateAdaptiveFeedback,
  'adaptive-feedback/pain-accumulation-v1': generateAdaptiveFeedback,
  'adaptive-feedback/improving-and-seed-v1': generateAdaptiveFeedback,
  'adaptive-feedback/lookup-edge-v1': generateAdaptiveFeedback,
  'progression-suggestion/no-history-baseline-v1': generateProgression,
  'progression-suggestion/increase-double-top-v1': generateProgression,
  'progression-suggestion/hold-stable-v1': generateProgression,
  'progression-suggestion/backoff-volume-drop-v1': generateProgression,
  'progression-suggestion/backoff-technique-streak-v1': generateProgression,
  'progression-suggestion/top-backoff-compound-v1': generateProgression,
  'progression-suggestion/fine-tune-uptrend-applied-v1': generateProgression,
  'progression-suggestion/fine-tune-legacy-respect-v1': generateProgression,
  'set-weight-fine-tune/upward-trend-v1': generateSetWeightFineTune,
  'set-weight-fine-tune/downward-capped-v1': generateSetWeightFineTune,
  'set-weight-fine-tune/noisy-trend-v1': generateSetWeightFineTune,
  'set-weight-fine-tune/insufficient-history-v1': generateSetWeightFineTune,
  'load-feedback/collect-summary-v1': generateLoadFeedback,
  'load-feedback/adjustment-branches-v1': generateLoadFeedback,
  'load-feedback/upsert-v1': generateLoadFeedback,
  'training-streak/streak-cases-v1': generateTrainingStreak,
  'recent-pr-delta/delta-cases-v1': generateRecentPRDelta,
  'weekly-muscle-balance/balance-cases-v1': generateWeeklyMuscleBalance,
  // AN-1b boundary fixtures — reuse the SAME three generators (no new generator logic).
  'training-streak/streak-boundary-cases-v1': generateTrainingStreak,
  'recent-pr-delta/delta-boundary-cases-v1': generateRecentPRDelta,
  'weekly-muscle-balance/balance-boundary-cases-v1': generateWeeklyMuscleBalance,
  // AN-2 plateau-detection fixtures — both routed through the single plateau generator.
  'plateau-detection/plateau-status-cases-v1': generatePlateauDetection,
  'plateau-detection/plateau-boundary-cases-v1': generatePlateauDetection,
  // AN-3 effectiveSet + analytics dashboard fixtures.
  'effective-set/evaluate-cases-v1': generateEffectiveSetEvaluate,
  'effective-set/volume-summary-cases-v1': generateEffectiveSetVolume,
  'analytics/muscle-volume-dashboard-cases-v1': generateMuscleVolumeDashboard,
  'analytics/exercise-trend-cases-v1': generateExerciseTrend,
  'analytics/prs-cases-v1': generatePrs,
  'analytics/weekly-report-cases-v1': generateWeeklyReport,
  'analytics/adherence-report-cases-v1': generateAdherenceReport,
  // AN-8 sort-stability tie fixture — routed through the SAME adherence generator; its
  // single case is a PURE skippedExercises count tie that pins the JS-stable insertion
  // order through the slice(0,5) cut (load-bearing for the Swift stableSorted port).
  'analytics/adherence-report-tie-cases-v1': generateAdherenceReport,
  // AN-4 sessionDetailSummary + sessionQuality fixtures — both routed through the single generator.
  'session-quality/quality-cases-v1': generateSessionQuality,
  'session-quality/grouping-and-input-cases-v1': generateSessionQuality,
  // AN-5 painPattern + trainingLevel fixtures.
  'pain-pattern/aggregation-cases-v1': generatePainPattern,
  'training-level/assessment-cases-v1': generateTrainingLevel,
  // AN-5b recommendationConfidence + volumeAdaptation fixtures.
  'recommendation-confidence/assessment-cases-v1': generateRecommendationConfidence,
  'volume-adaptation/report-cases-v1': generateVolumeAdaptation,
  // AN-6 trainingIntelligenceSummary top-level fixture.
  'intelligence-summary/summary-cases-v1': generateIntelligenceSummary,
  // PA-S0 i18n/terms data port snapshot.
  'i18n/terms-snapshot-v1': generateI18nTermsSnapshot,
  // PA-S2 engineUtils enrichExercise/buildExerciseMetadata port (empty-seam default branches).
  'enrich-exercise/default-branches-v1': generateEnrichExercise,
  // PA-S3 trainingData data-constant snapshot (default program/templates/support-modules/screening).
  'default-program-data/snapshot-v1': generateDefaultProgramData,
  // PA-S4 i18n/formatters PA-subset snapshot (template-name + change-label formatters).
  'i18n/formatters-pa-snapshot-v1': generateI18nFormattersPaSnapshot,
  // PA-S5 coachActionIdentityEngine fingerprint fixtures — all three routed through the
  // single dispatch-by-kind generator (fingerprint / draft+history / dedupe).
  'coach-action-identity/fingerprint-cases-v1': generateCoachActionIdentity,
  'coach-action-identity/draft-history-fingerprint-cases-v1': generateCoachActionIdentity,
  'coach-action-identity/dedupe-cases-v1': generateCoachActionIdentity,
  // PA-S6 planAdjustmentIdentityEngine fixtures — all four routed through the single
  // dispatch-by-kind generator (input/coachAction/draft/history/change/dedupe/instanceId/
  // upsert/findReusable/regenerate).
  'plan-adjustment-identity/fingerprint-cases-v1': generatePlanAdjustmentIdentity,
  'plan-adjustment-identity/instance-id-cases-v1': generatePlanAdjustmentIdentity,
  'plan-adjustment-identity/upsert-cases-v1': generatePlanAdjustmentIdentity,
  'plan-adjustment-identity/regenerate-cases-v1': generatePlanAdjustmentIdentity,
};
void TRAINING_DECISION_EXPANDED_IDS;

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

type GeneratorMode = 'write' | 'check' | 'list';

// The "source commit" stamped into every golden is read from the
// fixture's own parityMeta.tsCommit — NOT from `git rev-parse HEAD` at
// runtime. Runtime git would make the goldens differ between the local
// developer's checkout and CI (where HEAD is the PR commit), which is
// exactly the kind of non-determinism this whole iOS-0 task exists to
// eliminate. Bumping the source commit is an explicit fixture edit,
// not a side effect of `node scripts/generate-parity-goldens.mjs`.

const runFixture = async (
  id: FixtureId,
  mode: GeneratorMode,
): Promise<{ id: FixtureId; changed: boolean }> => {
  const inputPath = resolve(INPUT_ROOT, `${id}.json`);
  const goldenPath = resolve(GOLDEN_ROOT, `${id}.json`);
  const inputRaw = readJson(inputPath);
  const meta = validateParityMeta(id, inputRaw);
  // Privacy guard runs on the input fixture's text — not on the
  // dereferenced redacted real export.
  runPrivacyGuard(`${id} (input)`, readFileSync(inputPath, 'utf8'));
  const payload = await GENERATORS[id](inputRaw, meta);
  const goldenObject = {
    parityGolden: {
      sourceFixtureId: id,
      generatedFromCommit: meta.tsCommit,
      generatedAtPolicy: meta.generatedAtPolicy,
      deterministicClockIso: meta.deterministicClockIso ?? null,
      generatorVersion: GENERATOR_VERSION,
    },
    ...(payload as Record<string, unknown>),
  };
  const goldenText = canonicalStringify(goldenObject);
  // Privacy guard re-runs on the golden text.
  runPrivacyGuard(`${id} (golden)`, goldenText);
  const result = writeIfChanged(goldenPath, goldenText, mode);
  return { id, changed: result.changed };
};

const parseArgs = (argv: string[]): GeneratorMode => {
  if (argv.includes('--list')) return 'list';
  if (argv.includes('--check')) return 'check';
  return 'write';
};

const main = async (argv: string[]): Promise<number> => {
  const mode = parseArgs(argv);
  if (mode === 'list') {
    for (const id of FIXTURE_IDS) {
      // eslint-disable-next-line no-console
      console.log(id);
    }
    return 0;
  }
  const summary: Array<{ id: FixtureId; changed: boolean }> = [];
  for (const id of FIXTURE_IDS) {
    summary.push(await runFixture(id, mode));
  }
  const changedCount = summary.filter((s) => s.changed).length;
  // eslint-disable-next-line no-console
  console.log(
    `${mode === 'check' ? 'checked' : 'generated'} ${summary.length} fixture(s); ${changedCount} changed`,
  );
  for (const s of summary) {
    // eslint-disable-next-line no-console
    console.log(`  ${s.changed ? '*' : ' '} ${s.id}`);
  }
  if (mode === 'check' && changedCount > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `parityGoldensEntry: --check failed; ${changedCount} fixture(s) drifted. ` +
        `Run \`node scripts/generate-parity-goldens.mjs\` and commit the diff.`,
    );
    return 1;
  }
  return 0;
};

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });

// readdirSync is unused at runtime but kept imported so future fixture
// discovery diff stays minimal; reference it once to satisfy strict TS.
void readdirSync;
