// AN-1b — roundToFixed ↔ JS `Number(x.toFixed(n))` cross-validation.
//
// Pins `AnalyticsSupport.roundToFixed` (the faithful ECMAScript
// `Number.prototype.toFixed` reproduction — see AnalyticsEngineSupport.swift) to JS
// ground truth, EXACTLY (`==`, not approximate). Each row's expected value is
// `Number(x.toFixed(digits))` computed by Node — the SAME call the three AN-1 analytics
// engines make for `deltaKg` / `deltaPercent` / `effectiveSets` / `share` — over a large
// batch of `.XX5` ties, IEEE-754-representation cases (`2.675` / `1.005` / `1.555` /
// `0.15` / `0.35` …), negatives, every digit width (0…3), near-integer carries, and the
// realistic deltaPercent / share intervals these engines actually produce.
//
// This is the AN-1b regression net: the earlier `(value * p).rounded() / p` got many of
// these WRONG (`2.675`→`2.68`, `0.15`→`0.2`, `0.35`→`0.4`, `1.555`→`1.56`, `-2.675`→
// `-2.68`) because the multiply crosses a `.5` boundary the true value sits below;
// `toFixed` rounds the EXACT double. Any regression back to a multiply-then-round
// approximation re-breaks at least one row here.
//
// Ground truth (regenerate if the table is ever extended):
//   node -e 'for (const [x,d] of CASES) console.log(x, d, Number(x.toFixed(d)))'
// PURE — no clock, no IO.

import XCTest
@testable import IronPathTrainingDecision

final class AnalyticsRoundToFixedCrossValidationTests: XCTestCase {

    // (value, digits, `Number(value.toFixed(digits))` — JS ground truth).
    private static let cases: [(value: Double, digits: Int, expected: Double)] = [
        // core `.XX5` ties + IEEE-754-representation cases
        (2.675, 2, 2.67),
        (1.005, 2, 1),
        (0.5, 0, 1),
        (2.5, 0, 3),
        (1.5, 0, 2),
        (0.25, 1, 0.3),
        (0.125, 2, 0.13),
        (12.345, 2, 12.35),
        (100.5, 0, 101),
        (1.255, 2, 1.25),
        (1.555, 2, 1.55),
        (2.345, 2, 2.35),
        (8.605, 2, 8.61),
        (1.115, 2, 1.11),
        (0.05, 1, 0.1),
        (0.15, 1, 0.1),
        (0.35, 1, 0.3),
        (0.45, 1, 0.5),
        (0.55, 1, 0.6),
        (0.65, 1, 0.7),
        (0.75, 1, 0.8),
        (0.85, 1, 0.8),
        (0.95, 1, 0.9),
        // negatives — sign split off, round-half-away on the magnitude
        (-2.675, 2, -2.67),
        (-1.005, 2, -1),
        (-0.5, 0, -1),
        (-2.5, 0, -3),
        (-0.125, 2, -0.13),
        (-0.15, 1, -0.1),
        (-0.35, 1, -0.3),
        (-12.345, 2, -12.35),
        // multiple digit widths on the same value
        (2.675, 0, 3),
        (2.675, 1, 2.7),
        (2.675, 3, 2.675),
        (3.14159, 2, 3.14),
        (2.71828, 3, 2.718),
        (1234.5678, 2, 1234.57),
        // exact-terminating + near-integer carries
        (0, 2, 0),
        (0, 0, 0),
        (10, 2, 10),
        (0.999, 2, 1),
        (0.9999, 2, 1),
        (99.95, 1, 100),
        (9.995, 2, 9.99),
        (0.005, 2, 0.01),
        // realistic deltaPercent = ((cur - prev) / prev * 100).toFixed(1)
        (5, 1, 5),
        (-5, 1, -5),
        (12.5, 1, 12.5),
        (-12.5, 1, -12.5),
        (2.5641025641, 1, 2.6),
        (14.2857142857, 1, 14.3),
        (28.5714285714, 1, 28.6),
        (33.3333333333, 1, 33.3),
        (66.6666666667, 1, 66.7),
        (16.6666666667, 1, 16.7),
        (7.6923076923, 1, 7.7),
        (-3.8461538462, 1, -3.8),
        // realistic share = (effectiveSets / total * 100).toFixed(1)
        (62.5, 1, 62.5),
        (37.5, 1, 37.5),
        (99.8130841121, 1, 99.8),
        (18.75, 1, 18.8),
        (6.25, 1, 6.3),
        (43.75, 1, 43.8),
        // realistic effectiveSets / totalEffectiveSets = sum.toFixed(2)
        (6.2, 2, 6.2),
        (3.8, 2, 3.8),
        (2.675, 2, 2.67),
        (4.5, 2, 4.5),
        (7.005, 2, 7),
        (13.335, 2, 13.34),
    ]

    /// Every row: the ported `roundToFixed` equals JS `Number(value.toFixed(digits))`
    /// EXACTLY (`XCTAssertEqual` on `Double` is bit-equality, not approximate).
    func testRoundToFixedMatchesJsToFixedExactly() {
        for (value, digits, expected) in Self.cases {
            let got = AnalyticsSupport.roundToFixed(value, digits)
            XCTAssertEqual(
                got, expected,
                "roundToFixed(\(value), \(digits)) = \(got), expected Number((\(value)).toFixed(\(digits))) = \(expected)"
            )
        }
    }

    /// Spot-pin the headline regressions the multiply-then-round path got wrong, so the
    /// intent is legible even if the bulk table is ever trimmed: `2.675`→`2.67` (not
    /// `2.68`), `0.15`→`0.1` (not `0.2`), `-2.675`→`-2.67` (not `-2.68`).
    func testRoundToFixedRejectsMultiplyThenRoundDivergences() {
        XCTAssertEqual(AnalyticsSupport.roundToFixed(2.675, 2), 2.67)
        XCTAssertEqual(AnalyticsSupport.roundToFixed(0.15, 1), 0.1)
        XCTAssertEqual(AnalyticsSupport.roundToFixed(0.35, 1), 0.3)
        XCTAssertEqual(AnalyticsSupport.roundToFixed(1.555, 2), 1.55)
        XCTAssertEqual(AnalyticsSupport.roundToFixed(-2.675, 2), -2.67)
    }
}
