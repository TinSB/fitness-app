import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-4B2 TrainingDecision Core Rule Skeleton V1 — engine static guards.
//
// Bounds the FIRST TrainingDecision engine slice to exactly effectivePhase +
// sessionIntent. It POSITIVELY asserts the core-slice surface exists (entry +
// clean-input factory + the two engine files), the brand is a compile-time lock
// (fileprivate init, not Codable), and the IronPathDataHealth dependency arrow is
// acyclic; and it NEGATIVELY forbids every deferred engine symbol
// (prescription / readiness / deload / modes / riskLevel / e1RM / lapse /
// userFacing) so porting the rest of the engine fails CI rather than review.
// This is the file the iOS-4B task doc forward-references.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const PKG = 'ios/packages/IronPathTrainingDecision';
const SOURCES = `${PKG}/Sources/IronPathTrainingDecision`;
const TESTS = `${PKG}/Tests/IronPathTrainingDecisionTests`;
const DATAHEALTH = 'ios/packages/IronPathDataHealth';

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

// Strip Swift comments before scanning so the deferred-engine bans match real
// CODE, not the explanatory doc-comments that legitimately name what is deferred
// (e.g. "MUST NOT reference applyStatusRules / buildTodayReadiness …").
const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

const srcText = (): string =>
  stripSwiftComments(collectSwift(repoFile(SOURCES)).map((f) => readFileSync(f, 'utf8')).join('\n'));
const testText = (): string =>
  collectSwift(repoFile(TESTS)).map((f) => readFileSync(f, 'utf8')).join('\n');
const pkgText = (): string => readFileSync(repoFile(`${PKG}/Package.swift`), 'utf8');

