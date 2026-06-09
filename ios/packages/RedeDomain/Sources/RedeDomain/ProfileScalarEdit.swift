// ProfileScalarEdit — EDIT-1 Profile Scalar Field Edit V1.
//
// Pure, IO-free logic that turns a user's in-place edit of the profile scalar
// fields into a new CANONICAL `AppData` whose `userProfile` key is rewritten —
// the Domain half of the FIRST native canonical-AppData EDIT write path (§8). The
// IO half (load → defensive DataHealth gate → backup → atomic save → honest fail)
// lives in `RedePersistence.CanonicalSessionWriter.updateProfile`, and the
// DataHealth gate is supplied by the caller (the app layer), so this file stays a
// pure value transform with no FileManager / disk / network / clock.
//
// This is an EDIT, not a restore (§13/§14): it rewrites ONE key of the user's
// already-canonical document in place — it never replaces or merges an external /
// backup document. It is a sanctioned MUTATION alongside `appendingHistorySession`
// (§8/§9), and it preserves every open-bag invariant exactly like the append
// helpers do:
//   * ONLY the `userProfile` key is rewritten; every other top-level key and all
//     unknown / future fields survive verbatim (§9 open-bag).
//   * `schemaVersion` is unchanged — an edit is not a schema change (no bump).
//   * ISO-8601 timestamps elsewhere in the document are carried through untouched
//     (this edit only writes typed profile scalars; it stamps no new time).
//   * `UserProfile`'s OWN open bag (`_unknown`) + its non-edited fields (`id`,
//     `injuryFlags`, `painNotes`) are preserved across the scalar copy.
// The canonical emitter sorts keys, so the in-place vs append position of the
// rewritten key never affects `canonicalJSONData()`.

import Foundation

extension UserProfile {
    /// A copy of this profile with ONLY the nine user-editable scalar fields
    /// replaced (姓名 / 性别 / 年龄 / 身高 / 体重 / 训练水平 / 目标 / 每周天数 /
    /// 单次时长). Everything else is preserved verbatim: the profile `id`, the
    /// `injuryFlags` / `painNotes` lists, and the `_unknown` open bag (so an
    /// unknown future profile key is never dropped by an edit, §9).
    ///
    /// `weightKg` here is the user's SELF-ENTERED weight (stored in kilograms) —
    /// it is deliberately distinct from the Apple-Health-derived latest body
    /// weight (`healthMetricSamples`), which this edit never touches.
    ///
    /// Pure value transform — no IO. A `nil` argument writes an honest "not set"
    /// for that field (the encoder omits a nil scalar).
    public func withScalarFields(
        name: String?,
        sex: String?,
        age: NumberRepr?,
        heightCm: NumberRepr?,
        weightKg: NumberRepr?,
        trainingLevel: String?,
        primaryGoal: String?,
        weeklyTrainingDays: NumberRepr?,
        sessionDurationMin: NumberRepr?
    ) -> UserProfile {
        UserProfile(
            id: id,
            name: name,
            sex: sex,
            age: age,
            heightCm: heightCm,
            weightKg: weightKg,
            trainingLevel: trainingLevel,
            primaryGoal: primaryGoal,
            weeklyTrainingDays: weeklyTrainingDays,
            sessionDurationMin: sessionDurationMin,
            injuryFlags: injuryFlags,
            painNotes: painNotes,
            _unknown: _unknown
        )
    }
}

// MARK: - Canonical AppData profile edit (open-bag preserving)

extension AppData {
    /// A new `AppData` with `profile` written into the `userProfile` key. Pure
    /// value transform (Swift value semantics — the receiver is untouched). ONLY
    /// the `userProfile` key is rewritten, in place; every other top-level key and
    /// all unknown fields are preserved verbatim (§9 open-bag invariant), and
    /// `schemaVersion` is unchanged (an edit is not a schema change). Mirrors
    /// `appendingHistorySession` — the sanctioned edit MUTATION counterpart of the
    /// sanctioned append.
    public func withUpdatedProfile(_ profile: UserProfile) -> AppData {
        let nextProfile = profile.encoded()
        var entries = root.entries
        if let idx = entries.firstIndex(where: { $0.key == "userProfile" }) {
            entries[idx] = OrderedJSONObject.Entry(key: "userProfile", value: nextProfile)
        } else {
            entries.append(OrderedJSONObject.Entry(key: "userProfile", value: nextProfile))
        }
        return AppData(schemaVersion: schemaVersion, root: OrderedJSONObject(entries: entries))
    }
}
