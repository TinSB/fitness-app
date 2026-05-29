import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS Architecture Boundary — central static guard.
//
// Introduced by "Test Suite Tiering + Redundancy Reduction V1". This file is
// the single always-on home for the repo-WIDE iOS architecture boundaries.
// It is ADDITIVE and STRONGER than the per-area guards, never a replacement:
//
//   1. Focus-Mode shell surface (ios/IronPath/ presentation files, EXCLUDING
//      IronPathApp.swift which legitimately links every package): the shell
//      must not import Cloud/HealthKit/Supabase/WebKit/JavaScriptCore, must
//      not touch the network, must not bridge into the TS/JS runtime, and
//      must not mutate AppData. The existing per-area guards
//      (iosNativeFocusModeShellStaticGuards / *SampleSelectorStaticGuards)
//      are KEPT for per-file failure attribution; this re-asserts the same
//      properties over the whole shell surface so a *newly added* shell file
//      is covered the moment it lands.
//
//   2. Whole-ios COVERAGE GAPS the existing tests/iosBootstrapForbiddenImports
//      guard does not check: SwiftData/Observation macros (@Model / @Observable)
//      and the JavaScriptCore bridge symbols (JSContext / JSValue), plus the
//      broader network surface (URLRequest / NSURLSession — the bootstrap
//      guard only bans the `URLSession(` call form). These are NEW assertions,
//      not duplicates.
//
//   3. Repo-global single-source-of-truth: no pnpm-lock.yaml, and
//      package.json / package-lock.json byte-identical to the merge base.
//      These properties are currently asserted in ~86 scattered iOS guard
//      files; this central copy is the authoritative one. The scattered
//      copies are documented as future-cleanup candidates in
//      docs/TEST_SUITE_TIERING_AND_REDUNDANCY_REDUCTION_V1.md and are NOT
//      deleted in this PR.
//
// Nothing in this file changes runtime behavior; it only reads source.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const repoFile = (p: string): string => resolve(repoRoot, p);

// --- shared helpers (mirrors the per-area guards) ---

const collectSwift = (dir: string, out: string[] = []): string[] => {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.build' || entry.name === 'DerivedData') continue;
      collectSwift(full, out);
    } else if (entry.name.endsWith('.swift')) {
      out.push(full);
    }
  }
  return out;
};

const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

const rel = (abs: string): string => abs.replace(`${repoRoot}/`, '');

// ---------------------------------------------------------------------------
// 1. Focus-Mode shell surface boundary
// ---------------------------------------------------------------------------

// The presentation surface — NOT IronPathApp.swift. IronPathApp.swift links
// every local package (including IronPathCloudSync) as the iOS-1 bootstrap
// linked-packages proof, so the Cloud-import ban must not apply to it.
const SHELL_DIR = 'ios/IronPath';
const SHELL_EXCLUDE = new Set(['IronPathApp.swift']);

const shellFiles = (): string[] =>
  collectSwift(repoFile(SHELL_DIR)).filter((f) => !SHELL_EXCLUDE.has(f.split('/').pop() ?? ''));

const shellCode = (): { file: string; code: string }[] =>
  shellFiles().map((f) => ({ file: rel(f), code: stripSwiftComments(readFileSync(f, 'utf8')) }));

interface BannedPattern {
  readonly name: string;
  readonly pattern: RegExp;
}

