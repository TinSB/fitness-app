// PA-S3 — trainingData data-constant parity + count guards.
//
// Reconstructs the `default-program-data/snapshot-v1` snapshot from the ported
// Swift constants (DefaultTrainingData / SupportModules) and asserts it equals
// the GENERATED golden — the SAME committed golden the TS parity generator
// produces from src/data/* (read via a #filePath walk-up; no copies, no drift).
//
// Comparison is by CANONICAL JSON (both sides run through Swift's
// `JSONValue.canonicalJSONData()` — sorted keys, deterministic number emission),
// so it is robust to key order yet catches ANY dropped/added key, altered value,
// or reordered array element. This mechanically pins: every INITIAL_TEMPLATES
// template + each makeExercise product (id/name/alias/muscle/kind/sets/repMin/
// repMax/rest/startWeight/alternatives/alternativeIds/alternativePriorities),
// the DEFAULT_PROGRAM_TEMPLATE rich projection, every CORRECTION_MODULES /
// FUNCTIONAL_ADDONS field + nested exercise, and the full DEFAULT_SCREENING_PROFILE.
// Count guards (vs golden.counts + hardcoded literals) catch a silently
// dropped/added entry.
//
// No engine logic is exercised — this is a pure data + makeExercise-transform port.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

/// Golden-fixture loader for the PA-S3 default-program-data snapshot. Reads the
/// canonical repo golden via a #filePath walk-up (6 levels: tests dir → Tests/ →
/// IronPathTrainingDecision/ → packages/ → ios/ → repo root). Mirrors
/// `ExerciseLibraryGolden`.
enum DefaultProgramDataGolden {
    static let fixtureId = "default-program-data/snapshot-v1"

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
        repoRoot.appendingPathComponent("tests/fixtures/parity/golden/\(fixtureId).json", isDirectory: false)
    }

    static func decodeRoot() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: goldenURL)
        return try JSONValue(decoding: data).requireObject("default-program-data")
    }
}

final class DefaultProgramDataParityTests: XCTestCase {

    // Canonical-JSON bytes for a JSONValue (sorted keys, deterministic).
    private func canonical(_ value: JSONValue) throws -> Data {
        try value.canonicalJSONData()
    }

    private func canonicalString(_ value: JSONValue) throws -> String {
        String(decoding: try canonical(value), as: UTF8.self)
    }

    // MARK: - Envelope

