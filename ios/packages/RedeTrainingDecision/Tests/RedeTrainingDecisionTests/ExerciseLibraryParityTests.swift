// SR-1 — Exercise Library parity + parse-function tests.
//
// (A) PARITY: reconstructs the id→{displayName,englishName,equipmentTags,aliases}
//     snapshot from the ported `ExerciseLibrary` tables and asserts it equals the
//     GENERATED `exercise-library/library-snapshot-v1` golden item-by-item — the
//     same committed golden the legacy web schema parity generator produces (read via a #filePath
//     walk-up; no copies, no drift). This mechanically catches ANY dropped or
//     altered entry: the id universe, every per-field value, the equipment-tag
//     order, the alias order, and the EXERCISE_KNOWLEDGE_OVERRIDES key set.
// (B) PARSE: representative-input unit tests pinning the ported pure functions to
//     legacy web schema behaviour (hit / alias / english-value / case / parenthetical / unknown /
//     collision / object-input).
//
// No engine logic is exercised (the replacement engine is SR-2/SR-3).

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

/// Golden-fixture loader for the SR-1 library snapshot. Reads the canonical repo
/// golden under ios/ParityFixtures/parity/golden/exercise-library/ via a #filePath
/// walk-up. Mirrors `SmartReplacementGoldens`.
enum ExerciseLibraryGolden {
    static let fixtureId = "exercise-library/library-snapshot-v1"

    /// Repo root, resolved from this test file's compile-time path (6 levels up:
    /// RedeTrainingDecisionTests/ → Tests/ → RedeTrainingDecision/ →
    /// packages/ → ios/ → repo root).
    static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    static var goldenURL: URL {
        repoRoot.appendingPathComponent("ios/ParityFixtures/parity/golden/\(fixtureId).json", isDirectory: false)
    }

    /// One decoded `exercises[id]` record. A field is `nil` exactly when the golden
    /// omits it (i.e. that source table has no entry for the id).
    struct Entry: Equatable {
        var displayName: String?
        var englishName: String?
        var equipmentTags: [String]?
        var aliases: [String]?
    }

    struct Decoded {
        var exercises: [String: Entry]
        var orderedIds: [String]
        var knowledgeOverrideIds: [String]
        var counts: [String: Int]
        var envelope: ParityGoldenEnvelope?
    }

    static func decode() throws -> Decoded {
        let data = try Data(contentsOf: goldenURL)
        let root = try JSONValue(decoding: data).requireObject("library-snapshot")

        var exercises: [String: Entry] = [:]
        var orderedIds: [String] = []
        if let exObj = root.optionalObject("exercises") {
            for id in exObj.keys {
                let entryObj = try exObj.rawValue(id)!.requireObject("exercises[\(id)]")
                exercises[id] = Entry(
                    displayName: entryObj.optionalString("displayName"),
                    englishName: entryObj.optionalString("englishName"),
                    equipmentTags: entryObj.optionalStringArray("equipmentTags"),
                    aliases: entryObj.optionalStringArray("aliases")
                )
                orderedIds.append(id)
            }
        }

        var counts: [String: Int] = [:]
        if let countsObj = root.optionalObject("counts") {
            for key in countsObj.keys {
                if let n = countsObj.optionalInt(key) { counts[key] = n }
            }
        }

        let envelope: ParityGoldenEnvelope?
        if let pg = root.rawValue("parityGolden"), !pg.isNull {
            envelope = try ParityGoldenEnvelope(decoding: pg)
        } else {
            envelope = nil
        }

        return Decoded(
            exercises: exercises,
            orderedIds: orderedIds,
            knowledgeOverrideIds: root.optionalStringArray("knowledgeOverrideIds") ?? [],
            counts: counts,
            envelope: envelope
        )
    }

    /// The SAME snapshot record, reconstructed from the ported Swift tables.
    static func swiftEntry(_ id: String) -> Entry {
        Entry(
            displayName: ExerciseLibrary.displayNames[id],
            englishName: ExerciseLibrary.englishNames[id],
            equipmentTags: ExerciseLibrary.equipmentTags[id]?.map { $0.rawValue },
            aliases: ExerciseLibrary.aliases[id]
        )
    }

