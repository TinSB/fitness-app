// CompletedTrainingTimelineFilterTests — 记录 (History) search + source filter V1.
//
// Pure filter coverage (no IO, no ambient clock, no Date): text search (native
// exercise name / imported workout type / source label, case-insensitive), the source
// segment (全部 / 原生 / 来自 Apple 健康), filter COMPOSITION, the honest empty
// result, and ORDER PRESERVATION. All inputs are built through the GENUINE
// `CompletedTrainingTimeline.make` so the tests exercise the real merge/order + the
// exercise-name enrichment.

import XCTest
@testable import RedeDomain

final class CompletedTrainingTimelineFilterTests: XCTestCase {

    // MARK: - Fixtures

    private func timeline(
        canonical: [TrainingSession] = [],
        supplemental: [SupplementalNativeCompletion] = [],
        imported: [ImportedWorkoutSample] = []
    ) -> CompletedTrainingTimeline {
        CompletedTrainingTimeline.make(
            canonicalHistory: canonical,
            supplementalNatives: supplemental,
            importedWorkouts: imported
        )
    }

    private func session(id: String, finishedAt: String?, exercises: [String]) -> TrainingSession {
        TrainingSession(
            id: id,
            finishedAt: finishedAt,
            completed: true,
            focusSessionComplete: nil,
            exercises: exercises.map { name in
                ExercisePrescription(
                    id: name, exerciseId: name, name: name,
                    sets: [TrainingSetLog(setIndex: .integer(0), done: true)]
                )
            }
        )
    }

    private func importedWorkout(_ id: String, start: String?, type: String = "running") -> ImportedWorkoutSample {
        ImportedWorkoutSample(id: id, source: "healthkit_import", workoutType: type, startDate: start)
    }

    private func nativeIds(_ timeline: CompletedTrainingTimeline) -> [String] {
        timeline.entries.compactMap { entry -> String? in
            if case .native(let n) = entry { return n.id }
            return nil
        }
    }

    // MARK: - identity (defaults are an order-preserving no-op)

    func test_noFilters_returnsAllRowsUnchanged() {
        let t = timeline(
            canonical: [session(id: "s1", finishedAt: "2026-05-28T10:00:00.000Z", exercises: ["卧推"])],
            imported: [importedWorkout("w1", start: "2026-05-29T10:00:00.000Z")]
        )
        XCTAssertEqual(t.filtered(), t, "default filter is an order-preserving no-op")
    }

    // MARK: - text search

    func test_search_matchesNativeExerciseName_caseInsensitive() {
        let t = timeline(canonical: [
            session(id: "s1", finishedAt: "2026-05-28T10:00:00.000Z", exercises: ["Bench Press", "Squat"]),
            session(id: "s2", finishedAt: "2026-05-27T10:00:00.000Z", exercises: ["Deadlift"]),
        ])
        let out = t.filtered(query: "bench")
        XCTAssertEqual(nativeIds(out), ["s1"])
    }

    func test_search_matchesImportedWorkoutType_caseInsensitive() {
        let t = timeline(
            canonical: [session(id: "s1", finishedAt: "2026-05-28T10:00:00.000Z", exercises: ["卧推"])],
            imported: [importedWorkout("w1", start: "2026-05-29T10:00:00.000Z", type: "running")]
        )
        let out = t.filtered(query: "RUNNING")
        XCTAssertEqual(out.entries.count, 1)
        XCTAssertEqual(out.entries[0].source, .appleHealth)
    }

    func test_search_matchesSourceLabel() {
        let t = timeline(
            canonical: [session(id: "s1", finishedAt: "2026-05-28T10:00:00.000Z", exercises: ["卧推"])],
            imported: [importedWorkout("w1", start: "2026-05-29T10:00:00.000Z")]
        )
        // "Apple" appears only in the imported row's origin label "来自 Apple 健康".
        let apple = t.filtered(query: "apple")
        XCTAssertEqual(apple.entries.count, 1)
        XCTAssertEqual(apple.entries[0].source, .appleHealth)
        // "原生" matches only the native row's origin label.
        let raw = t.filtered(query: "原生")
        XCTAssertEqual(nativeIds(raw), ["s1"])
        XCTAssertEqual(raw.entries.count, 1)
    }

    func test_search_whitespaceOnlyQuery_isNoOp() {
        let t = timeline(canonical: [session(id: "s1", finishedAt: "2026-05-28T10:00:00.000Z", exercises: ["卧推"])])
        XCTAssertEqual(t.filtered(query: "   ").entries.count, 1)
    }

