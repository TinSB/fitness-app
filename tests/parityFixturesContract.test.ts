import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { STORAGE_VERSION } from '../src/data/appConfig';

// ---------------------------------------------------------------------------
// iOS-0 Contract Fixture Export V1 — parity-fixtures contract lock.
//
// This file enforces:
//   - the canonical directory layout under tests/fixtures/parity/
//   - the parityMeta envelope on every input fixture
//   - the parityGolden envelope on every golden output
//   - the 5 required fixture ids exist on both sides
//   - the per-category required fields (decisionVersion=v2, arbitrationTrace,
//     receipt+ledger, snapshotHash prefix, deterministic step ids)
//   - the source commit policy (40-char hex on parityMeta.tsCommit)
//
// It does NOT re-run the generator (the consistency tests do that). It only
// reads the on-disk fixtures so the suite stays fast (< 100 ms).
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

const PARITY_ROOT = resolve(repoRoot, 'tests/fixtures/parity');
const INPUTS_ROOT = resolve(PARITY_ROOT, 'inputs');
const GOLDEN_ROOT = resolve(PARITY_ROOT, 'golden');

const FIXTURE_IDS = [
  'app-data/snapshot-hash-stable-v1',
  'training-decision/normal-session-v1',
  'data-repair/session-lifecycle-residue-v1',
  'real-export/redacted-2026-05-27',
  'focus-mode/golden-path-session-v1',
  // iOS-4B0 TrainingDecision parity fixture expansion — 9 synthetic fixtures,
  // each driving a distinct engine path through the Clean Input Contract.
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
  // carries performed sets so the real engine emits its history-driven adaptive
  // output (progressionMode / weeklyAdjustment). Swift decode-only-pins these;
  // compute-assert lands as 17e-1~5 port the progression cluster. Generated;
  // never hand-edited (§22).
  'training-decision/progressive-overload-v1',
  'training-decision/plateau-stall-v1',
  'training-decision/insufficient-history-v1',
  // SR-0 smart-replacement parity scaffold — 4 synthetic fixtures whose
  // generated goldens collectively cover all four SmartReplacementPriority
  // values. Parity pipeline only; the engine port is SR-1+.
  'smart-replacement/explicit-priority-spread-v1',
  'smart-replacement/bench-press-natural-v1',
  'smart-replacement/low-readiness-fatigue-v1',
  'smart-replacement/pain-history-substitute-v1',
  // SR-1 exercise-library data port — 1 snapshot fixture dumping the four frozen
  // library tables + the EXERCISE_KNOWLEDGE_OVERRIDES key set for the Swift port
  // to reconcile item-by-item. Generated; never hand-edited (§22).
  'exercise-library/library-snapshot-v1',
  // SR-2 replacement-engine port — 1 knowledge snapshot (the engine-used
  // equivalence-chain + override subset, reconciled item-by-item) + 4 OUTPUT
  // fixtures pinning buildReplacementOptions / validateReplacementExerciseId /
  // isSyntheticReplacementExerciseId. Generated; never hand-edited (§22).
  'replacement-engine/knowledge-snapshot-v1',
  'replacement-engine/bench-press-explicit-v1',
  'replacement-engine/lat-pulldown-equipment-v1',
  'replacement-engine/hack-squat-chain-v1',
  'replacement-engine/validation-synthetic-v1',
  // iOS-17e-1 per-exercise e1RM port — 5 OUTPUT fixtures FUNCTION-LEVEL pinning the
  // ported e1rmEngine (buildE1RMProfile / estimateOneRepMaxForExercise per-exercise
  // estimate + getExerciseRecordPoolId + getE1RMConfidence probes). Generated; never
  // hand-edited (§22).
  'e1rm-engine/progressive-overload-v1',
  'e1rm-engine/plateau-stall-v1',
  'e1rm-engine/insufficient-history-v1',
  'e1rm-engine/low-quality-filtered-v1',
  'e1rm-engine/pool-confidence-probes-v1',
  // iOS-17e-2 adaptiveFeedbackEngine performance-lookup port — 4 OUTPUT fixtures
  // FUNCTION-LEVEL pinning the ported performance-lookup engine (findLastPerformance /
  // findPreviousPerformance / findRecentPerformances snapshots + buildAdaptiveState).
  // Generated; never hand-edited (§22).
  'adaptive-feedback/performance-drop-v1',
  'adaptive-feedback/pain-accumulation-v1',
  'adaptive-feedback/improving-and-seed-v1',
  'adaptive-feedback/lookup-edge-v1',
  // iOS-17e-3 progressionRulesEngine progressive-suggestion port — 6 OUTPUT fixtures
  // FUNCTION-LEVEL pinning the ported progressionRulesEngine (makeSuggestion +
  // shouldUseTopBackoff + buildSetPrescription) over an explicit templateExercise +
  // history, plus a fineTuneNeutrality guard. Generated; never hand-edited (§22).
  'progression-suggestion/no-history-baseline-v1',
  'progression-suggestion/increase-double-top-v1',
  'progression-suggestion/hold-stable-v1',
  'progression-suggestion/backoff-volume-drop-v1',
  'progression-suggestion/backoff-technique-streak-v1',
  'progression-suggestion/top-backoff-compound-v1',
  // iOS-17e-6a fineTune LIVE — 2 function-level fixtures pass an injected asOfDate over
  // recent in-window history so the ported SetWeightFineTuneEngine projection FIRES.
  'progression-suggestion/fine-tune-uptrend-applied-v1',
  'progression-suggestion/fine-tune-legacy-respect-v1',
  // iOS-17e-4 setWeightFineTuneEngine port — 4 OUTPUT fixtures FUNCTION-LEVEL pinning
  // the ported buildSetWeightFineTune (suggestedWeightKg + basis) over scalar params +
  // history, with param-only probes. Generated; never hand-edited (§22).
  'set-weight-fine-tune/upward-trend-v1',
  'set-weight-fine-tune/downward-capped-v1',
  'set-weight-fine-tune/noisy-trend-v1',
  'set-weight-fine-tune/insufficient-history-v1',
  // iOS-17e-4 loadFeedbackEngine port — 3 OUTPUT fixtures FUNCTION-LEVEL pinning the
  // ported collectLoadFeedback / buildLoadFeedbackSummary / getLoadFeedbackAdjustment /
  // upsertLoadFeedback. Generated; never hand-edited (§22).
  'load-feedback/collect-summary-v1',
  'load-feedback/adjustment-branches-v1',
  'load-feedback/upsert-v1',
  // AN-1 leaf-analytics engines port — 3 OUTPUT fixtures (one per metric, each a `cases`
  // array) FUNCTION-LEVEL pinning the ported computeTrainingStreak / computeRecentPRDeltas /
  // computeWeeklyMuscleBalance over echoed history + options. Generated; never hand-edited (§22).
  'training-streak/streak-cases-v1',
  'recent-pr-delta/delta-cases-v1',
  'weekly-muscle-balance/balance-cases-v1',
  // AN-1b boundary/coverage-debt fixtures — additive NEW fixtures (one per metric) pinning
  // the AN-1 audit's untested branches + the roundToFixed `.XX5` ties. Generated; never
  // hand-edited (§22).
  'training-streak/streak-boundary-cases-v1',
  'recent-pr-delta/delta-boundary-cases-v1',
  'weekly-muscle-balance/balance-boundary-cases-v1',
  // AN-2 plateauDetectionEngine port — 2 OUTPUT fixtures (each a `cases` array) FUNCTION-
  // LEVEL pinning detectExercisePlateau across all eight PlateauStatus values + the
  // branch/boundary debt. Generated; never hand-edited (§22).
  'plateau-detection/plateau-status-cases-v1',
  'plateau-detection/plateau-boundary-cases-v1',
  // AN-3 effectiveSetEngine (analytics-consumed subset) + analytics.ts dashboard port — 7
  // OUTPUT fixtures (each a `cases` array) FUNCTION-LEVEL pinning evaluateEffectiveSet /
  // buildEffectiveVolumeSummary (+ countEffectiveSets / getMuscleContribution) and the
  // analytics dashboard exports (buildMuscleVolumeDashboard / buildExerciseTrend / trendStatus /
  // buildPrs / buildWeeklyReport / buildAdherenceReport / CORE_TREND_EXERCISES). Generated;
  // never hand-edited (§22).
  'effective-set/evaluate-cases-v1',
  'effective-set/volume-summary-cases-v1',
  'analytics/muscle-volume-dashboard-cases-v1',
  'analytics/exercise-trend-cases-v1',
  'analytics/prs-cases-v1',
  'analytics/weekly-report-cases-v1',
  'analytics/adherence-report-cases-v1',
  // AN-4 sessionDetailSummary (sessionQuality-consumed subset) + sessionQualityEngine fixtures.
  'session-quality/quality-cases-v1',
  'session-quality/grouping-and-input-cases-v1',
  // AN-5 painPattern (trainingLevel-consumed subset) + trainingLevel fixtures.
  'pain-pattern/aggregation-cases-v1',
  'training-level/assessment-cases-v1',
  // AN-5b recommendationConfidence + volumeAdaptation fixtures.
  'recommendation-confidence/assessment-cases-v1',
  'volume-adaptation/report-cases-v1',
  // AN-6 trainingIntelligenceSummary top-level fixture (closes the analysis engine layer).
  'intelligence-summary/summary-cases-v1',
] as const;