    /// The Swift id universe = union of keys across the four tables.
    static var swiftIdUniverse: Set<String> {
        var ids = Set(ExerciseLibrary.displayNames.keys)
        ids.formUnion(ExerciseLibrary.englishNames.keys)
        ids.formUnion(ExerciseLibrary.equipmentTags.keys)
        ids.formUnion(ExerciseLibrary.aliases.keys)
        return ids
    }
}

final class ExerciseLibraryParityTests: XCTestCase {
    // MARK: - (A) Parity: data tables vs the generated golden

    // (1) The golden file exists and decodes with its parityGolden envelope.
    func testGoldenDiscoveredAndEnvelope() throws {
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: ExerciseLibraryGolden.goldenURL.path),
            "missing golden \(ExerciseLibraryGolden.goldenURL.path)"
        )
        let g = try ExerciseLibraryGolden.decode()
        XCTAssertEqual(g.envelope?.sourceFixtureId, ExerciseLibraryGolden.fixtureId)
        XCTAssertEqual(g.envelope?.generatorVersion, "v1")
        XCTAssertFalse(g.exercises.isEmpty)
    }

    // (2) The id universe matches EXACTLY — no exercise dropped, none invented.
    func testIdUniverseMatchesGolden() throws {
        let g = try ExerciseLibraryGolden.decode()
        XCTAssertEqual(
            ExerciseLibraryGolden.swiftIdUniverse,
            Set(g.exercises.keys),
            "Swift library id set differs from the golden id set"
        )
        // The golden id keys are unique (object), and the ordered scan saw them all.
        XCTAssertEqual(Set(g.orderedIds).count, g.orderedIds.count)
    }

    // (3) Every per-id record (displayName / englishName / equipmentTags / aliases,
    //     including array ORDER) equals the golden — the core transcription lock.
    func testEveryEntryMatchesGoldenItemByItem() throws {
        let g = try ExerciseLibraryGolden.decode()
        for (id, goldenEntry) in g.exercises {
            XCTAssertEqual(ExerciseLibraryGolden.swiftEntry(id), goldenEntry, "entry mismatch for id=\(id)")
        }
    }

    // (4) Every equipment tag string in the golden resolves to a typed enum case —
    //     catches a new legacy web schema tag the Swift `ExerciseEquipmentTag` enum would miss.
    func testEveryEquipmentTagResolvesToEnum() throws {
        let g = try ExerciseLibraryGolden.decode()
        for (id, entry) in g.exercises {
            for tag in entry.equipmentTags ?? [] {
                XCTAssertNotNil(ExerciseEquipmentTag(rawValue: tag), "unknown equipment tag '\(tag)' for id=\(id)")
            }
        }
    }

    // (5) The EXERCISE_KNOWLEDGE_OVERRIDES key set matches the golden exactly.
    func testKnowledgeOverrideIdsMatchGolden() throws {
        let g = try ExerciseLibraryGolden.decode()
        XCTAssertEqual(ExerciseLibrary.knowledgeOverrideIds, Set(g.knowledgeOverrideIds))
        // Invariant the resolve() redundancy comment relies on: every override id is
        // also a display-name id (so the override fast-path term changes no outcome).
        for id in ExerciseLibrary.knowledgeOverrideIds {
            XCTAssertNotNil(ExerciseLibrary.displayNames[id], "override id \(id) is not a display-name id")
        }
    }

    // (6) The generator's counts agree with the ported tables (cross-check).
    func testCountsAgreeWithTables() throws {
        let g = try ExerciseLibraryGolden.decode()
        XCTAssertEqual(ExerciseLibrary.displayNames.count, g.counts["displayNames"])
        XCTAssertEqual(ExerciseLibrary.englishNames.count, g.counts["englishNames"])
        XCTAssertEqual(ExerciseLibrary.equipmentTags.count, g.counts["equipmentTags"])
        XCTAssertEqual(ExerciseLibrary.aliases.count, g.counts["aliases"])
        XCTAssertEqual(ExerciseLibrary.knowledgeOverrideIds.count, g.counts["knowledgeOverrideIds"])
        XCTAssertEqual(ExerciseLibraryGolden.swiftIdUniverse.count, g.counts["distinctIds"])
        // The committed library carries exactly the expected entry counts.
        XCTAssertEqual(ExerciseLibrary.displayNames.count, 94)
        XCTAssertEqual(ExerciseLibrary.equipmentTags.count, 61)
        XCTAssertEqual(ExerciseLibrary.englishNames.count, 63)
        XCTAssertEqual(ExerciseLibrary.aliases.count, 59)
        XCTAssertEqual(ExerciseLibrary.knowledgeOverrideIds.count, 63)
    }

    // (7) The ordered tables and the derived dictionaries carry the same entries
    //     (no duplicate key silently collapsed when building the lookup dicts).
    func testOrderedTablesMatchDerivedDictionaries() {
        XCTAssertEqual(ExerciseLibrary.displayNameEntries.count, ExerciseLibrary.displayNames.count)
        XCTAssertEqual(ExerciseLibrary.equipmentTagEntries.count, ExerciseLibrary.equipmentTags.count)
        XCTAssertEqual(ExerciseLibrary.englishNameEntries.count, ExerciseLibrary.englishNames.count)
        XCTAssertEqual(ExerciseLibrary.aliasEntries.count, ExerciseLibrary.aliases.count)
    }

    // MARK: - (B) Parse functions vs legacy web schema behaviour

    // getExerciseNameEntry (exerciseLibrary.ts:317)
    func testGetExerciseNameEntry() {
        XCTAssertEqual(
            ExerciseLibrary.getExerciseNameEntry("bench-press"),
            ExerciseName(zh: "平板卧推", en: "Barbell Bench Press", aliases: ["卧推", "平板杠铃卧推", "Barbell Bench Press"])
        )
        // display + english present, no aliases.
        XCTAssertEqual(
            ExerciseLibrary.getExerciseNameEntry("leg-extension"),
            ExerciseName(zh: "腿屈伸", en: "Leg Extension", aliases: nil)
        )
        // display only.
        XCTAssertEqual(
            ExerciseLibrary.getExerciseNameEntry("face_pull"),
            ExerciseName(zh: "面拉", en: nil, aliases: nil)
        )
        // unknown id → empty zh, nil en/aliases.
        XCTAssertEqual(
            ExerciseLibrary.getExerciseNameEntry("totally-unknown"),
            ExerciseName(zh: "", en: nil, aliases: nil)
        )
    }

    // normalizeExerciseReference (exerciseLibrary.ts:374)
    func testNormalizeExerciseReference() {
        XCTAssertEqual(ExerciseLibrary.normalizeExerciseReference("  Bench-Press  "), "benchpress")
        XCTAssertEqual(ExerciseLibrary.normalizeExerciseReference("平板卧推（Barbell）"), "平板卧推")
        XCTAssertEqual(ExerciseLibrary.normalizeExerciseReference("T 杠划船"), "t杠划船")
        XCTAssertEqual(ExerciseLibrary.normalizeExerciseReference("a_b-c/d|e"), "abcde")
        XCTAssertEqual(ExerciseLibrary.normalizeExerciseReference(""), "")
    }

    // resolveExerciseReferenceToId (exerciseLibrary.ts:381)
    func testResolveExerciseReferenceToId() {
        // id fast path
        XCTAssertEqual(ExerciseLibrary.resolveExerciseReferenceToId("bench-press"), "bench-press")
        XCTAssertEqual(ExerciseLibrary.resolveExerciseReferenceToId("deadlift"), "deadlift")
        // english VALUE (via normalized english loop)
        XCTAssertEqual(ExerciseLibrary.resolveExerciseReferenceToId("Barbell Bench Press"), "bench-press")
        // case-insensitive
        XCTAssertEqual(ExerciseLibrary.resolveExerciseReferenceToId("BARBELL BENCH PRESS"), "bench-press")
        // alias hit
        XCTAssertEqual(ExerciseLibrary.resolveExerciseReferenceToId("卧推"), "bench-press")
        // display label hit
        XCTAssertEqual(ExerciseLibrary.resolveExerciseReferenceToId("深蹲"), "squat")
        // parenthetical stripped, matches display label
        XCTAssertEqual(ExerciseLibrary.resolveExerciseReferenceToId("平板卧推（Barbell Bench Press）"), "bench-press")
        // collision: both face-pull & face_pull normalize to 面拉 — legacy web schema insertion
        // order returns the FIRST (face-pull). Pins the ordered-iteration contract.
        XCTAssertEqual(ExerciseLibrary.resolveExerciseReferenceToId("面拉"), "face-pull")
        // unknown / empty / whitespace
        XCTAssertNil(ExerciseLibrary.resolveExerciseReferenceToId("nonexistent-xyz-123"))
        XCTAssertNil(ExerciseLibrary.resolveExerciseReferenceToId(""))
        XCTAssertNil(ExerciseLibrary.resolveExerciseReferenceToId("   "))
    }

    // formatExerciseDisplayName (exerciseLibrary.ts:323)
    func testFormatExerciseDisplayNameString() {
        XCTAssertEqual(ExerciseLibrary.formatExerciseDisplayName(.string("bench-press")), "平板卧推")
        XCTAssertEqual(
            ExerciseLibrary.formatExerciseDisplayName(.string("bench-press"), bilingual: true),
            "平板卧推（Barbell Bench Press）"
        )
        // already-Chinese string returns verbatim
        XCTAssertEqual(ExerciseLibrary.formatExerciseDisplayName(.string("平板卧推")), "平板卧推")
        // unknown id → fallback (default + custom)
        XCTAssertEqual(ExerciseLibrary.formatExerciseDisplayName(.string("unknown-xyz")), "未命名动作")
        XCTAssertEqual(
            ExerciseLibrary.formatExerciseDisplayName(.string("unknown-xyz"), fallback: "占位"),
            "占位"
        )
    }

    func testFormatExerciseDisplayNameObject() {
        // object id field
        XCTAssertEqual(ExerciseLibrary.formatExerciseDisplayName(objectValue(["actualExerciseId": "squat"])), "深蹲")
        // object id field, bilingual
        XCTAssertEqual(
            ExerciseLibrary.formatExerciseDisplayName(objectValue(["id": "leg-extension"]), bilingual: true),
            "腿屈伸（Leg Extension）"
        )
        // nameZh wins
        XCTAssertEqual(ExerciseLibrary.formatExerciseDisplayName(objectValue(["nameZh": "自定义动作"])), "自定义动作")
        // nested name {zh,en}
        let nested = JSONValue.object(OrderedJSONObject(entries: [
            .init(key: "name", value: .object(OrderedJSONObject(entries: [
                .init(key: "zh", value: .string("甲动作")),
                .init(key: "en", value: .string("Exercise A")),
            ]))),
        ]))
        XCTAssertEqual(ExerciseLibrary.formatExerciseDisplayName(nested), "甲动作")
        XCTAssertEqual(ExerciseLibrary.formatExerciseDisplayName(nested, bilingual: true), "甲动作（Exercise A）")
        // Chinese alias fallback (no id, no name)
        XCTAssertEqual(ExerciseLibrary.formatExerciseDisplayName(objectValue(["alias": "农夫走"])), "农夫走")
    }

    // mapLegacyAlternativeLabelsToIds (exerciseLibrary.ts:398)
    func testMapLegacyAlternativeLabelsToIds() {
        let result = ExerciseLibrary.mapLegacyAlternativeLabelsToIds(["卧推", "深蹲", "卧推", "garbage-xyz"])
        XCTAssertEqual(result.ids, ["bench-press", "squat"]) // deduped, order-preserving
        XCTAssertEqual(result.warnings.count, 1)
        XCTAssertEqual(result.warnings.first, "替代动作「garbage-xyz」无法映射到动作库 ID，已从可选替代列表跳过。")
        // empty input → empty result
        let empty = ExerciseLibrary.mapLegacyAlternativeLabelsToIds([])
        XCTAssertTrue(empty.ids.isEmpty)
        XCTAssertTrue(empty.warnings.isEmpty)
    }

    // MARK: - Helpers

    private func objectValue(_ pairs: [String: String]) -> JSONValue {
        // Deterministic order not required: formatExerciseDisplayName reads fields by key.
        .object(OrderedJSONObject(entries: pairs.map { .init(key: $0.key, value: .string($0.value)) }))
    }
}
