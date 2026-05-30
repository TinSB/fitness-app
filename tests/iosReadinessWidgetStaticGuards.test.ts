import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// W-1 Readiness Widget V1 — static guards.
//
// Locks the W-1 surface (an APPROVED capability ungating, master §5/§12/§17/§18
// amended in the same PR): a home-screen WidgetKit widget showing today's readiness,
// fed by a small DERIVED read-only snapshot the app writes to a shared App Group.
// Hard boundary:
//   • New Foundation-only, standalone package `IronPathWidgetShared` carrying the
//     pure `ReadinessWidgetSnapshot` (+ codec) + `ReadinessWidgetPresentation`
//     (snapshot → view state, honest placeholder) + the `WidgetSnapshotStore` /
//     `WidgetReloading` seams. The real App Group FileManager store + the WidgetKit
//     reloader are `#if os(iOS)`.
//   • Thin app-layer `WidgetSnapshotWriterModel` (never imports WidgetKit /
//     FileManager, never writes canonical AppData) publishes the derived snapshot.
//   • The widget extension target READS the snapshot and renders it — READ-ONLY: it
//     never writes the snapshot, never writes canonical AppData, never hits the
//     network. The App Group share is a derived presentation record, never a source
//     of truth (§8/§12).
//   • WidgetKit is confined to the widget target + the one reloader file.
//   • App Group entitlement on BOTH the app and the widget, same identifier.
// ---------------------------------------------------------------------------

const repoRoot = resolve(process.cwd());
const repoFile = (p: string): string => resolve(repoRoot, p);

const PKG = 'ios/packages/IronPathWidgetShared';
const PKG_SRC = `${PKG}/Sources/IronPathWidgetShared`;
const APP = 'ios/IronPath';
const WIDGET = 'ios/IronPathWidget';
const DOC = 'docs/ios-native-migration/IOS_W1_READINESS_WIDGET_V1.md';
const RELOADER = `${PKG_SRC}/WidgetTimelineReloader.swift`;

const exists = (p: string): boolean => existsSync(repoFile(p));
const stripSwiftComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const raw = (p: string): string => readFileSync(repoFile(p), 'utf8');
const code = (p: string): string => stripSwiftComments(raw(p));

const collectSwift = (dir: string, out: string[] = []): string[] => {
  const abs = repoFile(dir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === '.build' || entry.name === 'DerivedData') continue;
      collectSwift(rel, out);
    } else if (entry.name.endsWith('.swift')) {
      out.push(rel);
    }
  }
  return out;
};

// ---- 1-3. Package: Foundation-only, standalone ----

