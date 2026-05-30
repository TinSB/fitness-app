# iOS-17B — 我的 (Profile) Surface V1

> Read-only fill of the 我的 tab: render the profile / unit / screening /
> settings Domain values with a local-only display-unit toggle. A
> parallel per-tab fill on the iOS-17S tab shell.

**Note on the name.** This is iOS-17B (uppercase B), the **Profile
surface**. It is distinct from iOS-17b (lowercase b) "Native Per-Set
Capture" ([#422](https://github.com/TinSB/fitness-app/pull/422)). Same
number, different slice.

---

## Task framing (master §25)

**Baseline commit:** `3b75722` (latest `origin/main`, iOS-17C Plan + Today Read-only Surface V1 / #424 — a sibling parallel per-tab fill on the same iOS-17S shell)
**Goal:** Render the 我的 tab — personal profile, unit preference, screening, and app settings — read from the existing `IronPathDomain` types, with a display-unit (kg/lb) toggle that is local UI state only.
**Scope:** Fill ONLY `ProfileRootView`'s body + the package display logic it renders. Read-only; this slice writes no AppData.

**Allowed files / systems**
- `ios/IronPath/ProfileRootView.swift` (render only — the iOS-17S mount point for 我的)
- `ios/packages/IronPathDomain/Sources/IronPathDomain/ProfileDisplay.swift` (new — pure display helpers + preview sample)
- `ios/packages/IronPathDomain/Tests/IronPathDomainTests/ProfileDisplayTests.swift` (new — unit tests)
- `docs/ios-native-migration/IOS_17B_PROFILE_SURFACE_V1.md` (this doc)

**Forbidden files / systems (untouched)**
- `project.pbxproj` — not modified (the new package files are picked up by SwiftPM globbing; `ProfileRootView` is already registered by iOS-17S).
- `package.json` / `package-lock.json` — not modified.
- `ContentView` (the shell), any other tab's `*RootView`, `FocusMode*` — not modified.
- Any stub package (HealthKit/CloudSync/Backup/UIKit) — not touched. Display logic lives in the **active** `IronPathDomain` package (master §6.1, §19.2).
- CloudKit/iCloud/Supabase/HealthKit/URLSession/WebView/auth/UserDefaults/SQLite/CoreData/SwiftData — none introduced.

**Source-of-truth impact:** **none.** This surface is read-only; it does not read or write canonical AppData (`IronPathPersistence`) and does not change where AppData lives or who may overwrite it (master §8).
**Data safety impact:** **none.** No persistence, no schema-version change, no open-bag/round-trip change, no restore, no backup path. The existing `IronPathDomain` types are unchanged (no edit to any `encoded()`/`decoding`), so the AppData parity/round-trip guards (master §9/§22) are unaffected.

---

## What changed

### 1. `IronPathDomain.ProfileDisplay` (new, pure)
A stateless formatting namespace backing the read-only surface, so the
app layer stays a thin renderer (master §5/§15) and the logic is
unit-tested:

- `weight(_:unit:)` — formats a **kg-stored** weight in the chosen
  display unit (`72.6 kg` / `160.1 lb`). Routes through the existing
  `WeightConversion.fromKilograms` (iOS-17b) so the kg↔lb factor has a
  **single home** — no unit drift, no re-derived constant.
- `height`, `integer(_:suffix:)` — compact, locale-independent numeric
  formatting (`178 cm`, `30 岁`, `4 天/周`, `60 分钟`).
- `text`, `sex`, `trainingLevel` — string fields; the two **stable**
  enum domains (sex: male/female/other; trainingLevel: beginner/
  intermediate/advanced) map to Chinese, and any **unknown** token falls
  back to the raw value verbatim (never dropped — open-bag spirit).
- `list`, `bool`, `unitName` — list join (`、`), boolean (是/否), unit label.
- nil scalar → `未设置`; nil/empty list → `无`.

### 2. `ProfileDisplayPreviewSample` (new, deterministic)
Deterministic **preview** values for the four Domain types. This is
sample data, NOT canonical AppData — it gives the read-only page content
to render and makes the unit toggle demonstrable. Reading the real
on-device AppData is a later, gated slice (master §8/§9/§14).

### 3. `ProfileRootView` (body replaced)
- `NavigationStack` + grouped `List` (master/AGENTS UI: grouped sections,
  not stacked cards), title 我的.
- Four sections: **个人资料** (with a collapsed 健康备注 `DisclosureGroup`
  for injury/pain notes — keep the main list calm), **单位** (segmented
  kg/lb `Picker`), **筛查** (pain triggers / restricted exercises /
  correction priority — the structured `JSONValue` flags are intentionally
  NOT dumped, per the exercise-metadata rule), **设置** (training mode /
  template / readiness-uses-health-data; technical fields like
  schemaVersion are not surfaced).
- The unit `Picker` binds to `@State displayUnit` — **local UI state
  only**. Toggling it re-formats the displayed weight; it never writes
  `UnitSettings`/AppData (storage stays kg).
- The four Domain values are **injected** via `init` (default = the
  preview sample), so `ContentView`'s no-arg `ProfileRootView()` call is
  unchanged and a future slice can inject real data without touching the
  view.
- Honest disclosure in the settings footer: read-only preview, no data
  read/written (master §15.4 — no fake success).

The view contains **no business logic**: every label is produced by a
`ProfileDisplay` pure function.

---

## Validation

**Inner loop (isolated, authoritative for the new logic):**
```
swift test --package-path ios/packages/IronPathDomain
→ Executed 69 tests, 0 failures (incl. 13 new ProfileDisplayTests)
```
`IronPathDomain` is the Foundation-only dependency leaf, so this package
test is unaffected by any other in-flight work.

**App build (both destinations):**
```
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS' build CODE_SIGNING_ALLOWED=NO   → ** BUILD SUCCEEDED **
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build CODE_SIGNING_ALLOWED=NO → ** BUILD SUCCEEDED **
```
`CODE_SIGNING_ALLOWED=NO` is used because this is a local, unsigned build.

**TypeScript (CI parity, §21.1):** `npm run api:dev:build && npm run
typecheck && npm test && npm run build` + `git diff --check`. This slice
changes no TypeScript and no `package.json`/lockfile; run for confidence.
`npm test` total is unchanged from baseline (this slice adds no TS tests).

**Goldens:** not regenerated — no engine output changed (no
`packages/core`/TrainingDecision output change).

> **Provenance / honesty note.** This PR was authored in a *fresh,
> isolated clone* of `origin/main` (`3b75722`), holding only the four
> files below — no other in-flight work present. (An earlier attempt ran
> in a working tree shared with a concurrent parallel line, where a
> concurrent `git commit` landed this work on the wrong branch and the
> PR was never created; this redo discards that and re-verifies from a
> clean clone.) `IronPathDomain` is the Foundation-only dependency leaf,
> so its package test is fully isolated from any other slice.

---

## PR & merge rules (master §23)
- Branch `ios-17b-profile-surface` from latest `origin/main` (no worktree); never commit to main.
- Commit only the four intended files (no `.claude/*`, no parallel-line files).
- Open PR; wait for required checks; squash-merge only when checks pass & protection allows normally. No `--admin`, no protection bypass.
- After squash merge: delete the branch, leave the repo clean.
