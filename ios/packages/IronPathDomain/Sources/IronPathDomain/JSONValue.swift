// JSONValue — iOS-2B AppData Swift Models V1.
//
// Hand-written generic JSON tree carrier. Hand-written so iOS-2 ships
// with no third-party SwiftPM dependency (Cross-review Revision H2 and
// Stop Condition #7). See
// docs/ios-native-migration/agents-ios-2a/AGENT_2_JSONVALUE_CODABLE.md
// for the full design rationale.
//
// Round-trip contract:
//   1. `JSONValue.init(decoding: Data)` parses via Foundation's
//      `JSONSerialization` and recursively maps each Foundation type
//      to the corresponding `JSONValue` case.
//   2. `JSONValue.canonicalJSONData()` re-emits with lexicographically
//      sorted keys, no whitespace, matching the TypeScript
//      `stableStringify` rules at
//      `src/cloudProduction/accountBoundaryLocalInventory.ts:116`.
//   3. Decode order is NOT preserved on the object case — keys are
//      stored in alphabetic order. The parity tests compare via
//      canonical emit on both sides, so order is irrelevant.
//
// Number representation:
//   `NumberRepr.integer(Int64)` for whole numbers that fit Int64;
//   `NumberRepr.decimal(Decimal)` for everything else. Matches the TS
//   `JSON.stringify` collapse where `42.0` re-emits as `"42"`. The
//   V2 escalation to `originalText(String)` is gated on a failing
//   `AppDataSnapshotHashParityTests` row whose diff is purely number
//   formatting — see Agent 2 §4.

import Foundation

public enum JSONValueError: Error, Sendable, Equatable {
    case unsupportedType(String)
    case invalidNumber(String)
    case decodeFailed(String)
    case notAnObject
}

public enum NumberRepr: Equatable, Hashable, Sendable {
    case integer(Int64)
    case decimal(Decimal)
}

public enum JSONValue: Equatable, Hashable, Sendable {
    case null
    case bool(Bool)
    case number(NumberRepr)
    case string(String)
    case array([JSONValue])
    case object(OrderedJSONObject)
}

public struct OrderedJSONObject: Equatable, Hashable, Sendable {
    public struct Entry: Equatable, Hashable, Sendable {
        public let key: String
        public let value: JSONValue
        public init(key: String, value: JSONValue) {
            self.key = key
            self.value = value
        }
    }

    public let entries: [Entry]

    public init(entries: [Entry] = []) {
        self.entries = entries
    }

    public subscript(_ key: String) -> JSONValue? {
        entries.first(where: { $0.key == key })?.value
    }

    public var keys: [String] { entries.map { $0.key } }
    public var count: Int { entries.count }
    public var isEmpty: Bool { entries.isEmpty }

    /// Returns a new `OrderedJSONObject` whose entries are sorted
    /// lexicographically by key. Used by the canonical emit path.
    public func canonicalized() -> OrderedJSONObject {
        OrderedJSONObject(entries: entries.sorted { $0.key < $1.key })
    }
}

// MARK: - Foundation interop

extension JSONValue {
    /// Parses the given JSON bytes into a `JSONValue` tree.
    public init(decoding data: Data) throws {
        let raw = try JSONSerialization.jsonObject(
            with: data,
            options: [.fragmentsAllowed]
        )
        self = try JSONValue(fromFoundation: raw)
    }

    /// Recursively maps a Foundation `Any` (the output of
    /// `JSONSerialization.jsonObject`) into a `JSONValue`. Keys of an
    /// object are stored in lexicographic order on the way in;
    /// canonical equality is independent of input order.
    public init(fromFoundation raw: Any) throws {
        // `NSNull` is the JSON `null`.
        if raw is NSNull {
            self = .null
            return
        }
        // `NSNumber` covers both Bool and numeric values. Distinguish
        // via the underlying Objective-C type encoding because Swift's
        // `as? Bool` lossily accepts `NSNumber(value: 0)` and `1`.
        if let n = raw as? NSNumber {
            let cType = String(cString: n.objCType)
            if cType == "c" || cType == "B" {
                // Cocoa encodes Bool as 'c' (signed char) or 'B'.
                // Heuristic: only treat as Bool when the value is
                // exactly 0 or 1 AND the encoding flags say so.
                // JSONSerialization specifically returns
                // `__NSCFBoolean` for booleans whose objCType is 'c'.
                if CFGetTypeID(n) == CFBooleanGetTypeID() {
                    self = .bool(n.boolValue)
                    return
                }
            }
            // Heuristic: if the number is integral and fits Int64,
            // use the integer case; otherwise fall back to Decimal.
            // This matches the TS `JSON.stringify` behaviour of
            // collapsing whole-number floats to integer text.
            if "qQilsLISCBcijklmnopuv".contains(cType) {
                self = .number(.integer(n.int64Value))
                return
            }
            // For float/double objCType ('f' or 'd') we still want
            // integer representation when the underlying double has
            // no fractional part AND fits Int64 exactly.
            let d = n.doubleValue
            if d.isFinite,
               d.truncatingRemainder(dividingBy: 1) == 0,
               d >= Double(Int64.min),
               d <= Double(Int64.max) {
                self = .number(.integer(Int64(d)))
                return
            }
            self = .number(.decimal(n.decimalValue))
            return
        }
        if let s = raw as? String {
            self = .string(s)
            return
        }
        if let a = raw as? [Any] {
            self = .array(try a.map { try JSONValue(fromFoundation: $0) })
            return
        }
        if let o = raw as? [String: Any] {
            self = .object(try OrderedJSONObject(fromFoundation: o))
            return
        }
        throw JSONValueError.unsupportedType("\(type(of: raw))")
    }
}

