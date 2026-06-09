// iOS-4B1 — small JSONValue extraction helpers for the TrainingDecision golden
// type skeleton. Pure-value decode helpers ONLY: no engine logic, no AppData,
// no computation of any decision. Mirrors the iOS-2C `init(decoding:)` idiom.

import Foundation
import RedeDomain

/// Errors raised while decoding a TrainingDecision golden shape.
public enum TrainingDecisionDecodeError: Error, Equatable, Sendable {
    case notAnObject(context: String)
    case missingKey(String, context: String)
    case wrongType(String, context: String)
}

extension JSONValue {
    /// The object body, or throw — used where the golden contract guarantees an object.
    func requireObject(_ context: String) throws -> OrderedJSONObject {
        guard let obj = objectValue else {
            throw TrainingDecisionDecodeError.notAnObject(context: context)
        }
        return obj
    }
}

extension OrderedJSONObject {
    func requireString(_ key: String, _ context: String) throws -> String {
        guard let v = self[key] else {
            throw TrainingDecisionDecodeError.missingKey(key, context: context)
        }
        guard let s = v.stringValue else {
            throw TrainingDecisionDecodeError.wrongType(key, context: context)
        }
        return s
    }

    func optionalString(_ key: String) -> String? {
        guard let v = self[key], !v.isNull else { return nil }
        return v.stringValue
    }

    func optionalBool(_ key: String) -> Bool? {
        guard let v = self[key], !v.isNull else { return nil }
        return v.boolValue
    }

    func optionalInt(_ key: String) -> Int? {
        guard let v = self[key], !v.isNull else { return nil }
        return v.intValue
    }

    func optionalDouble(_ key: String) -> Double? {
        guard let v = self[key], !v.isNull else { return nil }
        return v.doubleValue
    }

    /// A `[String]` array (each element a string). Returns nil if the key is
    /// absent/null; returns [] for an empty array.
    func optionalStringArray(_ key: String) -> [String]? {
        guard let v = self[key], !v.isNull, let arr = v.arrayValue else { return nil }
        return arr.compactMap { $0.stringValue }
    }

    /// A `[Int]` array. Returns nil if absent/null; [] for an empty array.
    func optionalIntArray(_ key: String) -> [Int]? {
        guard let v = self[key], !v.isNull, let arr = v.arrayValue else { return nil }
        return arr.compactMap { $0.intValue }
    }

    /// The nested object at `key`, or nil if absent/null/not-an-object.
    func optionalObject(_ key: String) -> OrderedJSONObject? {
        guard let v = self[key], !v.isNull else { return nil }
        return v.objectValue
    }

    /// The nested array at `key`, or nil if absent/null/not-an-array.
    func optionalArray(_ key: String) -> [JSONValue]? {
        guard let v = self[key], !v.isNull else { return nil }
        return v.arrayValue
    }

    /// The raw JSONValue at `key` (preserves the full open-bag subtree),
    /// or nil if absent. Null is preserved as `.null`.
    func rawValue(_ key: String) -> JSONValue? {
        self[key]
    }
}
