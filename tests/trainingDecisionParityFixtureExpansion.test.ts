import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-4B0 TrainingDecision Parity Fixture Expansion V1 — lock test.
//
// Locks the 9 new synthetic TrainingDecision parity fixtures that each drive a
// distinct engine path through the real Clean Input Contract pipeline. This is
// a TypeScript-side fixture-expansion task: NO Swift TrainingDecision exists yet.
//
// The 19 assertions map 1:1 to the iOS-4B0 task brief Phase 6 list. Several read
// the committed golden (generated, never hand-edited) and assert structured
// per-path evidence so a future Swift port has a machine-checkable baseline.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const INPUT_DIR = 'tests/fixtures/parity/inputs/training-decision';
const GOLDEN_DIR = 'tests/fixtures/parity/golden/training-decision';

const NEW_FIXTURES = [
  'severe-rest-v1',
  'controlled-reload-v1',
  'deload-week-v1',
  'stale-today-status-v1',
  'stale-health-data-v1',
  'restart-28d-gap-v1',
  'productive-floor-v1',
  'no-legacy-advice-v1',
  'clean-input-contract-v1',
] as const;

const readInput = (name: string) =>
  JSON.parse(readFileSync(resolve(repoRoot, `${INPUT_DIR}/${name}.json`), 'utf8'));
const readGolden = (name: string) =>
  JSON.parse(readFileSync(resolve(repoRoot, `${GOLDEN_DIR}/${name}.json`), 'utf8'));

describe('trainingDecisionParityFixtureExpansion — files exist', () => {
  // (1) all new input fixtures exist.
  it('trainingDecisionParityFixtureExpansion (1) all new input fixtures exist', () => {
    for (const n of NEW_FIXTURES) {
      expect(existsSync(resolve(repoRoot, `${INPUT_DIR}/${n}.json`)), `missing input ${n}`).toBe(true);
    }
  });

  // (2) all new golden fixtures exist.
  it('trainingDecisionParityFixtureExpansion (2) all new golden fixtures exist', () => {
    for (const n of NEW_FIXTURES) {
      expect(existsSync(resolve(repoRoot, `${GOLDEN_DIR}/${n}.json`)), `missing golden ${n}`).toBe(true);
    }
  });
});

