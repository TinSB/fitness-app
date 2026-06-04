import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-10 Local Training Persistence Mega Bundle V1 — static guards.
//
// Locks the iOS-10 hardening of the iOS-9 local JSON persistence: schema-
// versioned validation, defensive decode + corrupt-file skip/quarantine, a
// validated restore/load path with NO fake success, saved-session detail,
// newest-first sort + scenario/completed filters, a derived local stats
// summary, backup-before-overwrite visibility, a LOCAL-ONLY debug-copy export,
// a storage diagnostics surface, and the DataHealth/AppData restore boundary.
//
// All disk IO stays in the one sanctioned store file; validation + stats are
// pure. No Cloud/HealthKit/Supabase/network/WebKit/CloudKit-iCloud/
// UserDefaults/SQLite-CoreData-SwiftData, no AppData mutation, no raw AppData
// restore into TrainingDecision, no parity-golden change, no package change.
// iOS-4B6 stays deferred.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const repoFile = (p: string): string => resolve(repoRoot, p);

const APP_DIR = 'ios/IronPath';

const MODEL_FILE = 'LocalCompletedSessionSnapshot.swift';
const STORE_FILE = 'LocalSessionSnapshotStore.swift';
const VALIDATION_FILE = 'LocalSnapshotValidation.swift';
const STATS_FILE = 'LocalSnapshotStats.swift';
const STATE_FILE = 'FocusModeMvpState.swift';
const HISTORY_FILE = 'FocusSavedSessionHistoryView.swift';
const DETAIL_FILE = 'FocusSavedSessionDetailView.swift';
const PREVIEW_FILE = 'FocusSavedSessionPreviewView.swift';
const SHELL_FILE = 'FocusModeShellView.swift';

// The iOS-10 persistence / restore Swift files the forbidden-API bans apply to.
const PERSISTENCE_FILES = [
  MODEL_FILE, STORE_FILE, VALIDATION_FILE, STATS_FILE, STATE_FILE, HISTORY_FILE, DETAIL_FILE,
];
// The restore/persistence files that must never feed TrainingDecision raw.
const RESTORE_FILES = PERSISTENCE_FILES;

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

const DOC_PATH = 'docs/ios-native-migration/IOS_10_LOCAL_TRAINING_PERSISTENCE_MEGA_BUNDLE_V1.md';
const docText = (): string => readFileSync(repoFile(DOC_PATH), 'utf8');

// ---- 1-6, 8. Schema-versioned validation ----

