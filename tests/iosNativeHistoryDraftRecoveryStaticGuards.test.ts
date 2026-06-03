import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-14 Native History + Draft Recovery Product Bundle V1 — static guards.
//
// Locks the iOS-14 product loop:
//   • Local history product surface: pure grouping (Today/Earlier/Older) + a
//     pure local filter/search (LocalSnapshotHistory.filtered) + a richer
//     recent-summary (mostCommonScenarioLabel) + a search field in the view.
//   • Real-clock opt-in: FocusModeMvpState.systemClock + useSystemClock() let the
//     RUNNING app group by real days; the default `clock` stays deterministic so
//     tests/previews never go flaky.
//   • Restore reconciliation remains; restore FAILURE leaves the current session
//     untouched (no fake restore).
//   • Real package tests cover filter/search + most-common-scenario + grouping.
//   • Local-only; no Cloud/HealthKit/Supabase/network/WebKit/CloudKit-iCloud/
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

const HISTORY_HELPER = 'LocalSnapshotHistory.swift';
const STATS = 'LocalSnapshotStats.swift';
const RESTORE_FILE = 'LocalDraftRestore.swift';
const STATE = 'FocusModeMvpState.swift';
const HISTORY_VIEW = 'FocusSavedSessionHistoryView.swift';
const DETAIL = 'FocusSavedSessionDetailView.swift';
const SHELL = 'FocusModeShellView.swift';

const DOC_PATH = 'docs/ios-native-migration/IOS_14_NATIVE_HISTORY_DRAFT_RECOVERY_PRODUCT_BUNDLE_V1.md';
const docText = (): string => read(DOC_PATH);

const localCode = (): string =>
  [pkg(HISTORY_HELPER), pkg(STATS), pkg(RESTORE_FILE), app(STATE), app(HISTORY_VIEW), app(DETAIL), app(SHELL)].join('\n');

// ---- 1-3. History product surface + filter/search + summary ----