describe('W-1 IronPathWidgetShared package', () => {
  it('1. package files exist (Package.swift + version umbrella + model + mapper + seam + #if-os store + reloader + tests)', () => {
    expect(exists(`${PKG}/Package.swift`)).toBe(true);
    expect(exists(`${PKG_SRC}/IronPathWidgetShared.swift`)).toBe(true);
    expect(exists(`${PKG_SRC}/ReadinessWidgetSnapshot.swift`)).toBe(true);
    expect(exists(`${PKG_SRC}/ReadinessWidgetPresentation.swift`)).toBe(true);
    expect(exists(`${PKG_SRC}/WidgetSnapshotSeam.swift`)).toBe(true);
    expect(exists(`${PKG_SRC}/AppGroupWidgetSnapshotStore.swift`)).toBe(true);
    expect(exists(RELOADER)).toBe(true);
    expect(exists(`${PKG}/Tests/IronPathWidgetSharedTests/IronPathWidgetSharedTests.swift`)).toBe(true);
  });

  it('2. Package.swift is Foundation-only + standalone (iOS 17, one library, no package dependency, tools 5.9)', () => {
    const m = raw(`${PKG}/Package.swift`);
    expect(m).toMatch(/swift-tools-version:\s*5\.9/);
    expect(m).toMatch(/platforms\s*:\s*\[\s*\.iOS\(\s*\.v17\s*\)\s*\]/);
    expect((m.match(/\.library\(/g) ?? []).length).toBe(1);
    expect(m).toMatch(/\.library\(\s*name:\s*"IronPathWidgetShared"/);
    expect(m).not.toMatch(/\.package\s*\(/);
  });

  it('3. the version umbrella exports only the bootstrap version constant', () => {
    const m = code(`${PKG_SRC}/IronPathWidgetShared.swift`);
    expect(m).toMatch(/public\s+enum\s+IronPathWidgetSharedVersion\b/);
    expect(m).toMatch(/public\s+static\s+let\s+value\s*=\s*"0\.0\.1-bootstrap"/);
    const publicDecls = m.match(/^\s*public\s+(struct|class|enum|protocol|actor|func|var|let)\b/gm) ?? [];
    expect(publicDecls.length).toBeLessThanOrEqual(1);
  });
});

// ---- 4-6. Pure model + mapper + seam ----

describe('W-1 pure snapshot + presentation + seam', () => {
  it('4. ReadinessWidgetSnapshot is a Codable derived record with a JSON codec + App Group config', () => {
    const m = code(`${PKG_SRC}/ReadinessWidgetSnapshot.swift`);
    expect(m).toMatch(/struct\s+ReadinessWidgetSnapshot\s*:\s*[^\n{]*\bCodable\b/);
    expect(m).toMatch(/enum\s+ReadinessWidgetSnapshotCodec\b/);
    expect(m).toMatch(/appGroupIdentifier\s*=\s*"group\.com\.ironpath\.app\.ios"/);
    // schema validation on decode (no misread of a future version)
    expect(m).toMatch(/acceptedSchemaVersions/);
  });

  it('5. ReadinessWidgetPresentation maps snapshot → view state with an honest placeholder, injected now', () => {
    const m = code(`${PKG_SRC}/ReadinessWidgetPresentation.swift`);
    expect(m).toMatch(/struct\s+ReadinessWidgetViewState\b/);
    expect(m).toMatch(/func\s+viewState\s*\(\s*from\s+snapshot:\s*ReadinessWidgetSnapshot\?,\s*now:\s*Date\s*\)/);
    expect(m).toMatch(/isPlaceholder/);
    // injected clock, never an inline Date()
    expect(m).not.toMatch(/Date\s*\(\s*\)/);
  });

  it('6. the seams exist; the #if os(iOS) App Group store + the WidgetKit reloader are the real impls', () => {
    const seam = code(`${PKG_SRC}/WidgetSnapshotSeam.swift`);
    expect(seam).toMatch(/protocol\s+WidgetSnapshotStore\b/);
    expect(seam).toMatch(/protocol\s+WidgetReloading\b/);
    // App Group store: iOS-only, real FileManager App Group container.
    expect(raw(`${PKG_SRC}/AppGroupWidgetSnapshotStore.swift`)).toMatch(/#if\s+os\(iOS\)/);
    expect(code(`${PKG_SRC}/AppGroupWidgetSnapshotStore.swift`)).toMatch(/containerURL\(forSecurityApplicationGroupIdentifier:/);
    // Reloader: iOS-only, the only WidgetKit importer in the package.
    expect(raw(RELOADER)).toMatch(/#if\s+os\(iOS\)/);
    expect(code(RELOADER)).toMatch(/^\s*import\s+WidgetKit\s*$/m);
  });
});

// ---- 7-8. App writer: derived-only, no WidgetKit/FileManager, no AppData ----

describe('W-1 app-layer writer', () => {
  const writer = (): string => code(`${APP}/WidgetSnapshotWriterModel.swift`);

  it('7. the writer publishes via the seams and never imports WidgetKit / FileManager', () => {
    expect(exists(`${APP}/WidgetSnapshotWriterModel.swift`)).toBe(true);
    const m = writer();
    expect(m).toMatch(/^\s*import\s+IronPathWidgetShared\b/m);
    expect(m).toMatch(/func\s+publish\b/);
    // uses the package seams, NOT the frameworks directly
    expect(m).not.toMatch(/^\s*import\s+WidgetKit\b/m);
    expect(m).not.toMatch(/\bFileManager\b/);
    expect(m).not.toMatch(/\bUserDefaults\b/);
  });

  it('8. the writer never writes canonical AppData (derived share only)', () => {
    const m = writer();
    expect(m).not.toMatch(/\bAppData\b/);
    expect(m).not.toMatch(/\bAppDataStore\b/);
    // and the Today surface wires the publish on its .task
    expect(code(`${APP}/TodayRootView.swift`)).toMatch(/widgetWriter\.publish\s*\(/);
  });
});

// ---- 9-11. Widget extension target: read-only, WidgetKit-confined ----

describe('W-1 widget extension target', () => {
  it('9. the widget target files exist (@main bundle + the readiness widget)', () => {
    expect(exists(`${WIDGET}/IronPathWidgetBundle.swift`)).toBe(true);
    expect(exists(`${WIDGET}/ReadinessWidget.swift`)).toBe(true);
    expect(exists(`${WIDGET}/Info.plist`)).toBe(true);
    expect(exists(`${WIDGET}/IronPathWidget.entitlements`)).toBe(true);
    expect(raw(`${WIDGET}/IronPathWidgetBundle.swift`)).toMatch(/@main/);
    expect(raw(`${WIDGET}/Info.plist`)).toMatch(/com\.apple\.widgetkit-extension/);
  });

  it('10. the widget READS the snapshot via the seam and is read-only (no snapshot write, no AppData, no network)', () => {
    const widgetCode = collectSwift(WIDGET).map(code).join('\n');
    // reads via the store seam + renders the pure view state
    expect(widgetCode).toMatch(/\.read\s*\(/);
    expect(widgetCode).toMatch(/ReadinessWidgetPresentation\.viewState/);
    // read-only: no snapshot write, no canonical AppData, no network
    expect(widgetCode).not.toMatch(/\.write\s*\(/);
    expect(widgetCode).not.toMatch(/\bAppData\b/);
    expect(widgetCode).not.toMatch(/\bURLSession\b/);
    expect(widgetCode).not.toMatch(/\bURLRequest\b/);
  });

  it('11. WidgetKit is confined to the widget target + the single package reloader', () => {
    const importers = collectSwift('ios')
      .filter((f) => /^\s*import\s+WidgetKit\s*$/m.test(stripSwiftComments(readFileSync(repoFile(f), 'utf8'))));
    for (const f of importers) {
      const allowed = f.startsWith(`${WIDGET}/`) || f === RELOADER;
      expect(allowed, `unexpected WidgetKit import in: ${f}`).toBe(true);
    }
    // and at least the reloader + the widget files hold it (sanity: not zero)
    expect(importers.length).toBeGreaterThanOrEqual(2);
  });
});

// ---- 12. App Group entitlement on both sides, same id ----

describe('W-1 App Group entitlements', () => {
  it('12. both the app and the widget declare the SAME App Group', () => {
    const appEnt = raw(`${APP}/IronPath.entitlements`);
    const widgetEnt = raw(`${WIDGET}/IronPathWidget.entitlements`);
    for (const ent of [appEnt, widgetEnt]) {
      expect(ent).toContain('com.apple.security.application-groups');
      expect(ent).toContain('group.com.ironpath.app.ios');
    }
  });
});

// ---- 13. pbxproj: the widget app-extension target + embed phase ----

describe('W-1 project wiring', () => {
  it('13. the project carries the widget app-extension target + embeds it', () => {
    const pbx = raw('ios/IronPath.xcodeproj/project.pbxproj');
    expect(pbx).toContain('product-type.app-extension');
    expect(pbx).toContain('IronPathWidgetExtension.appex');
    expect(pbx).toContain('Embed App Extensions');
    expect(pbx).toContain('relativePath = packages/IronPathWidgetShared;');
  });
});

// ---- 14. Documentation ----

describe('W-1 docs', () => {
  it('14. the W-1 doc records the App Group derived-only share + privacy + a Simulator smoke checklist', () => {
    expect(exists(DOC)).toBe(true);
    const doc = raw(DOC);
    expect(doc).toMatch(/[Ss]imulator/);
    expect(doc).toMatch(/App Group/);
    expect(doc).toMatch(/derived|read-only|只读|派生/i);
    expect(doc).toMatch(/privacy|on-device|隐私|本机|不出/i);
  });
});
