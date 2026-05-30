import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-1 Xcode Project Bootstrap V1 — forbidden imports lock.
//
// Scans every .swift file under ios/ and fails if any of the iOS-1
// forbidden imports / symbols appears. Each entry maps to a stop condition
// from the Entry Gate or a cross-review revision.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

// HK-1 (HealthKit Body-Weight Import V1): the SINGLE sanctioned, read-only
// HealthKit adapter. It is the ONLY iOS Swift file allowed to import HealthKit /
// use HKHealthStore / HKQuantityType (master §6.2/§17/§18, amended in the same
// PR). Every other Swift file under ios/ stays HealthKit-free. The dedicated
// block at the bottom of this file asserts this file is the sole holder of the
// HealthKit tokens AND that it is read-only (no write-back — that is HK-3).
const HEALTHKIT_READ_ADAPTER =
  'ios/packages/IronPathHealthKit/Sources/IronPathHealthKit/HealthKitBodyMassSource.swift';

const collectSwiftFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.build' || entry.name === 'DerivedData') continue;
      collectSwiftFiles(full, out);
    } else if (entry.name.endsWith('.swift')) {
      out.push(full);
    }
  }
  return out;
};

interface ForbiddenPattern {
  readonly name: string;
  readonly stopCondition: string;
  readonly pattern: RegExp;
  /** HK-1: a single repo-relative path exempt from THIS pattern (the approved
   *  read-only HealthKit adapter). The ban still applies to every other file. */
  readonly allowInFile?: string;
}