describe('iosTrainingDecisionSwiftEngine — core-slice surface present', () => {
  // (1)-(3) the three engine source files exist.
  for (const [n, f] of [
    [1, 'TrainingDecisionCoreSliceEngine.swift'],
    [2, 'EffectiveTrainingPhase.swift'],
    [3, 'MesocycleWeekResolver.swift'],
  ] as const) {
    it(`iosTrainingDecisionSwiftEngine (${n}) ${f} exists`, () => {
      expect(existsSync(repoFile(`${SOURCES}/${f}`)), `missing ${f}`).toBe(true);
    });
  }

  // (4) public entry exists.
  it('iosTrainingDecisionSwiftEngine (4) buildTrainingDecisionFromCleanInput entry exists', () => {
    expect(srcText()).toMatch(/public\s+func\s+buildTrainingDecisionFromCleanInput\s*\(/);
  });

  // (5) clean-input factory exists.
  it('iosTrainingDecisionSwiftEngine (5) createCleanTrainingDecisionInput factory exists', () => {
    expect(srcText()).toMatch(/public\s+func\s+createCleanTrainingDecisionInput\s*\(/);
  });

  // Positive: the ported core symbols are present (guard fails if 4B2 drops them).
  it('iosTrainingDecisionSwiftEngine core symbols present (getEffectiveTrainingPhase + sessionIntentFor + narrow result)', () => {
    const src = srcText();
    expect(src).toMatch(/func\s+getEffectiveTrainingPhase\s*\(/);
    expect(src).toMatch(/func\s+sessionIntentFor\s*\(/);
    expect(src).toMatch(/struct\s+TrainingDecisionCoreSlice\b/);
  });
});

describe('iosTrainingDecisionSwiftEngine — clean-input brand lock', () => {
  // (6) CleanTrainingDecisionInput is constructed only via a fileprivate/private
  //     init (no raw-public init), and is NOT Codable (no JSON re-hydration door).
  it('iosTrainingDecisionSwiftEngine (6) CleanTrainingDecisionInput init is fileprivate/private', () => {
    const src = srcText();
    expect(src).toMatch(/public\s+struct\s+CleanTrainingDecisionInput\b/);
    const m = src.match(
      /struct\s+CleanTrainingDecisionInput\b[\s\S]*?\n\s*(public\s+|internal\s+|fileprivate\s+|private\s+)?init\(/,
    );
    expect(m, 'CleanTrainingDecisionInput must declare an init').not.toBeNull();
    const modifier = (m?.[1] ?? '').trim();
    expect(['fileprivate', 'private'], `brand init must be fileprivate/private, got "${modifier}"`).toContain(modifier);
  });

  it('iosTrainingDecisionSwiftEngine (6b) CleanTrainingDecisionInput is not Codable/Decodable', () => {
    const src = srcText();
    expect(src).not.toMatch(/struct\s+CleanTrainingDecisionInput\b[^\n]*:[^\n]*\b(Codable|Decodable|Encodable)\b/);
  });
});

describe('iosTrainingDecisionSwiftEngine — package graph', () => {
  // (7) IronPathTrainingDecision depends on IronPathDataHealth (acyclic).
  it('iosTrainingDecisionSwiftEngine (7) depends on IronPathDataHealth', () => {
    const pkg = pkgText();
    expect(pkg).toMatch(/\.package\(path:\s*"\.\.\/IronPathDataHealth"\)/);
    expect(pkg).toMatch(/\.package\(path:\s*"\.\.\/IronPathDomain"\)/);
    expect(pkg).toMatch(/dependencies:\s*\[[^\]]*"IronPathDataHealth"[^\]]*\]/);
  });

  // (8) IronPathDataHealth must NOT import IronPathTrainingDecision (no cycle).
  it('iosTrainingDecisionSwiftEngine (8) IronPathDataHealth does not import IronPathTrainingDecision', () => {
    for (const f of collectSwift(repoFile(DATAHEALTH))) {
      expect(
        /\bimport\s+IronPathTrainingDecision\b/.test(readFileSync(f, 'utf8')),
        `dependency cycle: ${f} imports IronPathTrainingDecision`,
      ).toBe(false);
    }
  });

  // (7b) no forbidden / remote deps widened.
  it('iosTrainingDecisionSwiftEngine (7b) no forbidden or remote package deps', () => {
    const pkg = pkgText();
    expect(pkg).not.toMatch(/\.package\(\s*url:/);
    for (const forbidden of [
      'IronPathCloudSync', 'IronPathHealthKit', 'IronPathPersistence',
      'IronPathUIKit', 'IronPathBackup', 'IronPathL10n',
    ]) {
      expect(pkg, `must not depend on ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe('iosTrainingDecisionSwiftEngine — forbidden imports + macros', () => {
  const files = () => collectSwift(repoFile(PKG)); // sources + tests
  const forbiddenImports: Array<[number, string, RegExp]> = [
    [9, 'IronPathCloudSync', /\bimport\s+IronPathCloudSync\b/],
    [10, 'HealthKit', /\bimport\s+HealthKit\b/],
    [11, 'IronPathPersistence', /\bimport\s+IronPathPersistence\b/],
    [12, 'SwiftUI/UIKit', /\bimport\s+(SwiftUI|UIKit)\b/],
    [13, 'Supabase/WebKit/BackgroundTasks', /\bimport\s+(Supabase|WebKit|BackgroundTasks)\b/],
  ];
  for (const [n, label, re] of forbiddenImports) {
    it(`iosTrainingDecisionSwiftEngine (${n}) no import ${label}`, () => {
      for (const f of files()) {
        expect(re.test(readFileSync(f, 'utf8')), `${label} imported in ${f}`).toBe(false);
      }
    });
  }

  // (14) No SwiftData/CoreData/@Model/@Observable.
  it('iosTrainingDecisionSwiftEngine (14) no SwiftData/CoreData/@Model/@Observable', () => {
    for (const f of files()) {
      const t = readFileSync(f, 'utf8');
      expect(t).not.toMatch(/\bimport\s+SwiftData\b/);
      expect(t).not.toMatch(/\bimport\s+CoreData\b/);
      expect(t).not.toMatch(/@Model\b/);
      expect(t).not.toMatch(/@Observable\b/);
    }
  });
});

describe('iosTrainingDecisionSwiftEngine — no deferred engine + no raw AppData', () => {
  const src = () => srcText();

  // (15) No AppData mutation; engine never builds a clean view or reads raw history.
  it('iosTrainingDecisionSwiftEngine (15) no AppData mutation / no clean-view construction / no raw history read', () => {
    const s = src();
    expect(s).not.toMatch(/\.history\.append\b/);
    expect(s).not.toMatch(/\bvar\s+appData\b/);
    expect(s).not.toMatch(/\bappData\.\w+\s*=/);
    // The engine RECEIVES a CleanAppDataView; it must never CONSTRUCT one.
    expect(s).not.toMatch(/\bbuildCleanAppDataView\s*\(/);
    expect(s).not.toMatch(/\bprocessIncomingAppData\s*\(/);
    // History must come from the CLEANED projection, never raw.history / appData.history.
    expect(s).not.toMatch(/\.raw\.history\b/);
    expect(s).not.toMatch(/\bappData\.history\b/);
  });

  // (16)-(29) STILL-deferred engine symbols are absent. iOS-4B3 NOTE: readiness +
  // e1RM are now legitimately ported (buildTodayReadiness / mapTodayStatusToReadinessInput
  // / collectPainAreasFromHistory / isE1rmTrendUp / riskLevelFor) — they moved out of
  // this forbidden list and are positively asserted by
  // iosTrainingDecisionReadinessE1RMSliceStaticGuards. buildHealthSummary (the health-
  // summary DELTA) stays deferred. prescription / deload / clamp / modes / lapse /
  // userFacing remain forbidden until iOS-4B4+.
  const forbiddenSymbols: Array<[number, string, RegExp]> = [
    [16, 'applyStatusRules', /\bapplyStatusRules\b/],
    [17, 'buildAdaptiveDeloadDecision', /\bbuildAdaptiveDeloadDecision\b/],
    [18, 'clampMultiplier', /\bclampMultiplier\b/],
    [19, 'volumeModeFor', /\bvolumeModeFor\b/],
    [20, 'intensityModeFor', /\bintensityModeFor\b/],
    [21, 'progressionModeFor', /\bprogressionModeFor\b/],
    [22, 'roleOf', /\bfunc\s+roleOf\b/],
    [23, 'buildTrainingLapseSignal', /\bbuildTrainingLapseSignal\b/],
    [24, 'buildHealthSummary', /\bbuildHealthSummary\b/],
    [25, 'buildXxxUserFacing', /\bbuild(Today|Plan|Training|Focus|Progress|Record|Explanation)UserFacing\b/],
  ];
  for (const [n, label, re] of forbiddenSymbols) {
    it(`iosTrainingDecisionSwiftEngine (${n}) no ${label}`, () => {
      expect(src(), `${label} (deferred engine) must not appear in the core slice`).not.toMatch(re);
    });
  }
});

describe('iosTrainingDecisionSwiftEngine — readiness wired + scope honesty', () => {
  // iOS-4B3: readiness + e1RM are now WIRED (no longer hard-wired false). The
  // engine computes recoveryHigh from readiness.level and e1rmTrendUp from the port.
  it('iosTrainingDecisionSwiftEngine readiness + e1RM are wired (not hard-coded false)', () => {
    const s = srcText();
    expect(s).toMatch(/recoveryHigh\s*=\s*readiness\.level\s*==\s*\.low/);
    expect(s).toMatch(/e1rmTrendUp\s*=\s*TrainingDecisionE1RMTrend\.isE1rmTrendUp/);
    // The 4B2 hard-wired-false constants are gone.
    expect(s).not.toMatch(/let\s+e1rmTrendUp\s*=\s*false/);
    expect(s).not.toMatch(/let\s+recoveryHigh\s*=\s*false/);
  });

  // (30) controlled-reload is RESOLVED in iOS-4B3 (no longer deferred): the parity
  // test asserts it matches the golden, and the 4B3 design doc records the unlock.
  it('iosTrainingDecisionSwiftEngine (30) controlled-reload resolved in iOS-4B3', () => {
    const tests = testText();
    expect(tests).toMatch(/controlled-reload|controlledReload/);
    // The parity test no longer carries a deferred/normal-session exception for it.
    expect(tests).not.toMatch(/controlled-reload computes normal-session/);
    const doc = repoFile('docs/ios-native-migration/IOS_4B3_READINESS_E1RM_SLICE_V1.md');
    expect(existsSync(doc), 'iOS-4B3 design doc must exist').toBe(true);
    const docText = readFileSync(doc, 'utf8');
    expect(docText).toMatch(/controlled-reload/);
  });

  // (31) 4B2 makes NO full-object TrainingDecision parity claim: the entry returns
  //      the NARROW TrainingDecisionCoreSlice, not a full TrainingDecision.
  it('iosTrainingDecisionSwiftEngine (31) entry returns narrow TrainingDecisionCoreSlice (no full-object parity)', () => {
    const s = srcText();
    expect(s).toMatch(/func\s+buildTrainingDecisionFromCleanInput[\s\S]*?->\s*TrainingDecisionCoreSlice\b/);
    // The entry must NOT return a full `TrainingDecision`.
    expect(s).not.toMatch(/func\s+buildTrainingDecisionFromCleanInput[\s\S]*?->\s*TrainingDecision\b(?!CoreSlice)/);
  });

  // Parity test asserts the field-subset over the 9 expanded goldens.
  it('iosTrainingDecisionSwiftEngine parity test references the 9 expanded goldens + field subset', () => {
    const tests = testText();
    expect(tests).toMatch(/expandedIds/);
    expect(tests).toMatch(/effectivePhase/);
    expect(tests).toMatch(/sessionIntent/);
  });
});

describe('iosTrainingDecisionSwiftEngine — repo hygiene', () => {
  // (32a) no pnpm-lock.yaml.
  it('iosTrainingDecisionSwiftEngine (32a) no pnpm-lock.yaml', () => {
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
  });

  // (32b) the 10 training-decision goldens are intact (4B2 changes no fixture).
  it('iosTrainingDecisionSwiftEngine (32b) training-decision goldens unchanged (10 files)', () => {
    const goldens = readdirSync(repoFile('tests/fixtures/parity/golden/training-decision'))
      .filter((f) => f.endsWith('.json'));
    expect(goldens.length).toBe(10);
  });
});
