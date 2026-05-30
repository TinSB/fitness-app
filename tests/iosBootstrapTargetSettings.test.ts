import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-1 Xcode Project Bootstrap V1 — target settings lock.
//
// Parses ios/IronPath.xcodeproj/project.pbxproj for the load-bearing
// build settings: iOS 17.0 deployment target, iPhone-only device family,
// Swift 5.9, no remote SwiftPM reference, nine local package refs.
//
// iOS-5 Native Focus Mode Shell V1 evolved the linked-packages count from
// 8 → 9 by adding IronPathTrainingDecision to the IronPath app target so
// FocusModeShellView can consume buildTrainingDecisionFromCleanInput.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());

const pbxproj = (): string =>
  readFileSync(resolve(repoRoot, 'ios/IronPath.xcodeproj/project.pbxproj'), 'utf8');

const PACKAGES = [
  'IronPathDomain',
  'IronPathDataHealth',
  'IronPathPersistence',
  'IronPathCloudSync',
  'IronPathHealthKit',
  'IronPathBackup',
  'IronPathL10n',
  'IronPathUIKit',
  'IronPathTrainingDecision',
  // iOS-12: pure local-snapshot logic extracted into a real Swift package so it
  // can carry XCTest unit tests; the app target links it like the others.
  'IronPathLocalSnapshot',
  // N-1: local rest-timer notification package; the app target links it like the
  // others (11th XCLocalSwiftPackageReference + product dependency).
  'IronPathNotifications',
  // W-1: readiness-widget shared package (12th). Linked by BOTH the app (writes the
  // derived snapshot) AND the widget extension target (reads it) — see the
  // product-dependency count note below.
  'IronPathWidgetShared',
] as const;

describe('iosBootstrapTargetSettings', () => {
  it('iosBootstrap deployment target is iOS 17.0', () => {
    const text = pbxproj();
    const occurrences = (text.match(/IPHONEOS_DEPLOYMENT_TARGET = 17\.0/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2); // Debug + Release at minimum
    // Any other deployment target value would be a regression.
    expect(text).not.toMatch(/IPHONEOS_DEPLOYMENT_TARGET = (1[0-6]\.|17\.[1-9])/);
  });

  it('iosBootstrap targeted device family is iPhone-only (no iPad / Mac / Watch)', () => {
    const text = pbxproj();
    const occurrences = (text.match(/TARGETED_DEVICE_FAMILY = 1/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
    // 1,2 = iPhone+iPad. 1,2,4 = adds Watch. 1,2,7 = adds Vision Pro.
    expect(text).not.toMatch(/TARGETED_DEVICE_FAMILY = "1,2"/);
    expect(text).not.toMatch(/TARGETED_DEVICE_FAMILY = "1,2,4"/);
    expect(text).not.toMatch(/TARGETED_DEVICE_FAMILY = "1,2,7"/);
  });

  it('iosBootstrap Swift version is 5.9', () => {
    const text = pbxproj();
    expect(text).toMatch(/SWIFT_VERSION = 5\.9/);
  });

  it('iosBootstrap bundle identifier is the iOS-1 placeholder', () => {
    const text = pbxproj();
    expect(text).toMatch(/PRODUCT_BUNDLE_IDENTIFIER = com\.ironpath\.app\.ios/);
  });

  it('iosBootstrap project carries one XCLocalSwiftPackageReference entry per local package', () => {
    const text = pbxproj();
    const refs = text.match(/isa = XCLocalSwiftPackageReference/g) ?? [];
    expect(refs.length).toBe(PACKAGES.length);
    for (const pkg of PACKAGES) {
      expect(text).toContain(`relativePath = packages/${pkg};`);
    }
  });

  it('iosBootstrap project links at least one XCSwiftPackageProductDependency entry per local package', () => {
    const text = pbxproj();
    const deps = text.match(/isa = XCSwiftPackageProductDependency/g) ?? [];
    // The app target links all PACKAGES. W-1 additionally links IronPathWidgetShared
    // into the widget extension target (a SECOND product-dependency object for that
    // one shared package), so the total is >= PACKAGES.length — not exactly equal.
    expect(deps.length).toBeGreaterThanOrEqual(PACKAGES.length);
    for (const pkg of PACKAGES) {
      // Each productName must appear.
      expect(text).toContain(`productName = ${pkg};`);
    }
  });

  it('iosBootstrap project has no remote SwiftPM reference', () => {
    const text = pbxproj();
    // Remote refs use XCRemoteSwiftPackageReference (with a `repositoryURL` field).
    expect(text).not.toContain('XCRemoteSwiftPackageReference');
    expect(text).not.toMatch(/repositoryURL\s*=/);
  });

  it('iosBootstrap project has the IronPath app target + the W-1 widget app-extension target', () => {
    const text = pbxproj();
    const targets = text.match(/isa = PBXNativeTarget/g) ?? [];
    // W-1 added the IronPathWidgetExtension widget target → exactly 2 native targets.
    expect(targets.length).toBe(2);
    // Exactly one application product (the app) and exactly one app-extension (the
    // W-1 widget). No other extension/target types crept in.
    expect((text.match(/productType = "com\.apple\.product-type\.application"/g) ?? []).length).toBe(1);
    expect((text.match(/productType = "com\.apple\.product-type\.app-extension"/g) ?? []).length).toBe(1);
  });

  it('iosBootstrap project carries an asset catalog reference', () => {
    const text = pbxproj();
    expect(text).toContain('Assets.xcassets in Resources');
  });
});
