// CC-0 — sortDataHealthIssues parity tests (coachAction-foundation slice).
//
// FUNCTION-LEVEL compute-assert: for the `data-health/sort-issues-cases-v1`
// golden, decode each case's echoed `issues`, run the PORTED
// `DataHealthEngine.sortDataHealthIssues` on the SAME input, and assert the
// produced order equals the golden case's `result` array element-by-element
// (DataHealthIssue is Equatable, so this is full-struct equality across id /
// severity / category / title / message / affectedIds / canAutoFix /
// suggestedAction).
//
// The golden is GENERATED from the REAL legacy web schema `sortDataHealthIssues`
// (frozen legacy fixture generator), never hand-edited (§22). PURE /
// read-only — zero `: Date`, no IO beyond reading the committed golden.

import XCTest
import RedeDomain
import RedeDataHealth

final class DataHealthIssueSortingParityTests: XCTestCase {

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // RedeDataHealthTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // RedeDataHealth/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private static var goldenURL: URL {
        repoRoot.appendingPathComponent(
            "ios/ParityFixtures/parity/golden/data-health/sort-issues-cases-v1.json", isDirectory: false
        )
    }

    private func root() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL)
        guard let obj = try JSONValue(decoding: data).objectValue else {
            throw DataHealthDecodeError.notAnObject(context: "golden root")
        }
        return obj
    }

    private func issues(_ c: OrderedJSONObject, _ key: String) throws -> [DataHealthIssue] {
        try (c[key]?.arrayValue ?? []).map { try DataHealthIssue(decoding: $0, context: key) }
    }

    func testGoldenEnvelope() throws {
        XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL.path), "missing sort-issues golden")
        let root = try root()
        XCTAssertEqual(root["sourceFixtureId"]?.stringValue, "data-health/sort-issues-cases-v1")
        XCTAssertGreaterThanOrEqual((root["cases"]?.arrayValue ?? []).count, 7, "expected the 7 sort cases")
    }

    func testSortDataHealthIssuesParityForEveryCase() throws {
        let root = try root()
        let cases = root["cases"]?.arrayValue ?? []
        XCTAssertFalse(cases.isEmpty, "no cases")
        for caseValue in cases {
            guard let c = caseValue.objectValue else { XCTFail("case not an object"); continue }
            let label = c["label"]?.stringValue ?? "(unlabeled)"

            let input = try issues(c, "issues")
            let expected = try issues(c, "result")
            let actual = DataHealthEngine.sortDataHealthIssues(input)

            XCTAssertEqual(
                actual, expected,
                "data-health/\(label): sortDataHealthIssues order mismatch — got \(actual.map(\.id)) expected \(expected.map(\.id))"
            )
        }
    }
}
