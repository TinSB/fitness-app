import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-8 Native Local Training MVP Mega Migration V1 — static guards.
//
// Locks the iOS-8 surface produced by the multi-agent migration:
//   • Lane A: TrainingDecisionCoreSlice exposes a real `deload: DeloadDecision`
//     wired from the engine's own computed value (not a fabricated literal),
//     and FocusModeStatusSurfaceView reads slice.deload (no more "—"/deferred).
//   • Lane B/C/D: a local in-memory session draft/stage + complete-session UI +
//     in-RAM saved preview, all 100% local (NO disk persistence).
//   • Safety: no Cloud/HealthKit/Supabase/WebKit/network/JS-TS-runtime, no disk
//     persistence (FileManager/UserDefaults), no SQLite/CoreData/SwiftData, no
//     AppData destructive mutation / session save-to-disk, no auth, Chinese-first.
//   • No golden/package/lockfile change.
//
// The forbidden-import bans are scoped to the Focus MVP app file set, which
// EXCLUDES IronPathApp.swift (it legitimately links IronPathCloudSync as the
// iOS-1 bootstrap linked-packages proof).
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const repoFile = (p: string): string => resolve(repoRoot, p);

const APP_DIR = 'ios/IronPath';
const TD_DIR = 'ios/packages/IronPathTrainingDecision/Sources/IronPathTrainingDecision';

// The Focus MVP presentation surface (excludes IronPathApp.swift).
const MVP_FILES = [
  'FocusModeShellView.swift',
  'FocusModePreviewData.swift',
  'FocusModeExerciseCard.swift',
  'FocusModeStatusSurfaceView.swift',
  'FocusSessionProgressView.swift',
  'FocusSetChecklistView.swift',
  'FocusModeMvpState.swift',
  'FocusSessionCompletionView.swift',
  'FocusSavedSessionPreviewView.swift',
  'ContentView.swift',
];

const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const appExists = (name: string): boolean => existsSync(repoFile(`${APP_DIR}/${name}`));
const appCode = (name: string): string => stripSwiftComments(readFileSync(repoFile(`${APP_DIR}/${name}`), 'utf8'));
const mvpCode = (): string => MVP_FILES.filter(appExists).map(appCode).join('\n');
const sliceEngine = (): string =>
  stripSwiftComments(readFileSync(repoFile(`${TD_DIR}/TrainingDecisionCoreSliceEngine.swift`), 'utf8'));
const statusView = (): string => appCode('FocusModeStatusSurfaceView.swift');
const stateCode = (): string => appCode('FocusModeMvpState.swift');

// ---- 1-2. Deload exposure (Lane A + Lane B status surface) ----