describe('iOS-14 history product surface', () => {
  it('1. pure grouping + pure filter/search helpers exist', () => {
    const h = pkg(HISTORY_HELPER);
    expect(h).toMatch(/static\s+func\s+grouped\s*\(/);
    expect(h).toMatch(/static\s+func\s+filtered\s*\(/);
    expect(h).toMatch(/query/);
    expect(h).toMatch(/completedOnly/);
    expect(h).not.toMatch(/\bFileManager\b/);  // pure
  });
  it('2. history view renders grouped sections + a local search field', () => {
    const v = app(HISTORY_VIEW);
    expect(v).toMatch(/LocalSnapshotHistory\.grouped\s*\(/);
    expect(v).toMatch(/LocalSnapshotHistory\.filtered\s*\(/);
    expect(v).toMatch(/TextField\s*\(\s*"搜索/);
    expect(v).toMatch(/仅保存在本机 · 不同步云端 · 可清除/);   // local-only disclaimer
  });
  it('3. recent summary includes most-common scenario (derived stat)', () => {
    expect(pkg(STATS)).toMatch(/mostCommonScenarioLabel/);
    expect(app(HISTORY_VIEW)).toMatch(/mostCommonScenarioLabel/);
  });
});

// ---- 4. Saved detail surface ----

describe('iOS-14 saved detail surface', () => {
  it('4. saved detail view exists and is presented from history', () => {
    expect(existsSync(repoFile(`${APP_DIR}/${DETAIL}`))).toBe(true);
    expect(app(DETAIL)).toMatch(/struct\s+FocusSavedSessionDetailView/);
    expect(app(HISTORY_VIEW)).toMatch(/FocusSavedSessionDetailView\s*\(\s*snapshot:/);
  });
});

// ---- 5-6. Real-clock opt-in (deterministic default preserved) ----

describe('iOS-14 real-clock opt-in', () => {
  it('5. app exposes a system-clock opt-in but the default clock stays deterministic', () => {
    const s = app(STATE);
    expect(s).toMatch(/static\s+let\s+systemClock\s*:\s*\(\)\s*->\s*Date\s*=\s*\{\s*Date\(\)\s*\}/);
    expect(s).toMatch(/func\s+useSystemClock\s*\(\)/);
    // default clock remains the deterministic reference date (not Date())
    expect(s).toMatch(/var\s+clock\s*:\s*\(\)\s*->\s*Date\s*=\s*\{\s*FocusModeMvpState\.deterministicReferenceDate\(\)\s*\}/);
  });
  it('6. the shell opts the running app into the system clock on launch', () => {
    expect(app(SHELL)).toMatch(/state\.useSystemClock\s*\(\)/);
  });
});

// ---- 7-9. Restore reconciliation + draft recovery + no fake success ----

describe('iOS-14 restore reconciliation + draft recovery honesty', () => {
  it('7. restore reconciliation remains present', () => {
    expect(pkg(RESTORE_FILE)).toMatch(/func\s+reconcile\s*\(/);
    expect(pkg(RESTORE_FILE)).toMatch(/unmatchedSnapshotIds/);
    expect(app(STATE)).toMatch(/LocalDraftRestorePlanner\.reconcile\s*\(/);
  });
  it('8. draft recovery status is visible (restored-draft banner / reconciliation)', () => {
    expect(app(SHELL)).toMatch(/isRestoredDraft/);
    expect(app(SHELL)).toMatch(/已恢复本机草稿/);
  });
  it('9. restore failure cannot show fake success / mutate the current session', () => {
    const s = app(STATE);
    expect(s).toMatch(/guard\s+let\s+scenario\s*=\s*FocusModeSampleScenario[\s\S]*?restoreStatus\s*=\s*\.failed[\s\S]*?return/);
    expect(s).toMatch(/case\s+\.failure\b(?:(?!stage\s*=\s*\.inSession)[\s\S])*?return/);
    expect(s).toMatch(/let\s+plan\s*=\s*reconciliation\.plan/);
  });
});

// ---- 10. Package tests cover new helpers ----

describe('iOS-14 package tests', () => {
  it('10. IronPathLocalSnapshot tests cover filter/search + most-common-scenario', () => {
    const t = read(`${PKG_TESTS}/IronPathLocalSnapshotTests.swift`);
    expect(t).toMatch(/testFilterByScenarioAndCompletedOnly/);
    expect(t).toMatch(/testFilterByQueryMatchesScenarioIntentExerciseName/);
    expect(t).toMatch(/testStatsMostCommonScenario/);
  });
});

// ---- 11-13. Local-only safety bans ----

describe('iOS-14 local-only safety boundaries', () => {
  const code = localCode();

  it('11. no Cloud / CloudKit / iCloud / CloudSync / HealthKit / Supabase / network / WebKit', () => {
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
  it('12. no UserDefaults / SQLite / CoreData / SwiftData', () => {
    expect(code).not.toMatch(/\bUserDefaults\b/);
    expect(code).not.toMatch(/^\s*import\s+SQLite3?\b/m);
    expect(code).not.toMatch(/\bsqlite3_/);
    expect(code).not.toMatch(/^\s*import\s+CoreData\b/m);
    expect(code).not.toMatch(/\bNSManagedObject\b/);
    expect(code).not.toMatch(/^\s*import\s+SwiftData\b/m);
    expect(code).not.toMatch(/@Model\b/);
  });
  it('13. no destructive AppData mutation + no raw AppData restore into TrainingDecision', () => {
    expect(code).not.toMatch(/\bAppData\b/);
    expect(code).not.toMatch(/buildTrainingDecisionFromCleanInput\s*\(/);
    expect(code).not.toMatch(/createCleanTrainingDecisionInput\s*\(/);
    expect(code).not.toMatch(/buildCleanAppDataView\s*\(/);
  });
});

// ---- 14. No TS runtime reference ----

describe('iOS-14 no TS/JS runtime reference', () => {
  it('14. no node_modules / .ts / .js path strings in the local Swift code', () => {
    const code = localCode();
    expect(code).not.toMatch(/\bnode_modules\b/);
    expect(code).not.toMatch(/[`"'][^`"'\n]*\.(ts|tsx|js|mjs|cjs)[`"']/);
  });
});

// ---- 15-16. Golden / npm package / lockfile invariance ----

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

describe('iOS-14 golden + npm package/lockfile unchanged', () => {
  it('15. parity --check still 57 fixtures / 0 changed; no golden file changed', () => {
    const result = spawnSync(
      process.execPath,
      [repoFile('scripts/generate-parity-goldens.mjs'), '--check'],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    expect(result.status, `stderr: ${result.stderr}\nstdout: ${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/checked\s+72\s+fixture/);
    expect(result.stdout).toMatch(/0\s+changed/);
    expect(changedFiles(['tests/fixtures/parity'])).toBe('');
  }, 240_000);

  it('16. package.json + package-lock.json byte-identical to main; no pnpm/yarn lock', () => {
    expect(changedFiles(['package.json'])).toBe('');
    expect(changedFiles(['package-lock.json'])).toBe('');
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
    expect(existsSync(repoFile('yarn.lock'))).toBe(false);
  });
});

// ---- 17-18. Docs ----

describe('iOS-14 docs', () => {
  it('17. doc exists with Simulator smoke + full-AppData-restore-deferred (DataHealth gate)', () => {
    expect(existsSync(repoFile(DOC_PATH))).toBe(true);
    const doc = docText();
    expect(doc).toMatch(/[Ss]imulator smoke/);
    expect(doc).toMatch(/buildCleanAppDataView/);
    expect(doc).toMatch(/defer/i);
  });
  it('18. doc records iOS-4B6 remains deferred', () => {
    expect(docText()).toMatch(/4B6/);
  });
});
