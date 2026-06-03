// EngineUtilsParityTests — PA-S2 engineUtils enrichExercise/buildExerciseMetadata OUTPUT
// parity + getPrimaryMuscles typed overload + override-seam unit checks.
//
// FUNCTION-LEVEL compute-assert: for the `enrich-exercise/default-branches-v1` golden,
// decode each echoed engineInput exercise, run the PORTED `EngineUtils.buildExerciseMetadata`
// / `enrichExercise` over the EMPTY seam (override = [:], equivalence = nil — this slice's
// pinned branch), and reconcile the produced `metadata` / `enriched` against the golden by
// CANONICAL JSON (byte-level, field-by-field). The golden is GENERATED from the REAL TS
// enrichExercise (scripts/generate-parity-goldens.mjs), never hand-edited (§22). The synthetic
// ids guarantee the golden pins the default branches only; the override DATA tables are PA-S3.
// Pure: no `: Date`, no IO beyond reading the committed golden.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class EngineUtilsParityTests: XCTestCase {

    private static let fixtureId = "enrich-exercise/default-branches-v1"

    /// Repo root, resolved from this test file's compile-time path (6 levels up — same
    /// paradigm as `AdaptiveFeedbackEngineParityTests`).
    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private static func root() throws -> OrderedJSONObject {
        let url = repoRoot.appendingPathComponent(
            "tests/fixtures/parity/golden/\(fixtureId).json", isDirectory: false
        )
        return try JSONValue(decoding: Data(contentsOf: url)).requireObject(fixtureId)
    }

    /// (label, decoded input exercise, golden result object) for every case, in order.
    private func cases() throws -> [(label: String, exercise: ExerciseTemplate, result: OrderedJSONObject)] {
        let root = try Self.root()
        let inputs = try XCTUnwrap(root.optionalObject("engineInput")?.optionalArray("cases"), "engineInput.cases")
        let results = try XCTUnwrap(root.optionalArray("results"), "results")
        XCTAssertEqual(inputs.count, results.count, "cases/results length mismatch")
        var out: [(String, ExerciseTemplate, OrderedJSONObject)] = []
        for (i, caseV) in inputs.enumerated() {
            let caseObj = try caseV.requireObject("case[\(i)]")
            let label = caseObj.optionalString("label") ?? "case-\(i)"
            let exerciseV = try XCTUnwrap(caseObj.rawValue("exercise"), "\(label): exercise")
            let exercise = try ExerciseTemplate(decoding: exerciseV)
            let result = try results[i].requireObject("result[\(i)]")
            out.append((label, exercise, result))
        }
        return out
    }

    // MARK: - (0) golden envelope

    func testGoldenDiscovered() throws {
        let root = try Self.root()
        XCTAssertEqual(root.optionalString("sourceFixtureId"), Self.fixtureId)
        XCTAssertEqual(try cases().count, 8, "expected 8 representative cases")
    }

    // MARK: - (1) buildExerciseMetadata parity (metadata field-by-field via canonical JSON)

    func testBuildExerciseMetadataParity() throws {
        for c in try cases() {
            let expected = try XCTUnwrap(c.result.rawValue("metadata"), "\(c.label): metadata").canonicalJSONString()
            let actual = try JSONValue.object(EngineUtils.buildExerciseMetadata(c.exercise)).canonicalJSONString()
            XCTAssertEqual(actual, expected, "\(c.label): buildExerciseMetadata mismatch")
        }
    }

    // MARK: - (2) enrichExercise parity ({...exercise, ...metadata} via canonical JSON)

    func testEnrichExerciseParity() throws {
        for c in try cases() {
            let expected = try XCTUnwrap(c.result.rawValue("enriched"), "\(c.label): enriched").canonicalJSONString()
            let actual = try EngineUtils.enrichExercise(c.exercise).encoded().canonicalJSONString()
            XCTAssertEqual(actual, expected, "\(c.label): enrichExercise mismatch")
        }
    }

    /// Compares an optional `JSONValue` field against a concrete expected `JSONValue`.
    /// (Writing `.number(...)` directly as the second arg of `XCTAssertEqual` would resolve
    /// the leading dot against `Optional<JSONValue>`; routing through a `JSONValue` parameter
    /// fixes the contextual base, then we inject into the optional for the comparison.)
    private func assertEq(_ actual: JSONValue?, _ expected: JSONValue, _ message: String = "",
                          file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(actual, Optional(expected), message, file: file, line: line)
    }

    // MARK: - (3) derived-branch spot checks against the golden (real TS truth)

    /// Asserts the EXACT default-branch values the real TS engine produced, keyed by label —
    /// pins the hand-verified expectations (not just Swift==golden). Reads the GOLDEN metadata.
    func testDerivedDefaultBranchValues() throws {
        var byLabel: [String: OrderedJSONObject] = [:]
        for c in try cases() {
            byLabel[c.label] = try XCTUnwrap(c.result.rawValue("metadata"), "\(c.label): metadata").objectValue
        }

        // Resolves the golden metadata for the UNIQUE case whose label contains `needle`
        // (fails if zero or more-than-one label matches — labels are unordered in the map).
        func meta(_ needle: String) throws -> OrderedJSONObject {
            let keys = byLabel.keys.filter { $0.contains(needle) }
            XCTAssertEqual(keys.count, 1, "label needle \(needle) matched \(keys.count) cases: \(keys)")
            return byLabel[try XCTUnwrap(keys.first, "no case label contains \(needle)")]!
        }

        // compound + bigMuscle(腿): progressionUnitKg 2.5, compound defaults.
        let big = try meta("bigMuscle(腿)")
        assertEq(big["progressionUnitKg"], .number(.double(2.5)))
        assertEq(big["progressionUnit"], .string("2.5kg"))
        assertEq(big["orderPriority"], .number(.integer(3)))
        assertEq(big["fatigueCost"], .string("medium"))
        assertEq(big["recommendedLoadRange"], .string("约 65%-85% 1RM"))
        assertEq(big["targetRir"], .array([.number(.integer(1)), .number(.integer(3))]))
        assertEq(big["progressionPercent"], .array([.number(.integer(5)), .number(.integer(10))]))
        assertEq(big["recommendedRestSec"], .array([.number(.integer(90)), .number(.integer(120))]))
        assertEq(big["techniqueStandard"]?.objectValue?["rom"], .string("完整可控幅度"))

        // isolation + small muscle: progressionUnitKg 1, isolation defaults, rom 受控完整幅度.
        let iso = try meta("isolation + small muscle(手臂)")
        assertEq(iso["progressionUnitKg"], .number(.integer(1)))
        assertEq(iso["progressionUnit"], .string("1kg"))
        assertEq(iso["orderPriority"], .number(.integer(6)))
        assertEq(iso["fatigueCost"], .string("low"))
        assertEq(iso["recommendedLoadRange"], .string("约 50%-75% 1RM"))
        assertEq(iso["progressionPercent"], .array([.number(.integer(2)), .number(.integer(5))]))
        assertEq(iso["recommendedRestSec"], .array([.number(.integer(45)), .number(.integer(60))]))
        assertEq(iso["techniqueStandard"]?.objectValue?["rom"], .string("受控完整幅度"))

        // explicit progressionUnitKg wins.
        let explicit = try meta("explicit")
        assertEq(explicit["progressionUnitKg"], .number(.integer(5)))
        assertEq(explicit["progressionUnit"], .string("5kg"))

        // parsed progressionUnit string '0.5kg' -> 0.5.
        let parsed = try meta("string parsed")
        assertEq(parsed["progressionUnitKg"], .number(.double(0.5)))
        assertEq(parsed["progressionUnit"], .string("0.5kg"))

        // exercise.techniqueStandard overlay: tempo overridden + extra key, rom stays compound.
        let tech = try meta("techniqueStandard overlay")
        let techTS = try XCTUnwrap(tech["techniqueStandard"]?.objectValue)
        assertEq(techTS["tempo"], .string("3-1-1"))
        assertEq(techTS["cue"], .string("保持肩胛后缩"))
        assertEq(techTS["rom"], .string("完整可控幅度"))
        assertEq(techTS["stopRule"], .string("动作明显变形、速度明显下降或出现不适时停止该组"))
    }

    // MARK: - (4) getPrimaryMuscles typed ExerciseTemplate overload (no golden; engineUtils.ts:207)

    func testGetPrimaryMusclesTypedOverload() {
        // non-empty primaryMuscles -> returned verbatim.
        XCTAssertEqual(EngineUtils.getPrimaryMuscles(ExerciseTemplate(muscle: "胸", primaryMuscles: ["胸", "肩"])), ["胸", "肩"])
        // empty primaryMuscles -> [muscle].filter(Boolean).
        XCTAssertEqual(EngineUtils.getPrimaryMuscles(ExerciseTemplate(muscle: "背", primaryMuscles: [])), ["背"])
        // nil primaryMuscles -> [muscle].filter(Boolean).
        XCTAssertEqual(EngineUtils.getPrimaryMuscles(ExerciseTemplate(muscle: "腿")), ["腿"])
        // empty/nil muscle -> [] (Boolean('') is false).
        XCTAssertEqual(EngineUtils.getPrimaryMuscles(ExerciseTemplate(muscle: "")), [])
        XCTAssertEqual(EngineUtils.getPrimaryMuscles(ExerciseTemplate()), [])
    }

    // MARK: - (5) override / equivalence seam injection (no golden; proves the seam is S3-ready)

    /// With a NON-empty override + injected equivalence, the merge picks the injected values
    /// over the defaults — verifying the seam mechanism this slice leaves for PA-S3 to feed.
    func testOverrideAndEquivalenceSeamInjection() {
        // Only id/muscle/kind drive the fields asserted below (compound + bigMuscle);
        // the numeric template fields are irrelevant to this seam check, so they are omitted.
        let exercise = ExerciseTemplate(id: "pa-s2-seam", muscle: "胸", kind: "compound")
        let override = OrderedJSONObject(entries: [
            OrderedJSONObject.Entry(key: "orderPriority", value: .number(.integer(1))),
            OrderedJSONObject.Entry(key: "fatigueCost", value: .string("high")),
            OrderedJSONObject.Entry(key: "primaryMuscles", value: .array([.string("胸"), .string("三角肌前束")])),
        ])
        let equivalence = JSONValue.object(OrderedJSONObject(entries: [
            OrderedJSONObject.Entry(key: "id", value: .string("horizontal-press")),
            OrderedJSONObject.Entry(key: "label", value: .string("水平推链")),
        ]))
        let meta = EngineUtils.buildExerciseMetadata(exercise, override: override, equivalence: equivalence)

        assertEq(meta["orderPriority"], .number(.integer(1)), "override.orderPriority wins over (compound ? 3 : 6)")
        assertEq(meta["fatigueCost"], .string("high"), "override.fatigueCost wins")
        // highFrequencyOk = override.highFrequencyOk ?? (fatigueCost !== 'high') -> 'high' => false.
        assertEq(meta["highFrequencyOk"], .bool(false))
        assertEq(meta["primaryMuscles"], .array([.string("胸"), .string("三角肌前束")]))
        // equivalenceChainId = override.equivalenceChainId || equivalence?.id || exercise.id.
        assertEq(meta["equivalenceChainId"], .string("horizontal-press"))
        // equivalence || {default}: the injected chain is used verbatim.
        assertEq(meta["equivalence"], equivalence)

        // Empty seam (the slice default) still yields the default branches.
        let defaultMeta = EngineUtils.buildExerciseMetadata(exercise)
        assertEq(defaultMeta["orderPriority"], .number(.integer(3)))
        assertEq(defaultMeta["fatigueCost"], .string("medium"))
        assertEq(defaultMeta["equivalenceChainId"], .string("pa-s2-seam"))
    }
}
