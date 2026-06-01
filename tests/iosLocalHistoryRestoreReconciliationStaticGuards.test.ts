import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-13 Local History Product Surface + Restore Reconciliation V1 — guards.
//
// Locks the iOS-13 product loop:
//   • Local history product surface: pure LocalSnapshotHistory grouping (Today/
//     Earlier/Older) + a grouped, completion-ratio history view.
//   • Restore reconciliation: LocalDraftRestorePlanner.reconcile compares saved
//     exercise ids against the CURRENT scenario, applies counts ONLY to matched
//     ids, reports skipped (renamed/removed) + new ids, remaps the resume cursor.
//   • The app's restoreDraft uses reconcile; a FAILURE leaves the current
//     in-memory session UNTOUCHED (no fake restore).
//   • Real package tests cover reconciliation + grouping.
//   • Local-only: no Cloud/HealthKit/Supabase/network/WebKit/CloudKit-iCloud/
//     UserDefaults/SQLite-CoreData-SwiftData; no AppData mutation; no raw AppData
//     restore into TrainingDecision; full AppData restore stays deferred.
//   • No TS runtime / golden / npm package change. iOS-4B6 stays deferred.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const repoFile = (p: string): string => resolve(repoRoot, p);

const PKG_SRC = 'ios/packages/IronPathLocalSnapshot/Sources/IronPathLocalSnapshot';
const PKG_TESTS = 'ios/packages/IronPathLocalSnapshot/Tests/IronPathLocalSnapshotTests';
const APP_DIR = 'ios/IronPath';

const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const read = (p: string): string => readFileSync(repoFile(p), 'utf8');
const pkg = (name: string): string => stripSwiftComments(read(`${PKG_SRC}/${name}`));
const app = (name: string): string => stripSwiftComments(read(`${APP_DIR}/${name}`));

const RESTORE_FILE = 'LocalDraftRestore.swift';
const HISTORY_HELPER = 'LocalSnapshotHistory.swift';
const STATE = 'FocusModeMvpState.swift';
const HISTORY_VIEW = 'FocusSavedSessionHistoryView.swift';
const DETAIL = 'FocusSavedSessionDetailView.swift';
const SHELL = 'FocusModeShellView.swift';

const DOC_PATH = 'docs/ios-native-migration/IOS_13_LOCAL_HISTORY_PRODUCT_RESTORE_RECONCILIATION_V1.md';
const docText = (): string => read(DOC_PATH);

// the local code surface the local-only bans apply to
const localCode = (): string =>
  [pkg(RESTORE_FILE), pkg(HISTORY_HELPER), app(STATE), app(HISTORY_VIEW), app(DETAIL), app(SHELL)].join('\n');

// ---- 1-2. Local history product surface ----

