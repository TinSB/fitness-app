// EngineValueUtils — PA-S2 engineUtils value-type helper subset V1.
//
// Faithful Swift port of the PURE value-type helper from
// `retired web reference` that the PA (Plan-Adaptive) engine cluster
// (programAdjustmentEngine / exercisePrescriptionEngine / systemConsistencyEngine,
// ported S3+) consumes:
//
//   * `clone` (engineUtils.ts:28): `JSON.parse(JSON.stringify(value))`.
//
// The OTHER two engineUtils helpers this PA-S2 slice covers are already ported
// and are NOT re-defined here (reuse, never re-port):
//   * `number` (engineUtils.ts:38) → `E1RMEngine.number` (E1RMEngine.swift:70/74),
//     shared by AdaptiveFeedbackEngine / AnalyticsSupport. (TrainingDecision pkg;
//     unreachable from Domain — `clone` below does NOT need it, see the
//     non-finite→null note, so no byte-identical Domain copy is added.)
//   * `getPrimaryMuscles` (engineUtils.ts:207) → `AnalyticsSupport.getPrimaryMuscles`
//     (TrainingDecision pkg) + the typed `EngineUtils.getPrimaryMuscles(ExerciseTemplate)`
//     overload added alongside the enrichExercise port.
//
// PURE: zero write path, zero `: Date` (no wall clock), zero IO, zero randomness.

import Foundation

public enum EngineValueUtils {

    /// `clone` (engineUtils.ts:28): `JSON.parse(JSON.stringify(value))`.
    ///
    /// In legacy web implementation this is a structural deep copy whose ONLY observable
    /// transforms (beyond duplicating the reference graph) come from the JSON
    /// round-trip itself:
    ///   1. `undefined` values / functions are dropped from objects, and become
    ///      `null` inside arrays;
    ///   2. non-finite numbers (`NaN` / `±Infinity`) serialize as `null`;
    ///   3. key insertion order is preserved (JS objects + `JSON.parse` keep it).
    ///
    /// Swift's `JSONValue` is a value type, so the "deep copy" is automatic by
    /// assignment — there is no shared mutable reference graph to duplicate (this
    /// is the documented Swift-value-semantics difference from the JS double-jump).
    /// `JSONValue` also cannot REPRESENT `undefined` or functions, so transform (1)
    /// is vacuous on a `JSONValue` tree. The single transform that remains
    /// observable is (2): a hand-built `NumberRepr.double(NaN/±Infinity)` (JSON
    /// parsing never produces one) collapses to `.null`, exactly as
    /// `JSON.stringify` would emit. Key order (3) is preserved verbatim because
    /// `OrderedJSONObject.entries` is order-bearing and we map it in place.
    public static func clone(_ value: JSONValue) -> JSONValue {
        switch value {
        case .null, .bool, .string:
            return value
        case .number(let n):
            // `JSON.stringify(NaN) === "null"`, `JSON.stringify(Infinity) === "null"`;
            // every other numeric case round-trips unchanged. `.integer` / `.decimal`
            // are always finite, so only a non-finite `.double` collapses to null.
            if case .double(let d) = n, !d.isFinite { return .null }
            return value
        case .array(let xs):
            // Array elements round-trip element-by-element (order preserved). A JS
            // `undefined`/function element would become `null`, but `JSONValue`
            // cannot hold either, so this is a faithful recursive copy.
            return .array(xs.map { clone($0) })
        case .object(let obj):
            // Object entries round-trip key-by-key with insertion order preserved
            // (JS object key order survives `JSON.parse(JSON.stringify(...))`).
            return .object(OrderedJSONObject(
                entries: obj.entries.map { OrderedJSONObject.Entry(key: $0.key, value: clone($0.value)) }
            ))
        }
    }
}