extension OrderedJSONObject {
    public init(fromFoundation raw: [String: Any]) throws {
        var es: [Entry] = []
        es.reserveCapacity(raw.count)
        // Sort keys alphabetically on ingest so equal-input → equal
        // structure even though Foundation does not guarantee order.
        for key in raw.keys.sorted() {
            let v = try JSONValue(fromFoundation: raw[key] as Any)
            es.append(Entry(key: key, value: v))
        }
        self.init(entries: es)
    }
}

// MARK: - Canonical emit

extension JSONValue {
    /// Re-emits this value as the canonical JSON form used by the
    /// IronPath parity hash. Object keys are sorted lexicographically,
    /// no whitespace is inserted, numbers are emitted in their
    /// natural decimal form.
    public func canonicalJSONData() throws -> Data {
        var out = String()
        out.reserveCapacity(1024)
        try writeCanonical(into: &out)
        return Data(out.utf8)
    }

    /// String convenience wrapper around `canonicalJSONData`.
    public func canonicalJSONString() throws -> String {
        try String(decoding: canonicalJSONData(), as: UTF8.self)
    }

    private func writeCanonical(into out: inout String) throws {
        switch self {
        case .null:
            out.append("null")
        case .bool(let b):
            out.append(b ? "true" : "false")
        case .number(.integer(let i)):
            out.append(String(i))
        case .number(.decimal(let d)):
            out.append(canonicalDecimalString(d))
        case .string(let s):
            out.append(canonicalEscapedString(s))
        case .array(let xs):
            out.append("[")
            for (idx, x) in xs.enumerated() {
                if idx > 0 { out.append(",") }
                try x.writeCanonical(into: &out)
            }
            out.append("]")
        case .object(let obj):
            out.append("{")
            // Sort by key on emit; OrderedJSONObject.canonicalized()
            // already gives us a stable order but we re-sort defensively
            // in case the caller hand-built one out of order.
            let sorted = obj.canonicalized()
            for (idx, e) in sorted.entries.enumerated() {
                if idx > 0 { out.append(",") }
                out.append(canonicalEscapedString(e.key))
                out.append(":")
                try e.value.writeCanonical(into: &out)
            }
            out.append("}")
        }
    }
}

/// Lexically escapes a JSON string per RFC-8259, matching the
/// TypeScript `JSON.stringify` behaviour for the subset of characters
/// IronPath actually uses (no control characters expected; UTF-8 is
/// emitted verbatim).
private func canonicalEscapedString(_ s: String) -> String {
    var out = String()
    out.reserveCapacity(s.count + 2)
    out.append("\"")
    for scalar in s.unicodeScalars {
        switch scalar {
        case "\"": out.append("\\\"")
        case "\\": out.append("\\\\")
        case "\n": out.append("\\n")
        case "\r": out.append("\\r")
        case "\t": out.append("\\t")
        case "\u{08}": out.append("\\b")
        case "\u{0C}": out.append("\\f")
        default:
            if scalar.value < 0x20 {
                out.append(String(format: "\\u%04x", scalar.value))
            } else {
                out.unicodeScalars.append(scalar)
            }
        }
    }
    out.append("\"")
    return out
}

/// Emits a `Decimal` in the shortest textual form that round-trips
/// through TypeScript's `JSON.stringify`. Trailing zeroes after the
/// decimal point are dropped (`1.500` → `1.5`); an integral decimal
/// emits without a decimal point (`42.0` → `42`). Negative zero is
/// emitted as `0`.
private func canonicalDecimalString(_ d: Decimal) -> String {
    if d.isZero {
        return "0"
    }
    var copy = d
    var rounded = Decimal()
    NSDecimalRound(&rounded, &copy, 0, .down)
    if rounded == d {
        // Integral value — emit without decimal point.
        return "\(rounded)"
    }
    // Non-integral — Foundation's default `Decimal.description`
    // already returns the shortest canonical form (e.g. `0.5`).
    return "\(d)"
}

// MARK: - Generic CodingKey helper

/// A `CodingKey` whose `stringValue` is whatever the caller provides.
/// Used by AppData / nested models to decode arbitrary key sets.
public struct GenericCodingKey: CodingKey, Equatable, Sendable {
    public let stringValue: String
    public let intValue: Int?

    public init(stringValue: String) {
        self.stringValue = stringValue
        self.intValue = nil
    }

    public init?(intValue: Int) {
        self.stringValue = String(intValue)
        self.intValue = intValue
    }

    public init(_ stringValue: String) {
        self.stringValue = stringValue
        self.intValue = nil
    }
}
