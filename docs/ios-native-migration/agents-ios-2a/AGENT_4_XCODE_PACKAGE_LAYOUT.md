# AGENT 4 — Xcode / Package Layout (iOS-2A AppData Swift Models Plan V1)

Agent: Agent 4 — Xcode / Package Layout Agent
Scope: iOS-2A AppData Swift Models Plan V1
Date: 2026-05-28
Status: planning-only (no `project.pbxproj` / `Package.swift` / Swift edits)

## 1. Mission

Decide **exactly** where iOS-2 lays down its 17 AppData Swift model
files plus the 5 round-trip / guard test files, which Xcode / SwiftPM
target owns each one, and what the bootstrap project files (workspace,
`project.pbxproj`, shared `IronPath.xcscheme`, `Package.swift`) have to
do to absorb the change. The deliverable is:

- A canonical path list (no off-by-one filenames, no stray dirs) so
  Agent 3 (model surface) and the iOS-2B implementer can drop files in
  without re-debating layout.
- A diff intent for `Package.swift` (likely none) plus the explicit
  fixture-bundling clause if iOS-2B needs to load JSON from the test
  bundle.
- An impact assessment on the hand-authored `project.pbxproj` (the
  fragile part of iOS-1) and on the shared scheme (so we don't tempt
  Xcode 26.5 to rewrite either).
- The exact `xcodebuild` / `swift test` invocations iOS-2B's PR body
  must show green.
- A single recommended pathway for getting the iOS-0 parity fixtures
  into the Swift test target, plus the trade-offs of the alternative.

This file is the layout contract for iOS-2B. Agents 1–3 produce the
schema / parity / model-surface design; Agent 5 covers persistence
(out of scope here); Agent 6 covers tests; Agent 7 covers risks. Agent
4's only job is "where do bytes live and how do they reach the
compiler / test runner".

## 2. Inputs inspected

| Source | Path | What was read |
| --- | --- | --- |
| Workspace | `ios/IronPath.xcworkspace/contents.xcworkspacedata` | Full file (31 lines). Confirms 1 xcodeproj + 8 local packages, all by `group:` relative paths, no remote SwiftPM. |
| Xcode project | `ios/IronPath.xcodeproj/project.pbxproj` | Full file (437 lines). Confirms `XCLocalSwiftPackageReference` × 8 (L367–399), `XCSwiftPackageProductDependency` × 8 (L401–434). **No per-file references to package sources.** Single app target `IronPath` (L80–106), single source group `IronPath` (L66–76), one Sources phase, one Resources phase. |
| Shared scheme | `ios/IronPath.xcodeproj/xcshareddata/xcschemes/IronPath.xcscheme` | Full file (77 lines). `<TestAction>` has `shouldAutocreateTestPlan = "YES"` and an empty `<Testables>` block (deferred by iOS-1, §10 of bootstrap doc). |
| Domain package manifest | `ios/packages/IronPathDomain/Package.swift` | Full file (18 lines). swift-tools 5.9, iOS 17, exactly one library target + one test target, no `resources:` declaration, no `dependencies:`. |
| Domain placeholder source | `ios/packages/IronPathDomain/Sources/IronPathDomain/IronPathDomain.swift` | Full file (9 lines). Single `IronPathDomainVersion` enum. Confirms `Sources/IronPathDomain/` is the canonical SwiftPM source root. |
| Domain placeholder test | `ios/packages/IronPathDomain/Tests/IronPathDomainTests/IronPathDomainTests.swift` | Full file (8 lines). Confirms `Tests/IronPathDomainTests/` is the canonical SwiftPM test root. |
| iOS-1 bootstrap doc | `docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md` | Sections 3 (layout), 5 (app target), 7 (forbidden imports), 9 (tests added), 10 (validation), 11 (risks). The validation block at L307–319 is the authoritative `xcodebuild` recipe iOS-2B inherits. |
| iOS-0 parity fixture | `tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json` | Listed; not parsed. This is the single canonical AppData snapshot Agent 1 cites as `S` in its inventory and the file iOS-2B's round-trip test will load. |
| Agent 1 inventory (peer in this batch) | `docs/ios-native-migration/agents-ios-2a/AGENT_1_APPDATA_SCHEMA.md` §2, §3 | Confirms the canonical fixture path and the schema-version literal (`STORAGE_VERSION = 8`). Drives the test-file naming for the schema-version guard. |

