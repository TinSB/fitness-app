// NativeSetCaptureSupportTests — iOS-17b Native Per-Set Capture V1.
//
// REAL unit tests for the pure capture support: WeightConversion (display-unit
// <-> kg) and ActualSetDraftFactory (building an ActualSetDraft for one captured
// set). Run via `swift test`. Deterministic; never touches disk/AppData/network.

import XCTest
@testable import RedeDomain

final class NativeSetCaptureSupportTests: XCTestCase {

    // MARK: - WeightConversion

    func testKilogramIsIdentity() throws {
        // Unwrap first: NumberRepr/Double? compared to a bare literal won't unify.
        XCTAssertEqual(try XCTUnwrap(WeightConversion.toKilograms(60, from: .kg)), 60)
        XCTAssertEqual(try XCTUnwrap(WeightConversion.fromKilograms(60, to: .kg)), 60)
    }

    func testPoundConvertsToKilograms() {
        // 100 lb = 45.359237 kg (exact factor).
        let kg = WeightConversion.toKilograms(100, from: .lb)
        XCTAssertNotNil(kg)
        XCTAssertEqual(kg!, 45.359237, accuracy: 1e-9)
    }

    func testKilogramsConvertToPounds() {
        let lb = WeightConversion.fromKilograms(45.359237, to: .lb)
        XCTAssertNotNil(lb)
        XCTAssertEqual(lb!, 100, accuracy: 1e-9)
    }

    func testPoundRoundTripIsStable() {
        let original = 137.5
        let kg = WeightConversion.toKilograms(original, from: .lb)
        let back = WeightConversion.fromKilograms(kg, to: .lb)
        XCTAssertNotNil(back)
        XCTAssertEqual(back!, original, accuracy: 1e-9)
    }

    func testNilWeightStaysNil() {
        XCTAssertNil(WeightConversion.toKilograms(nil, from: .kg))
        XCTAssertNil(WeightConversion.toKilograms(nil, from: .lb))
        XCTAssertNil(WeightConversion.fromKilograms(nil, to: .lb))
    }

    // MARK: - ActualSetDraftFactory

    func testDraftStoresWeightInKilograms() throws {
        // Enter 100 in lb -> the draft must store kg (45.359237), never 100.
        let kg = WeightConversion.toKilograms(100, from: .lb)
        let draft = ActualSetDraftFactory.capturedDraft(
            priorCompletedCount: 0, weightKg: kg, reps: 5, rir: 2,
            exerciseId: "bench", source: "local-ios-focus-mvp",
            completedAtIso: "2026-05-27T10:00:00.000Z"
        )
        // NumberRepr.doubleValue is non-optional; unwrap the optional `weight` first.
        let storedKg = try XCTUnwrap(draft.weight).doubleValue
        XCTAssertEqual(storedKg, 45.359237, accuracy: 1e-9)
        XCTAssertNotEqual(storedKg, 100, "display-unit value must never be stored")
        XCTAssertEqual(draft.reps?.intValue, 5)
        XCTAssertEqual(draft.rir, .number(.integer(2)))
        XCTAssertEqual(draft.exerciseId, "bench")
        XCTAssertEqual(draft.source, "local-ios-focus-mvp")
        XCTAssertEqual(draft.completedAt, "2026-05-27T10:00:00.000Z")
    }

    func testDraftSetIndexEqualsPriorCount() {
        // Sets captured in order get 0-based setIndex 0, 1, 2 from the running count.
        for prior in 0..<3 {
            let draft = ActualSetDraftFactory.capturedDraft(
                priorCompletedCount: prior, weightKg: 50, reps: 5, rir: 1,
                exerciseId: "squat", source: "local-ios-focus-mvp",
                completedAtIso: "2026-05-27T10:00:00.000Z"
            )
            XCTAssertEqual(draft.setIndex?.intValue, prior)
        }
    }

    func testDraftBlankFieldsStayNilHonestly() {
        // User skipped weight/reps/rir but still completed the set -> nil, not 0.
        let draft = ActualSetDraftFactory.capturedDraft(
            priorCompletedCount: 1, weightKg: nil, reps: nil, rir: nil,
            exerciseId: "row", source: "local-ios-focus-mvp",
            completedAtIso: "2026-05-27T10:00:00.000Z"
        )
        XCTAssertNil(draft.weight)
        XCTAssertNil(draft.reps)
        XCTAssertNil(draft.rir)
        XCTAssertEqual(draft.setIndex?.intValue, 1)   // count still advances
        XCTAssertEqual(draft.exerciseId, "row")
    }

    func testDraftRoundTripsThroughExistingModel() {
        // The factory output is a normal ActualSetDraft -> decode(encode()) == it.
        let draft = ActualSetDraftFactory.capturedDraft(
            priorCompletedCount: 2, weightKg: 42.5, reps: 8, rir: 3,
            exerciseId: "ohp", source: "local-ios-focus-mvp",
            completedAtIso: "2026-05-27T10:00:00.000Z"
        )
        let reDecoded = try? ActualSetDraft(decoding: draft.encoded())
        XCTAssertEqual(reDecoded, draft)
    }

    func testWholeKilogramWeightCanonicalEmitsWithoutTrailingDecimal() throws {
        // A whole kg weight must canonical-emit as "60", not "60.0" (legacy web schema parity).
        let draft = ActualSetDraftFactory.capturedDraft(
            priorCompletedCount: 0, weightKg: 60, reps: nil, rir: nil,
            exerciseId: "bench", source: "s", completedAtIso: "t"
        )
        let canonical = try draft.encoded().canonicalJSONString()
        XCTAssertTrue(canonical.contains("\"weight\":60"), "got: \(canonical)")
        XCTAssertFalse(canonical.contains("60.0"), "whole kg must not emit a trailing .0")
    }

    func testFractionalKilogramWeightCanonicalEmitsDecimal() throws {
        // A fractional kg weight (e.g. 2.5 kg plate) keeps its decimal form.
        let draft = ActualSetDraftFactory.capturedDraft(
            priorCompletedCount: 0, weightKg: 62.5, reps: nil, rir: nil,
            exerciseId: "bench", source: "s", completedAtIso: "t"
        )
        let canonical = try draft.encoded().canonicalJSONString()
        XCTAssertTrue(canonical.contains("\"weight\":62.5"), "got: \(canonical)")
    }
}
