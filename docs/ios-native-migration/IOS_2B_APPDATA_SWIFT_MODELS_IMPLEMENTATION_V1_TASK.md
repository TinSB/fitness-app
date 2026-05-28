# iOS-2B AppData Swift Models Implementation V1 — Ready-to-run Task

> **For the next implementation agent.** This file is a complete,
> self-contained prompt. Read top to bottom. Every section is a
> contract iOS-2B must honour. Drift from this spec = review block.

> Parent docs (READ FIRST, in order):
> 1. `docs/ios-native-migration/IOS_2_APPDATA_SWIFT_MODELS_V1_PLAN.md` (the iOS-2A plan; this task spec is its operationalisation)
> 2. `docs/ios-native-migration/agents-ios-2a/AGENT_1_APPDATA_SCHEMA.md` (the 45-type inventory + 37 open-bag sites)
> 3. `docs/ios-native-migration/agents-ios-2a/AGENT_2_JSONVALUE_CODABLE.md` (the JSONValue / NumberRepr / Codable strategy)
> 4. `docs/ios-native-migration/agents-ios-2a/AGENT_3_PARITY_FIXTURE.md` (the fixture deferral rationale)
> 5. `docs/ios-native-migration/agents-ios-2a/AGENT_4_XCODE_PACKAGE_LAYOUT.md` (the Package.swift one-liner + Bundle.module + byte-equality CI guard)
> 6. `docs/ios-native-migration/agents-ios-2a/AGENT_5_DATA_SAFETY.md` (the 13 MUST-NOT + 5 MUST list)
> 7. `docs/IOS_NATIVE_MIGRATION_CONTRACT_FREEZE_V1.md` §1, §8, §9
> 8. `docs/IOS_NATIVE_MIGRATION_ENTRY_GATE_V1.md` §18 stop conditions
> 9. `docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md` (the Xcode + 8-package scaffold this PR slots into)

---

## 1. Branch + worktree

- **Branch name (exact)**: `claude/ios-2b-appdata-swift-models-v1`
- **Worktree path (exact)**: `~/Developer/ironpath-ios-2b`
- **Base**: `origin/main` at the merge commit of iOS-2A. Do NOT base
  on the iOS-2A branch directly. Verify with
  `git log --oneline -5 origin/main` and confirm the most recent commit
  message starts with `iOS-2A AppData Swift Models Plan V1`.

Setup commands (run in order):

```bash
cd ~/Developer/ironpath
git fetch origin
git worktree list
# If ~/Developer/ironpath-ios-2b already exists, STOP and report.
git worktree add ~/Developer/ironpath-ios-2b -b claude/ios-2b-appdata-swift-models-v1 origin/main
cd ~/Developer/ironpath-ios-2b
pwd                            # MUST be /Users/.../ironpath-ios-2b
git branch --show-current      # MUST be claude/ios-2b-appdata-swift-models-v1
git status --short             # MUST be empty
git rev-parse --short HEAD     # MUST be the iOS-2A merge commit
git log --oneline -5
```

If any check fails, STOP and report.

---

## 2. iOS-2A dependency confirmation

Before touching any source file, verify the iOS-2A plan landed:

```bash
test -f docs/ios-native-migration/IOS_2_APPDATA_SWIFT_MODELS_V1_PLAN.md
test -f docs/ios-native-migration/IOS_2B_APPDATA_SWIFT_MODELS_IMPLEMENTATION_V1_TASK.md
test -f docs/ios-native-migration/agents-ios-2a/AGENT_1_APPDATA_SCHEMA.md
test -f docs/ios-native-migration/agents-ios-2a/AGENT_2_JSONVALUE_CODABLE.md
test -f docs/ios-native-migration/agents-ios-2a/AGENT_3_PARITY_FIXTURE.md
test -f docs/ios-native-migration/agents-ios-2a/AGENT_4_XCODE_PACKAGE_LAYOUT.md
test -f docs/ios-native-migration/agents-ios-2a/AGENT_5_DATA_SAFETY.md
node scripts/generate-parity-goldens.mjs --check     # MUST report 0 changed
node scripts/generate-parity-goldens.mjs --list      # MUST list 5 ids
```

If parity check shows non-zero drift, STOP and report — iOS-2B's
acceptance bar requires the goldens to be stable at the iOS-2A
baseline.

