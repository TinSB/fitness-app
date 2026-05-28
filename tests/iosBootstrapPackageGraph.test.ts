import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-1 Xcode Project Bootstrap V1 — SwiftPM package graph lock.
//
// Asserts every package is local-only (no remote `.package(url:)`), declares
// iOS 17 as the platform, exposes exactly one library product, and ships
// exactly one test target. Locks Stop Condition #7 (no third-party SwiftPM
// without explicit user approval).
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

const PACKAGES = [
  'IronPathDomain',
  'IronPathDataHealth',
  'IronPathPersistence',
  'IronPathCloudSync',
  'IronPathHealthKit',
  'IronPathBackup',
  'IronPathL10n',
  'IronPathUIKit',
] as const;

const readPackageSwift = (pkg: string): string =>
  readFileSync(resolve(repoRoot, `ios/packages/${pkg}/Package.swift`), 'utf8');

describe('iosBootstrapPackageGraph — every package is local-only', () => {
  for (const pkg of PACKAGES) {
    it(`iosBootstrap ${pkg}: Package.swift declares no remote (or any) package-level dependency`, () => {
      const text = readPackageSwift(pkg);
      // Any `.package(...)` call inside a Package.swift is a package-level
      // dependency declaration — whether `.package(url: ...)` (remote),
      // `.package(path: ...)` (local), or `.package(name: ..., url: ...)`
      // (remote with alias). iOS-1 has none.
      //
      // Note: `.testTarget(..., dependencies: ["IronPath…"])` and
      // `.target(..., dependencies: ["IronPath…"])` are TARGET-level
      // dependencies and reference siblings inside the same package; they
      // are legitimate and must NOT be flagged.
      expect(text).not.toMatch(/\.package\s*\(/);
    });

    it(`iosBootstrap ${pkg}: Package.swift declares iOS 17 platform`, () => {
      const text = readPackageSwift(pkg);
      expect(text).toMatch(/platforms\s*:\s*\[\s*\.iOS\(\s*\.v17\s*\)\s*\]/);
    });

    it(`iosBootstrap ${pkg}: Package.swift exposes exactly one library product named after the package`, () => {
      const text = readPackageSwift(pkg);
      const productMatches = text.match(/\.library\(/g) ?? [];
      expect(productMatches.length).toBe(1);
      expect(text).toMatch(new RegExp(`\\.library\\(\\s*name:\\s*"${pkg}"`));
    });

    it(`iosBootstrap ${pkg}: Package.swift declares exactly one target + one testTarget`, () => {
      const text = readPackageSwift(pkg);
      const targets = text.match(/\.target\(/g) ?? [];
      const testTargets = text.match(/\.testTarget\(/g) ?? [];
      expect(targets.length).toBe(1);
      expect(testTargets.length).toBe(1);
      expect(text).toMatch(new RegExp(`\\.target\\(\\s*name:\\s*"${pkg}"`));
      expect(text).toMatch(new RegExp(`\\.testTarget\\(\\s*name:\\s*"${pkg}Tests"`));
    });

    it(`iosBootstrap ${pkg}: swift-tools-version is 5.9`, () => {
      const text = readPackageSwift(pkg);
      expect(text).toMatch(/swift-tools-version:\s*5\.9/);
    });
  }
});
