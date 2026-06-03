// ProgramTemplate+PARich — PA-S1 PA Domain Types V1.
//
// ADDITIVE enrichment of the existing thin persistence `ProgramTemplate`
// (`ProgramTemplate.swift`) so it can ALSO carry the rich PA (Plan-Adaptive)
// program shape the TypeScript `ProgramTemplate` (`src/models/training-model.ts:228`)
// declares — `dayTemplates: DayTemplate[]` (`:237`) and
// `weeklyMuscleTargets: Record<string, number>` (`:236`) — WITHOUT touching
// the thin struct's stored shape.
//
// Why an extension over the open bag, not a stored field (the hard
// constraint reconciliation):
//   * The thin `ProgramTemplate` is the PERSISTED structure. Its three
//     scalar config fields are edited in place by EDIT-4
//     (`ProgramTemplate.withConfigScalars` → `AppData.withUpdatedProgramConfig`),
//     whose memberwise rebuild carries `_unknown` forward verbatim.
//   * `dayTemplates` / `weeklyMuscleTargets` are NOT in the thin struct's
//     `documentedKeys`, so they already live in `_unknown` and round-trip
//     verbatim across persistence and EDIT-4.
//   * Promoting them to STORED typed fields would add them to
//     `documentedKeys` AND require `withConfigScalars` to carry the new
//     fields — i.e. it would change `ProgramTemplate` decode/encode and
//     touch the EDIT-4 write path. That is the contract's stop-and-escalate
//     trigger, so PA-S1 does NOT do it.
//   * Instead these are READ-ONLY typed PROJECTIONS that decode the rich
//     data on demand from the EXISTING open bag. `ProgramTemplate.swift`
//     is byte-unchanged; `documentedKeys` / `init(decoding:)` / `encoded()`
//     / `withConfigScalars` / `AppData.withUpdatedProgramConfig` are
//     untouched; `schemaVersion` is NOT bumped; the §9 open-bag round-trip
//     is preserved exactly. See §9 (PA-S1 note).
//
// Pure type projection: read-only, no mutation, no write path, no `: Date`.

import Foundation

extension ProgramTemplate {
    /// The rich `DayTemplate[]` plan, decoded on demand from the open bag
    /// (TS `ProgramTemplate.dayTemplates`, `src/models/training-model.ts:237`).
    /// `nil` when the program carries no `dayTemplates` key or its value is
    /// not a clean array of day-template objects — in which case the raw
    /// value (if any) still round-trips verbatim through `_unknown`.
    public var dayTemplates: [DayTemplate]? {
        guard let array = _unknown["dayTemplates"]?.arrayValue else { return nil }
        return try? array.map { try DayTemplate(decoding: $0) }
    }

    /// The rich `Record<string, number>` weekly muscle-set targets, decoded
    /// on demand from the open bag (TS `ProgramTemplate.weeklyMuscleTargets`,
    /// `src/models/training-model.ts:236`). `nil` when the key is absent or
    /// any value is non-numeric; the raw value still round-trips through
    /// `_unknown`.
    public var weeklyMuscleTargets: [String: NumberRepr]? {
        guard let object = _unknown["weeklyMuscleTargets"]?.objectValue else { return nil }
        var targets: [String: NumberRepr] = [:]
        targets.reserveCapacity(object.count)
        for entry in object.entries {
            guard case .number(let value) = entry.value else { return nil }
            targets[entry.key] = value
        }
        return targets
    }
}