---

## 3. CONDITIONAL PREFLIGHT — Fixture gap escalation (Plan §12)

Per iOS-2A plan §12 and Agent 3 §6, run this grep **before** writing
any Swift:

```bash
# Are the two deferred open-bag gaps actually exercised by the redacted real export?
grep -c '"restTimerState":\s*{' tests/fixtures/data-health/ironpath-2026-05-27-redacted.json
grep -cE '"healthMetricSamples":\s*\[[^]]+\]' tests/fixtures/data-health/ironpath-2026-05-27-redacted.json
grep -c '"raw":\s*[^n]' tests/fixtures/data-health/ironpath-2026-05-27-redacted.json
```

Report counts in the PR body.

Decision rule (from iOS-2A plan §19 condition 2):

- If `restTimerState >= 1` AND (`healthMetricSamples` array non-empty
  AND `raw` non-null count `>= 1`): the two deferred gaps are
  transitively covered. PROCEED to §4.
- If either is zero: **STOP**. The deferred gaps are NOT covered.
  iOS-2B is blocked until a sibling PR adds
  `tests/fixtures/parity/inputs/app-data/synthetic-open-bag-edge-v1.json`
  + matching golden. Report the gap and exit. Do not write Swift.

---

## 4. Files to create (exact paths)

### 4.1 Swift model files — 17 total

Under `ios/packages/IronPathDomain/Sources/IronPathDomain/`:

1. `JSONValue.swift` — the `JSONValue` enum + `OrderedJSONObject` +
   `NumberRepr` + `GenericCodingKey` + `init(decoding:)` +
   `canonicalJSONData()`. See iOS-2A plan §6 for the public surface.
2. `SchemaVersion.swift` — the `SchemaVersion` struct + the
   `SchemaVersionError` enum (`upgradeRequired(found: Int)`,
   `futureIncompatible(found: Int)`). See plan §9.
3. `WeightUnit.swift` — `public enum WeightUnit: String, Codable, Sendable { case kg, lb }`.
   See plan §10.
4. `AppData.swift` — the 24-field `AppData` struct with `_unknown:
   OrderedJSONObject`. Custom Codable per plan §11.
5. `AppSettings.swift` — the `AppSettings` struct. **Open-bag site
   #1.** Custom Codable per plan §7 + §11.
6. `UserProfile.swift` — value-type struct.
7. `TrainingSession.swift` — the ~55-field session struct.
   **Largest single file.** Custom Codable.
8. `TrainingSetLog.swift` — the ~25-field set-log struct.
9. `ActualSetDraft.swift` — small struct.
10. `ExercisePrescription.swift` — the ~30-field prescription struct.
11. `MesocyclePlan.swift` — weekly plan + week budgets.
12. `ScreeningProfile.swift` — screening + adaptive state + issue
    scores. Open-bag at `adaptiveState.issueScores`.
13. `ProgramTemplate.swift` — program template + adjustments.
14. `HealthMetricSample.swift` — health sample with `raw:
    JSONValue?` (open-bag for the raw payload).
15. `UnitSettings.swift` — `weightUnit: WeightUnit` + optional
    `displayUnit`.
16. `TodayStatus.swift` — small status struct.
17. `AdaptiveCalibrationState.swift` — float-precision-sensitive
    struct.

### 4.2 Swift test files — 5 total

Under `ios/packages/IronPathDomain/Tests/IronPathDomainTests/`:

1. `AppDataCodableRoundTripTests.swift` — see plan §13 for the assertion
   shape.
2. `AppDataSchemaVersionGuardTests.swift` — the three-branch refusal
   contract from plan §9.
3. `AppDataOpenBagPreservationTests.swift` — iterates the 37-site
   list. Comment block at the top documents the three deferred gaps
   per Agent 3 §6.
4. `AppDataIsoTimestampStaticGuardTests.swift` — Swift `Mirror`-based
   slot scanner; rejects any `Date` slot at runtime. Per plan §8.
5. `AppDataUnitFieldPreservationTests.swift` — kg-storage / lb-display
   round-trip per plan §10.

**Do NOT delete** the existing
`ios/packages/IronPathDomain/Sources/IronPathDomain/IronPathDomain.swift`
(version constant) or the iOS-1 placeholder smoke test
`IronPathDomainTests.swift`. They remain.

