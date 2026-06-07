// iOS-17e-1 — per-exercise e1RM engine parity tests.
//
// FUNCTION-LEVEL compute-assert: for each `e1rm-engine/*` golden, decode the
// echoed engineInput (history + exerciseId) and probe inputs, run the PORTED
// `E1RMEngine` functions on the SAME inputs, and assert the produced outputs equal
// the golden values item-by-item:
//   - buildE1RMProfile(history, exerciseId)            == golden.profile
//   - estimateOneRepMaxForExercise(history, exerciseId)== golden.estimate (or nil)
//   - getExerciseRecordPoolId(probe.exercise)          == golden.poolIdProbes[].poolId
//   - getE1RMConfidence(sourceSet, recentSets)         == golden.confidenceProbes[].confidence
// The goldens are GENERATED from the retired legacy e1rmEngine (frozen legacy fixture generator),
// never hand-edited (§22). This is the 17e-1 slice of the progression-cluster
// parity (17e-0 was decode-only); it does NOT touch the decision output / existing
// decision goldens (that wiring is 17e-5). Zero `: Date`, no IO beyond reading the
// committed golden files.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class E1RMEngineParityTests: XCTestCase {

    enum Goldens {
        /// The 5 e1rm-engine OUTPUT fixture short ids (without the `e1rm-engine/` prefix).
        static let outputIds: [String] = [
            "progressive-overload-v1",
            "plateau-stall-v1",
            "insufficient-history-v1",
            "low-quality-filtered-v1",
            "pool-confidence-probes-v1",
        ]

        /// Repo root, resolved from this test file's compile-time path (6 levels up).
        static var repoRoot: URL {
            URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
                .deletingLastPathComponent()  // Tests/
                .deletingLastPathComponent()  // IronPathTrainingDecision/
                .deletingLastPathComponent()  // packages/
                .deletingLastPathComponent()  // ios/
                .deletingLastPathComponent()  // repo root
        }

        static func goldenURL(_ shortId: String) -> URL {
            repoRoot.appendingPathComponent(
                "ios/ParityFixtures/parity/golden/e1rm-engine/\(shortId).json", isDirectory: false
            )
        }

        static func root(_ shortId: String) throws -> OrderedJSONObject {
            let data = try Data(contentsOf: goldenURL(shortId))
            return try JSONValue(decoding: data).requireObject("e1rm-engine/\(shortId)")
        }
    }

    // MARK: - Golden decode helpers (decode the generated golden into the SAME
    // E1RMEngine value types so the parity check is a struct equality).

    private func decodeSourceSet(_ o: OrderedJSONObject) -> E1RMEngine.SourceSet {
        E1RMEngine.SourceSet(
            sessionId: o.optionalString("sessionId") ?? "",
            date: o.optionalString("date") ?? "",
            weightKg: o.optionalDouble("weightKg") ?? 0,
            reps: o.optionalDouble("reps") ?? 0,
            rir: o.optionalDouble("rir"),
            techniqueQuality: o.optionalString("techniqueQuality"),
            painFlag: o.optionalBool("painFlag")
        )
    }

    private func decodeEstimate(_ o: OrderedJSONObject?) -> E1RMEngine.EstimatedOneRepMax? {
        guard let o, let sourceSet = o.optionalObject("sourceSet") else { return nil }
        return E1RMEngine.EstimatedOneRepMax(
            exerciseId: o.optionalString("exerciseId") ?? "",
            e1rmKg: o.optionalDouble("e1rmKg") ?? 0,
            formula: o.optionalString("formula") ?? "",
            confidence: o.optionalString("confidence") ?? "",
            sourceSet: decodeSourceSet(sourceSet),
            notes: o.optionalStringArray("notes") ?? []
        )
    }

    private func decodeProfile(_ o: OrderedJSONObject) -> E1RMEngine.E1RMProfile {
        E1RMEngine.E1RMProfile(
            exerciseId: o.optionalString("exerciseId") ?? "",
            current: decodeEstimate(o.optionalObject("current")),
            best: decodeEstimate(o.optionalObject("best")),
            recentValues: (o.optionalArray("recentValues") ?? []).compactMap { $0.doubleValue },
            method: o.optionalString("method")
        )
    }

    // MARK: - (0) all goldens present + decode envelope

    func testAllGoldensDiscovered() throws {
        XCTAssertEqual(Goldens.outputIds.count, 5)
        for id in Goldens.outputIds {
            let url = Goldens.goldenURL(id)
            XCTAssertTrue(FileManager.default.fileExists(atPath: url.path), "missing golden \(id)")
            let root = try Goldens.root(id)
            XCTAssertEqual(root.optionalString("sourceFixtureId"), "e1rm-engine/\(id)", "\(id): sourceFixtureId")
        }
    }

    // MARK: - (1) buildE1RMProfile + estimateOneRepMaxForExercise parity

    func testProfileAndEstimateParityForEveryFixture() throws {
        for id in Goldens.outputIds {
            let root = try Goldens.root(id)
            let engineInput = try XCTUnwrap(root.optionalObject("engineInput"), "\(id): engineInput")
            let exerciseId = engineInput.optionalString("exerciseId") ?? ""
            let history = try (engineInput.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }

            let actualProfile = E1RMEngine.buildE1RMProfile(history, exerciseId)
            let goldenProfile = decodeProfile(try XCTUnwrap(root.optionalObject("profile"), "\(id): profile"))
            XCTAssertEqual(actualProfile, goldenProfile, "\(id): buildE1RMProfile mismatch")

            let actualEstimate = E1RMEngine.estimateOneRepMaxForExercise(history, exerciseId)
            // `estimate` is null in the golden when there is no candidate → nil here.
            let goldenEstimate = decodeEstimate(root.optionalObject("estimate"))
            XCTAssertEqual(actualEstimate, goldenEstimate, "\(id): estimateOneRepMaxForExercise mismatch")
        }
    }

    // MARK: - (2) getExerciseRecordPoolId probe parity

    func testPoolIdProbeParityForEveryFixture() throws {
        for id in Goldens.outputIds {
            let root = try Goldens.root(id)
            for probe in root.optionalArray("poolIdProbes") ?? [] {
                let o = try probe.requireObject("\(id): poolIdProbe")
                let label = o.optionalString("label") ?? "(unlabeled)"
                let exerciseValue = try XCTUnwrap(o.rawValue("exercise"), "\(id)/\(label): exercise")
                let exercise = try ExercisePrescription(decoding: exerciseValue)
                let actual = E1RMEngine.getExerciseRecordPoolId(exercise)
                XCTAssertEqual(actual, o.optionalString("poolId") ?? "", "\(id)/\(label): getExerciseRecordPoolId mismatch")
            }
        }
    }

    // MARK: - (3) getE1RMConfidence probe parity

    func testConfidenceProbeParityForEveryFixture() throws {
        for id in Goldens.outputIds {
            let root = try Goldens.root(id)
            for probe in root.optionalArray("confidenceProbes") ?? [] {
                let o = try probe.requireObject("\(id): confidenceProbe")
                let label = o.optionalString("label") ?? "(unlabeled)"
                let ss = try XCTUnwrap(o.optionalObject("sourceSet"), "\(id)/\(label): sourceSet")
                let source = E1RMEngine.ConfidenceSourceSet(
                    reps: ss.optionalDouble("reps") ?? 0,
                    rir: ss.optionalDouble("rir"),
                    techniqueQuality: ss.optionalString("techniqueQuality"),
                    painFlag: ss.optionalBool("painFlag")
                )
                let recents = (o.optionalArray("recentSets") ?? []).compactMap { value -> E1RMEngine.ConfidenceRecentSet? in
                    guard let r = value.objectValue else { return nil }
                    return E1RMEngine.ConfidenceRecentSet(
                        weightKg: r.optionalDouble("weightKg") ?? 0,
                        reps: r.optionalDouble("reps") ?? 0,
                        rir: r.optionalDouble("rir"),
                        techniqueQuality: r.optionalString("techniqueQuality"),
                        painFlag: r.optionalBool("painFlag")
                    )
                }
                let actual = E1RMEngine.getE1RMConfidence(source, recents)
                XCTAssertEqual(actual, o.optionalString("confidence"), "\(id)/\(label): getE1RMConfidence mismatch")
            }
        }
    }
}
