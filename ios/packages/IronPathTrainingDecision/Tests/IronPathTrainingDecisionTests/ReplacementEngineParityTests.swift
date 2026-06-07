// SR-2 — Replacement Engine parity + unit tests.
//
// (A) OUTPUT PARITY: for each replacement-engine OUTPUT golden, decode the echoed
//     engineInput, run the PORTED ReplacementEngine.buildReplacementOptions on it,
//     and assert the produced ReplacementOption[] equals the golden options
//     item-by-item + in order — then assert validateReplacementExerciseId /
//     isSyntheticReplacementExerciseId reproduce every probe verdict. This drives
//     the REAL ported engine and pins it to the legacy web schema engine's generated output.
// (B) KNOWLEDGE PARITY: reconstruct the engine-used EXERCISE_EQUIVALENCE_CHAINS +
//     EXERCISE_KNOWLEDGE_OVERRIDES subset from the ported ReplacementEngineKnowledge
//     tables and assert it equals the generated knowledge-snapshot golden
//     item-by-item (key set, every field, array order). A dropped / altered datum
//     fails here.
// (C) UNIT: representative-input tests pinning ported pure behaviour directly —
//     the normalizeName `\\s` quirk, baseExerciseId `__alt_` split, the
//     forbidden-bench filter, the exercise-level alternativeIds fallback, and the
//     isSynthetic regex boundaries.
//
// All goldens are read from the canonical repo path via a #filePath walk-up — the
// SAME committed goldens the legacy web schema generator produces (no copies, no drift). Mirrors
// SmartReplacementGoldenDecodeTests / ExerciseLibraryParityTests.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

private enum ReplacementGoldenDecodeError: Error { case unknownRank(String) }

/// Shared golden-fixture loader for the SR-2 replacement-engine goldens.
enum ReplacementEngineGoldens {
    /// The 4 OUTPUT fixture short ids (without the `replacement-engine/` prefix).
    static let outputIds: [String] = [
        "bench-press-explicit-v1",
        "lat-pulldown-equipment-v1",
        "hack-squat-chain-v1",
        "validation-synthetic-v1",
    ]

    static let knowledgeSnapshotId = "knowledge-snapshot-v1"

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
            "ios/ParityFixtures/parity/golden/replacement-engine/\(shortId).json", isDirectory: false
        )
    }

    static func root(_ shortId: String) throws -> OrderedJSONObject {
        let data = try Data(contentsOf: goldenURL(shortId))
        return try JSONValue(decoding: data).requireObject("replacement-engine/\(shortId)")
    }

    // MARK: Output golden decode

    struct ProbeBool: Equatable { let id: String; let value: Bool }

    struct DecodedOutput {
        let exercise: ReplacementExerciseInput
        let context: ReplacementContext
        let options: [ReplacementOption]
        let optionIds: [String]
        let optionCount: Int
        let validation: [ProbeBool]
        let synthetic: [ProbeBool]
        let envelope: ParityGoldenEnvelope?
    }

    static func decodeExercise(_ obj: OrderedJSONObject) -> ReplacementExerciseInput {
        var priorities: [String: String]?
        if let p = obj.optionalObject("alternativePriorities") {
            var map: [String: String] = [:]
            for key in p.keys { if let v = p.optionalString(key) { map[key] = v } }
            priorities = map
        }
        return ReplacementExerciseInput(
            id: obj.optionalString("id") ?? "",
            baseId: obj.optionalString("baseId"),
            canonicalExerciseId: obj.optionalString("canonicalExerciseId"),
            originalExerciseId: obj.optionalString("originalExerciseId"),
            actualExerciseId: obj.optionalString("actualExerciseId"),
            replacementExerciseId: obj.optionalString("replacementExerciseId"),
            replacedFromId: obj.optionalString("replacedFromId"),
            alternativeIds: obj.optionalStringArray("alternativeIds"),
            alternativePriorities: priorities
        )
    }

    static func decodeOption(_ value: JSONValue) throws -> ReplacementOption {
        let obj = try value.requireObject("ReplacementOption")
        let rankRaw = try obj.requireString("rank", "ReplacementOption")
        guard let rank = ReplacementRank(rawValue: rankRaw) else {
            throw ReplacementGoldenDecodeError.unknownRank(rankRaw)
        }
        return ReplacementOption(
            id: try obj.requireString("id", "ReplacementOption"),
            name: try obj.requireString("name", "ReplacementOption"),
            rank: rank,
            rankLabel: try obj.requireString("rankLabel", "ReplacementOption"),
            reason: try obj.requireString("reason", "ReplacementOption"),
            fatigueCost: try obj.requireString("fatigueCost", "ReplacementOption"),
            fatigueCostLabel: try obj.requireString("fatigueCostLabel", "ReplacementOption"),
            prIndependent: obj.optionalBool("prIndependent") ?? false
        )
    }

    static func decodeOutput(_ shortId: String) throws -> DecodedOutput {
        let root = try root(shortId)
        let engineInput = root.optionalObject("engineInput")
        let exercise = decodeExercise(engineInput?.optionalObject("exercise") ?? OrderedJSONObject(entries: []))
        let tags = (engineInput?.optionalObject("context")?.optionalStringArray("unavailableEquipment") ?? [])
            .compactMap { ExerciseEquipmentTag(rawValue: $0) }
        let context = ReplacementContext(unavailableEquipment: tags)

        let options = try (root.optionalArray("options") ?? []).map { try decodeOption($0) }

        func probes(_ key: String, _ flag: String) -> [ProbeBool] {
            (root.optionalArray(key) ?? []).compactMap { value -> ProbeBool? in
                guard case .object(let o) = value, let id = o.optionalString("id"), let b = o.optionalBool(flag) else { return nil }
                return ProbeBool(id: id, value: b)
            }
        }

        let envelope: ParityGoldenEnvelope?
        if let pg = root.rawValue("parityGolden"), !pg.isNull {
            envelope = try ParityGoldenEnvelope(decoding: pg)
        } else {
            envelope = nil
        }

        return DecodedOutput(
            exercise: exercise,
            context: context,
            options: options,
            optionIds: root.optionalStringArray("optionIds") ?? [],
            optionCount: root.optionalInt("optionCount") ?? -1,
            validation: probes("validation", "valid"),
            synthetic: probes("synthetic", "synthetic"),
            envelope: envelope
        )
    }
}

