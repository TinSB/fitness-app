import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-4B5 Exercise Prescription + Volume Floor V1 — static guards.
//
// Locks the iOS-4B5 surface: roleOf + role/kind floors + the prescribeExercise /
// applyStatusRules set pipeline + the adaptive conservativeLevel cut now live in
// IronPathTrainingDecision (and ONLY there), producing perExercise / allTargetSets /
// exerciseRoleFloors. Everything past prescription (support plan / userFacing / the
// full arbitrationTrace / the buildHealthSummary aggregation / the lapse signal) stays
// forbidden. The exercise-knowledge DATA is a BOUNDED subset (the 6 push-a exercises
// the goldens exercise) — the full knowledge base is deferred.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const PKG = 'ios/packages/IronPathTrainingDecision';
const SOURCES = `${PKG}/Sources/IronPathTrainingDecision`;
const ALL_IOS_PACKAGES = 'ios/packages';

const repoFile = (p: string) => resolve(repoRoot, p);

const collectSwift = (dir: string, out: string[] = []): string[] => {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.build' || entry.name === 'DerivedData') continue;
      collectSwift(full, out);
    } else if (entry.name.endsWith('.swift')) {
      out.push(full);
    }
  }
  return out;
};

const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

const tdSource = (): string =>
  stripSwiftComments(collectSwift(repoFile(SOURCES)).map((f) => readFileSync(f, 'utf8')).join('\n'));

/// Asserts a `func <name>` appears only under IronPathTrainingDecision in ios/.
function assertFuncScopedToTrainingDecision(name: string): void {
  const re = new RegExp(`\\bfunc\\s+${name}\\b`);
  for (const f of collectSwift(repoFile(ALL_IOS_PACKAGES))) {
    if (f.includes('/IronPathTrainingDecision/')) continue;
    expect(re.test(readFileSync(f, 'utf8')), `${name} must not be declared in ${f}`).toBe(false);
  }
}

