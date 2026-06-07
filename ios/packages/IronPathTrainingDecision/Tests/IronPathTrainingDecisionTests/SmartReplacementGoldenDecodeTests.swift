// SR-0 — smart-replacement golden decode tests. Proves the decode-only type
// skeleton decodes all 4 smart-replacement parity goldens, that count /
// priority-count integrity holds, that the set collectively covers all four
// SmartReplacementPriority values, that every recommendation's priority /
// fatigueCost resolves to a typed enum, that an unknown future key is tolerated
// and preserved, and that decode is value-stable. No engine logic is exercised
// (the engine port is SR-1+); these tests pin the OUTPUT SHAPE only.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

/// Shared golden-fixture loader. Reads the canonical repo goldens under
/// ios/ParityFixtures/parity/golden/smart-replacement/ via a #filePath walk-up, so
/// the package test consumes the SAME committed goldens the legacy web schema parity generator
/// produces — no copies, no drift. Mirrors `TrainingDecisionGoldens`.
enum SmartReplacementGoldens {
    /// The 4 smart-replacement golden fixture ids (without the `.json` suffix).
    static let allIds: [String] = [
        "explicit-priority-spread-v1",
        "bench-press-natural-v1",
        "low-readiness-fatigue-v1",
        "pain-history-substitute-v1",
    ]

    /// The controlled coverage anchor — its explicit alternativePriorities
    /// force all four SmartReplacementPriority values regardless of library data.
    static let anchorId = "explicit-priority-spread-v1"

    /// Repo root, resolved from this test file's compile-time path.
    static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    static var goldenDir: URL {
        repoRoot
            .appendingPathComponent("ios/ParityFixtures/parity/golden/smart-replacement", isDirectory: true)
    }

    static func goldenURL(_ id: String) -> URL {
        goldenDir.appendingPathComponent("\(id).json", isDirectory: false)
    }

    static func goldenData(_ id: String) throws -> Data {
        try Data(contentsOf: goldenURL(id))
    }

    static func decode(_ id: String) throws -> SmartReplacementGolden {
        try SmartReplacementGolden(decodingData: goldenData(id))
    }
}

final class SmartReplacementGoldenDecodeTests: XCTestCase {
    // (1) All 4 golden fixtures are discovered on disk.
    func testAllGoldenFixturesDiscovered() throws {
        XCTAssertEqual(SmartReplacementGoldens.allIds.count, 4)
        for id in SmartReplacementGoldens.allIds {
            let url = SmartReplacementGoldens.goldenURL(id)
            XCTAssertTrue(FileManager.default.fileExists(atPath: url.path), "missing golden \(id)")
        }
    }

    // (2) All 4 decode into SmartReplacementGolden with the always-present scalars.
    func testAllDecode() throws {
        for id in SmartReplacementGoldens.allIds {
            let g = try SmartReplacementGoldens.decode(id)
            XCTAssertEqual(g.sourceFixtureId, "smart-replacement/\(id)", "\(id)")
            XCTAssertFalse(g.currentExerciseId.isEmpty, "\(id) currentExerciseId")
            XCTAssertFalse(g.recommendations.isEmpty, "\(id) recommendations")
        }
    }

    // (3) recommendationCount matches the decoded array length.
    func testRecommendationCountMatchesArrayLength() throws {
        for id in SmartReplacementGoldens.allIds {
            let g = try SmartReplacementGoldens.decode(id)
            XCTAssertEqual(g.recommendationCount, g.recommendations.count, "\(id)")
        }
    }

    // (4) priorityCounts carries exactly the four priority rawValues, and its
    //     values sum to recommendationCount.
    func testPriorityCountsCarriesAllFourKeysAndSums() throws {
        let expectedKeys = Set(SmartReplacementPriority.allCases.map { $0.rawValue })
        for id in SmartReplacementGoldens.allIds {
            let g = try SmartReplacementGoldens.decode(id)
            XCTAssertEqual(Set(g.priorityCounts.keys), expectedKeys, "\(id) priorityCounts keys")
            let sum = g.priorityCounts.values.reduce(0, +)
            XCTAssertEqual(sum, g.recommendationCount, "\(id) priorityCounts sum")
        }
    }

