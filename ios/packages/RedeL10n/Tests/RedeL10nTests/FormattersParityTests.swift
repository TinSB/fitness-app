// PA-S4 — i18n/formatters PA-subset parity test.
//
// Reconciles the ported `Formatters` namespace against the GENERATED
// `i18n/formatters-pa-snapshot-v1` golden (read via a #filePath walk-up to the
// canonical repo golden — no copy, no drift). Two layers:
//   (A) PARITY — reconstructs the two tables from `Formatters` + re-runs every
//       branch-covering probe input through the Swift formatters, asserting each
//       equals the golden (the same committed golden the legacy web schema parity generator
//       produces by running the REAL formatters). This mechanically catches any
//       dropped/altered map entry, branch, regex, normalization step, or fallback.
//   (B) PARSE — direct representative assertions on each formatter (map hit /
//       normalize / camelCase / parens-strip / localize / already-CJK / residual-
//       English-word fallback / object id+nameZh / no-hit fallback / empty / null /
//       all 7 change labels + unknown / custom fallbackLabel).
//
// Foundation-only (`JSONSerialization`) so the test stays self-contained in
// `RedeL10nTests` — no RedeDomain / RedeTrainingDecision dependency,
// no `Package.swift` change (RedeL10n stays a zero-dependency leaf).

import XCTest
@testable import RedeL10n

/// Golden-fixture loader for the PA-S4 formatters snapshot. Mirrors
/// `TermsGolden` / `ExerciseLibraryGolden`.
enum FormattersGolden {
    static let fixtureId = "i18n/formatters-pa-snapshot-v1"

    /// Repo root, resolved from this test file's compile-time path (6 levels up:
    /// RedeL10nTests/ → Tests/ → RedeL10n/ → packages/ → ios/ → repo root).
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

    /// One golden probe: the echoed input (raw JSON value) + the expected output.
    struct Probe {
        var inputRaw: Any?
        var expected: String
    }

    struct Decoded {
        var tables: [String: [String: String]]
        var counts: [String: Int]
        var probes: [String: [Probe]]
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

        var probes: [String: [Probe]] = [:]
        if let probesObj = root["probes"] as? [String: Any] {
            for (fn, raw) in probesObj {
                guard let arr = raw as? [[String: Any]] else { continue }
                probes[fn] = arr.map { rec in
                    Probe(inputRaw: rec["input"], expected: (rec["expected"] as? String) ?? "")
                }
            }
        }

        let envelope = root["parityGolden"] as? [String: Any]
        return Decoded(
            tables: tables,
            counts: counts,
            probes: probes,
            sourceFixtureId: envelope?["sourceFixtureId"] as? String,
            generatorVersion: envelope?["generatorVersion"] as? String
        )
    }

    /// Reconstruct a `Formatters.NameValue` from a probe's raw JSON `input`:
    /// JSON string → `.string`; JSON object → `.object` (id/nameZh/name/label);
    /// JSON null / missing → `.null`.
    static func nameValue(from raw: Any?) -> Formatters.NameValue {
        guard let raw = raw, !(raw is NSNull) else { return .null }
        if let s = raw as? String { return .string(s) }
        if let obj = raw as? [String: Any] {
            func str(_ key: String) -> String? { obj[key] as? String }
            return .object(id: str("id"), nameZh: str("nameZh"), name: str("name"), label: str("label"))
        }
        return .null
    }

    /// Reconstruct a `formatAdjustmentChangeLabel` argument from a probe's raw
    /// JSON `input`: JSON string → the string; JSON null / missing → `nil`.
    static func changeLabelInput(from raw: Any?) -> String? {
        guard let raw = raw, !(raw is NSNull) else { return nil }
        return raw as? String
    }
}

final class FormattersParityTests: XCTestCase {
    // MARK: (A) PARITY against the generated golden

