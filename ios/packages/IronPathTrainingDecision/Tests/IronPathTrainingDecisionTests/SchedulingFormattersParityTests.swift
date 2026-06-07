// SC-0 — scheduling-track formatter parity tests (formatTrainingMode).
//
// BRANCH-LEVEL compute-assert: for the `i18n/training-mode-cases-v1` golden, (1) reconcile
// the ported `SchedulingFormatters.trainingModeLabels` table against the golden's
// reconstructed TRAINING_MODE_LABELS entry-by-entry, and (2) re-run the PORTED
// `SchedulingFormatters.formatTrainingMode` on each probe input and assert it equals the
// golden's `expected` (map hit / lowercase-normalize / already-CJK as-is / CJK non-label
// fallback / unknown non-CJK → 未知状态 / '' → 未知状态).
//
// The golden is GENERATED from the retired legacy formatTrainingMode
// (frozen legacy fixture generator), never hand-edited (§22). PURE / read-only — no
// clock, zero `: Date`, no IO beyond reading the committed golden.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class SchedulingFormattersParityTests: XCTestCase {

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private static var goldenURL: URL {
        repoRoot.appendingPathComponent(
            "ios/ParityFixtures/parity/golden/i18n/training-mode-cases-v1.json", isDirectory: false
        )
    }

    private func root() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL)
        return try JSONValue(decoding: data).requireObject("i18n/training-mode-cases-v1")
    }

    func testGoldenEnvelope() throws {
        XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL.path), "missing training-mode golden")
        let root = try root()
        XCTAssertEqual(root.optionalObject("parityGolden")?.optionalString("sourceFixtureId"),
                       "i18n/training-mode-cases-v1")
        XCTAssertEqual(root.optionalObject("counts")?.optionalInt("trainingModeLabels"), 3)
    }

    /// The ported TRAINING_MODE_LABELS table reconciles against the golden entry-by-entry.
    func testTrainingModeLabelsTableMatchesGolden() throws {
        let root = try root()
        let table = try XCTUnwrap(root.optionalObject("tables")?.optionalObject("trainingModeLabels"),
                                  "no trainingModeLabels table")
        var golden: [String: String] = [:]
        for entry in table.entries {
            golden[entry.key] = try XCTUnwrap(entry.value.stringValue, "\(entry.key) not a string")
        }
        XCTAssertEqual(SchedulingFormatters.trainingModeLabels, golden,
                       "ported trainingModeLabels diverged from golden")
    }

    /// Every probe input reproduces the golden's expected output through the ported formatter.
    func testFormatTrainingModeParityForEveryProbe() throws {
        let root = try root()
        let probes = try XCTUnwrap(root.optionalObject("probes")?.optionalArray("formatTrainingMode"),
                                   "no formatTrainingMode probes")
        XCTAssertFalse(probes.isEmpty, "no probes")
        for probe in probes {
            let obj = try XCTUnwrap(probe.objectValue, "probe not an object")
            let input = try XCTUnwrap(obj.optionalString("input"), "probe missing input")
            let expected = try XCTUnwrap(obj.optionalString("expected"), "probe missing expected")
            XCTAssertEqual(SchedulingFormatters.formatTrainingMode(input), expected,
                           "formatTrainingMode(\(input)) mismatch")
        }
    }
}
