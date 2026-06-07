// SR-3 — Smart Replacement Engine parity tests (parity fulfillment).
//
// This UPGRADES the SR-0 smart-replacement goldens from decode-only
// (SmartReplacementGoldenDecodeTests) to COMPUTE-AND-ASSERT: for each of the 4
// committed smart-replacement fixtures it decodes the fixture's `params`
// (ios/ParityFixtures/parity/inputs/smart-replacement/*.json — the SAME input the legacy web schema
// generator's generateSmartReplacement feeds buildSmartReplacementRecommendations),
// runs the PORTED SmartReplacementEngine.buildSmartReplacementRecommendations on
// it, and asserts the produced SmartReplacementRecommendation[] equals the golden
// `recommendations` item-by-item + in order. It also re-derives currentExerciseId
// + priorityCounts and checks them against the golden's echoed summary.
//
// The smart-replacement golden does NOT echo its engineInput (unlike the
// replacement-engine goldens) — so, to avoid mutating any committed golden, the
// engine input is read from the committed INPUT fixture's `params`. Both files are
// read from the canonical repo path via a #filePath walk-up (no copies, no drift),
// exactly mirroring SmartReplacementGoldenDecodeTests / ReplacementEngineParityTests.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

/// Loads a smart-replacement INPUT fixture's `params` and decodes it into the
/// typed SmartReplacementParams the ported engine consumes.
enum SmartReplacementInputs {
    static var inputDir: URL {
        SmartReplacementGoldens.repoRoot
            .appendingPathComponent("ios/ParityFixtures/parity/inputs/smart-replacement", isDirectory: true)
    }

    static func inputURL(_ id: String) -> URL {
        inputDir.appendingPathComponent("\(id).json", isDirectory: false)
    }

    static func paramsObject(_ id: String) throws -> OrderedJSONObject {
        let data = try Data(contentsOf: inputURL(id))
        let root = try JSONValue(decoding: data).requireObject("smart-replacement/\(id) input")
        return try XCTUnwrap(root.optionalObject("params"), "\(id): missing params")
    }

    static func params(_ id: String) throws -> SmartReplacementParams {
        decodeParams(try paramsObject(id))
    }

    // MARK: - Decoders (mirror exactly the fields the engine reads)

    static func decodeParams(_ obj: OrderedJSONObject) -> SmartReplacementParams {
        var p = SmartReplacementParams()
        if let v = obj.rawValue("currentExercise"), !v.isNull { p.currentExercise = decodeRef(v) }
        if let v = obj.rawValue("exerciseLibrary"), !v.isNull { p.exerciseLibrary = decodeLibrary(v) }
        if let arr = obj.optionalArray("painPatterns") { p.painPatterns = arr.compactMap(decodePainPattern) }
        if let r = obj.optionalObject("readinessResult") {
            p.readinessResult = SmartReplacementReadinessResult(
                level: r.optionalString("level"),
                score: r.optionalDouble("score"),
                trainingAdjustment: r.optionalString("trainingAdjustment")
            )
        }
        if let v = obj.rawValue("loadFeedback"), !v.isNull { p.loadFeedback = decodeLoadFeedback(v) }
        if let arr = obj.optionalArray("trainingHistory") { p.trainingHistory = arr.compactMap(decodeSession) }
        p.equipmentPreferences = obj.optionalStringArray("equipmentPreferences")
        if let tags = obj.optionalStringArray("unavailableEquipment") {
            p.unavailableEquipment = tags.compactMap { ExerciseEquipmentTag(rawValue: $0) }
        }
        p.trainingLevel = obj.optionalString("trainingLevel")
        return p
    }

    static func decodeRef(_ value: JSONValue) -> SmartReplacementExerciseRef {
        if case .string(let s) = value { return .id(s) }
        if case .object(let o) = value { return .object(decodeExercise(o)) }
        return .id("")
    }

    static func decodeExercise(_ o: OrderedJSONObject) -> SmartReplacementExercise {
        var e = SmartReplacementExercise()
        e.id = o.optionalString("id")
        e.name = o.optionalString("name")
        e.baseId = o.optionalString("baseId")
        e.canonicalExerciseId = o.optionalString("canonicalExerciseId")
        e.actualExerciseId = o.optionalString("actualExerciseId")
        e.replacementExerciseId = o.optionalString("replacementExerciseId")
        e.primaryMuscles = o.optionalStringArray("primaryMuscles")
        e.muscle = o.optionalString("muscle")
        e.movementPattern = o.optionalString("movementPattern")
        e.equivalenceChainId = o.optionalString("equivalenceChainId")
        e.fatigueCost = o.optionalString("fatigueCost")
        e.skillDemand = o.optionalString("skillDemand")
        e.kind = o.optionalString("kind")
        e.contraindications = o.optionalStringArray("contraindications")
        e.alternativeIds = o.optionalStringArray("alternativeIds")
        if let ap = o.optionalObject("alternativePriorities") { e.alternativePriorities = decodeStringMap(ap) }
        return e
    }

