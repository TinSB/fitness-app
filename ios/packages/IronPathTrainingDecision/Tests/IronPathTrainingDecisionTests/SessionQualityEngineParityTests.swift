// AN-4 — sessionDetailSummaryEngine (sessionQuality-consumed subset) + sessionQualityEngine
// parity tests.
//
// FUNCTION-LEVEL compute-assert: for each `session-quality/*` golden, decode each case's echoed
// engineInput (session + optional effectiveSetSummary / loadFeedback / painPatterns), run the
// PORTED engines on the SAME inputs, and assert:
//   - SessionQualityEngine.buildSessionQualityResult == golden `result` (level / score / title /
//     summary / positives / issues / nextSuggestions / confidence — full struct `==`)
//   - SessionDetailSummaryEngine.groupSessionSetsByType == golden `grouped` probe (warmup /
//     working / uncategorized / support counts + per-group counts + the post-classification
//     `set.type` lists, nulls preserved)
//   - SessionDetailSummaryEngine.buildWorkingOnlySession == golden `workingOnly` probe (dataFlag
//     forced to normal / focusWarmup cleared / per-exercise set-type defaulting to straight).
//
// The goldens are GENERATED from the retired legacy engines (frozen legacy fixture generator),
// never hand-edited (§22). PURE / read-only — zero `: Date`, no IO beyond reading the committed
// golden.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class SessionQualityEngineParityTests: XCTestCase {

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private func goldenRoot(_ id: String) throws -> OrderedJSONObject {
        let url = Self.repoRoot.appendingPathComponent("ios/ParityFixtures/parity/golden/\(id).json", isDirectory: false)
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path), "missing golden \(id)")
        return try JSONValue(decoding: try Data(contentsOf: url)).requireObject(id)
    }

    // MARK: - decode helpers

    private func decodeSignal(_ o: OrderedJSONObject) -> SessionQualityEngine.SessionQualitySignal {
        SessionQualityEngine.SessionQualitySignal(
            id: o.optionalString("id") ?? "",
            label: o.optionalString("label") ?? "",
            tone: o.optionalString("tone") ?? "",
            reason: o.optionalString("reason") ?? ""
        )
    }

    private func decodeResult(_ o: OrderedJSONObject) -> SessionQualityEngine.SessionQualityResult {
        SessionQualityEngine.SessionQualityResult(
            level: o.optionalString("level") ?? "",
            score: o.optionalInt("score") ?? Int.min,
            title: o.optionalString("title") ?? "",
            summary: o.optionalString("summary") ?? "",
            positives: (o.optionalArray("positives") ?? []).compactMap { $0.objectValue.map(decodeSignal) },
            issues: (o.optionalArray("issues") ?? []).compactMap { $0.objectValue.map(decodeSignal) },
            nextSuggestions: o.optionalStringArray("nextSuggestions") ?? [],
            confidence: o.optionalString("confidence") ?? ""
        )
    }

    /// A `[String?]` array preserving JSON `null` entries (golden emits null for an absent
    /// `set.type`). `optionalStringArray`'s compactMap would silently drop the nulls.
    private func nullableStringArray(_ o: OrderedJSONObject, _ key: String) -> [String?] {
        (o.optionalArray(key) ?? []).map { $0.isNull ? nil : $0.stringValue }
    }

    // MARK: - shared per-fixture driver

    private func assertFixture(_ id: String, minCases: Int) throws {
        let root = try goldenRoot(id)
        XCTAssertEqual(root.optionalString("sourceFixtureId"), id)
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, minCases, "\(id): expected the declared cases")

        for caseValue in cases {
            let c = try caseValue.requireObject("session-quality case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let session = try TrainingSession(decoding: try XCTUnwrap(c["session"], "\(label): session"))

            // ---- buildSessionQualityResult ----
            let params = SessionQualityEngine.Params(
                session: session,
                effectiveSetSummary: c["effectiveSetSummary"],   // raw JSONValue (absent → nil → compute)
                loadFeedback: c["loadFeedback"],                 // raw JSONValue union
                painPatterns: c.optionalArray("painPatterns")
            )
            let actual = SessionQualityEngine.buildSessionQualityResult(params)
            let expected = decodeResult(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, expected, "\(id)/\(label): buildSessionQualityResult mismatch")

            // ---- groupSessionSetsByType probe ----
            let grouped = SessionDetailSummaryEngine.groupSessionSetsByType(session)
            let gp = try XCTUnwrap(c.optionalObject("grouped"), "\(label): grouped")
            XCTAssertEqual(grouped.warmupSets.count, gp.optionalInt("warmupSetCount") ?? -1, "\(label): warmupSetCount")
            XCTAssertEqual(grouped.workingSets.count, gp.optionalInt("workingSetCount") ?? -1, "\(label): workingSetCount")
            XCTAssertEqual(grouped.uncategorizedSets.count, gp.optionalInt("uncategorizedSetCount") ?? -1, "\(label): uncategorizedSetCount")
            XCTAssertEqual(grouped.supportSets.count, gp.optionalInt("supportSetCount") ?? -1, "\(label): supportSetCount")

            let actualWorkingTypes = grouped.workingSets.map { $0.set._unknown["type"]?.stringValue }
            XCTAssertEqual(actualWorkingTypes, nullableStringArray(gp, "workingSetTypes"), "\(label): workingSetTypes")
            let actualWarmupTypes = grouped.warmupSets.map { $0.set._unknown["type"]?.stringValue }
            XCTAssertEqual(actualWarmupTypes, nullableStringArray(gp, "warmupSetTypes"), "\(label): warmupSetTypes")

            let goldenGroups = gp.optionalArray("groups") ?? []
            XCTAssertEqual(grouped.exerciseGroups.count, goldenGroups.count, "\(label): group count")
            for (i, gValue) in goldenGroups.enumerated() where i < grouped.exerciseGroups.count {
                let go = try gValue.requireObject("\(label): group[\(i)]")
                let actualGroup = grouped.exerciseGroups[i]
                XCTAssertEqual(actualGroup.exerciseId, go.optionalString("exerciseId"), "\(label): group[\(i)].exerciseId")
                XCTAssertEqual(actualGroup.warmupSets.count, go.optionalInt("warmup") ?? -1, "\(label): group[\(i)].warmup")
                XCTAssertEqual(actualGroup.workingSets.count, go.optionalInt("working") ?? -1, "\(label): group[\(i)].working")
                XCTAssertEqual(actualGroup.uncategorizedSets.count, go.optionalInt("uncategorized") ?? -1, "\(label): group[\(i)].uncategorized")
            }

            // ---- buildWorkingOnlySession probe ----
            let workingOnly = SessionDetailSummaryEngine.buildWorkingOnlySession(session)
            let wp = try XCTUnwrap(c.optionalObject("workingOnly"), "\(label): workingOnly")
            XCTAssertEqual(workingOnly._unknown["dataFlag"]?.stringValue, wp.optionalString("dataFlag"), "\(label): workingOnly.dataFlag")
            XCTAssertEqual(workingOnly.focusWarmupSetLogs?.count ?? 0, wp.optionalInt("focusWarmupSetLogsLength") ?? -1, "\(label): focusWarmupSetLogsLength")

            let goldenWorkingExercises = wp.optionalArray("exercises") ?? []
            XCTAssertEqual(workingOnly.exercises?.count ?? 0, goldenWorkingExercises.count, "\(label): workingOnly exercise count")
            for (i, exValue) in goldenWorkingExercises.enumerated() where i < (workingOnly.exercises?.count ?? 0) {
                let exo = try exValue.requireObject("\(label): workingOnly.exercises[\(i)]")
                let actualEx = workingOnly.exercises![i]
                XCTAssertEqual(actualEx.id, exo.optionalString("id"), "\(label): workingOnly.exercises[\(i)].id")
                XCTAssertEqual(actualEx.sets?.count ?? 0, exo.optionalInt("setCount") ?? -1, "\(label): workingOnly.exercises[\(i)].setCount")
                let actualTypes = (actualEx.sets ?? []).map { $0._unknown["type"]?.stringValue }
                XCTAssertEqual(actualTypes, nullableStringArray(exo, "setTypes"), "\(label): workingOnly.exercises[\(i)].setTypes")
            }
        }
    }

    // MARK: - session-quality/quality-cases-v1

    func testBuildSessionQualityResultParityForQualityCases() throws {
        try assertFixture("session-quality/quality-cases-v1", minCases: 5)
    }

    // MARK: - session-quality/grouping-and-input-cases-v1

    func testSessionQualityParityForGroupingAndInputCases() throws {
        try assertFixture("session-quality/grouping-and-input-cases-v1", minCases: 8)
    }
}
