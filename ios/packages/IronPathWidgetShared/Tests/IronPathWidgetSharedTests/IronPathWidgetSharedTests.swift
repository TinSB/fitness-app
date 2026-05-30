// IronPathWidgetSharedTests — W-1 Readiness Widget V1.
//
// Exercises the PURE pieces with injected snapshots + an injected clock: the JSON
// codec round-trip + schema validation, and the snapshot → view-state mapping
// (populated, honest placeholder, row cap, freshness footnote). The real
// `AppGroupWidgetSnapshotStore` / `WidgetTimelineReloader` are `#if os(iOS)` so they
// are not built on the macOS host — these tests prove the logic without FileManager
// or WidgetKit, using a fake store.

import XCTest
@testable import IronPathWidgetShared

final class IronPathWidgetSharedTests: XCTestCase {

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
        XCTAssertEqual(IronPathWidgetSharedVersion.value, "0.0.1-bootstrap")
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