    // (A1) The golden file exists and decodes with its parityGolden envelope.
    func testGoldenDiscoveredAndEnvelope() throws {
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: FormattersGolden.goldenURL.path),
            "missing golden \(FormattersGolden.goldenURL.path)"
        )
        let g = try FormattersGolden.decode()
        XCTAssertEqual(g.sourceFixtureId, FormattersGolden.fixtureId)
        XCTAssertEqual(g.generatorVersion, "v1")
        XCTAssertFalse(g.tables.isEmpty)
    }

    // (A2) Both ported tables match the golden key-by-key + value-by-value
    //      (Chinese labels verbatim) — the core transcription lock — plus counts.
    func testTablesMatchGoldenItemByItem() throws {
        let g = try FormattersGolden.decode()

        guard let goldenTemplate = g.tables["templateNameMap"] else {
            return XCTFail("golden missing table templateNameMap")
        }
        XCTAssertEqual(Formatters.templateNameMap, goldenTemplate, "templateNameMap mismatch")

        guard let goldenChange = g.tables["adjustmentChangeLabels"] else {
            return XCTFail("golden missing table adjustmentChangeLabels")
        }
        XCTAssertEqual(Formatters.adjustmentChangeLabels, goldenChange, "adjustmentChangeLabels mismatch")

        // Generator counts agree with the ported tables …
        XCTAssertEqual(g.counts["tables"], 2)
        XCTAssertEqual(g.counts["templateNameMap"], Formatters.templateNameMap.count)
        XCTAssertEqual(g.counts["adjustmentChangeLabels"], Formatters.adjustmentChangeLabels.count)
        // … and the committed tables carry exactly these entry counts.
        XCTAssertEqual(Formatters.templateNameMap.count, 20)
        XCTAssertEqual(Formatters.adjustmentChangeLabels.count, 7)
    }

    // (A3) Every probe reproduces the golden output — the core branch lock. Each
    //      input is reconstructed from the golden and re-run through the Swift
    //      formatter (with its default fallbackLabel, as the generator does).
    func testProbesMatchGolden() throws {
        let g = try FormattersGolden.decode()

        let programProbes = g.probes["formatProgramTemplateName"] ?? []
        XCTAssertFalse(programProbes.isEmpty, "no formatProgramTemplateName probes")
        for p in programProbes {
            let value = FormattersGolden.nameValue(from: p.inputRaw)
            XCTAssertEqual(
                Formatters.formatProgramTemplateName(value), p.expected,
                "formatProgramTemplateName(\(String(describing: p.inputRaw)))"
            )
        }

        let dayProbes = g.probes["formatDayTemplateName"] ?? []
        XCTAssertFalse(dayProbes.isEmpty, "no formatDayTemplateName probes")
        for p in dayProbes {
            let value = FormattersGolden.nameValue(from: p.inputRaw)
            XCTAssertEqual(
                Formatters.formatDayTemplateName(value), p.expected,
                "formatDayTemplateName(\(String(describing: p.inputRaw)))"
            )
        }

        let changeProbes = g.probes["formatAdjustmentChangeLabel"] ?? []
        XCTAssertFalse(changeProbes.isEmpty, "no formatAdjustmentChangeLabel probes")
        for p in changeProbes {
            let input = FormattersGolden.changeLabelInput(from: p.inputRaw)
            XCTAssertEqual(
                Formatters.formatAdjustmentChangeLabel(input), p.expected,
                "formatAdjustmentChangeLabel(\(String(describing: p.inputRaw)))"
            )
        }
    }

    // MARK: (B) Representative parse assertions

    // formatProgramTemplateName — TEMPLATE_NAME_MAP hits via normalizeDisplayKey
    // (verbatim / space→dash / camelCase / parens-strip).
    func testTemplateNameMapHits() {
        XCTAssertEqual(Formatters.formatProgramTemplateName(.string("push-a")), "推 A")
        XCTAssertEqual(Formatters.formatProgramTemplateName(.string("Push A")), "推 A")
        XCTAssertEqual(Formatters.formatProgramTemplateName(.string("pushA")), "推 A")
        XCTAssertEqual(Formatters.formatProgramTemplateName(.string("Push(高级)")), "推 A")
        XCTAssertEqual(Formatters.formatProgramTemplateName(.string("full-body")), "全身训练")
        XCTAssertEqual(Formatters.formatProgramTemplateName(.string("arms")), "手臂补量")
        XCTAssertEqual(Formatters.formatProgramTemplateName(.string("quick-30")), "30 分钟快练")
        XCTAssertEqual(Formatters.formatProgramTemplateName(.string("crowded-gym")), "人多替代")
    }

    // formatProgramTemplateName — localize path, already-CJK passthrough, and the
    // residual-English-template-word → fallback branch.
    func testLocalizeAndCjk() {
        XCTAssertEqual(Formatters.formatProgramTemplateName(.string("Pull A 计划")), "拉 A 计划")
        XCTAssertEqual(Formatters.formatProgramTemplateName(.string("胸部专项")), "胸部专项")
        // localized still contains an English template word ("Push") → not returned → fallback.
        XCTAssertEqual(Formatters.formatProgramTemplateName(.string("Push 强化")), "未知模板")
    }

    // PA-FIX (S4 \b fidelity): an English template token glued DIRECTLY to a CJK char
    // (no space/dash). JS `\b` is ASCII-word-only and DOES see a boundary between the
    // English token and the CJK char; an unfixed NSRegularExpression (ICU) `\b` treats
    // CJK as a word char and would see NONE — leaking the raw glued string instead of
    // the localized/fallback result. The expected values are the retired legacy outputs.
    func testAsciiWordBoundaryGluedToCjk() {
        // residual-English-word guard fires (boundary before 训) → fallback.
        XCTAssertEqual(Formatters.formatProgramTemplateName(.string("Push训练")), "未知模板")
        // localize END boundary fires (boundary after "body", before 训) → '全身训练' + '训练'.
        XCTAssertEqual(Formatters.formatProgramTemplateName(.string("full body训练")), "全身训练训练")
        // day formatter shares the same chain → residual-word guard → day fallback.
        XCTAssertEqual(Formatters.formatDayTemplateName(.string("legs训练")), "未指定训练日")
    }

    // formatProgramTemplateName — object candidate order id → nameZh → name → label.
    func testObjectCandidates() {
        XCTAssertEqual(Formatters.formatProgramTemplateName(.object(id: "pull-a", name: "whatever")), "拉 A")
        XCTAssertEqual(Formatters.formatProgramTemplateName(.object(id: "custom-xyz", nameZh: "自定义训练")), "自定义训练")
        XCTAssertEqual(Formatters.formatProgramTemplateName(.object(id: "custom-xyz")), "未知模板")
    }

    // Fallbacks: undefined/null/'' → each formatter's default fallback label.
    func testFallbacks() {
        XCTAssertEqual(Formatters.formatProgramTemplateName(.null), "未知模板")
        XCTAssertEqual(Formatters.formatProgramTemplateName(.string("")), "未知模板")
        XCTAssertEqual(Formatters.formatDayTemplateName(.null), "未指定训练日")
        XCTAssertEqual(Formatters.formatDayTemplateName(.string("")), "未指定训练日")
    }

    // formatDayTemplateName delegates to the same chain (distinct default fallback).
    func testDayTemplateName() {
        XCTAssertEqual(Formatters.formatDayTemplateName(.string("legs-a")), "腿 A")
        XCTAssertEqual(Formatters.formatDayTemplateName(.string("Lower A")), "下肢 A")
        XCTAssertEqual(Formatters.formatDayTemplateName(.string("深蹲日")), "深蹲日")
        XCTAssertEqual(Formatters.formatDayTemplateName(.object(name: "full-body")), "全身训练")
    }

    // formatAdjustmentChangeLabel — all 7 labels (raw key, no normalization) +
    // unknown / empty / nil → '计划调整'.
    func testAdjustmentChangeLabels() {
        XCTAssertEqual(Formatters.formatAdjustmentChangeLabel("add_sets"), "增加组数")
        XCTAssertEqual(Formatters.formatAdjustmentChangeLabel("remove_sets"), "减少组数")
        XCTAssertEqual(Formatters.formatAdjustmentChangeLabel("add_new_exercise"), "新增动作")
        XCTAssertEqual(Formatters.formatAdjustmentChangeLabel("swap_exercise"), "替代动作")
        XCTAssertEqual(Formatters.formatAdjustmentChangeLabel("reduce_support"), "减少辅助层")
        XCTAssertEqual(Formatters.formatAdjustmentChangeLabel("increase_support"), "增加辅助层")
        XCTAssertEqual(Formatters.formatAdjustmentChangeLabel("keep"), "保持当前结构")
        XCTAssertEqual(Formatters.formatAdjustmentChangeLabel("totally_unknown"), "计划调整")
        XCTAssertEqual(Formatters.formatAdjustmentChangeLabel(""), "计划调整")
        XCTAssertEqual(Formatters.formatAdjustmentChangeLabel(nil), "计划调整")
    }

    // The optional fallbackLabel argument is honoured (mirrors the legacy web schema optional arg).
    func testCustomFallbackLabel() {
        XCTAssertEqual(Formatters.formatProgramTemplateName(.null, fallbackLabel: "X"), "X")
        XCTAssertEqual(Formatters.formatDayTemplateName(.string(""), fallbackLabel: "Y"), "Y")
    }
}
