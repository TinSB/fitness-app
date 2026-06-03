import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-12 Native Local Restore + History + Testability Mega Bundle V1 — guards.
//
// Locks the testability extraction + restore-fidelity product loop:
//   • The pure snapshot model / validation / migration / stats / store + a new
//     restore-to-draft planner were extracted into a real local Swift package
//     (IronPathLocalSnapshot) that carries REAL XCTest unit tests (swift test).
//   • The app target depends on the package (pbxproj) and imports it.
//   • Restore-to-draft uses the pure planner; restore FAILURE leaves the current
//     session untouched (no fake restore). v1/v2 compatibility + migration kept.
//   • Local-only: no Cloud/HealthKit/Supabase/network/WebKit/CloudKit-iCloud/
//     UserDefaults/SQLite-CoreData-SwiftData; no AppData mutation; no raw AppData
//     restore into TrainingDecision; full AppData restore stays deferred.
//   • No TS runtime / golden / npm package change. iOS-4B6 stays deferred.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const repoFile = (p: string): string => resolve(repoRoot, p);

const PKG_ROOT = 'ios/packages/IronPathLocalSnapshot';
const PKG_SRC = `${PKG_ROOT}/Sources/IronPathLocalSnapshot`;
const PKG_TESTS = `${PKG_ROOT}/Tests/IronPathLocalSnapshotTests`;
const APP_DIR = 'ios/IronPath';

const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const read = (p: string): string => readFileSync(repoFile(p), 'utf8');
const pkgSrc = (name: string): string => stripSwiftComments(read(`${PKG_SRC}/${name}`));
const appSrc = (name: string): string => stripSwiftComments(read(`${APP_DIR}/${name}`));

// Package source files (pure, IO-confined) + the app files that consume them.
const PKG_FILES = [
  'LocalCompletedSessionSnapshot.swift', 'LocalSnapshotValidation.swift',
  'LocalSnapshotMigration.swift', 'LocalSnapshotStats.swift',
  'LocalSessionSnapshotStore.swift', 'LocalDraftRestore.swift',
];
const APP_PERSISTENCE_FILES = [
  'FocusModeMvpState.swift', 'FocusSavedSessionHistoryView.swift', 'FocusSavedSessionDetailView.swift',
];
const allLocalCode = (): string =>
  PKG_FILES.map(pkgSrc).join('\n') + '\n' + APP_PERSISTENCE_FILES.map(appSrc).join('\n');

const TEST_FILE = `${PKG_TESTS}/IronPathLocalSnapshotTests.swift`;
const DOC_PATH = 'docs/ios-native-migration/IOS_12_NATIVE_LOCAL_RESTORE_HISTORY_TESTABILITY_MEGA_BUNDLE_V1.md';
const docText = (): string => read(DOC_PATH);

// ---- 1-3. Real testability structure ----

