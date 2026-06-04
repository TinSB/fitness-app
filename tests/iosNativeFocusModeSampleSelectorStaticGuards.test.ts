import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-6 Focus Mode Sample Selector + Severe-Rest / Productive-Floor Demos V1
// — static guards.
//
// iOS-6 extends the iOS-5 shell with a deterministic-sample picker. The
// FocusModeShellView gains a segmented Picker bound to a
// FocusModeSampleScenario enum (normal / productiveFloor / severeRest);
// FocusModePreviewData fans out per-scenario sessions + the acutePainReported
// metadata flag and re-runs the real engine pipeline for each. The UI labels
// are Chinese-first / bilingual.
//
// This file locks the iOS-6 surface: the scenario enum exists with the three
// required cases, the shell mounts a Picker / segmented control, each
// scenario still routes through buildCleanAppDataView →
// createCleanTrainingDecisionInput → buildTrainingDecisionFromCleanInput, the
// summary card still shows the six top-level slice fields, the shell still
// consumes slice.perExercise / WorkingSetTarget.targetSets, and the forbidden
// imports (HealthKit / CloudSync / Supabase / WebKit / JavaScriptCore /
// URLSession) + AppData mutation + TS/JS runtime bridge are all still absent.
// Parity fixtures and package.json / lockfile are unchanged.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

const APP_DIR = 'ios/IronPath';

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

const previewData = (): string => stripSwiftComments(readShell('FocusModePreviewData.swift'));
const shell = (): string => stripSwiftComments(readShell('FocusModeShellView.swift'));
const summary = (): string => stripSwiftComments(readShell('TrainingDecisionSummaryView.swift'));
const card = (): string => stripSwiftComments(readShell('FocusModeExerciseCard.swift'));
const allShellCode = (): string => stripSwiftComments(SHELL_FILES.map(readShell).join('\n'));

// ---- 1. FocusModeSampleScenario enum exists ----