describe('iOS-10 schema-versioned validation', () => {
  const v = (): string => appCode(VALIDATION_FILE);

  it('1. schemaVersion validation exists', () => {
    expect(appExists(VALIDATION_FILE)).toBe(true);
    expect(v()).toMatch(/acceptedSchemaVersions\.contains\s*\(\s*snapshot\.schemaVersion\s*\)/);
  });
  it('2. accepted schema version list exists (iOS-11: [1, 2])', () => {
    // iOS-11 added schema v2 (resumeExerciseIndex); iOS-17A added v3 (per-set
    // `setLogs` display copy). The accepted set is now [1, 2, 3]; older versions
    // stay accepted + migrate forward.
    expect(v()).toMatch(/acceptedSchemaVersions\s*:\s*Set<Int>\s*=\s*\[\s*1\s*,\s*2\s*,\s*3\s*\]/);
  });
  it('3. unsupported schema version handling exists', () => {
    expect(v()).toMatch(/case\s+unsupportedSchemaVersion\s*\(\s*Int\s*\)/);
    expect(v()).toMatch(/\.unsupportedSchemaVersion\s*\(/);
  });
  it('4. missing/empty snapshotId rejected', () => {
    expect(v()).toMatch(/case\s+emptySnapshotId/);
    expect(v()).toMatch(/snapshot\.snapshotId[\s\S]*?\.isEmpty/);
  });
  it('5. negative set counts rejected (the < 0 check feeds the negativeSetCount append)', () => {
    expect(v()).toMatch(/case\s+negativeSetCount/);
    // tie the comparison to the append so a regression that drops the append
    // (leaving a stray `< 0`) cannot pass this guard
    expect(v()).toMatch(/<\s*0[\s\S]*?issues\.append\s*\(\s*\.negativeSetCount/);
  });
  it('6. completedSets > targetSets rejected', () => {
    expect(v()).toMatch(/case\s+completedExceedsTarget/);
    expect(v()).toMatch(/completedSets\s*>\s*\$0\.targetSets|totalCompletedSets\s*>\s*snapshot\.totalTargetSets/);
  });
  it('8. invalid snapshot result/error type exists', () => {
    expect(v()).toMatch(/enum\s+LocalSnapshotValidationIssue/);
    expect(v()).toMatch(/struct\s+LocalSnapshotValidationResult/);
    expect(v()).toMatch(/var\s+isValid\s*:\s*Bool/);
  });
});

// ---- 7, 9, 10, 11, 12, 19, 20. Store defensive decode / quarantine / scope / backup ----

describe('iOS-10 store defensive decode / quarantine / scope', () => {
  const s = (): string => appCode(STORE_FILE);

  it('7. corrupt JSON handling exists (defensive scan)', () => {
    expect(s()).toMatch(/func\s+scanSnapshots\s*\(/);
    expect(s()).toMatch(/invalidNames/);
  });
  it('9. load/list path does not crash on corrupt files (per-file try?)', () => {
    const code = s();
    // scan + list both decode per-file with try? so one bad file can't throw out
    expect(code).toMatch(/try\?\s*decode\s*\(\s*at:/);
  });
  it('10. invalid/corrupt files are skipped or quarantined', () => {
    const code = s();
    expect(code).toMatch(/func\s+quarantineInvalid\s*\(/);
    expect(code).toMatch(/invalidNames\.append/);
  });
  it('11. quarantine is local-only (in-dir rename under the store prefix, no recursion)', () => {
    const code = s();
    expect(code).toMatch(/quarantinePrefix\s*=\s*"focus-session-quarantine-"/);
    expect(code).toMatch(/moveItem\s*\(\s*at:/);
    // quarantine prefix is a sub-form of the store prefix so clear() still scopes it
    expect(code).toMatch(/static let filePrefix = "focus-session-"/);
  });
  it('12. clear/delete remains scoped to sanctioned snapshot files', () => {
    const code = s();
    expect(code).toMatch(/hasPrefix\s*\(\s*Self\.filePrefix\s*\)/);
    expect(code).not.toMatch(/removeItem\s*\(\s*at:\s*dir\s*\)/);
    // every special filename (backup / quarantine / export) is rooted at the
    // store prefix, so the single hasPrefix(filePrefix) clear gate covers them
    expect(code).toMatch(/latestBackupFilename\s*=\s*"focus-session-/);
    expect(code).toMatch(/quarantinePrefix\s*=\s*"focus-session-/);
    expect(code).toMatch(/exportFilename\s*=\s*"focus-session-/);
  });
  it('19. backup-before-overwrite remains: latest pointer copied to .bak BEFORE overwrite', () => {
    const code = s();
    expect(code).toMatch(/latestBackupFilename/);
    const copyIdx = code.search(/copyItem\s*\(/);
    const latestWriteIdx = code.search(/\.write\s*\(\s*to:\s*latestURL/);
    expect(copyIdx).toBeGreaterThan(-1);
    expect(latestWriteIdx).toBeGreaterThan(-1);
    expect(copyIdx).toBeLessThan(latestWriteIdx);
  });
  it('20. backup / quarantine / export files are NOT normal history rows', () => {
    const code = s();
    // history detection requires digits + .json, so .bak and the quarantine/
    // export prefixes (non-digit after the store prefix) are excluded
    expect(code).toMatch(/hasSuffix\s*\(\s*"\.json"\s*\)/);
    expect(code).toMatch(/allSatisfy\s*\(\s*\\?\.isNumber\s*\)/);
    expect(code).toMatch(/latestBackupFilename\s*=\s*"focus-session-latest\.json\.bak"/);
  });
});

// ---- 13, 16, 17, 18, 21. UI surfaces ----

describe('iOS-10 UI surfaces', () => {
  it('13. restore/load UI shows local validation status or warning', () => {
    const h = appCode(HISTORY_FILE);
    expect(h).toMatch(/已从本机恢复最近一次训练/);
    expect(h).toMatch(/已跳过显示|无法识别的本机存档/);
    // the local-only disclaimer remains
    expect(h).toMatch(/仅保存在本机 · 不同步云端 · 可清除/);
  });
  it('16. saved session detail UI exists and is presented from the history list', () => {
    expect(appExists(DETAIL_FILE)).toBe(true);
    expect(appCode(DETAIL_FILE)).toMatch(/struct\s+FocusSavedSessionDetailView/);
    const h = appCode(HISTORY_FILE);
    expect(h).toMatch(/\.sheet\s*\(\s*item:/);
    expect(h).toMatch(/FocusSavedSessionDetailView\s*\(/);
  });
  it('17. local history newest-first sort exists (+ filters)', () => {
    // store scan sorts by sequence descending (newest first)
    expect(appCode(STORE_FILE)).toMatch(/sequence\(of:\s*lhs\)\s*\?\?\s*-1\)\s*>\s*\(sequence\(of:\s*rhs\)/);
    // and the history view labels the order + offers filters
    const h = appCode(HISTORY_FILE);
    expect(h).toMatch(/最新在前/);
    expect(h).toMatch(/scenarioFilter|completedOnly/);
  });
  it('18. local stats summary exists', () => {
    expect(appExists(STATS_FILE)).toBe(true);
    expect(appCode(STATS_FILE)).toMatch(/struct\s+LocalSnapshotStats/);
    expect(appCode(STATS_FILE)).toMatch(/static\s+func\s+derive\s*\(\s*from/);
    // iOS-14 renamed the summary header (本机统计 → 本机训练小结); accept either.
    expect(appCode(HISTORY_FILE)).toMatch(/本机统计|本机训练小结/);
  });
  it('21. export/debug-copy is local-only (no share sheet / Files / cloud)', () => {
    expect(appCode(STORE_FILE)).toMatch(/func\s+exportLatestDebugCopy\s*\(/);
    expect(appCode(STORE_FILE)).toMatch(/exportFilename\s*=\s*"focus-session-export-latest\.json"/);
    const h = appCode(HISTORY_FILE);
    expect(h).toMatch(/不分享 · 不上传云端|生成本机 JSON 副本/);
    // no share sheet / document picker anywhere in the persistence files
    const code = joinCode(PERSISTENCE_FILES);
    expect(code).not.toMatch(/UIActivityViewController|ShareLink|UIDocumentPickerViewController|fileExporter/);
  });
});

// ---- 14, 15. No fake success ----

describe('iOS-10 no fake success', () => {
  it('14. no fake success on save failure', () => {
    const st = appCode(STATE_FILE);
    expect(st).toMatch(/try\s+snapshotStore\.save\s*\([\s\S]*?saveStatus\s*=\s*\.saved/);
    expect(st).toMatch(/catch\b[\s\S]*?saveStatus\s*=\s*\.failed\s*\(/);
    expect(appCode(STORE_FILE)).toMatch(/func\s+save\s*\([\s\S]*?\)\s+throws\b/);
    // the completed-screen preview header must reflect the REAL save outcome —
    // on failure it must NOT claim "已保存"; it shows a not-saved title instead
    const preview = appCode(PREVIEW_FILE);
    expect(preview).toMatch(/let\s+saved\s*:\s*Bool/);
    expect(preview).toMatch(/saved\s*\?\s*"已保存（本机）"\s*:\s*"未保存到本机"/);
    // the shell passes the real status into the preview (not a hardcoded true)
    expect(appCode(SHELL_FILE)).toMatch(/saved:\s*state\.saveStatus\s*==\s*\.saved/);
  });
  it('15. no fake success on restore / export failure', () => {
    const st = appCode(STATE_FILE);
    // an invalid latest pointer is never shown as restored — it falls back
    expect(st).toMatch(/func\s+validatedLatest/);
    expect(st).toMatch(/LocalSnapshotValidator\.isValid\s*\(\s*raw\s*\)/);
    // export reports an honest failure, not a fabricated success
    expect(st).toMatch(/exportStatus\s*=\s*\.failed\s*\(/);
    expect(appCode(STORE_FILE)).toMatch(/func\s+exportLatestDebugCopy\s*\([\s\S]*?\)\s+throws\b/);
    expect(appCode(STORE_FILE)).toMatch(/func\s+quarantineInvalid\s*\([\s\S]*?\)\s+throws\b/);
  });
});

// ---- 22-29. Forbidden imports / backends ----

describe('iOS-10 forbidden cloud / health / network / backends are absent', () => {
  const code = joinCode(PERSISTENCE_FILES);

  it('22. no HealthKit import', () => {
    expect(code).not.toMatch(/^\s*import\s+HealthKit\b/m);
  });
  it('23. no IronPathCloudSync import', () => {
    expect(code).not.toMatch(/^\s*import\s+IronPathCloudSync\b/m);
  });
  it('24. no Supabase import', () => {
    expect(code).not.toMatch(/^\s*import\s+Supabase\w*\b/m);
  });
  it('25. no URLSession / URLRequest / NSURLSession (network)', () => {
    expect(code).not.toMatch(/\bURLSession\b/);
    expect(code).not.toMatch(/\bURLRequest\b/);
    expect(code).not.toMatch(/\bNSURLSession\b/);
  });
  it('26. no WebKit / WKWebView', () => {
    expect(code).not.toMatch(/^\s*import\s+WebKit\b/m);
    expect(code).not.toMatch(/\bWKWebView\b/);
  });
  it('27. no CloudKit / iCloud / ubiquity container', () => {
    expect(code).not.toMatch(/^\s*import\s+CloudKit\b/m);
    expect(code).not.toMatch(/\bCKContainer\b/);
    expect(code).not.toMatch(/\biCloud\b/);
    expect(code).not.toMatch(/ubiquit/i);
    expect(code).not.toMatch(/\bNSUbiquitous/);
  });
  it('28. no UserDefaults', () => {
    expect(code).not.toMatch(/\bUserDefaults\b/);
  });
  it('29. no SQLite / CoreData / SwiftData', () => {
    expect(code).not.toMatch(/^\s*import\s+SQLite3?\b/m);
    expect(code).not.toMatch(/\bsqlite3_/);
    expect(code).not.toMatch(/^\s*import\s+CoreData\b/m);
    expect(code).not.toMatch(/\bNSManagedObject\b/);
    expect(code).not.toMatch(/^\s*import\s+SwiftData\b/m);
    expect(code).not.toMatch(/@Model\b/);
  });
});

// ---- 30, 31, 32. AppData / DataHealth boundary ----

describe('iOS-10 AppData / DataHealth restore boundary', () => {
  it('30. no destructive AppData mutation (the restore files never touch AppData)', () => {
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
  it('31. no raw AppData restore into TrainingDecision', () => {
    const code = joinCode(RESTORE_FILES);
    // restoring a snapshot must NOT build engine input or AppData from it
    expect(code).not.toMatch(/buildTrainingDecisionFromCleanInput\s*\(/);
    expect(code).not.toMatch(/createCleanTrainingDecisionInput\s*\(/);
    expect(code).not.toMatch(/buildCleanAppDataView\s*\(/);
    expect(code).not.toMatch(/\bAppData\s*\(/);
  });
  it('32. future AppData restore path must reference buildCleanAppDataView (documented, deferred)', () => {
    const doc = docText();
    expect(doc).toMatch(/buildCleanAppDataView/);
    expect(doc).toMatch(/defer/i);
  });
});

// ---- 33. No TS/JS runtime reference ----

describe('iOS-10 no TS/JS runtime reference', () => {
  it('33. no node_modules / .ts / .js path strings in the persistence files', () => {
    const code = joinCode(PERSISTENCE_FILES);
    expect(code).not.toMatch(/\bnode_modules\b/);
    expect(code).not.toMatch(/[`"'][^`"'\n]*\.(ts|tsx|js|mjs|cjs)[`"']/);
  });
});

// ---- 34, 35. No golden / package / lockfile change ----

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

describe('iOS-10 parity goldens + package/lockfile unchanged', () => {
  it('34. parity --check still 57 fixtures / 0 changed; no golden file changed', () => {
    const result = spawnSync(
      process.execPath,
      [repoFile('scripts/generate-parity-goldens.mjs'), '--check'],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    expect(result.status, `stderr: ${result.stderr}\nstdout: ${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/checked\s+96\s+fixture/);
    expect(result.stdout).toMatch(/0\s+changed/);
    expect(changedFiles(['tests/fixtures/parity'])).toBe('');
  }, 240_000);

  it('35. package.json + package-lock.json byte-identical to main; no pnpm/yarn lock', () => {
    expect(changedFiles(['package.json'])).toBe('');
    expect(changedFiles(['package-lock.json'])).toBe('');
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
    expect(existsSync(repoFile('yarn.lock'))).toBe(false);
  });
});

// ---- 36. iOS-4B6 remains deferred (documented) ----

describe('iOS-10 docs', () => {
  it('doc exists with a manual Simulator smoke checklist', () => {
    expect(existsSync(repoFile(DOC_PATH))).toBe(true);
    expect(docText()).toMatch(/[Ss]imulator smoke/);
  });
  it('36. doc records iOS-4B6 remains deferred', () => {
    const doc = docText();
    expect(doc).toMatch(/4B6/);
    expect(doc).toMatch(/defer/i);
  });
});
