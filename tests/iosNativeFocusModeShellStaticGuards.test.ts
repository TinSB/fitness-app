import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-5 Native Focus Mode Shell + TrainingDecision Integration V1 —
// static guards.
//
// Xcode-led phase: the iOS app target now hosts a SwiftUI Focus Mode shell
// that consumes IronPathTrainingDecision via the real engine entry
// (buildCleanAppDataView → createCleanTrainingDecisionInput →
// buildTrainingDecisionFromCleanInput) over deterministic in-memory sample
// input. This file LOCKS that surface:
//
//   • The four shell files live under ios/IronPath/ (NOT ios/App/ — the
//     prompt's path assumption is wrong; the actual SwiftUI app target
//     directory is ios/IronPath/).
//   • ContentView routes to FocusModeShellView. (iOS-17S: the app root is now a
//     five-tab TabView; the route is the chain ContentView → TrainingRootView →
//     FocusModeShellView, with TrainingRootView hosting the shell unchanged.)
//   • The shell displays activePhase / sessionIntent / volumeMode /
//     intensityMode / progressionMode / finalVolumeMultiplier and the
//     perExercise target sets.
//   • The shell does NOT import HealthKit / CloudSync / Supabase / WebKit /
//     JavaScriptCore, does NOT use URLSession or any network surface, does
//     NOT mutate AppData, and does NOT bridge into the TypeScript runtime.
//   • UI labels are Chinese-first (with bilingual subtitles where needed).
//   • The IronPath app target's pbxproj links IronPathTrainingDecision via
//     a local package reference.
//   • No golden parity fixture drifted, no package.json / lockfile drift.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

const APP_DIR = 'ios/IronPath';
const PBXPROJ = 'ios/IronPath.xcodeproj/project.pbxproj';

const SHELL_FILES = [
  'FocusModeShellView.swift',
  'FocusModeExerciseCard.swift',
  'TrainingDecisionSummaryView.swift',
  'FocusModePreviewData.swift',
];

const repoFile = (p: string): string => resolve(repoRoot, p);
const readShell = (name: string): string => readFileSync(repoFile(`${APP_DIR}/${name}`), 'utf8');

const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

const concatShellCode = (): string =>
  stripSwiftComments(SHELL_FILES.map(readShell).join('\n'));

const concatShellRaw = (): string => SHELL_FILES.map(readShell).join('\n');

// ---- 1-4. Files exist ----

describe('iOS-5 shell files exist under ios/IronPath/', () => {
  for (const f of SHELL_FILES) {
    it(`iOS-5 ${f} exists under ${APP_DIR}/`, () => {
      expect(existsSync(repoFile(`${APP_DIR}/${f}`))).toBe(true);
    });
  }
});

// ---- 5. App root wires Focus into the tab shell (iOS-17S) ----
//
// iOS-17S relocated the Focus shell under the 训练 tab: the app root is now a
// five-tab TabView (ContentView) whose 训练 tab mounts TrainingRootView, which
// hosts FocusModeShellView() unchanged. The original iOS-5 invariant — "the app
// root wires to FocusModeShellView" — is preserved (and tightened) as the chain
// ContentView → TrainingRootView → FocusModeShellView, locked below.

describe('iOS-17S app root wires Focus into the tab shell', () => {
  it('iOS-17S TrainingRootView.swift hosts FocusModeShellView()', () => {
    expect(stripSwiftComments(readShell('TrainingRootView.swift'))).toMatch(/\bFocusModeShellView\s*\(\s*\)/);
  });
  it('iOS-17S ContentView.swift mounts TrainingRootView() in the TabView shell', () => {
    const content = readShell('../IronPath/ContentView.swift');
    expect(stripSwiftComments(content)).toMatch(/\bTrainingRootView\s*\(\s*\)/);
  });
});

// ---- 6-7. Required imports ----

describe('iOS-5 shell required imports', () => {
  it('iOS-5 FocusModeShellView imports SwiftUI', () => {
    expect(stripSwiftComments(readShell('FocusModeShellView.swift'))).toMatch(/^\s*import\s+SwiftUI\b/m);
  });
  it('iOS-5 FocusModeShellView imports IronPathTrainingDecision', () => {
    expect(stripSwiftComments(readShell('FocusModeShellView.swift'))).toMatch(/^\s*import\s+IronPathTrainingDecision\b/m);
  });
  it('iOS-5 TrainingDecisionSummaryView imports IronPathTrainingDecision', () => {
    expect(stripSwiftComments(readShell('TrainingDecisionSummaryView.swift'))).toMatch(/^\s*import\s+IronPathTrainingDecision\b/m);
  });
});