describe('iOS-8 deload exposure', () => {
  it('1. TrainingDecisionCoreSlice declares public let deload: DeloadDecision', () => {
    expect(sliceEngine()).toMatch(/public\s+let\s+deload\s*:\s*DeloadDecision/);
  });
  it('1b. buildTrainingDecisionFromCleanInput wires the computed deload (not a fabricated literal)', () => {
    const s = sliceEngine();
    // the local is computed via buildAdaptiveDeloadDecision and assigned to the field
    expect(s).toMatch(/let\s+deload\s*=\s*TrainingDecisionDeload\.buildAdaptiveDeloadDecision/);
    expect(s).toMatch(/\n\s*deload:\s*deload,/);
    // must NOT assign a fabricated default like `deload: DeloadDecision(`
    expect(s).not.toMatch(/deload:\s*DeloadDecision\s*\(/);
  });
  it('2. FocusModeStatusSurfaceView reads slice.deload and no longer shows a deferred dash', () => {
    const v = statusView();
    expect(v).toMatch(/slice\.deload\.(level|strategy)\b/);
    expect(v).not.toMatch(/deload \(deferred\)/);
    // the 减载档位 row no longer hardcodes "—"
    expect(v).not.toMatch(/"减载档位"\s*,\s*value:\s*"—"/);
  });
});

// ---- 3-5. Local session draft / completion / in-memory tracking ----

describe('iOS-8 local session shell (in-memory only)', () => {
  it('3. local session draft/state exists (stage + completed summary)', () => {
    const s = stateCode();
    expect(s).toMatch(/enum\s+FocusSessionStage/);
    expect(s).toMatch(/struct\s+FocusCompletedSessionSummary/);
    expect(s).toMatch(/completedSummary\s*:\s*FocusCompletedSessionSummary\?/);
  });
  it('4. complete-session UI exists', () => {
    expect(appExists('FocusSessionCompletionView.swift')).toBe(true);
    expect(appExists('FocusSavedSessionPreviewView.swift')).toBe(true);
    expect(stateCode()).toMatch(/func\s+completeSession\b/);
    expect(mvpCode()).toMatch(/完成本次训练/);
  });
  it('5. completed-set tracking stays in-memory (dictionary, clamped) with no disk path', () => {
    const s = stateCode();
    expect(s).toMatch(/completedSetsByExerciseId\s*:\s*\[String\s*:\s*Int\]/);
    expect(s).toMatch(/func\s+completeOneSet\b[\s\S]*min\s*\(/);
    // the snapshot is built in RAM; no FileManager/disk write in the state class
    expect(s).not.toMatch(/\bFileManager\b/);
  });
});

// ---- 6-12, 16-21. Forbidden imports / persistence / runtime / cloud / auth ----

describe('iOS-8 forbidden imports, persistence, runtime, cloud, auth are absent', () => {
  const code = mvpCode();

  it('6. no HealthKit import', () => {
    expect(code).not.toMatch(/^\s*import\s+HealthKit\s*$/m);
  });
  it('7. no IronPathCloudSync import (in the Focus MVP files)', () => {
    expect(code).not.toMatch(/^\s*import\s+IronPathCloudSync\b/m);
  });
  it('8. no Supabase import', () => {
    expect(code).not.toMatch(/^\s*import\s+Supabase\w*\b/m);
  });
  it('9. no WebKit import', () => {
    expect(code).not.toMatch(/^\s*import\s+WebKit\s*$/m);
  });
  it('10. no URLSession / URLRequest / NSURLSession (network)', () => {
    expect(code).not.toMatch(/\bURLSession\b/);
    expect(code).not.toMatch(/\bURLRequest\b/);
    expect(code).not.toMatch(/\bNSURLSession\b/);
  });
  it('11. no JavaScriptCore / JSContext / JSValue / WKWebView (JS runtime bridge)', () => {
    expect(code).not.toMatch(/\bimport\s+JavaScriptCore\b/);
    expect(code).not.toMatch(/\bJSContext\b/);
    expect(code).not.toMatch(/\bJSValue\b/);
    expect(code).not.toMatch(/\bWKWebView\b/);
  });
  it('12. no TypeScript / JS runtime reference (node_modules / .ts/.js path strings)', () => {
    expect(code).not.toMatch(/\bnode_modules\b/);
    expect(code).not.toMatch(/[`"'][^`"'\n]*\.(ts|tsx|js|mjs|cjs)[`"']/);
  });
  it('16. no SwiftData / CoreData (unless approved — not approved here)', () => {
    expect(code).not.toMatch(/^\s*import\s+SwiftData\s*$/m);
    expect(code).not.toMatch(/^\s*import\s+CoreData\s*$/m);
    expect(code).not.toMatch(/@Model\b/);
    expect(code).not.toMatch(/\bNSManagedObject\b/);
  });
  it('17. no SQLite (unless approved — not approved here)', () => {
    expect(code).not.toMatch(/^\s*import\s+SQLite3?\b/m);
    expect(code).not.toMatch(/\bsqlite3_/);
  });
  it('18. no AppData destructive mutation / session save-complete-to-store', () => {
    expect(code).not.toMatch(/\b(AppData|AppDataStore)\b[^\n]*\.(write|save|persist|update|mutate|delete)\b/);
    expect(code).not.toMatch(/\b(saveSession|persistSession|commitSession|deleteSession)\b/);
  });
  it('19. no cloud upload/download', () => {
    expect(code).not.toMatch(/\b(upload|download|cloudSync|syncToCloud|pushToCloud|pullFromCloud)\b/i);
  });
  it('20. no auth / account', () => {
    expect(code).not.toMatch(/\b(signIn|signUp|logIn|logOut|authenticate|GoTrue|currentUser|accessToken)\b/);
  });
});

// ---- 5b / persistence boundary: no disk egress across the WHOLE ios/IronPath/
//        app tree (directory-scoped, so any FUTURE file is covered too — closes
//        the gap left by hardcoded MVP_FILES lists). ----

describe('iOS-8 no on-disk persistence anywhere under ios/IronPath/', () => {
  // Whole-app-target scan, not a hardcoded list. IronPathApp.swift is included
  // (it has no disk egress); only the cloud-IMPORT ban excludes it elsewhere.
  //
  // iOS-9 supersedes the iOS-8 "no disk" boundary for ONE sanctioned, app-local
  // JSON store file. Its disk egress is locked instead by
  // iosLocalJsonPersistenceStaticGuards (Application Support only, atomic write,
  // backup-before-overwrite, scoped clear, no cloud). Every OTHER file under
  // ios/IronPath/ — all presentation files — stays under the iOS-8 no-disk lock.
  const SANCTIONED_IOS9_PERSISTENCE = new Set(['LocalSessionSnapshotStore.swift']);
  const wholeAppTreeCode = (): string =>
    readdirSync(repoFile(APP_DIR))
      .filter((f) => f.endsWith('.swift') && !SANCTIONED_IOS9_PERSISTENCE.has(f))
      .map((f) => stripSwiftComments(readFileSync(repoFile(`${APP_DIR}/${f}`), 'utf8')))
      .join('\n');

  it('no FileManager / UserDefaults / Keychain / disk-write egress (in-RAM Codable is allowed)', () => {
    const code = wholeAppTreeCode();
    expect(code).not.toMatch(/\bFileManager\b/);
    expect(code).not.toMatch(/\bUserDefaults\b/);
    expect(code).not.toMatch(/\bKeychain\b/);
    expect(code).not.toMatch(/\.documentDirectory\b/);
    expect(code).not.toMatch(/Data\s*\(\s*contentsOf:/);
    expect(code).not.toMatch(/\.write\s*\(\s*to:/);
  });
});

// ---- 21b. No real user export fixture referenced by the app sample ----

describe('iOS-8 sample data is synthetic only', () => {
  it('21. Focus MVP files do not reference the real-export fixture', () => {
    expect(mvpCode()).not.toMatch(/real-export|redacted-2026/);
  });
});

// ---- 22. Chinese-first labels ----

describe('iOS-8 Chinese-first labels remain', () => {
  const cjk = /[一-鿿]/;
  it('22. shell + status surface + completion + preview carry CJK labels', () => {
    expect(cjk.test(appCode('FocusModeShellView.swift'))).toBe(true);
    expect(cjk.test(statusView())).toBe(true);
    expect(cjk.test(appCode('FocusSessionCompletionView.swift'))).toBe(true);
    expect(cjk.test(appCode('FocusSavedSessionPreviewView.swift'))).toBe(true);
    // the in-memory/local-only disclaimer is present
    expect(appCode('FocusSessionCompletionView.swift')).toMatch(/仅本机|无云同步/);
  });
});

// ---- 23-24. Doc + iOS-4B6 deferred (documented) ----

describe('iOS-8 docs', () => {
  const docPath = 'docs/ios-native-migration/IOS_8_NATIVE_LOCAL_TRAINING_MVP_MEGA_MIGRATION_V1.md';
  it('23. migration doc exists with a manual Simulator smoke checklist', () => {
    expect(existsSync(repoFile(docPath))).toBe(true);
    const doc = readFileSync(repoFile(docPath), 'utf8');
    expect(doc).toMatch(/[Ss]imulator smoke/);
  });
  it('24. doc records iOS-4B6 remains deferred / parallel', () => {
    const doc = readFileSync(repoFile(docPath), 'utf8');
    expect(doc).toMatch(/4B6/);
    expect(doc).toMatch(/defer/i);
  });
});

// ---- 13. No golden fixture changes ----

describe('iOS-8 parity goldens unchanged', () => {
  it('13. parity --check still 57 fixtures / 0 changed', () => {
    const result = spawnSync(
      process.execPath,
      [repoFile('scripts/generate-parity-goldens.mjs'), '--check'],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    expect(result.status, `stderr: ${result.stderr}\nstdout: ${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/checked\s+66\s+fixture/);
    expect(result.stdout).toMatch(/0\s+changed/);
  }, 240_000);
});

// ---- 14-15, 25. No package/lockfile change; no pnpm-lock; no deploy ----

describe('iOS-8 package.json / lockfile unchanged; no deploy', () => {
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
  const diffAgainstBase = (paths: string[]): string => {
    const base = resolveBaseRef();
    const r = spawnSync('git', ['diff', '--name-only', base, '--', ...paths], {
      cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error(`git diff against ${base} failed: ${r.stderr}`);
    return r.stdout.trim();
  };

  it('14. package.json + package-lock.json byte-identical to main', () => {
    expect(diffAgainstBase(['package.json'])).toBe('');
    expect(diffAgainstBase(['package-lock.json'])).toBe('');
  });
  it('15. no pnpm-lock.yaml / yarn.lock', () => {
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
    expect(existsSync(repoFile('yarn.lock'))).toBe(false);
  });
  it('25. no deployment command in the Focus MVP files', () => {
    expect(mvpCode()).not.toMatch(/\b(vercel|netlify|gh-pages|deploy)\b/i);
  });
});
