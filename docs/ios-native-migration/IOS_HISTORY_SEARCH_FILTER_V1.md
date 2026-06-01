# 记录 (History) Search + Source Filter V1

Read-only search + source/date filter for the **unified completed-training
timeline** on the 记录 (History) tab. A pure, order-preserving slice — no writes, no
engine, no goldens, no `project.pbxproj`.

## Why

The History real-AppData read path (#439) replaced iOS-17's LocalSnapshot-only
history viewer with ONE unified, most-recent-first `CompletedTrainingTimeline`
(native completed sessions tagged 原生 + DERIVED Apple-Health imports tagged 来自
Apple 健康). In doing so it dropped the search/filter the older iOS-14/15
LocalSnapshot history surface carried (`LocalSnapshotHistory.filtered`). This slice
restores search + filtering **for the unified timeline**, reusing the same
pure-filter discipline.

It is *not* a reuse of the LocalSnapshot enums: those live in `IronPathLocalSnapshot`
and operate on snapshots. The unified timeline is a Domain type, so the filter is a
fresh Domain leaf — no `IronPathLocalSnapshot` import, the packages stay decoupled
(master §12).

## What

### Pure logic — `IronPathDomain`

- **`CompletedTrainingTimeline.filtered(query:source:dateRange:now:calendar:)`** — a
  pure, IO-free, **order-preserving** filter that returns a new timeline:
  - **`query`** — case-insensitive, whitespace-trimmed substring match over each
    row's `searchableText`:
    - 来源标签 (origin label): "原生" / "来自 Apple 健康"
    - 动作名 (native): the session's exercise names
    - imported: the workout type (e.g. `running`)
    - parts are newline-joined so a query never matches across two fields.
  - **`source`** — `CompletedTrainingSourceFilter`: `全部` / `原生` / `来自 Apple 健康`.
  - **`dateRange`** — `CompletedTrainingDateRange`: `全部` / `最近 7 天` / `最近 30 天`,
    measured in UTC calendar days against an **injected `now`**.
  - All filters **compose** (logical AND); each defaults to a no-op, so `filtered()`
    returns the timeline unchanged.
- **`CompletedTrainingTimeline.isWithin(_:range:now:calendar:)`** — the date-range
  membership test, exposed for direct unit testing. Mirrors
  `LocalSnapshotHistory.isWithin`:
  - `.all` (or a nil `now`) keeps **everything**, including nil / unparseable
    timestamps — a missing clock can never silently drop history.
  - a **bounded** range parses the timestamp; a nil / **unparseable** timestamp is
    **excluded** from the bounded range but never crashes (and is never dropped from
    `全部`).
  - a future-dated row (days < 0) is outside any "last N days" range.

### Model enrichment (additive, display-only)

- `NativeCompletedTraining` and `SupplementalNativeCompletion` gain a defaulted
  `exerciseNames: [String]` — the 动作名 search target. Populated by
  `CompletedTrainingTimeline.make` from the cleaned canonical session's exercises;
  the snapshot-only supplemental names are supplied by the thin app layer
  (read-only). Used for search only — never for counts or ordering. Existing callers
  and tests are unaffected (defaulted parameter).

### Thin app layer — `HistoryRootView.swift`

- A `.searchable` field + a source **segmented** control + a coarse date-range menu,
  fed straight into `CompletedTrainingTimeline.filtered` (the date filter uses the
  model's injected clock, exposed read-only as `clockNow`).
- An honest **"没有匹配的记录"** state when records exist but the active
  search/filters exclude them all — distinct from the no-records-at-all empty state,
  and rendered as a row so the filter controls stay on screen for adjustment.
- No new app file; `project.pbxproj` untouched (read-path precedent). The model reads
  the local Focus snapshot store read-only (as before) and now also maps the snapshot
  exercise names into the neutral `SupplementalNativeCompletion`.

## Read-only / data-safety

- The filter only **selects** which already-resolved rows to show — it never mutates,
  reorders, or fabricates a row, never writes AppData, never touches the engine or
  goldens, and adds no import-graph edge.
- `IronPathLocalSnapshot` is **not** coupled to AppData: the timeline + filter live in
  `IronPathDomain`/`IronPathDataHealth`; the snapshot exercise names cross the
  boundary only as the neutral `SupplementalNativeCompletion`.
- Source-of-truth impact: **none**. Data-safety impact: **none**.

## Validation

- `swift test --package-path ios/packages/IronPathDomain` —
  `CompletedTrainingTimelineFilterTests` covers text search (native exercise name /
  imported workout type / source label, case-insensitive), the source segment, the
  coarse date range (injected now; nil/unparseable excluded from a bounded range,
  kept in `全部`; future row excluded; nil clock skips date filtering), filter
  composition, the empty result, and order preservation. The existing
  `CompletedTrainingTimelineTests` still pass (enrichment is additive).
- `xcodebuild` (scheme `IronPath`, generic iOS) builds the app target with the wired
  `HistoryRootView`.

## Scope / boundaries (master contract)

- Allowed-change patterns §19.2 (extend an active package with pure, tested logic),
  §19.3 (improve the thin app layer — rendering/wiring only), §19.5 (docs).
- Read-only display polish; the only contract touch is one §27 milestone row. No
  boundary moved, no forbidden system approached.