final class ReplacementEngineParityTests: XCTestCase {
    // MARK: - (A) Output parity (the ported engine vs the generated golden)

    func testAllOutputGoldensDiscovered() {
        for id in ReplacementEngineGoldens.outputIds {
            XCTAssertTrue(
                FileManager.default.fileExists(atPath: ReplacementEngineGoldens.goldenURL(id).path),
                "missing golden \(id)"
            )
        }
    }

    /// The CORE lock: the ported buildReplacementOptions reproduces the golden
    /// option list exactly (full struct equality, in order), and the validate /
    /// synthetic probes reproduce every golden verdict.
    func testOutputParityForEveryFixture() throws {
        for shortId in ReplacementEngineGoldens.outputIds {
            let g = try ReplacementEngineGoldens.decodeOutput(shortId)
            let actual = ReplacementEngine.buildReplacementOptions(g.exercise, context: g.context)

            XCTAssertEqual(actual.map { $0.id }, g.optionIds, "\(shortId): optionIds / order mismatch")
            XCTAssertEqual(actual.count, g.optionCount, "\(shortId): optionCount mismatch")
            // Item-by-item to localise any single-field drift, then whole-array.
            XCTAssertEqual(actual.count, g.options.count, "\(shortId): option count vs decoded golden")
            for (index, expected) in g.options.enumerated() where index < actual.count {
                XCTAssertEqual(actual[index], expected, "\(shortId): option[\(index)] (id=\(expected.id)) mismatch")
            }
            XCTAssertEqual(actual, g.options, "\(shortId): full option list mismatch")

            for probe in g.validation {
                XCTAssertEqual(
                    ReplacementEngine.validateReplacementExerciseId(probe.id), probe.value,
                    "\(shortId): validateReplacementExerciseId(\(probe.id))"
                )
            }
            for probe in g.synthetic {
                XCTAssertEqual(
                    ReplacementEngine.isSyntheticReplacementExerciseId(probe.id), probe.value,
                    "\(shortId): isSyntheticReplacementExerciseId(\(probe.id))"
                )
            }

            XCTAssertEqual(g.envelope?.sourceFixtureId, "replacement-engine/\(shortId)", "\(shortId): envelope id")
            XCTAssertEqual(g.envelope?.generatorVersion, "v1", "\(shortId): envelope version")
        }
    }

    /// The validation/synthetic fixture must actually carry probes (guards against a
    /// silently-emptied fixture that would make the probe loops vacuous).
    func testValidationSyntheticFixtureCarriesProbes() throws {
        let g = try ReplacementEngineGoldens.decodeOutput("validation-synthetic-v1")
        XCTAssertGreaterThanOrEqual(g.validation.count, 8)
        XCTAssertGreaterThanOrEqual(g.synthetic.count, 8)
        // It also yields a non-empty option list (lat-pulldown, no equipment).
        XCTAssertFalse(g.options.isEmpty)
    }

    // MARK: - (B) Knowledge snapshot parity (ported tables vs the generated golden)