    // (5) priorityCounts agrees with a recount of the decoded recommendations.
    func testPriorityCountsAgreeWithRecommendations() throws {
        for id in SmartReplacementGoldens.allIds {
            let g = try SmartReplacementGoldens.decode(id)
            for priority in SmartReplacementPriority.allCases {
                let recounted = g.recommendations.filter { $0.priorityEnum == priority }.count
                XCTAssertEqual(g.priorityCounts[priority.rawValue], recounted, "\(id) \(priority.rawValue)")
            }
        }
    }

    // (6) Every recommendation's priority + fatigueCost resolve to a typed enum.
    func testEveryRecommendationHasResolvableEnums() throws {
        for id in SmartReplacementGoldens.allIds {
            let g = try SmartReplacementGoldens.decode(id)
            for rec in g.recommendations {
                XCTAssertNotNil(rec.priorityEnum, "\(id) \(rec.exerciseId) priority=\(rec.priority)")
                XCTAssertNotNil(rec.fatigueCostEnum, "\(id) \(rec.exerciseId) fatigueCost=\(rec.fatigueCost)")
                XCTAssertFalse(rec.exerciseId.isEmpty, "\(id) exerciseId")
                XCTAssertFalse(rec.exerciseName.isEmpty, "\(id) exerciseName")
                XCTAssertFalse(rec.reason.isEmpty, "\(id) reason")
            }
        }
    }

    // (7) The controlled anchor fixture alone covers all four priorities.
    func testAnchorFixtureCoversAllFourPriorities() throws {
        let g = try SmartReplacementGoldens.decode(SmartReplacementGoldens.anchorId)
        XCTAssertEqual(g.presentPriorities, Set(SmartReplacementPriority.allCases))
    }

    // (8) The fixture set collectively covers all four priorities.
    func testUnionAcrossFixturesCoversAllFourPriorities() throws {
        var union: Set<SmartReplacementPriority> = []
        for id in SmartReplacementGoldens.allIds {
            union.formUnion(try SmartReplacementGoldens.decode(id).presentPriorities)
        }
        XCTAssertEqual(union, Set(SmartReplacementPriority.allCases))
    }

    // (9) The parityGolden envelope is present and well-formed on every golden.
    func testParityGoldenEnvelopePresent() throws {
        for id in SmartReplacementGoldens.allIds {
            let g = try SmartReplacementGoldens.decode(id)
            XCTAssertEqual(g.parityGolden?.sourceFixtureId, "smart-replacement/\(id)", "\(id)")
            XCTAssertEqual(g.parityGolden?.generatorVersion, "v1", "\(id)")
        }
    }

    // (10) An unknown future top-level key does not break decode and is kept.
    func testUnknownFutureKeyDoesNotBreakDecode() throws {
        let base = try SmartReplacementGoldens.goldenData(SmartReplacementGoldens.anchorId)
        let value = try JSONValue(decoding: base)
        guard case .object(let obj) = value else { return XCTFail("expected object") }
        let injected = OrderedJSONObject(entries: obj.entries + [
            .init(key: "futureFieldV99", value: .string("ignored-but-preserved")),
        ])
        let g = try SmartReplacementGolden(decoding: .object(injected))
        XCTAssertEqual(g.currentExerciseId, "bench-press")
        XCTAssertEqual(g.unknown["futureFieldV99"]?.stringValue, "ignored-but-preserved")
    }

    // (11) Decode is value-stable (Equatable; no shared mutable state).
    func testDecodedValueIsStable() throws {
        for id in SmartReplacementGoldens.allIds {
            let a = try SmartReplacementGoldens.decode(id)
            let b = try SmartReplacementGoldens.decode(id)
            XCTAssertEqual(a, b, "\(id)")
        }
    }
}
