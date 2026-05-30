# W-1 — Readiness Home-Screen Widget V1

> **Status: shipped.** First **home-screen widget** capability ungating — and the
> first **second native target** (a WidgetKit app extension). Approved by the
> architecture owner per `docs/ios-native-migration/IOS_NATIVE_CAPABILITY_UNGATING_ROADMAP_V1.md`
> §4.3 (App Group + read-only derived snapshot). This slice amends the binding
> contract `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`
> **§2 / §5 / §6.1 / §6.3 / §12 / §17 / §18 / §27** in the same PR (master §1.1).
>
> **Baseline:** latest `origin/main` (N-1 #430).

## 1. What this unlocks

A home-screen widget that shows today's readiness / next-training summary. The app
writes a small **DERIVED read-only snapshot** to a shared **App Group** container; the
widget reads that snapshot and renders it. Purely local, on-device, no network.

The widget is **read-only**: it NEVER writes canonical AppData and the App Group share
is NEVER a source of truth (same posture as the LocalSnapshot history record, §12).

## 2. Architecture (HK-1 / N-1 paradigm: pure logic + seams + `#if os(iOS)` real impl)

A new **Foundation-only, standalone** package `IronPathWidgetShared`
(`ios/packages/IronPathWidgetShared`) — the 12th local package, shared by the app and
the widget extension. It carries plain Strings, so it needs no `IronPathDomain` /
`IronPathTrainingDecision` edge (master §6.3).

| File | Role |
| --- | --- |
| `Sources/IronPathWidgetShared/IronPathWidgetShared.swift` | Version umbrella only (`IronPathWidgetSharedVersion = "0.0.1-bootstrap"`). |
| `ReadinessWidgetSnapshot.swift` | The DERIVED snapshot (`schemaVersion` / `generatedAtIso` / `headline` / `advice` / `rows`) + a pure JSON codec (schema-validated on decode) + `WidgetSharedConfig` (the App Group id + filename). Plain Strings; NOT canonical AppData. |
| `ReadinessWidgetPresentation.swift` | **Pure** `viewState(from: snapshot?, now:)` → `ReadinessWidgetViewState`, with an HONEST placeholder when there is no snapshot. Injected clock — deterministic, unit-tested. |
| `WidgetSnapshotSeam.swift` | The `WidgetSnapshotStore` (read/write) + `WidgetReloading` (reload) seams. |
| `AppGroupWidgetSnapshotStore.swift` | The real App Group `FileManager` store (`containerURL(forSecurityApplicationGroupIdentifier:)`, atomic write), `#if os(iOS)`. |
| `WidgetTimelineReloader.swift` | The real WidgetKit reloader — the **only** file in the package that imports WidgetKit, `#if os(iOS)`. |
| `Tests/.../IronPathWidgetSharedTests.swift` | Pure codec round-trip + schema rejection + view-state mapping (populated / placeholder / row-cap / freshness footnote) + a host fake store. |

App layer (`ios/IronPath/`, thin per master §15):

- `WidgetSnapshotWriterModel.swift` — `@MainActor` view-model. Opts into the real App
  Group store + WidgetKit reloader `#if os(iOS)` on launch, builds a
  `ReadinessWidgetSnapshot` from the already-computed `TodayReadinessSummary`, writes
  it via the store seam, and reloads via the reloader seam. **Never imports WidgetKit
  / FileManager** (uses the seams); **never writes canonical AppData**; a write failure
  is swallowed (no fake success).
- `TodayRootView.swift` — the 今日 surface owns the writer and `publish`es on its
  `.task` (it already computes the readiness summary).

Widget extension target (`ios/IronPathWidget/`, a new `IronPathWidgetExtension`
app-extension target):

- `IronPathWidgetBundle.swift` — `@main WidgetBundle`.
- `ReadinessWidget.swift` — the `Widget` + `TimelineProvider` (READS the snapshot via
  the store seam, maps with the pure presentation) + the SwiftUI view. Read-only.
- `Info.plist` (`NSExtensionPointIdentifier = com.apple.widgetkit-extension`) +
  `IronPathWidget.entitlements` (the App Group).

## 3. App Group — derived read-only share (privacy)

- **One App Group** `group.com.ironpath.app.ios` is declared in BOTH the app's
  `IronPath.entitlements` and the widget's `IronPathWidget.entitlements`.
- The shared file (`readiness-widget-snapshot.json`) is a **derived presentation
  record**: the **app writes** it, the **widget reads** it. It is **never** read back
  as a source of truth and **never** touches canonical AppData (§8/§12).
- **On-device only.** No iCloud, no network, no remote push. The snapshot is built
  on-device from the local readiness computation and never leaves the device.
- Local notifications / widgets need no special privacy usage string; the App Group is
  the only added entitlement.

## 4. Source-of-truth & data safety

- **None.** The widget is read-only; the App Group snapshot is derived and never a
  source of truth; canonical AppData, the engine, and parity goldens are untouched.

## 5. Project / target change (justified `project.pbxproj` edit)

- A **second native target** `IronPathWidgetExtension` (`com.apple.product-type.app-extension`,
  bundle id `com.ironpath.app.ios.IronPathWidget`) with its own Sources/Frameworks/
  Resources phases + build config (deploy 26.0, `SKIP_INSTALL`, the widget
  entitlements). The app target gains an **Embed App Extensions** copy phase + a target
  dependency so building the app scheme builds + embeds the widget.
- The 12th `XCLocalSwiftPackageReference` (`IronPathWidgetShared`), linked by both
  targets. App Group entitlement added to the app's entitlements (alongside HK-1's
  HealthKit) + a new widget entitlements file.
