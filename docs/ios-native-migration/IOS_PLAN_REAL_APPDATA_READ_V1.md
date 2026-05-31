# Plan tab — real-AppData read path V1

Switches the 计划 (Plan) tab from a fixed in-file sample to the user's **real**
on-device plan, reusing the exact canonical-AppData read path landed for Today
(#437), Profile (#438), and History (#439). Strictly **read-only**: no new write,
no source-of-truth change, no engine change, no golden touched.

## What changed

| Layer | File | Role |
|------|------|------|
| Domain (pure data) | `ios/packages/IronPathDomain/Sources/IronPathDomain/PlanDisplay.swift` | `PlanDisplay` value type + `make(mesocycle:program:)` extraction + `hasAnyContent`. Foundation-only, no IO. |
| DataHealth (resolver) | `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/PlanDisplayProjection.swift` | `PlanAppDataLoadOutcome`, `PlanDisplayState`, and the pure `resolvePlanDisplayState(_:)`. |
| DataHealth (tests) | `ios/packages/IronPathDataHealth/Tests/IronPathDataHealthTests/PlanDisplayProjectionTests.swift` | Unit tests for extraction + every empty/degrade branch, fixtures routed through the genuine `buildCleanAppDataView`. |
| App (thin view) | `ios/IronPath/PlanRootView.swift` | `PlanRealDataModel` (wiring + IO seam) + the thin renderer. |

No other file is touched — in particular **no** `project.pbxproj` (the new files
live in SPM packages, which compile their `Sources`/`Tests` automatically; the app
target only had its existing `PlanRootView.swift` edited), no `ContentView`, no
other RootView, no `package.json` / lockfile, no goldens.

## Reused read path (the §10 chokepoint)

Identical to Profile/History:

```
load (JSONFileAppDataStore.applicationSupport, §8)
  → buildCleanAppDataView(appData, clock:)        # §10 DataHealth gate
    → resolvePlanDisplayState(outcome)            # pure resolver
      → PlanDisplayState (.ready / .empty / .unavailable)
```

`PlanRealDataModel` (in `PlanRootView.swift`) owns the only IO: it opts the running
app into the **same** sanctioned canonical store the write path uses, loads it
**read-only**, and routes the document through `buildCleanAppDataView` — the §10
chokepoint. Raw AppData never reaches the view; the view only ever sees a
`CleanAppDataView` (and then only the projected `PlanDisplay`). The model mirrors
`ProfileRealDataModel` field-for-field (`store`, `now`, `isLive`,
`activateLiveSourceIfNeeded()`, `reload()`, `readOutcome(now:)`), including the
preview/test initializer that pins a state and never touches disk.

## DataHealth gating

The resolver consumes a `CleanAppDataView`, never raw AppData. The plan slots
(`mesocyclePlan` / `programTemplate`) ride in the cleaned view's `raw` bag — the
document that already **passed** the clean-view ingress — exactly as Profile reads
`raw.userProfile`. Because the `.loaded` outcome can only carry a `CleanAppDataView`
(constructed solely by `buildCleanAppDataView`), a caller structurally cannot resolve
a plan state without first routing the document through DataHealth.

The Plan projection lives in **DataHealth + Domain** (not the engine package) because
the Plan surface is **not** engine-related — it only displays the plan structure and
computes no training decision, just like Profile/History. This keeps the import graph
a DAG (`DataHealth → Domain` only; crucially **no** `DataHealth → IronPathTrainingDecision`
edge). The pre-existing `IronPathTrainingDecision.PlanSurfaceSummary` is left untouched
(no engine change); it is superseded for this read surface but cannot be reused from
DataHealth without introducing a forbidden import edge.

## Plan display fields (source of truth)

Selected by `PlanDisplay.make` from the two Domain plan value types (which mirror the
TypeScript `MesocyclePlan` / `ProgramTemplate`). Every field is optional and degrades
honestly; nil/blank scalars are dropped so the surface stays calm.

| Display field | Source | Notes |
|---------------|--------|-------|
| `phase` (阶段) | `MesocyclePlan.phase` | trimmed; blank → nil |
| `weekCount` (周数) | `MesocyclePlan.weeks.arrayValue.count` | nil when absent / not an array / empty |
| `startDate` / `endDate` (日期) | `MesocyclePlan.startDate` / `.endDate` | shown as an honest range |
| `primaryGoal` (目标) | `ProgramTemplate.primaryGoal` | trimmed; blank → nil |
| `splitType` (分项) | `ProgramTemplate.splitType` | trimmed; blank → nil |
| `daysPerWeek` (每周) | `ProgramTemplate.daysPerWeek` (`NumberRepr`) | rounded to an Int for display |
| `hasCorrectionStrategy` | `ProgramTemplate.correctionStrategy.isNonEmptyObject` | collapsed boolean; empty `{}` → false |
| `hasFunctionalStrategy` | `ProgramTemplate.functionalStrategy.isNonEmptyObject` | collapsed boolean |

The field selection matches the existing `PlanSurfaceSummary` semantics, so the tab
shows the same fields it did with the sample — now from real data.

## Honest empty / degrade states (§15.4)

- **`.missing`** — no canonical file yet / first launch / no live source → `.empty`.
- **loaded but no plan content** (`hasAnyContent == false`) → `.empty` (an honest
  "还没有训练计划", never a page of placeholders).
- **`.unreadable`** — a present but unparseable document → `.unavailable` (an honest
  degrade; the document is left **untouched** — this read path never writes / never
  overwrites). The view offers a retry.

The view never crashes, never fabricates a plan, never overwrites; raw/ungated state
is never shown.

## Validation

- `swift test --package-path ios/packages/IronPathDataHealth` — green (incl. the new
  `PlanDisplayProjectionTests`).
- `swift test --package-path ios/packages/IronPathDomain` — green.
- `npm run api:dev:build && npm run typecheck && npm test && npm run build` — green
  (no TS/JS source changed; run for confidence per §21.3).
- `git diff --check` — clean.
- `xcodebuild -project ios/IronPath.xcodeproj -scheme IronPath` for both
  `generic/platform=iOS` and `platform=iOS Simulator,name=iPhone 17 Pro`
  (`CODE_SIGNING_ALLOWED=NO`, fresh clone) — **BUILD SUCCEEDED**.
- `package.json` / `package-lock.json` byte-identical (no dependency change).

## Real-device smoke (manual)

1. On a device/simulator with an existing canonical AppData that has a mesocycle
   and/or program template, open the 计划 tab → the real phase / week count / date
   range and program goal / split / days-per-week appear; the strategy disclosure
   reflects the configured strategies.
2. On a fresh install (no canonical file) → the honest "还没有训练计划" empty state,
   no crash.
3. With a deliberately corrupted canonical file → the "暂时无法读取计划" degrade
   state; the on-disk document is left unchanged (verify the file is byte-identical
   afterwards).
