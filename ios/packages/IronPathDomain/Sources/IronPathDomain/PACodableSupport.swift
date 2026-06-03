// PACodableSupport — PA-S1 PA Domain Types V1.
//
// Shared, lossless JSON↔Swift plumbing for the PA (Plan-Adaptive)
// domain type family (`DayTemplate` / `ExerciseTemplate` /
// `TrainingTemplate` / `WeeklyActionRecommendation` / `AdjustmentChange`
// / `ProgramAdjustmentDraft` / `ProgramAdjustmentHistoryItem` /
// `ProgramAdjustmentDiff`). It factors out the EXACT same `init(decoding:)`
// / `encoded()` plumbing the existing Domain types (`ProgramTemplate`,
// `MesocyclePlan`, `UnitSettings`) write inline — there is no business
// logic here, only the documented open-bag serialization rules.
//
// The single invariant every decode helper enforces is the lossless
// "extracted-set" rule (the `UnitSettings` precedent): a key is added to
// the caller's `extracted` set — and therefore lifted out of the owner's
// `_unknown` open bag — ONLY when its value parses cleanly to the
// documented Swift type. A present-but-wrong-typed / unrecognised value
// is left untouched so it round-trips verbatim from the open bag.
// Combined with `OrderedJSONObject.withoutKeys` / `appending` + the
// key-sorted canonical emit, decode → `encoded()` is byte-identical to
// the canonical form of the input for any document.
//
// Pure type plumbing: no runtime logic, no write path, no `: Date`.

import Foundation

/// A PA domain type that round-trips through the `JSONValue` open-bag
/// paradigm. Lets the nested object / object-array helpers stay generic.
protocol PAJSONCodable {
    init(decoding value: JSONValue) throws
    func encoded() -> JSONValue
}

// The existing thin persistence `ProgramTemplate` already has the exact
// shape — conform it so `ProgramAdjustmentHistoryItem.sourceProgramSnapshot`
// can nest it through the generic helpers without re-implementing decode.
extension ProgramTemplate: PAJSONCodable {}

enum PADecode {
    static func string(_ obj: OrderedJSONObject, _ key: String, _ extracted: inout Set<String>) -> String? {
        if let s = obj[key]?.stringValue { extracted.insert(key); return s }
        return nil
    }

    static func number(_ obj: OrderedJSONObject, _ key: String, _ extracted: inout Set<String>) -> NumberRepr? {
        if let n = obj[key]?.numberValue { extracted.insert(key); return n }
        return nil
    }

    static func bool(_ obj: OrderedJSONObject, _ key: String, _ extracted: inout Set<String>) -> Bool? {
        if let b = obj[key]?.boolValue { extracted.insert(key); return b }
        return nil
    }

    /// Extracts only when EVERY element is a string; otherwise the whole
    /// field stays in the open bag (lossless).
    static func stringArray(_ obj: OrderedJSONObject, _ key: String, _ extracted: inout Set<String>) -> [String]? {
        guard let arr = obj[key]?.arrayValue else { return nil }
        let strings = arr.compactMap { $0.stringValue }
        guard strings.count == arr.count else { return nil }
        extracted.insert(key)
        return strings
    }

    /// Closed-enum field via the lossless "extracted-set" rule: extracts
    /// only when the raw token maps to a known case; an unknown future
    /// token stays in the open bag.
    static func rawEnum<E: RawRepresentable>(
        _ obj: OrderedJSONObject, _ key: String, _ extracted: inout Set<String>, _ type: E.Type
    ) -> E? where E.RawValue == String {
        if let s = obj[key]?.stringValue, let value = E(rawValue: s) {
            extracted.insert(key)
            return value
        }
        return nil
    }

    /// Nested PA struct. Extracts only when the value is an object that
    /// decodes cleanly; the nested struct carries its OWN open bag, so
    /// the round-trip stays lossless at every level.
    static func object<T: PAJSONCodable>(
        _ obj: OrderedJSONObject, _ key: String, _ extracted: inout Set<String>, _ type: T.Type
    ) -> T? {
        guard let value = obj[key], case .object = value,
              let decoded = try? T(decoding: value) else { return nil }
        extracted.insert(key)
        return decoded
    }

    /// Array of nested PA structs. Extracts only when the value is an
    /// array whose every element decodes; otherwise stays in the bag.
    static func objectArray<T: PAJSONCodable>(
        _ obj: OrderedJSONObject, _ key: String, _ extracted: inout Set<String>, _ type: T.Type
    ) -> [T]? {
        guard let arr = obj[key]?.arrayValue,
              let decoded = try? arr.map({ try T(decoding: $0) }) else { return nil }
        extracted.insert(key)
        return decoded
    }

    /// Carries an arbitrary not-yet-typed nested value verbatim (the
    /// `MesocyclePlan.weeks` precedent). Extracts whenever present.
    static func raw(_ obj: OrderedJSONObject, _ key: String, _ extracted: inout Set<String>) -> JSONValue? {
        if let value = obj[key] { extracted.insert(key); return value }
        return nil
    }
}

enum PAEncode {
    static func string(_ typed: inout [OrderedJSONObject.Entry], _ key: String, _ value: String?) {
        if let v = value { typed.append(.init(key: key, value: .string(v))) }
    }

    static func number(_ typed: inout [OrderedJSONObject.Entry], _ key: String, _ value: NumberRepr?) {
        if let v = value { typed.append(.init(key: key, value: .number(v))) }
    }

    static func bool(_ typed: inout [OrderedJSONObject.Entry], _ key: String, _ value: Bool?) {
        if let v = value { typed.append(.init(key: key, value: .bool(v))) }
    }

    static func stringArray(_ typed: inout [OrderedJSONObject.Entry], _ key: String, _ value: [String]?) {
        if let v = value { typed.append(.init(key: key, value: .array(v.map { .string($0) }))) }
    }

    static func rawEnum<E: RawRepresentable>(
        _ typed: inout [OrderedJSONObject.Entry], _ key: String, _ value: E?
    ) where E.RawValue == String {
        if let v = value { typed.append(.init(key: key, value: .string(v.rawValue))) }
    }

    static func object<T: PAJSONCodable>(_ typed: inout [OrderedJSONObject.Entry], _ key: String, _ value: T?) {
        if let v = value { typed.append(.init(key: key, value: v.encoded())) }
    }

    static func objectArray<T: PAJSONCodable>(_ typed: inout [OrderedJSONObject.Entry], _ key: String, _ value: [T]?) {
        if let v = value { typed.append(.init(key: key, value: .array(v.map { $0.encoded() }))) }
    }

    static func raw(_ typed: inout [OrderedJSONObject.Entry], _ key: String, _ value: JSONValue?) {
        if let v = value { typed.append(.init(key: key, value: v)) }
    }
}