// Each pattern is matched against actual code, not comments. The
// `^\s*import …$` anchors prevent `import IronPathHealthKit` from
// matching the `HealthKit` forbidden import. Symbol patterns use
// word boundaries so e.g. `WKWebView` doesn't match prose mentioning
// `WKWebViewDocumentation`. Comments (`//`) and doc-comment lines
// (`///`) are stripped before matching so the docs in placeholder
// source files can reference forbidden names without tripping the
// guard.
const FORBIDDEN: readonly ForbiddenPattern[] = [
  // Stop Condition #1: no WebView wrapper.
  { name: 'WebKit_import', stopCondition: '#1 (WebView)', pattern: /^\s*import\s+WebKit\s*$/m },
  { name: 'WKWebView_symbol', stopCondition: '#1 (WebView)', pattern: /\bWKWebView\b/ },
  // Stop Condition #2: no background sync.
  { name: 'BackgroundTasks_import', stopCondition: '#2 (background sync)', pattern: /^\s*import\s+BackgroundTasks\s*$/m },
  { name: 'BGTaskScheduler_symbol', stopCondition: '#2 (background sync)', pattern: /\bBGTaskScheduler\b/ },
  { name: 'BGAppRefreshTask_symbol', stopCondition: '#2 (background sync)', pattern: /\bBGAppRefreshTask\b/ },
  // HK-1: HealthKit READ-ONLY body-weight import is APPROVED (master §17/§18,
  // amended in the HK-1 PR). The HealthKit framework + HKHealthStore/HKQuantityType
  // are permitted ONLY in the single read-only adapter file (`allowInFile`); every
  // other ios Swift file stays HealthKit-free. Write-back (HK-3) is still deferred.
  { name: 'HealthKit_import', stopCondition: 'HK-1 (read-only adapter only)', pattern: /^\s*import\s+HealthKit\s*$/m, allowInFile: HEALTHKIT_READ_ADAPTER },
  { name: 'HKHealthStore_symbol', stopCondition: 'HK-1 (read-only adapter only)', pattern: /\bHKHealthStore\b/, allowInFile: HEALTHKIT_READ_ADAPTER },
  { name: 'HKQuantityType_symbol', stopCondition: 'HK-1 (read-only adapter only)', pattern: /\bHKQuantityType\b/, allowInFile: HEALTHKIT_READ_ADAPTER },
  // Persistence: JSON-snapshot first. SwiftData / CoreData need explicit thresholds (Agent 3).
  { name: 'SwiftData_import', stopCondition: 'Agent 3 storage choice', pattern: /^\s*import\s+SwiftData\s*$/m },
  { name: 'CoreData_import', stopCondition: 'Agent 3 storage choice', pattern: /^\s*import\s+CoreData\s*$/m },
  { name: 'NSManagedObject_symbol', stopCondition: 'Agent 3 storage choice', pattern: /\bNSManagedObject\b/ },
  // Cross-review Revision H2: supabase-swift SDK requires user approval before iOS-7.
  { name: 'Supabase_import', stopCondition: 'Cross-review H2', pattern: /^\s*import\s+Supabase\s*$/m },
  { name: 'GoTrue_import', stopCondition: 'Cross-review H2', pattern: /^\s*import\s+GoTrue\s*$/m },
  { name: 'PostgREST_import', stopCondition: 'Cross-review H2', pattern: /^\s*import\s+PostgREST\s*$/m },
  // Stop Condition #8: no analytics / crash / Firebase SDK in V1.
  { name: 'Sentry_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+Sentry\s*$/m },
  { name: 'Crashlytics_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+Crashlytics\s*$/m },
  { name: 'Firebase_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+Firebase\s*$/m },
  { name: 'Bugsnag_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+Bugsnag\s*$/m },
  { name: 'Datadog_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+Datadog\s*$/m },
  { name: 'Mixpanel_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+Mixpanel\s*$/m },
  { name: 'Amplitude_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+Amplitude\s*$/m },
  { name: 'PostHog_import', stopCondition: '#8 (analytics SDK)', pattern: /^\s*import\s+PostHog\s*$/m },
  // iOS-1 does NO network. iOS-7 introduces the network layer.
  { name: 'URLSession_call', stopCondition: 'iOS-7 (network layer)', pattern: /\bURLSession\(/ },
];

// Strip single-line `//` and `///` comments so the placeholder source
// files can reference forbidden names in prose without tripping the
// guard. We intentionally do NOT strip `/* … */` blocks; iOS-1 source
// uses single-line comments only.
const stripComments = (text: string): string =>
  text
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('//');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');

describe('iosBootstrapForbiddenImports', () => {
  const swiftFiles = collectSwiftFiles(resolve(repoRoot, 'ios'));

  it('iosBootstrap discovered at least the 8 package sources + the 8 tests + the app target sources', () => {
    // 8 packages × 2 swift files (source + test) + 2 app target = 18 minimum.
    expect(swiftFiles.length).toBeGreaterThanOrEqual(18);
  });

  for (const { name, stopCondition, pattern, allowInFile } of FORBIDDEN) {
    it(`iosBootstrap forbids ${name} (${stopCondition})`, () => {
      const hits: string[] = [];
      for (const file of swiftFiles) {
        const rel = file.replace(`${repoRoot}/`, '');
        // HK-1: the sanctioned read-only adapter is exempt from THIS pattern only.
        if (allowInFile && rel === allowInFile) continue;
        const text = stripComments(readFileSync(file, 'utf8'));
        if (pattern.test(text)) {
          hits.push(rel);
        }
      }
      expect(hits, `${name} found in: ${hits.join(', ')}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// HK-1 read-only HealthKit adapter boundary.
//
// The HealthKit-token exemption above is bounded by these assertions: exactly
// ONE file holds the tokens, and it is read-only (requests an empty share set,
// never writes back). This is the guard that ships with the HK-1 capability
// ungating (master §22 — every new boundary ships with a guard).
// ---------------------------------------------------------------------------

describe('iosBootstrap HK-1 read-only HealthKit adapter boundary', () => {
  const swiftFiles = collectSwiftFiles(resolve(repoRoot, 'ios'));
  const adapterAbs = resolve(repoRoot, HEALTHKIT_READ_ADAPTER);
  const healthKitTokens: ReadonlyArray<RegExp> = [
    /^\s*import\s+HealthKit\s*$/m,
    /\bHKHealthStore\b/,
    /\bHKQuantityType\b/,
  ];

  it('the sanctioned read-only adapter file exists', () => {
    expect(swiftFiles.includes(adapterAbs)).toBe(true);
  });

  it('the adapter is the ONLY ios Swift file that uses HealthKit tokens', () => {
    for (const token of healthKitTokens) {
      const holders = swiftFiles
        .filter((f) => token.test(stripComments(readFileSync(f, 'utf8'))))
        .map((f) => f.replace(`${repoRoot}/`, ''));
      expect(holders, `HealthKit token ${token} found in: ${holders.join(', ')}`)
        .toEqual([HEALTHKIT_READ_ADAPTER]);
    }
  });

  it('the adapter is READ-ONLY (empty share set, no write-back to Apple Health)', () => {
    const code = stripComments(readFileSync(adapterAbs, 'utf8'));
    // Read authorization shares NOTHING.
    expect(code).toMatch(/toShare:\s*\[\s*\]/);
    // No write path: no HKHealthStore.save(...) and no sample construction.
    expect(code).not.toMatch(/\.save\s*\(/);
    expect(code).not.toMatch(/HKQuantitySample\s*\(/);
  });

  it('the adapter is compiled iOS-only (#if os(iOS)) so host swift test excludes it', () => {
    // Read raw (not comment-stripped): the directive is real code.
    expect(readFileSync(adapterAbs, 'utf8')).toMatch(/#if\s+os\(iOS\)/);
  });
});
