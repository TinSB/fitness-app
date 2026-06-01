# DEEP-EDIT-1 — Logged Set Correction V1

> **Status: implemented.** Architecture-owner approved per
> `docs/ios-native-migration/IOS_NATIVE_DEEP_EDIT_REVIEW_V1.md` (the A-route "deeper
> edit" review). This is the B-route implementation slice.
>
> Device-local; reuses the already-activated sanctioned gated edit-write path (§8.3);
> opens NO second write path; touches NO engine output, engine code, or parity goldens.

## 1. What it does

In the 记录 (History) saved-session detail (`FocusSavedSessionDetailView`), the user can
correct one logged set's **重量 (weight, kg) / 次数 (reps) / RIR** with a two-step
「编辑→保存」. The correction is written **in place** into the canonical
`AppData.history[].exercises[].sets[]` (a `TrainingSetLog`) through the single sanctioned,
DataHealth-gated write path. Honest status only: a row reflects the new value **after** a
real gated write returned `.saved`; a failure shows an honest message and changes nothing.

This is the **first** native edit to reach a **nested** structure rather than a top-level
scalar (EDIT-1…EDIT-4 edited `userProfile` / `unitSettings` / `screeningProfile` /
`programTemplate` scalars).

## 2. The one principle — edit the engine INPUT, never the engine OUTPUT

| Class | This set's fields | Editable? |
| --- | --- | --- |
| **Engine input** (user's own record) | `TrainingSetLog.weight` (kg) / `reps` / `rir` | **Yes** — the user is correcting their own logged performance |
| **Engine output** (computed) | `MesocyclePlan.weeks` blob, `ExercisePrescription` prescription/advice, computed phase / readiness / e1RM | **Never** — computed FROM the input; the engine recomputes them |

A logged set is consumed by the `TrainingDecision` engine to compute e1RM trend / readiness.
Correcting it and letting the engine **recompute** is the *expected* behaviour (review §1/§4),
exactly like editing 资料 / 筛查 / 计划配置 in EDIT-1…EDIT-4. This slice changes only the input
data — never how the engine computes, and never the computed result.

## 3. The nested data path (confirmed against the real models)

```
AppData.root["history"]  (array, open bag)
  └─ TrainingSession           id == snapshotId  ("focus-<scenario>-<index>")
       └─ exercises[]          ExercisePrescription   id / exerciseId == the engine line id
            └─ sets[]           TrainingSetLog         stored setIndex == the UI's per-set index
                 ├─ weight  (NumberRepr?, kg)   ← edited
                 ├─ reps    (NumberRepr?)       ← edited
                 └─ rir     (JSONValue?)        ← edited
```

Performed sets live in `exercises[].sets` (NOT the in-progress `focusActualSetDrafts`
buffer — see the `NativeCompletedSessionBuilder` header). The saved-session snapshot the UI
renders is built from the SAME in-RAM capture as the canonical write, so its `snapshotId`,
exercise `exerciseId`, and per-set `setIndex` map 1:1 onto the canonical session — the edit
locates the set by exactly the identity the UI shows.

## 4. Layers

### Domain — `IronPathDomain/HistorySetEdit.swift` (pure value, no IO, zero `Date`)

- `AppData.withUpdatedHistorySet(sessionId:exerciseId:setIndex:weightKg:reps:rir:)` — locates the
  first session by `id`, the first exercise by `id`/`exerciseId`, the set by stored `setIndex`;
  rewrites **only** that set's three metrics; re-emits **only** the matched session; rewrites
  **only** the `history` key. `weightKg` is represented with the SAME `NumberRepr` shape a fresh
  capture produces (`ActualSetDraftFactory.weightNumber`: whole → `.integer`, fractional →
  `.double`), so a corrected set round-trips byte-identically to a freshly logged one. A missing
  target returns the document unchanged (a no-op the gate then rejects).
- `TrainingSetLog.withCorrectedMetrics(weight:reps:rir:)` — replaces only the three metrics,
  preserves identity / other weight columns / `completedAt` / `done` / `_unknown`.
- `ExercisePrescription.withUpdatedSets(_:)` / `TrainingSession.withUpdatedExercises(_:)` — replace
  only the nested array, preserve every sibling field + `_unknown`.

Open-bag fidelity is preserved at **every** nesting level (session / exercise / set + each level's
unknown keys); `schemaVersion` is never bumped; ISO timestamps (incl. the set's `completedAt`) pass
through untouched.

### Persistence — `CanonicalSessionWriter.updateHistorySet(...)`

A thin sibling entry point that funnels through the SAME private `performGatedMutation`
(`buildCandidate: { $0.withUpdatedHistorySet(...) }`) as `appendCompletedSession` /
`updateProfile` / `updateUnitSettings` / `updateScreening` / `updateProgramConfig`. **NOT** a second
write path — still exactly one `store.save`: load → gate → backup-before-overwrite → atomic save →
honest throw. A present-but-unreadable document is never overwritten.

### App — `FocusModeMvpState.updateLoggedSet(...)` + `FocusSavedSessionDetailView`

- `updateLoggedSet` converts the entered weight from `captureDisplayUnit` to kg
  (`WeightConversion.toKilograms`), builds the writer, and supplies the **defensive DataHealth
  gate**: re-encode → re-decode (re-runs the `SchemaVersion` guard) → `buildCleanAppDataView`; accept
  only when the corrected set **survives the clean view** AND its three metrics **landed exactly as
  intended** (representation-agnostic). It returns an honest `LoggedSetEditOutcome` (`.saved` /
  `.failed(message)`) — no fake success.
- `FocusSavedSessionDetailView` renders each set row with an 「编辑」 affordance; in edit mode it
  shows three display-unit fields + 保存/取消 + an honest inline error. On `.saved` the row reflects
  the new value via an in-RAM display override (the canonical store is authoritative); on `.failed`
  the message stays and edit mode is kept. A blank field clears that metric (honest "not entered");
  a non-empty unparseable/negative entry blocks the save. Thin UI — **no new app file,
  `project.pbxproj` untouched**.

## 5. Storage is kilograms

The user enters weight in the display unit (kg/lb); `WeightConversion.toKilograms` converts to kg
before storage. No stored weight is ever coerced kg↔lb. Height is irrelevant to this slice.

## 6. Display cache (LocalSnapshot) note

The saved-session list/detail is backed by a **derived display snapshot** (`IronPathLocalSnapshot`,
`LocalCompletedSessionSnapshot`) that is explicitly never read back as a source of truth (§8/§12).
The authoritative store the engine reads is canonical `AppData.history`, which this edit corrects.
The open detail sheet reflects the corrected value via an in-RAM override after `.saved`; the
per-set values do not appear in the session-level history list, so the list is unaffected. The
display snapshot cache itself is intentionally **not** mutated (no second write path; default-simple).

## 7. Contract impact

- **Source-of-truth:** still in-place edit of canonical `AppData` through the §8.3 path — **no new
  boundary**; "editable" extends from a top-level scalar to a nested logged-set metric.
- **Amended:** §8.3 (DEEP-EDIT-1 note), §9 (DEEP-EDIT-1 note), §27 (milestone row).
- **Unchanged:** §11 (engine boundary) — no engine output is edited and no engine code/golden is
  touched. Cloud/account still forbidden (§17); full restore still deferred (§14); not a restore
  (§13/§14).

## 8. What this slice does NOT do

- Does **not** edit any engine output (weeks blob / prescriptions / computed phase/readiness/e1RM).
- Does **not** change engine code or parity goldens (the engine reading the corrected input and
  recomputing e1RM is the expected, compliant behaviour).
- Does **not** open a second write path (one `store.save`), bump `schemaVersion`, or perform a
  restore.
- Does **not** add a new app file or modify `project.pbxproj`; does **not** touch unrelated tabs.

## 9. Verification

- `HistorySetEditTests` (Domain) — target-set-only edit; per-level open-bag + sibling
  set/exercise/session preservation; engine-output (weeks / strategy / advice) preservation; whole→
  integer / fractional→double representation; nil clears honestly; missing target is a byte-identical
  no-op; value-semantics. `TrainingSetLog.withCorrectedMetrics` open-bag preservation.
- DEEP-EDIT-1 cases in `CanonicalSessionWriterTests` (Persistence) — gated correction backs up
  before save; validation-rejection writes nothing; the gate sees the corrected candidate; real-store
  round trip survives reload.
- Local guards (run when `IronPathDomain` + AppData change): `iosAppDataSwiftModelStaticGuards`
  (no `: Date`), the `iosAppData*` open-bag / typed-activation guards.
- `swift test` for `IronPathDomain` + `IronPathPersistence`; one `xcodebuild` of the `IronPath`
  scheme.

## 10. DoD

- [x] Detail page two-step per-set 「编辑→保存」 corrects 重量(kg)/次数/RIR, written in place to the
  matching set.
- [x] Open-bag / schema / timestamp preserved at every nesting level; Domain has zero `Date`.
- [x] Edits only the engine input; never touches engine output / engine code / goldens.
- [x] Reuses `performGatedMutation` (no second write path); defensive re-validation; not a restore;
  honest failure.
- [x] Domain + Persistence `swift test` green; one `xcodebuild` green.
- [x] No forbidden item touched; no unrelated `RootView` / `project.pbxproj` change.
