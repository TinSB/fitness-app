import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-9 Local JSON Persistence + Saved Session History V1 — static guards.
//
// Locks the iOS-9 surface: the in-memory completed-session preview from iOS-8
// is upgraded to a SAFE, app-local JSON snapshot + a small saved-session
// history list. Hard local-only boundary:
//   • Snapshot model is a small Codable presentation record (NOT AppData).
//   • Store writes ONLY under Application Support / IronPathLocalSnapshots,
//     atomically, with backup-before-overwrite on the rolling latest pointer.
//   • load latest / list / scoped clear all exist; clear only touches this
//     store's own prefixed files.
//   • Completion flow saves locally; a save FAILURE shows an honest error and
//     never a fabricated success.
//   • No Cloud / HealthKit / Supabase / network / WebKit / CloudKit-iCloud /
//     UserDefaults / SQLite-CoreData-SwiftData / AppData mutation / TS-JS.
//   • No parity-golden change, no package/lockfile change.
//   • iOS-4B6 (userFacing/full arbitrationTrace) stays deferred.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const repoFile = (p: string): string => resolve(repoRoot, p);

const APP_DIR = 'ios/IronPath';

// The iOS-9 files.
const MODEL_FILE = 'LocalCompletedSessionSnapshot.swift';
const STORE_FILE = 'LocalSessionSnapshotStore.swift';
const STATE_FILE = 'FocusModeMvpState.swift';
const SHELL_FILE = 'FocusModeShellView.swift';
const HISTORY_VIEW_FILE = 'FocusSavedSessionHistoryView.swift';

// The file set the iOS-9 forbidden-import / backend bans apply to: every file
// iOS-9 adds local-persistence wiring to — the model, the store, the state, the
// history view, AND the shell (iOS-9 adds load/save/history wiring there).
// Excludes IronPathApp.swift (it links IronPathCloudSync as the iOS-1 bootstrap
// proof).
const PERSISTENCE_FILES = [MODEL_FILE, STORE_FILE, STATE_FILE, HISTORY_VIEW_FILE, SHELL_FILE];

const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
// iOS-12: the pure snapshot/store files were extracted to a local Swift package
// (IronPathLocalSnapshot) so they can carry real unit tests. They resolve from
// the package source dir now; presentation files stay under the app target.
const PKG_DIR = 'ios/packages/IronPathLocalSnapshot/Sources/IronPathLocalSnapshot';
const MOVED_TO_PACKAGE = new Set([
  'LocalCompletedSessionSnapshot.swift', 'LocalSessionSnapshotStore.swift',
  'LocalSnapshotValidation.swift', 'LocalSnapshotStats.swift', 'LocalSnapshotMigration.swift',
]);
const appPath = (name: string): string =>
  repoFile(`${MOVED_TO_PACKAGE.has(name) ? PKG_DIR : APP_DIR}/${name}`);
const appExists = (name: string): boolean => existsSync(appPath(name));
const rawApp = (name: string): string => readFileSync(appPath(name), 'utf8');
const appCode = (name: string): string => stripSwiftComments(rawApp(name));
const persistenceCode = (): string =>
  PERSISTENCE_FILES.filter(appExists).map(appCode).join('\n');

// ---- 1-3. Snapshot model exists and is Codable ----

describe('iOS-9 snapshot model', () => {
  it('1. LocalCompletedSessionSnapshot type exists (+ exercise / set-progress sub-types)', () => {
    expect(appExists(MODEL_FILE)).toBe(true);
    const m = appCode(MODEL_FILE);
    expect(m).toMatch(/struct\s+LocalCompletedSessionSnapshot\b/);
    expect(m).toMatch(/struct\s+LocalCompletedExerciseSnapshot\b/);
    expect(m).toMatch(/struct\s+LocalCompletedSetProgressSnapshot\b/);
  });

  it('2. LocalSessionSnapshotStore type exists', () => {
    expect(appExists(STORE_FILE)).toBe(true);
    expect(appCode(STORE_FILE)).toMatch(/struct\s+LocalSessionSnapshotStore\b/);
  });

  it('3. all three snapshot types are Codable', () => {
    const m = appCode(MODEL_FILE);
    for (const t of [
      'LocalCompletedSessionSnapshot',
      'LocalCompletedExerciseSnapshot',
      'LocalCompletedSetProgressSnapshot',
    ]) {
      expect(m).toMatch(new RegExp(`struct\\s+${t}\\s*:\\s*[^\\n{]*\\bCodable\\b`));
    }
    // The snapshot carries the local origin marker (never raw export data).
    expect(m).toMatch(/local-ios-focus-mvp/);
  });
});