type FixtureId = (typeof FIXTURE_IDS)[number];

const readInput = (id: FixtureId): Record<string, unknown> =>
  JSON.parse(readFileSync(resolve(INPUTS_ROOT, `${id}.json`), 'utf8'));

const readGolden = (id: FixtureId): Record<string, unknown> =>
  JSON.parse(readFileSync(resolve(GOLDEN_ROOT, `${id}.json`), 'utf8'));

describe('parityFixtures — canonical directory layout', () => {
  it('parityFixtures top-level layout is present', () => {
    expect(existsSync(PARITY_ROOT)).toBe(true);
    expect(existsSync(INPUTS_ROOT)).toBe(true);
    expect(existsSync(GOLDEN_ROOT)).toBe(true);
    expect(existsSync(resolve(PARITY_ROOT, 'README.md'))).toBe(true);
  });

  it('parityFixtures canonical path is tests/fixtures/parity (Entry Gate H1)', () => {
    // Resolution of cross-review H1 — the alternate path proposed under
    // tests/fixtures/ios-contract/ must not exist.
    expect(existsSync(resolve(repoRoot, 'tests/fixtures/ios-contract'))).toBe(false);
  });

  it('parityFixtures every category dir exists under inputs and golden', () => {
    for (const id of FIXTURE_IDS) {
      const [category] = id.split('/');
      expect(statSync(resolve(INPUTS_ROOT, category)).isDirectory()).toBe(true);
      expect(statSync(resolve(GOLDEN_ROOT, category)).isDirectory()).toBe(true);
    }
  });

  it('parityFixtures README documents the canonical path and stop conditions', () => {
    const readme = readFileSync(resolve(PARITY_ROOT, 'README.md'), 'utf8');
    expect(readme).toContain('tests/fixtures/parity/');
    expect(readme).toContain('parityMeta');
    expect(readme).toContain('parityGolden');
    expect(readme).toContain('generate-parity-goldens.mjs');
    expect(readme).toContain('--check');
    expect(readme).toContain('Do not edit golden files manually');
    expect(readme).toContain('Do not place raw private exports here');
  });
});