describe('iOS-6 FocusModeSampleScenario enum', () => {
  it('iOS-6 declares enum FocusModeSampleScenario', () => {
    // Live in FocusModePreviewData (or any of the shell files).
    expect(allShellCode()).toMatch(/\benum\s+FocusModeSampleScenario\b/);
  });
  it('iOS-6 FocusModeSampleScenario is CaseIterable (so the Picker can iterate it)', () => {
    expect(allShellCode()).toMatch(/\benum\s+FocusModeSampleScenario[^{]*\bCaseIterable\b/);
  });
});

// ---- 2. Picker / segmented selector in FocusModeShellView ----

describe('iOS-6 FocusModeShellView hosts a segmented sample selector', () => {
  it('iOS-6 shell declares a Picker', () => {
    expect(shell()).toMatch(/\bPicker\b/);
  });
  it('iOS-6 shell uses segmented Picker style', () => {
    expect(shell()).toMatch(/\.pickerStyle\s*\(\s*\.segmented\s*\)/);
  });
  it('iOS-6 shell binds the Picker to a FocusModeSampleScenario state', () => {
    // The Picker must iterate the scenario enum. iOS-6 held the scenario as a
    // local `@State ... FocusModeSampleScenario`; iOS-7 moved it onto a
    // @StateObject FocusModeMvpState (`selectedScenario: FocusModeSampleScenario`)
    // and binds the Picker via a Binding (scenarioBinding / state.setScenario).
    // Accept EITHER mechanism — the load-bearing property is "a segmented Picker
    // driven by FocusModeSampleScenario", not which property wrapper holds it.
    const s = shell();
    const localState = /@State[^\n]*\bFocusModeSampleScenario\b/.test(s);
    const objectState =
      /@StateObject[\s\S]*FocusModeMvpState/.test(s) &&
      (/\bselectedScenario\b/.test(s) || /\bsetScenario\b/.test(s) || /\bscenarioBinding\b/.test(s));
    expect(localState || objectState, 'shell must hold scenario as @State or via FocusModeMvpState').toBe(true);
    expect(s).toMatch(/ForEach\s*\(\s*FocusModeSampleScenario\.allCases\s*\)/);
  });
});

// ---- 3-5. Three scenarios present ----

describe('iOS-6 three required scenarios are declared', () => {
  it('iOS-6 case normal exists', () => {
    expect(allShellCode()).toMatch(/\bcase\s+normal\b/);
  });
  it('iOS-6 case productiveFloor exists', () => {
    expect(allShellCode()).toMatch(/\bcase\s+productiveFloor\b/);
  });
  it('iOS-6 case severeRest exists', () => {
    expect(allShellCode()).toMatch(/\bcase\s+severeRest\b/);
  });
});

// ---- 6-8. Real engine pipeline calls ----

describe('iOS-6 sample data still routes through the real engine pipeline', () => {
  it('iOS-6 FocusModePreviewData calls buildCleanAppDataView', () => {
    expect(previewData()).toMatch(/\bbuildCleanAppDataView\s*\(/);
  });
  it('iOS-6 FocusModePreviewData calls createCleanTrainingDecisionInput', () => {
    expect(previewData()).toMatch(/\bcreateCleanTrainingDecisionInput\s*\(/);
  });
  it('iOS-6 FocusModePreviewData calls buildTrainingDecisionFromCleanInput', () => {
    expect(previewData()).toMatch(/\bbuildTrainingDecisionFromCleanInput\s*\(/);
  });
  it('iOS-6 sampleCoreSlice accepts a FocusModeSampleScenario parameter', () => {
    // Any signature shape — `for: FocusModeSampleScenario` or
    // `(scenario: FocusModeSampleScenario)` — both are acceptable.
    expect(previewData()).toMatch(/\bsampleCoreSlice\s*\([^)]*FocusModeSampleScenario[^)]*\)/);
  });
  it('iOS-6 severeRest threads acutePainReported into CleanTrainingDecisionInputMetadata', () => {
    // The metadata field is the only legal way to reach the severe-rest
    // engine branch without changing Swift packages.
    expect(previewData()).toMatch(/\bacutePainReported\s*:/);
  });
});

// ---- 9. Bilingual / Chinese-first scenario labels ----

describe('iOS-6 scenario labels are Chinese-first or bilingual', () => {
  const cjk = /[一-鿿]/;

  it('iOS-6 scenario labels include CJK characters', () => {
    expect(cjk.test(previewData())).toBe(true);
    expect(cjk.test(shell())).toBe(true);
  });
});

// ---- 10. "Productive floor" / "回归保底" referenced ----

describe('iOS-6 UI mentions the productive-floor scenario by name', () => {
  it('iOS-6 UI surfaces a productive-floor label (回归保底 or Productive Floor)', () => {
    const text = `${previewData()}\n${shell()}`;
    expect(/回归保底|Productive\s*Floor/i.test(text)).toBe(true);
  });
});

// ---- 11. "Severe rest" / "严重恢复" referenced ----

describe('iOS-6 UI mentions the severe-rest scenario by name', () => {
  it('iOS-6 UI surfaces a severe-rest label (严重恢复 or Severe Rest)', () => {
    const text = `${previewData()}\n${shell()}`;
    expect(/严重恢复|Severe\s*Rest/i.test(text)).toBe(true);
  });
});

// ---- 12-15. Summary fields + perExercise still displayed ----

describe('iOS-6 summary card + exercise list still bind the required slice fields', () => {
  it('iOS-6 summary displays activePhase', () => {
    expect(summary()).toMatch(/\bslice\.activePhase\b/);
  });
  it('iOS-6 summary displays sessionIntent', () => {
    expect(summary()).toMatch(/\bslice\.sessionIntent\b/);
  });
  it('iOS-6 summary displays volumeMode', () => {
    expect(summary()).toMatch(/\bslice\.volumeMode\b/);
  });
  it('iOS-6 summary displays intensityMode', () => {
    expect(summary()).toMatch(/\bslice\.intensityMode\b/);
  });
  it('iOS-6 summary displays progressionMode', () => {
    expect(summary()).toMatch(/\bslice\.progressionMode\b/);
  });
  it('iOS-6 summary displays finalVolumeMultiplier', () => {
    expect(summary()).toMatch(/\bslice\.finalVolumeMultiplier\b/);
  });
  it('iOS-6 shell still consumes slice.perExercise', () => {
    expect(shell()).toMatch(/\bslice\.perExercise\b/);
  });
  it('iOS-6 exercise card still displays a target-set badge', () => {
    expect(card()).toMatch(/\brow\.targetSets\b/);
  });
});

// ---- 16-21. Forbidden imports + runtime bridges still absent ----

describe('iOS-6 shell forbidden imports and runtime bridges remain absent', () => {
  it('iOS-6 shell does not import HealthKit', () => {
    expect(allShellCode()).not.toMatch(/^\s*import\s+HealthKit\b/m);
  });
  it('iOS-6 shell does not import IronPathCloudSync', () => {
    expect(allShellCode()).not.toMatch(/^\s*import\s+IronPathCloudSync\b/m);
  });
  it('iOS-6 shell does not import Supabase (any sub-module)', () => {
    expect(allShellCode()).not.toMatch(/^\s*import\s+Supabase\w*\b/m);
  });
  it('iOS-6 shell does not import WebKit', () => {
    expect(allShellCode()).not.toMatch(/^\s*import\s+WebKit\b/m);
  });
  it('iOS-6 shell does not import JavaScriptCore', () => {
    expect(allShellCode()).not.toMatch(/^\s*import\s+JavaScriptCore\b/m);
  });
  it('iOS-6 shell does not reference URLSession / URLRequest / NSURLSession', () => {
    const text = allShellCode();
    expect(text).not.toMatch(/\bURLSession\b/);
    expect(text).not.toMatch(/\bURLRequest\b/);
    expect(text).not.toMatch(/\bNSURLSession\b/);
  });
  it('iOS-6 shell does not bridge into the TypeScript / JS runtime', () => {
    const text = allShellCode();
    expect(text).not.toMatch(/\bJSContext\b/);
    expect(text).not.toMatch(/\bJSValue\b/);
    expect(text).not.toMatch(/\bWKWebView\b/);
    expect(text).not.toMatch(/\bnode_modules\b/);
    expect(text).not.toMatch(/[`"'][^`"'\n]*\.(ts|tsx|js|mjs|cjs)[`"']/);
  });
  it('iOS-6 shell does not mutate AppData', () => {
    expect(allShellCode()).not.toMatch(/\b(AppData|AppDataStore)\b[^\n]*\.(write|save|persist|update|mutate|set)\b/);
  });
});

// ---- 22. No golden fixture drift ----

describe('iOS-6 parity goldens are unchanged', () => {
  it('iOS-6 parity --check still reports 57 fixtures / 0 changed', () => {
    const result = spawnSync(
      process.execPath,
      [repoFile('scripts/generate-parity-goldens.mjs'), '--check'],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    expect(result.status, `stderr: ${result.stderr}\nstdout: ${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/checked\s+89\s+fixture/);
    expect(result.stdout).toMatch(/0\s+changed/);
  }, 240_000);
});

// ---- 23. No package.json / lockfile drift in this PR ----

describe('iOS-6 package.json / lockfile unchanged by this PR', () => {
  // Same CI-aware base-ref resolver as the iOS-5 guards. `origin/main` if
  // present (dev box); otherwise `git fetch --depth=1 origin main` + diff
  // FETCH_HEAD (GitHub Actions shallow clone).
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

  it('iOS-6 package.json is byte-identical to main', () => {
    expect(diffAgainstBase(['package.json'])).toBe('');
  });
  it('iOS-6 package-lock.json is byte-identical to main', () => {
    expect(diffAgainstBase(['package-lock.json'])).toBe('');
  });
  it('iOS-6 no yarn.lock / pnpm-lock.yaml is introduced', () => {
    expect(existsSync(repoFile('yarn.lock'))).toBe(false);
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
  });
});