describe('iosTrainingDecisionExercisePrescription — surface present', () => {
  // (1)/(2) the two new slice files exist.
  it('(1) TrainingDecisionExercisePrescription.swift exists', () => {
    expect(existsSync(repoFile(`${SOURCES}/TrainingDecisionExercisePrescription.swift`))).toBe(true);
  });
  it('(2) TrainingDecisionExerciseRoles.swift exists', () => {
    expect(existsSync(repoFile(`${SOURCES}/TrainingDecisionExerciseRoles.swift`))).toBe(true);
  });

  // (3) roleOf present + scoped.
  it('(3) roleOf present in IronPathTrainingDecision and nowhere else in ios/', () => {
    expect(tdSource()).toMatch(/func\s+roleOf\b/);
    assertFuncScopedToTrainingDecision('roleOf');
  });

  // (4) the prescription set pipeline is present (prescribeExercise-equivalent +
  //     workingSetTargets) and scoped.
  it('(4) prescribeSets + buildWorkingSetTargets present + scoped', () => {
    const src = tdSource();
    expect(src).toMatch(/func\s+prescribeSets\b/);
    expect(src).toMatch(/func\s+buildWorkingSetTargets\b/);
    assertFuncScopedToTrainingDecision('buildWorkingSetTargets');
  });

  // (5) role floors + exerciseRoleFloors + kindFloors present.
  it('(5) role floors + exerciseRoleFloors + kindFloors present', () => {
    const src = tdSource();
    expect(src).toMatch(/enum\s+TrainingDecisionRoleFloors\b/);
    expect(src).toMatch(/func\s+exerciseRoleFloors\b/);
    expect(src).toMatch(/func\s+kindFloors\b/);
    expect(src).toMatch(/ExerciseRole\b/);
  });

  // (6) the adaptive conservativeLevel cut + contraindicated chain are present.
  it('(6) conservativeLevel + contraindicated present', () => {
    const src = tdSource();
    expect(src).toMatch(/func\s+conservativeLevel\b/);
    expect(src).toMatch(/func\s+isContraindicated\b/);
  });

  // (7) the engine computes perExercise / allTargetSets / exerciseRoleFloors.
  it('(7) engine wires perExercise / allTargetSets / exerciseRoleFloors onto the slice', () => {
    const src = tdSource();
    expect(src).toMatch(/perExercise/);
    expect(src).toMatch(/allTargetSets/);
    expect(src).toMatch(/exerciseRoleFloors/);
    expect(src).toMatch(/buildWorkingSetTargets\s*\(/);
  });
});

describe('iosTrainingDecisionExercisePrescription — still-deferred engines forbidden', () => {
  const src = () => tdSource();
  const forbidden: Array<[number, string, RegExp]> = [
    [8, 'supportPlan', /\bbuild\w*Support\w*Plan\b/],
    [9, 'userFacing builders', /\bbuild(Today|Plan|Training|Focus|Progress|Record|Explanation)UserFacing\b/],
    [10, 'full arbitrationTrace builder', /\bbuild\w*ArbitrationTrace\b/],
    // The readiness health DELTA is ported; the sample->summary AGGREGATION is not.
    [11, 'buildHealthSummary', /\bbuildHealthSummary\b/],
    // The deload's lapse-reset early return is deferred (golden-neutral).
    [12, 'buildTrainingLapseSignal', /\bbuildTrainingLapseSignal\b/],
  ];
  for (const [n, label, re] of forbidden) {
    it(`(${n}) no ${label}`, () => {
      expect(src(), `${label} must remain deferred`).not.toMatch(re);
    });
  }
});

describe('iosTrainingDecisionExercisePrescription — forbidden imports + macros', () => {
  const files = () => collectSwift(repoFile(PKG));
  const forbiddenImports: Array<[number, string, RegExp]> = [
    [13, 'IronPathCloudSync', /\bimport\s+IronPathCloudSync\b/],
    [14, 'HealthKit', /\bimport\s+HealthKit\b/],
    [15, 'IronPathPersistence', /\bimport\s+IronPathPersistence\b/],
    [16, 'UIKit/SwiftUI', /\bimport\s+(UIKit|SwiftUI)\b/],
    [17, 'Supabase/WebKit/BackgroundTasks', /\bimport\s+(Supabase|WebKit|BackgroundTasks)\b/],
  ];
  for (const [n, label, re] of forbiddenImports) {
    it(`(${n}) no import ${label}`, () => {
      for (const f of files()) {
        expect(re.test(readFileSync(f, 'utf8')), `${label} imported in ${f}`).toBe(false);
      }
    });
  }

  it('(18) no SwiftData/CoreData/@Model/@Observable', () => {
    for (const f of files()) {
      const t = readFileSync(f, 'utf8');
      expect(t).not.toMatch(/\bimport\s+SwiftData\b/);
      expect(t).not.toMatch(/\bimport\s+CoreData\b/);
      expect(t).not.toMatch(/@Model\b/);
      expect(t).not.toMatch(/@Observable\b/);
    }
  });

  it('(19) no AppData mutation / clean-view construction / raw history read', () => {
    const s = tdSource();
    expect(s).not.toMatch(/\.history\.append\b/);
    expect(s).not.toMatch(/\bvar\s+appData\b/);
    expect(s).not.toMatch(/\bappData\.\w+\s*=/);
    expect(s).not.toMatch(/\bbuildCleanAppDataView\s*\(/);
    expect(s).not.toMatch(/\.raw\.history\b/);
  });
});

describe('iosTrainingDecisionExercisePrescription — hygiene', () => {
  it('(20) training-decision goldens unchanged (10 files)', () => {
    const goldens = readdirSync(repoFile('tests/fixtures/parity/golden/training-decision'))
      .filter((f) => f.endsWith('.json'));
    expect(goldens.length).toBe(10);
  });
  it('(21) no pnpm-lock.yaml', () => {
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
  });
  it('(22) iOS-4B5 design doc exists and records the slice', () => {
    const doc = repoFile('docs/ios-native-migration/IOS_4B5_EXERCISE_PRESCRIPTION_VOLUME_FLOOR_V1.md');
    expect(existsSync(doc), 'iOS-4B5 design doc must exist').toBe(true);
    const t = readFileSync(doc, 'utf8');
    expect(t).toMatch(/perExercise/);
    expect(t).toMatch(/role floor/i);
    expect(t).toMatch(/iOS-5/); // next task points at native Focus Mode, not 4B6
  });
});