    func test_search_noMatch_isEmpty() {
        let t = timeline(canonical: [session(id: "s1", finishedAt: "2026-05-28T10:00:00.000Z", exercises: ["卧推"])])
        XCTAssertTrue(t.filtered(query: "zzz-nope").entries.isEmpty)
    }

    func test_search_supplementalExerciseName_matches() {
        let t = timeline(supplemental: [
            SupplementalNativeCompletion(
                id: "only-local", occurredAtIso: "2026-05-20T08:00:00.000Z",
                exerciseCount: 1, performedSetCount: 3, exerciseNames: ["引体向上"]
            )
        ])
        XCTAssertEqual(nativeIds(t.filtered(query: "引体")), ["only-local"])
    }

    // MARK: - source segment

    func test_sourceFilter_native_keepsOnlyNative() {
        let t = timeline(
            canonical: [session(id: "s1", finishedAt: "2026-05-28T10:00:00.000Z", exercises: ["卧推"])],
            imported: [importedWorkout("w1", start: "2026-05-29T10:00:00.000Z")]
        )
        let out = t.filtered(source: .native)
        XCTAssertEqual(out.entries.count, 1)
        XCTAssertTrue(out.entries.allSatisfy { $0.source == .native })
    }

    func test_sourceFilter_appleHealth_keepsOnlyImported() {
        let t = timeline(
            canonical: [session(id: "s1", finishedAt: "2026-05-28T10:00:00.000Z", exercises: ["卧推"])],
            imported: [importedWorkout("w1", start: "2026-05-29T10:00:00.000Z")]
        )
        let out = t.filtered(source: .appleHealth)
        XCTAssertEqual(out.entries.count, 1)
        XCTAssertTrue(out.entries.allSatisfy { $0.source == .appleHealth })
    }

    func test_sourceFilter_all_keepsBoth() {
        let t = timeline(
            canonical: [session(id: "s1", finishedAt: "2026-05-28T10:00:00.000Z", exercises: ["卧推"])],
            imported: [importedWorkout("w1", start: "2026-05-29T10:00:00.000Z")]
        )
        XCTAssertEqual(t.filtered(source: .all).entries.count, 2)
    }

    // MARK: - composition (logical AND)

    func test_composition_searchAndSource() {
        let t = timeline(
            canonical: [
                session(id: "bench-recent", finishedAt: "2026-05-29T10:00:00.000Z", exercises: ["Bench"]),
                session(id: "bench-old", finishedAt: "2026-05-01T10:00:00.000Z", exercises: ["Bench"]),
                session(id: "squat-recent", finishedAt: "2026-05-29T11:00:00.000Z", exercises: ["Squat"]),
            ],
            imported: [importedWorkout("run-recent", start: "2026-05-29T09:00:00.000Z")]
        )
        // native AND "bench" → both bench rows survive (squat + the imported run are
        // filtered out), keeping the most-recent-first order.
        let out = t.filtered(query: "bench", source: .native)
        XCTAssertEqual(nativeIds(out), ["bench-recent", "bench-old"])
    }

    func test_composition_emptyWhenFiltersConflict() {
        let t = timeline(
            canonical: [session(id: "s1", finishedAt: "2026-05-29T10:00:00.000Z", exercises: ["Bench"])],
            imported: [importedWorkout("w1", start: "2026-05-29T10:00:00.000Z", type: "running")]
        )
        // "running" only matches the imported row, but the source segment is 原生.
        XCTAssertTrue(t.filtered(query: "running", source: .native).entries.isEmpty)
    }

    // MARK: - order preservation

    func test_orderPreserved_afterFilter() {
        let t = timeline(canonical: [
            session(id: "a", finishedAt: "2026-05-29T10:00:00.000Z", exercises: ["Bench"]),
            session(id: "b", finishedAt: "2026-05-28T10:00:00.000Z", exercises: ["Bench"]),
            session(id: "c", finishedAt: "2026-05-27T10:00:00.000Z", exercises: ["Other"]),
            session(id: "d", finishedAt: "2026-05-26T10:00:00.000Z", exercises: ["Bench"]),
        ])
        // The most-recent-first order (a, b, d) is preserved; c is filtered out.
        XCTAssertEqual(nativeIds(t.filtered(query: "bench")), ["a", "b", "d"])
    }
}
