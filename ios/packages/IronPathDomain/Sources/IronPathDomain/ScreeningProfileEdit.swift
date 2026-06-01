// ScreeningProfileEdit — EDIT-3 Screening Profile Edit V1.
//
// Pure, IO-free logic that turns a user's in-place edit of the screening profile
// list fields into a new CANONICAL `AppData` whose `screeningProfile` key is
// rewritten — the Domain half of the THIRD native canonical-AppData EDIT (after
// EDIT-1's profile scalar edit and EDIT-2's display-unit edit), reusing the SAME
// sanctioned edit-write boundary (§8.3). The IO half (load → defensive DataHealth
// gate → backup → atomic save → honest fail) lives in
// `IronPathPersistence.CanonicalSessionWriter.updateScreening`, and the DataHealth
// gate is supplied by the caller (the app layer), so this file stays a pure value
// transform with no FileManager / disk / network / clock.
//
// This is an EDIT, not a restore (§13/§14): it rewrites ONE key of the user's
// already-canonical document in place — it never replaces or merges an external /
// backup document. It is a sanctioned MUTATION alongside `withUpdatedProfile` /
// `withUpdatedUnitSettings` and the append helpers (§8/§9), and it preserves every
// open-bag invariant exactly like they do:
//   * ONLY the `screeningProfile` key is rewritten; every other top-level key and
//     all unknown / future fields survive verbatim (§9 open-bag).
//   * `schemaVersion` is unchanged — an edit is not a schema change (no bump).
//   * ISO-8601 timestamps elsewhere in the document are carried through untouched
//     (this edit only writes typed screening lists; it stamps no new time).
//   * `ScreeningProfile`'s OWN open bag (`_unknown`) + its ENGINE-MANAGED fields
//     (`userId`, `postureFlags`, `movementFlags`, `adaptiveState`) are preserved
//     verbatim across the edit. The user edits ONLY the three self-reported lists
//     (疼痛触发 / 受限动作 / 纠正优先); the adaptive issue scores / performance drops
//     carried in `adaptiveState` are DataHealth/engine-managed and never touched
//     here (DataHealth's `buildCleanScreening` owns capping/filtering them).
// The canonical emitter sorts keys, so the in-place vs append position of the
// rewritten key never affects `canonicalJSONData()`.

import Foundation

extension ScreeningProfile {
    /// A copy of this screening profile with ONLY the three user-editable list fields
    /// replaced (疼痛触发 `painTriggers` / 受限动作 `restrictedExercises` / 纠正优先
    /// `correctionPriority`). Everything else is preserved verbatim: the `userId`, the
    /// engine/DataHealth-managed `postureFlags` / `movementFlags` / `adaptiveState`
    /// (which carry the adaptive issue scores + performance drops), and the `_unknown`
    /// open bag (so an unknown future screening key is never dropped by an edit, §9).
    ///
    /// Pure value transform — no IO. A `nil` argument writes an honest "not set" for
    /// that list (the encoder omits a nil list). Mirrors `UserProfile.withScalarFields`
    /// — it only ever rewrites the editable field(s) and carries everything else
    /// (including the open bag) forward.
    public func withEditedLists(
        painTriggers: [String]?,
        restrictedExercises: [String]?,
        correctionPriority: [String]?
    ) -> ScreeningProfile {
        ScreeningProfile(
            userId: userId,
            painTriggers: painTriggers,
            restrictedExercises: restrictedExercises,
            correctionPriority: correctionPriority,
            postureFlags: postureFlags,
            movementFlags: movementFlags,
            adaptiveState: adaptiveState,
            _unknown: _unknown
        )
    }
}

// MARK: - Canonical AppData screening edit (open-bag preserving)

extension AppData {
    /// A new `AppData` with `screening` written into the `screeningProfile` key. Pure
    /// value transform (Swift value semantics — the receiver is untouched). ONLY the
    /// `screeningProfile` key is rewritten, in place; every other top-level key and all
    /// unknown fields are preserved verbatim (§9 open-bag invariant), and
    /// `schemaVersion` is unchanged (an edit is not a schema change). Mirrors
    /// `withUpdatedProfile` / `withUpdatedUnitSettings` — the sanctioned screening-edit
    /// MUTATION counterpart of the sanctioned append.
    public func withUpdatedScreening(_ screening: ScreeningProfile) -> AppData {
        let nextScreening = screening.encoded()
        var entries = root.entries
        if let idx = entries.firstIndex(where: { $0.key == "screeningProfile" }) {
            entries[idx] = OrderedJSONObject.Entry(key: "screeningProfile", value: nextScreening)
        } else {
            entries.append(OrderedJSONObject.Entry(key: "screeningProfile", value: nextScreening))
        }
        return AppData(schemaVersion: schemaVersion, root: OrderedJSONObject(entries: entries))
    }
}
