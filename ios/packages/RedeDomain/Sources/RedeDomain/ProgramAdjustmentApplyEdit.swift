// ProgramAdjustmentApplyEdit — PA-2 (S10) Plan-Adaptive Apply-Write V1.
//
// Pure, IO-free logic that writes a WHOLE new program template into the canonical
// `AppData`'s `programTemplate` key — the Domain half of the Plan-Adaptive (PA)
// "apply-write" link, reusing the SAME sanctioned edit-write boundary (§8.3) as
// EDIT-4's program-config scalar edit (`AppData.withUpdatedProgramConfig`) and SR-4's
// exercise replacement (`AppData.withUpdatedExerciseReplacement`). The IO half (load →
// defensive DataHealth gate → backup → atomic save → honest fail) lives in
// `RedePersistence.CanonicalSessionWriter.applyProgramAdjustment`, and the DataHealth
// gate is supplied by the caller (the app layer), so this file stays a pure value
// transform with no FileManager / disk / network / clock.
//
// legacy web app SOURCE (the link this mirrors): `retired web reference`
//   * apply    — `applyProgramAdjustmentDraft` writes `programTemplate: updatedProgramTemplate`
//     (App.tsx:1205), where `updatedProgramTemplate` is the engine output of
//     `applyAdjustmentDraft` (retired-web-reference).
//   * rollback — `rollbackProgramAdjustment` writes `programTemplate: restoredProgramTemplate`
//     (App.tsx:1238), the cloned snapshot from `rollbackAdjustment`
//     (programAdjustmentEngine.ts:921-936).
// Both rewrite EXACTLY the same one key — `programTemplate` — so the Domain half is a
// single open-bag helper. The legacy web app ALSO updates bookkeeping keys (`templates` /
// `programAdjustmentHistory` / `programAdjustmentDrafts` / `activeProgramTemplateId`);
// those are a SEPARATE read/display surface (their iOS read accessors are not ported —
// a later PA read slice) and are deliberately OUT of this write slice. This slice writes
// ONLY the `programTemplate` input key.
//
// INPUT-not-OUTPUT (§11): `programTemplate` is an ENGINE INPUT — the engine recomputes
// `mesocyclePlan` weeks / prescriptions / phase / readiness / e1RM FROM it
// (retired-web-reference, enginePipeline.ts). Writing the new
// editable `programTemplate` (with its `dayTemplates` / `weeklyMuscleTargets` /
// `correctionStrategy` / `functionalStrategy`) and letting the engine recompute the
// outputs is the EXPECTED behaviour — exactly like the scalar/set edits. This helper
// NEVER touches an engine OUTPUT (the `mesocyclePlan` weeks blob lives in a different
// top-level key and is preserved verbatim by the open-bag rewrite below).
//
// This is an EDIT, not a restore (§13/§14): it rewrites ONE key of the user's
// already-canonical document in place — it never replaces or merges an external /
// backup document. It is a sanctioned MUTATION alongside `withUpdatedProfile` /
// `withUpdatedScreening` / `withUpdatedProgramConfig` / `withUpdatedExerciseReplacement`
// and the append helpers (§8/§9), and it preserves every open-bag invariant exactly like
// they do:
//   * ONLY the `programTemplate` key is rewritten; every other top-level key and all
//     unknown / future fields survive verbatim (§9 open-bag).
//   * `schemaVersion` is unchanged — an edit is not a schema change (no bump).
//   * ISO-8601 timestamps elsewhere in the document are carried through untouched
//     (this helper writes no time; the engine already stamped the new template with the
//     INJECTED clock — there is no `Date()` anywhere on this path).
//   * The replacement `ProgramTemplate`'s OWN open bag (`_unknown`, which is where the
//     rich `dayTemplates` / `weeklyMuscleTargets` projections live, PA-S1) is carried
//     forward verbatim by `ProgramTemplate.encoded()`.
// The canonical emitter sorts keys, so the in-place vs append position of the rewritten
// key never affects `canonicalJSONData()`.

import Foundation

extension AppData {
    /// A new `AppData` whose `programTemplate` key is rewritten to `updated`, in place.
    /// Pure value transform (Swift value semantics — the receiver is untouched). Unlike
    /// `withUpdatedProgramConfig` (which rewrites only the three scalar config fields on
    /// THIS document's existing program), this writes the WHOLE new editable program
    /// template the PA engine produced (`applyAdjustmentDraft.updatedProgramTemplate` /
    /// `rollbackAdjustment.restoredProgramTemplate`) — its `dayTemplates` /
    /// `weeklyMuscleTargets` / `correctionStrategy` / `functionalStrategy` are all
    /// editable INPUT the engine reads to recompute the plan. ONLY the `programTemplate`
    /// key is rewritten; every other top-level key and all unknown fields are preserved
    /// verbatim (§9 open-bag invariant), and `schemaVersion` is unchanged (an edit is not
    /// a schema change). Mirrors `withUpdatedProgramConfig` — the sanctioned PA
    /// apply-write MUTATION counterpart on the SAME edit-write boundary.
    public func withUpdatedProgramTemplate(_ updated: ProgramTemplate) -> AppData {
        let nextProgram = updated.encoded()
        var entries = root.entries
        if let idx = entries.firstIndex(where: { $0.key == "programTemplate" }) {
            entries[idx] = OrderedJSONObject.Entry(key: "programTemplate", value: nextProgram)
        } else {
            entries.append(OrderedJSONObject.Entry(key: "programTemplate", value: nextProgram))
        }
        return AppData(schemaVersion: schemaVersion, root: OrderedJSONObject(entries: entries))
    }
}
