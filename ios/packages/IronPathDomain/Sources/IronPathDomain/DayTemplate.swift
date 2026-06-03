// DayTemplate — PA-S1 PA Domain Types V1.
//
// Mirrors the TypeScript `DayTemplate` interface at
// `src/models/training-model.ts:218`. One training day inside a rich
// `ProgramTemplate` — the muscle focus + the correction / main /
// functional exercise-id blocks the PA engines reorder and re-dose.
//
// Same paradigm as the existing Domain types (`ProgramTemplate`,
// `MesocyclePlan`): `init(decoding:)` / `encoded()` over `JSONValue`,
// every documented key carried losslessly, an `_unknown` open bag for
// any field not promoted to a typed property, canonical round-trip.
// All properties are `Optional` (the `ProgramTemplate`/`MesocyclePlan`
// convention) so a partially-formed document still decodes; the TS
// requiredness of each field is noted in-line.
//
// `focusMuscles` is the TS `MuscleGroup[]` union — carried as `[String]`
// (the `ProgramTemplate.primaryGoal` precedent for union-typed fields:
// String preserves an unknown future member losslessly).
//
// Pure type: no runtime logic, no write path, no `: Date`.

import Foundation

public struct DayTemplate: Equatable, Hashable, Sendable, PAJSONCodable {
    public let id: String?                     // TS: `id: string` (required)
    public let name: String?                   // TS: `name: string` (required)
    public let focusMuscles: [String]?         // TS: `focusMuscles: MuscleGroup[]`
    public let correctionBlockIds: [String]?   // TS: `correctionBlockIds: string[]`
    public let mainExerciseIds: [String]?      // TS: `mainExerciseIds: string[]`
    public let functionalBlockIds: [String]?   // TS: `functionalBlockIds: string[]`
    public let estimatedDurationMin: NumberRepr? // TS: `estimatedDurationMin: number`

    public let _unknown: OrderedJSONObject

    public init(
        id: String? = nil,
        name: String? = nil,
        focusMuscles: [String]? = nil,
        correctionBlockIds: [String]? = nil,
        mainExerciseIds: [String]? = nil,
        functionalBlockIds: [String]? = nil,
        estimatedDurationMin: NumberRepr? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.id = id
        self.name = name
        self.focusMuscles = focusMuscles
        self.correctionBlockIds = correctionBlockIds
        self.mainExerciseIds = mainExerciseIds
        self.functionalBlockIds = functionalBlockIds
        self.estimatedDurationMin = estimatedDurationMin
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        var extracted: Set<String> = []
        self.id = PADecode.string(obj, "id", &extracted)
        self.name = PADecode.string(obj, "name", &extracted)
        self.focusMuscles = PADecode.stringArray(obj, "focusMuscles", &extracted)
        self.correctionBlockIds = PADecode.stringArray(obj, "correctionBlockIds", &extracted)
        self.mainExerciseIds = PADecode.stringArray(obj, "mainExerciseIds", &extracted)
        self.functionalBlockIds = PADecode.stringArray(obj, "functionalBlockIds", &extracted)
        self.estimatedDurationMin = PADecode.number(obj, "estimatedDurationMin", &extracted)
        self._unknown = obj.withoutKeys(extracted)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        PAEncode.string(&typed, "id", id)
        PAEncode.string(&typed, "name", name)
        PAEncode.stringArray(&typed, "focusMuscles", focusMuscles)
        PAEncode.stringArray(&typed, "correctionBlockIds", correctionBlockIds)
        PAEncode.stringArray(&typed, "mainExerciseIds", mainExerciseIds)
        PAEncode.stringArray(&typed, "functionalBlockIds", functionalBlockIds)
        PAEncode.number(&typed, "estimatedDurationMin", estimatedDurationMin)
        return .object(_unknown.appending(typed))
    }
}
