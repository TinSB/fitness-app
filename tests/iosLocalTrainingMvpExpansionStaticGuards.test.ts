import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-11 Native Local Training MVP Expansion V1 — static guards.
//
// Locks the iOS-11 expansion of the iOS-9/10 local snapshot store:
//   • Schema v2 (adds optional resumeExerciseIndex) + a pure forward migration
//     (v1 -> current) applied on decode; acceptedSchemaVersions = [1, 2].
//   • Restore-to-local-draft + continue a saved session (in-RAM only, scenario
//     regenerated deterministically — NOT an AppData restore, never feeds
//     TrainingDecision raw).
//   • Version/migration diagnostics surfaced locally; honest restore failure
//     (unknown scenario) with NO fake restore.
//
// Pure logic (model/validation/migration/stats) stays IO-free; all disk IO is
// still confined to the one sanctioned store file. No Cloud/HealthKit/Supabase/
// network/WebKit/CloudKit-iCloud/UserDefaults/SQLite-CoreData-SwiftData, no
// AppData mutation, no raw AppData restore into TrainingDecision, no parity-
// golden change, no package change. iOS-4B6 stays deferred.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const repoFile = (p: string): string => resolve(repoRoot, p);

const APP_DIR = 'ios/IronPath';

const MODEL_FILE = 'LocalCompletedSessionSnapshot.swift';
const MIGRATION_FILE = 'LocalSnapshotMigration.swift';
const VALIDATION_FILE = 'LocalSnapshotValidation.swift';
const STATS_FILE = 'LocalSnapshotStats.swift';
const STORE_FILE = 'LocalSessionSnapshotStore.swift';
const STATE_FILE = 'FocusModeMvpState.swift';
const HISTORY_FILE = 'FocusSavedSessionHistoryView.swift';
const DETAIL_FILE = 'FocusSavedSessionDetailView.swift';
const SHELL_FILE = 'FocusModeShellView.swift';

// iOS-11 persistence / restore Swift files the forbidden-API bans apply to.
const PERSISTENCE_FILES = [
  MODEL_FILE, MIGRATION_FILE, VALIDATION_FILE, STATS_FILE, STORE_FILE,
  STATE_FILE, HISTORY_FILE, DETAIL_FILE, SHELL_FILE,
];
// Restore/persistence files that must never feed TrainingDecision raw / build AppData.
const RESTORE_FILES = [
  MODEL_FILE, MIGRATION_FILE, VALIDATION_FILE, STATS_FILE, STORE_FILE,
  STATE_FILE, HISTORY_FILE, DETAIL_FILE,
];

const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
// iOS-12: pure snapshot/store files were extracted to the IronPathLocalSnapshot
// Swift package (real unit tests). Resolve them from the package source dir;
// presentation files stay under the app target.
const PKG_DIR = 'ios/packages/IronPathLocalSnapshot/Sources/IronPathLocalSnapshot';
const MOVED_TO_PACKAGE = new Set([
  'LocalCompletedSessionSnapshot.swift', 'LocalSessionSnapshotStore.swift',
  'LocalSnapshotValidation.swift', 'LocalSnapshotStats.swift', 'LocalSnapshotMigration.swift',
]);
const appPath = (name: string): string =>
  repoFile(`${MOVED_TO_PACKAGE.has(name) ? PKG_DIR : APP_DIR}/${name}`);
const appExists = (name: string): boolean => existsSync(appPath(name));
const appCode = (name: string): string => stripSwiftComments(readFileSync(appPath(name), 'utf8'));
const joinCode = (names: string[]): string => names.filter(appExists).map(appCode).join('\n');

const DOC_PATH = 'docs/ios-native-migration/IOS_11_NATIVE_LOCAL_TRAINING_MVP_EXPANSION_V1.md';
const docText = (): string => readFileSync(repoFile(DOC_PATH), 'utf8');

// ---- 1-3. Schema v2 ----

