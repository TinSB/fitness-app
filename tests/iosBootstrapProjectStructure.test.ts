import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// iOS-1 Xcode Project Bootstrap V1 — project structure lock.
//
// Asserts the canonical layout under ios/ is in place: workspace, xcodeproj,
// shared scheme, app target sources, Info.plist, Assets.xcassets, and the
// 8 local Swift Packages.
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

const exists = (path: string) => existsSync(resolve(repoRoot, path));

describe('iosBootstrapProjectStructure — Xcode workspace + project', () => {
  it('iosBootstrap ios/IronPath.xcworkspace exists', () => {
    expect(exists('ios/IronPath.xcworkspace')).toBe(true);
    expect(exists('ios/IronPath.xcworkspace/contents.xcworkspacedata')).toBe(true);
  });

  it('iosBootstrap ios/IronPath.xcodeproj exists with project.pbxproj and shared scheme', () => {
    expect(exists('ios/IronPath.xcodeproj')).toBe(true);
    expect(exists('ios/IronPath.xcodeproj/project.pbxproj')).toBe(true);
    expect(exists('ios/IronPath.xcodeproj/xcshareddata/xcschemes/IronPath.xcscheme')).toBe(true);
  });

  it('iosBootstrap workspace references the xcodeproj and all 8 packages', () => {
    const xml = readFileSync(
      resolve(repoRoot, 'ios/IronPath.xcworkspace/contents.xcworkspacedata'),
      'utf8',
    );
    expect(xml).toContain('group:IronPath.xcodeproj');
    for (const pkg of PACKAGES) {
      expect(xml).toContain(`group:packages/${pkg}`);
    }
  });

  it('iosBootstrap scheme references the IronPath app target blueprint', () => {
    const xml = readFileSync(
      resolve(repoRoot, 'ios/IronPath.xcodeproj/xcshareddata/xcschemes/IronPath.xcscheme'),
      'utf8',
    );
    expect(xml).toContain('BuildableName = "IronPath.app"');
    expect(xml).toContain('BlueprintName = "IronPath"');
    expect(xml).toContain('container:IronPath.xcodeproj');
  });
});

describe('iosBootstrapProjectStructure — app target sources', () => {
  it('iosBootstrap IronPathApp.swift exists', () => {
    expect(exists('ios/IronPath/IronPathApp.swift')).toBe(true);
  });

  it('iosBootstrap ContentView.swift exists', () => {
    expect(exists('ios/IronPath/ContentView.swift')).toBe(true);
  });

  it('iosBootstrap Info.plist exists with bundle identifier placeholder', () => {
    expect(exists('ios/IronPath/Info.plist')).toBe(true);
    const plist = readFileSync(resolve(repoRoot, 'ios/IronPath/Info.plist'), 'utf8');
    expect(plist).toContain('$(PRODUCT_BUNDLE_IDENTIFIER)');
    // Encryption-export declaration is required at App Store submission;
    // iOS-1 fixes it to false (the Agent 7 design call).
    expect(plist).toContain('ITSAppUsesNonExemptEncryption');
    expect(plist).toContain('<false/>');
  });

  it('iosBootstrap Assets.xcassets exists with AppIcon + AccentColor placeholders', () => {
    expect(exists('ios/IronPath/Assets.xcassets/Contents.json')).toBe(true);
    expect(exists('ios/IronPath/Assets.xcassets/AppIcon.appiconset/Contents.json')).toBe(true);
    expect(exists('ios/IronPath/Assets.xcassets/AccentColor.colorset/Contents.json')).toBe(true);
  });
});

describe('iosBootstrapProjectStructure — 8 local Swift Packages', () => {
  for (const pkg of PACKAGES) {
    it(`iosBootstrap ${pkg}: Package.swift exists`, () => {
      expect(exists(`ios/packages/${pkg}/Package.swift`)).toBe(true);
    });

    it(`iosBootstrap ${pkg}: Sources/${pkg}/${pkg}.swift exists`, () => {
      expect(exists(`ios/packages/${pkg}/Sources/${pkg}/${pkg}.swift`)).toBe(true);
    });

    it(`iosBootstrap ${pkg}: Tests/${pkg}Tests/${pkg}Tests.swift exists`, () => {
      expect(exists(`ios/packages/${pkg}/Tests/${pkg}Tests/${pkg}Tests.swift`)).toBe(true);
    });
  }

  it('iosBootstrap design doc IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md exists', () => {
    expect(exists('docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md')).toBe(true);
  });

  it('iosBootstrap design doc names all 8 packages', () => {
    const doc = readFileSync(
      resolve(repoRoot, 'docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md'),
      'utf8',
    );
    for (const pkg of PACKAGES) {
      expect(doc).toContain(pkg);
    }
  });
});
