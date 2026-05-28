import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-0 Contract Fixture Export V1 — static guards.
//
// iOS-0 MUST finish before iOS-1 (Xcode Project Bootstrap) opens. These
// guards fail if any iOS-1 artefact accidentally lands in this PR
// (Xcode project, Swift sources, SwiftPM manifest), or if any new
// third-party dependency / lockfile drift sneaks in.
//
// Cross-reference: docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md §18 stop
// conditions; docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md
// §11 tests.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

const tracked = (): string[] => {
  // git ls-files returns every tracked + currently-staged file. We use
  // this rather than readdir + ignore parsing so the test is exactly
  // what git would commit.
  const out = execSync('git ls-files', { cwd: repoRoot, encoding: 'utf8' });
  return out.split('\n').filter((line) => line.length > 0);
};

const staged = (): string[] => {
  // Includes files staged for commit (`A`/`M`/`R`) so the guard catches
  // an iOS-1 artefact added in the current diff before commit.
  const out = execSync(
    'git diff --cached --name-only --diff-filter=ACMR',
    { cwd: repoRoot, encoding: 'utf8' },
  );
  return out.split('\n').filter((line) => line.length > 0);
};

describe('iosContractFixture — no Xcode artefacts in this PR (Stop Condition #6)', () => {
  it('iosContractFixture no IronPath.xcodeproj exists at repo root', () => {
    expect(existsSync(resolve(repoRoot, 'IronPath.xcodeproj'))).toBe(false);
  });

  it('iosContractFixture no .xcworkspace exists at repo root', () => {
    expect(existsSync(resolve(repoRoot, 'IronPath.xcworkspace'))).toBe(false);
  });

  it('iosContractFixture no tracked .xcodeproj / .xcworkspace / .pbxproj path outside ios/ (Stop Condition #6 evolved by iOS-1)', () => {
    // iOS-0 forbade ANY Xcode artefact in the tree. iOS-1 Xcode Project
    // Bootstrap V1 now sanctions one under ios/. The guard evolves: still
    // forbidden at the repo root, still forbidden in any directory OTHER
    // than ios/, AND the iOS-1 design doc must accompany the artefact
    // (so the workspace can only arrive via the sanctioned task).
    const offenders = tracked().filter(
      (f) =>
        !f.startsWith('ios/') &&
        (f.endsWith('.xcodeproj') ||
          f.endsWith('.xcworkspace') ||
          f.endsWith('.pbxproj') ||
          f.includes('/IronPath.xcodeproj/') ||
          f.includes('/IronPath.xcworkspace/')),
    );
    expect(offenders).toEqual([]);
    const iosArtefacts = tracked().filter(
      (f) =>
        f.startsWith('ios/') &&
        (f.endsWith('.pbxproj') || f.includes('/IronPath.xcodeproj/') || f.includes('/IronPath.xcworkspace/')),
    );
    if (iosArtefacts.length > 0) {
      expect(
        existsSync(
          resolve(repoRoot, 'docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md'),
        ),
        'ios/IronPath.xcodeproj exists but the iOS-1 design doc is missing — the scaffolding arrived outside the sanctioned task',
      ).toBe(true);
    }
  });
});