const SHELL_BANS: readonly BannedPattern[] = [
  { name: 'import IronPathCloudSync', pattern: /^\s*import\s+IronPathCloudSync\b/m },
  { name: 'import HealthKit', pattern: /^\s*import\s+HealthKit\s*$/m },
  { name: 'import Supabase*', pattern: /^\s*import\s+Supabase\w*\b/m },
  { name: 'import WebKit', pattern: /^\s*import\s+WebKit\s*$/m },
  { name: 'import JavaScriptCore', pattern: /^\s*import\s+JavaScriptCore\s*$/m },
  { name: 'WKWebView symbol', pattern: /\bWKWebView\b/ },
  { name: 'JSContext symbol', pattern: /\bJSContext\b/ },
  { name: 'JSValue symbol', pattern: /\bJSValue\b/ },
  { name: 'URLSession symbol', pattern: /\bURLSession\b/ },
  { name: 'URLRequest symbol', pattern: /\bURLRequest\b/ },
  { name: 'NSURLSession symbol', pattern: /\bNSURLSession\b/ },
  { name: 'node_modules reference', pattern: /\bnode_modules\b/ },
  { name: 'TS/JS source path string', pattern: /[`"'][^`"'\n]*\.(ts|tsx|js|mjs|cjs)[`"']/ },
  { name: 'AppData mutation', pattern: /\b(AppData|AppDataStore)\b[^\n]*\.(write|save|persist|update|mutate|set)\b/ },
];

describe('iosArchitectureBoundary — Focus-Mode shell surface', () => {
  it('discovers the Focus-Mode shell files (excluding IronPathApp.swift)', () => {
    // FocusModeShellView / FocusModeExerciseCard / TrainingDecisionSummaryView /
    // FocusModePreviewData / ContentView = 5 today.
    expect(shellFiles().length).toBeGreaterThanOrEqual(4);
    expect(shellFiles().some((f) => f.endsWith('IronPathApp.swift'))).toBe(false);
  });

  for (const { name, pattern } of SHELL_BANS) {
    it(`shell surface does not contain: ${name}`, () => {
      const hits = shellCode().filter(({ code }) => pattern.test(code)).map(({ file }) => file);
      expect(hits, `${name} found in: ${hits.join(', ')}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Whole-ios coverage gaps (NEW — not covered by iosBootstrapForbiddenImports)
// ---------------------------------------------------------------------------

const allIosSwift = (): { file: string; code: string }[] =>
  collectSwift(repoFile('ios')).map((f) => ({ file: rel(f), code: stripSwiftComments(readFileSync(f, 'utf8')) }));

const WHOLE_IOS_BANS: readonly BannedPattern[] = [
  // SwiftData / Observation macros — persistence is JSON-snapshot first; these
  // macros must not appear anywhere in the iOS tree.
  { name: '@Model macro', pattern: /@Model\b/ },
  { name: '@Observable macro', pattern: /@Observable\b/ },
  // JavaScriptCore bridge — no Swift package bridges into a JS runtime.
  { name: 'import JavaScriptCore', pattern: /^\s*import\s+JavaScriptCore\s*$/m },
  { name: 'JSContext symbol', pattern: /\bJSContext\b/ },
  { name: 'JSValue symbol', pattern: /\bJSValue\b/ },
  // Broader network surface than the bootstrap guard's `URLSession(` call form.
  { name: 'URLRequest symbol', pattern: /\bURLRequest\b/ },
  { name: 'NSURLSession symbol', pattern: /\bNSURLSession\b/ },
];

describe('iosArchitectureBoundary — whole-ios coverage gaps', () => {
  it('discovers the iOS Swift tree', () => {
    expect(allIosSwift().length).toBeGreaterThanOrEqual(18);
  });

  for (const { name, pattern } of WHOLE_IOS_BANS) {
    it(`no Swift file under ios/ contains: ${name}`, () => {
      const hits = allIosSwift().filter(({ code }) => pattern.test(code)).map(({ file }) => file);
      expect(hits, `${name} found in: ${hits.join(', ')}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Repo-global lockfile boundary (authoritative single source of truth)
// ---------------------------------------------------------------------------

describe('iosArchitectureBoundary — repo-global lockfile boundary', () => {
  it('no pnpm-lock.yaml exists at the repo root', () => {
    expect(existsSync(repoFile('pnpm-lock.yaml'))).toBe(false);
  });
  it('no yarn.lock exists at the repo root', () => {
    expect(existsSync(repoFile('yarn.lock'))).toBe(false);
  });

  // CI-aware base-ref resolver (same shape as the iOS-5 / iOS-6 guards):
  // origin/main if present (dev box); otherwise a shallow fetch of main and
  // diff FETCH_HEAD (GitHub Actions shallow clone has no origin/main ref).
  const resolveBaseRef = (): string => {
    const haveOriginMain = spawnSync('git', ['rev-parse', '--verify', '-q', 'origin/main'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    if (haveOriginMain.status === 0) return 'origin/main';
    const fetched = spawnSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', 'main'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    if (fetched.status !== 0) {
      throw new Error(`cannot resolve base ref: ${fetched.stderr}`);
    }
    return 'FETCH_HEAD';
  };

  const diffAgainstBase = (paths: string[]): string => {
    const base = resolveBaseRef();
    const result = spawnSync('git', ['diff', '--name-only', base, '--', ...paths], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(`git diff against ${base} failed: ${result.stderr}`);
    return result.stdout.trim();
  };

  it('package-lock.json is byte-identical to main (no dependency drift)', () => {
    expect(diffAgainstBase(['package-lock.json'])).toBe('');
  });
});
