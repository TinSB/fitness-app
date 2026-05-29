import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-4B4 Deload + Clamp + Modes V1 — static guards.
//
// Locks the iOS-4B4 surface: the adaptive deload (subset) + clampMultiplier +
// volume/intensity/progression modes + the readiness time-gap penalty / health-
// summary delta / Math.round now live in IronPathTrainingDecision (and ONLY there).
// Everything past modes (exercise prescription / role floors / target sets / support
// plan / userFacing / full arbitrationTrace / the buildHealthSummary aggregation /
// the lapse signal) stays forbidden — porting it must fail CI rather than review.
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

// Strip comments so the deferred-engine bans match real CODE, not doc-comments that
// legitimately name what is deferred (e.g. "buildTrainingLapseSignal is deferred").
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

describe('iosTrainingDecisionDeloadClampModes — surface present', () => {
  // (1)/(2) the two new slice files exist.
  it('(1) TrainingDecisionDeload.swift exists', () => {
    expect(existsSync(repoFile(`${SOURCES}/TrainingDecisionDeload.swift`))).toBe(true);
  });
  it('(2) TrainingDecisionModes.swift exists', () => {
    expect(existsSync(repoFile(`${SOURCES}/TrainingDecisionModes.swift`))).toBe(true);
  });

  // (3) buildAdaptiveDeloadDecision present + scoped to this package only.
  it('(3) buildAdaptiveDeloadDecision present in IronPathTrainingDecision and nowhere else in ios/', () => {
    expect(tdSource()).toMatch(/func\s+buildAdaptiveDeloadDecision\b/);
    assertFuncScopedToTrainingDecision('buildAdaptiveDeloadDecision');
  });

  // (4) clampMultiplier present + scoped.
  it('(4) clampMultiplier present in IronPathTrainingDecision and nowhere else in ios/', () => {
    expect(tdSource()).toMatch(/func\s+clampMultiplier\b/);
    assertFuncScopedToTrainingDecision('clampMultiplier');
  });

  // (5) the three modeFor functions present + scoped.
  it('(5) volumeModeFor / intensityModeFor / progressionModeFor present + scoped', () => {
    const src = tdSource();
    for (const fn of ['volumeModeFor', 'intensityModeFor', 'progressionModeFor']) {
      expect(src, `${fn} missing`).toMatch(new RegExp(`func\\s+${fn}\\b`));
      assertFuncScopedToTrainingDecision(fn);
    }
  });

  // (6) finalVolumeMultiplier is COMPUTED (slice field + clampMultiplier wired).
  it('(6) finalVolumeMultiplier computed via clampMultiplier', () => {
    const src = tdSource();
    expect(src).toMatch(/finalVolumeMultiplier/);
    expect(src).toMatch(/let\s+finalVolumeMultiplier\s*=\s*clamp\.multiplier/);
    expect(src).toMatch(/effectiveWeekVolumeMultiplier/); // the clamp input added in 4B4
  });

  // (7) the readiness math completion: time-gap penalty + health delta + jsRound.
  it('(7) readiness time-gap penalty + health-summary delta + jsRound present', () => {
    const src = tdSource();
    expect(src).toMatch(/plannedTimeMin/);
    expect(src).toMatch(/availableTimeMin/);
    expect(src).toMatch(/struct\s+HealthSummary\b/);
    expect(src).toMatch(/func\s+jsRound\b/);
    // the clean input now carries the template duration for the time-gap penalty.
    expect(src).toMatch(/templateDurationMin/);
  });
});

describe('iosTrainingDecisionDeloadClampModes — still-deferred engines forbidden', () => {
  const src = () => tdSource();
  // exercise prescription / roleOf / role floors are PORTED in iOS-4B5 — see
  // iosTrainingDecisionExercisePrescriptionStaticGuards. They no longer appear here.
  const forbidden: Array<[number, string, RegExp]> = [
    [11, 'supportPlan', /\bbuild\w*Support\w*Plan\b/],
    [12, 'userFacing builders', /\bbuild(Today|Plan|Training|Focus|Progress|Record|Explanation)UserFacing\b/],
    [13, 'full arbitrationTrace builder', /\bbuild\w*ArbitrationTrace\b/],
    // The readiness health DELTA is ported, but the sample->summary AGGREGATION is not.
    [14, 'buildHealthSummary', /\bbuildHealthSummary\b/],
    // The deload's lapse-reset early return is deferred (golden-neutral).
    [15, 'buildTrainingLapseSignal', /\bbuildTrainingLapseSignal\b/],
  ];
  for (const [n, label, re] of forbidden) {
    it(`(${n}) no ${label}`, () => {
      expect(src(), `${label} must remain deferred`).not.toMatch(re);
    });
  }
});

describe('iosTrainingDecisionDeloadClampModes — forbidden imports + macros', () => {
  const files = () => collectSwift(repoFile(PKG));
  const forbiddenImports: Array<[number, string, RegExp]> = [
    [16, 'IronPathCloudSync', /\bimport\s+IronPathCloudSync\b/],
    [17, 'HealthKit', /\bimport\s+HealthKit\b/],
    [18, 'IronPathPersistence', /\bimport\s+IronPathPersistence\b/],
    [19, 'UIKit/SwiftUI', /\bimport\s+(UIKit|SwiftUI)\b/],
    [20, 'Supabase/WebKit/BackgroundTasks', /\bimport\s+(Supabase|WebKit|BackgroundTasks)\b/],
  ];
  for (const [n, label, re] of forbiddenImports) {
    it(`(${n}) no import ${label}`, () => {
      for (const f of files()) {
        expect(re.test(readFileSync(f, 'utf8')), `${label} imported in ${f}`).toBe(false);
      }
    });
  }

  it('(21) no SwiftData/CoreData/@Model/@Observable', () => {
    for (const f of files()) {
      const t = readFileSync(f, 'utf8');
      expect(t).not.toMatch(/\bimport\s+SwiftData\b/);
      expect(t).not.toMatch(/\bimport\s+CoreData\b/);
      expect(t).not.toMatch(/@Model\b/);
      expect(t).not.toMatch(/@Observable\b/);
    }
  });

  it('(22) no AppData mutation helpers / clean-view construction / raw history read', () => {
    const s = tdSource();
    expect(s).not.toMatch(/\.history\.append\b/);
    expect(s).not.toMatch(/\bvar\s+appData\b/);
    expect(s).not.toMatch(/\bappData\.\w+\s*=/);
    expect(s).not.toMatch(/\bbuildCleanAppDataView\s*\(/);
    expect(s).not.toMatch(/\.raw\.history\b/);
  });
});

describe('iosTrainingDecisionDeloadClampModes — hygiene', () => {
  it('(23) training-decision goldens unchanged (10 files)', () => {
    const goldens = readdirSync(repoFile('tests/fixtures/parity/golden/training-decision'))
      .filter((f) => f.endsWith('.json'));
    expect(goldens.length).toBe(10);
  });
  it('(24) no pnpm-lock.yaml', () => {
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
  });
  it('(25) iOS-4B4 design doc exists and records the slice', () => {
    const doc = repoFile('docs/ios-native-migration/IOS_4B4_DELOAD_CLAMP_MODES_V1.md');
    expect(existsSync(doc), 'iOS-4B4 design doc must exist').toBe(true);
    const t = readFileSync(doc, 'utf8');
    expect(t).toMatch(/finalVolumeMultiplier/);
    expect(t).toMatch(/intensityMode/);
    expect(t).toMatch(/time-gap/i);
  });
});