    static func decodeStringMap(_ o: OrderedJSONObject) -> [String: String] {
        var m: [String: String] = [:]
        for key in o.keys { if let s = o.optionalString(key) { m[key] = s } }
        return m
    }

    static func decodeLibrary(_ value: JSONValue) -> SmartReplacementLibraryInput? {
        if case .array(let arr) = value { return .array(arr.map(decodeRef)) }
        if case .object(let o) = value {
            return .record(o.entries.map { .init(key: $0.key, value: decodeRef($0.value)) })
        }
        return nil
    }

    static func decodePainPattern(_ value: JSONValue) -> SmartReplacementPainPattern? {
        guard case .object(let o) = value else { return nil }
        return SmartReplacementPainPattern(
            area: o.optionalString("area") ?? "",
            exerciseId: o.optionalString("exerciseId"),
            severityAvg: o.optionalDouble("severityAvg"),
            suggestedAction: o.optionalString("suggestedAction")
        )
    }

    static func decodeLoadFeedback(_ value: JSONValue) -> SmartReplacementLoadFeedbackInput? {
        if case .string(let s) = value { return .value(s) }
        if case .array(let arr) = value { return .list(arr.compactMap(decodeLoadFeedbackItem)) }
        if case .object(let o) = value {
            let adjustment = o.optionalObject("adjustment")
            return .object(
                dominantFeedback: o.optionalString("dominantFeedback"),
                feedback: o.optionalString("feedback"),
                adjustmentDominantFeedback: adjustment?.optionalString("dominantFeedback")
            )
        }
        return nil
    }

    static func decodeLoadFeedbackItem(_ value: JSONValue) -> SmartReplacementLoadFeedback? {
        guard case .object(let o) = value else { return nil }
        return SmartReplacementLoadFeedback(exerciseId: o.optionalString("exerciseId"), feedback: o.optionalString("feedback"))
    }

    static func decodeSession(_ value: JSONValue) -> SmartReplacementTrainingSession? {
        guard case .object(let o) = value else { return nil }
        var s = SmartReplacementTrainingSession()
        s.dataFlag = o.optionalString("dataFlag")
        s.date = o.optionalString("date")
        if let exArr = o.optionalArray("exercises") { s.exercises = exArr.compactMap(decodeHistoryExercise) }
        if let lfArr = o.optionalArray("loadFeedback") { s.loadFeedback = lfArr.compactMap(decodeLoadFeedbackItem) }
        return s
    }

    static func decodeHistoryExercise(_ value: JSONValue) -> SmartReplacementHistoryExercise? {
        guard case .object(let o) = value else { return nil }
        var e = SmartReplacementHistoryExercise()
        e.id = o.optionalString("id")
        e.actualExerciseId = o.optionalString("actualExerciseId")
        e.replacementExerciseId = o.optionalString("replacementExerciseId")
        e.canonicalExerciseId = o.optionalString("canonicalExerciseId")
        e.muscle = o.optionalString("muscle")
        if let setsArr = o.optionalArray("sets") { e.sets = setsArr.compactMap(decodeHistorySet) }
        return e
    }

    static func decodeHistorySet(_ value: JSONValue) -> SmartReplacementHistorySet? {
        guard case .object(let o) = value else { return nil }
        return SmartReplacementHistorySet(
            painFlag: o.optionalBool("painFlag"),
            painArea: o.optionalString("painArea"),
            painSeverity: o.optionalDouble("painSeverity")
        )
    }
}

final class SmartReplacementEngineParityTests: XCTestCase {
    // (1) All 4 INPUT fixtures are discovered on disk (the engine input source).
    func testAllInputFixturesDiscovered() {
        XCTAssertEqual(SmartReplacementGoldens.allIds.count, 4)
        for id in SmartReplacementGoldens.allIds {
            XCTAssertTrue(
                FileManager.default.fileExists(atPath: SmartReplacementInputs.inputURL(id).path),
                "missing input fixture \(id)"
            )
        }
    }

