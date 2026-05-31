// HealthKitWorkoutExportTests — HK-3 workout WRITE-BACK (export) unit tests.
//
// Pure tests: native `IronPathDomain.TrainingSession`s are mapped through the pure
// `HealthKitWorkoutExporter` to `WorkoutExportRequest`s. No HealthKit, no IO — the
// host `swift test` toolchain runs them. They assert the mapping rules
// (completed-only, valid time window, duration derivation, activity type), the
// idempotency anchor (session id → metadata value), and — the HK-3 red line —
// NATIVE-ONLY / no-loop-back (an Apple-Health-imported-tagged session is never
// exportable, and the signature structurally accepts only `[TrainingSession]`).

import XCTest
import IronPathDomain
@testable import IronPathHealthKit

final class HealthKitWorkoutExportTests: XCTestCase {

    private static let startIso = "2026-05-27T06:30:00.000Z"
    private static let endIso = "2026-05-27T07:30:00.000Z"   // +1h → 3600s / 60min

    /// A native completed strength session (the canonical `AppData.history` shape).
    private func nativeSession(
        id: String = "session-1",
        startedAt: String? = startIso,
        finishedAt: String? = endIso,
        durationMin: NumberRepr? = .double(60),
        completed: Bool? = true,
        source: String? = nil
    ) -> TrainingSession {
        let unknown: OrderedJSONObject
        if let source {
            unknown = OrderedJSONObject(entries: [.init(key: "source", value: .string(source))])
        } else {
            unknown = OrderedJSONObject()
        }
        return TrainingSession(
            id: id,
            date: startedAt ?? Self.startIso,
            startedAt: startedAt,
            finishedAt: finishedAt,
            durationMin: durationMin,
            completed: completed,
            _unknown: unknown
        )
    }

    // MARK: - Mapping rules

    func test_exportRequest_mapsCompletedNativeSession() throws {
        let request = try XCTUnwrap(HealthKitWorkoutExporter.exportRequest(from: nativeSession()))
        XCTAssertEqual(request.sessionId, "session-1")
        XCTAssertEqual(request.activityTypeName, "TraditionalStrengthTraining")
        XCTAssertEqual(request.start, HealthKitWorkoutExporter.parseDate(Self.startIso))
        XCTAssertEqual(request.end, HealthKitWorkoutExporter.parseDate(Self.endIso))
        XCTAssertEqual(request.durationSeconds, 3600, accuracy: 0.001)
    }

    func test_exportRequest_derivesEndFromDurationWhenNoFinishedAt() throws {
        let session = nativeSession(finishedAt: nil, durationMin: .double(45))
        let request = try XCTUnwrap(HealthKitWorkoutExporter.exportRequest(from: session))
        let expectedStart = try XCTUnwrap(HealthKitWorkoutExporter.parseDate(Self.startIso))
        XCTAssertEqual(request.start, expectedStart)
        XCTAssertEqual(request.end, expectedStart.addingTimeInterval(45 * 60))
        XCTAssertEqual(request.durationSeconds, 45 * 60, accuracy: 0.001)
    }

    func test_exportActivityTypeName_isTraditionalStrengthTraining() {
        XCTAssertEqual(HealthKitWorkoutExporter.exportActivityTypeName, "TraditionalStrengthTraining")
    }

    // MARK: - Honest filtering (no fabricated workouts)

    func test_exportRequest_skipsNotCompleted() {
        XCTAssertNil(HealthKitWorkoutExporter.exportRequest(from: nativeSession(completed: false)))
        XCTAssertNil(HealthKitWorkoutExporter.exportRequest(from: nativeSession(completed: nil)))
    }

    func test_exportRequest_skipsMissingId() {
        XCTAssertNil(HealthKitWorkoutExporter.exportRequest(from: nativeSession(id: "")))
        XCTAssertNil(HealthKitWorkoutExporter.exportRequest(from: nativeSession(id: "   ")))
    }

    func test_exportRequest_skipsWhenNoUsableTimeWindow() {
        // No finishedAt and no duration → cannot form a window.
        XCTAssertNil(HealthKitWorkoutExporter.exportRequest(
            from: nativeSession(finishedAt: nil, durationMin: nil)))
        // Unparseable start.
        XCTAssertNil(HealthKitWorkoutExporter.exportRequest(
            from: nativeSession(startedAt: "not-a-date", finishedAt: nil, durationMin: .double(60))))
    }

    func test_exportRequest_skipsWhenEndBeforeStart() {
        let session = nativeSession(startedAt: Self.endIso, finishedAt: Self.startIso, durationMin: nil)
        XCTAssertNil(HealthKitWorkoutExporter.exportRequest(from: session))
    }

    // MARK: - HK-3 red line: native-only / no-loop-back

    func test_exportRequest_skipsHealthKitImportTagged() {
        // Defensive: a (hypothetical) history entry tagged as a HealthKit import is
        // NEVER exported back to Apple Health, even though it is otherwise valid.
        let tagged = nativeSession(source: "healthkit_import")
        XCTAssertNil(HealthKitWorkoutExporter.exportRequest(from: tagged))
    }

    func test_exportRequests_filtersMixedHistoryToNativeOnly() {
        let sessions = [
            nativeSession(id: "native-ok"),
            nativeSession(id: "imported", source: "healthkit_import"),  // dropped (no-loop-back)
            nativeSession(id: "in-progress", completed: false),          // dropped (not completed)
            nativeSession(id: "no-window", finishedAt: nil, durationMin: nil), // dropped (no window)
        ]
        let requests = HealthKitWorkoutExporter.exportRequests(forNativeHistory: sessions)
        XCTAssertEqual(requests.map(\.sessionId), ["native-ok"])
    }

    // MARK: - Idempotency anchor

    func test_idempotencyAnchor_metadataKeyAndSessionIdValue() throws {
        // The metadata key is the stable, app-namespaced idempotency anchor.
        XCTAssertEqual(HealthKitWorkoutExporter.metadataSessionIDKey, "com.ironpath.sessionID")
        // The request carries the session id verbatim — that exact value is written
        // into the HKWorkout metadata and queried back to skip duplicates.
        let request = try XCTUnwrap(HealthKitWorkoutExporter.exportRequest(from: nativeSession(id: "abc-123")))
        XCTAssertEqual(request.sessionId, "abc-123")
    }
}
