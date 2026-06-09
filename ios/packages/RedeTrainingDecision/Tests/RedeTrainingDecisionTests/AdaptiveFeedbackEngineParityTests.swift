// iOS-17e-2 — adaptiveFeedbackEngine performance-lookup parity tests.
//
// FUNCTION-LEVEL compute-assert: for each `adaptive-feedback/*` golden, decode the
// echoed engineInput (history + screening issueScores seed) and the probe inputs, run
// the PORTED `AdaptiveFeedbackEngine` functions on the SAME inputs, and assert the
// produced outputs equal the golden values item-by-item:
//   - findLastPerformance(history, id)              == golden.lastProbes[].snapshot
//   - findPreviousPerformance(history, id, skip)    == golden.previousProbes[].snapshot
//   - findRecentPerformances(history, id, limit)    == golden.recentProbes[].snapshots
//   - buildAdaptiveState(history, seed, today)      == golden.adaptiveState
// The goldens are GENERATED from the retired legacy adaptiveFeedbackEngine
// (frozen legacy fixture generator), never hand-edited (§22). This is the 17e-2
// slice of the progression-cluster parity; it does NOT touch the decision output /
// existing decision goldens (that wiring is 17e-5). Zero `: Date` (the buildAdaptiveState
// `lastUpdated` clock is INJECTED via `today` = the golden's deterministicClockIso date),
// no IO beyond reading the committed golden files.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class AdaptiveFeedbackEngineParityTests: XCTestCase {

    enum Goldens {
        /// The 4 adaptive-feedback OUTPUT fixture short ids (without the `adaptive-feedback/` prefix).
        static let outputIds: [String] = [
            "performance-drop-v1",
            "pain-accumulation-v1",
            "improving-and-seed-v1",
            "lookup-edge-v1",
        ]

        /// Repo root, resolved from this test file's compile-time path (6 levels up).
        static var repoRoot: URL {
            URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()  // RedeTrainingDecisionTests/
                .deletingLastPathComponent()  // Tests/
                .deletingLastPathComponent()  // RedeTrainingDecision/
                .deletingLastPathComponent()  // packages/
                .deletingLastPathComponent()  // ios/
                .deletingLastPathComponent()  // repo root
        }

        static func goldenURL(_ shortId: String) -> URL {
            repoRoot.appendingPathComponent(
                "ios/ParityFixtures/parity/golden/adaptive-feedback/\(shortId).json", isDirectory: false
            )
        }

        static func root(_ shortId: String) throws -> OrderedJSONObject {
            let data = try Data(contentsOf: goldenURL(shortId))
            return try JSONValue(decoding: data).requireObject("adaptive-feedback/\(shortId)")
        }
    }

    // MARK: - Comparable projections

    /// Mirror of the generator's per-set projection (weightKg = setWeightKg, reps = number(reps)).
    private struct SetVR: Equatable {
        let weightKg: Double
        let reps: Double
    }

    /// Mirror of the generator's `projectAdaptiveSnapshot` shape.
    private struct SnapshotProjection: Equatable {
        let sessionId: String?
        let exerciseId: String?
        let baseId: String?
        let setCount: Int
        let sets: [SetVR]
    }

    /// Mirror of the generated `adaptiveState` (the AdaptiveState slice buildAdaptiveState produces).
    private struct AdaptiveStateExpected: Equatable {
        let issueScores: [String: Double]
        let painByExercise: [String: Double]
        let performanceDrops: [String]
        let improvingIssues: [String]
        let moduleDose: [String: String]
        let lastUpdated: String
    }

    // MARK: - Build projections from the engine output

    private func project(_ snapshot: AdaptiveFeedbackEngine.PerformanceSnapshot?) -> SnapshotProjection? {
        guard let snapshot else { return nil }
        return SnapshotProjection(
            sessionId: snapshot.session.id,
            exerciseId: snapshot.exercise.id,
            baseId: snapshot.exercise._unknown["baseId"]?.stringValue,
            setCount: snapshot.sets.count,
            sets: snapshot.sets.map { SetVR(weightKg: E1RMEngine.setWeightKg($0), reps: E1RMEngine.number($0.reps)) }
        )
    }

    private func project(_ result: AdaptiveFeedbackEngine.AdaptiveStateResult) -> AdaptiveStateExpected {
        AdaptiveStateExpected(
            issueScores: result.issueScores,
            painByExercise: result.painByExercise,
            performanceDrops: result.performanceDrops,
            improvingIssues: result.improvingIssues,
            moduleDose: result.moduleDose,
            lastUpdated: result.lastUpdated
        )
    }

    // MARK: - Decode the golden into the SAME projections (struct equality)

    private func decodeProjection(_ o: OrderedJSONObject?) -> SnapshotProjection? {
        guard let o else { return nil }  // golden `"snapshot": null` → nil
        let sets = (o.optionalArray("sets") ?? []).compactMap { v -> SetVR? in
            guard let r = v.objectValue else { return nil }
            return SetVR(weightKg: r.optionalDouble("weightKg") ?? 0, reps: r.optionalDouble("reps") ?? 0)
        }
        return SnapshotProjection(
            sessionId: o.optionalString("sessionId"),
            exerciseId: o.optionalString("exerciseId"),
            baseId: o.optionalString("baseId"),
            setCount: Int(o.optionalDouble("setCount") ?? Double(sets.count)),
            sets: sets
        )
    }

    private func decodeDoubleMap(_ o: OrderedJSONObject?) -> [String: Double] {
        guard let o else { return [:] }
        var map: [String: Double] = [:]
        for key in o.keys { if let v = o[key]?.doubleValue { map[key] = v } }
        return map
    }

    private func decodeStringMap(_ o: OrderedJSONObject?) -> [String: String] {
        guard let o else { return [:] }
        var map: [String: String] = [:]
        for key in o.keys { if let v = o[key]?.stringValue { map[key] = v } }
        return map
    }

    private func decodeAdaptiveState(_ o: OrderedJSONObject) -> AdaptiveStateExpected {
        AdaptiveStateExpected(
            issueScores: decodeDoubleMap(o.optionalObject("issueScores")),
            painByExercise: decodeDoubleMap(o.optionalObject("painByExercise")),
            performanceDrops: o.optionalStringArray("performanceDrops") ?? [],
            improvingIssues: o.optionalStringArray("improvingIssues") ?? [],
            moduleDose: decodeStringMap(o.optionalObject("moduleDose")),
            lastUpdated: o.optionalString("lastUpdated") ?? ""
        )
    }

    // MARK: - Shared input decode

    private func decodeHistory(_ root: OrderedJSONObject, _ id: String) throws -> [TrainingSession] {
        let engineInput = try XCTUnwrap(root.optionalObject("engineInput"), "\(id): engineInput")
        return try (engineInput.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }
    }

    private func decodeSeed(_ root: OrderedJSONObject) -> [String: Double] {
        decodeDoubleMap(root.optionalObject("engineInput")?.optionalObject("seedIssueScores"))
    }

    /// `today` = the golden's deterministicClockIso date-only (replaces the legacy web schema wall-clock stamp).
    private func decodeToday(_ root: OrderedJSONObject) -> String {
        let iso = root.optionalObject("parityGolden")?.optionalString("deterministicClockIso") ?? ""
        return String(iso.prefix(10))
    }

    // MARK: - (0) all goldens present + decode envelope

    func testAllGoldensDiscovered() throws {
        XCTAssertEqual(Goldens.outputIds.count, 4)
        for id in Goldens.outputIds {
            let url = Goldens.goldenURL(id)
            XCTAssertTrue(FileManager.default.fileExists(atPath: url.path), "missing golden \(id)")
            let root = try Goldens.root(id)
            XCTAssertEqual(root.optionalString("sourceFixtureId"), "adaptive-feedback/\(id)", "\(id): sourceFixtureId")
        }
    }

    // MARK: - (1) findLastPerformance probe parity

    func testFindLastPerformanceParityForEveryFixture() throws {
        for id in Goldens.outputIds {
            let root = try Goldens.root(id)
            let history = try decodeHistory(root, id)
            for probe in root.optionalArray("lastProbes") ?? [] {
                let o = try probe.requireObject("\(id): lastProbe")
                let label = o.optionalString("label") ?? "(unlabeled)"
                let exerciseId = o.optionalString("exerciseId") ?? ""
                let actual = project(AdaptiveFeedbackEngine.findLastPerformance(history, exerciseId))
                let expected = decodeProjection(o.optionalObject("snapshot"))
                XCTAssertEqual(actual, expected, "\(id)/\(label): findLastPerformance mismatch")
            }
        }
    }

    // MARK: - (2) findPreviousPerformance probe parity

    func testFindPreviousPerformanceParityForEveryFixture() throws {
        for id in Goldens.outputIds {
            let root = try Goldens.root(id)
            let history = try decodeHistory(root, id)
            for probe in root.optionalArray("previousProbes") ?? [] {
                let o = try probe.requireObject("\(id): previousProbe")
                let label = o.optionalString("label") ?? "(unlabeled)"
                let exerciseId = o.optionalString("exerciseId") ?? ""
                let skipSessionId = o.optionalString("skipSessionId")  // nil when golden carries null
                let actual = project(
                    AdaptiveFeedbackEngine.findPreviousPerformance(history, exerciseId, skipSessionId: skipSessionId)
                )
                let expected = decodeProjection(o.optionalObject("snapshot"))
                XCTAssertEqual(actual, expected, "\(id)/\(label): findPreviousPerformance mismatch")
            }
        }
    }

    // MARK: - (3) findRecentPerformances probe parity

    func testFindRecentPerformancesParityForEveryFixture() throws {
        for id in Goldens.outputIds {
            let root = try Goldens.root(id)
            let history = try decodeHistory(root, id)
            for probe in root.optionalArray("recentProbes") ?? [] {
                let o = try probe.requireObject("\(id): recentProbe")
                let label = o.optionalString("label") ?? "(unlabeled)"
                let exerciseId = o.optionalString("exerciseId") ?? ""
                let limit = Int(o.optionalDouble("limit") ?? 3)
                let actual = AdaptiveFeedbackEngine.findRecentPerformances(history, exerciseId, limit: limit).map { project($0) }
                let expected = (o.optionalArray("snapshots") ?? []).map { decodeProjection($0.objectValue) }
                XCTAssertEqual(actual.count, Int(o.optionalDouble("count") ?? 0), "\(id)/\(label): findRecentPerformances count")
                XCTAssertEqual(actual, expected, "\(id)/\(label): findRecentPerformances mismatch")
            }
        }
    }

    // MARK: - (4) buildAdaptiveState parity

    func testBuildAdaptiveStateParityForEveryFixture() throws {
        for id in Goldens.outputIds {
            let root = try Goldens.root(id)
            let history = try decodeHistory(root, id)
            let seed = decodeSeed(root)
            let today = decodeToday(root)

            let actual = project(
                AdaptiveFeedbackEngine.buildAdaptiveState(history, seedIssueScores: seed, today: today)
            )
            let expected = decodeAdaptiveState(try XCTUnwrap(root.optionalObject("adaptiveState"), "\(id): adaptiveState"))
            XCTAssertEqual(actual, expected, "\(id): buildAdaptiveState mismatch")
        }
    }
}
