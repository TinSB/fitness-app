import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-4B1 TrainingDecision Swift Type Skeleton V1 — static guards.
//
// Locks the iOS-4B1 surface: a NEW IronPathTrainingDecision package that holds
// ONLY the Codable-style golden type skeleton (init(decoding:)+encoded()),
// decoding the 10 training-decision goldens. NO engine logic, NO AppData
// read/mutate, NO Cloud/HealthKit/UI/Supabase, local-deps only, no lockfile
// churn. The 21 numbered assertions map 1:1 to the iOS-4B1 task brief Phase 6.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const PKG = 'ios/packages/IronPathTrainingDecision';
const SOURCES = `${PKG}/Sources/IronPathTrainingDecision`;
const TESTS = `${PKG}/Tests/IronPathTrainingDecisionTests`;

const repoFile = (p: string) => resolve(repoRoot, p);
const read = (p: string) => readFileSync(repoFile(p), 'utf8');

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

const sourceText = (): string =>
  collectSwift(repoFile(SOURCES)).map((f) => readFileSync(f, 'utf8')).join('\n');

describe('iosTrainingDecisionTypeSkeleton — package + structure', () => {
  // (1) the package exists.
  it('iosTrainingDecisionTypeSkeleton (1) IronPathTrainingDecision package exists', () => {
    expect(existsSync(repoFile(PKG))).toBe(true);
    expect(existsSync(repoFile(`${PKG}/Package.swift`))).toBe(true);
  });

  const pkg = () => read(`${PKG}/Package.swift`);

  // (2) Package.swift has only local dependencies.
  it('iosTrainingDecisionTypeSkeleton (2) Package.swift uses only local-path deps', () => {
    expect(pkg()).toMatch(/\.package\(path:\s*"\.\.\/IronPathDomain"\)/);
    const localDeps = pkg().match(/\.package\(\s*path:/g) ?? [];
    expect(localDeps.length).toBeGreaterThanOrEqual(1);
  });

  // (3) Package.swift has no remote URL dependency.
  it('iosTrainingDecisionTypeSkeleton (3) Package.swift has no remote URL dep', () => {
    expect(pkg()).not.toMatch(/\.package\(\s*url:/);
  });

  // (4) Package does not depend on CloudSync/HealthKit/Persistence/UIKit.
  it('iosTrainingDecisionTypeSkeleton (4) no forbidden package deps', () => {
    for (const forbidden of [
      'IronPathCloudSync', 'IronPathHealthKit', 'IronPathPersistence',
      'IronPathUIKit', 'IronPathBackup', 'IronPathL10n',
    ]) {
      expect(pkg(), `Package.swift must not depend on ${forbidden}`).not.toContain(forbidden);
    }
  });

  // (5) TrainingDecision type files exist.
  it('iosTrainingDecisionTypeSkeleton (5) core type files exist', () => {
    for (const f of [
      'TrainingDecision.swift',
      'TrainingDecisionSurfaces.swift',
      'TrainingDecisionHiddenDebug.swift',
      'TrainingDecisionArbitrationTrace.swift',
      'TrainingDecisionEnums.swift',
    ]) {
      expect(existsSync(repoFile(`${SOURCES}/${f}`)), `missing ${f}`).toBe(true);
    }
  });

  // (6) Swift tests exist.
  it('iosTrainingDecisionTypeSkeleton (6) Swift decode tests exist', () => {
    for (const f of [
      'TrainingDecisionGoldenDecodeTests.swift',
      'TrainingDecisionUserFacingDecodeTests.swift',
      'TrainingDecisionHiddenDebugDecodeTests.swift',
      'TrainingDecisionShapeStabilityTests.swift',
    ]) {
      expect(existsSync(repoFile(`${TESTS}/${f}`)), `missing test ${f}`).toBe(true);
    }
  });

  // (7) All 10 training-decision golden fixture ids are referenced by tests.
  it('iosTrainingDecisionTypeSkeleton (7) all 10 golden ids referenced by tests', () => {
    const testText = collectSwift(repoFile(TESTS)).map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const id of [
      'normal-session-v1', 'severe-rest-v1', 'controlled-reload-v1', 'deload-week-v1',
      'stale-today-status-v1', 'stale-health-data-v1', 'restart-28d-gap-v1',
      'productive-floor-v1', 'no-legacy-advice-v1', 'clean-input-contract-v1',
    ]) {
      expect(testText, `golden id ${id} not referenced by tests`).toContain(id);
    }
  });
});

describe('iosTrainingDecisionTypeSkeleton — NO deferred engine logic', () => {
  // iOS-4B2/4B3 evolution: the effectivePhase + sessionIntent core slice + entry
  // (4B2) and the readiness + e1RM slice (4B3) now LIVE in this package (locked by
  // iosTrainingDecisionSwiftEngineStaticGuards + iosTrainingDecisionReadinessE1RMSliceStaticGuards).
  // So the former (9) effectiveTrainingPhase and (12) readinessEngine bans are
  // removed here. (8) still forbids a BARE `func buildTrainingDecision` (the only
  // sanctioned entry is the branded FromCleanInput wrapper), and (10)/(11) keep the
  // still-deferred engines (prescription / supportPlan) out — those land in iOS-4B5/4B4.
  const src = sourceText();
  const engineFns: Array<[number, string, RegExp]> = [
    [8, 'buildTrainingDecision', /func\s+buildTrainingDecision\b/],
    [10, 'exercisePrescription', /func\s+(apply|prescribe)\w*(Prescription|StatusRules)\b/],
    [11, 'supportPlan', /func\s+build\w*Support\w*Plan\b/],
  ];
  for (const [n, label, re] of engineFns) {
    it(`iosTrainingDecisionTypeSkeleton (${n}) no ${label} implementation`, () => {
      expect(src, `${label} engine function found in type skeleton`).not.toMatch(re);
    });
  }

  // No buildTrainingDecision file at all.
  it('iosTrainingDecisionTypeSkeleton (8b) no buildTrainingDecision.swift file', () => {
    expect(existsSync(repoFile(`${SOURCES}/buildTrainingDecision.swift`))).toBe(false);
    expect(existsSync(repoFile(`${SOURCES}/TrainingDecisionEngine.swift`))).toBe(false);
  });
});

describe('iosTrainingDecisionTypeSkeleton — forbidden imports + macros', () => {
  const files = collectSwift(repoFile(PKG)); // sources + tests
  const forbidden: Array<[number, string, RegExp]> = [
    [13, 'SwiftUI', /\bimport\s+SwiftUI\b/],
    [14, 'HealthKit', /\bimport\s+HealthKit\b/],
    [15, 'Supabase', /\bimport\s+Supabase\b/],
    [16, 'WebKit', /\bimport\s+WebKit\b/],
    [17, 'BackgroundTasks', /\bimport\s+BackgroundTasks\b/],
  ];
  for (const [n, label, re] of forbidden) {
    it(`iosTrainingDecisionTypeSkeleton (${n}) no import ${label}`, () => {
      for (const f of files) {
        expect(re.test(readFileSync(f, 'utf8')), `${label} imported in ${f}`).toBe(false);
      }
    });
  }

  // (18) No SwiftData/CoreData/@Model/@Observable.
  it('iosTrainingDecisionTypeSkeleton (18) no SwiftData/CoreData/@Model/@Observable', () => {
    for (const f of files) {
      const t = readFileSync(f, 'utf8');
      expect(t).not.toMatch(/\bimport\s+SwiftData\b/);
      expect(t).not.toMatch(/\bimport\s+CoreData\b/);
      expect(t).not.toMatch(/@Model\b/);
      expect(t).not.toMatch(/@Observable\b/);
    }
  });

  // (19) No AppData mutation helpers. iOS-4B2 evolution: `import IronPathDataHealth`
  // is now ALLOWED (the engine consumes CleanAppDataView via the clean-input
  // factory) — the ban moved to iosTrainingDecisionSwiftEngineStaticguards, which
  // forbids the engine from CONSTRUCTING a clean view (buildCleanAppDataView) or
  // reading raw AppData fields. The AppData-mutation greps stay: 4B2 reads the
  // cleaned projection and never writes AppData.
  it('iosTrainingDecisionTypeSkeleton (19) no AppData mutation helpers', () => {
    const src = sourceText();
    expect(src).not.toMatch(/\.history\.append\b/);
    expect(src).not.toMatch(/\bvar\s+appData\b/);
    expect(src).not.toMatch(/\bappData\.\w+\s*=/);
  });
});

describe('iosTrainingDecisionTypeSkeleton — repo hygiene', () => {
  // (20) No package/lockfile changes.
  it('iosTrainingDecisionTypeSkeleton (20) no pnpm-lock.yaml', () => {
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
  });

  // (21) Existing 24 parity fixtures still pass --check (golden ids intact).
  it('iosTrainingDecisionTypeSkeleton (21) 14 training+other golden fixtures intact', () => {
    const tdGoldens = readdirSync(repoFile('tests/fixtures/parity/golden/training-decision'))
      .filter((f) => f.endsWith('.json'));
    expect(tdGoldens.length).toBe(10); // 1 iOS-0 + 9 iOS-4B0
    // The other 4 iOS-0 fixtures still present.
    for (const p of [
      'tests/fixtures/parity/golden/app-data/snapshot-hash-stable-v1.json',
      'tests/fixtures/parity/golden/data-repair/session-lifecycle-residue-v1.json',
      'tests/fixtures/parity/golden/real-export/redacted-2026-05-27.json',
      'tests/fixtures/parity/golden/focus-mode/golden-path-session-v1.json',
    ]) {
      expect(existsSync(repoFile(p)), `missing ${p}`).toBe(true);
    }
  });
});