    /// The CORE parity lock: the ported buildSmartReplacementRecommendations
    /// reproduces every golden recommendation EXACTLY (full struct equality, in
    /// order), for every fixture — and the re-derived count / currentExerciseId /
    /// priorityCounts agree with the golden's echoed summary.
    func testParityForEveryFixture() throws {
        for id in SmartReplacementGoldens.allIds {
            let params = try SmartReplacementInputs.params(id)
            let actual = SmartReplacementEngine.buildSmartReplacementRecommendations(params)
            let golden = try SmartReplacementGoldens.decode(id)

            // Order + identity first (localises an ordering/collation drift).
            XCTAssertEqual(
                actual.map { $0.exerciseId }, golden.recommendations.map { $0.exerciseId },
                "\(id): exerciseId order mismatch"
            )
            XCTAssertEqual(actual.count, golden.recommendationCount, "\(id): recommendationCount mismatch")
            XCTAssertEqual(actual.count, golden.recommendations.count, "\(id): count vs decoded golden")

            // Item-by-item (every field: name / priority / fatigueCost / reason / warnings).
            for (index, expected) in golden.recommendations.enumerated() where index < actual.count {
                XCTAssertEqual(actual[index], expected, "\(id): recommendation[\(index)] (id=\(expected.exerciseId)) mismatch")
            }
            // Whole-array equality (catches any length/tail difference too).
            XCTAssertEqual(actual, golden.recommendations, "\(id): full recommendation list mismatch")

            // Re-derived currentExerciseId matches the golden's echoed id.
            XCTAssertEqual(currentExerciseId(params), golden.currentExerciseId, "\(id): currentExerciseId")

            // Re-derived priorityCounts match the golden's echoed summary.
            for priority in SmartReplacementPriority.allCases {
                let recounted = actual.filter { $0.priorityEnum == priority }.count
                XCTAssertEqual(golden.priorityCounts[priority.rawValue], recounted, "\(id): priorityCounts[\(priority.rawValue)]")
            }

            // The committed golden envelope is intact.
            XCTAssertEqual(golden.parityGolden?.sourceFixtureId, "smart-replacement/\(id)", "\(id): envelope id")
            XCTAssertEqual(golden.parityGolden?.generatorVersion, "v1", "\(id): envelope version")
        }
    }

    /// Guards against a silently-emptied fixture making the parity loop vacuous:
    /// every fixture must yield a non-empty recommendation list.
    func testEveryFixtureYieldsRecommendations() throws {
        for id in SmartReplacementGoldens.allIds {
            let actual = SmartReplacementEngine.buildSmartReplacementRecommendations(try SmartReplacementInputs.params(id))
            XCTAssertFalse(actual.isEmpty, "\(id): engine produced no recommendations")
        }
    }

    /// The ported engine's output collectively covers all four priorities (the same
    /// coverage the SR-0 decode test asserts on the goldens — now proven on COMPUTED
    /// output, closing the parity loop).
    func testComputedOutputCoversAllFourPriorities() throws {
        var union: Set<SmartReplacementPriority> = []
        for id in SmartReplacementGoldens.allIds {
            let actual = SmartReplacementEngine.buildSmartReplacementRecommendations(try SmartReplacementInputs.params(id))
            union.formUnion(actual.compactMap { $0.priorityEnum })
        }
        XCTAssertEqual(union, Set(SmartReplacementPriority.allCases))
    }

    /// The controlled anchor fixture's COMPUTED output alone covers all four
    /// priorities (mirrors the SR-0 anchor decode test on the computed side).
    func testAnchorFixtureComputedCoversAllFourPriorities() throws {
        let actual = SmartReplacementEngine.buildSmartReplacementRecommendations(
            try SmartReplacementInputs.params(SmartReplacementGoldens.anchorId)
        )
        XCTAssertEqual(Set(actual.compactMap { $0.priorityEnum }), Set(SmartReplacementPriority.allCases))
    }

    // MARK: - Helpers

    /// Mirror of the generator's smartReplacementCurrentId echo (parityGoldensEntry.ts:784)
    /// — the resolved current-exercise id for the golden's `currentExerciseId`.
    private func currentExerciseId(_ params: SmartReplacementParams) -> String {
        switch params.currentExercise {
        case .none: return ""
        case .id(let s): return s
        case .object(let e):
            for value in [e.actualExerciseId, e.replacementExerciseId, e.canonicalExerciseId, e.baseId, e.id] {
                if let value, !value.isEmpty { return value }
            }
            return ""
        }
    }
}