> Not read (out of scope per brief): the other 7 `Package.swift` files
> (no edits expected), `IronPathApp.swift` / `ContentView.swift` (no
> imports change in iOS-2B), the parity golden hash files under
> `tests/fixtures/parity/golden/` (Agent 2's territory).

## 3. Exact future file paths — 17 model `.swift` files

All 17 new model files land under the **same** directory the iOS-1
placeholder occupies:

```
ios/packages/IronPathDomain/Sources/IronPathDomain/
```

This is the canonical SwiftPM source root for the `IronPathDomain`
library target. `Package.swift` does not list source files — SwiftPM
infers them from `Sources/<TargetName>/**/*.swift`. The 17 files are:

| # | Filename | Notes |
| --- | --- | --- |
| 1 | `JSONValue.swift` | Open-bag value union (recursive). Used by `AppSettings`, `HealthMetricSample.raw`, etc. Codable conformance lives in this file. |
| 2 | `SchemaVersion.swift` | Wrapper around `Int`. Holds the `STORAGE_VERSION = 8` literal (or a `currentSchemaVersion` constant), enforces `>= 1` decode. |
| 3 | `WeightUnit.swift` | Enum `case kg, lb`. Probably `String, Codable, CaseIterable`. Used by `UnitSettings`, `UserProfile.weightUnit`, etc. |
| 4 | `AppData.swift` | The top-level `struct AppData: Codable`. Owns the 24 fields enumerated by Agent 1 §3.1. **Must preserve unknown keys** for the open-bag fields (`settings`, `todayStatus`, `userProfile`, `screeningProfile`, etc.) via a sibling `unknownKeys: [String: JSONValue]` pattern (Agent 3 will spec the exact shape). |
| 5 | `AppSettings.swift` | `struct AppSettings: Codable`. Open-bag — declared `[key: string]: unknown` in TS L1332. Holds the explicit known keys plus the unknown-keys passthrough. |
| 6 | `UserProfile.swift` | `struct UserProfile: Codable`. Open-bag. Includes `sex / trainingLevel / primaryGoal` enums and the unknown-keys bag. |
| 7 | `TrainingSession.swift` | `struct TrainingSession: Codable`. Open-bag per Agent 1's classification of `history` / `activeSession`. **Highest-risk type** for parity (many timestamps, nested logs). |
| 8 | `TrainingSetLog.swift` | `struct TrainingSetLog: Codable`. Used by `TrainingSession.sets` / per-exercise logs. |
| 9 | `ActualSetDraft.swift` | `struct ActualSetDraft: Codable`. Draft sets staged before commit. |
| 10 | `ExercisePrescription.swift` | `struct ExercisePrescription: Codable`. Per-exercise prescription record (weight, reps, intensity). |
| 11 | `MesocyclePlan.swift` | `struct MesocyclePlan: Codable`. Open-bag (schema L640). Includes `startDate`, `lengthWeeks` enum, multiplier float. |
| 12 | `ScreeningProfile.swift` | `struct ScreeningProfile: Codable`. Open-bag. Contains nested `AdaptiveState` (decision: nest as private type **inside** this file, or split out — Agent 3 picks; Agent 4 records that the nested type does NOT get its own top-level `.swift` file unless Agent 3 explicitly splits it). |
| 13 | `ProgramTemplate.swift` | `struct ProgramTemplate: Codable`. Open-bag. Schema is in an external `training-program.schema.json`; Swift mirrors only the field shape. |
| 14 | `HealthMetricSample.swift` | `struct HealthMetricSample: Codable`. Open-bag. Holds `raw: JSONValue?` — the `raw: unknown` passthrough Agent 1 flagged HIGH risk. |
| 15 | `UnitSettings.swift` | `struct UnitSettings: Codable`. Closed-bag in TS, but holds the float increment arrays (`customIncrementsKg/Lb`) that Agent 1 flags for precision. |
| 16 | `TodayStatus.swift` | `struct TodayStatus: Codable`. Open-bag. Sleep / energy / time enums, soreness array. |
| 17 | `AdaptiveCalibrationState.swift` | `struct AdaptiveCalibrationState: Codable`. Closed top, but nested entries leak floats; Agent 1 marks HIGH risk for bias precision. |

Total: **17 new Swift files** added to `Sources/IronPathDomain/`.

The placeholder `IronPathDomain.swift` (containing
`IronPathDomainVersion`) **stays** — iOS-1's bootstrap test will continue
to assert the constant equals `"0.0.1-bootstrap"` until a later iOS-N
PR explicitly bumps it. iOS-2B does NOT delete or modify that file.

Open question for Agent 3 / iOS-2B: small helper types that Agent 1
enumerates in §3.2 (e.g. `AdaptiveState`, `PostureFlags`,
`WeeklyMuscleTargets`, `BodyWeightEntry`, `ProgramAdjustmentDraft`,
`PendingSessionPatch`, etc.). The brief lists **17** files. Agent 4's
read: helper types live **inline** in the owning model file (e.g.
`BodyWeightEntry` inside `AppData.swift` since it's only used by
`AppData.bodyWeights`; `AdaptiveState` inside `ScreeningProfile.swift`).
If Agent 3 decides any of these warrant a top-level file, the list
above grows — flag it explicitly in iOS-2B's PR body so the count
moves from 17 to N. Section 12 records this as Open Question 1.

## 4. Future Swift test files

All 5 new test files land under the **same** directory the iOS-1
placeholder occupies:

```
ios/packages/IronPathDomain/Tests/IronPathDomainTests/
```

The 5 files are:

| # | Filename | Purpose | Loads fixture? |
| --- | --- | --- | --- |
| 1 | `AppDataCodableRoundTripTests.swift` | Decode the iOS-0 canonical `snapshot-hash-stable-v1.json` into `AppData`, re-encode, assert byte-equal (or hash-stable) round-trip. This is the parity bar for the Swift port. | YES — needs the fixture in the test bundle. |
| 2 | `AppDataSchemaVersionGuardTests.swift` | Static assert: the `currentSchemaVersion` Swift constant equals `8`. Decode-time guard: refuse fixtures with `schemaVersion < 1` or future-unknown versions per Agent 1 §6. | NO (synthetic input). |
| 3 | `AppDataOpenBagPreservationTests.swift` | Inject an unknown key into the fixture (or a synthetic copy), decode → re-encode, assert the unknown key survives. Covers the high-risk open-bag types (`settings`, `userProfile`, `todayStatus`, `screeningProfile`, `healthMetricSamples.raw`). | YES for the seed bytes (synthetic mutation in-test). |
| 4 | `AppDataIsoTimestampStaticGuardTests.swift` | Static-guard test that scans the model files (via reflection or a fixed-string allow-list) and asserts no `Date()` / `Date.now` fallback is used during decode. Mirrors Agent 1's "do NOT re-mint timestamps on read" stop condition. | NO (synthetic input plus optionally the canonical fixture for proof-by-decoding). |
| 5 | `AppDataUnitFieldPreservationTests.swift` | Float-precision round-trip for `UnitSettings.customIncrementsKg/Lb` and `AdaptiveCalibrationState.*` bias floats. Cover the HIGH-risk float types Agent 1 §3.1 flags. | YES — needs the fixture (or a precision-stressed variant). |

Total: **5 new Swift test files** under `Tests/IronPathDomainTests/`.

The placeholder `IronPathDomainTests.swift` (single
`testVersionIsBootstrap` assertion) **stays** — iOS-1's bootstrap test
matrix still depends on its existence.

## 5. Target membership

Every new file added in iOS-2B belongs to **exactly one** target:

| File set | SwiftPM target | Library/test? |
| --- | --- | --- |
| All 17 `.swift` files under `Sources/IronPathDomain/` | `IronPathDomain` | Library target. Already declared at `Package.swift:15`. |
| All 5 `.swift` files under `Tests/IronPathDomainTests/` | `IronPathDomainTests` | Test target. Already declared at `Package.swift:16`. Depends on `IronPathDomain` (already wired). |
| Fixture JSON (see §10) | `IronPathDomainTests` resources | Resource via `.copy("Fixtures")`. NEW declaration in `Package.swift` (see §6). |

**No changes to the other 7 packages.** `IronPathDataHealth`,
`IronPathPersistence`, `IronPathCloudSync`, `IronPathHealthKit`,
`IronPathBackup`, `IronPathL10n`, `IronPathUIKit` are untouched in
iOS-2B. iOS-2B does not import them; iOS-3 and later wire them.

**No app-target file moves.** `IronPath/IronPathApp.swift`,
`IronPath/ContentView.swift`, `IronPath/Info.plist`, and
`IronPath/Assets.xcassets/` stay exactly as iOS-1 left them. The app
target picks up the new `IronPathDomain` types transitively because
the app already links `IronPathDomain` (pbxproj L13, L94). No new
linked framework, no new build phase.

## 6. `Package.swift` diff for iOS-2B

**Default expectation: ZERO edits.** SwiftPM convention scans
`Sources/IronPathDomain/**/*.swift` automatically, so adding 17 new
`.swift` files under that root requires **no manifest change**. Same
for the 5 new test files under `Tests/IronPathDomainTests/`.

**The single edit that becomes necessary** is if (and only if) iOS-2B
chooses fixture-delivery path A (recommended in §10) — copy the
canonical AppData JSON into the test bundle. SwiftPM does NOT pick up
non-Swift files automatically; they have to be declared as `resources`
on the test target.

Proposed diff (intent only — no edit applied here):

```diff
 let package = Package(
     name: "IronPathDomain",
     platforms: [.iOS(.v17)],
     products: [
         .library(name: "IronPathDomain", targets: ["IronPathDomain"]),
     ],
     targets: [
         .target(name: "IronPathDomain"),
-        .testTarget(name: "IronPathDomainTests", dependencies: ["IronPathDomain"]),
+        .testTarget(
+            name: "IronPathDomainTests",
+            dependencies: ["IronPathDomain"],
+            resources: [.copy("Fixtures")]
+        ),
     ]
 )
```

Notes:

- `.copy("Fixtures")` (not `.process(…)`) — JSON byte-equality matters
  for the round-trip parity test; `.process` may re-encode resources.
  `.copy` preserves byte-for-byte.
- The argument is a path **relative to the test target's source
  directory**, i.e. resolved against
  `ios/packages/IronPathDomain/Tests/IronPathDomainTests/Fixtures/`.
- Access in test code is `Bundle.module.url(forResource: "…",
  withExtension: "json", subdirectory: "Fixtures")`. SwiftPM
  auto-generates `Bundle.module` for any target that declares
  `resources:`. iOS-2B's test code can reference it directly; no
  custom Bundle wrapper needed.
- The `name:` argument label is required when you also pass
  `resources:` — that's the only stylistic change vs. the iOS-1
  one-liner.

Nothing else in `Package.swift` changes. `swift-tools-version: 5.9`
stays; `platforms: [.iOS(.v17)]` stays; products stay; no
`.package(url:)` is introduced (forbidden by Stop Condition #7 +
iosBootstrapPackageGraph guard).

If iOS-2B picks path B (read relative path back to repo root from the
test bundle — NOT recommended; see §10), then `Package.swift` requires
**zero** edits and the brittle path-traversal logic lives in test code
only. Agent 4 still recommends path A.

## 7. `project.pbxproj` impact

**Expected impact: NONE.** This is the load-bearing claim of this
report and the reason iOS-1 deferred test-plan wiring (per bootstrap
doc §10, §11 risk #1).

Why zero edits:

- `XCLocalSwiftPackageReference` × 8 already point at the 8 packages
  by relative path (pbxproj L367–399). Adding files inside one of
  those packages does NOT touch the project.pbxproj — SwiftPM owns
  the source set; the pbxproj only references the package, not its
  individual files.
- `XCSwiftPackageProductDependency` × 8 already wire the 8 library
  products into the app target's Frameworks phase (pbxproj L401–434,
  L31–46). The app target already links `IronPathDomain` (L13, L94).
  The new types compile into the same library product the app already
  consumes — no new product, no new dependency.
- No new app-target source files. `IronPathApp.swift` /
  `ContentView.swift` stay; iOS-2B does not add any `.swift` under
  `ios/IronPath/`. The `PBXSourcesBuildPhase` block (L161–171) stays
  intact.
- No new Resources. The `Assets.xcassets` reference (L155) stays.
  The fixture JSON lives inside the SwiftPM test target (see §10), not
  the app target, so the `PBXResourcesBuildPhase` block (L151–158)
  stays intact.
- No new build configurations. `IPHONEOS_DEPLOYMENT_TARGET = 17.0` and
  `TARGETED_DEVICE_FAMILY = 1` (L226, L283, L314, L339) stay. The
  iosBootstrapTargetSettings TS test still passes.

**Risk: Xcode 26.5 auto-rewrite.** If anyone opens
`IronPath.xcworkspace` in Xcode 26.5 and saves, Xcode may rewrite
trivial whitespace, add object IDs for resolved package products, or
shuffle `XCLocalSwiftPackageReference` ordering. iOS-1's risk #1
(L344–352) already accepts this — the iosBootstrapTargetSettings test
only locks load-bearing keys. iOS-2B's PR body should explicitly state:
"project.pbxproj not modified by hand; if Xcode rewrites it during a
local open-save, those cosmetic edits are accepted." Best practice for
iOS-2B: do NOT open Xcode at all unless debugging requires it. All
validation is `xcodebuild` + `swift test` from the command line.

If a stray hand-edit creeps in (e.g. someone tries to add the
fixtures via Xcode's "Add Files to IronPath..." dialog), the result
will be:

- A new `PBXFileReference` for each JSON file.
- A new `PBXBuildFile` referencing it.
- The Resources phase grows.
- The iosBootstrapTargetSettings guard test may not catch this (it
  only checks deployment target + device family + remote-deps).

Defence: iOS-2B's PR body MUST include `git diff
ios/IronPath.xcodeproj/project.pbxproj` and assert "empty". Reviewers
reject any pbxproj diff that doesn't have a documented reason.

## 8. `IronPath.xcscheme` impact

**Expected impact: NONE.** iOS-2B does not touch the shared scheme.

Why zero edits:

- iOS-1's scheme has `shouldAutocreateTestPlan = "YES"` and an empty
  `<TestAction>` `<Testables>` block (xcscheme L25–31). The bootstrap
  doc §10 (L325–334) explicitly defers scheme test wiring to "iOS-2
  when the first real test cases land".
- BUT: "iOS-2" in the bootstrap doc is a coarse label. iOS-2A is
  planning-only; iOS-2B is the implementation PR. **Agent 4
  recommends iOS-2B continues the iOS-1 deferral.** The Swift test
  validation in iOS-2B will run via `swift test` per-package on the
  macOS host, exactly as the bootstrap doc §10 prescribes. Wiring
  eight SwiftPM-test `TestableReference` blocks into a hand-authored
  `.xcscheme` is the same error-prone work the iOS-1 author refused to
  do; iOS-2B should not be the first PR to attempt it without an
  Xcode-GUI co-author.
- A proper Xcode test plan (`*.xctestplan` referenced from the
  scheme's `<TestAction>`) is a cleaner solution than hand-authored
  `TestableReference` blocks. Agent 4 defers this to a dedicated
  iOS-N PR (probably aligned with the first UI test cases, i.e.
  iOS-5 or iOS-6). iOS-2B records this as a follow-up issue.
- Build action stays as-is — building the app target already builds
  `IronPathDomain` because the app links it. The `buildForTesting =
  "YES"` flag on the BuildActionEntry (xcscheme L10) keeps the test
  build pipeline warm even though no scheme-level test target is
  declared.

iOS-2B's PR body MUST include `git diff
ios/IronPath.xcodeproj/xcshareddata/xcschemes/IronPath.xcscheme` and
assert "empty".

## 9. `xcodebuild` / `swift test` commands iOS-2B will run

The validation block iOS-2B inherits verbatim from bootstrap doc
§10 (L307–319). Three command groups, all must return non-zero exit
only on legitimate failure:

### 9.1 Generic build

```
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS Simulator' build \
  CODE_SIGNING_ALLOWED=NO
```

This compiles the app target plus all 8 packages for the iOS Simulator
SDK without picking a specific device. It catches generic-arch issues
(missing `Foundation` import, public-vs-internal slip-ups, Codable
synthesis failure on `AppData`).

### 9.2 Named-device build

```
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build \
  CODE_SIGNING_ALLOWED=NO
```

The user's brief nominated iPhone 15 Pro; the iOS-1 doc §10 (L320–323)
already substituted iPhone 17 Pro because the host has only iPhone 17
series simulators installed. iOS-2B inherits this substitution. The
deployment target is iOS 17.0 so the iPhone 17 simulator runtime
back-deploys correctly.

### 9.3 Per-package `swift test`

```
(cd ios/packages/IronPathDomain && swift test)
```

This is the bar for iOS-2B. It runs:

- `IronPathDomainTests.testVersionIsBootstrap` (iOS-1 placeholder, still green)
- All 5 new test cases under `Tests/IronPathDomainTests/` (Agent 4 §4)

The iOS-1 doc's `for pkg in IronPathDomain IronPathDataHealth …; do (cd
ios/packages/$pkg && swift test); done` loop (L314–318) stays as the
**full** validation iOS-2B's PR body shows green. iOS-2B does not
modify any other package, so the other 7 `swift test` runs are
unchanged from iOS-1.

### 9.4 What iOS-2B does NOT run

- `xcodebuild test -scheme IronPath` — still fails with "Scheme
  IronPath is not currently configured for the test action" per
  bootstrap §10 (L325–328). Wiring this is deferred to a future PR
  (probably iOS-5 / iOS-6 with a proper `.xctestplan`).
- `xcodebuild archive` — not part of any iOS-N PR until iOS-9 / iOS-10
  (TestFlight / App Store signing).
- macOS CI — bootstrap risk #2 (L353–356) explicitly accepts that all
  `xcodebuild` runs are local-only for iOS-N. The PR body records
  output; CI does not run them.

## 10. How fixtures arrive at Swift tests

Two candidate pathways exist for getting
`tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json`
(and any companion fixtures Agent 2 nominates for the open-bag /
precision tests) into the `IronPathDomainTests` runtime.

### Option A — RECOMMENDED — Bundle into the test target via `.copy`

Layout:

```
ios/packages/IronPathDomain/Tests/IronPathDomainTests/
├── AppDataCodableRoundTripTests.swift
├── AppDataSchemaVersionGuardTests.swift
├── AppDataOpenBagPreservationTests.swift
├── AppDataIsoTimestampStaticGuardTests.swift
├── AppDataUnitFieldPreservationTests.swift
├── IronPathDomainTests.swift             (iOS-1 placeholder, stays)
└── Fixtures/
    └── snapshot-hash-stable-v1.json       (copied from tests/fixtures/parity/inputs/app-data/)
```

Wiring:
- `Package.swift` test target declares `resources: [.copy("Fixtures")]` (see §6).
- Swift test code loads via `Bundle.module.url(forResource:
  "snapshot-hash-stable-v1", withExtension: "json", subdirectory:
  "Fixtures")`.

Why this is the right call:

1. **Deterministic in `swift test`.** `Bundle.module` works whether
   the test runs under `swift test` from the package root, from the
   workspace root, from a CI runner, or from inside Xcode. No
   path-juggling.
2. **Hermetic.** The fixture is a tracked file inside the package's
   test target. If anyone moves the package, the fixture moves with
   it. There's no fragile relative path "../../../tests/fixtures/…"
   that breaks the moment `.build/` is the current working directory.
3. **`xcodebuild` compatible.** When iOS-2B runs `xcodebuild build`
   for the app target, the test bundle (and its `Fixtures/`) is built
   as a side product of the SwiftPM dependency graph. No extra
   pbxproj wiring (§7's "zero edits" promise stays intact).
4. **`.copy` preserves bytes.** The round-trip test is byte-equality
   sensitive (Agent 1 §3 flags HIGH-risk float fields). `.process`
   may re-encode resources; `.copy` does not. We need `.copy`.
5. **One-line `Package.swift` change.** §6 shows the exact diff.

Downsides accepted:

- **Fixture duplication.** The JSON now exists in two locations:
  `tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json`
  (canonical, owned by iOS-0 / parity-goldens generator) and
  `ios/packages/IronPathDomain/Tests/IronPathDomainTests/Fixtures/
  snapshot-hash-stable-v1.json` (Swift test copy). If the canonical
  fixture is regenerated, the iOS copy goes stale. Defence:

  - Add a CI / pre-commit guard that asserts the two files are byte-
    equal. (Cheap: `cmp -s a b || exit 1` in a `npm run` script.)
  - OR symlink the iOS copy to the canonical. **NOT recommended** —
    Git tracks symlinks weirdly across macOS / Windows / Linux, and
    SwiftPM's `.copy("Fixtures")` semantics on a symlinked directory
    are not documented to follow links. Agent 4 explicitly rejects
    symlinking.
  - PRACTICAL DEFENCE: a deterministic copy step. iOS-2B's PR adds a
    `scripts/sync-ios-fixtures.mjs` (or extends an existing
    bootstrap script) that copies the canonical fixture into the
    SwiftPM test target. The same script runs in CI as a `--check`
    that fails the build if the two files have diverged. This is the
    same pattern the existing `scripts/generate-parity-goldens.mjs`
    uses for the TS-side goldens. iOS-2B records this as a
    deliverable in its PR body.

- **Bytes duplicated in the diff** when the canonical fixture
  changes. Acceptable cost — fixtures are small (current
  `snapshot-hash-stable-v1.json` is ~1.2 KB), and the round-trip test
  is the load-bearing parity bar for the Swift port.

### Option B — Read from repo root via relative path

Test code computes a path back to `tests/fixtures/parity/inputs/app-
data/snapshot-hash-stable-v1.json` using `#file` / `URL(fileURLWithPath:
"…/../../../../tests/fixtures/…")`.

Why this is REJECTED:

- **Brittle under `.build/`.** When `swift test` builds inside
  `ios/packages/IronPathDomain/.build/…/`, the relative path traversal
  depends on whether `#file` resolves to the original source root or
  the build-cache path. Behaviour differs between `swift test`,
  `xcodebuild test`, and a hypothetical future CI runner.
- **Breaks if the package is ever extracted into a separate repo.**
  Unlikely today but it's a one-way trap.
- **Hides the dependency.** A reader of `Package.swift` cannot tell
  the test depends on a fixture outside the package.
- **Conflicts with the iOS-1 forbidden-import scan.** The forbidden-
  imports test (bootstrap §7) scans every `.swift` under `ios/` for
  suspicious substrings. A literal `"../../../../tests/fixtures/"`
  string in a Swift file is exactly the kind of thing that makes
  reviewers nervous, even if it doesn't trip the current substring
  list.

Agent 4's choice: **Option A.** Path: bundle the JSON into the test
target via `.copy("Fixtures")`, add a CI guard to keep the iOS copy
byte-equal to the canonical. iOS-2B's PR body must show:

1. The new `Fixtures/` directory tracked in git.
2. The one-line `Package.swift` diff from §6.
3. The byte-equality guard script (or its equivalent in an existing
   bootstrap script).
4. `swift test` green output including the new round-trip test.

Open question 2 (§12): if Agent 2 nominates additional fixtures
(synthetic open-bag mutations, precision-stressed unit settings,
schema-version edge cases), they ALL live under
`Tests/IronPathDomainTests/Fixtures/` and are subject to the same
byte-equality guard. The PR author MUST NOT scatter them elsewhere.

## 11. Risks

1. **`project.pbxproj` drift.** §7's "zero edits" promise depends on
   nobody opening Xcode mid-PR. Defence: PR body asserts the diff is
   empty. If Xcode 26.5 rewrites cosmetic IDs during a local debug
   session, iOS-2B accepts the noise but the iosBootstrapTargetSettings
   TS guard still has to pass.
2. **Scheme `<Testables>` deferred indefinitely.** iOS-1 punted; iOS-2B
   continues to punt. The risk is that "the first PR to wire the
   scheme test plan" keeps getting pushed downstream until iOS-5 or
   iOS-6 inherits a stale, brittle hand-authored `.xcscheme` with
   eight `TestableReference` blocks. Defence: file the follow-up
   issue with iOS-2B; recommend `.xctestplan` migration rather than
   in-`.xcscheme` `<Testables>` editing.
3. **Fixture resource bundling.** `.copy("Fixtures")` is the right
   call but is a one-shot opportunity to set the pattern for **all**
   future packages. If iOS-3 (DataHealth) adds its own fixtures, it
   should follow the same `Tests/<Name>Tests/Fixtures/` convention.
   Defence: document the convention in iOS-2B's PR body so iOS-3 / etc.
   inherit it.
4. **Fixture sync drift.** The CI byte-equality guard is the single
   defence against canonical-vs-copy drift. If the guard is missed in
   review, the Swift round-trip test could pass against a stale fixture
   while the TS parity test passes against a newer one. Both green,
   port silently broken. Defence: PR body MUST include the guard
   script and an example run that proves it catches a synthetic diff.
5. **Swift `Codable` synthesis on open-bag types.** This isn't Agent
   4's territory (it's Agent 3's), but layout-wise: the unknown-keys
   passthrough pattern (whatever Agent 3 picks — `extraData:
   [String: JSONValue]`, `CodingKey` wrappers, etc.) MUST live in the
   same `.swift` file as the owning struct. Splitting `Codable`
   extensions into separate files inside `Sources/IronPathDomain/`
   complicates the byte-equality story. Agent 4's recommendation: keep
   each model + its `Codable` implementation in one file.
6. **17-vs-N file count drift.** If Agent 3 promotes inline helper
   types to top-level files, the count grows. The brief locks 17;
   iOS-2B's PR body must flag any deviation explicitly.
7. **macOS CI is still absent.** Bootstrap risk #2 carries forward
   verbatim. iOS-2B's `xcodebuild` outputs are local-only.

## 12. Open questions

1. Helper-type file count: does Agent 3 keep `AdaptiveState`,
   `PostureFlags`, `WeeklyMuscleTargets`, `BodyWeightEntry`,
   `ProgramAdjustmentDraft`, `PendingSessionPatch`, etc. inline in
   their owning model files (Agent 4's default, 17 files total) or
   promote any of them to top-level (file count grows)? Agent 4 needs
   Agent 3's answer to lock the layout for iOS-2B.
2. Additional fixtures for the open-bag / precision / schema-version
   tests: does Agent 2 nominate any companion JSON beyond the canonical
   `snapshot-hash-stable-v1.json`? If yes, they ALL live under
   `Tests/IronPathDomainTests/Fixtures/` and the byte-equality CI
   guard covers each one.
3. Byte-equality guard: should the CI step be a dedicated `npm run
   ios:fixtures:check` script or folded into the existing
   `scripts/generate-parity-goldens.mjs --check` pipeline? Either
   works; preference is a separate script so the iOS-side check is
   visible in PR descriptions.
4. Test-plan migration: when do we wire `IronPathDomain.xctestplan`
   into the shared scheme? Agent 4 recommends a dedicated PR aligned
   with the first UI test cases (iOS-5 or iOS-6), not iOS-2B.
5. iPhone simulator name: the brief inherits "iPhone 17 Pro" from
   bootstrap doc §10. If the host's simulator catalogue changes
   (Xcode 26.6+, iPhone 18 series, etc.), the named-device command
   needs an update. iOS-2B's PR body should `xcrun simctl list
   devices available` and confirm the destination is reachable before
   running `xcodebuild`.

---

End of report. Files referenced (absolute paths):

- `/Users/xuhaochen/Developer/ironpath-ios-2-plan/ios/IronPath.xcworkspace/contents.xcworkspacedata`
- `/Users/xuhaochen/Developer/ironpath-ios-2-plan/ios/IronPath.xcodeproj/project.pbxproj`
- `/Users/xuhaochen/Developer/ironpath-ios-2-plan/ios/IronPath.xcodeproj/xcshareddata/xcschemes/IronPath.xcscheme`
- `/Users/xuhaochen/Developer/ironpath-ios-2-plan/ios/packages/IronPathDomain/Package.swift`
- `/Users/xuhaochen/Developer/ironpath-ios-2-plan/ios/packages/IronPathDomain/Sources/IronPathDomain/IronPathDomain.swift`
- `/Users/xuhaochen/Developer/ironpath-ios-2-plan/ios/packages/IronPathDomain/Tests/IronPathDomainTests/IronPathDomainTests.swift`
- `/Users/xuhaochen/Developer/ironpath-ios-2-plan/docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md`
- `/Users/xuhaochen/Developer/ironpath-ios-2-plan/tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json`
- `/Users/xuhaochen/Developer/ironpath-ios-2-plan/docs/ios-native-migration/agents-ios-2a/AGENT_1_APPDATA_SCHEMA.md`
