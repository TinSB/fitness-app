// PA-S0 — i18n/terms parity test.
//
// Reconstructs the eleven-table label snapshot from the ported `Terms` namespace
// and asserts it equals the GENERATED `i18n/terms-snapshot-v1` golden
// entry-by-entry — the same committed golden the legacy web schema parity generator produces
// (read via a #filePath walk-up to the canonical repo golden; no copy, no
// drift). This mechanically catches ANY dropped or altered label: the table
// universe, every key, every Chinese value, the per-table counts, and the
// `term()` lookup. Foundation-only (`JSONSerialization`) so the test stays
// self-contained in `IronPathL10nTests` — no IronPathDomain dependency, no
// `Package.swift` change.

import XCTest
@testable import IronPathL10n

/// Golden-fixture loader for the PA-S0 terms snapshot. Reads the canonical repo
/// golden under ios/ParityFixtures/parity/golden/i18n/ via a #filePath walk-up.
/// Mirrors `ExerciseLibraryGolden` / `SmartReplacementGoldens`.
enum TermsGolden {
    static let fixtureId = "i18n/terms-snapshot-v1"

    /// The eleven ported tables, keyed by their legacy web schema export name (the same keys the
    /// generator dumps under `tables`).
    static let swiftTables: [String: [String: String]] = [
        "TERMS": Terms.terms,
        "PHASE_LABELS": Terms.phaseLabels,
        "EFFECTIVE_PHASE_DISPLAY_LABELS": Terms.effectivePhaseDisplayLabels,
        "INTENSITY_BIAS_LABELS": Terms.intensityBiasLabels,
        "TECHNIQUE_QUALITY_LABELS": Terms.techniqueQualityLabels,
        "SUPPORT_BLOCK_LABELS": Terms.supportBlockLabels,
        "SKIP_REASON_LABELS": Terms.skipReasonLabels,
        "DELOAD_LEVEL_LABELS": Terms.deloadLevelLabels,
        "DELOAD_STRATEGY_LABELS": Terms.deloadStrategyLabels,
        "READINESS_ADJUSTMENT_LABELS": Terms.readinessAdjustmentLabels,
        "MUSCLE_LABELS": Terms.muscleLabels,
    ]

    /// Repo root, resolved from this test file's compile-time path (6 levels up:
    /// IronPathL10nTests/ → Tests/ → IronPathL10n/ → packages/ → ios/ → repo root).
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

    struct Decoded {
        var tables: [String: [String: String]]
        var counts: [String: Int]
        var termProbes: [String: String]
        var sourceFixtureId: String?
        var generatorVersion: String?
    }

    static func decode() throws -> Decoded {
        let data = try Data(contentsOf: goldenURL)
        let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]

        var tables: [String: [String: String]] = [:]
        if let tablesObj = root["tables"] as? [String: Any] {
            for (name, raw) in tablesObj {
                tables[name] = (raw as? [String: Any])?.compactMapValues { $0 as? String } ?? [:]
            }
        }

        var counts: [String: Int] = [:]
        if let countsObj = root["counts"] as? [String: Any] {
            for (key, raw) in countsObj {
                if let n = (raw as? NSNumber)?.intValue { counts[key] = n }
            }
        }

        var termProbes: [String: String] = [:]
        if let probesObj = root["termProbes"] as? [String: Any] {
            for (key, raw) in probesObj {
                if let v = raw as? String { termProbes[key] = v }
            }
        }

        let envelope = root["parityGolden"] as? [String: Any]
        return Decoded(
            tables: tables,
            counts: counts,
            termProbes: termProbes,
            sourceFixtureId: envelope?["sourceFixtureId"] as? String,
            generatorVersion: envelope?["generatorVersion"] as? String
        )
    }
}

final class TermsParityTests: XCTestCase {
    // (1) The golden file exists and decodes with its parityGolden envelope.
    func testGoldenDiscoveredAndEnvelope() throws {
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: TermsGolden.goldenURL.path),
            "missing golden \(TermsGolden.goldenURL.path)"
        )
        let g = try TermsGolden.decode()
        XCTAssertEqual(g.sourceFixtureId, TermsGolden.fixtureId)
        XCTAssertEqual(g.generatorVersion, "v1")
        XCTAssertFalse(g.tables.isEmpty)
    }

    // (2) The table universe matches EXACTLY — no table dropped, none invented.
    func testTableUniverseMatchesGolden() throws {
        let g = try TermsGolden.decode()
        XCTAssertEqual(
            Set(TermsGolden.swiftTables.keys),
            Set(g.tables.keys),
            "Swift terms table set differs from the golden table set"
        )
        XCTAssertEqual(g.tables.count, 11)
    }

    // (3) Every table matches the golden key-by-key + value-by-value (Chinese
    //     labels verbatim) — the core transcription lock.
    func testEveryTableMatchesGoldenItemByItem() throws {
        let g = try TermsGolden.decode()
        for (name, swiftTable) in TermsGolden.swiftTables {
            guard let goldenTable = g.tables[name] else {
                XCTFail("golden missing table \(name)")
                continue
            }
            XCTAssertEqual(swiftTable, goldenTable, "table mismatch for \(name)")
        }
    }

    // (4) The generator's counts agree with the ported tables, and the exact
    //     committed entry counts are pinned (11 tables; per-table sizes).
    func testCountsAgreeWithTables() throws {
        let g = try TermsGolden.decode()
        XCTAssertEqual(g.counts["tables"], 11)
        for (name, swiftTable) in TermsGolden.swiftTables {
            XCTAssertEqual(g.counts[name], swiftTable.count, "count mismatch for \(name)")
        }
        // The committed terms tables carry exactly these entry counts.
        XCTAssertEqual(Terms.terms.count, 24)
        XCTAssertEqual(Terms.phaseLabels.count, 4)
        XCTAssertEqual(Terms.effectivePhaseDisplayLabels.count, 6)
        XCTAssertEqual(Terms.intensityBiasLabels.count, 3)
        XCTAssertEqual(Terms.techniqueQualityLabels.count, 3)
        XCTAssertEqual(Terms.supportBlockLabels.count, 2)
        XCTAssertEqual(Terms.skipReasonLabels.count, 7)
        XCTAssertEqual(Terms.deloadLevelLabels.count, 4)
        XCTAssertEqual(Terms.deloadStrategyLabels.count, 4)
        XCTAssertEqual(Terms.readinessAdjustmentLabels.count, 4)
        XCTAssertEqual(Terms.muscleLabels.count, 5)
    }

    // (5) `term(key)` reproduces every echoed probe (== TERMS[key]).
    func testTermProbesMatchGolden() throws {
        let g = try TermsGolden.decode()
        XCTAssertFalse(g.termProbes.isEmpty)
        // The probe set is the full TERMS key universe.
        XCTAssertEqual(Set(g.termProbes.keys), Set(Terms.terms.keys))
        for (key, value) in g.termProbes {
            XCTAssertEqual(Terms.term(key), value, "term(\(key)) mismatch")
        }
    }

    // (6) `term()` behaviour: a known key returns its label; an unknown key → nil
    //     (the faithful Swift equivalent of legacy web schema `keyof typeof TERMS` totality).
    func testTermLookupBehaviour() {
        XCTAssertEqual(Terms.term("readinessScore"), "准备度评分")
        XCTAssertEqual(Terms.term("RIR"), "RIR")
        XCTAssertEqual(Terms.term("oneRm"), "1RM")
        XCTAssertNil(Terms.term("definitely-not-a-terms-key"))
        XCTAssertNil(Terms.term(""))
    }
}
