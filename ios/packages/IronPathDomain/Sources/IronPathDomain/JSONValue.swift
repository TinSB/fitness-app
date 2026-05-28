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
    /// Integer-valued numbers, matches TS `JSON.stringify(42)` → `"42"`.
    case integer(Int64)
    /// Non-integer numbers parsed from JSON. V1 default — matches the
    /// IEEE-754 Double-text round-trip semantics of TS `JSON.stringify`,
    /// avoiding `Decimal`'s expansion of `72.6` → `72.59999999999999`.
    case double(Double)
    /// Hand-built high-precision numbers (e.g. tests asserting that
    /// a literal `Decimal(string: "3.14")` round-trips as `"3.14"`).
    /// Not produced by JSON parsing in V1; reserved for V2 escalation.
    case decimal(Decimal)

    /// Returns the underlying value as `Int` when representable.
    public var intValue: Int? {
        switch self {
        case .integer(let i):
            return Int(exactly: i)
        case .double(let d):
            if d.isFinite, d.truncatingRemainder(dividingBy: 1) == 0,
               d >= Double(Int.min), d <= Double(Int.max) {
                return Int(d)
            }
            return nil
        case .decimal(let d):
            var rounded = Decimal()
            var copy = d
            NSDecimalRound(&rounded, &copy, 0, .down)
            if rounded == d {
                return NSDecimalNumber(decimal: rounded).intValue
            }
            return nil
        }
    }

    /// Returns the underlying value as `Double`.
    public var doubleValue: Double {
        switch self {
        case .integer(let i): return Double(i)
        case .double(let d): return d
        case .decimal(let d): return NSDecimalNumber(decimal: d).doubleValue
        }
    }
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
    /// using the canonical-emit key order (case-insensitive primary,
    /// code-point tie-break). Mirrors TypeScript's `localeCompare`
    /// default-locale behaviour at
    /// `src/cloudProduction/accountBoundaryLocalInventory.ts:116`.
    public func canonicalized() -> OrderedJSONObject {
        OrderedJSONObject(entries: entries.sorted {
            canonicalKeyOrder($0.key, $1.key)
        })
    }
}

