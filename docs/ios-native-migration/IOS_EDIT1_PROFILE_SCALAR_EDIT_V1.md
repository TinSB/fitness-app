# EDIT-1 — Profile Scalar Field Edit (gated write) V1

> **Status:** implemented slice (this PR).
> **Activates the first native canonical-AppData EDIT write path** — the user edits
> their own `UserProfile` scalar fields in the 我的 (Profile) tab and the change is
> written **in place** to the canonical document through the **single sanctioned,
> DataHealth-gated write path** (§8). Two-step "编辑 → 保存"; device-local; no network.

- **Baseline:** latest `origin/main` (`68dd600` — 计划页接真实 AppData V1, #440).
- **Approval:** `docs/ios-native-migration/IOS_NATIVE_EDIT_WRITE_PATH_REVIEW_V1.md`
  (EDIT-0 review; EDIT-1 = profile scalar fields first; reuse the sanctioned gated
  write; defensive `buildCleanAppDataView` re-validation; two-step edit→save;
  open-bag/schema/timestamp fidelity; **not** a restore).
- **Contract:** amends `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` §8 (edit is a
  sanctioned MUTATION alongside append, **same** single write path), §9 (edit
  preserves the AppData invariants), §27 (milestone). No `project.pbxproj` change.

---

## 1. What this slice does

Before EDIT-1, every native UI could only **read** canonical AppData (#437–#440) or
**append** to it (performed sets 17A; HealthKit import HK-1/2). No UI could **edit**
existing canonical data.

EDIT-1 lets the user edit the nine scalar fields of their `UserProfile`:

| 中文 | field | type | notes |
| --- | --- | --- | --- |
| 姓名 | `name` | String | free text |
| 性别 | `sex` | String | free text (the stored token; richer pickers are a follow-up) |
| 年龄 | `age` | Int | 岁 |
| 身高 | `heightCm` | Int | **always cm** (storage unit) |
| 体重 | `weightKg` | Double | **entered in the current display unit (kg/lb), stored in kg** |
| 训练水平 | `trainingLevel` | String | free text |
| 主要目标 | `primaryGoal` | String | free text |
| 每周天数 | `weeklyTrainingDays` | Int | 天 |
| 单次时长 | `sessionDurationMin` | Int | 分钟 |

It is a **two-step** flow: the surface stays the #438 read-only view until the user
taps **「编辑个人资料」**, edits the fields, and taps **「保存」** (or **「取消」**).
Nothing is written until the explicit save (§7: user-explicit, never auto-write).

The edited **体重** writes the user's **self-entered** `userProfile.weightKg`. This is
deliberately distinct from the Apple-Health-derived "最新体重(Apple 健康)"
(`healthMetricSamples`, HK-1) shown on the same screen — the edit **never** touches
the health-metric samples.

---

## 2. The write path (single, sanctioned, gated)

EDIT-1 reuses the **one** native canonical write path (§8 rule 4: no second write
path). The previously `append`-only private orchestration in
`IronPathPersistence.CanonicalSessionWriter` is generalized in name to
**`performGatedMutation`** (it already took an arbitrary `(AppData) -> AppData`
candidate transform), so **append and edit are sibling sanctioned mutations through
the identical ceremony**:

```
load existing  →  build candidate (pure transform)  →  DataHealth gate
   →  backup-before-overwrite  →  atomic save  →  honest throw on any failure
```

- **New public entry point:** `CanonicalSessionWriter.updateProfile(_ profile:
  baseIfMissing:validate:)` — the only thing it varies is the candidate builder
  (`{ $0.withUpdatedProfile(profile) }`). The load → gate → backup → atomic save →
  honest-throw contract is byte-for-byte the same as `appendCompletedSession` /
  `appendHealthMetricSample` / `appendImportedWorkoutSample(s)`.
- **Same store:** the sanctioned `JSONFileAppDataStore.applicationSupport()` — the
  exact store the read path and every append uses. No new store, no second path.
- **Honest failure / no fake success:** every failure THROWS a typed
  `CanonicalSessionWriteError` and the UI surfaces an honest 未保存/失败 status. A
  present-but-**unreadable** document is **never** overwritten
  (`existingDocumentUnreadable`) — unparseable user data is preserved, not destroyed.
- **Backup-before-overwrite:** when a prior file exists, `store.backup()` runs BEFORE
  `store.save()`; the timestamped `…backup-<ISO>` copy is the rollback artifact.

---

## 3. Open-bag / schema / timestamp fidelity (Domain)

The candidate is produced by a **pure value transform** in `IronPathDomain`
(`ProfileScalarEdit.swift`), mirroring the append helpers:

- **`AppData.withUpdatedProfile(_ profile:)`** rewrites **only** the `userProfile`
  key (in place); every other top-level key and **all unknown / future fields**
  survive verbatim (§9 open bag); `schemaVersion` is **unchanged** (an edit is not a
  schema change — **no bump**); ISO-8601 timestamps elsewhere are carried through
  untouched (this edit writes no new time). Pure — no IO.
- **`UserProfile.withScalarFields(...)`** replaces only the nine editable scalars and
  preserves the profile's own `id`, `injuryFlags`, `painNotes`, and its **own open
  bag (`_unknown`)** — so an unknown future profile key is never dropped by an edit.

Both are unit-tested (`ProfileScalarEditTests`): scalar replacement, id/array/`_unknown`
preservation, top-level open-bag + other-key preservation, no schema bump, value
semantics (receiver untouched), and that the edit touches neither
`healthMetricSamples` nor `history`.

This is an **EDIT, not a restore** (§13/§14): it rewrites one key of the user's
**already-canonical** document in place. It never replaces or merges an
external/backup document; the deferred full-AppData restore gate (§14) is untouched.

---

## 4. Defensive DataHealth gate (write-time re-validation, §10)

Per the approval (§4, defensive option), the app-layer supplies the writer's
`validate` gate so the candidate is **re-validated before it commits**:

```swift
try writer.updateProfile(edited) { candidate in
    // Re-encode → re-decode (the schemaVersion guard re-runs) → DataHealth clean view.
    guard let bytes = try? candidate.canonicalJSONData(),
          let reDecoded = try? AppData(decoding: bytes) else { return false }
    let cleaned = buildCleanAppDataView(reDecoded)            // §10 chokepoint
    // Accept ONLY if the edited profile survives the clean view byte-identical
    // (canonical emit is key-order-independent → robust). No fake success.
    let a = try? cleaned.raw.userProfile.encoded().canonicalJSONData()
    let b = try? edited.encoded().canonicalJSONData()
    return a != nil && a == b
}
```

This routes the candidate through `buildCleanAppDataView` (the §10 chokepoint), and
the re-decode re-runs the `SchemaVersion` guard (so a candidate that somehow failed
the schema/round-trip contract is rejected and **nothing is written**). An
invariant-breaking or non-round-trippable candidate is refused honestly
(`validationRejected`).

---

## 5. UI (thin app layer, §15)

All UI lives in `ios/IronPath/ProfileRootView.swift` (no new app file, **no
`project.pbxproj` change** — the N-2/HK-2/Today-read precedent). The surface stays
the #438 read-only renderer; EDIT-1 adds:

- An **「编辑个人资料」** button in the `.ready` profile section (shown only when a real
  profile is loaded — never in the empty/unreadable honest states, which must not
  write).
- An in-place **edit form** (TextFields / numeric fields) for the nine scalars,
  seeded from the loaded canonical `UserProfile`. 体重 is entered in the current
  display unit and converted to kg on save via the single `WeightConversion` home;
  身高 is cm.
- **「保存」 / 「取消」** with an **honest status line** (已保存 / 未保存·失败 reason),
  no fake success (§15.4). On a successful save the model **reloads**, so every
  section (and other tabs on next appear) reflects fresh truth.

The thin `ProfileRealDataModel` gains a `saveProfileEdit(_:)` that opts into the same
sanctioned store and performs the gated write (§2) with the defensive gate (§4). It
never writes on previews/tests (no live store). The model holds **no** business
logic beyond wiring + the IO seam (all disk IO is the store's).

---

## 6. Hard red lines honored (§7 of the approval / §18 of the contract)

- ✅ Single sanctioned store / **no second write path** — `updateProfile` funnels
  through the same `performGatedMutation` as every append.
- ✅ Open-bag / schema / ISO-timestamp **full fidelity**; **no schema bump**.
- ✅ **Not a restore** — in-place single-key edit; never replaces/merges an external
  document (§13/§14 untouched).
- ✅ Backup → atomic → honest fail; a present-but-unreadable document is never
  overwritten; **no fake success**.
- ✅ **User-explicit save**, never auto-write; device-local, no network/cloud/account.
- ✅ 体重 edits the **self-entered** `userProfile.weightKg`, distinct from the HK
  `healthMetricSamples` (never touched).
- ✅ Engine / parity goldens untouched (edit changes input data, not the engine).

---

## 7. Verification

**Swift (local — §21.2):**
```
swift test --package-path ios/packages/IronPathDomain
swift test --package-path ios/packages/IronPathDataHealth
swift test --package-path ios/packages/IronPathPersistence
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath -destination 'generic/platform=iOS' build
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
# (local signing failure: append CODE_SIGNING_ALLOWED=NO)
```
New tests: `ProfileScalarEditTests` (Domain) + the EDIT-1 section of
`CanonicalSessionWriterTests` (Persistence: first/second write, validation-reject,
gate-receives-candidate, unreadable-not-overwritten, backup-fail, save-fail,
open-bag-through-gated-write, real-store round trip).

**TypeScript gates (CI — §21.1):**
```
npm run api:dev:build && npm run typecheck && npm test && npm run build
git diff --check
# package.json / package-lock.json unchanged
```
No TS source changed; the TS gates run for confidence + to keep the iOS static-guard
suite green (write-path / no-fake-success / forbidden-imports). The
`performGatedAppend → performGatedMutation` rename stays inside the single
`CanonicalSessionWriter.swift`; net guard protection is unchanged (the single-write-
path invariant is preserved, just renamed) and contract prose (§8.2) is updated in
sync.

**Real-device smoke (manual):** install on device → 我的 tab → 「编辑个人资料」 → change
姓名/年龄/体重 → 「保存」 → confirm 「已保存」 → kill & relaunch → values persist (read
back from the canonical store) and the 「最新体重(Apple 健康)」 row is unchanged.
Toggle airplane mode to confirm no network. Verify a `…backup-<ISO>` file is created
on the second save.

---

## 8. Source-of-truth & data-safety impact

- **Source of truth:** AppData stays the single canonical document. EDIT-1
  **activates** (does not move) the canonical write boundary: the user now edits
  their real profile in place through the sanctioned, DataHealth-gated path.
- **Data safety:** open-bag/schema/timestamp preserved; defensive clean-view
  re-validation before commit; backup-before-overwrite + atomic + honest fail; never
  overwrite an unreadable document. **Not** a restore.
```
