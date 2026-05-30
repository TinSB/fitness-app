# iOS-17 Per-Exercise Set Logging — Architecture Review V1

> **Status: PROPOSAL — requires architecture-owner approval before ANY code.**
> This is the **A-path** review for a **gated** epic (master §17, §18, §24-rule2).
> It is **not** an amendment to `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`
> and **not** an implementation prompt. The master-doc amendment + code land
> **only after** the open questions in §9 are answered and approved, and the
> amendment is written **in the same PR** as the slice that activates the
> boundary (master §1.1).
>
> Local-only throughout. No Cloud, CloudKit, iCloud, HealthKit, Supabase,
> network, WebView, auth, UserDefaults, SQLite, CoreData, or SwiftData.

## 1. Purpose

The user-visible goal ("逐组小结": show per-exercise actual weight / reps / RIR in
the saved-session detail) cannot be built as a slice today because **the native
app never captures or stores per-set performance data.** This document scopes the
*real* shape of the work, decides **where that data lives** (a source-of-truth
question, master §8), lists the **architecture amendments** required, and
**decomposes the epic into validated vertical slices** that can each ship as a
normal B-style PR once approved.

## 2. Feasibility finding (why this is an epic, not a slice)

Grounded in the code at baseline `73b60ec`:

- The live Focus session captures **only a set tally.** `FocusSetChecklistView`
  exposes `targetSets`, `completedSets`, and `onCompleteOneSet: () -> Void`
  (tap = +1). `FocusModeExerciseRow` carries `name/muscle/kind/role/targetSets/
  roleFloor` — **no weight, reps, or RIR.** (The `weight` tokens in these files
  are SwiftUI font weights, not training load.)
- The saved snapshot stores only a per-exercise **count**:
  `LocalCompletedExerciseSnapshot.progress = { completedSets, targetSets }`.
  There is no per-set array, no load/reps/RIR.
- Therefore the requested summary has **no data source anywhere** in the native
  pipeline — UI, in-RAM session, or snapshot. Building it requires *capturing*
  the data first, then *persisting* it, then *displaying* it.

## 3. Current relevant architecture (grounded)

- **Canonical-AppData write seam already exists but is unused by the app.**
  `IronPathPersistence.JSONFileAppDataStore.save(_ appData:)` (built in iOS-3A,
  atomic + backup) is the sanctioned source-of-truth write path (§12). The app's
  **only** current write call is `snapshotStore.save(snapshot)` in
  `FocusModeMvpState` (the LocalSnapshot history). **Native iOS has never written
  canonical AppData.** iOS-17 would introduce that first write — a genuine §8
  activation.
- **The LocalSnapshot history store is presentation-only by contract (§12, §6.3).**
  It "must never read or write canonical AppData" and is "a presentation-layer
  record." So performed training data **must not** make the LocalSnapshot store
  its home (that would make a presentation record the de-facto source of truth —
  risk R9).
- **The canonical performed-set model is ALREADY fully typed and wired (iOS-2C).**
  Correction to the original assumption: `IronPathDomain` already ships
  `TrainingSetLog` (with `weight`, `actualWeightKg`, `reps`, `rir`, `rpe`,
  `setIndex`, `completedAt`, `done`, …) and `ActualSetDraft`, both open-bag
  preserved (`_unknown`), round-tripped (`init(decoding:)`/`encoded()`), kg-stored,
  and explicitly mirroring `src/models/training-model.ts:255`. `TrainingSession`
  already holds `focusActualSetDrafts: [ActualSetDraft]?` + `focusWarmupSetLogs:
  [TrainingSetLog]?` (+ `currentSetIndex`) and decodes/encodes them, and `AppData`
  exposes `history` / `historyStrict()` / `activeSession` decoding into these typed
  models. **So the canonical AppData side is ready to receive performed per-set
  data today** — the gap is purely *capture* (the live session) and *persistence*
  (no native AppData write). This removes the Domain-typing slice entirely.
