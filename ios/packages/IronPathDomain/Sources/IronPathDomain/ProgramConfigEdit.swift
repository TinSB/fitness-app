// ProgramConfigEdit — EDIT-4 Program Config Edit V1.
//
// Pure, IO-free logic that turns a user's in-place edit of the program template's
// scalar CONFIG fields into a new CANONICAL `AppData` whose `programTemplate` key is
// rewritten — the Domain half of the FOURTH native canonical-AppData EDIT (after
// EDIT-1's profile scalar edit, EDIT-2's display-unit edit, and EDIT-3's screening
// list edit), reusing the SAME sanctioned edit-write boundary (§8.3). The IO half
// (load → defensive DataHealth gate → backup → atomic save → honest fail) lives in
// `IronPathPersistence.CanonicalSessionWriter.updateProgramConfig`, and the DataHealth
// gate is supplied by the caller (the app layer), so this file stays a pure value
// transform with no FileManager / disk / network / clock.
//
// This is an EDIT, not a restore (§13/§14): it rewrites ONE key of the user's
// already-canonical document in place — it never replaces or merges an external /
// backup document. It is a sanctioned MUTATION alongside `withUpdatedProfile` /
// `withUpdatedUnitSettings` / `withUpdatedScreening` and the append helpers (§8/§9),
// and it preserves every open-bag invariant exactly like they do:
//   * ONLY the `programTemplate` key is rewritten; every other top-level key and all
//     unknown / future fields survive verbatim (§9 open-bag).
//   * `schemaVersion` is unchanged — an edit is not a schema change (no bump).
//   * ISO-8601 timestamps elsewhere in the document are carried through untouched
//     (this edit only writes typed program scalars; it stamps no new time).
//   * `ProgramTemplate`'s OWN open bag (`_unknown`) + its NON-edited fields (`id`,
//     `userId`, and the ENGINE-managed `correctionStrategy` / `functionalStrategy`
//     strategy blobs) are preserved verbatim across the edit. The user edits ONLY the
//     three simple scalar config fields (主要目标 `primaryGoal` / 分项 `splitType` /
//     每周天数 `daysPerWeek`). The engine-managed STRUCTURED plan — the mesocycle
//     `weeks` array, exercise prescriptions, adaptive state — lives elsewhere
//     (`mesocyclePlan`, etc.) and is NEVER touched by this edit.
// The canonical emitter sorts keys, so the in-place vs append position of the
// rewritten key never affects `canonicalJSONData()`.

import Foundation

extension ProgramTemplate {
    /// A copy of this program template with ONLY the three user-editable scalar config
    /// fields replaced (主要目标 `primaryGoal` / 分项 `splitType` / 每周天数
    /// `daysPerWeek`). Everything else is preserved verbatim: the `id`, the `userId`,
    /// the ENGINE-managed `correctionStrategy` / `functionalStrategy` strategy blobs,
    /// and the `_unknown` open bag (so an unknown future program key is never dropped by
    /// an edit, §9).
    ///
    /// Pure value transform — no IO. A `nil` argument writes an honest "not set" for
    /// that field (the encoder omits a nil scalar). Mirrors `UserProfile.withScalarFields`
    /// / `ScreeningProfile.withEditedLists` — it only ever rewrites the editable
    /// field(s) and carries everything else (including the open bag) forward.
    public func withConfigScalars(
        primaryGoal: String?,
        splitType: String?,
        daysPerWeek: NumberRepr?
    ) -> ProgramTemplate {
        ProgramTemplate(
            id: id,
            userId: userId,
            primaryGoal: primaryGoal,
            splitType: splitType,
            daysPerWeek: daysPerWeek,
            correctionStrategy: correctionStrategy,
            functionalStrategy: functionalStrategy,
            _unknown: _unknown
        )
    }
}

// MARK: - Canonical AppData program-config edit (open-bag preserving)

extension AppData {
    /// A new `AppData` with the program template's three scalar config fields rewritten
    /// into the `programTemplate` key. Pure value transform (Swift value semantics — the
    /// receiver is untouched). The base for the rewrite is THIS document's own
    /// `programTemplate` (so `id` / `userId` / the engine-managed `correctionStrategy` /
    /// `functionalStrategy` strategy blobs + the program's own open bag survive from the
    /// canonical document verbatim), with ONLY `primaryGoal` / `splitType` /
    /// `daysPerWeek` swapped. ONLY the `programTemplate` key is rewritten, in place;
    /// every other top-level key and all unknown fields are preserved verbatim (§9
    /// open-bag invariant), and `schemaVersion` is unchanged (an edit is not a schema
    /// change). Mirrors `withUpdatedProfile` / `withUpdatedScreening` — the sanctioned
    /// program-config-edit MUTATION counterpart of the sanctioned append.
    public func withUpdatedProgramConfig(
        primaryGoal: String?,
        splitType: String?,
        daysPerWeek: NumberRepr?
    ) -> AppData {
        let nextProgram = programTemplate.withConfigScalars(
            primaryGoal: primaryGoal,
            splitType: splitType,
            daysPerWeek: daysPerWeek
        ).encoded()
        var entries = root.entries
        if let idx = entries.firstIndex(where: { $0.key == "programTemplate" }) {
            entries[idx] = OrderedJSONObject.Entry(key: "programTemplate", value: nextProgram)
        } else {
            entries.append(OrderedJSONObject.Entry(key: "programTemplate", value: nextProgram))
        }
        return AppData(schemaVersion: schemaVersion, root: OrderedJSONObject(entries: entries))
    }
}
