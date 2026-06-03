import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-7 Native Focus MVP Bundle V1 — static guards.
//
// 5-in-1 Xcode-led bundle: scenario selector (+ a 4th .deloadWeek scenario),
// the readiness/risk status surface, the native in-session interaction shell,
// in-memory set-progress tracking, and UI polish. This file locks that surface:
// the new files exist, the four scenarios are declared, the engine pipeline is
// still the real one, the required slice fields render, the in-memory state has
// a complete-set + reset action, labels are Chinese-first, and NOTHING reaches
// Cloud / HealthKit / Supabase / WebKit / network / disk persistence
// (FileManager / UserDefaults / SQLite / CoreData / SwiftData) / AppData
// mutation / the TS runtime. Parity fixtures + package.json/lockfile unchanged.
//
// The CloudSync/HealthKit/etc. import bans are scoped to the Focus MVP file set,
// which EXCLUDES IronPathApp.swift — that file legitimately links every local
// package (the iOS-1 bootstrap linked-packages proof, incl. IronPathCloudSync).
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const APP_DIR = 'ios/IronPath';
const repoFile = (p: string): string => resolve(repoRoot, p);

// The Focus MVP surface — every Focus file this bundle created/edited, minus
// IronPathApp.swift (which links IronPathCloudSync as the bootstrap proof).
const MVP_FILES = [
  'FocusModeShellView.swift',
  'FocusModePreviewData.swift',
  'FocusModeExerciseCard.swift',
  'FocusModeStatusSurfaceView.swift',
  'FocusSessionProgressView.swift',
  'FocusSetChecklistView.swift',
  'FocusModeMvpState.swift',
  'ContentView.swift',
];

const readApp = (name: string): string => readFileSync(repoFile(`${APP_DIR}/${name}`), 'utf8');
const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

const fileExists = (name: string): boolean => existsSync(repoFile(`${APP_DIR}/${name}`));
const codeOf = (name: string): string => stripSwiftComments(readApp(name));
// concatenated, comment-stripped MVP code (excludes IronPathApp.swift)
const mvpCode = (): string =>
  MVP_FILES.filter(fileExists).map((f) => stripSwiftComments(readApp(f))).join('\n');
const preview = (): string => codeOf('FocusModePreviewData.swift');
const shell = (): string => codeOf('FocusModeShellView.swift');

// ---- 1-5. Required files exist ----

describe('iOS-7 MVP files exist', () => {
  it('1. FocusModeShellView exists', () => {
    expect(fileExists('FocusModeShellView.swift')).toBe(true);
  });
  it('2. FocusModePreviewData exists', () => {
    expect(fileExists('FocusModePreviewData.swift')).toBe(true);
  });
  it('3. FocusSessionProgressView (or equivalent) exists', () => {
    expect(fileExists('FocusSessionProgressView.swift')).toBe(true);
  });
  it('4. FocusSetChecklistView (or equivalent) exists', () => {
    expect(fileExists('FocusSetChecklistView.swift')).toBe(true);
  });
  it('5. FocusModeMvpState (or equivalent) exists', () => {
    expect(fileExists('FocusModeMvpState.swift')).toBe(true);
  });
});

// ---- 6-9. Scenarios ----

describe('iOS-7 scenario selector', () => {
  it('6. a selector scenario enum exists', () => {
    expect(preview()).toMatch(/\benum\s+FocusModeSampleScenario\b/);
    expect(preview()).toMatch(/CaseIterable/);
  });
  it('7. normal scenario exists', () => {
    expect(preview()).toMatch(/\bcase\s+normal\b/);
  });
  it('8. productiveFloor scenario exists', () => {
    expect(preview()).toMatch(/\bcase\s+productiveFloor\b/);
  });
  it('9. severeRest scenario exists', () => {
    expect(preview()).toMatch(/\bcase\s+severeRest\b/);
  });
});

// ---- 10-12. Real engine pipeline ----

