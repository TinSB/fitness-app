# iOS-1 Xcode Project Bootstrap V1

> Status: implementation, skeleton only. **No business logic lands in this PR.**
> No AppData models, no TrainingDecision port, no Data Health port, no
> Focus Mode, no Supabase, no HealthKit, no SwiftData / Core Data, no
> WebView, no background tasks, no analytics SDK.

> Parent docs:
> - `docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md` (§6 recommended strategy + §18 stop conditions)
> - `docs/IOS_NATIVE_MIGRATION_TASKS_V1.md` (iOS-1 section)
> - `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md`
> - `docs/ios-native-migration/IOS_0_CONTRACT_FIXTURE_EXPORT_V1.md` (iOS-0 — the parity bar this skeleton will be measured against)

---

## 1. Goal

Stand up the **minimum** native iOS scaffolding so iOS-2..iOS-10 can land
their actual Swift code against a real Xcode toolchain. iOS-1 ships an
empty SwiftUI app, eight empty local Swift Packages, a workspace that
ties them together, and the static-guard tests that will fail the
moment any business-logic / network / third-party / forbidden import
sneaks in.

iOS-1 deliberately does NOT implement any of the 11 frozen contracts.
That is the job of iOS-2 .. iOS-10. iOS-1 only proves:

- The Xcode toolchain builds the scaffold (`xcodebuild ... build`).
- The 8 module boundaries match Agent 5's architecture map.
- Every stop condition from the Entry Gate has a static guard.
- iOS-0 parity goldens are still green (`scripts/generate-parity-goldens.mjs --check`).

If anyone tries to land more than that in this PR, the iosBootstrap*
guard tests fail.

---

## 2. Non-goals

This PR does NOT add:

- AppData models or schema (iOS-2).
- TrainingDecision engine, CleanAppDataView, repair registry (iOS-3 / iOS-4).
- Focus Mode UI (iOS-5).
- Plan / History / Progress screens (iOS-6).
- Cloud sync / Supabase auth / network (iOS-7).
- HealthKit reads (iOS-8).
- Backup / export / import (folded into iOS-3).
- Third-party SwiftPM dependencies of any kind, including `supabase-swift`. Cross-review Revision H2 remains an outstanding user decision; iOS-1 does not pre-empt it.
- SwiftData / Core Data / Realm / GRDB / any other persistence framework. Agent 3's design recommends a JSON-snapshot first; iOS-2 will introduce the protocol shape.
- WebView / `WKWebView` / `SFSafariViewController`. Stop Condition #1 forbids a WebView wrapper as the final architecture.
- `BackgroundTasks` / `BGAppRefreshTask` / `BGProcessingTask`. Stop Condition #2 forbids background sync by default.
- HealthKit / `HKHealthStore` import. Stop Condition #9 forbids HealthKit write permission; iOS-1 also skips read.
- Sentry / Crashlytics / Firebase / Bugsnag / Datadog / Mixpanel / Amplitude / Segment / Hotjar / posthog / OpenTelemetry / analytics of any flavour. Stop Condition #8.
- Sign in with Apple. Agent 7 confirmed SIWA is not required for the current Supabase email/password flow; iOS-7 will revisit if a third-party OAuth provider is added.
- Live Activities, Widgets, App Intents, Siri Shortcuts, Watch companion, iPad-specific layout, macOS Catalyst.

If any of the above appears in a future PR's diff, that PR is on the
wrong task.

---

## 3. Directory layout

The iOS project lives entirely under `ios/`:

```
ios/
├── IronPath.xcworkspace/
│   └── contents.xcworkspacedata          # references the Xcode project + 8 packages
├── IronPath.xcodeproj/
│   ├── project.pbxproj                   # single iOS app target
│   └── xcshareddata/xcschemes/
│       └── IronPath.xcscheme             # checked-in scheme for CI
├── IronPath/                             # app target sources
│   ├── IronPathApp.swift                 # @main SwiftUI App
│   ├── ContentView.swift                 # placeholder copy
│   ├── Info.plist                        # bundle metadata; no usage descriptions yet
│   └── Assets.xcassets/                  # AppIcon placeholder + accent color
└── packages/
    ├── IronPathDomain/
    │   ├── Package.swift
    │   ├── Sources/IronPathDomain/IronPathDomain.swift
    │   └── Tests/IronPathDomainTests/IronPathDomainTests.swift
    ├── IronPathDataHealth/        … (same shape)
    ├── IronPathPersistence/       … (same shape)
    ├── IronPathCloudSync/         … (same shape)
    ├── IronPathHealthKit/         … (same shape)
    ├── IronPathBackup/            … (same shape)
    ├── IronPathL10n/              … (same shape)
    └── IronPathUIKit/             … (same shape)
```

