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
  // iOS-4B1: TrainingDecision golden type skeleton package (9th package).
  'IronPathTrainingDecision',
] as const;

const readPackageSwift = (pkg: string): string =>
  readFileSync(resolve(repoRoot, `ios/packages/${pkg}/Package.swift`), 'utf8');

/**
 * Per-package whitelist of sanctioned LOCAL-path package dependencies.
 * iOS-3A: IronPathDataHealth and IronPathPersistence need to consume
 * the IronPathDomain typed models, so they declare a single
 * `.package(path: "../IronPathDomain")` entry. Local-path deps stay
 * 100% offline — Stop Condition #7 is about REMOTE third-party
 * SwiftPM, not sibling packages in the same repo.
 *
 * Any non-listed package still gets the original zero-`.package(`
 * lock.
 */
const SANCTIONED_LOCAL_PATH_DEPS: Record<string, readonly string[]> = {
  IronPathDataHealth: ['../IronPathDomain'],
  IronPathPersistence: ['../IronPathDomain'],
  // iOS-4B1: the TrainingDecision type skeleton consumes JSONValue from
  // IronPathDomain only. The engine's IronPathDataHealth dep arrives in 4B2.
  IronPathTrainingDecision: ['../IronPathDomain'],
};

describe('iosBootstrapPackageGraph — every package is local-only', () => {
  for (const pkg of PACKAGES) {
    it(`iosBootstrap ${pkg}: Package.swift declares no remote (or any) package-level dependency`, () => {
      const text = readPackageSwift(pkg);
      // Strip any sanctioned local-path deps before scanning.
      let stripped = text;
      for (const localPath of SANCTIONED_LOCAL_PATH_DEPS[pkg] ?? []) {
        const escapedPath = localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const localPathRe = new RegExp(
          `\\.package\\(\\s*path:\\s*"${escapedPath}"\\s*\\)`,
          'g',
        );
        stripped = stripped.replace(localPathRe, '/* sanctioned-local-dep */');
      }
      // Any remaining `.package(...)` call is a forbidden remote /
      // unsanctioned local dep.
      expect(stripped).not.toMatch(/\.package\s*\(/);
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