describe('iosContractFixture — Swift sources only under ios/ (iOS-1 sanctioned tree)', () => {
  it('iosContractFixture no .swift file lives outside ios/', () => {
    // iOS-0 forbade every .swift file in the tree. After iOS-1 lands,
    // .swift files under ios/ are sanctioned; anywhere else is still
    // forbidden.
    const offenders = tracked().filter((f) => f.endsWith('.swift') && !f.startsWith('ios/'));
    expect(offenders).toEqual([]);
  });

  it('iosContractFixture no Package.swift at repo root; Package.swift only under ios/packages/', () => {
    expect(existsSync(resolve(repoRoot, 'Package.swift'))).toBe(false);
    const offenders = tracked().filter(
      (f) => f.endsWith('Package.swift') && !f.startsWith('ios/packages/'),
    );
    expect(offenders).toEqual([]);
  });

  it('iosContractFixture no tracked Package.resolved / .swiftpm directory', () => {
    // Package.resolved and .swiftpm/ are user-local caches; they must
    // never be committed regardless of where they appear.
    const offenders = tracked().filter(
      (f) => f.endsWith('Package.resolved') || f.startsWith('.swiftpm/') || f.includes('/.swiftpm/'),
    );
    expect(offenders).toEqual([]);
  });

  it('iosContractFixture if Swift sources exist, the iOS-1 design doc must exist', () => {
    const swift = tracked().filter((f) => f.endsWith('.swift'));
    if (swift.length > 0) {
      expect(
        existsSync(
          resolve(repoRoot, 'docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md'),
        ),
        '.swift sources exist but the iOS-1 design doc is missing — Swift arrived outside the sanctioned task',
      ).toBe(true);
    }
  });

  it('iosContractFixture staged diff introduces no .swift / Package.swift / .xcodeproj path outside ios/', () => {
    const offenders = staged().filter(
      (f) =>
        !f.startsWith('ios/') &&
        (f.endsWith('.swift') ||
          f.endsWith('Package.swift') ||
          f.endsWith('Package.resolved') ||
          f.endsWith('.xcodeproj') ||
          f.endsWith('.xcworkspace') ||
          f.endsWith('.pbxproj') ||
          f.startsWith('.swiftpm/') ||
          f.includes('/.swiftpm/')),
    );
    expect(offenders).toEqual([]);
  });
});

describe('iosContractFixture — no third-party dependency drift', () => {
  it('iosContractFixture package.json has no dependency change vs origin/main', () => {
    // If origin/main is unreachable (offline run), the command exits
    // non-zero with "ambiguous argument" — that's OK and we skip; the
    // CI run on GitHub will always have origin/main.
    let diff = '';
    try {
      diff = execSync(
        'git diff origin/main -- package.json package-lock.json yarn.lock pnpm-lock.yaml',
        { cwd: repoRoot, encoding: 'utf8' },
      );
    } catch {
      return; // origin/main not available (e.g., shallow clone in test sandbox)
    }
    expect(diff).toBe('');
  });

  it('iosContractFixture pnpm-lock.yaml does not exist', () => {
    expect(existsSync(resolve(repoRoot, 'pnpm-lock.yaml'))).toBe(false);
  });

  it('iosContractFixture package.json declares no new SwiftPM-style dependency', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(repoRoot, 'package.json'), 'utf8'),
    ) as Record<string, unknown>;
    const allDeps = {
      ...(pkg.dependencies as Record<string, string> | undefined),
      ...(pkg.devDependencies as Record<string, string> | undefined),
    };
    for (const name of Object.keys(allDeps)) {
      // Heuristic: no SwiftPM packages should ever appear under npm.
      expect(name.toLowerCase()).not.toContain('supabase-swift');
      expect(name.toLowerCase()).not.toContain('swift-snapshot');
    }
  });
});

describe('iosContractFixture — design doc + tasks doc + contract freeze cross-reference iOS-0', () => {
  it('iosContractFixture entry-gate doc references the canonical fixture path', () => {
    const entry = readFileSync(
      resolve(repoRoot, 'docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md'),
      'utf8',
    );
    expect(entry).toContain('tests/fixtures/parity/');
    // The Entry Gate references iOS-0 in several forms — match the canonical
    // task name without locking parenthesisation.
    expect(entry).toMatch(/iOS-0[\s(]+Contract Fixture Export V1/);
  });

  it('iosContractFixture iOS-0 design doc exists under docs/ios-native-migration/', () => {
    expect(
      existsSync(
        resolve(repoRoot, 'docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md'),
      ),
    ).toBe(true);
  });

  it('iosContractFixture design doc names the 5 fixture categories', () => {
    const doc = readFileSync(
      resolve(repoRoot, 'docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md'),
      'utf8',
    );
    for (const required of [
      'snapshot-hash-stable-v1',
      'normal-session-v1',
      'session-lifecycle-residue-v1',
      'redacted-2026-05-27',
      'golden-path-session-v1',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('iosContractFixture design doc forbids creating an Xcode project in iOS-0', () => {
    const doc = readFileSync(
      resolve(repoRoot, 'docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md'),
      'utf8',
    );
    // The doc must reference the stop-condition forbiddance.
    expect(doc).toMatch(/no\s+xcode/i);
    expect(doc).toMatch(/no\s+swift/i);
  });
});