    func testKnowledgeSnapshotCountsAndKeySets() throws {
        let root = try ReplacementEngineGoldens.root(ReplacementEngineGoldens.knowledgeSnapshotId)
        let chains = try XCTUnwrap(root.optionalObject("equivalenceChains"), "missing equivalenceChains")
        let knowledge = try XCTUnwrap(root.optionalObject("knowledge"), "missing knowledge")

        // Key sets match exactly — no chain key / override id dropped or invented.
        let swiftChainKeys = Set(ReplacementEngineKnowledge.equivalenceChainEntries.map { $0.key })
        XCTAssertEqual(swiftChainKeys, Set(chains.keys), "equivalence-chain key set differs from golden")
        XCTAssertEqual(Set(ReplacementEngineKnowledge.knowledge.keys), Set(knowledge.keys), "override id set differs from golden")

        // Counts cross-check against the snapshot counts + the committed table sizes.
        if let counts = root.optionalObject("counts") {
            XCTAssertEqual(counts.optionalInt("equivalenceChainKeys"), ReplacementEngineKnowledge.equivalenceChainEntries.count)
            XCTAssertEqual(counts.optionalInt("knowledgeOverrideIds"), ReplacementEngineKnowledge.knowledge.count)
        }
        XCTAssertEqual(ReplacementEngineKnowledge.equivalenceChainEntries.count, 60)
        XCTAssertEqual(ReplacementEngineKnowledge.knowledge.count, 63)
    }

    func testEveryEquivalenceChainMatchesGolden() throws {
        let root = try ReplacementEngineGoldens.root(ReplacementEngineGoldens.knowledgeSnapshotId)
        let chains = try XCTUnwrap(root.optionalObject("equivalenceChains"))
        for exerciseId in chains.keys {
            let gChain = try XCTUnwrap(chains.rawValue(exerciseId)).requireObject("chain[\(exerciseId)]")
            let goldenId = try gChain.requireString("id", "chain[\(exerciseId)]")
            let goldenMembers = gChain.optionalStringArray("members") ?? []
            let sChain = ReplacementEngineKnowledge.equivalenceChainEntries.first { $0.key == exerciseId }?.value
            XCTAssertEqual(sChain?.id, goldenId, "chain id mismatch for \(exerciseId)")
            XCTAssertEqual(sChain?.members, goldenMembers, "chain members mismatch for \(exerciseId)")
        }
    }

    func testEveryKnowledgeEntryMatchesGoldenItemByItem() throws {
        let root = try ReplacementEngineGoldens.root(ReplacementEngineGoldens.knowledgeSnapshotId)
        let knowledge = try XCTUnwrap(root.optionalObject("knowledge"))
        for id in knowledge.keys {
            let gEntry = try XCTUnwrap(knowledge.rawValue(id)).requireObject("knowledge[\(id)]")
            let sEntry = try XCTUnwrap(ReplacementEngineKnowledge.knowledge[id], "missing ported knowledge for \(id)")

            XCTAssertEqual(sEntry.fatigueCost, gEntry.optionalString("fatigueCost"), "fatigueCost \(id)")
            XCTAssertEqual(sEntry.equivalenceChainId, gEntry.optionalString("equivalenceChainId"), "equivalenceChainId \(id)")
            XCTAssertEqual(sEntry.alternativeIds, gEntry.optionalStringArray("alternativeIds"), "alternativeIds \(id)")
            XCTAssertEqual(sEntry.regressionIds, gEntry.optionalStringArray("regressionIds"), "regressionIds \(id)")
            XCTAssertEqual(sEntry.progressionIds, gEntry.optionalStringArray("progressionIds"), "progressionIds \(id)")

            let goldenPriorities: [String: String]? = gEntry.optionalObject("alternativePriorities").map { obj in
                var map: [String: String] = [:]
                for key in obj.keys { if let v = obj.optionalString(key) { map[key] = v } }
                return map
            }
            XCTAssertEqual(sEntry.alternativePriorities, goldenPriorities, "alternativePriorities \(id)")

            // No legacy web schema override carries equipmentTags, so it must be absent on both sides.
            XCTAssertNil(gEntry.optionalStringArray("equipmentTags"), "golden equipmentTags should be absent for \(id)")
            XCTAssertNil(sEntry.equipmentTags, "ported equipmentTags should be nil for \(id)")
        }
    }

    // MARK: - (C) Unit tests pinning ported pure behaviour

