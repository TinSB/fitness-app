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
  // Stop Condition #9: HealthKit lands in iOS-8, not iOS-1.
  { name: 'HealthKit_import', stopCondition: '#9 (HealthKit deferred)', pattern: /^\s*import\s+HealthKit\s*$/m },
  { name: 'HKHealthStore_symbol', stopCondition: '#9 (HealthKit deferred)', pattern: /\bHKHealthStore\b/ },
  { name: 'HKQuantityType_symbol', stopCondition: '#9 (HealthKit deferred)', pattern: /\bHKQuantityType\b/ },
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

  for (const { name, stopCondition, pattern } of FORBIDDEN) {
    it(`iosBootstrap forbids ${name} (${stopCondition})`, () => {
      const hits: string[] = [];
      for (const file of swiftFiles) {
        const text = stripComments(readFileSync(file, 'utf8'));
        if (pattern.test(text)) {
          hits.push(file.replace(`${repoRoot}/`, ''));
        }
      }
      expect(hits, `${name} found in: ${hits.join(', ')}`).toEqual([]);
    });
  }
});