- This is the sanctioned reason to add a target + App Group (roadmap §4.3, master §5/§18).

## 6. Static guards (master §22)

- `tests/iosBootstrapTargetSettings.test.ts` — now expects **2 native targets** (1
  application + 1 app-extension) and `>=` package-product-dependency links (the widget
  re-links the shared package); adds `IronPathWidgetShared` to its package list.
- `tests/iosBootstrapPackageGraph.test.ts` — adds `IronPathWidgetShared`
  (Foundation-only, standalone).
- `tests/iosReadinessWidgetStaticGuards.test.ts` — the dedicated W-1 boundary: package
  Foundation-only, pure snapshot/codec/mapper, `#if os(iOS)` App Group store, WidgetKit
  confined to the widget target + the one reloader, the widget is read-only (no
  snapshot write, no canonical AppData, no network), the App Group entitlement on both
  sides, and this doc.

## 7. Validation

- `swift test --package-path ios/packages/IronPathWidgetShared` (pure codec/mapper; the
  `#if os(iOS)` store + reloader are excluded on host).
- `npm run api:dev:build && npm run typecheck && npm test && npm run build`.
- `git diff --check`; `package.json` / `package-lock.json` byte-identical.
- `xcodebuild` both destinations (`generic/platform=iOS` + `iPhone 17 Pro` Simulator),
  `CODE_SIGNING_ALLOWED=NO` — this builds AND embeds the widget extension
  (`ValidateEmbeddedBinary .../PlugIns/IronPathWidgetExtension.appex`).

## 8. Manual Simulator / device smoke checklist

Signing + the App Group + on-device widget rendering require a signed build, so these
are **manual** steps on a signing-capable machine/device (this CI/build environment uses
`CODE_SIGNING_ALLOWED=NO` and does not verify signing):

1. Build + run the app on a device/Simulator with a real team + the App Group
   capability provisioned for both the app and the `IronPathWidgetExtension`.
2. Open the 今日 tab once (this publishes the derived snapshot to the App Group).
3. Long-press the home screen → add the **IronPath「今日准备度」** widget (small or
   medium). Confirm it shows the readiness headline / advice / a couple of rows + the
   freshness footnote.
4. Before opening 今日 on a fresh install, confirm the widget shows the HONEST
   placeholder (`暂无今日概览 · 打开 IronPath 今日页生成`), never fabricated readiness.
5. Confirm there is **no** network activity and the widget never writes anything back —
   it only reads the derived App Group snapshot.

## 9. Follow-ups (deferred)

- **W-2** — more widget families / Lock Screen; a real-data snapshot once a canonical
  AppData read path lands (today the readiness is the deterministic sample, as on the
  今日 surface).
- Remote/cloud widget data remains **forbidden** (server required → master §17).