describe('iOS-13 local history product surface', () => {
  it('1. pure history grouping helper exists (Today/Earlier/Older, newest-first)', () => {
    expect(existsSync(repoFile(`${PKG_SRC}/${HISTORY_HELPER}`))).toBe(true);
    const h = pkg(HISTORY_HELPER);
    expect(h).toMatch(/enum\s+LocalHistoryGroup/);
    expect(h).toMatch(/case\s+today/);
    expect(h).toMatch(/case\s+earlier/);
    expect(h).toMatch(/case\s+older/);
    expect(h).toMatch(/static\s+func\s+grouped\s*\(/);
    expect(h).not.toMatch(/\bFileManager\b/);  // pure
  });
  it('2. history view renders grouped sections + completion ratio', () => {
    const v = app(HISTORY_VIEW);
    expect(v).toMatch(/LocalSnapshotHistory\.grouped\s*\(/);
    expect(v).toMatch(/section\.group\.title/);
    expect(v).toMatch(/completionPercent/);
    // local-only disclaimer remains
    expect(v).toMatch(/仅保存在本机 · 不同步云端 · 可清除/);
  });
});

// ---- 3. Saved detail surface ----

describe('iOS-13 saved detail surface', () => {
  it('3. saved-session detail view exists and is presented from history', () => {
    expect(existsSync(repoFile(`${APP_DIR}/${DETAIL}`))).toBe(true);
    expect(app(DETAIL)).toMatch(/struct\s+FocusSavedSessionDetailView/);
    expect(app(HISTORY_VIEW)).toMatch(/FocusSavedSessionDetailView\s*\(\s*snapshot:/);
  });
});

// ---- 4-7. Restore reconciliation ----

describe('iOS-13 restore reconciliation', () => {
  const r = (): string => pkg(RESTORE_FILE);

  it('4. reconcile logic exists and reports matched/unmatched/missing', () => {
    const code = r();
    expect(code).toMatch(/func\s+reconcile\s*\(/);
    expect(code).toMatch(/struct\s+LocalDraftRestoreReconciliation/);
    expect(code).toMatch(/matchedExerciseIds/);
    expect(code).toMatch(/unmatchedSnapshotIds/);
    expect(code).toMatch(/missingCurrentIds/);
  });
  it('5. counts apply only to matched ids; resume remapped to current order', () => {
    const code = r();
    // applied counts filtered to current (matched) ids
    expect(code).toMatch(/completedSetsByExerciseId\.filter\s*\{\s*currentSet\.contains/);
    // remap resume into current order via firstIndex(of:) in currentExerciseIds
    expect(code).toMatch(/currentExerciseIds\.firstIndex\(of:/);
  });
  it('6. app restoreDraft uses reconcile against the current scenario ids', () => {
    const s = app(STATE);
    expect(s).toMatch(/LocalDraftRestorePlanner\.reconcile\s*\(/);
    expect(s).toMatch(/currentExerciseIds\s*\(\s*for:/);
    // derives current ids deterministically (not from AppData)
    expect(s).toMatch(/FocusModePreviewData\.sampleCoreSlice\s*\(\s*for:/);
  });
  it('7. package tests cover reconciliation (missing/reordered/no-match) + grouping', () => {
    const t = read(`${PKG_TESTS}/IronPathLocalSnapshotTests.swift`);
    expect(t).toMatch(/Reconcile/);
    expect(t).toMatch(/testReconcileReportsMissingAndRenamedIds/);
    expect(t).toMatch(/testReconcileRemapsResumeToCurrentOrder/);
    expect(t).toMatch(/testReconcileWithNoMatchesAppliesNothing/);
    expect(t).toMatch(/testHistoryGrouping/);
  });
});

// ---- 8-9. Failure honesty: no fake restore + protect current session ----

describe('iOS-13 restore failure honesty', () => {
  it('8. unknown scenario / planner failure return BEFORE mutating the session', () => {
    const s = app(STATE);
    // unknown scenario: .failed then return, no stage mutation in between
    expect(s).toMatch(/guard\s+let\s+scenario\s*=\s*FocusModeSampleScenario[\s\S]*?restoreStatus\s*=\s*\.failed[\s\S]*?return/);
    // planner .failure: .failed then return, and provably NO `stage = .inSession`
    // anywhere between `case .failure` and its `return` (no fake restore there).
    expect(s).toMatch(/case\s+\.failure[\s\S]*?restoreStatus\s*=\s*\.failed[\s\S]*?return/);
    expect(s).toMatch(/case\s+\.failure\b(?:(?!stage\s*=\s*\.inSession)[\s\S])*?return/);
    expect(s).toMatch(/restoreStatus\s*=\s*\.failed\s*\((?:(?!stage\s*=)[\s\S])*?return/);
  });
  it('9. the reconciled plan is applied only on success (no fake success)', () => {
    const s = app(STATE);
    // success path binds the reconciled plan and only then mutates the draft
    expect(s).toMatch(/let\s+plan\s*=\s*reconciliation\.plan/);
    expect(s).toMatch(/completedSetsByExerciseId\s*=\s*plan\.completedSetsByExerciseId/);
    expect(s).toMatch(/stage\s*=\s*\.inSession/);
  });
});

// ---- 10-12. Local-only safety bans ----

describe('iOS-13 local-only safety boundaries', () => {
  const code = localCode();

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

// ---- 13. No TS runtime reference ----

describe('iOS-13 no TS/JS runtime reference', () => {
  it('13. no node_modules / .ts / .js path strings in the local Swift code', () => {
    const code = localCode();
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

describe('iOS-13 golden + npm package/lockfile unchanged', () => {
  it('14. parity --check still 24 fixtures / 0 changed; no golden file changed', () => {
    const result = spawnSync(
      process.execPath,
      [repoFile('scripts/generate-parity-goldens.mjs'), '--check'],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    expect(result.status, `stderr: ${result.stderr}\nstdout: ${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/checked\s+24\s+fixture/);
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

// ---- 16-17. Docs ----

describe('iOS-13 docs', () => {
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
