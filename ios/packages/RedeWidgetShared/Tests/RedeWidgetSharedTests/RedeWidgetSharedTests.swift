// RedeWidgetSharedTests — W-1 Readiness Widget V1.
//
// Exercises the PURE pieces with injected snapshots + an injected clock: the JSON
// codec round-trip + schema validation, and the snapshot → view-state mapping
// (populated, honest placeholder, row cap, freshness footnote). The real
// `AppGroupWidgetSnapshotStore` / `WidgetTimelineReloader` are `#if os(iOS)` so they
// are not built on the macOS host — these tests prove the logic without FileManager
// or WidgetKit, using a fake store.

import XCTest
@testable import RedeWidgetShared

final class RedeWidgetSharedTests: XCTestCase {

    /// Deterministic reference instant — 2023-11-14 (UTC). Never the wall clock.
    private let now = Date(timeIntervalSince1970: 1_700_000_000)

    private func sampleSnapshot(
        generatedAtIso: String = "2023-11-14T10:00:00.000Z",
        rows: [ReadinessWidgetRow] = [
            ReadinessWidgetRow(label: "准备度", value: "中等"),
            ReadinessWidgetRow(label: "今日意图", value: "常规训练"),
            ReadinessWidgetRow(label: "训练阶段", value: "积累"),
            ReadinessWidgetRow(label: "风险", value: "低"),
        ]
    ) -> ReadinessWidgetSnapshot {
        ReadinessWidgetSnapshot(
            generatedAtIso: generatedAtIso,
            headline: "准备度 · 中等",
            advice: "建议：正常推进",
            rows: rows
        )
    }

    func testVersionProbeIsBootstrapConstant() {
        XCTAssertEqual(RedeWidgetSharedVersion.value, "0.0.1-bootstrap")
    }

    func testCodecRoundTrip() throws {
        let snapshot = sampleSnapshot()
        let data = try ReadinessWidgetSnapshotCodec.encode(snapshot)
        let decoded = try ReadinessWidgetSnapshotCodec.decode(data)
        XCTAssertEqual(decoded, snapshot)
        XCTAssertEqual(decoded.schemaVersion, ReadinessWidgetSnapshot.currentSchemaVersion)
    }

    func testDecodeRejectsUnknownSchemaVersion() throws {
        let future = ReadinessWidgetSnapshot(schemaVersion: 99, generatedAtIso: "x", headline: "h", advice: "a", rows: [])
        let data = try ReadinessWidgetSnapshotCodec.encode(future)
        XCTAssertThrowsError(try ReadinessWidgetSnapshotCodec.decode(data)) { error in
            XCTAssertEqual(error as? ReadinessWidgetSnapshotError, .unsupportedSchemaVersion(99))
        }
    }

    func testViewStatePopulated() {
        let vs = ReadinessWidgetPresentation.viewState(from: sampleSnapshot(), now: now)
        XCTAssertFalse(vs.isPlaceholder)
        XCTAssertEqual(vs.headline, "准备度 · 中等")
        XCTAssertEqual(vs.advice, "建议：正常推进")
    }

    func testViewStatePlaceholderWhenNil() {
        let vs = ReadinessWidgetPresentation.viewState(from: nil, now: now)
        XCTAssertTrue(vs.isPlaceholder)
        XCTAssertEqual(vs.advice, "暂无今日概览")
        XCTAssertTrue(vs.rows.isEmpty)
        XCTAssertTrue(vs.footnote.contains("今日页"))
    }

    func testViewStateCapsRows() {
        let vs = ReadinessWidgetPresentation.viewState(from: sampleSnapshot(), now: now)
        XCTAssertEqual(vs.rows.count, ReadinessWidgetPresentation.maxRows) // 4 rows → capped to 3
    }

    func testFootnoteSameUtcDayIsToday() {
        let vs = ReadinessWidgetPresentation.viewState(
            from: sampleSnapshot(generatedAtIso: "2023-11-14T01:00:00.000Z"), now: now
        )
        XCTAssertEqual(vs.footnote, "今日更新")
    }

    func testFootnoteDifferentDayShowsDate() {
        let vs = ReadinessWidgetPresentation.viewState(
            from: sampleSnapshot(generatedAtIso: "2020-01-02T00:00:00.000Z"), now: now
        )
        XCTAssertEqual(vs.footnote, "更新于 2020-01-02")
    }

    // MARK: 双语（FR-WD1 中英混杂修复）

    func testPlaceholderEnglishViaFallbackLocale() {
        let vs = ReadinessWidgetPresentation.viewState(from: nil, now: now, fallbackLocale: "en")
        XCTAssertTrue(vs.isPlaceholder)
        XCTAssertEqual(vs.headline, "Today's readiness")
        XCTAssertEqual(vs.advice, "No overview yet")
        XCTAssertEqual(vs.footnote, "Open Rede's Today tab")
    }

    func testFootnoteEnglishFromSnapshotLocale() {
        let today = ReadinessWidgetPresentation.viewState(
            from: ReadinessWidgetSnapshot(generatedAtIso: "2023-11-14T01:00:00.000Z",
                headline: "Readiness · Moderate", advice: "Proceed", rows: [], locale: "en"), now: now)
        XCTAssertEqual(today.footnote, "Updated today")
        let dated = ReadinessWidgetPresentation.viewState(
            from: ReadinessWidgetSnapshot(generatedAtIso: "2020-01-02T00:00:00.000Z",
                headline: "x", advice: "y", rows: [], locale: "en"), now: now)
        XCTAssertEqual(dated.footnote, "Updated 2020-01-02")
    }

    func testSnapshotLocaleWinsOverFallback() {
        // 快照自带 locale 优先于系统 fallback（已生成的快照跟它生成时的语言）。
        let vs = ReadinessWidgetPresentation.viewState(
            from: ReadinessWidgetSnapshot(generatedAtIso: "2020-01-02T00:00:00.000Z",
                headline: "x", advice: "y", rows: [], locale: "zh"), now: now, fallbackLocale: "en")
        XCTAssertEqual(vs.footnote, "更新于 2020-01-02")
    }

    func testFakeStoreWriteThenRead() throws {
        let fake = FakeWidgetSnapshotStore()
        XCTAssertNil(fake.read())
        let snapshot = sampleSnapshot()
        try fake.write(snapshot)
        XCTAssertEqual(fake.read(), snapshot)
    }
}

/// Host fake exercising the `WidgetSnapshotStore` seam without FileManager / App Group.
private final class FakeWidgetSnapshotStore: WidgetSnapshotStore, @unchecked Sendable {
    private var stored: ReadinessWidgetSnapshot?
    func read() -> ReadinessWidgetSnapshot? { stored }
    func write(_ snapshot: ReadinessWidgetSnapshot) throws { stored = snapshot }
}