describe('iOS-7 real engine pipeline preserved', () => {
  it('10. FocusModePreviewData calls buildCleanAppDataView', () => {
    expect(preview()).toMatch(/\bbuildCleanAppDataView\s*\(/);
  });
  it('11. FocusModePreviewData calls createCleanTrainingDecisionInput', () => {
    expect(preview()).toMatch(/\bcreateCleanTrainingDecisionInput\s*\(/);
  });
  it('12. FocusModePreviewData calls buildTrainingDecisionFromCleanInput', () => {
    expect(preview()).toMatch(/\bbuildTrainingDecisionFromCleanInput\s*\(/);
  });
});

// ---- 13-17. Required slice fields render ----

describe('iOS-7 UI renders the required TrainingDecision fields', () => {
  const surfaceCode = (): string =>
    [codeOf('FocusModeStatusSurfaceView.swift'), shell()].join('\n');

  it('13. UI displays activePhase', () => {
    expect(surfaceCode()).toMatch(/\bslice\.activePhase\b/);
  });
  it('14. UI displays sessionIntent', () => {
    expect(surfaceCode()).toMatch(/\bslice\.sessionIntent\b/);
  });
  it('15. UI displays volumeMode / intensityMode / progressionMode', () => {
    const s = surfaceCode();
    expect(s).toMatch(/\bslice\.volumeMode\b/);
    expect(s).toMatch(/\bslice\.intensityMode\b/);
    expect(s).toMatch(/\bslice\.progressionMode\b/);
  });
  it('16. UI displays finalVolumeMultiplier', () => {
    expect(surfaceCode()).toMatch(/\bslice\.finalVolumeMultiplier\b/);
  });
  it('17. UI displays target sets / perExercise', () => {
    // Shell consumes slice.perExercise; the card/checklist render targetSets.
    expect(shell()).toMatch(/\bslice\.perExercise\b/);
    expect(mvpCode()).toMatch(/\btargetSets\b/);
  });
});

// ---- 18-20. In-memory progress tracking + actions ----

describe('iOS-7 in-memory set-progress tracking', () => {
  const stateCode = (): string => codeOf('FocusModeMvpState.swift');

  it('18. in-memory completed-set tracking exists', () => {
    expect(stateCode()).toMatch(/completedSetsByExerciseId\s*:\s*\[String\s*:\s*Int\]/);
  });
  it('19. a complete-set action exists (in-memory, clamped)', () => {
    expect(stateCode()).toMatch(/func\s+completeOneSet\b/);
    expect(stateCode()).toMatch(/\bmin\s*\(/); // clamp to target
    // and the shell wires a "完成本组" button to it
    expect(mvpCode()).toMatch(/完成本组/);
  });
  it('20. a reset sample/progress action exists', () => {
    expect(stateCode()).toMatch(/func\s+resetProgress\b/);
    expect(mvpCode()).toMatch(/重置样例/);
    // scenario change resets progress
    expect(stateCode()).toMatch(/func\s+setScenario\b[\s\S]*resetProgress\s*\(/);
  });
});

// ---- 21. Chinese-first / bilingual labels ----

describe('iOS-7 Chinese-first labels', () => {
  const cjk = /[一-鿿]/;
  it('21. UI contains Chinese-first / bilingual labels', () => {
    expect(cjk.test(shell())).toBe(true);
    expect(cjk.test(codeOf('FocusModeStatusSurfaceView.swift'))).toBe(true);
    expect(readApp('FocusModeShellView.swift')).toMatch(
      /本地\s*Swift\s*TrainingDecision\s*·\s*无云同步\s*·\s*无\s*HealthKit/,
    );
  });
});

// ---- 22-31. Forbidden imports / persistence / runtime ----

describe('iOS-7 forbidden imports, persistence, and runtime bridges are absent', () => {
  const code = mvpCode(); // excludes IronPathApp.swift

  it('22. no HealthKit import', () => {
    expect(code).not.toMatch(/^\s*import\s+HealthKit\s*$/m);
  });
  it('23. no IronPathCloudSync import', () => {
    expect(code).not.toMatch(/^\s*import\s+IronPathCloudSync\b/m);
  });
  it('24. no Supabase import', () => {
    expect(code).not.toMatch(/^\s*import\s+Supabase\w*\b/m);
  });
  it('25. no WebKit import', () => {
    expect(code).not.toMatch(/^\s*import\s+WebKit\s*$/m);
  });
  it('26. no URLSession / URLRequest / NSURLSession (network)', () => {
    expect(code).not.toMatch(/\bURLSession\b/);
    expect(code).not.toMatch(/\bURLRequest\b/);
    expect(code).not.toMatch(/\bNSURLSession\b/);
  });
  it('27. no FileManager persistence', () => {
    expect(code).not.toMatch(/\bFileManager\b/);
  });
  it('28. no UserDefaults persistence', () => {
    expect(code).not.toMatch(/\bUserDefaults\b/);
  });
  it('29. no SQLite / CoreData / SwiftData', () => {
    expect(code).not.toMatch(/^\s*import\s+SQLite3?\b/m);
    expect(code).not.toMatch(/^\s*import\s+CoreData\s*$/m);
    expect(code).not.toMatch(/^\s*import\s+SwiftData\s*$/m);
    expect(code).not.toMatch(/\bNSManagedObject\b/);
    expect(code).not.toMatch(/@Model\b/);
  });
  it('30. no AppData mutation / session save-to-store', () => {
    expect(code).not.toMatch(/\b(AppData|AppDataStore)\b[^\n]*\.(write|save|persist|update|mutate|set)\b/);
    // iOS-8 introduces an explicitly IN-MEMORY `completeSession` (builds a RAM
    // snapshot + flips the stage, writes nothing), so the bare method name is no
    // longer banned here. The real persistence verbs stay forbidden — and the
    // iOS-8 mega guard + the whole-ios FileManager/UserDefaults ban lock disk
    // egress directly.
    expect(code).not.toMatch(/\b(saveSession|persistSession|commitSession|deleteSession)\b/);
  });
  it('31. no TypeScript / JS runtime reference', () => {
    expect(code).not.toMatch(/\bJSContext\b/);
    expect(code).not.toMatch(/\bJSValue\b/);
    expect(code).not.toMatch(/\bWKWebView\b/);
    expect(code).not.toMatch(/\bimport\s+JavaScriptCore\b/);
    expect(code).not.toMatch(/\bnode_modules\b/);
    expect(code).not.toMatch(/[`"'][^`"'\n]*\.(ts|tsx|js|mjs|cjs)[`"']/);
  });
});

// ---- 32. No golden fixture changes ----

describe('iOS-7 parity goldens unchanged', () => {
  it('32. parity --check still 57 fixtures / 0 changed', () => {
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

// ---- 33. No package.json / lockfile changes ----

describe('iOS-7 package.json / lockfile unchanged', () => {
  // CI-aware base-ref resolver: origin/main if present, else shallow-fetch main
  // and diff FETCH_HEAD (GitHub Actions shallow clone has no origin/main).
  const resolveBaseRef = (): string => {
    const have = spawnSync('git', ['rev-parse', '--verify', '-q', 'origin/main'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    if (have.status === 0) return 'origin/main';
    const fetched = spawnSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', 'main'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    if (fetched.status !== 0) throw new Error(`cannot resolve base ref: ${fetched.stderr}`);
    return 'FETCH_HEAD';
  };
  const diffAgainstBase = (paths: string[]): string => {
    const base = resolveBaseRef();
    const r = spawnSync('git', ['diff', '--name-only', base, '--', ...paths], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error(`git diff against ${base} failed: ${r.stderr}`);
    return r.stdout.trim();
  };

  it('33. package.json + package-lock.json byte-identical to main; no yarn/pnpm lock', () => {
    expect(diffAgainstBase(['package.json'])).toBe('');
    expect(diffAgainstBase(['package-lock.json'])).toBe('');
    expect(existsSync(repoFile('yarn.lock'))).toBe(false);
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
  });
});