// ---- 8-14. Required TrainingDecision fields displayed ----

describe('iOS-5 shell displays required TrainingDecision fields', () => {
  // The summary view is the canonical owner of the six top-level fields;
  // the prescription/role-floor fields land in the shell + card.
  const summary = (): string => stripSwiftComments(readShell('TrainingDecisionSummaryView.swift'));
  const shell = (): string => stripSwiftComments(readShell('FocusModeShellView.swift'));
  const card = (): string => stripSwiftComments(readShell('FocusModeExerciseCard.swift'));

  it('iOS-5 summary displays activePhase', () => {
    expect(summary()).toMatch(/\bslice\.activePhase\b/);
  });
  it('iOS-5 summary displays sessionIntent', () => {
    expect(summary()).toMatch(/\bslice\.sessionIntent\b/);
  });
  it('iOS-5 summary displays volumeMode', () => {
    expect(summary()).toMatch(/\bslice\.volumeMode\b/);
  });
  it('iOS-5 summary displays intensityMode', () => {
    expect(summary()).toMatch(/\bslice\.intensityMode\b/);
  });
  it('iOS-5 summary displays progressionMode', () => {
    expect(summary()).toMatch(/\bslice\.progressionMode\b/);
  });
  it('iOS-5 summary displays finalVolumeMultiplier', () => {
    expect(summary()).toMatch(/\bslice\.finalVolumeMultiplier\b/);
  });
  it('iOS-5 shell consumes slice.perExercise to drive the today list', () => {
    expect(shell()).toMatch(/\bslice\.perExercise\b/);
  });
  it('iOS-5 exercise card displays a target-set badge', () => {
    expect(card()).toMatch(/\brow\.targetSets\b/);
  });
});

// ---- 15. Chinese-first / bilingual labels ----

describe('iOS-5 shell contains Chinese-first / bilingual labels', () => {
  it('iOS-5 shell renders at least one CJK label', () => {
    // Look at the RAW source (comments stripped is fine — labels are in
    // string literals, not comments).
    const cjk = /[一-鿿]/;
    expect(cjk.test(stripSwiftComments(readShell('FocusModeShellView.swift')))).toBe(true);
    expect(cjk.test(stripSwiftComments(readShell('TrainingDecisionSummaryView.swift')))).toBe(true);
  });
  it('iOS-5 shell footer contains the required disclaimer', () => {
    expect(readShell('FocusModeShellView.swift')).toMatch(/本地\s*Swift\s*TrainingDecision\s*·\s*无云同步\s*·\s*无\s*HealthKit/);
  });
});

// ---- 16-22. Forbidden imports / runtime bridges ----