All paths under `ios/packages/` are **local** Swift Packages. The
workspace references them by relative path. There are **no remote
package dependencies** anywhere in the project — Stop Condition #7 is
enforced by the iosBootstrap guard tests.

---

## 4. Module boundaries

Agent 5 mapped 8 module slots in
`docs/ios-native-migration/agents/IOS_ARCHITECTURE_AGENT.md`. iOS-1
materialises them as 8 empty Swift Packages, each with **only** a
`<name>.version` string in its sole public type. Future iOS-N PRs add
the real types one module at a time.

| Package              | Owner of (in future iOS-N tasks)                                         |
|----------------------|---------------------------------------------------------------------------|
| `IronPathDomain`     | AppData Swift models, value types, branded clean-input contract (iOS-2)   |
| `IronPathDataHealth` | CleanAppDataView, AutoRepairOrchestrator, repair registry / ledger (iOS-3)|
| `IronPathPersistence`| `AppDataStore` protocol + `JSONFileAppDataStore` default (iOS-2 / iOS-3) |
| `IronPathCloudSync`  | Explicit-sync gateway, optimistic concurrency, account deletion (iOS-7)   |
| `IronPathHealthKit`  | HealthKit live-read adapter, type map, freshness guard (iOS-8)            |
| `IronPathBackup`     | Backup export / import, PWA JSON round-trip (iOS-3, edge case)            |
| `IronPathL10n`       | Translation tables, formatters, kg/lb display contract (iOS-2 onwards)    |
| `IronPathUIKit`      | Shared SwiftUI primitives (buttons, cards, navigation containers) (iOS-5) |

Each package's `Sources/<name>/<name>.swift` is **one type with one
constant**:

```swift
public enum <Package>Version {
    public static let value = "0.0.1-bootstrap"
}
```

No `import` of HealthKit / WebKit / BackgroundTasks / SwiftData /
CoreData / Combine / Supabase / Sentry / Crashlytics / Firebase. Only
the Swift standard library. Even `Foundation` is unnecessary at this
stage and is omitted.

Each package's `Tests/<name>Tests/<name>Tests.swift` is **one XCTest
case** that asserts the version constant equals
`"0.0.1-bootstrap"`. This guarantees the package compiles, links, and
its test target runs — without exercising any business logic.

---

## 5. App target

The Xcode app target is `IronPath`. It contains:

- `IronPathApp.swift` — `@main struct IronPathApp: App { … }`.
- `ContentView.swift` — `VStack` with three labels:
  - `"IronPath"` (`.font(.largeTitle)`)
  - `"Native iOS Bootstrap"` (`.font(.subheadline)`)
  - `"iOS-1 skeleton only"` (`.font(.caption)`)
- `Info.plist` — bundle identifier `com.ironpath.app.ios`, minimal
  required keys (`CFBundleDevelopmentRegion = en`,
  `UILaunchStorybardName`, `UISupportedInterfaceOrientations` =
  portrait only on iPhone). **No `NSHealthShareUsageDescription`** —
  HealthKit is iOS-8. **No `ITSAppUsesNonExemptEncryption`** key — the
  app does not yet use any encryption beyond OS defaults, so the
  default rule (review-required) applies. The Info.plist explicitly
  sets `ITSAppUsesNonExemptEncryption = NO` because the Entry Gate
  Security agent already determined we ship under §740.17(b)(2)
  exemptions.
- `Assets.xcassets/` — empty `AppIcon.appiconset` placeholder and an
  `AccentColor.colorset` set to a neutral grey. No real branding yet.

Target settings:

- Deployment target: **iOS 17.0** (Agent 5 recommendation; aligns with `@Observable`).
- Supported platforms: iPhone only (`TARGETED_DEVICE_FAMILY = 1`). iPad / Mac Catalyst are explicit non-goals.
- Swift version: 5.9 (the version `swift-tools-version` pins for the packages).
- Bundle identifier: `com.ironpath.app.ios`.
- Code signing: automatic (developer-team-id-aware; CI can override via env).
- App Sandbox / App Transport Security: defaults; ATS NOT disabled.
- Embedded Frameworks: none in iOS-1.
- Linked Frameworks: only the 8 local Swift Packages (`IronPathDomain`,
  `IronPathDataHealth`, `IronPathPersistence`, `IronPathCloudSync`,
  `IronPathHealthKit`, `IronPathBackup`, `IronPathL10n`,
  `IronPathUIKit`).

