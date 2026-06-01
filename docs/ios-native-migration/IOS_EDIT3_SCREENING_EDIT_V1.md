# EDIT-3 — Screening Profile (self-reported lists) Edit (gated write) V1

> **Status:** implemented slice (this PR).
> **Edits the screening profile's self-reported lists** (疼痛触发 / 受限动作 / 纠正优先)
> — the 我的 (Profile) tab's 筛查 section was read-only; now a two-step 「编辑→保存」
> writes the edited lists **in place** to the canonical document through the **single
> sanctioned, DataHealth-gated write path** (§8), reusing the EDIT-1 edit-write boundary
> (§8.3). The engine-managed adaptive state is never touched. Device-local; no network.

- **Baseline:** latest `origin/main` (`0883734` — EDIT-2 单位设置(显示单位 kg/lb)持久化, #442).
- **Approval:** `docs/ios-native-migration/IOS_NATIVE_EDIT_WRITE_PATH_REVIEW_V1.md`
  (EDIT-0 review; EDIT-3 = screening profile, the slice after EDIT-1/EDIT-2; reuse the
  sanctioned gated write; defensive `buildCleanAppDataView` re-validation; open-bag/
  schema/timestamp fidelity; **not** a restore; two-step 「编辑→保存」).
- **Contract:** **reuses** the EDIT-1 edit-write boundary already activated in §8.3 —
  no new boundary, no source-of-truth move. Minimal amendment to
  `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`: §8.3 (EDIT-3 note — same single
  write path), §9 (EDIT-3 note — same AppData invariants), §27 (milestone row). No
  `project.pbxproj` change.

---

## 1. What this slice does

Before EDIT-3, the 我的 tab's 筛查 section rendered three read-only rows from the
cleaned canonical `ScreeningProfile`. EDIT-3 makes the **three self-reported lists**
editable, two-step 「编辑→保存」 (like EDIT-1's profile form), written in place to
canonical `AppData.screeningProfile`:

| field | type | notes |
| --- | --- | --- |
| `screeningProfile.painTriggers` | `[String]?` | 疼痛触发 — self-reported |
| `screeningProfile.restrictedExercises` | `[String]?` | 受限动作 — self-reported |
| `screeningProfile.correctionPriority` | `[String]?` | 纠正优先 — self-reported |

**Only these three lists are user-editable.** Everything else in the screening profile
is preserved verbatim across the edit and is **not** exposed for editing:

- `adaptiveState` — the **engine/DataHealth-managed** adaptive state (issue scores /
  performance drops). DataHealth's `buildCleanScreening` owns capping/filtering it; the
  edit never writes it.
- `postureFlags`, `movementFlags`, `userId`, and any unknown future screening key —
  carried through untouched (§9 open bag).

A blank field saves an honest `nil` ("not set"), never an empty array. Each list is
edited **one entry per line** (a `TextField(axis: .vertical)`), so an entry that itself
contains a comma or parenthesis (e.g. `膝前侧（深蹲过深）`) is never split.

The write happens **only** on the explicit 「保存」 tap — never an auto-write (§7); the
section stays read-only until the user taps 「编辑筛查档案」.

---

## 2. The write path (single, sanctioned, gated)

EDIT-3 reuses the **one** native canonical write path (§8 rule 4: no second write
path) and the **same** private orchestration EDIT-1 generalized,
`performGatedMutation` in `IronPathPersistence.CanonicalSessionWriter`:

```
load existing  →  build candidate (pure transform)  →  DataHealth gate
   →  backup-before-overwrite  →  atomic save  →  honest throw on any failure
```

- **New public entry point:** `CanonicalSessionWriter.updateScreening(_:
  baseIfMissing:validate:)` — the only thing it varies is the candidate builder
  `{ $0.withUpdatedScreening(screening) }`. The load → gate → backup → atomic save →
  honest-throw contract is byte-for-byte the same as `appendCompletedSession` /
  `updateProfile` / `updateUnitSettings`. There is still **exactly one**
  `store.save(...)` site (the single-write-path invariant the static guard pins is
  preserved — no static guard changed).
- **Same store:** the sanctioned `JSONFileAppDataStore.applicationSupport()` — the
  exact store the read path and every append/edit uses. No new store, no second path.
- **Honest failure / no fake success:** every failure THROWS a typed
  `CanonicalSessionWriteError`; the UI surfaces an honest 失败 status and **stays in
  edit mode** (the buffer is not lost). A present-but-**unreadable** document is
  **never** overwritten (`existingDocumentUnreadable`).
- **Backup-before-overwrite:** when a prior file exists, `store.backup()` runs BEFORE
  `store.save()`; the timestamped `…backup-<ISO>` copy is the rollback artifact.

---

## 3. Open-bag / schema / timestamp fidelity (Domain)

The candidate is produced by **pure value transforms** in `IronPathDomain`
(`ScreeningProfileEdit.swift`), mirroring `ProfileScalarEdit.swift` /
`UnitSettingsEdit.swift`:

- **`AppData.withUpdatedScreening(_ screening:)`** rewrites **only** the
  `screeningProfile` key (in place); every other top-level key and **all unknown /
  future fields** survive verbatim (§9 open bag); `schemaVersion` is **unchanged** (an
  edit is not a schema change — **no bump**); ISO-8601 timestamps elsewhere are carried
  through untouched (this edit writes no new time). Pure — no IO.
- **`ScreeningProfile.withEditedLists(painTriggers:restrictedExercises:
  correctionPriority:)`** replaces only the three self-reported lists and preserves
  `userId`, the engine-managed `adaptiveState` / `postureFlags` / `movementFlags`, and
  the screening's **own open bag (`_unknown`)** — so an unknown future screening key is
  never dropped by an edit. A `nil` argument writes an honest "not set" (the encoder
  omits a nil list).

Both are unit-tested (`ScreeningProfileEditTests`): list replacement,
userId/`adaptiveState`/`postureFlags`/`movementFlags`/`_unknown` preservation,
top-level open-bag + other-key preservation, no schema bump, value semantics (receiver
untouched), canonical round-trip, and that the edit touches neither the engine-managed
`adaptiveState` (issueScores / performanceDrops carried through verbatim) nor `history`
nor `healthMetricSamples`.

This is an **EDIT, not a restore** (§13/§14): it rewrites one key of the user's
**already-canonical** document in place. It never replaces or merges an
external/backup document; the deferred full-AppData restore gate (§14) is untouched.

---

## 4. Defensive DataHealth gate (write-time re-validation, §10)

Per the approval (§4, defensive option), the app-layer supplies the writer's
`validate` gate so the candidate is **re-validated before it commits**:

```swift
try writer.updateScreening(edited) { candidate in
    // Re-encode → re-decode (the schemaVersion guard re-runs) → DataHealth clean view.
    guard let bytes = try? candidate.canonicalJSONData(),
          let reDecoded = try? AppData(decoding: bytes) else { return false }
    let cleaned = buildCleanAppDataView(reDecoded)               // §10 chokepoint
    // Accept ONLY if the edited screening's RAW value survives byte-identical.
    guard let a = try? cleaned.raw.screeningProfile.encoded().canonicalJSONData(),
          let b = try? edited.encoded().canonicalJSONData() else { return false }
    return a == b
}
```

This routes the candidate through `buildCleanAppDataView` (the §10 chokepoint), and
the re-decode re-runs the `SchemaVersion` guard. A candidate that does not survive the
clean view's **raw** projection byte-identically is refused honestly
(`validationRejected`) and **nothing is written**.

**Why compare `cleaned.raw`, not `cleaned.cleanedScreening`.** `buildCleanScreening`
**legitimately** rewrites the engine-managed `adaptiveState` (it caps `issueScores` and
filters `performanceDrops`), so the *cleaned* screening can differ from the input by
design. Requiring the cleaned form to match would wrongly reject valid edits. We
therefore compare the clean view's **raw** screening (the untouched candidate, round-
tripped through canonical bytes + the schema guard) against the edited value — exactly
the EDIT-1 pattern (`cleaned.raw.userProfile`). This verifies the edit survives the
canonical encode → decode → schema-guard round trip, without coupling the gate to the
engine's adaptive-state cleaning.

---

## 5. UI (thin app layer, §15)

All UI lives in `ios/IronPath/ProfileRootView.swift` (no new app file, **no
`project.pbxproj` change** — the N-2/HK-2/EDIT-1/EDIT-2 precedent). The 筛查 section
becomes two-step, mirroring EDIT-1's profile edit:

- **Read-only → 「编辑筛查档案」 → edit form → 「保存」/「取消」.** `isEditingScreening`
  gates the mode; the `ScreeningEditForm` (three line-delimited text buffers) is the
  in-RAM edit buffer — nothing is persisted until the explicit 「保存」.
- **One entry per line:** each list is a `TextField(text:, axis: .vertical)`; seeding
  joins entries with `\n`, saving splits on newlines + trims + drops blanks → `[String]?`
  (`nil` when empty).
- **Honest status** in the section: 已保存 on a committed write, the failure reason on a
  rejected/failed write (no fake success, §15.4). On failure the form **stays in edit
  mode** so the buffer is not lost.

The thin `ProfileRealDataModel` gains:
- `screeningSaveStatus` — a **separate** honest status from EDIT-1's `saveStatus` /
  EDIT-2's `unitSaveStatus`, so each section surfaces only its own confirmation.
- `saveScreeningEdit(_:)` — opts into the same sanctioned store and performs the gated
  write (§2) with the defensive gate (§4). Never writes on previews/tests (no live
  store); on success it reloads from fresh truth. No business logic beyond wiring + the
  IO seam (all disk IO is the store's).

The 设置 footer is updated to the honest truth: 个人资料、筛查 can now be edited and
saved on-device; 设置 stays read-only.

---

## 6. Hard red lines honored (§7 of the approval / §18 of the contract)

- ✅ Single sanctioned store / **no second write path** — `updateScreening` funnels
  through the same `performGatedMutation` as every append/edit (one `store.save`).
- ✅ Open-bag / schema / ISO-timestamp **full fidelity**; **no schema bump**.
- ✅ **Not a restore** — in-place single-key edit; never replaces/merges an external
  document (§13/§14 untouched).
- ✅ Backup → atomic → honest fail; a present-but-unreadable document is never
  overwritten; **no fake success** (failed save stays in edit mode).
- ✅ **User-explicit two-step save**, never auto-write; device-local, no
  network/cloud/account.
- ✅ **Engine-managed adaptive state untouched** — only the three self-reported lists
  are written; `adaptiveState` (issueScores / performanceDrops), `postureFlags`,
  `movementFlags`, `userId`, and unknown keys are preserved.
- ✅ Engine / parity goldens untouched; no other RootView / forbidden system touched;
  `project.pbxproj` untouched (no new app target file).

---

## 7. Verification

**Swift (local — §21.2; only the affected packages):**
```
swift test --package-path ios/packages/IronPathDomain
swift test --package-path ios/packages/IronPathPersistence
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```
New tests: `ScreeningProfileEditTests` (Domain) + the EDIT-3 section of
`CanonicalSessionWriterTests` (Persistence: first/second write, validation-reject,
gate-receives-candidate, unreadable-not-overwritten, backup-fail, save-fail,
adaptiveState/open-bag-preserved-through-gated-write, real-store round trip).

**TypeScript gates (CI — §21.1):** no TS source changed and **no static guard was
modified** — `updateScreening` adds a sibling entry point on the existing
`performGatedMutation` (the single `store.save` invariant the guard pins is
unchanged), and `ProfileRootView` adds no import. CI runs the TS suite for confidence.
`package.json` / `package-lock.json` unchanged.

**Real-device smoke (manual):** install on device → 我的 tab → 筛查 → 「编辑筛查档案」 →
edit the three lists (one entry per line) → 「保存」 → confirm 「已保存」 and the updated
rows → kill & relaunch → the edited lists persist. Toggle airplane mode to confirm no
network. A `…backup-<ISO>` file is created when an existing document is overwritten.

---

## 8. Source-of-truth & data-safety impact

- **Source of truth:** AppData stays the single canonical document. EDIT-3 **reuses**
  the canonical edit-write boundary EDIT-1 already activated (§8.3) — no new write path,
  no boundary move. Only the three `screeningProfile` lists are written; the engine-
  managed adaptive state is untouched.
- **Data safety:** open-bag/schema/timestamp preserved; defensive clean-view
  re-validation before commit (comparing the raw screening, since `buildCleanScreening`
  legitimately re-caps/filters the adaptive state); backup-before-overwrite + atomic +
  honest fail; never overwrite an unreadable document. **Not** a restore.
```