### 4.3 Fixture copies — 2 files

Copied verbatim from the canonical iOS-0 parity tree:

```
ios/packages/IronPathDomain/Tests/IronPathDomainTests/Fixtures/
├── snapshot-hash-stable-v1-input.json
│   (← byte-identical to tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json)
└── snapshot-hash-stable-v1-golden.json
    (← byte-identical to tests/fixtures/parity/golden/app-data/snapshot-hash-stable-v1.json)
```

NO real-export copy. iOS-2B's parity tests against the real export
load the canonical path
`tests/fixtures/data-health/ironpath-2026-05-27-redacted.json` from
the test bundle's resource path. If that path is not loadable from
within `swift test` (it's outside the package directory), iOS-2B
**either** copies the redacted file too **or** uses an
`#fileLiteral`-equivalent path resolution that walks up to the repo
root. Agent 4 §10 recommended against the walk-up approach due to
`.build/` non-determinism, so copying is the fallback. Note: the
redacted file is ~805 KB; copying it adds noticeable bytes to the
Swift package. The iOS-2B PR body must document the decision.

### 4.4 `Package.swift` edit — ONE line

`ios/packages/IronPathDomain/Package.swift` test target gains a
`resources:` parameter:

```swift
.testTarget(
    name: "IronPathDomainTests",
    dependencies: ["IronPathDomain"],
    resources: [.copy("Fixtures")]   // ← ONLY new line
),
```

No other Package.swift edit.

### 4.5 TS static-guard tests — 3 files

Under `tests/`:

1. `iosAppDataSwiftModelStaticGuards.test.ts` — scans every `.swift`
   under `ios/packages/IronPathDomain/Sources/IronPathDomain/`:
   - no `import SwiftData`, `import CoreData`, `@Model`, `@Observable`
   - no `: Date\b` / `: Date?\b` field declarations
   - every model file declares the type whose name matches the file
   - whitelisted model names: the 17 in §4.1
2. `iosAppDataNoSwiftDataCoreDataGuards.test.ts` — scans
   `IronPathDomain` (sources + tests) + `Package.swift`:
   - no `.package(url: …)`
   - no Supabase / HealthKit / GoTrue / PostgREST / Sentry /
     Crashlytics / Firebase imports
3. `iosAppDataFixtureParityDocsGuard.test.ts` — byte-equality assert:
   - `ios/packages/IronPathDomain/Tests/IronPathDomainTests/Fixtures/snapshot-hash-stable-v1-input.json`
     bytes equal `tests/fixtures/parity/inputs/app-data/snapshot-hash-stable-v1.json` bytes
   - `ios/packages/IronPathDomain/Tests/IronPathDomainTests/Fixtures/snapshot-hash-stable-v1-golden.json`
     bytes equal `tests/fixtures/parity/golden/app-data/snapshot-hash-stable-v1.json` bytes

### 4.6 iOS-1 test evolution

`tests/iosBootstrapNoBusinessLogic.test.ts` evolves to whitelist the
17 iOS-2 model names:

- Remove `AppData` from the forbidden-symbol list (`BUSINESS_LOGIC`
  array's `AppData_struct_or_class` row). KEEP `TrainingDecision`,
  `CleanAppDataView`, `AutoRepairOrchestrator`, `CloudSnapshot`,
  `buildTrainingDecision`, `buildFocusStepQueue`, `writeSnapshot`,
  `AppDataRepairLedger` (all still deferred to iOS-3 / iOS-4 / iOS-5 /
  iOS-7).
- The "every package source file declares only a version constant"
  assertion (`iosBootstrap every package source file declares only a
  version constant`) must change to skip `IronPathDomain` entirely.
  Explicitly: `if (pkg.name === "IronPathDomain") continue;` inside
  the for-loop, with a comment block referencing the iOS-2A plan §15.

The `iosBootstrapForbiddenImports.test.ts` does NOT change. The
forbidden import list still applies.

---

## 5. Forbidden actions (do NOT do any of these)

1. Do NOT create any `.xcodeproj` / `.xcworkspace` / `.pbxproj` /
   `.swiftpm` / `Package.resolved` outside `ios/`.
2. Do NOT edit `project.pbxproj`. SwiftPM auto-discovers `Sources/`
   and `Tests/` files inside the package; no pbxproj enumeration
   needed.
3. Do NOT edit `IronPath.xcscheme`. Scheme test wiring stays deferred.
4. Do NOT add any `.package(url: …)` to `ios/packages/IronPathDomain/Package.swift`
   or any other Package.swift. The only Package.swift edit is the
   `resources: [.copy("Fixtures")]` one-liner.
5. Do NOT introduce `import SwiftData`, `import CoreData`,
   `@Model`, `@Observable` (on AppData-shaped value types),
   `import HealthKit`, `import Supabase`, `import GoTrue`,
   `import PostgREST`, `import Sentry`, `import Crashlytics`,
   `import Firebase`, `import Bugsnag`, `import Datadog`,
   `import Mixpanel`, `import Amplitude`, `import PostHog`,
   `import WebKit`, `import BackgroundTasks`.
6. Do NOT introduce any `Date` field in `IronPathDomain` model
   types. Strings only.
7. Do NOT introduce any `Date.now()` / `Math.random()` equivalent in
   Swift codec paths. Models are pure decoders.
8. Do NOT modify any TypeScript runtime source under `src/`.
9. Do NOT modify any iOS-0 parity fixture under
   `tests/fixtures/parity/inputs/` or `tests/fixtures/parity/golden/`.
   The iOS-2B `Fixtures/` directory is a copy, not a move.
10. Do NOT modify `scripts/parityGoldensEntry.ts` or
    `scripts/generate-parity-goldens.mjs`.
11. Do NOT modify `package.json` / `package-lock.json`. Do NOT
    introduce `pnpm-lock.yaml`.
12. Do NOT add new npm dependencies.
13. Do NOT add new Swift Packages. The 8 from iOS-1 stand.
14. Do NOT alter the iOS-1 placeholder `IronPathDomain.swift`
    (`IronPathDomainVersion`) or `IronPathDomainTests.swift`
    (`testVersionIsBootstrap`). They stay.
15. Do NOT silently downgrade `STORAGE_VERSION` or `SchemaVersion.current`.
16. Do NOT auto-merge. Do NOT use `gh pr merge --admin`.
17. Do NOT pre-empt Cross-review H2 (`supabase-swift` SDK decision).
18. Do NOT add HealthKit usage descriptions to `Info.plist`. HealthKit
    is iOS-8.
19. Do NOT touch `ios/IronPath/Info.plist` at all.
20. Do NOT touch `ios/packages/Iron{DataHealth,Persistence,CloudSync,HealthKit,Backup,L10n,UIKit}/`
    — every other package stays at the iOS-1 placeholder.

---

## 6. Hard MUST-NOT list (Agent 5, verbatim)

Carry through to PR body. These are non-negotiable.

1. MUST NOT use `SwiftData`.
2. MUST NOT use `Core Data`.
3. MUST NOT add `@Model` macro anywhere.
4. MUST NOT add `@Observable` to AppData-shaped value types.
5. MUST NOT use `Date` for any persisted timestamp. Use `String`
   end-to-end.
6. MUST NOT drop unknown JSON keys on decode.
7. MUST NOT silently downgrade `schemaVersion`. Refuse loads where
   `schemaVersion > 8`.
8. MUST NOT coerce kg↔lb↔kg at the model layer.
9. MUST NOT close the `AppSettings` open bag.
10. MUST NOT modify any TypeScript runtime source.
11. MUST NOT modify `package.json` / `package-lock.json` / introduce
    `pnpm-lock.yaml`.
12. MUST NOT add Supabase / HealthKit / any third-party SwiftPM
    dependency.
13. MUST NOT add Sentry / Crashlytics / Firebase / analytics SDK.

## 7. Hard MUST list (Agent 5)

1. Timestamps as `String` in ISO-8601 with `.SSSZ` millisecond
   precision.
2. `[String: JSONValue]` (via `OrderedJSONObject`) open bags at every
   site in Agent 1's 37-row inventory.
3. Canonical key-sorted JSON when emitting for hash / cloud upload
   comparison.
4. Preserve unknown enum string values verbatim.
5. Validate `schemaVersion == 8` on read; refuse-or-defer on mismatch.

---

## 8. Validation commands (run in order, all must pass)

```bash
# TypeScript side (must all return 0)
node scripts/generate-parity-goldens.mjs --check
node scripts/generate-parity-goldens.mjs --list
npm run api:dev:build
npm run typecheck
npm test
npm run build
node scripts/scan-production-dist-safety.mjs
git diff -- package.json package-lock.json yarn.lock pnpm-lock.yaml
test ! -e pnpm-lock.yaml
git diff --check

# Swift / Xcode side (run from repo root)
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS Simulator' build \
  CODE_SIGNING_ALLOWED=NO
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build \
  CODE_SIGNING_ALLOWED=NO
(cd ios/packages/IronPathDomain && swift test)
```

`xcodebuild test` on the IronPath scheme still fails with "scheme not
configured for test action" — that is **expected**, not a bug. iOS-2B
does NOT wire the scheme's Testables (it stays deferred to a later
iOS-N PR). `swift test` per IronPathDomain is the validation path.
Document this in the PR body honestly: "xcodebuild build green;
xcodebuild test on the IronPath scheme remains unconfigured (iOS-1
deferral); swift test against IronPathDomain runs N tests, M passed."

---

## 9. PR requirements

- **Title (exact)**: `iOS-2B AppData Swift Models V1: 17 model files + 5 parity tests`
- **Base branch**: `main`
- **Auto-merge**: forbidden.
- **`--admin`**: forbidden.
- **Required body sections**:
  1. **iOS-2A plan confirmation** — quote the parity-check baseline
     and the conditional preflight grep counts.
  2. **Files added** — list every Swift file by path.
  3. **Codable strategy summary** — one paragraph referencing plan
     §11 and Agent 2.
  4. **Open-bag inventory coverage** — assert all 37 sites in
     Agent 1 have a `_unknown` carrier; list the 37 type names.
  5. **Timestamp policy honoured** — list how many `String`
     timestamp fields were declared and assert zero `Date` fields.
  6. **schemaVersion policy honoured** — three-branch refusal tests
     pass.
  7. **kg/lb policy honoured** — no coercion at model layer; unit
     test asserts.
  8. **Fixture strategy** — copied N bytes from the canonical parity
     tree into `Tests/IronPathDomainTests/Fixtures/`; byte-equality
     CI guard test passes.
  9. **iOS-1 test evolution** — diff of `iosBootstrapNoBusinessLogic.test.ts`.
     `iosBootstrapForbiddenImports.test.ts` unchanged.
  10. **xcodebuild results** — generic + iPhone 17 Pro builds; `swift
      test` result with test count.
  11. **TypeScript validation summary** — every command from §8.
  12. **Package / lockfile statement** — byte-identical to
      `origin/main`; no `pnpm-lock.yaml`.
  13. **Stop conditions locked** — re-list the 13 MUST-NOT.
  14. **Cross-review H2 statement** — confirm no `import Supabase`
      in any iOS-2B file; H2 remains an outstanding user decision.
  15. **Next task pointer** — name iOS-3 explicitly (Data Health
      Swift port) and confirm iOS-2B does not touch it.

---

## 10. Acceptance criteria (CI-enforceable)

iOS-2B is accepted when ALL of the following are true:

- [ ] All 17 Swift model files exist in the documented paths.
- [ ] All 5 Swift parity test files exist in the documented paths.
- [ ] Both fixture copies exist with byte-identical content.
- [ ] `Package.swift` has exactly one new line (`resources:
      [.copy("Fixtures")]`).
- [ ] All 3 TS static-guard tests exist and pass.
- [ ] `iosBootstrapNoBusinessLogic.test.ts` updated to whitelist
      IronPathDomain.
- [ ] `xcodebuild build` succeeds for both destinations
      (generic + iPhone 17 Pro).
- [ ] `swift test` inside `ios/packages/IronPathDomain` succeeds
      with all 5 parity tests passing.
- [ ] All 10 TS validation commands in §8 return 0.
- [ ] `node scripts/generate-parity-goldens.mjs --check` reports
      `0 changed`.
- [ ] `git diff -- package.json package-lock.json yarn.lock
      pnpm-lock.yaml` is empty.
- [ ] `pnpm-lock.yaml` does not exist.
- [ ] CI (GitHub Actions IronPath Validation) passes.

If any acceptance criterion fails, the PR is BLOCKED. Hotfix in the
same branch; do not open a sibling PR.

---

End of iOS-2B task spec.