describe('parityFixtures — input fixture envelopes', () => {
  for (const id of FIXTURE_IDS) {
    it(`parityFixtures input ${id} exists and parses`, () => {
      const path = resolve(INPUTS_ROOT, `${id}.json`);
      expect(existsSync(path)).toBe(true);
      expect(() => readInput(id)).not.toThrow();
    });

    it(`parityFixtures input ${id} carries a parityMeta envelope`, () => {
      const input = readInput(id);
      expect(input).toHaveProperty('parityMeta');
      const meta = input.parityMeta as Record<string, unknown>;
      expect(meta.id).toBe(id);
      expect(meta.schemaVersion).toBe(STORAGE_VERSION);
      expect(typeof meta.describes).toBe('string');
      expect(['synthetic', 'redacted', 'redacted-pointer']).toContain(meta.privacy);
      expect(meta.generatedFrom).toBe('scripts/generate-parity-goldens.mjs');
      expect(typeof meta.tsCommit).toBe('string');
      expect((meta.tsCommit as string).length).toBeGreaterThanOrEqual(7);
      expect(['none', 'deterministic-clock']).toContain(meta.generatedAtPolicy);
      if (meta.generatedAtPolicy === 'deterministic-clock') {
        expect(typeof meta.deterministicClockIso).toBe('string');
        // ISO 8601 sanity: YYYY-MM-DDTHH:MM:SS.sssZ
        expect(meta.deterministicClockIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
    });
  }
});

describe('parityFixtures — golden output envelopes', () => {
  for (const id of FIXTURE_IDS) {
    it(`parityFixtures golden ${id} exists and parses`, () => {
      const path = resolve(GOLDEN_ROOT, `${id}.json`);
      expect(existsSync(path)).toBe(true);
      expect(() => readGolden(id)).not.toThrow();
    });

    it(`parityFixtures golden ${id} carries a parityGolden envelope`, () => {
      const golden = readGolden(id);
      expect(golden).toHaveProperty('parityGolden');
      const meta = golden.parityGolden as Record<string, unknown>;
      expect(meta.sourceFixtureId).toBe(id);
      expect(typeof meta.generatedFromCommit).toBe('string');
      expect((meta.generatedFromCommit as string).length).toBeGreaterThanOrEqual(7);
      expect(meta.generatorVersion).toBe('v1');
    });
  }
});

describe('parityFixtures — category-specific golden contracts', () => {
  it('parityFixtures snapshot-hash golden carries a phase19b- prefix hash', () => {
    const g = readGolden('app-data/snapshot-hash-stable-v1');
    expect(typeof g.snapshotHash).toBe('string');
    expect(g.snapshotHash as string).toMatch(/^phase19b-[0-9a-f]{8}$/);
    expect(g.snapshotHashPrefix).toBe('phase19b-');
    expect(g.schemaVersion).toBe(STORAGE_VERSION);
    // The shape summary is small and stable.
    const summary = g.stableStringifyHashInputSummary as Record<string, unknown>;
    expect(summary).toBeDefined();
    expect(Array.isArray(summary.topLevelKeys)).toBe(true);
    expect((summary.topLevelKeys as string[]).slice()).toEqual(
      [...(summary.topLevelKeys as string[])].sort(),
    );
  });

  it('parityFixtures training-decision golden carries decisionVersion=v2 and a non-empty arbitrationTrace', () => {
    const g = readGolden('training-decision/normal-session-v1');
    expect(g.decisionVersion).toBe('v2');
    const hidden = g.hiddenDebugSignals as Record<string, unknown>;
    expect(hidden).toBeDefined();
    const trace = hidden.arbitrationTrace as string[];
    expect(Array.isArray(trace)).toBe(true);
    expect(trace.length).toBeGreaterThan(0);
    // Each entry follows the AR-<n>-<slug> convention.
    for (const entry of trace) {
      expect(entry).toMatch(/^AR-\d+-/);
    }
    // userFacing structure is locked.
    const userFacing = g.userFacing as Record<string, unknown>;
    expect(userFacing).toBeDefined();
    expect(userFacing).toHaveProperty('explanation');
  });

  it('parityFixtures data-repair golden carries detected, applied, receipt, ledger, idempotencySecondRun', () => {
    const g = readGolden('data-repair/session-lifecycle-residue-v1');
    const detected = g.detected as Array<Record<string, unknown>>;
    expect(Array.isArray(detected)).toBe(true);
    expect(detected.length).toBeGreaterThan(0);
    expect(detected.some((d) => d.repairId === 'sessionLifecycleResidueV1')).toBe(true);
    const applied = g.applied as Record<string, unknown>;
    expect(applied.changed).toBe(true);
    expect(applied.appliedCount).toBeGreaterThan(0);
    const receipt = g.receipt as Record<string, unknown>;
    expect(receipt).not.toBeNull();
    expect(receipt.repairId).toBe('sessionLifecycleResidueV1');
    expect(typeof receipt.id).toBe('string');
    expect(typeof receipt.category).toBe('string');
    const ledger = g.ledger as Record<string, unknown>;
    expect(ledger.length).toBeGreaterThanOrEqual(1);
    const second = g.idempotencySecondRun as Record<string, unknown>;
    expect(second.changed).toBe(false);
    expect(second.detectedCount).toBe(0);
  });

  it('parityFixtures real-export golden carries a data-health scan and a phase19b- snapshot hash', () => {
    const g = readGolden('real-export/redacted-2026-05-27');
    expect(g.fixtureLoaded).toBe(true);
    expect(g.privacyGuardPassed).toBe(true);
    expect(g.expectedSchemaVersion).toBe(STORAGE_VERSION);
    expect(g.actualSchemaVersion).toBe(STORAGE_VERSION);
    expect(g.snapshotHash as string).toMatch(/^phase19b-[0-9a-f]{8}$/);
    const scan = g.dataHealthScan as Array<Record<string, unknown>>;
    expect(Array.isArray(scan)).toBe(true);
    expect(scan.length).toBeGreaterThanOrEqual(9);
    // The 9 V1 repair ids must all appear in the scan.
    const ids = scan.map((s) => s.repairId);
    for (const required of [
      'sessionLifecycleResidueV1',
      'impossibleDurationV1',
      'staleTodayStatusV1',
      'staleHealthReadinessGuardV1',
      'screeningIssueScoreRuntimeGuardV1',
      'screeningIssueScoreRepairV1',
      'legacyFinalAdviceIsolationGuardV1',
      'setIndexRenumberV1',
      'replacementEquivalenceAuditV1',
    ]) {
      expect(ids).toContain(required);
    }
  });

  it('parityFixtures focus-mode golden carries a deterministic, non-trivial step queue', () => {
    const g = readGolden('focus-mode/golden-path-session-v1');
    expect(g.focusStepQueueLength).toBeGreaterThan(1);
    const ids = g.stepIds as string[];
    expect(Array.isArray(ids)).toBe(true);
    expect(ids.length).toBe(g.focusStepQueueLength);
    // Every step id follows main:<exerciseId>:<stepType>:<setIndex>
    for (const id of ids) {
      expect(id).toMatch(/^main:[a-z0-9-]+:(warmup|working|correction|functional):\d+$/);
    }
    const terminal = g.terminalState as Record<string, unknown>;
    expect(terminal.lastStepId).toBe(ids[ids.length - 1]);
  });
});

describe('parityFixtures — input fixtures must not include non-deterministic content', () => {
  for (const id of FIXTURE_IDS) {
    it(`parityFixtures input ${id} contains no Date.now / Math.random literals`, () => {
      const text = readFileSync(resolve(INPUTS_ROOT, `${id}.json`), 'utf8');
      expect(text).not.toMatch(/Date\.now\s*\(/);
      expect(text).not.toMatch(/Math\.random\s*\(/);
    });
  }
});

describe('parityFixtures — fixture inventory has not silently grown beyond the declared contract', () => {
  it('parityFixtures inputs/ and golden/ each carry exactly the declared fixture ids (5 iOS-0 + 9 iOS-4B0 TrainingDecision + 3 iOS-17e-0 progression + 4 SR-0 smart-replacement + 1 SR-1 exercise-library + 5 SR-2 replacement-engine + 5 iOS-17e-1 e1rm-engine + 4 iOS-17e-2 adaptive-feedback + 6 iOS-17e-3 progression-suggestion + 4 iOS-17e-4 set-weight-fine-tune + 3 iOS-17e-4 load-feedback + 2 iOS-17e-6a fine-tune-live + 3 AN-1 leaf-analytics + 3 AN-1b boundary + 2 AN-2 plateau-detection + 2 AN-3 effective-set + 5 AN-3 analytics + 2 AN-4 session-quality + 2 AN-5 pain-pattern/training-level + 2 AN-5b recommendation-confidence/volume-adaptation + 1 AN-6 intelligence-summary)', () => {
    const observed: string[] = [];
    const walk = (root: string, prefix = '') => {
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          walk(resolve(root, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
        } else if (entry.name.endsWith('.json')) {
          observed.push(`${prefix}/${entry.name.replace(/\.json$/, '')}`);
        }
      }
    };
    const inputs: string[] = [];
    const goldens: string[] = [];
    walk(INPUTS_ROOT);
    observed.forEach((id) => inputs.push(id));
    observed.length = 0;
    walk(GOLDEN_ROOT);
    observed.forEach((id) => goldens.push(id));
    expect(inputs.sort()).toEqual([...FIXTURE_IDS].sort());
    expect(goldens.sort()).toEqual([...FIXTURE_IDS].sort());
  });
});
