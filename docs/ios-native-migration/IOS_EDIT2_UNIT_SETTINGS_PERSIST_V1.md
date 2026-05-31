# EDIT-2 — Unit Settings (display unit) Persistence (gated write) V1

> **Status:** implemented slice (this PR).
> **Persists the display-unit preference (kg/lb)** — the 我的 (Profile) tab's unit
> toggle was in-memory-only; now a USER toggle is written **in place** to the
> canonical document through the **single sanctioned, DataHealth-gated write path**
> (§8), reusing the EDIT-1 edit-write boundary (§8.3). Storage stays kilograms — only
> the **display** preference is persisted. Device-local; no network.

- **Baseline:** latest `origin/main` (`e1fe8fc` — EDIT-1 资料标量字段编辑, #441).
- **Approval:** `docs/ios-native-migration/IOS_NATIVE_EDIT_WRITE_PATH_REVIEW_V1.md`
  (EDIT-0 review; EDIT-2 = unit settings, the slice after EDIT-1; reuse the sanctioned
  gated write; defensive `buildCleanAppDataView` re-validation; open-bag/schema/
  timestamp fidelity; **not** a restore).
- **Contract:** **reuses** the EDIT-1 edit-write boundary already activated in §8.3 —
  no new boundary, no source-of-truth move. Minimal amendment to
  `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`: §8.3 (EDIT-2 note — same single
  write path), §9 (EDIT-2 note — same AppData invariants), §27 (milestone row). No
  `project.pbxproj` change.

---

## 1. What this slice does

Before EDIT-2, the 我的 tab's 「显示单位」 segmented toggle (kg/lb) was **local UI
state only**: it was seeded once from the loaded `unitSettings` but toggling it
**never wrote** anything — the preference was lost on relaunch. (EDIT-1 had just
activated the first in-place EDIT of canonical AppData for the profile scalars.)

EDIT-2 makes a USER toggle **persist** the display-unit preference into canonical
`AppData.unitSettings.displayUnit`, through the same sanctioned gated write. After a
relaunch the toggle reflects the saved preference.

| field | type | notes |
| --- | --- | --- |
| `unitSettings.displayUnit` | `WeightUnit` (`kg`/`lb`) | the **display** preference — the only field this slice writes |

**Storage stays kilograms** (Contract Freeze §8 / Agent 5 §3.6): no stored weight
value is ever coerced kg↔lb. This slice persists *how weights are shown*, not the
stored numbers. The typed `unitSettings.weightUnit` and any unknown unit key are
preserved untouched.

The toggle itself is the **explicit user action** (a single typed field — there is no
separate "保存" step, unlike EDIT-1's nine-field form). The one-time programmatic seed
is filtered out, so flipping the segment is the only thing that writes — never an
auto-write (§7).

---

## 2. The write path (single, sanctioned, gated)

EDIT-2 reuses the **one** native canonical write path (§8 rule 4: no second write
path) and the **same** private orchestration EDIT-1 generalized,
`performGatedMutation` in `IronPathPersistence.CanonicalSessionWriter`:

```
load existing  →  build candidate (pure transform)  →  DataHealth gate
   →  backup-before-overwrite  →  atomic save  →  honest throw on any failure
```

- **New public entry point:** `CanonicalSessionWriter.updateUnitSettings(displayUnit:
  baseIfMissing:validate:)` — the only thing it varies is the candidate builder. The
  load → gate → backup → atomic save → honest-throw contract is byte-for-byte the same
  as `appendCompletedSession` / `appendHealthMetricSample` / `updateProfile`. There is
  still **exactly one** `store.save(...)` site (the single-write-path invariant the
  static guard pins is preserved).
- **The builder reads the on-disk truth:** `{ $0.withUpdatedUnitSettings($0.unitSettings.withDisplayUnit(displayUnit)) }`.
  It reads the **freshly-loaded** `unitSettings` and rewrites only its `displayUnit`,
  so `weightUnit` and every unknown unit key come from the on-disk document at
  write-time — open-bag fidelity does not depend on the display projection, and there
  is no stale-value/race risk.
- **Same store:** the sanctioned `JSONFileAppDataStore.applicationSupport()` — the
  exact store the read path and every append/edit uses. No new store, no second path.
- **Honest failure / no fake success:** every failure THROWS a typed
  `CanonicalSessionWriteError`; the UI surfaces an honest 失败 status and **snaps the
  toggle back** to the persisted truth. A present-but-**unreadable** document is
  **never** overwritten (`existingDocumentUnreadable`).
- **Backup-before-overwrite:** when a prior file exists, `store.backup()` runs BEFORE
  `store.save()`; the timestamped `…backup-<ISO>` copy is the rollback artifact.

---

## 3. Open-bag / schema / timestamp fidelity (Domain)

The candidate is produced by **pure value transforms** in `IronPathDomain`
(`UnitSettingsEdit.swift`), mirroring `ProfileScalarEdit.swift`:

- **`AppData.withUpdatedUnitSettings(_ unitSettings:)`** rewrites **only** the
  `unitSettings` key (in place); every other top-level key and **all unknown / future
  fields** survive verbatim (§9 open bag); `schemaVersion` is **unchanged** (an edit is
  not a schema change — **no bump**); ISO-8601 timestamps elsewhere are carried through
  untouched (this edit writes no new time). Pure — no IO.
- **`UnitSettings.withDisplayUnit(_ displayUnit:)`** replaces only the display
  preference and preserves the typed `weightUnit` and the unit settings' **own open
  bag (`_unknown`)** — so an unknown future unit key is never dropped by an edit. A
  `nil` argument writes an honest "not set" (the encoder omits a nil `displayUnit`).

Both are unit-tested (`UnitSettingsEditTests`): display-unit replacement,
weightUnit/`_unknown` preservation, top-level open-bag + other-key preservation, no
schema bump, value semantics (receiver untouched), canonical round-trip, kg↔lb
round-trip, and that the edit changes only the display preference (stored kg weights,
`healthMetricSamples`, and `history` untouched).

This is an **EDIT, not a restore** (§13/§14): it rewrites one key of the user's
**already-canonical** document in place. It never replaces or merges an
external/backup document; the deferred full-AppData restore gate (§14) is untouched.

---

## 4. Defensive DataHealth gate (write-time re-validation, §10)

Per the approval (§4, defensive option), the app-layer supplies the writer's
`validate` gate so the candidate is **re-validated before it commits**:

```swift
try writer.updateUnitSettings(displayUnit: newUnit) { candidate in
    // Re-encode → re-decode (the schemaVersion guard re-runs) → DataHealth clean view.
    guard let bytes = try? candidate.canonicalJSONData(),
          let reDecoded = try? AppData(decoding: bytes) else { return false }
    let cleaned = buildCleanAppDataView(reDecoded)               // §10 chokepoint
    // Accept ONLY if (a) the chosen display unit survives the clean view AND
    // (b) the unitSettings object is byte-identical pre/post clean (open bag intact).
    guard cleaned.raw.unitSettings.displayUnit == newUnit else { return false }
    let a = try? cleaned.raw.unitSettings.encoded().canonicalJSONData()
    let b = try? candidate.unitSettings.encoded().canonicalJSONData()
    return a != nil && a == b
}
```

This routes the candidate through `buildCleanAppDataView` (the §10 chokepoint), and
the re-decode re-runs the `SchemaVersion` guard. A candidate whose display unit did
not survive cleaning, or whose `unitSettings` was altered by the clean view, is
refused honestly (`validationRejected`) and **nothing is written**.

---

## 5. UI (thin app layer, §15)

All UI lives in `ios/IronPath/ProfileRootView.swift` (no new app file, **no
`project.pbxproj` change** — the N-2/HK-2/EDIT-1 precedent). The 单位 section keeps
its segmented `Picker`; EDIT-2 wires it to persist:

- **`.onChange(of: displayUnit)`** calls `persistDisplayUnit(newUnit)`. It persists
  **only** a real user toggle: the one-time seed (and any pre-seed change) sets the
  toggle to the already-persisted value, so the value-equality guard skips it — no
  auto-write (§7). The `didSeedDisplayUnit` flag also blocks any write before the first
  load.
- **Honest status** in the section: 已保存 on a committed write, the failure reason on
  a rejected/failed write (no fake success, §15.4). On failure the toggle **snaps back**
  to `model.persistedDisplayUnit` so the UI reflects what is actually stored.
- **Footer updated** to the honest truth: weights are always stored in kg; toggling
  the display unit saves your preference to the device (after data validation) and it
  persists across relaunch. (The old "不会修改任何已保存的数据" wording — true when the
  toggle was in-memory-only — is removed.)

The thin `ProfileRealDataModel` gains:
- `unitSaveStatus` — a **separate** honest status from EDIT-1's `saveStatus`, so a unit
  toggle never surfaces a confirmation inside the profile-edit section.
- `persistedDisplayUnit` — the display unit currently in the loaded document
  (`displayUnit ?? weightUnit ?? .kg`), the seed/source-of-truth for the toggle.
- `saveDisplayUnit(_:)` — opts into the same sanctioned store and performs the gated
  write (§2) with the defensive gate (§4). Never writes on previews/tests (no live
  store); on success it reloads from fresh truth. No business logic beyond wiring + the
  IO seam (all disk IO is the store's).

---

## 6. Hard red lines honored (§7 of the approval / §18 of the contract)

- ✅ Single sanctioned store / **no second write path** — `updateUnitSettings` funnels
  through the same `performGatedMutation` as every append/edit (one `store.save`).
- ✅ Open-bag / schema / ISO-timestamp **full fidelity**; **no schema bump**.
- ✅ **Not a restore** — in-place single-key edit; never replaces/merges an external
  document (§13/§14 untouched).
- ✅ Backup → atomic → honest fail; a present-but-unreadable document is never
  overwritten; **no fake success** (failed toggle snaps back to stored truth).
- ✅ **User-explicit toggle**, never auto-write (the one-time seed is filtered);
  device-local, no network/cloud/account.
- ✅ **Storage stays kg** — only the display preference is persisted; no weight value
  is coerced; `weightUnit` and unknown unit keys preserved.
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
New tests: `UnitSettingsEditTests` (Domain) + the EDIT-2 section of
`CanonicalSessionWriterTests` (Persistence: first/second write, validation-reject,
gate-receives-candidate, unreadable-not-overwritten, backup-fail, save-fail,
weightUnit/open-bag-preserved-through-gated-write, real-store round trip).

**TypeScript gates (CI — §21.1):** no TS source changed and **no static guard was
modified** — `updateUnitSettings` adds a sibling entry point on the existing
`performGatedMutation` (the single `store.save` invariant the guard pins is
unchanged), and `ProfileRootView` adds no import. CI runs the TS suite for confidence.
`package.json` / `package-lock.json` unchanged.

**Real-device smoke (manual):** install on device → 我的 tab → flip 「显示单位」 kg↔lb →
confirm 「已保存」 and that displayed weights re-format → kill & relaunch → the toggle
shows the saved unit. Confirm stored numbers are unchanged. Toggle airplane mode to
confirm no network. A `…backup-<ISO>` file is created when an existing document is
overwritten.

---

## 8. Source-of-truth & data-safety impact

- **Source of truth:** AppData stays the single canonical document. EDIT-2 **reuses**
  the canonical edit-write boundary EDIT-1 already activated (§8.3) — no new write path,
  no boundary move. Only `unitSettings.displayUnit` is written; storage stays kg.
- **Data safety:** open-bag/schema/timestamp preserved (the builder reads the on-disk
  unit settings); defensive clean-view re-validation before commit; backup-before-
  overwrite + atomic + honest fail; never overwrite an unreadable document. **Not** a
  restore.
```