The app target imports **only** `SwiftUI` and the 8 local packages.
`IronPathApp.swift` re-exports nothing.

---

## 6. Workspace

`ios/IronPath.xcworkspace/contents.xcworkspacedata` references:

1. `IronPath.xcodeproj` (the app target).
2. Each of the 8 packages by `group:packages/<name>` so Xcode opens
   them as editable Swift Packages alongside the app.

This is the file you open in Xcode. `xcodebuild -workspace
IronPath.xcworkspace -scheme IronPath …` is the entrypoint for CI and
the local validator.

---

## 7. Forbidden symbols and imports (locked by tests)

The iosBootstrap* tests scan every file under `ios/` and fail if any of
the following strings appears:

| Forbidden substring                         | Why                                                                                   |
|----------------------------------------------|----------------------------------------------------------------------------------------|
| `import WebKit`                              | Stop Condition #1 — no WebView wrapper.                                                |
| `import BackgroundTasks`                     | Stop Condition #2 — no background sync.                                                |
| `import HealthKit`                           | Stop Condition #9 — HealthKit lands in iOS-8.                                          |
| `import SwiftData`                           | Agent 3 + Agent 5 — JSON snapshot first.                                               |
| `import CoreData`                            | Same as SwiftData.                                                                     |
| `import Supabase` / `import GoTrue`          | Cross-review Revision H2 — `supabase-swift` requires explicit user approval before iOS-7. |
| `import Sentry` / `import Crashlytics` /     | Stop Condition #8 — no analytics / crash reporting in iOS-1.                            |
| `import Firebase` / `import Bugsnag` /       | Same.                                                                                  |
| `import Datadog` / `import Mixpanel` /       | Same.                                                                                  |
| `import Amplitude` / `import PostHog`        | Same.                                                                                  |
| `WKWebView`                                  | Same as `import WebKit`.                                                               |
| `BGTaskScheduler`                            | Same as `import BackgroundTasks`.                                                      |
| `HKHealthStore` / `HKQuantityType`           | Same as `import HealthKit`.                                                            |
| `URLSession(`                                | iOS-1 makes zero network calls. iOS-7 introduces the network layer.                    |

The same tests also fail if `Package.swift` declares any
`.package(url: ...)` remote dependency, or if `package.json` /
`package-lock.json` / `pnpm-lock.yaml` drift versus `origin/main`.

---

## 8. iOS-0 parity is preserved

iOS-1 must not break the parity goldens. The Phase E validation
re-runs:

- `node scripts/generate-parity-goldens.mjs --check` (must show `0 changed`)
- `node scripts/generate-parity-goldens.mjs --list` (must show 5 ids)

If iOS-1 ever touches `src/`, `scripts/parityGoldensEntry.ts`, or any
fixture, those tests fail. iOS-1 deliberately touches none of them.

---

## 9. Tests added

Vitest tests (TS, prefix `iosBootstrap*`) that lock the iOS skeleton
from the JavaScript side so they run in CI even without an Xcode
runner:

- `tests/iosBootstrapProjectStructure.test.ts` — workspace + xcodeproj
  + 8 packages exist, Info.plist + scheme + asset catalog present.
- `tests/iosBootstrapPackageGraph.test.ts` — each `Package.swift` is
  local-only (no `.package(url:)`), declares iOS 17 platform, declares
  exactly one library product and one test target.
- `tests/iosBootstrapForbiddenImports.test.ts` — scans every `.swift`
  under `ios/` for the forbidden substrings in §7.
- `tests/iosBootstrapNoBusinessLogic.test.ts` — asserts no business
  logic types (`AppData`, `TrainingDecision`, `CleanAppDataView`,
  `AutoRepairOrchestrator`, `CloudSnapshot`, etc.) exist yet under
  `ios/`. Future iOS-N PRs whitelist what they add.
- `tests/iosBootstrapTargetSettings.test.ts` — parses
  `project.pbxproj` for `IPHONEOS_DEPLOYMENT_TARGET = 17.0` and
  `TARGETED_DEVICE_FAMILY = 1`; asserts no remote SwiftPM reference is
  embedded inside the pbxproj.
- `tests/iosBootstrapParityStillGreen.test.ts` — runs the parity
  generator `--check` in a child process and asserts it still says
  `0 changed`.

