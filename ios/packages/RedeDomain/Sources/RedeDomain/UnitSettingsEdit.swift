// UnitSettingsEdit — EDIT-2 Unit Settings (display unit) Edit V1.
//
// Pure, IO-free logic that turns a user's display-unit preference (kg/lb) change
// into a new CANONICAL `AppData` whose `unitSettings` key is rewritten — the Domain
// half of the SECOND native canonical-AppData EDIT (after EDIT-1's profile scalar
// edit), reusing the SAME sanctioned edit-write boundary (§8.3). The IO half (load →
// defensive DataHealth gate → backup → atomic save → honest fail) lives in
// `RedePersistence.CanonicalSessionWriter.updateUnitSettings`, and the DataHealth
// gate is supplied by the caller (the app layer), so this file stays a pure value
// transform with no FileManager / disk / network / clock.
//
// This is an EDIT, not a restore (§13/§14): it rewrites ONE key of the user's
// already-canonical document in place — it never replaces or merges an external /
// backup document. It is a sanctioned MUTATION alongside `withUpdatedProfile` and the
// append helpers (§8/§9), and it preserves every open-bag invariant exactly like they
// do:
//   * ONLY the `unitSettings` key is rewritten; every other top-level key and all
//     unknown / future fields survive verbatim (§9 open-bag).
//   * `schemaVersion` is unchanged — an edit is not a schema change (no bump).
//   * ISO-8601 timestamps elsewhere in the document are carried through untouched
//     (this edit only writes the typed display-unit token; it stamps no new time).
//   * `UnitSettings`'s OWN open bag (`_unknown`) + its non-edited typed field
//     (`weightUnit`) are preserved across the copy.
// STORAGE STAYS KILOGRAMS (Contract Freeze §8 / Agent 5 §3.6): this edit changes ONLY
// the DISPLAY preference (`unitSettings.displayUnit`); no stored weight value is ever
// coerced kg↔lb. The canonical emitter sorts keys, so the in-place vs append position
// of the rewritten key never affects `canonicalJSONData()`.

import Foundation

extension UnitSettings {
    /// A copy of these unit settings with ONLY the `displayUnit` preference replaced.
    /// Everything else is preserved verbatim: the typed `weightUnit` and the
    /// `_unknown` open bag (so an unknown future unit key is never dropped by an
    /// edit, §9).
    ///
    /// Pure value transform — no IO. A `nil` argument writes an honest "not set" for
    /// the display unit (the encoder omits a nil `displayUnit`). Mirrors
    /// `UserProfile.withScalarFields` — it only ever rewrites the editable field(s)
    /// and carries the open bag forward.
    public func withDisplayUnit(_ displayUnit: WeightUnit?) -> UnitSettings {
        UnitSettings(
            weightUnit: weightUnit,
            displayUnit: displayUnit,
            _unknown: _unknown
        )
    }
}

// MARK: - Canonical AppData unit-settings edit (open-bag preserving)

extension AppData {
    /// A new `AppData` with `unitSettings` written into the `unitSettings` key. Pure
    /// value transform (Swift value semantics — the receiver is untouched). ONLY the
    /// `unitSettings` key is rewritten, in place; every other top-level key and all
    /// unknown fields are preserved verbatim (§9 open-bag invariant), and
    /// `schemaVersion` is unchanged (an edit is not a schema change). Mirrors
    /// `withUpdatedProfile` — the sanctioned unit-edit MUTATION counterpart of the
    /// sanctioned append.
    public func withUpdatedUnitSettings(_ unitSettings: UnitSettings) -> AppData {
        let nextUnitSettings = unitSettings.encoded()
        var entries = root.entries
        if let idx = entries.firstIndex(where: { $0.key == "unitSettings" }) {
            entries[idx] = OrderedJSONObject.Entry(key: "unitSettings", value: nextUnitSettings)
        } else {
            entries.append(OrderedJSONObject.Entry(key: "unitSettings", value: nextUnitSettings))
        }
        return AppData(schemaVersion: schemaVersion, root: OrderedJSONObject(entries: entries))
    }
}