- **Units are stored in kilograms.** `IronPathDomain.UnitSettings` notes "Storage
  is always kilograms" with a separate `displayUnit`. Capture must persist kg;
  display converts. This is a hard data-safety constraint for the capture slice.

## 4. The core decision — where does performed set data live?

| Option | Source of truth for performed sets | Pros | Cons | Verdict |
| --- | --- | --- | --- | --- |
| **A. Canonical AppData only** | `IronPathDomain.AppData` via `IronPathPersistence.save` | §8-correct home; engine can consume it via DataHealth clean view; parity with PWA contract | Heaviest; first native AppData write path; needs §8 amendment | Correct long-term |
| **B. LocalSnapshot history only** | `IronPathLocalSnapshot` store | Fastest; no AppData write path | **Violates §8/§12** — presentation record becomes de-facto source of truth (R9); engine can't consume it cleanly | **Rejected** |
| **C. AppData = source of truth + denormalized presentation copy in the snapshot** | `AppData` (canonical) | §8-correct; snapshot stays presentation-only but self-contained for display (it already denormalizes names/labels); detail can render without re-reading AppData | Slightly more data duplicated (clearly marked derived, never read back as truth) | **Recommended** |

**Recommendation: Option C.** Real performed weight/reps/RIR is training-record
data; its source of truth is canonical AppData, persisted through the existing
sanctioned `IronPathPersistence` seam (still local JSON via Foundation — **no new
persistence technology**). The LocalSnapshot history may carry a **denormalized,
explicitly-derived** copy for self-contained display (consistent with how it
already copies scenario/exercise labels), but it is **never** read back as the
source of truth, preserving §12.

## 5. Required master-doc amendments (only upon approval, in the activating PR)

If Option C is approved, the following sections of
`docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` must be amended **in the same PR**
as the slice that activates each boundary (master §1.1):

1. **§8 Source-of-Truth Contract** — permit the **first native canonical-AppData
   write path** for performed-set logging, through `IronPathPersistence.save`,
   gated by DataHealth where untrusted input is involved. State the new write
   path explicitly and its rollback/backup story.
2. **§9 AppData Boundary** — record the **typed activation** of the performed-set
   model (per-set weight/reps/RIR) with open-bag preservation retained; if a
   `SchemaVersion` bump is required, add the migration + update
   `AppDataSchemaVersionGuardTests` (no silent bump).
3. **§12 Local Snapshot Persistence Boundary** — if a denormalized copy is added
   to the snapshot (schema v3), document that it is **derived/presentation only,
   never read back as source of truth**, and add the snapshot migration v2→v3.
4. **§17 Deferred Systems / §27 Milestones** — move set-logging from
   "deferred/gated" to "approved epic," add the iOS-17.x rows, refresh the
   baseline.

## 6. Slice decomposition (each a future B-style PR after approval)

> Sequenced smallest-validated-first (master §20). Each slice carries its own
> tests + guards and the B-style validation/PR discipline. The **source-of-truth
> boundary is activated only in 17c**, which is the slice that amends §8.

- **iOS-17.0 — this review.** Approve Option C + the §9 open questions. No code.
- **iOS-17a — Domain: type the performed-set model. ✅ ALREADY DONE (iOS-2C).**
  `TrainingSetLog` / `ActualSetDraft` / `TrainingSession.focusActualSetDrafts` /
  `focusWarmupSetLogs` / `AppData.history` are already typed, wired, open-bag
  preserved, kg-stored, and parity-cited. **No work; this slice is dropped.** The
  first actionable slice is 17b.
- **iOS-17b — Capture UI + in-RAM session (FIRST ACTIONABLE SLICE).** Augment tap-to-complete with
  per-set weight/reps/RIR entry in `FocusSetChecklistView` + `FocusModeMvpState`
  in-RAM state. kg storage, display-unit conversion. Thin UI + view-model only.
  **No persistence yet** → source-of-truth impact: none.