describe('trainingDecisionParityFixtureExpansion — generator integration', () => {
  // (3) generator --list includes all new training-decision fixture ids.
  it('trainingDecisionParityFixtureExpansion (3) --list includes all new ids', () => {
    const out = execFileSync('node', ['scripts/generate-parity-goldens.mjs', '--list'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    for (const n of NEW_FIXTURES) {
      expect(out, `--list missing training-decision/${n}`).toContain(`training-decision/${n}`);
    }
    // The existing fixture is still listed (not dropped).
    expect(out).toContain('training-decision/normal-session-v1');
  });

  // (4) generator --check passes (goldens are deterministic + committed in sync).
  it('trainingDecisionParityFixtureExpansion (4) --check passes (no drift)', () => {
    // Throws (non-zero exit) if any golden drifted.
    const out = execFileSync('node', ['scripts/generate-parity-goldens.mjs', '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    expect(out).toContain('0 changed');
  }, 120_000);
});

describe('trainingDecisionParityFixtureExpansion — envelope + privacy', () => {
  // (5) every new fixture has parityMeta.
  it('trainingDecisionParityFixtureExpansion (5) every fixture has parityMeta', () => {
    for (const n of NEW_FIXTURES) {
      const m = readInput(n).parityMeta;
      expect(m, `${n} missing parityMeta`).toBeTruthy();
      expect(m.id).toBe(`training-decision/${n}`);
      expect(m.schemaVersion).toBe(8);
      expect(m.privacy).toBe('synthetic');
      expect(typeof m.tsCommit).toBe('string');
      expect(m.tsCommit.length).toBeGreaterThan(0);
    }
  });

  // (6) every new fixture has a fixed deterministicClockIso.
  it('trainingDecisionParityFixtureExpansion (6) every fixture has deterministicClockIso', () => {
    for (const n of NEW_FIXTURES) {
      const m = readInput(n).parityMeta;
      expect(m.generatedAtPolicy).toBe('deterministic-clock');
      expect(m.deterministicClockIso).toBe('2026-05-27T10:00:00.000Z');
    }
  });

  // (7) no fixture (input or golden) contains private identifiers / secrets.
  it('trainingDecisionParityFixtureExpansion (7) no private identifiers in inputs/goldens', () => {
    const forbidden: Array<{ name: string; re: RegExp }> = [
      { name: 'email', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
      { name: 'jwt', re: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXV/ },
      { name: 'sb_secret', re: /sb_secret_/ },
      { name: 'bearer', re: /\bbearer\s+[A-Za-z0-9._\-=+]+/i },
      { name: 'local-user', re: /local-user/ },
      { name: 'service_role', re: /service_role/i },
    ];
    for (const n of NEW_FIXTURES) {
      for (const kind of ['inputs', 'goldens'] as const) {
        const path = resolve(repoRoot, kind === 'inputs' ? `${INPUT_DIR}/${n}.json` : `${GOLDEN_DIR}/${n}.json`);
        const text = readFileSync(path, 'utf8');
        for (const { name, re } of forbidden) {
          expect(re.test(text), `${kind}/${n} contains ${name}`).toBe(false);
        }
      }
    }
  });
});

describe('trainingDecisionParityFixtureExpansion — per-path golden evidence', () => {
  // (8) severe-rest golden contains severe/rest path evidence.
  it('trainingDecisionParityFixtureExpansion (8) severe-rest path evidence', () => {
    const g = readGolden('severe-rest-v1');
    expect(g.sessionIntent).toBe('severe-rest');
    expect(g.riskLevel).toBe('severe');
    expect(g.volumeMode).toBe('severe-cut');
    expect(g.hiddenDebugSignals.arbitrationTrace).toContain('AR-1-severe-override');
    expect(g.hiddenDebugSignals.arbitrationTrace).toContain('AR-1-severe-cut');
    expect(Number(g.finalVolumeMultiplier)).toBeLessThanOrEqual(0.3);
  });

  // (9) controlled-reload golden proves productive non-1-set output.
  it('trainingDecisionParityFixtureExpansion (9) controlled-reload non-1-set', () => {
    const g = readGolden('controlled-reload-v1');
    expect(g.sessionIntent).toBe('controlled-reload');
    expect(g.hiddenDebugSignals.arbitrationTrace).toContain('AR-5-controlled-reload');
    // Not all exercises collapse to 1 set.
    expect(Math.max(...g.allTargetSets)).toBeGreaterThanOrEqual(2);
  });

  // (10) deload-week golden proves true deload path.
  it('trainingDecisionParityFixtureExpansion (10) deload-week path', () => {
    const g = readGolden('deload-week-v1');
    expect(g.sessionIntent).toBe('deload-week');
    expect(g.volumeMode).toBe('trim');
    // Distinct from reentry/restart (which are gap-driven phases).
    expect(g.activePhase).not.toBe('reentry');
    expect(g.activePhase).not.toBe('restart');
  });

  // (11) stale-today-status golden proves stale status handling.
  it('trainingDecisionParityFixtureExpansion (11) stale todayStatus handling', () => {
    const g = readGolden('stale-today-status-v1');
    expect(g.cleanInput.diagnostics.staleTodayStatus).toBe(true);
    // Neutral status => no false recovery/fatigue signal (no severe/high risk).
    expect(['none', 'low']).toContain(g.riskLevel);
  });

  // (12) stale-health-data golden proves stale health handling.
  it('trainingDecisionParityFixtureExpansion (12) stale health handling', () => {
    const g = readGolden('stale-health-data-v1');
    expect(g.cleanInput.diagnostics.staleHealthData).toBe(true);
    expect(g.cleanInput.useHealthDataForReadiness).toBe(false);
    // Raw samples preserved (downgraded, not deleted).
    expect(g.inputEvidence.rawHealthSamplesPreserved).toBe(true);
    expect(g.inputEvidence.healthMetricSampleCount).toBeGreaterThan(0);
  });

  // (13) restart-28d-gap golden proves restart path.
  it('trainingDecisionParityFixtureExpansion (13) restart path', () => {
    const g = readGolden('restart-28d-gap-v1');
    expect(g.activePhase).toBe('restart');
    expect(g.effectivePhase.activePhase).toBe('restart');
    expect(Number(g.effectivePhase.gapDays)).toBeGreaterThanOrEqual(28);
  });

  // (14) productive-floor golden proves major exercises are not all 1 set.
  it('trainingDecisionParityFixtureExpansion (14) productive floor compounds >= 2', () => {
    const g = readGolden('productive-floor-v1');
    expect(g.activePhase).toBe('reentry');
    expect(g.exerciseRoleFloors['main-compound']).toBeGreaterThanOrEqual(2);
    expect(g.exerciseRoleFloors['secondary-compound']).toBeGreaterThanOrEqual(2);
    // At least one compound prescription holds >= 2 sets; not all-1-set.
    const compounds = g.perExercise.filter((e: any) => typeof e.role === 'string' && e.role.includes('compound'));
    expect(compounds.length).toBeGreaterThan(0);
    expect(compounds.every((e: any) => Number(e.targetSets) >= 2)).toBe(true);
    expect(Math.max(...g.allTargetSets)).toBeGreaterThanOrEqual(2);
  });

  // (15) no-legacy-advice golden proves legacy advice does not influence live output.
  it('trainingDecisionParityFixtureExpansion (15) legacy advice isolated', () => {
    const g = readGolden('no-legacy-advice-v1');
    // The legacy residue was detected + stripped by the clean view.
    expect(g.cleanInput.diagnostics.legacyAdviceSessionIds.length).toBeGreaterThan(0);
    // The seeded legacy strings never surface in any userFacing copy.
    const uf = JSON.stringify(g.userFacing);
    expect(uf).not.toContain('legacy');
    expect(uf).not.toContain('历史建议');
    expect(uf).not.toContain('历史警告');
  });

  // (16) clean-input-contract golden proves clean input path.
  it('trainingDecisionParityFixtureExpansion (16) clean input path', () => {
    const g = readGolden('clean-input-contract-v1');
    expect(g.cleanInput.cleanViewBuilt).toBe(true);
    expect(g.cleanInput.diagnostics.lifecycleResidueSessionIds.length).toBeGreaterThan(0);
    expect(g.cleanInput.diagnostics.invalidDurationSessionIds.length).toBeGreaterThan(0);
    // Decision still produced from the cleaned input.
    expect(g.decisionVersion).toBe('v2');
  });
});

describe('trainingDecisionParityFixtureExpansion — invariants', () => {
  // Every new golden carries the structured engine fields + all 7 userFacing surfaces.
  it('trainingDecisionParityFixtureExpansion every golden has decisionVersion v2 + 7 surfaces', () => {
    for (const n of NEW_FIXTURES) {
      const g = readGolden(n);
      expect(g.decisionVersion, `${n}`).toBe('v2');
      expect(Object.keys(g.userFacing).sort()).toEqual([
        'explanation', 'focus', 'plan', 'progress', 'record', 'today', 'training',
      ]);
      expect(Array.isArray(g.hiddenDebugSignals.arbitrationTrace)).toBe(true);
      expect(Array.isArray(g.perExercise)).toBe(true);
    }
  });

  // (17) existing iOS-0 fixtures still pass (normal-session golden unchanged + present).
  it('trainingDecisionParityFixtureExpansion (17) existing iOS-0 fixtures intact', () => {
    const existing = [
      'tests/fixtures/parity/golden/app-data/snapshot-hash-stable-v1.json',
      'tests/fixtures/parity/golden/training-decision/normal-session-v1.json',
      'tests/fixtures/parity/golden/data-repair/session-lifecycle-residue-v1.json',
      'tests/fixtures/parity/golden/real-export/redacted-2026-05-27.json',
      'tests/fixtures/parity/golden/focus-mode/golden-path-session-v1.json',
    ];
    for (const p of existing) {
      expect(existsSync(resolve(repoRoot, p)), `missing ${p}`).toBe(true);
    }
    // normal-session-v1 keeps its narrower projection (NOT the expanded shape):
    // it has no top-level sessionIntent (that field is expanded-generator-only).
    const normal = readGolden('normal-session-v1');
    expect(normal.decisionVersion).toBe('v2');
    expect(normal.sessionIntent).toBeUndefined();
  });

  // (18) no Swift TrainingDecision package exists (iOS-4B0 is fixtures-only).
  it('trainingDecisionParityFixtureExpansion (18) no IronPathTrainingDecision package', () => {
    expect(existsSync(resolve(repoRoot, 'ios/packages/IronPathTrainingDecision'))).toBe(false);
    // And the existing iOS package set is unchanged (8 packages).
    const packages = readdirSync(resolve(repoRoot, 'ios/packages')).filter((d) =>
      existsSync(resolve(repoRoot, 'ios/packages', d, 'Package.swift')),
    );
    expect(packages).not.toContain('IronPathTrainingDecision');
  });

  // (19) no package/lockfile change (guard against accidental dependency churn).
  it('trainingDecisionParityFixtureExpansion (19) no new lockfile / pnpm-lock', () => {
    expect(existsSync(resolve(repoRoot, 'pnpm-lock.yaml'))).toBe(false);
  });
});