    func testGoldenDiscoveredAndEnvelope() throws {
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: DefaultProgramDataGolden.goldenURL.path),
            "missing golden \(DefaultProgramDataGolden.goldenURL.path)"
        )
        let root = try DefaultProgramDataGolden.decodeRoot()
        let envelope = try ParityGoldenEnvelope(decoding: root.rawValue("parityGolden")!)
        XCTAssertEqual(envelope.sourceFixtureId, DefaultProgramDataGolden.fixtureId)
        XCTAssertEqual(envelope.generatorVersion, "v1")
        // Pure data, no clock — generatedAtPolicy 'none', deterministicClockIso null.
        XCTAssertEqual(envelope.generatedAtPolicy, "none")
        XCTAssertNil(envelope.deterministicClockIso)
    }

    // MARK: - DEFAULT_PROGRAM_TEMPLATE (defaults.ts:83)

    func testDefaultProgramTemplateMatchesGolden() throws {
        let root = try DefaultProgramDataGolden.decodeRoot()
        let goldenValue = try XCTUnwrap(root.rawValue("defaultProgramTemplate"))
        let swiftValue = DefaultTrainingData.defaultProgramTemplate.encoded()
        XCTAssertEqual(
            try canonicalString(swiftValue),
            try canonicalString(goldenValue),
            "DEFAULT_PROGRAM_TEMPLATE projection differs from golden"
        )
    }

    // MARK: - INITIAL_TEMPLATES (defaultTemplates.ts:9) — includes makeExercise output

    func testInitialTemplatesMatchGoldenItemByItem() throws {
        let root = try DefaultProgramDataGolden.decodeRoot()
        let goldenArray = try XCTUnwrap(root.optionalArray("initialTemplates"))
        let swift = DefaultTrainingData.initialTemplates
        XCTAssertEqual(swift.count, goldenArray.count, "template count differs from golden")
        for (i, template) in swift.enumerated() {
            XCTAssertEqual(
                try canonicalString(template.encoded()),
                try canonicalString(goldenArray[i]),
                "INITIAL_TEMPLATES[\(i)] (id=\(template.id ?? "?")) differs from golden"
            )
        }
    }

    // MARK: - CORRECTION_MODULES (supportModules.ts:3)

    func testCorrectionModulesMatchGoldenItemByItem() throws {
        let root = try DefaultProgramDataGolden.decodeRoot()
        let goldenArray = try XCTUnwrap(root.optionalArray("correctionModules"))
        let swift = SupportModules.correctionModules
        XCTAssertEqual(swift.count, goldenArray.count, "correction-module count differs from golden")
        for (i, module) in swift.enumerated() {
            XCTAssertEqual(
                try canonicalString(module.encoded()),
                try canonicalString(goldenArray[i]),
                "CORRECTION_MODULES[\(i)] (id=\(module.id)) differs from golden"
            )
        }
    }

    // MARK: - FUNCTIONAL_ADDONS (supportModules.ts:185)

    func testFunctionalAddonsMatchGoldenItemByItem() throws {
        let root = try DefaultProgramDataGolden.decodeRoot()
        let goldenArray = try XCTUnwrap(root.optionalArray("functionalAddons"))
        let swift = SupportModules.functionalAddons
        XCTAssertEqual(swift.count, goldenArray.count, "functional-addon count differs from golden")
        for (i, addon) in swift.enumerated() {
            XCTAssertEqual(
                try canonicalString(addon.encoded()),
                try canonicalString(goldenArray[i]),
                "FUNCTIONAL_ADDONS[\(i)] (id=\(addon.id)) differs from golden"
            )
        }
    }

    // MARK: - DEFAULT_SCREENING_PROFILE (defaults.ts:47)

    func testDefaultScreeningProfileMatchesGolden() throws {
        let root = try DefaultProgramDataGolden.decodeRoot()
        let goldenValue = try XCTUnwrap(root.rawValue("defaultScreeningProfile"))
        let swiftValue = DefaultTrainingData.defaultScreeningProfile.encoded()
        XCTAssertEqual(
            try canonicalString(swiftValue),
            try canonicalString(goldenValue),
            "DEFAULT_SCREENING_PROFILE differs from golden"
        )
    }

    // MARK: - Count guards (vs golden.counts + the committed literals)

    func testCountsAgreeWithGoldenAndLiterals() throws {
        let root = try DefaultProgramDataGolden.decodeRoot()
        let counts = try XCTUnwrap(root.optionalObject("counts"))

        // Swift-derived counts.
        let templates = DefaultTrainingData.initialTemplates
        let templateExerciseCount = templates.reduce(0) { $0 + ($1.exercises?.count ?? 0) }
        let correctionExerciseCount = SupportModules.correctionModules.reduce(0) { $0 + $1.exercises.count }
        let functionalExerciseCount = SupportModules.functionalAddons.reduce(0) { $0 + $1.exercises.count }
        let dayTemplateCount = DefaultTrainingData.defaultProgramTemplate.dayTemplates?.count ?? 0
        let weeklyMuscleTargetCount = DefaultTrainingData.defaultProgramTemplate.weeklyMuscleTargets?.count ?? 0

        // Swift == golden.counts.
        XCTAssertEqual(templates.count, counts.optionalInt("initialTemplates"))
        XCTAssertEqual(templateExerciseCount, counts.optionalInt("totalTemplateExercises"))
        XCTAssertEqual(dayTemplateCount, counts.optionalInt("dayTemplates"))
        XCTAssertEqual(weeklyMuscleTargetCount, counts.optionalInt("weeklyMuscleTargets"))
        XCTAssertEqual(SupportModules.correctionModules.count, counts.optionalInt("correctionModules"))
        XCTAssertEqual(SupportModules.functionalAddons.count, counts.optionalInt("functionalAddons"))
        XCTAssertEqual(correctionExerciseCount, counts.optionalInt("correctionExercises"))
        XCTAssertEqual(functionalExerciseCount, counts.optionalInt("functionalExercises"))

        // The committed constants carry exactly the expected entry counts.
        XCTAssertEqual(templates.count, 8)
        XCTAssertEqual(templateExerciseCount, 44)
        XCTAssertEqual(dayTemplateCount, 8)
        XCTAssertEqual(weeklyMuscleTargetCount, 10)
        XCTAssertEqual(SupportModules.correctionModules.count, 11)
        XCTAssertEqual(SupportModules.functionalAddons.count, 6)
        XCTAssertEqual(correctionExerciseCount, 25)
        XCTAssertEqual(functionalExerciseCount, 11)
    }

    // MARK: - makeExercise transform spot-checks (the SR-1/SR-2 reuse + dedup semantics)

    func testMakeExerciseReusesAndDedupesAlternatives() throws {
        // bench-press: the 8 override alternativeIds; the two legacy labels
        // (器械推胸 / 哑铃卧推) both already resolve into that override set, so the
        // order-preserving dedup keeps exactly the override order, self-id filtered.
        let bench = try XCTUnwrap(DefaultTrainingData.initialTemplates.first?.exercises?.first)
        XCTAssertEqual(bench.id, "bench-press")
        XCTAssertEqual(
            bench.alternativeIds,
            ["db-bench-press", "machine-chest-press", "push-up", "incline-db-press", "cable-fly", "triceps-pushdown", "shoulder-press", "machine-shoulder-press"]
        )
        XCTAssertFalse(bench.alternativeIds?.contains("bench-press") ?? true, "self id must be filtered out")
        XCTAssertNotNil(bench.alternativePriorities, "bench-press carries override alternativePriorities")

        // startWeight 22.5 stays a decimal; 60 collapses to an integer (JS number semantics).
        let inclineDb = try XCTUnwrap(DefaultTrainingData.initialTemplates.first?.exercises?[1])
        XCTAssertEqual(inclineDb.id, "incline-db-press")
        XCTAssertEqual(inclineDb.startWeight, .double(22.5))
        XCTAssertEqual(bench.startWeight, .integer(60))
    }
}
