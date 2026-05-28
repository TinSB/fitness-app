import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-2B AppData Swift Models V1 — no third-party / no-storage-framework guards.
//
// Scans both `ios/packages/IronPathDomain/Sources/` and `Tests/`, plus
// the package's `Package.swift`, and fails the build if any forbidden
// import / dependency sneaks in.
//
// The list overlaps with `iosBootstrapForbiddenImports.test.ts` but
// is scoped tighter — only IronPathDomain — and adds the
// storage-framework bans (`SwiftData`, `CoreData`) that the iOS-2A
// plan §16 calls out as the highest-risk regression in iOS-2B.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const PACKAGE_ROOT = 'ios/packages/IronPathDomain';

const FORBIDDEN_IMPORTS = [
  'SwiftData',
  'CoreData',
  'HealthKit',
  'Supabase',
  'GoTrue',
  'PostgREST',
  'Sentry',
  'Crashlytics',
  'Firebase',
  'Bugsnag',
  'Datadog',
  'Mixpanel',
  'Amplitude',
  'PostHog',
  'WebKit',
  'BackgroundTasks',
] as const;

const collectSwift = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.build' || entry.name === 'DerivedData') continue;
      out.push(...collectSwift(full));
    } else if (entry.name.endsWith('.swift')) {
      out.push(full);
    }
  }
  return out;
};

const stripLineComments = (text: string): string =>
  text
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('//');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');

describe('iosAppDataNoSwiftDataCoreData — IronPathDomain forbidden-import scan', () => {
  const swiftFiles = collectSwift(resolve(repoRoot, PACKAGE_ROOT));

  it('iosAppDataNoSwiftDataCoreData discovers sources + tests under IronPathDomain', () => {
    // 17 model files + 1 iOS-1 placeholder = 18 sources minimum.
    // 5 new test files + 1 iOS-1 placeholder smoke test = 6 tests minimum.
    // Some files may live under sub-directories.
    expect(swiftFiles.length).toBeGreaterThanOrEqual(18 + 6);
  });

  for (const importName of FORBIDDEN_IMPORTS) {
    it(`iosAppDataNoSwiftDataCoreData no import ${importName}`, () => {
      const pattern = new RegExp(`^\\s*import\\s+${importName}\\s*$`, 'm');
      const hits: string[] = [];
      for (const file of swiftFiles) {
        const stripped = stripLineComments(readFileSync(file, 'utf8'));
        if (pattern.test(stripped)) {
          hits.push(file.replace(`${repoRoot}/`, ''));
        }
      }
      expect(hits, `${importName} import found in: ${hits.join(', ')}`).toEqual([]);
    });
  }
});

describe('iosAppDataNoSwiftDataCoreData — Package.swift remains local-only', () => {
  it('iosAppDataNoSwiftDataCoreData IronPathDomain Package.swift has no .package(url:) / .package(path:)', () => {
    const text = readFileSync(
      resolve(repoRoot, PACKAGE_ROOT, 'Package.swift'),
      'utf8',
    );
    expect(text).not.toMatch(/\.package\s*\(\s*url\s*:/);
    expect(text).not.toMatch(/\.package\s*\(\s*path\s*:/);
    expect(text).not.toMatch(/\.package\s*\(\s*name\s*:/);
  });

  it('iosAppDataNoSwiftDataCoreData IronPathDomain Package.swift adds only `resources: [.copy("Fixtures")]` over iOS-1', () => {
    // iOS-2B's lone permitted Package.swift edit. Asserting the exact
    // resource declaration prevents accidental scope creep.
    const text = readFileSync(
      resolve(repoRoot, PACKAGE_ROOT, 'Package.swift'),
      'utf8',
    );
    expect(text).toMatch(/resources:\s*\[\s*\.copy\(\s*"Fixtures"\s*\)\s*\]/);
  });
});