describe('iOS-11 schema v2', () => {
  it('1. model schema version bumped to 2', () => {
    // iOS-17A bumped the snapshot schema to v3 (adds the derived per-set `setLogs`
    // display copy) with a v1/v2 forward migration; v2 stays accepted + migratable.
    expect(appCode(MODEL_FILE)).toMatch(/currentSchemaVersion\s*=\s*3/);
  });
  it('2. model adds optional resumeExerciseIndex (v2 resume cursor)', () => {
    expect(appCode(MODEL_FILE)).toMatch(/let\s+resumeExerciseIndex\s*:\s*Int\?/);
  });
  it('3. validator accepts schema versions [1, 2]', () => {
    // iOS-17A: accepted set widened to [1, 2, 3] (v3 adds per-set `setLogs`); v1/v2
    // stay accepted + migrate forward.
    expect(appCode(VALIDATION_FILE)).toMatch(/acceptedSchemaVersions\s*:\s*Set<Int>\s*=\s*\[\s*1\s*,\s*2\s*,\s*3\s*\]/);
  });
});

// ---- 4-6. Migration ----

describe('iOS-11 forward migration', () => {
  const m = (): string => appCode(MIGRATION_FILE);

  it('4. migration layer exists with a forward migrate()', () => {
    expect(appExists(MIGRATION_FILE)).toBe(true);
    expect(m()).toMatch(/enum\s+LocalSnapshotMigration/);
    expect(m()).toMatch(/func\s+migrate\s*\(/);
    expect(m()).toMatch(/struct\s+LocalSnapshotMigrationResult/);
  });
  it('5. migration is pure (no disk / FileManager)', () => {
    const code = m();
    expect(code).not.toMatch(/\bFileManager\b/);
    expect(code).not.toMatch(/\.write\s*\(\s*to:/);
    expect(code).not.toMatch(/Data\s*\(\s*contentsOf:/);
  });
  it('6. migration is forward-only + non-destructive (reports didMigrate / future-version unsupported)', () => {
    const code = m();
    expect(code).toMatch(/didMigrate/);
    expect(code).toMatch(/originalSchemaVersion/);
    expect(code).toMatch(/isUnsupportedFutureVersion/);
    // a newer-than-current file is returned unchanged, not downgraded
    expect(code).toMatch(/original\s*>\s*currentVersion/);
    expect(code).toMatch(/upgraded\s*\(\s*to:/);
    // a below-minimum (corrupt/pre-v1) file is NOT promoted — it's rejected
    expect(code).toMatch(/original\s*<\s*minimumSupportedVersion/);
  });
});

// ---- 7-9. Store applies migration + diagnostics ----

describe('iOS-11 store migration + version diagnostics', () => {
  const s = (): string => appCode(STORE_FILE);

  it('7. store decode applies migration', () => {
    expect(s()).toMatch(/func\s+decodeMigrated\s*\(/);
    expect(s()).toMatch(/LocalSnapshotMigration\.migrate\s*\(/);
  });
  it('8. scan tracks migratedCount + per-version counts', () => {
    const code = s();
    expect(code).toMatch(/migratedCount/);
    expect(code).toMatch(/versionCounts/);
    expect(code).toMatch(/originalSchemaVersion/);
  });
  it('9. diagnostics expose migrated + schema v1/v2 counts (store + UI)', () => {
    const code = s();
    expect(code).toMatch(/schemaV1Count/);
    expect(code).toMatch(/schemaV2Count/);
    expect(code).toMatch(/migratedCount/);
    // surfaced in the history diagnostics section
    expect(appCode(HISTORY_FILE)).toMatch(/schema v1 .*v2 .*已迁移/);
  });
});

// ---- 10. Validator resume-index rule ----

describe('iOS-11 validator resume-index rule', () => {
  it('10. invalidResumeIndex rejects an out-of-range resume cursor', () => {
    const v = appCode(VALIDATION_FILE);
    expect(v).toMatch(/case\s+invalidResumeIndex/);
    expect(v).toMatch(/resumeExerciseIndex[\s\S]*?(>=|>)\s*snapshot\.exercises\.count|resume\s*<\s*0/);
  });
});

// ---- 11-13. Restore-to-draft / continue / no-fake-success / not-AppData ----

describe('iOS-11 restore-to-local-draft', () => {
  const st = (): string => appCode(STATE_FILE);

  it('11. state restoreDraft maps scenario + completed sets + resume cursor into an in-session draft', () => {
    const code = st();
    expect(code).toMatch(/func\s+restoreDraft\s*\(/);
    expect(code).toMatch(/FocusModeSampleScenario\s*\(\s*rawValue:\s*snapshot\.scenarioId\s*\)/);
    // iOS-12: restore fidelity is delegated to the pure LocalDraftRestorePlanner;
    // the state applies the validated plan (order/counts preserved, cursor clamped).
    expect(code).toMatch(/completedSetsByExerciseId\s*=\s*plan\.completedSetsByExerciseId/);
    expect(code).toMatch(/selectedExerciseIndex\s*=\s*plan\.resumeExerciseIndex/);
    expect(code).toMatch(/stage\s*=\s*\.inSession/);
  });
  it('12. restore is NOT an AppData restore and never feeds TrainingDecision raw', () => {
    const code = joinCode(RESTORE_FILES);
    expect(code).not.toMatch(/buildTrainingDecisionFromCleanInput\s*\(/);
    expect(code).not.toMatch(/createCleanTrainingDecisionInput\s*\(/);
    expect(code).not.toMatch(/buildCleanAppDataView\s*\(/);
    expect(code).not.toMatch(/\bAppData\s*\(/);
  });
  it('13. no fake restore on failure (unknown scenario -> .failed, no draft started)', () => {
    const code = st();
    // the guard returns BEFORE touching stage when the scenario is unknown
    expect(code).toMatch(/guard\s+let\s+scenario\s*=\s*FocusModeSampleScenario[\s\S]*?restoreStatus\s*=\s*\.failed/);
    // and NO `stage =` mutation may appear between the .failed( and the return
    // (so the failure path provably starts no draft)
    expect(code).toMatch(/restoreStatus\s*=\s*\.failed\s*\((?:(?!stage\s*=)[\s\S])*?return/);
    expect(code).toMatch(/enum\s+FocusRestoreStatus[\s\S]*?case\s+failed\s*\(\s*String\s*\)/);
  });
});

// ---- 14-16. Continue UI / restored banner / diagnostics surfaced ----

describe('iOS-11 continue UI', () => {
  it('14. detail view offers continue + history wires restoreDraft', () => {
    const d = appCode(DETAIL_FILE);
    expect(d).toMatch(/onContinue/);
    expect(d).toMatch(/继续这次训练/);
    const h = appCode(HISTORY_FILE);
    expect(h).toMatch(/FocusSavedSessionDetailView\s*\(\s*snapshot:/);
    expect(h).toMatch(/state\.restoreDraft\s*\(\s*from:/);
  });
  it('15. in-session shell shows a restored-draft banner', () => {
    const sh = appCode(SHELL_FILE);
    expect(sh).toMatch(/isRestoredDraft/);
    expect(sh).toMatch(/已恢复本机草稿/);
  });
  it('16. restore failure is shown honestly in the history surface', () => {
    expect(appCode(HISTORY_FILE)).toMatch(/case\s+\.failed[\s\S]*?恢复失败|恢复失败/);
  });
});

// ---- 17-19. Forbidden APIs / AppData / TS-JS ----

describe('iOS-11 forbidden cloud / health / network / backends are absent', () => {
  const code = joinCode(PERSISTENCE_FILES);

  it('17a. no HealthKit import', () => {
    expect(code).not.toMatch(/^\s*import\s+HealthKit\b/m);
  });
  it('17b. no IronPathCloudSync import', () => {
    expect(code).not.toMatch(/^\s*import\s+IronPathCloudSync\b/m);
  });
  it('17c. no Supabase import', () => {
    expect(code).not.toMatch(/^\s*import\s+Supabase\w*\b/m);
  });
  it('17d. no URLSession / URLRequest / NSURLSession (network)', () => {
    expect(code).not.toMatch(/\bURLSession\b/);
    expect(code).not.toMatch(/\bURLRequest\b/);
    expect(code).not.toMatch(/\bNSURLSession\b/);
  });
  it('17e. no WebKit / WKWebView', () => {
    expect(code).not.toMatch(/^\s*import\s+WebKit\b/m);
    expect(code).not.toMatch(/\bWKWebView\b/);
  });
  it('17f. no CloudKit / iCloud / ubiquity container', () => {
    expect(code).not.toMatch(/^\s*import\s+CloudKit\b/m);
    expect(code).not.toMatch(/\bCKContainer\b/);
    expect(code).not.toMatch(/\biCloud\b/);
    expect(code).not.toMatch(/ubiquit/i);
    expect(code).not.toMatch(/\bNSUbiquitous/);
  });
  it('17g. no UserDefaults', () => {
    expect(code).not.toMatch(/\bUserDefaults\b/);
  });
  it('17h. no SQLite / CoreData / SwiftData', () => {
    expect(code).not.toMatch(/^\s*import\s+SQLite3?\b/m);
    expect(code).not.toMatch(/\bsqlite3_/);
    expect(code).not.toMatch(/^\s*import\s+CoreData\b/m);
    expect(code).not.toMatch(/\bNSManagedObject\b/);
    expect(code).not.toMatch(/^\s*import\s+SwiftData\b/m);
    expect(code).not.toMatch(/@Model\b/);
  });
  it('18. no destructive AppData mutation (restore files never touch AppData)', () => {
    // iOS-17A: FocusModeMvpState is the authorized initiator of the first native
    // canonical-AppData write path (master §8.1), so the canonical-AppData ban
    // applies to the DERIVED restore/presentation files only — not the view-model,
    // whose canonical access is guarded to go through the sanctioned writer seam.
    const derived = joinCode(RESTORE_FILES.filter((f) => f !== STATE_FILE));
    expect(derived).not.toMatch(/\bAppData\b/);
    expect(derived).not.toMatch(/\bAppDataStore\b/);
    // The view-model reaches canonical AppData ONLY via the sanctioned package seam.
    expect(appCode(STATE_FILE)).toMatch(/\bCanonicalSessionWriter\b/);
  });
  it('19. no TS/JS runtime reference', () => {
    expect(code).not.toMatch(/\bnode_modules\b/);
    expect(code).not.toMatch(/[`"'][^`"'\n]*\.(ts|tsx|js|mjs|cjs)[`"']/);
  });
});

// ---- 20-21. Golden / package invariance ----

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

describe('iOS-11 parity goldens + package/lockfile unchanged', () => {
  it('20. parity --check still 57 fixtures / 0 changed; no golden file changed', () => {
    const result = spawnSync(
      process.execPath,
      [repoFile('scripts/generate-parity-goldens.mjs'), '--check'],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    expect(result.status, `stderr: ${result.stderr}\nstdout: ${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/checked\s+68\s+fixture/);
    expect(result.stdout).toMatch(/0\s+changed/);
    expect(changedFiles(['tests/fixtures/parity'])).toBe('');
  }, 240_000);

  it('21. package.json + package-lock.json byte-identical to main; no pnpm/yarn lock', () => {
    expect(changedFiles(['package.json'])).toBe('');
    expect(changedFiles(['package-lock.json'])).toBe('');
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
    expect(existsSync(repoFile('yarn.lock'))).toBe(false);
  });
});

// ---- 22-23. Docs ----

describe('iOS-11 docs', () => {
  it('22. doc exists with a manual Simulator smoke checklist + DataHealth boundary', () => {
    expect(existsSync(repoFile(DOC_PATH))).toBe(true);
    const doc = docText();
    expect(doc).toMatch(/[Ss]imulator smoke/);
    expect(doc).toMatch(/buildCleanAppDataView/);
  });
  it('23. doc records iOS-4B6 remains deferred', () => {
    const doc = docText();
    expect(doc).toMatch(/4B6/);
    expect(doc).toMatch(/defer/i);
  });
});
