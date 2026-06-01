# EDIT-4 — Program Template (scalar config fields) Edit (gated write) V1

> **Status:** implemented slice (this PR).
> **Edits the program template's three user scalar config fields** (主要目标 primaryGoal /
> 分项 splitType / 每周天数 daysPerWeek) — the 计划 (Plan) tab's 模板 Program card was
> read-only (#440); now a two-step 「编辑→保存」 writes the edited scalars **in place** to
> the canonical document through the **single sanctioned, DataHealth-gated write path**
> (§8), reusing the EDIT-1 edit-write boundary (§8.3). The engine-managed structured plan
> (周期 weeks / prescriptions / strategy blobs) is never touched. Device-local; no network.

- **Baseline:** latest `origin/main` (`3670e3e` — EDIT-3 筛查档案编辑(self-reported lists), #443).
- **Approval:** `docs/ios-native-migration/IOS_NATIVE_EDIT_WRITE_PATH_REVIEW_V1.md`
  (EDIT-0 review; EDIT-4 = the 计划/周期 edit slice §5, scoped here to the **user-owned
  scalar config fields only**; reuse the sanctioned gated write; defensive
  `buildCleanAppDataView` re-validation; open-bag/schema/timestamp fidelity; **not** a
  restore; two-step 「编辑→保存」).
- **Contract:** **reuses** the EDIT-1 edit-write boundary already activated in §8.3 —
  no new boundary, no source-of-truth move. Minimal amendment to
  `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`: §8.3 (EDIT-4 note — same single
  write path), §9 (EDIT-4 note — same AppData invariants), §27 (milestone row). No
  `project.pbxproj` change.

---

## 1. What this slice does

Before EDIT-4, the 计划 tab's 模板 Program card rendered read-only rows from the cleaned
canonical `ProgramTemplate` (`PlanDisplay`). EDIT-4 makes the **three user scalar config
fields** editable, two-step 「编辑→保存」 (like EDIT-1's profile form), written in place to
canonical `AppData.programTemplate`:

| field | type | notes |
| --- | --- | --- |
| `programTemplate.primaryGoal` | `String?` | 主要目标 — user config |
| `programTemplate.splitType` | `String?` | 分项 — user config |
| `programTemplate.daysPerWeek` | `NumberRepr?` | 每周天数 — user config (integer) |

**Only these three simple scalars are user-editable.** Everything else in the program
template is preserved verbatim across the edit and is **not** exposed for editing:

- `correctionStrategy` / `functionalStrategy` — the **engine-managed** strategy blobs
  (arbitrary JSON, engine-authored). Carried through untouched; the 计划 page still shows
  only their presence (已配置/未配置), read-only.
- `id`, `userId`, and any unknown future program key — carried through untouched
  (§9 open bag).
- The engine-managed **structured plan** that lives in *other* keys — the
  `mesocyclePlan` (周期 `weeks` array / dates / phase), exercise prescriptions, adaptive
  state — is **never** touched. The 周期 Mesocycle + 策略 cards stay read-only.

A blank field saves an honest `nil` ("not set"), never an empty string. 每周天数 is parsed
to an integer `NumberRepr` (blank / non-integer → honest `nil`).

The write happens **only** on the explicit 「保存」 tap — never an auto-write (§7); the card
stays read-only until the user taps 「编辑模板配置」.

**Why scalars only (scope guardrail).** The approval (§5) lists EDIT-4+ as 计划/周期
editing — "各自独立的谨慎切片". This V1 deliberately takes only the **user-owned simple
scalar config** and leaves the engine-managed structured data (周期 weeks, prescriptions,
mesocycle engine-driven state, adaptive state) read-only. Editing those would touch
engine-managed structure / affect engine output → out of scope for this slice.

---

## 2. The write path (single, sanctioned, gated)

EDIT-4 reuses the **one** native canonical write path (§8 rule 4: no second write
path) and the **same** private orchestration EDIT-1 generalized,
`performGatedMutation` in `IronPathPersistence.CanonicalSessionWriter`:

```
load existing  →  build candidate (pure transform)  →  DataHealth gate
   →  backup-before-overwrite  →  atomic save  →  honest throw on any failure
```

- **New public entry point:** `CanonicalSessionWriter.updateProgramConfig(primaryGoal:
  splitType:daysPerWeek:baseIfMissing:validate:)` — the only thing it varies is the
  candidate builder `{ $0.withUpdatedProgramConfig(primaryGoal:splitType:daysPerWeek:) }`.
  The load → gate → backup → atomic save → honest-throw contract is byte-for-byte the
  same as `appendCompletedSession` / `updateProfile` / `updateUnitSettings` /
  `updateScreening`. There is still **exactly one** `store.save(...)` site (the
  single-write-path invariant the static guard pins is preserved — no static guard
  changed).
- **Reads the freshly-loaded on-disk program** (the EDIT-2 pattern): the candidate builder
  rewrites only the three scalars on `existing.programTemplate`, so the program's
  `id` / `userId` / strategy blobs / unknown keys come from the on-disk truth, not from a
  (lossy) display projection.
- **Same store:** the sanctioned `JSONFileAppDataStore.applicationSupport()` — the exact
  store the read path and every append/edit uses. No new store, no second path.
- **Honest failure / no fake success:** every failure THROWS a typed
  `CanonicalSessionWriteError`; the UI surfaces an honest 失败 status and **stays in
  edit mode** (the buffer is not lost). A present-but-**unreadable** document is **never**
  overwritten (`existingDocumentUnreadable`).
- **Backup-before-overwrite:** when a prior file exists, `store.backup()` runs BEFORE
  `store.save()`; the timestamped `…backup-<ISO>` copy is the rollback artifact.

---

## 3. Open-bag / schema / timestamp fidelity (Domain)

The candidate is produced by **pure value transforms** in `IronPathDomain`
(`ProgramConfigEdit.swift`), mirroring `ProfileScalarEdit.swift` /
`ScreeningProfileEdit.swift`:

- **`AppData.withUpdatedProgramConfig(primaryGoal:splitType:daysPerWeek:)`** rewrites
  **only** the `programTemplate` key (in place); every other top-level key and **all
  unknown / future fields** survive verbatim (§9 open bag); `schemaVersion` is
  **unchanged** (an edit is not a schema change — **no bump**); ISO-8601 timestamps
  elsewhere are carried through untouched (this edit writes no new time). Pure — no IO.
- **`ProgramTemplate.withConfigScalars(primaryGoal:splitType:daysPerWeek:)`** replaces only
  the three user scalars and preserves `id`, `userId`, the engine-managed
  `correctionStrategy` / `functionalStrategy` blobs, and the program's **own open bag
  (`_unknown`)** — so an unknown future program key is never dropped by an edit. A `nil`
  argument writes an honest "not set" (the encoder omits a nil scalar).

Both are unit-tested (`ProgramConfigEditTests`): scalar replacement,
id/userId/strategy/`_unknown` preservation, nil→honest-unset, top-level open-bag + other-key
preservation (including the engine-managed `mesocyclePlan` weeks), no schema bump, value
semantics (receiver untouched), canonical round-trip, and that the edit touches neither the
engine-managed strategy blobs nor the structured mesocycle weeks nor `history` nor
`healthMetricSamples`.

This is an **EDIT, not a restore** (§13/§14): it rewrites one key of the user's
**already-canonical** document in place. It never replaces or merges an external/backup
document; the deferred full-AppData restore gate (§14) is untouched.

---

## 4. Defensive DataHealth gate (write-time re-validation, §10)

Per the approval (§4, defensive option), the app-layer supplies the writer's `validate`
gate so the candidate is **re-validated before it commits**:

```swift
try writer.updateProgramConfig(primaryGoal: g, splitType: s, daysPerWeek: d) { candidate in
    // Re-encode → re-decode (the schemaVersion guard re-runs) → DataHealth clean view.
    guard let bytes = try? candidate.canonicalJSONData(),
          let reDecoded = try? AppData(decoding: bytes) else { return false }
    let cleaned = buildCleanAppDataView(reDecoded)
    let program = cleaned.raw.programTemplate
    // The three edited scalars are exactly what we intended…
    guard program.primaryGoal == g, program.splitType == s, program.daysPerWeek == d else { return false }
    // …and the whole programTemplate (strategies + unknown keys) survives byte-identical.
    guard let a = try? program.encoded().canonicalJSONData(),
          let b = try? candidate.programTemplate.encoded().canonicalJSONData() else { return false }
    return a == b
}
```

This routes the candidate through `buildCleanAppDataView` (the §10 chokepoint), and the
re-decode re-runs the `SchemaVersion` guard. A candidate that does not survive the clean
view's **raw** program projection byte-identically is refused honestly
(`validationRejected`) and **nothing is written**.

**Why compare `cleaned.raw.programTemplate`, not a cleaned form.** `buildCleanAppDataView`
**does not clean** the program template — it leaves `programTemplate` untouched in `raw`
(the 计划 read path reads `cleanView.raw.programTemplate` directly). We therefore compare
the clean view's **raw** program (the untouched candidate, round-tripped through canonical
bytes + the schema guard) against the candidate's program — exactly the EDIT-1/EDIT-3
raw-comparison pattern (`cleaned.raw.userProfile` / `cleaned.raw.screeningProfile`). This
verifies the edit survives the canonical encode → decode → schema-guard round trip, and
keeps the gate robust against any future program cleaning without coupling to it.

---

## 5. UI (thin app layer, §15)

All UI lives in `ios/IronPath/PlanRootView.swift` (no new app file, **no
`project.pbxproj` change** — the EDIT-1/EDIT-2/EDIT-3/N-2/HK-2 precedent). The 模板 Program
card becomes two-step, mirroring EDIT-1/EDIT-3's edit:

- **Read-only → 「编辑模板配置」 → edit form → 「保存」/「取消」.** `isEditingProgram`
  gates the mode; the `ProgramConfigEditForm` (three text buffers) is the in-RAM edit
  buffer — nothing is persisted until the explicit 「保存」. The card is always rendered in
  the `.ready` state so the edit entry point is reachable even when a scalar is unset.
- **Engine-managed cards stay read-only:** the 周期 Mesocycle card (weeks / dates / phase)
  and the 策略 disclosure (correction/functional presence) are **not** editable.
- **Honest status** in the card: 已保存 on a committed write, the failure reason on a
  rejected/failed write (no fake success, §15.4). On failure the form **stays in edit
  mode** so the buffer is not lost.

The thin `PlanRealDataModel` (the existing read-only model) gains:
- `programConfigSaveStatus` — a honest status (idle/saved/failed), `.idle` until the user
  saves; never a fake success.
- `saveProgramConfigEdit(primaryGoal:splitType:daysPerWeek:)` — opts into the same
  sanctioned store and performs the gated write (§2) with the defensive gate (§4). Never
  writes on previews/tests (no live store); on success it reloads from fresh truth. No
  business logic beyond wiring + the IO seam (all disk IO is the store's).

The 计划 read-path behavior is otherwise unchanged (honest empty / degrade states; the
read still routes through `buildCleanAppDataView`).

---

## 6. Hard red lines honored (§7 of the approval / §18 of the contract)

- ✅ Single sanctioned store / **no second write path** — `updateProgramConfig` funnels
  through the same `performGatedMutation` as every append/edit (one `store.save`).
- ✅ Open-bag / schema / ISO-timestamp **full fidelity**; **no schema bump**.
- ✅ **Not a restore** — in-place single-key edit; never replaces/merges an external
  document (§13/§14 untouched).
- ✅ Backup → atomic → honest fail; a present-but-unreadable document is never
  overwritten; **no fake success** (failed save stays in edit mode).
- ✅ **User-explicit two-step save**, never auto-write; device-local, no
  network/cloud/account.
- ✅ **Engine-managed structure untouched** — only the three user scalars are written; the
  `correctionStrategy` / `functionalStrategy` blobs, the structured `mesocyclePlan`
  (weeks / prescriptions / adaptive state), `id`, `userId`, and unknown keys are preserved
  and remain read-only.
- ✅ Engine / parity goldens untouched; no other RootView / forbidden system touched;
  `project.pbxproj` untouched (no new app target file); no static guard changed.

---

## 7. Verification

**Swift (local — §21.2; only the affected packages):**
```
swift test --package-path ios/packages/IronPathDomain
swift test --package-path ios/packages/IronPathPersistence
xcodebuild -workspace ios/IronPath.xcworkspace -scheme IronPath \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```
New tests: `ProgramConfigEditTests` (Domain) + the EDIT-4 section of
`CanonicalSessionWriterTests` (Persistence: first/second write, validation-reject,
gate-receives-candidate, unreadable-not-overwritten, backup-fail, save-fail,
strategies/structure/open-bag-preserved-through-gated-write, real-store round trip).

**TypeScript gates (CI — §21.1):** no TS source changed and **no static guard was
modified** — `updateProgramConfig` adds a sibling entry point on the existing
`performGatedMutation` (the single `store.save` invariant the guard pins is unchanged),
and `PlanRootView` adds no import. CI runs the TS suite for confidence.
`package.json` / `package-lock.json` unchanged.

**Real-device smoke (manual):** install on device → 计划 tab → 模板 Program → 「编辑模板
配置」 → edit 主要目标 / 分项 / 每周天数 → 「保存」 → confirm 「已保存」 and the updated
rows → kill & relaunch → the edited scalars persist; the 周期 / 策略 cards are unchanged.
Toggle airplane mode to confirm no network. A `…backup-<ISO>` file is created when an
existing document is overwritten.

---

## 8. Source-of-truth & data-safety impact

- **Source of truth:** AppData stays the single canonical document. EDIT-4 **reuses** the
  canonical edit-write boundary EDIT-1 already activated (§8.3) — no new write path, no
  boundary move. Only the three `programTemplate` scalar config fields are written; the
  engine-managed strategy blobs + structured mesocycle are untouched.
- **Data safety:** open-bag/schema/timestamp preserved; defensive clean-view
  re-validation before commit (comparing the raw program, which `buildCleanAppDataView`
  leaves untouched); backup-before-overwrite + atomic + honest fail; never overwrite an
  unreadable document. **Not** a restore.