Per-package XCTests live alongside each package and are run via
`swift test` on the macOS host. Each package's
`Tests/<name>Tests/<name>Tests.swift` is a 1-assertion smoke test:

```swift
import XCTest
@testable import IronPath<Name>

final class IronPath<Name>Tests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(IronPath<Name>Version.value, "0.0.1-bootstrap")
    }
}
```

The app target itself ships no separate XCTest bundle in iOS-1. The
SwiftUI placeholder is exercised by the `xcodebuild build` step
(which type-checks `IronPathApp` + `ContentView`), and by linking
against all 8 packages via `IronPathLinkedPackages.versions` in
`IronPathApp.swift`. iOS-2 will introduce a proper Xcode test plan
when the first real test cases land.

---

## 10. Validation

TypeScript side (must all return zero):

```
npm run api:dev:build
npm run typecheck
npm test
npm run build
node scripts/scan-production-dist-safety.mjs
node scripts/generate-parity-goldens.mjs --check
node scripts/generate-parity-goldens.mjs --list
git diff -- package.json package-lock.json yarn.lock pnpm-lock.yaml
test ! -e pnpm-lock.yaml
git diff --check
```

Xcode side (generic build is the bar; named-device build is also
required; tests are run via `swift test` per package because the
in-Xcode scheme test wiring is deferred to iOS-2):

```
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build CODE_SIGNING_ALLOWED=NO

# Per-package XCTest run on the macOS host:
for pkg in IronPathDomain IronPathDataHealth IronPathPersistence \
           IronPathCloudSync IronPathHealthKit IronPathBackup \
           IronPathL10n IronPathUIKit; do
  (cd ios/packages/$pkg && swift test)
done
```

The user's brief nominates `iPhone 15 Pro`; this Mac currently has
iPhone 17 series only. iPhone 17 Pro substitutes — both build for
`iphonesimulator17.0` SDK because the deployment target is iOS 17.0
and the iPhone 17 simulator runtime back-deploys.

`xcodebuild test -scheme IronPath` fails with `Scheme IronPath is not
currently configured for the test action` because the iOS-1 scheme
intentionally omits Testables. Wiring eight SwiftPM-test
`TestableReference` blocks into a hand-authored `.xcscheme` is
error-prone without the Xcode GUI; iOS-2 will add a proper test plan
when the first real test cases land. For now, every package's
`Tests/<Name>Tests/<Name>Tests.swift` is exercised via
`swift test` on the macOS host — that proves the package compiles,
links, and the assertion runs.

`CODE_SIGNING_ALLOWED=NO` is passed because the worktree has no Apple
Developer Team and iOS-1's bundle id is a placeholder. CI / TestFlight
will set up signing in iOS-9.

---

## 11. Remaining risks

1. **Hand-authored `project.pbxproj` drift.** Future Xcode versions
   may rewrite the pbxproj on open. iOS-1 commits a minimal,
   hand-authored format that Xcode 26.5 (current host) accepts. If a
   later iOS-N PR opens the project in Xcode and saves, the pbxproj
   may pick up auto-formatting noise. The iosBootstrapTargetSettings
   test only locks the load-bearing keys
   (`IPHONEOS_DEPLOYMENT_TARGET`, `TARGETED_DEVICE_FAMILY`,
   no-remote-deps); cosmetic diffs are accepted.
2. **No CI runner for `xcodebuild`.** The existing IronPath CI is
   Linux + Node-only. iOS-1's iosBootstrap* TS tests cover most of the
   constraints, but the actual `xcodebuild build` is run locally and
   recorded in the PR body. Future iOS-N PRs may introduce a macOS CI
   matrix; that decision is not part of iOS-1.
3. **`com.ironpath.app.ios` bundle identifier is provisional.** The
   real bundle ID + Apple Developer Team ID land in iOS-9 / iOS-10.
   iOS-1's value is a placeholder.
4. **No `.gitignore` entries for Xcode user data yet.** `xcuserdata/`,
   `*.xcodeproj/xcuserdata/`, `*.xcworkspace/xcuserdata/` are
   user-local and should never be committed. iOS-1 extends
   `.gitignore` with these entries.

---

## 12. Final verdict

iOS-1 ships an inert iOS scaffold whose only verified behaviours are
"the toolchain compiles it" and "no forbidden imports / dependencies
sneaked in". Every contract from the Entry Gate is preserved by the
absence of business logic; iOS-2 starts the actual port.

This doc is the implementation contract for the iOS-1 PR. Files land
in the order: this doc → 8 packages → app target → workspace →
TS tests → validation → commit + PR.
