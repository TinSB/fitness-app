// PA-S7 (PA-1a) — programAdjustmentEngine minimal-port parity tests.
//
// FUNCTION-LEVEL compute-assert over the two `program-adjust/*` goldens: for each
// case, decode the echoed engineInput, run the PORTED ProgramAdjustmentEngine on the
// SAME inputs, and assert the produced output equals the golden —
//   hash-cases     → hashProgramTemplate string EXACT `==` (TrainingTemplate +
//                    ProgramTemplate overloads / Chinese name+note UTF-16 boundary /
//                    nested array+object key sort / empty template / number text),
//   rollback-cases → restoredTemplateId EXACT `==`, restoredProgramTemplate canonical-
//                    equality (or nil), and updatedHistoryItem canonical-equality (the
//                    {...spread, status:'rolled_back', rollbackAvailable:false,
//                    rolledBackAt:<injected now>} override + open-bag passthrough).
//
// The goldens are GENERATED from the REAL TS programAdjustmentEngine
// (scripts/generate-parity-goldens.mjs), never hand-edited (§22). PURE / read-only —
// zero `: Date`; the only time input is the INJECTED `now` decoded from each rollback
// case (no wall clock), no IO beyond reading the committed goldens.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class ProgramAdjustmentEngineParityTests: XCTestCase {

    private typealias Engine = ProgramAdjustmentEngine

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private static func goldenURL(_ name: String) -> URL {
        repoRoot.appendingPathComponent(
            "tests/fixtures/parity/golden/program-adjust/\(name).json", isDirectory: false
        )
    }

    private func root(_ fixtureId: String, _ name: String) throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL(name))
        return try JSONValue(decoding: data).requireObject(fixtureId)
    }

    /// Canonical-equality of a computed `ProgramTemplate?` against the golden JSON value
    /// (or both absent/null). Both sides re-emit through the same JSONValue canonical
    /// form (sorted keys, integer-collapsed numbers), so `_unknown` open-bag ordering /
    /// number representation never matter.
    private func assertProgramTemplateCanonical(
        _ computed: ProgramTemplate?, _ goldenValue: JSONValue?, _ label: String
    ) throws {
        if let goldenValue, !goldenValue.isNull {
            let tpl = try XCTUnwrap(computed, "\(label): expected a restored ProgramTemplate")
            XCTAssertEqual(
                try tpl.encoded().canonicalJSONString(),
                try goldenValue.canonicalJSONString(),
                "\(label): restoredProgramTemplate canonical mismatch"
            )
        } else {
            XCTAssertNil(computed, "\(label): expected no restoredProgramTemplate")
        }
    }

    // MARK: - envelopes

    func testGoldenEnvelopes() throws {
        let names = ["hash-cases-v1", "rollback-cases-v1", "hash-fold-cases-v1"]
        for name in names {
            XCTAssertTrue(
                FileManager.default.fileExists(atPath: Self.goldenURL(name).path),
                "missing program-adjust golden: \(name)"
            )
            let id = "program-adjust/\(name)"
            XCTAssertEqual(try root(id, name).optionalString("sourceFixtureId"), id)
        }
    }

    // MARK: - hash-cases (hashProgramTemplate)

    func testHashCasesParity() throws {
        let fixtureId = "program-adjust/hash-cases-v1"
        let root = try root(fixtureId, "hash-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 7, "expected the declared hash cases")
        var emptyHashes: [String] = []
        for value in cases {
            let c = try value.requireObject("program-adjust hash case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "hash", "\(label): kind")
            let templateValue = try XCTUnwrap(c.rawValue("template"), "\(label): template")
            let golden = try XCTUnwrap(c.optionalString("hash"), "\(label): hash")
            let actual: String
            switch c.optionalString("templateKind") {
            case "training":
                actual = Engine.hashProgramTemplate(try TrainingTemplate(decoding: templateValue))
            case "program":
                actual = Engine.hashProgramTemplate(try ProgramTemplate(decoding: templateValue))
            case let other:
                XCTFail("\(label): unexpected templateKind \(other ?? "nil")")
                continue
            }
            XCTAssertEqual(actual, golden, "\(fixtureId)/\(label): hashProgramTemplate mismatch")
            if case .object(let obj) = templateValue, obj.isEmpty { emptyHashes.append(actual) }
        }
        // The empty-template cases (one per overload) must hash identically — both reduce
        // to stableStringify('{}'), independent of which typed projection decodes them.
        if emptyHashes.count >= 2 {
            XCTAssertEqual(Set(emptyHashes).count, 1, "empty template overloads must agree on the hash")
        }
    }

    // MARK: - hash-fold-cases (PA-FIX: keyOrderLess localeCompare case tie-break)

    /// Pins the S7 fidelity fix: for keys EQUAL once lowercased, stableStringify's
    /// localeCompare case tie-break sorts lower-before-upper (the inverse of §9
    /// canonicalKeyOrder's code-point tie-break). The golden is the REAL TS hash; a
    /// regressed keyOrderLess (code-point `<`) would byte-drift the serialization.
    func testHashFoldCasesParity() throws {
        let fixtureId = "program-adjust/hash-fold-cases-v1"
        let root = try root(fixtureId, "hash-fold-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 1, "expected the case-folding hash case")
        for value in cases {
            let c = try value.requireObject("program-adjust hash-fold case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "hash", "\(label): kind")
            let templateValue = try XCTUnwrap(c.rawValue("template"), "\(label): template")
            let golden = try XCTUnwrap(c.optionalString("hash"), "\(label): hash")
            let actual: String
            switch c.optionalString("templateKind") {
            case "training":
                actual = Engine.hashProgramTemplate(try TrainingTemplate(decoding: templateValue))
            case "program":
                actual = Engine.hashProgramTemplate(try ProgramTemplate(decoding: templateValue))
            case let other:
                XCTFail("\(label): unexpected templateKind \(other ?? "nil")")
                continue
            }
            XCTAssertEqual(actual, golden, "\(fixtureId)/\(label): hashProgramTemplate (case-fold) mismatch")
        }
    }

    // MARK: - rollback-cases (rollbackAdjustment)

    func testRollbackCasesParity() throws {
        let fixtureId = "program-adjust/rollback-cases-v1"
        let root = try root(fixtureId, "rollback-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 3, "expected the declared rollback cases")
        for value in cases {
            let c = try value.requireObject("program-adjust rollback case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "rollback", "\(label): kind")
            let item = try ProgramAdjustmentHistoryItem(decoding: try XCTUnwrap(c.rawValue("item"), "\(label): item"))
            // The injected clock — REQUIRED; the TS `new Date()` is never read by the port.
            let now = try XCTUnwrap(c.optionalString("now"), "\(label): now (injected clock required)")
            let result = Engine.rollbackAdjustment(item, nowIso: now)

            XCTAssertEqual(result.restoredTemplateId, c.optionalString("restoredTemplateId"), "\(label): restoredTemplateId")
            try assertProgramTemplateCanonical(result.restoredProgramTemplate, c.rawValue("restoredProgramTemplate"), label)

            let computedUpdated = try result.updatedHistoryItem.encoded().canonicalJSONString()
            let goldenUpdated = try XCTUnwrap(c.rawValue("updatedHistoryItem"), "\(label): updatedHistoryItem").canonicalJSONString()
            XCTAssertEqual(computedUpdated, goldenUpdated, "\(fixtureId)/\(label): updatedHistoryItem canonical mismatch")
        }
    }
}