/// Canonical-emit key comparator. TS-side `stableStringify` uses
/// `String.prototype.localeCompare()` which in Node default-locale
/// performs a case-insensitive primary comparison with code-point
/// tie-break. Swift's `String.<` is strict Unicode-code-point order,
/// so e.g. it sorts `"prIndependent"` before `"prescription"` (capital
/// `I` at U+0049 precedes lowercase `e` at U+0065). To reproduce the
/// TS order, we lowercase both keys for the primary pass and break
/// ties with raw `<`.
public func canonicalKeyOrder(_ a: String, _ b: String) -> Bool {
    let al = a.lowercased()
    let bl = b.lowercased()
    if al != bl { return al < bl }
    return a < b
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
            // JSON-parsed floats land in `.double` so canonical emit
            // matches TS `JSON.stringify` (`72.6` → `"72.6"`, not the
            // Decimal binary expansion `72.59999999999999`).
            self = .number(.double(d))
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
        case .number(.double(let d)):
            out.append(canonicalDoubleString(d))
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

/// Emits a `Double` in the shortest textual form that round-trips
/// through TypeScript's `JSON.stringify`. Swift's `String(Double)`
/// uses the IEEE-754 short-round-trip algorithm, matching Node /
/// V8's `Number.prototype.toString` output exactly.
private func canonicalDoubleString(_ d: Double) -> String {
    if d.isZero { return "0" }
    if d.isFinite, d.truncatingRemainder(dividingBy: 1) == 0,
       d >= Double(Int64.min), d <= Double(Int64.max) {
        // Defensive: integer-valued doubles collapse to integer text,
        // matching TS's collapse `42.0 → "42"`.
        return String(Int64(d))
    }
    return String(d)
}

/// Emits a `Decimal` in its hand-precision form. Reserved for V2
/// escalation when JSON-parsed Doubles aren't precise enough.
/// Used by the open-bag tests when manually building
/// `NumberRepr.decimal(Decimal(string: …))`.
private func canonicalDecimalString(_ d: Decimal) -> String {
    if d.isZero {
        return "0"
    }
    var copy = d
    var rounded = Decimal()
    NSDecimalRound(&rounded, &copy, 0, .down)
    if rounded == d {
        return "\(rounded)"
    }
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

// MARK: - iOS-2C — Typed-field convenience accessors
//
// Every iOS-2C model that promotes documented fields out of `_unknown`
// uses these accessors to keep its `init(decoding:)` readable. The
// pattern is: `let id = obj["id"]?.stringValue` rather than a manual
// switch on each JSONValue case.
//
// Accessors are intentionally narrow:
//   * They DO NOT cross types (e.g. `stringValue` does not coerce
//     `.bool(true)` → `"true"`); the underlying JSON shape must match
//     the documented schema. Cross-type mismatches return `nil`.
//   * They DO NOT mutate `_unknown` — the typed model's decode path
//     manages the documented-key set separately.

extension JSONValue {
    /// Returns the underlying `String` if the case is `.string`; nil otherwise.
    public var stringValue: String? {
        if case .string(let s) = self { return s }
        return nil
    }

    /// Returns the underlying `Bool` if the case is `.bool`; nil otherwise.
    public var boolValue: Bool? {
        if case .bool(let b) = self { return b }
        return nil
    }

    /// Returns the underlying `Int` for integer-valued numeric cases.
    public var intValue: Int? {
        switch self {
        case .number(.integer(let i)):
            return Int(exactly: i)
        case .number(.double(let d)):
            if d.isFinite, d.truncatingRemainder(dividingBy: 1) == 0,
               d >= Double(Int.min), d <= Double(Int.max) {
                return Int(d)
            }
            return nil
        case .number(.decimal(let d)):
            var rounded = Decimal()
            var copy = d
            NSDecimalRound(&rounded, &copy, 0, .down)
            if rounded == d {
                return NSDecimalNumber(decimal: rounded).intValue
            }
            return nil
        default:
            return nil
        }
    }

    /// Returns the underlying `Double` if the case is numeric; nil otherwise.
    public var doubleValue: Double? {
        switch self {
        case .number(.integer(let i)):
            return Double(i)
        case .number(.double(let d)):
            return d
        case .number(.decimal(let d)):
            return NSDecimalNumber(decimal: d).doubleValue
        default:
            return nil
        }
    }

    /// Returns the underlying `Decimal` if the case is numeric; nil otherwise.
    public var decimalValue: Decimal? {
        switch self {
        case .number(.integer(let i)):
            return Decimal(i)
        case .number(.double(let d)):
            return Decimal(d)
        case .number(.decimal(let d)):
            return d
        default:
            return nil
        }
    }

    /// Returns the underlying `NumberRepr` if the case is numeric; nil otherwise.
    public var numberValue: NumberRepr? {
        if case .number(let n) = self { return n }
        return nil
    }

    /// Returns the underlying `OrderedJSONObject` if the case is `.object`; nil otherwise.
    public var objectValue: OrderedJSONObject? {
        if case .object(let o) = self { return o }
        return nil
    }

    /// Returns the underlying `[JSONValue]` if the case is `.array`; nil otherwise.
    public var arrayValue: [JSONValue]? {
        if case .array(let a) = self { return a }
        return nil
    }

    /// True if this value is `.null`.
    public var isNull: Bool {
        if case .null = self { return true }
        return false
    }

    /// Encode helper for emitting a typed Int as a JSON integer.
    public static func intLiteral(_ i: Int) -> JSONValue {
        .number(.integer(Int64(i)))
    }
}

// MARK: - OrderedJSONObject convenience

extension OrderedJSONObject {
    /// Returns a new `OrderedJSONObject` whose entries are the
    /// receiver's entries with documented keys removed. Used by typed
    /// models to build their `_unknown` carrier without mutating the
    /// original.
    public func withoutKeys(_ excluded: Set<String>) -> OrderedJSONObject {
        OrderedJSONObject(entries: entries.filter { !excluded.contains($0.key) })
    }

    /// Returns a new `OrderedJSONObject` formed by appending the given
    /// entries to the receiver. Used by typed `encoded()` helpers
    /// when re-merging typed fields with the `_unknown` carrier.
    public func appending(_ added: [Entry]) -> OrderedJSONObject {
        OrderedJSONObject(entries: entries + added)
    }
}
