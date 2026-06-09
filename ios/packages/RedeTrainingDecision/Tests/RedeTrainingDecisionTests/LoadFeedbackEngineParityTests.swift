// iOS-17e-4 — loadFeedbackEngine parity tests.
//
// FUNCTION-LEVEL compute-assert: for each `load-feedback/*` golden, decode the echoed
// engineInput history (loadFeedback / dataFlag ride in the `_unknown` open bag) and the
// probes, run the PORTED `LoadFeedbackEngine` functions on the SAME inputs, and assert
// the produced values equal the golden item-by-item:
//   - collectLoadFeedback(history, id)       == probe.collect       ([LoadFeedback])
//   - buildLoadFeedbackSummary(history, id)  == probe.summary       (total/counts/
//                                               dominantFeedback/adjustment)
//   - getLoadFeedbackAdjustment(history, id) == probe.adjustment    (direction/
//                                               dominantFeedback/reasons)
//   - upsertedLoadFeedback(session, ...)     == upsertProbe.resultLoadFeedback
// Every field is a String / Int, so equality is plain struct `==` (no float tolerance).
//
// The goldens are GENERATED from the retired legacy loadFeedbackEngine
// (frozen legacy fixture generator), never hand-edited (§22). This is the 17e-4 slice
// of the load-feedback-cluster parity; it does NOT touch the decision output / existing
// decision goldens (that wiring is 17e-5). Zero `: Date`, no IO beyond reading the
// committed golden files.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class LoadFeedbackEngineParityTests: XCTestCase {

    enum Goldens {
        /// The 3 load-feedback OUTPUT fixture short ids (without the prefix).
        static let outputIds: [String] = [
            "collect-summary-v1",
            "adjustment-branches-v1",
            "upsert-v1",
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
                "ios/ParityFixtures/parity/golden/load-feedback/\(shortId).json", isDirectory: false
            )
        }

        static func root(_ shortId: String) throws -> OrderedJSONObject {
            let data = try Data(contentsOf: goldenURL(shortId))
            return try JSONValue(decoding: data).requireObject("load-feedback/\(shortId)")
        }
    }

    // MARK: - Golden decode helpers (decode the generated golden into the SAME
    // LoadFeedbackEngine value types so each parity check is a struct equality).

    private func decodeItem(_ o: OrderedJSONObject) -> LoadFeedbackEngine.LoadFeedback {
        LoadFeedbackEngine.LoadFeedback(
            exerciseId: o.optionalString("exerciseId") ?? "",
            sessionId: o.optionalString("sessionId") ?? "",
            date: o.optionalString("date") ?? "",
            feedback: o.optionalString("feedback") ?? "",
            note: o.optionalString("note")
        )
    }

    private func decodeItems(_ arr: [JSONValue]?) throws -> [LoadFeedbackEngine.LoadFeedback] {
        try (arr ?? []).map { decodeItem(try $0.requireObject("loadFeedback item")) }
    }

    private func decodeCounts(_ o: OrderedJSONObject) -> LoadFeedbackEngine.Counts {
        let c = o.optionalObject("counts") ?? OrderedJSONObject()
        return LoadFeedbackEngine.Counts(
            tooLight: c.optionalInt("too_light") ?? 0,
            good: c.optionalInt("good") ?? 0,
            tooHeavy: c.optionalInt("too_heavy") ?? 0
        )
    }

    private func decodeAdjustment(_ o: OrderedJSONObject) -> LoadFeedbackEngine.LoadFeedbackAdjustment {
        LoadFeedbackEngine.LoadFeedbackAdjustment(
            direction: o.optionalString("direction") ?? "",
            dominantFeedback: o.optionalString("dominantFeedback"),
            reasons: o.optionalStringArray("reasons") ?? []
        )
    }

    private func decodeSummary(_ o: OrderedJSONObject) -> LoadFeedbackEngine.LoadFeedbackSummary {
        LoadFeedbackEngine.LoadFeedbackSummary(
            exerciseId: o.optionalString("exerciseId"),
            total: o.optionalInt("total") ?? 0,
            counts: decodeCounts(o),
            dominantFeedback: o.optionalString("dominantFeedback"),
            adjustment: decodeAdjustment(try! XCTUnwrap(o.optionalObject("adjustment")))
        )
    }

    private func history(_ root: OrderedJSONObject, _ id: String) throws -> [TrainingSession] {
        let engineInput = try XCTUnwrap(root.optionalObject("engineInput"), "\(id): engineInput")
        return try (engineInput.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }
    }

    // MARK: - (0) all goldens present + decode envelope

    func testAllGoldensDiscovered() throws {
        XCTAssertEqual(Goldens.outputIds.count, 3)
        for id in Goldens.outputIds {
            let url = Goldens.goldenURL(id)
            XCTAssertTrue(FileManager.default.fileExists(atPath: url.path), "missing golden \(id)")
            let root = try Goldens.root(id)
            XCTAssertEqual(root.optionalString("sourceFixtureId"), "load-feedback/\(id)", "\(id): sourceFixtureId")
        }
    }

    // MARK: - (1) collect / summary / adjustment parity per probe

    func testCollectSummaryAdjustmentParityForEveryProbe() throws {
        for id in Goldens.outputIds {
            let root = try Goldens.root(id)
            let history = try history(root, id)

            for probe in root.optionalArray("probes") ?? [] {
                let o = try probe.requireObject("\(id): probe")
                let label = o.optionalString("label") ?? "(unlabeled)"
                let exerciseId = o.optionalString("exerciseId")   // JSON null → nil → global

                let actualCollect = LoadFeedbackEngine.collectLoadFeedback(history, exerciseId)
                let goldenCollect = try decodeItems(o.optionalArray("collect"))
                XCTAssertEqual(actualCollect, goldenCollect, "\(id)/\(label): collectLoadFeedback mismatch")

                let actualSummary = LoadFeedbackEngine.buildLoadFeedbackSummary(history, exerciseId)
                let goldenSummary = decodeSummary(try XCTUnwrap(o.optionalObject("summary"), "\(id)/\(label): summary"))
                XCTAssertEqual(actualSummary, goldenSummary, "\(id)/\(label): buildLoadFeedbackSummary mismatch")

                let actualAdjustment = LoadFeedbackEngine.getLoadFeedbackAdjustment(history, exerciseId)
                let goldenAdjustment = decodeAdjustment(try XCTUnwrap(o.optionalObject("adjustment"), "\(id)/\(label): adjustment"))
                XCTAssertEqual(actualAdjustment, goldenAdjustment, "\(id)/\(label): getLoadFeedbackAdjustment mismatch")
            }
        }
    }

    // MARK: - (2) upsertLoadFeedback parity per probe

    func testUpsertParityForEveryProbe() throws {
        for id in Goldens.outputIds {
            let root = try Goldens.root(id)

            for probe in root.optionalArray("upsertProbes") ?? [] {
                let o = try probe.requireObject("\(id): upsertProbe")
                let label = o.optionalString("label") ?? "(unlabeled)"
                let sessionValue = try XCTUnwrap(o.rawValue("session"), "\(id)/\(label): session")
                let session = try TrainingSession(decoding: sessionValue)
                let exerciseId = try XCTUnwrap(o.optionalString("exerciseId"), "\(id)/\(label): exerciseId")
                let feedback = try XCTUnwrap(o.optionalString("feedback"), "\(id)/\(label): feedback")
                let note = o.optionalString("note")   // JSON null → nil

                let actual = LoadFeedbackEngine.upsertedLoadFeedback(session, exerciseId, feedback, note)
                let golden = try decodeItems(o.optionalArray("resultLoadFeedback"))
                XCTAssertEqual(actual, golden, "\(id)/\(label): upsertLoadFeedback mismatch")
            }
        }
    }
}
