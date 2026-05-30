# iOS-17S Tab Shell Scaffold V1

> Status: navigation-shell scaffold (single PR). Unlocks parallel tab work and is
> the **only** slice authorized to modify `project.pbxproj` (it pre-registers the
> five tab RootView files). Local-only navigation shell. No Cloud, CloudKit,
> iCloud, HealthKit, Supabase, network, WebView, auth, UserDefaults, SQLite,
> CoreData, or SwiftData.
>
> Binding contract: obey [`docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`](../IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md).
> This is an **Allowed Change Pattern** (§19.3 improve the thin SwiftUI app layer —
> rendering + wiring, no logic — + §19.5 documentation). **Source-of-truth impact:
> none. Data-safety impact: none** (no data is read or written; pure navigation).
> If any step here would conflict with that document, stop and escalate before
> writing code.

- **Baseline commit:** `6df0149` — *iOS-17b Native Per-Set Capture + In-RAM Session V1 (#422)* (latest `origin/main`)
- **Branch:** `ios-17s-tab-shell-scaffold`

## Goal

Introduce the five-entry tab structure the rest of the native product will grow
into — 今日 / 训练 / 记录 / 计划 / 我的 — without building any tab's business
surface yet. The existing 专注训练 (Focus Mode) experience moves under 训练 with
**zero behavior change**; the other four tabs render compliant placeholder empty
states. Five placeholder `*RootView` files are pre-registered into the Xcode
project so independent follow-up slices can fill one tab each **in parallel**
without re-touching `project.pbxproj` or each other.

## Why this slice exists (and why it owns `project.pbxproj`)

Adding files to this project requires editing `project.pbxproj` (it is a classic
`objectVersion = 60` project, **not** a file-system-synchronized group, so files
are not auto-included). Master §18 lists `project.pbxproj` edits as forbidden
"unless absolutely necessary and justified." Pre-registering the five RootView
shells in **one** controlled slice means the parallel tab-fill slices each edit
**only their own RootView body + package logic** and never collide on the project
file. That justification is the reason this slice — and only this slice — touches
`project.pbxproj`.

## Scope

A pure app-layer navigation shell. **No package changed** (`ios/packages/*`
untouched), no engine, no persistence, no Domain/AppData type change.

**In scope**

1. **`ContentView.swift`** — body becomes a `TabView`. A presentation-only
   `AppTab` enum (`today/training/history/plan/profile`) supplies each tab's
   Chinese label + SF Symbol + display order. Default selection = `.training`, so
   the app still launches into the Focus shell (behavior parity with the pre-tab
   app). No business logic; in-RAM selection state only.
2. **Five new placeholder RootView files** under `ios/IronPath/`, each the single
   app-layer mount point for its tab:
   - `TrainingRootView.swift` — hosts the existing `FocusModeShellView()`
     **unchanged** (it just returns that view, exactly what `ContentView` returned
     before this slice).
   - `TodayRootView.swift` / `HistoryRootView.swift` / `PlanRootView.swift` /
     `ProfileRootView.swift` — compliant empty states (master §15.4: title +
     one-sentence explanation + one action). The single action opens an honest
     "开发中" disclosure alert (no fake success, no data access, no shell coupling).
3. **`project.pbxproj`** — register the five new files (PBXBuildFile,
   PBXFileReference, PBXGroup children, PBXSourcesBuildPhase) with readable `B5…`
   fake UUIDs distinct from existing references.
4. **Docs** — this file + master arch refresh (§5 file map, §27 milestones,
   baseline markers).
5. **Guard update** — the iOS-5 ContentView-wiring static guard
   (`tests/iosNativeFocusModeShellStaticGuards.test.ts`) is relocated to track the
   new mount chain: it now locks `TrainingRootView` hosting `FocusModeShellView()`
   **and** `ContentView` mounting `TrainingRootView()`. Same invariant ("Focus is
   reachable from the app root"), tightened — **not** weakened (master §22). This
   is the one `tests/**` edit, a direct consequence of the requested ContentView
   change.

**Out of scope (explicitly NOT done here)**

- Any tab's real business surface (only empty states / the existing Focus mount).
- Any change to `FocusMode*` behavior, state, or the `.plan/.inSession/.completed`
  flow.
- Engine / persistence / Domain / DataHealth / LocalSnapshot / goldens.
- `package.json` / lockfile (byte-unchanged). Stub packages (untouched).
- History reuse in 记录: the task allowed reusing the existing history entry, but
  this slice keeps 记录 a placeholder empty state to stay minimal (§1.4 "do less")
  and because the History parallel line owns that real surface. Existing history
  remains viewable inside the 训练 tab's Focus shell meanwhile.

## Parallel-line integration contract (in every `*RootView` header)

> Each `*RootView` is the SINGLE app-layer mount point for its tab in the
> `ContentView` TabView shell. A parallel line fills a tab by replacing ONLY that
> RootView's body and the package logic it renders. Do NOT edit `ContentView`
> (the shell), another tab's RootView, or `project.pbxproj` from a tab-fill slice
> — the shell + pbxproj registration are owned by iOS-17S. Keep the app layer thin
> (master §5/§15/§19.3): no business logic, no persistence, and no
> network/cloud/auth/HealthKit/WebView in a RootView.

## Source-of-truth & data safety

- **Source-of-truth impact: none.** No canonical AppData read/write path is added
  or moved (§8 untouched). No second write path.
- **Data-safety impact: none.** No persistence, no snapshot, no schema/timestamp
  change, no open-bag concern, no draft/restore change. The shell and placeholders
  touch no store at all. The 训练 tab delegates to the unchanged Focus shell,
  whose existing local-snapshot history behavior is unaffected.

## Validation

Swift change → master §21.1 (TS CI suite) **and** §21.2 (local Swift) apply
(§21.3). No `ios/packages/*` changed, so **no package `swift test` is applicable**
(the app layer is not a tested package); the authoritative Swift check is the app
build on both destinations.

```bash
# App build, both destinations (local signing disabled — no dev team needed):
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' CODE_SIGNING_ALLOWED=NO build   # ** BUILD SUCCEEDED **
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build                        # ** BUILD SUCCEEDED **

# TypeScript CI gate (required on every PR; no TS source changed here):
npm run api:dev:build && npm run typecheck && npm test && npm run build
git diff --check                 # no whitespace/conflict markers
# package.json + package-lock.json byte-unchanged; parity goldens untouched (engine not touched)
```

`project.pbxproj` parse was confirmed with `plutil -lint` (OK) and
`xcodebuild -list` (target + 10 packages resolve) before building.

## Definition of Done

- [x] Five tabs switchable; Focus behavior unchanged under 训练 (it hosts the
      unchanged `FocusModeShellView`; launch still opens on 训练).
- [x] Five RootView files registered into `project.pbxproj`; the four non-training
      tabs are compliant empty states (title + explanation + one action).
- [x] Integration-contract comment present in every RootView header.
- [x] `xcodebuild` both destinations: **BUILD SUCCEEDED**.
- [x] Only this slice modifies `project.pbxproj`.
- [x] This doc + master §5/§27/baseline refresh included in the PR.