    /// normalizeName uses the `/[（）()\\s-]/g` char set { （ ） ( ) \ s - }: it
    /// strips a literal lowercase 's' (case-sensitive, before lowercasing) and a
    /// literal backslash, but NOT whitespace (the `\\s` quirk). Pins it exactly.
    func testNormalizeNameDoubleBackslashQuirk() {
        // hyphen + both lowercase 's' stripped → "benchpre".
        XCTAssertEqual(ReplacementEngine.normalizeName("bench-press"), "benchpre")
        // space is NOT stripped; lowercase 's' absent (uppercase S survives the strip).
        XCTAssertEqual(ReplacementEngine.normalizeName("Seated Row"), "seated row")
        // lowercase 's' stripped from an already-lowercase token.
        XCTAssertEqual(ReplacementEngine.normalizeName("smith"), "mith")
        // uppercase 'S' survives the (case-sensitive) strip, THEN is lowercased.
        XCTAssertEqual(ReplacementEngine.normalizeName("Smith"), "smith")
        // literal backslash + parens stripped; Chinese untouched.
        XCTAssertEqual(ReplacementEngine.normalizeName("（深\\蹲）"), "深蹲")
    }

    /// baseExerciseId precedence + the `__alt_` split tail (replacementEngine.ts:157).
    func testBaseExerciseId() {
        XCTAssertEqual(ReplacementEngine.baseExerciseId(ReplacementExerciseInput(id: "bench-press")), "bench-press")
        // synthetic id → split on "__alt_" → base.
        XCTAssertEqual(ReplacementEngine.baseExerciseId(ReplacementExerciseInput(id: "bench-press__alt_2")), "bench-press")
        // originalExerciseId wins over everything.
        XCTAssertEqual(
            ReplacementEngine.baseExerciseId(ReplacementExerciseInput(id: "squat__alt_1", originalExerciseId: "squat")),
            "squat"
        )
        // canonicalExerciseId is consulted before id for the split base.
        XCTAssertEqual(
            ReplacementEngine.baseExerciseId(ReplacementExerciseInput(id: "x", canonicalExerciseId: "leg-press__alt_9")),
            "leg-press"
        )
    }

    /// isSyntheticReplacementExerciseId regex boundaries (replacementEngine.ts:120).
    func testIsSyntheticBoundaries() {
        for synthetic in ["x__alt_1", "x__alt", "x__auto_alt_1", "x__auto_alt", "a__alt_b", "bench-press__alt_3"] {
            XCTAssertTrue(ReplacementEngine.isSyntheticReplacementExerciseId(synthetic), synthetic)
        }
        for plain in ["bench-press", "", "altitude", "foo__altx", "alt"] {
            XCTAssertFalse(ReplacementEngine.isSyntheticReplacementExerciseId(plain), plain)
        }
        XCTAssertFalse(ReplacementEngine.isSyntheticReplacementExerciseId(nil))
    }

    /// validateReplacementExerciseId: known ids true; synthetic / unknown / blank false.
    func testValidate() {
        XCTAssertTrue(ReplacementEngine.validateReplacementExerciseId("bench-press"))
        XCTAssertTrue(ReplacementEngine.validateReplacementExerciseId("  squat  "))  // trimmed
        XCTAssertTrue(ReplacementEngine.validateReplacementExerciseId("leg-extension"))
        XCTAssertFalse(ReplacementEngine.validateReplacementExerciseId("totally-unknown"))
        XCTAssertFalse(ReplacementEngine.validateReplacementExerciseId(""))
        XCTAssertFalse(ReplacementEngine.validateReplacementExerciseId("   "))
        XCTAssertFalse(ReplacementEngine.validateReplacementExerciseId("bench-press__alt_1"))  // synthetic
        XCTAssertFalse(ReplacementEngine.validateReplacementExerciseId(nil))
    }

    /// The bench-press source filters the four forbiddenBenchReplacementIds out of
    /// its options (replacementEngine.ts:53, 321).
    func testForbiddenBenchReplacementIdsExcluded() {
        let options = ReplacementEngine.buildReplacementOptions(ReplacementExerciseInput(id: "bench-press"))
        let ids = Set(options.map { $0.id })
        for forbidden in ["triceps-pushdown", "shoulder-press", "machine-shoulder-press", "cable-fly"] {
            XCTAssertFalse(ids.contains(forbidden), "bench-press options must not include \(forbidden)")
        }
        XCTAssertEqual(options.map { $0.id }, ["db-bench-press", "machine-chest-press", "incline-db-press", "push-up"])
    }

    /// When the source has NO override alternativeIds, buildReplacementOptions falls
    /// back to the per-exercise `alternativeIds` + `alternativePriorities`
    /// (replacementEngine.ts:310-311). leg-extension carries fatigueCost only.
    func testExerciseLevelAlternativeIdsFallback() {
        let exercise = ReplacementExerciseInput(
            id: "leg-extension",
            alternativeIds: ["leg-curl", "seated-leg-curl", "leg-extension"],
            alternativePriorities: ["leg-curl": "priority"]
        )
        let options = ReplacementEngine.buildReplacementOptions(exercise)
        // leg-extension == sourceId is filtered; the other two survive.
        XCTAssertEqual(options.map { $0.id }, ["leg-curl", "seated-leg-curl"])
        XCTAssertEqual(options.first?.rank, .priority)
    }
}