// ---- 4-11. Store behaviors + safety ----

describe('iOS-9 app-local JSON store behaviors', () => {
  const store = (): string => appCode(STORE_FILE);

  it('4. store targets app-local Application Support (sanctioned subdirectory)', () => {
    const s = store();
    expect(s).toMatch(/\.applicationSupportDirectory\b/);
    expect(s).toMatch(/IronPathLocalSnapshots/);
    // NOT the broad documents dir, NOT a shared/ubiquity container.
    expect(s).not.toMatch(/\.documentDirectory\b/);
  });

  it('5. store uses JSONEncoder / JSONDecoder', () => {
    const s = store();
    expect(s).toMatch(/\bJSONEncoder\s*\(/);
    expect(s).toMatch(/\bJSONDecoder\s*\(/);
  });

  it('6. EVERY disk write in the store is atomic (not just one)', () => {
    const s = store();
    const writes = (s.match(/\.write\s*\(\s*to:/g) || []).length;
    const atomicWrites =
      (s.match(/\.write\s*\(\s*to:[^\n)]*options:\s*\[\s*\.atomic\s*\]/g) || []).length;
    // the store performs >=2 writes (history entry + latest pointer); all atomic
    expect(writes).toBeGreaterThanOrEqual(2);
    expect(atomicWrites).toBe(writes);
  });

  it('7. backup-before-overwrite: the latest pointer is copied to a .bak BEFORE it is overwritten', () => {
    const s = store();
    expect(s).toMatch(/latestBackupFilename/);
    expect(s).toMatch(/\.bak\b/);
    // ORDER, not mere co-existence: copyItem must appear before the latest write
    // in source order, else a regression could back up an already-clobbered file.
    const copyIdx = s.search(/copyItem\s*\(/);
    const latestWriteIdx = s.search(/\.write\s*\(\s*to:\s*latestURL/);
    expect(copyIdx).toBeGreaterThan(-1);
    expect(latestWriteIdx).toBeGreaterThan(-1);
    expect(copyIdx).toBeLessThan(latestWriteIdx);
  });

  it('8. load-latest exists AND is wired to run on launch', () => {
    const s = store();
    expect(s).toMatch(/func\s+loadLatest\s*\(/);
    // the shell loads on launch -> state.loadSavedSessions -> store.loadLatest
    expect(appCode(SHELL_FILE)).toMatch(/\.task\s*\{[^}]*loadSavedSessions\s*\(/);
    const state = appCode(STATE_FILE);
    expect(state).toMatch(/func\s+loadSavedSessions[\s\S]*?refreshSavedFromStore\s*\(/);
    expect(state).toMatch(/refreshSavedFromStore[\s\S]*?snapshotStore\.loadLatest\s*\(/);
  });

  it('9. list-snapshots behavior exists', () => {
    expect(store()).toMatch(/func\s+listSnapshots\s*\(/);
  });

  it('10. clear behavior exists', () => {
    expect(store()).toMatch(/func\s+clear\s*\(/);
  });

  it('11. clear/delete is scoped to this store\'s prefixed files (no broad directory wipe)', () => {
    const s = store();
    // delete is gated by the store's own filename prefix
    expect(s).toMatch(/hasPrefix\s*\(\s*Self\.filePrefix\s*\)/);
    expect(s).toMatch(/removeItem\s*\(/);
    // must NOT delete the directory itself / recurse a tree
    expect(s).not.toMatch(/removeItem\s*\(\s*at:\s*dir\s*\)/);
    expect(s).not.toMatch(/removeItem\s*\(\s*atPath:\s*dir/);
  });
});

// ---- 12. Completion flow saves locally ----

describe('iOS-9 completion flow persists', () => {
  it('12. completeSession calls the local snapshot store save', () => {
    const s = appCode(STATE_FILE);
    expect(s).toMatch(/func\s+completeSession\b/);
    expect(s).toMatch(/snapshotStore\.save\s*\(/);
    // the state itself never touches FileManager (delegated to the store)
    expect(s).not.toMatch(/\bFileManager\b/);
  });
});

// ---- 13-14. UI: local-only disclaimer + saved history surface ----

describe('iOS-9 UI surfaces', () => {
  it('13. UI shows the local-only / no-cloud disclaimer', () => {
    expect(appExists(HISTORY_VIEW_FILE)).toBe(true);
    expect(appCode(HISTORY_VIEW_FILE)).toMatch(/仅保存在本机 · 不同步云端 · 可清除/);
  });

  it('14. UI shows a saved-session history surface wired into the shell', () => {
    const view = appCode(HISTORY_VIEW_FILE);
    expect(view).toMatch(/struct\s+FocusSavedSessionHistoryView\b/);
    // latest card + recent list
    expect(view).toMatch(/最近一次/);
    expect(view).toMatch(/近期记录/);
    // mounted by the shell
    expect(appCode(SHELL_FILE)).toMatch(/FocusSavedSessionHistoryView\s*\(/);
  });
});

// ---- 15. No fake success on save failure ----

describe('iOS-9 honest save failure', () => {
  it('15. a failed save shows an error, never a fabricated success', () => {
    const state = appCode(STATE_FILE);
    // success state set only inside the do/try success path
    expect(state).toMatch(
      /try\s+snapshotStore\.save\s*\([\s\S]*?saveStatus\s*=\s*\.saved/,
    );
    // a catch records an honest failure with the error message
    expect(state).toMatch(/catch\b[\s\S]*?saveStatus\s*=\s*\.failed\s*\(/);
    expect(state).toMatch(/enum\s+FocusSaveStatus[\s\S]*?case\s+failed\s*\(\s*String\s*\)/);
    // the store's mutating ops throw (so callers can't silently "succeed")
    expect(appCode(STORE_FILE)).toMatch(/func\s+save\s*\([\s\S]*?\)\s+throws\b/);
    // the completed screen renders the failure honestly
    expect(appCode(SHELL_FILE)).toMatch(/本地保存失败/);
  });
});

// ---- 16-25. Forbidden imports / runtime / cloud / persistence backends ----

describe('iOS-9 forbidden cloud / health / network / backends are absent', () => {
  const code = persistenceCode();

  it('16. no HealthKit import', () => {
    expect(code).not.toMatch(/^\s*import\s+HealthKit\b/m);
  });
  it('17. no IronPathCloudSync import', () => {
    expect(code).not.toMatch(/^\s*import\s+IronPathCloudSync\b/m);
  });
  it('18. no Supabase import', () => {
    expect(code).not.toMatch(/^\s*import\s+Supabase\w*\b/m);
  });
  it('19. no URLSession / URLRequest / NSURLSession (network)', () => {
    expect(code).not.toMatch(/\bURLSession\b/);
    expect(code).not.toMatch(/\bURLRequest\b/);
    expect(code).not.toMatch(/\bNSURLSession\b/);
  });
  it('20. no WebKit / WKWebView', () => {
    expect(code).not.toMatch(/^\s*import\s+WebKit\b/m);
    expect(code).not.toMatch(/\bWKWebView\b/);
  });
  it('21. no CloudKit / iCloud / ubiquity container', () => {
    expect(code).not.toMatch(/^\s*import\s+CloudKit\b/m);
    expect(code).not.toMatch(/\bCKContainer\b/);
    expect(code).not.toMatch(/\biCloud\b/);
    expect(code).not.toMatch(/ubiquit/i);
    expect(code).not.toMatch(/\bNSUbiquitous/);
  });
  it('22. no UserDefaults', () => {
    expect(code).not.toMatch(/\bUserDefaults\b/);
  });
  it('23. no SQLite / CoreData / SwiftData', () => {
    expect(code).not.toMatch(/^\s*import\s+SQLite3?\b/m);
    expect(code).not.toMatch(/\bsqlite3_/);
    expect(code).not.toMatch(/^\s*import\s+CoreData\b/m);
    expect(code).not.toMatch(/\bNSManagedObject\b/);
    expect(code).not.toMatch(/^\s*import\s+SwiftData\b/m);
    expect(code).not.toMatch(/@Model\b/);
  });
  it('24. no AppData read/write/destructive mutation', () => {
    // The DERIVED persistence/presentation files never touch the canonical domain
    // store. iOS-17A: FocusModeMvpState is the AUTHORIZED initiator of the first
    // native canonical-AppData write path (master §8.1) — it holds an AppDataStore
    // and delegates to IronPathPersistence.CanonicalSessionWriter — so the
    // canonical-AppData ban applies to the derived files (model/store/history/
    // shell), NOT the view-model. The view-model's canonical access is itself
    // guarded below: it must go through the sanctioned writer seam, never a raw
    // second write path (§8.1 rule 4).
    const derived = [MODEL_FILE, STORE_FILE, HISTORY_VIEW_FILE, SHELL_FILE]
      .filter(appExists).map(appCode).join('\n');
    expect(derived).not.toMatch(/\bAppData\b/);
    expect(derived).not.toMatch(/\bAppDataStore\b/);
    // The view-model reaches canonical AppData ONLY via the sanctioned package seam.
    expect(appCode(STATE_FILE)).toMatch(/\bCanonicalSessionWriter\b/);
  });
  it('25. no TypeScript / JS runtime reference', () => {
    expect(code).not.toMatch(/\bnode_modules\b/);
    expect(code).not.toMatch(/[`"'][^`"'\n]*\.(ts|tsx|js|mjs|cjs)[`"']/);
  });
});

// ---- 26-27. No golden / package / lockfile change ----

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

describe('iOS-9 parity goldens unchanged', () => {
  it('26. parity --check still 57 fixtures / 0 changed, and no golden file changed', () => {
    const result = spawnSync(
      process.execPath,
      [repoFile('scripts/generate-parity-goldens.mjs'), '--check'],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    expect(result.status, `stderr: ${result.stderr}\nstdout: ${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/checked\s+104\s+fixture/);
    expect(result.stdout).toMatch(/0\s+changed/);
    // and nothing under the goldens tree was touched by this branch
    expect(changedFiles(['tests/fixtures/parity'])).toBe('');
  }, 240_000);
});

describe('iOS-9 package.json / lockfile unchanged', () => {
  it('27. package.json + package-lock.json byte-identical to main; no pnpm/yarn lock', () => {
    expect(changedFiles(['package.json'])).toBe('');
    expect(changedFiles(['package-lock.json'])).toBe('');
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
    expect(existsSync(repoFile('yarn.lock'))).toBe(false);
  });
});

// ---- 28. iOS-4B6 remains deferred (documented) ----

describe('iOS-9 docs', () => {
  const docPath =
    'docs/ios-native-migration/IOS_9_LOCAL_JSON_PERSISTENCE_SAVED_SESSION_HISTORY_V1.md';

  it('doc exists with a manual Simulator smoke checklist', () => {
    expect(existsSync(repoFile(docPath))).toBe(true);
    const doc = readFileSync(repoFile(docPath), 'utf8');
    expect(doc).toMatch(/[Ss]imulator smoke/);
  });

  it('28. doc records iOS-4B6 remains deferred', () => {
    const doc = readFileSync(repoFile(docPath), 'utf8');
    expect(doc).toMatch(/4B6/);
    expect(doc).toMatch(/defer/i);
  });
});
