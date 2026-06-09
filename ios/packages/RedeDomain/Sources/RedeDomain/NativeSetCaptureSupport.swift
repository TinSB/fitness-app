// NativeSetCaptureSupport — iOS-17b Native Per-Set Capture V1.
//
// Pure, stateless support for the native Focus set-capture slice (iOS-17b):
//   * WeightConversion       — display-unit <-> kilogram conversion.
//   * ActualSetDraftFactory  — build an ActualSetDraft for one captured set.
//
// Storage is ALWAYS kilograms (the WeightUnit / UnitSettings contract: "Storage
// is always kilograms"); the capture view enters weight in a display unit and
// these helpers convert to kg before it is recorded into an existing
// RedeDomain.ActualSetDraft. 100% pure value logic — NO FileManager, NO
// disk, NO network, NO cloud, NO AppData read/write, NO clock. It USES the
// already-typed ActualSetDraft via its public init; it does NOT modify
// ActualSetDraft / TrainingSetLog / TrainingSession. Nothing here persists
// anything — the canonical-AppData write path is the deferred iOS-17c slice.

import Foundation

/// Pure display-unit <-> kilogram conversion. kg is the storage unit; the
/// capture UI enters a display unit and stores kg, so this is the single place
/// the conversion lives (no unit drift). Stateless; no IO.
public enum WeightConversion {
    /// Exact kilograms-per-pound factor (NIST 1959 international pound). Used in
    /// both directions so a kg→lb→kg round trip is stable.
    public static let kilogramsPerPound: Double = 0.45359237

    /// Convert a value entered in `displayUnit` to kilograms (the storage unit).
    /// `.kg` is identity; `.lb` multiplies by the kg/lb factor. A nil input maps
    /// to nil so "no weight entered" stays "no weight" — never a fabricated 0.
    public static func toKilograms(_ value: Double?, from displayUnit: WeightUnit) -> Double? {
        guard let value else { return nil }
        switch displayUnit {
        case .kg: return value
        case .lb: return value * kilogramsPerPound
        }
    }

    /// Convert a kilogram value to `displayUnit` for presentation. `.kg` is
    /// identity; `.lb` divides by the kg/lb factor. A nil input maps to nil.
    public static func fromKilograms(_ kilograms: Double?, to displayUnit: WeightUnit) -> Double? {
        guard let kilograms else { return nil }
        switch displayUnit {
        case .kg: return kilograms
        case .lb: return kilograms / kilogramsPerPound
        }
    }
}

/// Pure factory for an in-RAM captured `ActualSetDraft`. Uses the existing
/// RedeDomain type's public init — it does not modify the model. Lives in
/// the Domain package (the owner of `ActualSetDraft`) so it can carry real unit
/// tests; the app view-model calls it. No clock/IO here — `completedAtIso` is
/// supplied by the caller (the view-model's injectable, deterministic clock).
public enum ActualSetDraftFactory {
    /// Build a draft for a just-completed set. `priorCompletedCount` is how many
    /// sets were already completed for this exercise, so the new set's 0-based
    /// `setIndex` equals it (sets captured in order get 0, 1, 2, …). `weightKg`
    /// is ALREADY kilograms (convert via `WeightConversion` first). Any blank
    /// field stays nil — honest "not entered", never a fabricated value. Weight
    /// is stored in kg only (no display unit leaks into storage).
    public static func capturedDraft(
        priorCompletedCount: Int,
        weightKg: Double?,
        reps: Int?,
        rir: Int?,
        exerciseId: String,
        source: String,
        completedAtIso: String
    ) -> ActualSetDraft {
        ActualSetDraft(
            setIndex: .integer(Int64(priorCompletedCount)),
            weight: weightKg.map(Self.weightNumber),
            reps: reps.map { .integer(Int64($0)) },
            rir: rir.map { .number(.integer(Int64($0))) },
            exerciseId: exerciseId,
            source: source,
            completedAt: completedAtIso
        )
    }

    /// Represent a kg weight as the `NumberRepr` case that canonical-emits like
    /// legacy web schema `JSON.stringify`: a whole value collapses to `.integer` ("60", not
    /// "60.0"); a fractional value stays `.double` ("62.5"). Mirrors how
    /// `JSONValue(fromFoundation:)` ingests parsed numbers, so a captured weight
    /// round-trips byte-identically to one decoded from JSON.
    static func weightNumber(_ kg: Double) -> NumberRepr {
        if kg.isFinite, kg.truncatingRemainder(dividingBy: 1) == 0,
           kg >= Double(Int64.min), kg <= Double(Int64.max) {
            return .integer(Int64(kg))
        }
        return .double(kg)
    }
}