- **iOS-17c — Canonical-AppData write path (THE boundary slice).** Introduce the
  first native `IronPathPersistence.save` of performed sets from the view-model,
  gated by DataHealth where untrusted input is involved; backup-before-overwrite;
  no-fake-success. **Amends §8 in the same PR.** Heaviest; full guard suite +
  regression lock for the new write path.
- **iOS-17d — History/detail summary.** Render the per-exercise "last set summary"
  from the persisted data; optionally add the denormalized snapshot copy
  (schema v3 + migration, §12 note). Presentation only.
- **iOS-17e — (deferred / likely its own milestone) Engine consumption.** Feed
  performed data into readiness / e1RM **only** via DataHealth clean view →
  `CleanTrainingDecisionInput` (§10/§11), parity-pinned with regenerated goldens.
  Recommend deferring out of iOS-17 to keep the epic bounded.

## 7. Data-safety & migration plan

- **Open-bag preservation retained** at every step (§9); typing fields never drops
  unknown ones.
- **kg is the stored unit**; the capture UI converts from the display unit and
  stores kg — guard against unit drift.
- **Backup-before-overwrite + no-fake-success** on the new AppData write path
  (§12); a failed save is surfaced honestly and leaves the prior canonical file
  intact (atomic write).
- **Schema bumps are explicit + migrated + guarded** — both `AppData.SchemaVersion`
  (if typed activation needs it) and the snapshot schema (v2→v3 if 17d adds the
  copy). No silent bumps.
- **`iosLocalJsonPersistenceStaticGuards` stays green** — still local JSON via
  Foundation only; no forbidden API enters.

## 8. Non-goals / deferred

- **Engine feedback (17e)** — recommended deferred to a later milestone; keeps
  iOS-17 from touching parity goldens / the engine contract.
- Cloud sync, HealthKit import of performance data, accounts — remain gated
  (§17). Performed data **does not leave the device** (§16).
- Rich analytics/charts over historical performance — out of scope.
- Editing/deleting historical performed sets — out of scope for now.

## 9. Open questions for the architecture owner (approval gates)

1. **Source-of-truth home** — approve **Option C** (AppData = truth, optional
   denormalized snapshot copy)? Or A (AppData only, no snapshot copy)? (B is not
   recommended.)
2. **First native AppData write path** — approve activating it in **17c**, with
   the §8 amendment in that PR?
3. **Snapshot copy** — do we add the denormalized presentation copy to the
   LocalSnapshot (schema v3) in 17d, or have detail read performed data straight
   from AppData and leave the snapshot schema unchanged?
4. **Engine feedback** — confirm **17e is deferred** out of iOS-17 (engine stays
   untouched this epic)?
5. **Capture UX granularity** — per-set weight + reps + RIR for every set, or a
   lighter "per-exercise top set" capture first? (Affects 17a model shape and 17b
   UI scope.)

## 10. Recommended next action

Approve §9.1–§9.4 as proposed (Option C; write path in 17c; snapshot copy in 17d;
17e deferred) and decide §9.5 capture granularity. Since 17a (Domain typing) is
already satisfied by iOS-2C, the first B-style implementation prompt is **iOS-17b**
(capture UI + in-RAM session into the existing `ActualSetDraft`/`TrainingSetLog`
types — zero-boundary, no persistence). We then proceed slice by slice, amending
the master doc in the PR (17c) that activates the source-of-truth boundary.

**Decision recorded (architecture owner, this session):** Option C approved;
write path activated in 17c with the §8 amendment; denormalized snapshot copy in
17d (schema v3); engine feedback (17e) deferred; **capture granularity = full
per-set (weight + reps + RIR for every set).**

---

*This review changes no code and no boundary. It exists to get an explicit,
reviewed decision before the gated work begins (master §1.4 "when in doubt, do
less"; §24-rule10 "prefer escalation over silent assumption").*
