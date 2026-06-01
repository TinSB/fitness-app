# IOS History Imported-Workout Detail V1

**Read-only display polish for the 记录 (History) surface.** Surface the rich fields
the HK-2 / HK-2b Apple-Health workout import already carries — duration, distance (km),
average / max heart rate, active energy — on the "来自 Apple 健康" imported row, by
lifting the per-field display projection out of inline view code into a **pure,
unit-tested Domain projection**.

Strictly additive and read-only: no new write path, no engine change, no golden
touched, no AppData mutation, no `project.pbxproj` edit, and the #446 search / source
filter is preserved unchanged.

## Background

- **HK-2 / HK-2b (#433 / #434)** already import Apple-Health workouts into the derived,
  display-only `AppData.importedWorkoutSamples` bag, carrying `durationMin`,
  `distanceMeters`, `activeEnergyKcal`, `avgHeartRate`, `maxHeartRate` (all
  `NumberRepr` — never canonical training, never engine input, §8.2).
- **History real-AppData read (#439)** built the pure unified `CompletedTrainingTimeline`
  read-model: native completed sessions (tagged 原生) merged with the imported workouts
  (tagged 来自 Apple 健康).
- **记录 search + source filter (#446)** added the pure `CompletedTrainingTimelineFilter`
  (`searchableText` + a 全部 / 原生 / 来自 Apple 健康 source segment).

The imported row already rendered duration / energy / distance / heart rate, but that
logic — including the metres→kilometres conversion — lived **only as untested inline
string formatting in `HistoryRootView`**. This slice promotes it to a tested Domain
leaf and routes the view through it, so the conversion has a single, verified home.

## What changed

### Domain — new pure projection (additive, Date-free)

New file `ios/packages/IronPathDomain/Sources/IronPathDomain/ImportedWorkoutDisplay.swift`:

- `struct ImportedWorkoutDisplayFields` — a display-ready projection of an imported
  workout's rich fields. Every field is an `Optional<Double>`, present **only** when the
  import actually recorded it (an absent field stays `nil` — honest omission, never a
  fabricated 0). Distance is projected to **kilometres**.
  - `init(_ sample: ImportedWorkoutSample)` — pure projection from the import.
  - `isEmpty` — true when none of the five fields was recorded (the row shows only its
    workout label).
  - `static func kilometresFromMetres(_:) -> Double` — the pure metres→kilometres
    display conversion (a `Double` function — **never a `Date`**, §9).
- `extension CompletedTrainingEntry { var importedDisplayFields: ImportedWorkoutDisplayFields? }`
  — returns the projection for an imported row, `nil` for a native row. Purely additive:
  it does not touch `make` / `filtered` / ordering / `source` / `searchableText`, so the
  #439 timeline and the #446 filter are unchanged.

All metric values are `Double`; **no `Date` is introduced anywhere** (AppData instants
remain ISO-8601 strings end-to-end, §9 — the Domain leaf never types a `Date`).

### View — route through the projection

`ios/IronPath/HistoryRootView.swift`: `importedSubtitle(_:)` now builds its parts from
`ImportedWorkoutDisplayFields(workout)` (时长 · 距离(km) · 心率 · 能量), each part shown
only when present, distance formatted from the projection's `distanceKm`. The now-unused
inline `distanceText` helper was removed; `heartRateText` is retained and fed from the
projection. The native row, the source tag, the search field, and the source segment are
untouched. Search continues to run over the Domain `searchableText` (origin label +
exercise names / workout type) — independent of this display subtitle.

### Tests

New file `ios/packages/IronPathDomain/Tests/IronPathDomainTests/ImportedWorkoutDisplayTests.swift`
covers: exact metres→km conversion; full values (all five present, distance converted);
all-missing (every field `nil`, `isEmpty == true`); partial (recorded fields pass
through, missing stay `nil`); a genuinely-recorded 0 (present, not omitted); and the
additive entry accessor (native → `nil`; imported → projects while `source` /
`searchableText` are unchanged).

## Contract alignment

- **§19 (allowed change patterns):** §19.2 additive — a new pure read-model + an additive
  entry accessor; no existing signature changed, no caller broken.
- **§9:** no `Date` in the Domain leaf — every projected field is a `Double`; instants
  stay ISO-8601 strings.
- **§8.2:** imported workouts remain derived / display-only — never canonical, never
  engine input. This projection only reads already-imported fields for display.
- **§12:** `IronPathDomain` stays decoupled — Foundation-only, no `IronPathLocalSnapshot`
  / AppData coupling.
- **§27:** add one line for this read-only display-polish slice; the binding rules in
  §1–§26 are unchanged.

### Red lines honoured

- Read-only: no `save`, no AppData mutation, no new write path.
- Engine / goldens untouched; the engine still references `importedWorkoutSamples`
  nowhere.
- `project.pbxproj` untouched (the new Domain source / test files are SPM-auto-included);
  no new app file; no other RootView, write path, or disabled item touched.
- #446 search / source filter preserved (the projection is independent of `searchableText`).

## Verification

- Domain static guards (local, before commit):
  - `iosAppDataSwiftModelStaticGuards.test.ts` — **38 passed**.
  - `tests/iosAppData*` (6 files) — **139 passed**.
- `swift test --package-path ios/packages/IronPathDomain` — **161 tests, 0 failures**.
- `xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath` (generic/iOS) —
  **BUILD SUCCEEDED**.
- `git diff --check` clean; dependencies unchanged.

## DoD

- [x] Imported row shows duration / distance (km) / avg · max heart rate / energy, with
  honest omission of absent fields.
- [x] Domain leaf is `Date`-free; local Domain guards green.
- [x] Pure additive projection with unit tests; #446 search / filter not broken.
- [x] Read-only; engine / goldens not touched; `IronPathLocalSnapshot` not coupled to
  AppData.
- [x] Affected Swift package green + one `xcodebuild` green.
- [x] No other RootView / `project.pbxproj` / disabled item touched.