describe('iOS-12 real Swift testability', () => {
  it('1. IronPathLocalSnapshot package exists with a library + test target', () => {
    expect(existsSync(repoFile(`${PKG_ROOT}/Package.swift`))).toBe(true);
    const pkg = read(`${PKG_ROOT}/Package.swift`);
    expect(pkg).toMatch(/name:\s*"IronPathLocalSnapshot"/);
    expect(pkg).toMatch(/\.library\(name:\s*"IronPathLocalSnapshot"/);
    expect(pkg).toMatch(/\.testTarget\(\s*\n?\s*name:\s*"IronPathLocalSnapshotTests"/);
  });

  it('2. a REAL XCTest file exists with @testable import and many test methods', () => {
    expect(existsSync(repoFile(TEST_FILE))).toBe(true);
    const t = read(TEST_FILE);
    expect(t).toMatch(/import\s+XCTest/);
    expect(t).toMatch(/@testable\s+import\s+IronPathLocalSnapshot/);
    const testMethods = (t.match(/func\s+test[A-Za-z0-9_]*\s*\(/g) || []).length;
    expect(testMethods).toBeGreaterThanOrEqual(15);
  });

  it('3. tests cover round-trip / validation / migration / restore / stats / store', () => {
    const t = read(TEST_FILE);
    expect(t).toMatch(/RoundTrip/i);                 // encode/decode round trip
    expect(t).toMatch(/Migrat/i);                    // migration
    expect(t).toMatch(/DoesNotMutateSource/);        // migration non-destructive
    expect(t).toMatch(/FutureVersionNotDowngraded/); // unsupported future rejection
    expect(t).toMatch(/RestorePlan/);                // restore-to-draft mapping
    expect(t).toMatch(/Order/);                      // exercise order preservation
    expect(t).toMatch(/Stats/);                      // stats derivation
    expect(t).toMatch(/Corrupt/);                    // corrupt handling
    expect(t).toMatch(/Appends/);                    // complete creates NEW snapshot
  });
});

// ---- 4-6. Extracted pure logic + app wiring ----

describe('iOS-12 extraction + wiring', () => {
  it('4. the pure logic lives in the package and is public', () => {
    for (const f of PKG_FILES) expect(existsSync(repoFile(`${PKG_SRC}/${f}`))).toBe(true);
    expect(pkgSrc('LocalCompletedSessionSnapshot.swift')).toMatch(/public\s+struct\s+LocalCompletedSessionSnapshot/);
    expect(pkgSrc('LocalSessionSnapshotStore.swift')).toMatch(/public\s+struct\s+LocalSessionSnapshotStore/);
    expect(pkgSrc('LocalDraftRestore.swift')).toMatch(/public\s+enum\s+LocalDraftRestorePlanner/);
  });

  it('5. the app imports the package and no longer holds the moved files', () => {
    expect(appSrc('FocusModeMvpState.swift')).toMatch(/^\s*import\s+IronPathLocalSnapshot\b/m);
    // the moved files must not still exist under the app target
    for (const f of ['LocalCompletedSessionSnapshot.swift', 'LocalSessionSnapshotStore.swift', 'LocalSnapshotMigration.swift']) {
      expect(existsSync(repoFile(`${APP_DIR}/${f}`)), `${f} should have moved out of the app target`).toBe(false);
    }
  });

  it('6. the Xcode project references the package as a local dependency', () => {
    const pbx = read('ios/IronPath.xcodeproj/project.pbxproj');
    expect(pbx).toMatch(/XCLocalSwiftPackageReference "packages\/IronPathLocalSnapshot"/);
    expect(pbx).toMatch(/relativePath = packages\/IronPathLocalSnapshot;/);
    expect(pbx).toMatch(/productName = IronPathLocalSnapshot;/);
  });
});

// ---- 7-9. Restore fidelity + v1/v2 compat + no fake success ----

describe('iOS-12 restore fidelity + compatibility + honesty', () => {
  it('7. restore-to-draft planner preserves order + counts + clamps cursor + rejects impossible', () => {
    const r = pkgSrc('LocalDraftRestore.swift');
    expect(r).toMatch(/orderedExerciseIds/);
    expect(r).toMatch(/completedSetsByExerciseId/);
    expect(r).toMatch(/resumeExerciseIndex/);
    expect(r).toMatch(/case\s+impossibleProgress/);
    expect(r).toMatch(/case\s+emptyExercises/);
    // pure — no disk
    expect(r).not.toMatch(/\bFileManager\b/);
  });

  it('8. v1/v2 compatibility + forward migration remain', () => {
    // iOS-17A widened the accepted set to [1, 2, 3] (v3 adds the per-set `setLogs`
    // display copy); v1/v2 stay accepted and migrate forward — the compatibility +
    // forward-migration contract this guard locks is unchanged.
    expect(pkgSrc('LocalSnapshotValidation.swift')).toMatch(/acceptedSchemaVersions\s*:\s*Set<Int>\s*=\s*\[\s*1\s*,\s*2\s*,\s*3\s*\]/);
    expect(pkgSrc('LocalSnapshotMigration.swift')).toMatch(/func\s+migrate\s*\(/);
    expect(pkgSrc('LocalSnapshotMigration.swift')).toMatch(/original\s*<\s*minimumSupportedVersion/);
  });

  it('9. restore failure cannot show fake success / mutate the current session', () => {
    const s = appSrc('FocusModeMvpState.swift');
    // unknown scenario returns before mutating stage
    expect(s).toMatch(/guard\s+let\s+scenario\s*=\s*FocusModeSampleScenario[\s\S]*?restoreStatus\s*=\s*\.failed[\s\S]*?return/);
    // a planner failure sets .failed and returns (no stage mutation before it)
    expect(s).toMatch(/case\s+\.failure[\s\S]*?restoreStatus\s*=\s*\.failed[\s\S]*?return/);
    expect(s).toMatch(/restoreStatus\s*=\s*\.failed\s*\((?:(?!stage\s*=)[\s\S])*?return/);
  });
});

// ---- 10-12. Local-only safety bans ----

describe('iOS-12 local-only safety boundaries', () => {
  const code = allLocalCode();

  it('10. no Cloud / CloudKit / iCloud / CloudSync / HealthKit / Supabase / network / WebKit', () => {
    expect(code).not.toMatch(/^\s*import\s+HealthKit\b/m);
    expect(code).not.toMatch(/^\s*import\s+IronPathCloudSync\b/m);
    expect(code).not.toMatch(/^\s*import\s+Supabase\w*\b/m);
    expect(code).not.toMatch(/^\s*import\s+CloudKit\b/m);
    expect(code).not.toMatch(/^\s*import\s+WebKit\b/m);
    expect(code).not.toMatch(/\bURLSession\b/);
    expect(code).not.toMatch(/\bWKWebView\b/);
    expect(code).not.toMatch(/\biCloud\b/);
    expect(code).not.toMatch(/ubiquit/i);
  });

  it('11. no UserDefaults / SQLite / CoreData / SwiftData', () => {
    expect(code).not.toMatch(/\bUserDefaults\b/);
    expect(code).not.toMatch(/^\s*import\s+SQLite3?\b/m);
    expect(code).not.toMatch(/\bsqlite3_/);
    expect(code).not.toMatch(/^\s*import\s+CoreData\b/m);
    expect(code).not.toMatch(/\bNSManagedObject\b/);
    expect(code).not.toMatch(/^\s*import\s+SwiftData\b/m);
    expect(code).not.toMatch(/@Model\b/);
  });

  it('12. no destructive AppData mutation + no raw AppData restore into TrainingDecision', () => {
    expect(code).not.toMatch(/\bAppData\b/);
    expect(code).not.toMatch(/buildTrainingDecisionFromCleanInput\s*\(/);
    expect(code).not.toMatch(/createCleanTrainingDecisionInput\s*\(/);
    expect(code).not.toMatch(/buildCleanAppDataView\s*\(/);
  });
});

// ---- 13. No TS runtime reference in the local code ----

describe('iOS-12 no TS/JS runtime reference', () => {
  it('13. no node_modules / .ts / .js path strings in the local Swift code', () => {
    const code = allLocalCode();
    expect(code).not.toMatch(/\bnode_modules\b/);
    expect(code).not.toMatch(/[`"'][^`"'\n]*\.(ts|tsx|js|mjs|cjs)[`"']/);
  });
});

// ---- 14-15. Golden / npm package / lockfile invariance ----

const resolveBaseRef = (): string => {
  const have = spawnSync('git', ['rev-parse', '--verify', '-q', 'origin/main'], {
    cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8',
  });
  if (have.status === 0) return 'origin/main';
  const fetched = spawnSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', 'main'], {
    cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8',
  });
  if (fetched.status !== 0) throw new Error(`cannot resolve base ref: ${fetched.stderr}`);
  return 'FETCH_HEAD';
};
const changedFiles = (paths: string[]): string => {
  const base = resolveBaseRef();
  // SR-0: --diff-filter=MD ignores pure ADDITIONS (additive parity fixtures are
  // sanctioned per master-architecture §22) and catches only modify/delete of
  // existing tracked files — so a fixture-ADDING parity slice stays green while
  // any drift/deletion of an existing golden is still flagged.
  const r = spawnSync('git', ['diff', '--name-only', '--diff-filter=MD', base, '--', ...paths], {
    cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`git diff against ${base} failed: ${r.stderr}`);
  return r.stdout.trim();
};

describe('iOS-12 golden + npm package/lockfile unchanged', () => {
  it('14. parity --check still 57 fixtures / 0 changed; no golden file changed', () => {
    const result = spawnSync(
      process.execPath,
      [repoFile('scripts/generate-parity-goldens.mjs'), '--check'],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    expect(result.status, `stderr: ${result.stderr}\nstdout: ${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/checked\s+66\s+fixture/);
    expect(result.stdout).toMatch(/0\s+changed/);
    expect(changedFiles(['tests/fixtures/parity'])).toBe('');
  }, 240_000);

  it('15. package.json + package-lock.json byte-identical to main; no pnpm/yarn lock', () => {
    expect(changedFiles(['package.json'])).toBe('');
    expect(changedFiles(['package-lock.json'])).toBe('');
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
    expect(existsSync(repoFile('yarn.lock'))).toBe(false);
  });
});

// ---- 16-17. Docs: full AppData restore deferred + iOS-4B6 deferred ----

describe('iOS-12 docs', () => {
  it('16. doc exists with Simulator smoke + full-AppData-restore-deferred (DataHealth gate)', () => {
    expect(existsSync(repoFile(DOC_PATH))).toBe(true);
    const doc = docText();
    expect(doc).toMatch(/[Ss]imulator smoke/);
    expect(doc).toMatch(/buildCleanAppDataView/);
    expect(doc).toMatch(/defer/i);
  });
  it('17. doc records iOS-4B6 remains deferred', () => {
    expect(docText()).toMatch(/4B6/);
  });
});
