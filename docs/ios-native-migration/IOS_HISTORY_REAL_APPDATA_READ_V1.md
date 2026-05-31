# iOS History (记录) — Real AppData Read Path V1

**Baseline commit:** `5711bd4` (latest `origin/main`, *我的页接真实 AppData* #438 merged)
**Branch:** `history-real-appdata-read` (no worktree; never committed to `main`)
**Predecessor:** iOS-17 记录 (History) read-only surface V1 (#427) — supersedes its
"LocalSnapshot-only viewer." Reuses the **Today** (#437) / **Profile** (#438)
read-for-display load→clean→resolve pattern for a third surface, and makes canonical
`AppData` the unified display source for real completed training.

Binding contract: `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`. This slice is a
§19.2 (extend active packages with pure logic) + §19.3 (improve the thin app layer)
change. **Source-of-truth impact: none (read-only). Data-safety impact: none (no write).**

---

## 1. Goal

Switch the 记录 (History) surface from the iOS-17 LocalSnapshot-only viewer to the
user's **real on-device canonical AppData**, rendered as **ONE unified, most-recent-
first timeline** of real completed training, with each row tagged by origin:

```
canonical AppData store (Application Support / IronPathAppData, the §8 source of truth)
   → load() (read-only)
   → buildCleanAppDataView              (IronPathDataHealth — the §10 chokepoint)
   → resolveHistoryDisplayState         (IronPathDataHealth — pure branch resolver)
   → CompletedTrainingTimeline.make     (IronPathDomain — pure merge + dedup + order)
   → HistoryDisplayState                (rendered verbatim by the thin surface)
```

Two honest, source-tagged origins are merged:

- **原生** — native completed sessions from canonical `AppData.history`, read as the
  DataHealth-**CLEANED** `cleanedHistory` (the §8 source of truth).
- **来自 Apple 健康** — the DERIVED, display-only `importedWorkoutSamples` (HK-2):
  listed + tagged, **NEVER** treated as a native session, **NEVER** engine input (§8.2).

It is **read-only**: no new write path, no `save`, no source-of-truth move, no engine
change, no golden touched.

## 2. The no-loss merge (the key design decision)

A native session is double-written on completion (`FocusModeMvpState.completeSession`):
the local Focus snapshot store **and** canonical `AppData.history` receive the same
session, keyed by the **same id** (`session.id == snapshot.snapshotId`). BUT a native
session completed **without per-set detail** is saved **only** to the snapshot store —
`persistCanonicalSession` returns `.skipped` when nothing was logged per-set, so no
canonical `history` entry is written.

So the two stores **overlap by id** (native-with-detail) and the snapshot store has
**extras** (no-detail completions). Per the chosen V1 strategy (**merge by id, lose
nothing**):

- The canonical `cleanedHistory` completed sessions are listed (源-真值, 原生).
- The Apple-Health `importedWorkoutSamples` are listed (派生, 来自 Apple 健康).
- The local Focus snapshot store is **also read read-only**; its completions are fed
  in as a NEUTRAL `SupplementalNativeCompletion` and merged, **deduped by id against
  the canonical natives — canonical (the source of truth) wins**. A snapshot whose id
  already appears in canonical is dropped (no duplicate row); a snapshot-only
  completion (no canonical counterpart) is KEPT (lost nowhere).

The dedup runs through a NEUTRAL Domain value so `IronPathDomain` / `IronPathDataHealth`
import **no** `IronPathLocalSnapshot` type — the two packages stay decoupled (§12);
only the thin app-layer model reads both stores.

## 3. Scope (what is in)

| File | Change |
| --- | --- |
| `ios/packages/IronPathDomain/Sources/IronPathDomain/CompletedTrainingTimeline.swift` | **New.** Pure unified read-model: `CompletedTrainingTimeline` (`entries` + `isEmpty`), `CompletedTrainingEntry` (`.native` / `.imported`), `NativeCompletedTraining`, the neutral `SupplementalNativeCompletion`, and `CompletedTrainingSource`. `make(canonicalHistory:supplementalNatives:importedWorkouts:)` does the completed-only filter, the **dedup-by-id** (canonical wins), and the **stable most-recent-first** ordering (nil timestamps last). Foundation-only — Domain stays the leaf; no `IronPathLocalSnapshot` import. |
| `ios/packages/IronPathDomain/Tests/IronPathDomainTests/CompletedTrainingTimelineTests.swift` | **New.** 10 unit tests: empty / native-with-counts / non-completed-excluded / imports-tagged / dedup-canonical-wins / supplemental-kept / nil-id-kept / unified-ordering-across-sources / nil-timestamp-last-stable / determinism. |
| `ios/packages/IronPathDataHealth/Sources/IronPathDataHealth/HistoryDisplayProjection.swift` | **New.** Pure `HistoryAppDataLoadOutcome` / `HistoryDisplayState` + `resolveHistoryDisplayState(_:supplementalNatives:)` — reads the CLEANED `cleanedHistory` + the cleaned view's `raw.importedWorkoutSamples`, builds the timeline, and maps load outcomes to honest states. `.missing` + supplemental → still `.ready` (no-loss before the first canonical write). Lives in DataHealth (not engine-related); no new import edge. |
| `ios/packages/IronPathDataHealth/Tests/IronPathDataHealthTests/HistoryDisplayProjectionTests.swift` | **New.** 8 branch tests (missing / missing-with-supplemental / unreadable / loaded-empty / loaded-unified-ordered / reads-cleaned-not-raw / dedup-through-resolver / determinism), AppData built in memory and run through the GENUINE `buildCleanAppDataView`. |
| `ios/IronPath/HistoryRootView.swift` | Reworked: inlines the thin `@MainActor HistoryRealDataModel` (the canonical store + the local snapshot store read seams) and renders the unified timeline (原生 / 来自 Apple 健康 rows) + three honest states (ready / empty / unavailable). The four-default-arg→zero-arg `init()` keeps `ContentView`'s `HistoryRootView()` call unchanged. |
| `docs/ios-native-migration/IOS_HISTORY_REAL_APPDATA_READ_V1.md` | This document. |
| `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` | Minimal §27 milestone row + a one-line §5 note that the read-for-display path now also backs the 记录 surface (per §1.1 same-PR doc update; no binding rule changed). |

No other RootView, the shell (`ContentView`), `FocusMode*`, the `IronPathLocalSnapshot`
package, any persistence **write** path, `project.pbxproj`, `package.json` / lockfile,
any golden, or any stub package is touched.

## 4. Architecture decisions

### 4.1 Package homes — additive only, import graph unchanged
- **Pure merge/order/dedup → `IronPathDomain`** (where presentation read-models like
  `ProfileDisplayData` already live). `CompletedTrainingTimeline` operates on Domain
  types (`TrainingSession`, `ImportedWorkoutSample`) + the neutral
  `SupplementalNativeCompletion` only — no `CleanAppDataView`, no IO, **no
  `IronPathLocalSnapshot`** — so Domain stays the Foundation-only leaf (§6.3).
- **Outcome→state resolver → `IronPathDataHealth`** (the owner of `CleanAppDataView`,
  §10). The 记录 surface is **not** engine-related, so — like Profile's resolver — it
  lives here, keeping the import graph a DAG (`DataHealth → Domain` only; **no new
  edge**, and crucially none to `IronPathLocalSnapshot`).

### 4.2 DataHealth gating is mandatory + structural (§10)
`resolveHistoryDisplayState`'s `.loaded` case carries a **`CleanAppDataView`** — so a
caller **cannot** resolve a state without first routing the document through
`buildCleanAppDataView`. Native completed sessions are read from the **CLEANED**
`cleanView.cleanedHistory`; the derived imports ride in `cleanView.raw.importedWorkoutSamples`
(the document that PASSED the clean-view ingress — the same pattern Profile uses for
`raw.healthMetricSamples`). `test_loadedReadsCleanedHistory_notRaw` pins this
structurally.

### 4.3 No-loss merge + dedup by id (canonical wins) — §12 decoupling preserved
See §2. The snapshot-only completions are fed in as the neutral
`SupplementalNativeCompletion`; the dedup (`Set<String>` of canonical ids; supplemental
kept only when its id is absent) makes **canonical the winner** for any overlapping id,
so every completion appears **exactly once**. The neutral value means the merge logic —
and the whole `IronPathDomain` / `IronPathDataHealth` layer — needs no
`IronPathLocalSnapshot` import; the two packages stay decoupled.

### 4.4 Imports stay derived / display-only (§8.2)
`importedWorkoutSamples` are listed and tagged "来自 Apple 健康", formatted by the view
(workout label via `IronPathHealthKit.HealthKitWorkoutMapper`, duration / energy /
distance / heart rate when present — an absent field honestly omitted). They are
**never** native sessions and **never** engine input — the unified entry keeps them in
the `.imported` case, tagged `.appleHealth`, separate from `.native` at every step.

### 4.5 Honest states (§15.4) — first launch / empty / unreadable
| Outcome (app-layer loader) | State | Surface |
| --- | --- | --- |
| no canonical file yet (first launch) / no live source, **and** no snapshot-only completion | `.empty` | "还没有完成的训练记录" + explanation + 刷新 |
| no canonical file yet but snapshot-only completions exist | `.ready` | those native completions are still shown (no-loss) |
| a document loads but has **no completed training** (and no import, no supplemental) | `.empty` | same honest empty |
| a document exists but **cannot be loaded/decoded** | `.unavailable` | "暂时无法读取记录" — honest degrade + 重试; the document is **left untouched** |
| a document loads **with** completed training (or imports) | `.ready(timeline)` | the unified, source-tagged, time-ordered list |

No fabricated rows are ever shown. A present-but-unreadable canonical document degrades
the whole tab honestly (never a partial render that could imply the canonical data
loaded); the snapshots are not lost (retry re-reads). Raw AppData never reaches the
surface — natives always pass through `cleanedHistory` first (§10).

### 4.6 Data safety — read-only, never overwrite the unreadable
This path **never writes**: no `save`, no `backup`, no candidate build, no AppData
mutation, no schema bump, no open-bag change. A present-but-unreadable document maps to
`.unavailable` and is left exactly as it is on disk — the same "never destroy
unparseable user data" stance the write path takes (§8.1), reached here by simply never
writing.

### 4.7 LocalSnapshot draft-recovery / restore / detail untouched (§12/§13)
The §12/§13 draft-recovery, restore (`onContinue`), and per-session detail
(`FocusSavedSessionDetailView`) are hosted on the **训练 tab** (`FocusSavedSessionHistoryView`,
driven by `FocusModeMvpState`) — **not** touched by this slice. The 记录 tab consumes
the snapshot store **read-only** (`scanSnapshots().valid`, the same read the iOS-17
viewer used) and never mutates it. The `IronPathLocalSnapshot` package is unchanged.

### 4.8 App layer stays thin (§5/§15) — inlined model, no pbxproj edit
The `@MainActor HistoryRealDataModel` is **inlined in `HistoryRootView.swift`** (an
already-registered file) rather than a new file, so **`project.pbxproj` is untouched**
(the Today/Profile-read precedent). The model owns ONLY wiring + the two read-only IO
seams (the canonical `JSONFileAppDataStore.applicationSupport()` + the
`LocalSessionSnapshotStore`); it never touches `FileManager`, never writes, and
delegates the whole merge/order/state transform to the pure packages. All branch logic
is unit-tested; the view only renders + formats.

## 5. Behavior note (in scope, intentional)

- The 记录 timeline carries no scenario / phase / deload labels (those are LocalSnapshot
  presentation fields, not on the canonical `TrainingSession`); a native row shows the
  finish time + exercise/set counts + the 原生 tag. The iOS-17 viewer's search /
  scenario / date-range filters are not reproduced in V1 (they keyed off LocalSnapshot-
  only fields); a follow-up could add filtering over the unified timeline.
- Per-session detail + restore stay on the 训练 tab (§4.7).

## 6. Validation

Swift (local — CI does not build/test Swift, master §21.2):

| Check | Result |
| --- | --- |
| `swift test` — `IronPathDomain` | **116 tests, 0 failures** (10 new) — exit 0 |
| `swift test` — `IronPathDataHealth` | **120 tests, 0 failures** (8 new) — exit 0 |
| `swift test` — `IronPathTrainingDecision` (golden/parity proof, unchanged) | **149 tests, 0 failures** — exit 0 |
| `xcodebuild … -scheme IronPath -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` | **BUILD SUCCEEDED** — exit 0 |
| `xcodebuild … -scheme IronPathWidgetExtension -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` | **BUILD SUCCEEDED** — exit 0 |

TypeScript / repo (master §21.1 — no TS *source* touched; the iOS static-guard suites
that scan the Swift packages + app layer DO gate this Swift change, so they ran):

| Check | Result |
| --- | --- |
| `npm run api:dev:build` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` (vitest, incl. all iOS static guards) | **1373 files / 6904 tests passed** — exit 0 |
| `npm run build` | exit 0 |
| `git diff --check` | exit 0 |

Dependencies unchanged (`npm ci` from the existing lockfile; no `package.json` /
lockfile edit). No parity golden regenerated. `project.pbxproj` untouched.

## 7. Device smoke (manual, on-device — not automated)

1. **Fresh install / no canonical file, no sessions:** open 记录 → the honest **empty**
   state ("还没有完成的训练记录" + 刷新). Nothing crashes, nothing is written.
2. **Complete a native session WITH per-set detail:** finish a Focus session logging
   sets → open 记录 → a 原生 row appears with the finish time + exercise/set counts,
   shown **once** (the canonical + snapshot copies are deduped by id).
3. **Complete a native session WITHOUT per-set detail:** finish without per-set capture
   (snapshot-only, skipped canonical) → open 记录 → it **still** appears as a 原生 row
   (no-loss merge), again **once**.
4. **Import Apple Health workouts (HK-2, in 我的):** import → open 记录 → 来自 Apple 健康
   rows appear interleaved by time, with duration / energy / distance / heart rate when
   present; never counted as native, never affecting the plan.
5. **Unreadable document:** with a deliberately corrupt canonical file, open 记录 → the
   **unavailable** degrade state appears, the file is left untouched on disk
   (re-openable by the PWA), and 重试 re-reads without overwriting.

## 8. Follow-ups (out of scope here)

- Filtering / search over the unified timeline (date range, source, scenario) — a
  separate presentation slice.
- A native per-session detail in the 记录 tab (today detail + restore live on the 训练
  tab) — a separate slice if desired.
- Engine consumption of imported health metrics / performed sets — deferred; imports
  here stay display-only and never engine input.
