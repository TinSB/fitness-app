import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-4B1 — TrainingDecision golden SHAPE guards (TS side).
//
// Locks the on-disk shape of the 10 training-decision goldens that the Swift
// IronPathTrainingDecision type skeleton decodes, so a TS-side golden drift
// that would break the Swift decode is caught in the Vitest suite too. This is
// a SHAPE guard — it does not run the generator (parityFixturesContract +
// GenerationConsistency already do that).
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const GOLDEN = 'tests/fixtures/parity/golden/training-decision';

const read = (id: string): Record<string, unknown> =>
  JSON.parse(readFileSync(resolve(repoRoot, `${GOLDEN}/${id}.json`), 'utf8'));

const NARROW = 'normal-session-v1';
const EXPANDED = [
  'severe-rest-v1', 'controlled-reload-v1', 'deload-week-v1', 'stale-today-status-v1',
  'stale-health-data-v1', 'restart-28d-gap-v1', 'productive-floor-v1',
  'no-legacy-advice-v1', 'clean-input-contract-v1',
] as const;
const ALL = [NARROW, ...EXPANDED] as const;

const SURFACES = ['today', 'plan', 'training', 'focus', 'progress', 'record', 'explanation'] as const;

describe('iosTrainingDecisionGoldenShape — fixtures present', () => {
  it('iosTrainingDecisionGoldenShape all 10 golden files exist', () => {
    for (const id of ALL) {
      expect(existsSync(resolve(repoRoot, `${GOLDEN}/${id}.json`)), `missing ${id}`).toBe(true);
    }
  });
});

describe('iosTrainingDecisionGoldenShape — always-present keys', () => {
  for (const id of ALL) {
    it(`iosTrainingDecisionGoldenShape ${id} carries the always-present keys`, () => {
      const g = read(id);
      expect(g.decisionVersion).toBe('v2');
      expect(typeof g.sourceFixtureId).toBe('string');
      expect(g).toHaveProperty('parityGolden');
      expect(g).toHaveProperty('userFacing');
      expect(g).toHaveProperty('hiddenDebugSignals');
      // userFacing has all 7 surfaces, each with a matching surfaceId.
      const uf = g.userFacing as Record<string, Record<string, unknown>>;
      for (const s of SURFACES) {
        expect(uf[s], `${id}.userFacing.${s}`).toBeTruthy();
        expect(uf[s].surfaceId).toBe(s);
      }
      // hiddenDebugSignals is exactly { arbitrationTrace: string[] }.
      const hidden = g.hiddenDebugSignals as Record<string, unknown>;
      expect(Object.keys(hidden)).toEqual(['arbitrationTrace']);
      expect(Array.isArray(hidden.arbitrationTrace)).toBe(true);
    });
  }
});

describe('iosTrainingDecisionGoldenShape — narrow vs expanded split', () => {
  it('iosTrainingDecisionGoldenShape normal-session-v1 is the narrow 5-key projection', () => {
    const keys = Object.keys(read(NARROW)).sort();
    expect(keys).toEqual([
      'decisionVersion', 'hiddenDebugSignals', 'parityGolden', 'sourceFixtureId', 'userFacing',
    ]);
  });

  for (const id of EXPANDED) {
    it(`iosTrainingDecisionGoldenShape ${id} carries the expanded structured fields`, () => {
      const g = read(id);
      expect(typeof g.sessionIntent).toBe('string');
      expect(typeof g.activePhase).toBe('string');
      expect(typeof g.riskLevel).toBe('string');
      expect(typeof g.finalVolumeMultiplier).toBe('number');
      expect(Array.isArray(g.perExercise)).toBe(true);
      expect(g).toHaveProperty('cleanInput');
      // perExercise items are { exerciseId, role, targetSets }.
      for (const e of g.perExercise as Array<Record<string, unknown>>) {
        expect(typeof e.exerciseId).toBe('string');
        expect(typeof e.role).toBe('string');
        expect(typeof e.targetSets).toBe('number');
      }
    });
  }
});

describe('iosTrainingDecisionGoldenShape — per-path invariants the Swift types decode', () => {
  it('iosTrainingDecisionGoldenShape severe-rest is severe + all-1-set', () => {
    const g = read('severe-rest-v1');
    expect(g.sessionIntent).toBe('severe-rest');
    expect(g.riskLevel).toBe('severe');
    expect((g.allTargetSets as number[]).every((n) => n === 1)).toBe(true);
  });

  it('iosTrainingDecisionGoldenShape productive-floor keeps compounds >= 2', () => {
    const g = read('productive-floor-v1');
    const floors = g.exerciseRoleFloors as Record<string, number>;
    expect(floors['main-compound']).toBeGreaterThanOrEqual(2);
    expect(floors['secondary-compound']).toBeGreaterThanOrEqual(2);
    expect(Math.max(...(g.allTargetSets as number[]))).toBeGreaterThanOrEqual(2);
  });

  it('iosTrainingDecisionGoldenShape restart carries effectivePhase=restart gap>=28', () => {
    const g = read('restart-28d-gap-v1');
    expect(g.activePhase).toBe('restart');
    const ep = g.effectivePhase as Record<string, unknown>;
    expect(ep.activePhase).toBe('restart');
    expect(ep.gapDays as number).toBeGreaterThanOrEqual(28);
  });

  it('iosTrainingDecisionGoldenShape cleanInput diagnostics shape is stable', () => {
    const g = read('clean-input-contract-v1');
    const ci = g.cleanInput as Record<string, unknown>;
    expect(ci.cleanViewBuilt).toBe(true);
    const diag = ci.diagnostics as Record<string, unknown>;
    for (const k of [
      'lifecycleResidueSessionIds', 'legacyAdviceSessionIds', 'invalidDurationSessionIds',
      'cappedIssueScoreKeys', 'staleTodayStatus', 'staleHealthData', 'filteredPerformanceDropIds',
    ]) {
      expect(diag, `diagnostics.${k}`).toHaveProperty(k);
    }
  });
});
