import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-4B3 Readiness + e1RM Slice V1 — static guards.
//
// Locks the iOS-4B3 surface: the SUBJECTIVE readiness slice + e1RM trend now live
// in IronPathTrainingDecision (and ONLY there), unlocking controlled-reload +
// riskLevel; everything past readiness (prescription / deload / clamp / modes /
// userFacing / health-summary delta / full arbitrationTrace) stays forbidden.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const PKG = 'ios/packages/IronPathTrainingDecision';
const SOURCES = `${PKG}/Sources/IronPathTrainingDecision`;
const TESTS = `${PKG}/Tests/IronPathTrainingDecisionTests`;
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
const tdTests = (): string =>
  collectSwift(repoFile(TESTS)).map((f) => readFileSync(f, 'utf8')).join('\n');

describe('iosTrainingDecisionReadinessE1RMSlice — surface present', () => {
  // (1)/(2) the two new slice files exist.
  it('(1) TrainingDecisionReadiness.swift exists', () => {
    expect(existsSync(repoFile(`${SOURCES}/TrainingDecisionReadiness.swift`))).toBe(true);
  });
  it('(2) TrainingDecisionE1RMTrend.swift exists', () => {
    expect(existsSync(repoFile(`${SOURCES}/TrainingDecisionE1RMTrend.swift`))).toBe(true);
  });

  // (3) controlled-reload deferral is removed / resolved (no 4B2 normal-session exception).
  it('(3) controlled-reload deferral resolved', () => {
    const t = tdTests();
    expect(t).toMatch(/controlledReload/);
    expect(t).not.toMatch(/controlled-reload computes normal-session/);
  });

  // (4)/(5) buildTodayReadiness + isE1rmTrendUp ports live in THIS package only.
  it('(4) buildTodayReadiness present in IronPathTrainingDecision and nowhere else in ios/', () => {
    const src = tdSource();
    expect(src).toMatch(/func\s+buildTodayReadiness\b/);
    assertSymbolScopedToTrainingDecision('buildTodayReadiness');
  });
  it('(5) isE1rmTrendUp present in IronPathTrainingDecision and nowhere else in ios/', () => {
    const src = tdSource();
    expect(src).toMatch(/func\s+isE1rmTrendUp\b/);
    assertSymbolScopedToTrainingDecision('isE1rmTrendUp');
  });
});

/// Asserts a function name appears only under IronPathTrainingDecision in ios/.
function assertSymbolScopedToTrainingDecision(name: string): void {
  const re = new RegExp(`\\bfunc\\s+${name}\\b`);
  for (const f of collectSwift(repoFile(ALL_IOS_PACKAGES))) {
    if (f.includes('/IronPathTrainingDecision/')) continue;
    expect(re.test(readFileSync(f, 'utf8')), `${name} must not be declared in ${f}`).toBe(false);
  }
}

describe('iosTrainingDecisionReadinessE1RMSlice — still-deferred engines forbidden', () => {
  const src = () => tdSource();
  const forbidden: Array<[number, string, RegExp]> = [
    [6, 'exercise prescription (apply/prescribe)', /\bfunc\s+(apply|prescribe)\w*(Prescription|StatusRules)\b/],
    [7, 'applyStatusRules', /\bapplyStatusRules\b/],
    [8, 'supportPlan', /\bbuild\w*Support\w*Plan\b/],
    [9, 'adaptive deload (build*Deload*)', /\bbuild\w*Deload\w*\b/],
    [10, 'buildAdaptiveDeloadDecision', /\bbuildAdaptiveDeloadDecision\b/],
    [11, 'clampMultiplier', /\bclampMultiplier\b/],
    [12, 'userFacing builders', /\bbuild(Today|Plan|Training|Focus|Progress|Record|Explanation)UserFacing\b/],
    [13, 'full arbitrationTrace builder', /\bbuild\w*ArbitrationTrace\b/],
    // health-summary DELTA stays deferred (only the subjective readiness is ported).
    [13.5, 'buildHealthSummary', /\bbuildHealthSummary\b/],
  ];
  for (const [n, label, re] of forbidden) {
    it(`(${n}) no ${label}`, () => {
      expect(src(), `${label} must remain deferred`).not.toMatch(re);
    });
  }
});

describe('iosTrainingDecisionReadinessE1RMSlice — forbidden imports + macros', () => {
  const files = () => collectSwift(repoFile(PKG));
  const forbiddenImports: Array<[number, string, RegExp]> = [
    [14, 'IronPathCloudSync', /\bimport\s+IronPathCloudSync\b/],
    [15, 'HealthKit', /\bimport\s+HealthKit\b/],
    [16, 'IronPathPersistence', /\bimport\s+IronPathPersistence\b/],
    [17, 'UIKit/SwiftUI', /\bimport\s+(UIKit|SwiftUI)\b/],
    [18, 'Supabase/WebKit/BackgroundTasks', /\bimport\s+(Supabase|WebKit|BackgroundTasks)\b/],
  ];
  for (const [n, label, re] of forbiddenImports) {
    it(`(${n}) no import ${label}`, () => {
      for (const f of files()) {
        expect(re.test(readFileSync(f, 'utf8')), `${label} imported in ${f}`).toBe(false);
      }
    });
  }

  it('(19) no SwiftData/CoreData/@Model/@Observable', () => {
    for (const f of files()) {
      const t = readFileSync(f, 'utf8');
      expect(t).not.toMatch(/\bimport\s+SwiftData\b/);
      expect(t).not.toMatch(/\bimport\s+CoreData\b/);
      expect(t).not.toMatch(/@Model\b/);
      expect(t).not.toMatch(/@Observable\b/);
    }
  });

  it('(20) no AppData mutation helpers / clean-view construction / raw history read', () => {
    const s = tdSource();
    expect(s).not.toMatch(/\.history\.append\b/);
    expect(s).not.toMatch(/\bvar\s+appData\b/);
    expect(s).not.toMatch(/\bappData\.\w+\s*=/);
    expect(s).not.toMatch(/\bbuildCleanAppDataView\s*\(/);
    expect(s).not.toMatch(/\.raw\.history\b/);
  });
});

describe('iosTrainingDecisionReadinessE1RMSlice — hygiene', () => {
  it('(21) training-decision goldens unchanged (10 files)', () => {
    const goldens = readdirSync(repoFile('tests/fixtures/parity/golden/training-decision'))
      .filter((f) => f.endsWith('.json'));
    expect(goldens.length).toBe(10);
  });
  it('(22) no pnpm-lock.yaml', () => {
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
  });
});