describe('iOS-5 shell forbidden imports and runtime bridges', () => {
  const code = concatShellCode();

  it('iOS-5 shell does not import HealthKit', () => {
    expect(code).not.toMatch(/^\s*import\s+HealthKit\b/m);
  });
  it('iOS-5 shell does not import IronPathCloudSync', () => {
    expect(code).not.toMatch(/^\s*import\s+IronPathCloudSync\b/m);
  });
  it('iOS-5 shell does not import Supabase (any sub-module)', () => {
    expect(code).not.toMatch(/^\s*import\s+Supabase\w*\b/m);
  });
  it('iOS-5 shell does not import WebKit', () => {
    expect(code).not.toMatch(/^\s*import\s+WebKit\b/m);
  });
  it('iOS-5 shell does not import JavaScriptCore', () => {
    expect(code).not.toMatch(/^\s*import\s+JavaScriptCore\b/m);
  });
  it('iOS-5 shell does not reference URLSession / URLRequest / NSURLSession', () => {
    expect(code).not.toMatch(/\bURLSession\b/);
    expect(code).not.toMatch(/\bURLRequest\b/);
    expect(code).not.toMatch(/\bNSURLSession\b/);
  });
  it('iOS-5 shell does not mutate AppData (no .write/.save/.persist/.update/.mutate on AppData / AppDataStore)', () => {
    expect(code).not.toMatch(/\b(AppData|AppDataStore)\b[^\n]*\.(write|save|persist|update|mutate|set)\b/);
  });
  it('iOS-5 shell does not reach into the TypeScript / JS runtime', () => {
    // No JS bridge primitives, no Node fs/path imports, no .ts/.js path strings.
    expect(code).not.toMatch(/\bJSContext\b/);
    expect(code).not.toMatch(/\bJSValue\b/);
    expect(code).not.toMatch(/\bWKWebView\b/);
    expect(code).not.toMatch(/\bnode_modules\b/);
    expect(code).not.toMatch(/[`"'][^`"'\n]*\.(ts|tsx|js|mjs|cjs)[`"']/);
  });
});

// ---- 23. No golden fixture changes (parity --check still 49 / 0) ----

describe('iOS-5 parity goldens are unchanged', () => {
  it('iOS-5 parity --check still reports 57 fixtures / 0 changed', () => {
    const result = spawnSync(
      process.execPath,
      [repoFile('scripts/generate-parity-goldens.mjs'), '--check'],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    expect(result.status, `stderr: ${result.stderr}\nstdout: ${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/checked\s+59\s+fixture/);
    expect(result.stdout).toMatch(/0\s+changed/);
  }, 240_000);
});

// ---- 24. No package.json / lockfile drift in this PR ----

describe('iOS-5 package.json / lockfile unchanged by this PR', () => {
  // iOS-5 must not touch package.json or any lockfile. The check resolves a
  // base ref the same way GitHub Actions PR CI does:
  //   1. if `origin/main` is already a valid ref locally, use it (dev box);
  //   2. otherwise fetch `main` from origin shallowly and diff FETCH_HEAD
  //      (CI's actions/checkout default is a shallow clone of the PR head
  //      only — `origin/main` does not exist until we fetch it).
  // The diff runs against the working tree, so a stray dependency added but
  // not yet committed also fails.
  const resolveBaseRef = (): string => {
    const haveOriginMain = spawnSync(
      'git',
      ['rev-parse', '--verify', '-q', 'origin/main'],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    if (haveOriginMain.status === 0) return 'origin/main';
    const fetched = spawnSync(
      'git',
      ['fetch', '--no-tags', '--depth=1', 'origin', 'main'],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    if (fetched.status !== 0) {
      throw new Error(
        `cannot resolve base ref: \`origin/main\` is not a valid ref and \`git fetch origin main\` failed: ${fetched.stderr}`,
      );
    }
    return 'FETCH_HEAD';
  };

  const diffAgainstBase = (paths: string[]): string => {
    const base = resolveBaseRef();
    const result = spawnSync(
      'git',
      ['diff', '--name-only', base, '--', ...paths],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    if (result.status !== 0) {
      throw new Error(`git diff against ${base} failed: ${result.stderr}`);
    }
    return result.stdout.trim();
  };

  it('iOS-5 package.json is byte-identical to main', () => {
    expect(diffAgainstBase(['package.json'])).toBe('');
  });
  it('iOS-5 package-lock.json is byte-identical to main', () => {
    expect(diffAgainstBase(['package-lock.json'])).toBe('');
  });
  it('iOS-5 no yarn.lock / pnpm-lock.yaml is introduced', () => {
    expect(existsSync(repoFile('yarn.lock'))).toBe(false);
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
  });
});

// ---- 25. IronPath app target links IronPathTrainingDecision ----

describe('iOS-5 IronPath app target links IronPathTrainingDecision', () => {
  const pbx = (): string => readFileSync(repoFile(PBXPROJ), 'utf8');

  it('iOS-5 pbxproj declares an XCLocalSwiftPackageReference to packages/IronPathTrainingDecision', () => {
    expect(pbx()).toMatch(/XCLocalSwiftPackageReference[^"]*"packages\/IronPathTrainingDecision"/);
  });
  it('iOS-5 pbxproj registers IronPathTrainingDecision in a Frameworks build phase', () => {
    expect(pbx()).toMatch(/IronPathTrainingDecision\s+in\s+Frameworks/);
  });
  it('iOS-5 pbxproj lists IronPathTrainingDecision as a packageProductDependency entry', () => {
    // The product dependency entry is referenced from the target's
    // packageProductDependencies array via the productRef id.
    expect(pbx()).toMatch(/productRef\s*=\s*\w+\s*\/\*\s*IronPathTrainingDecision\s*\*\//);
  });
});
