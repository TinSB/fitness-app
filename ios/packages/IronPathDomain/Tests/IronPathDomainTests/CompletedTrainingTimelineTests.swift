// CompletedTrainingTimelineTests — History real-AppData read path V1.
//
// Pure builder coverage (no IO, no clock): the unified merge of native completed
// sessions + snapshot-only supplemental natives + Apple-Health imports, the
// dedup-by-id (canonical wins), the completed-only native filter, and the stable
// most-recent-first ordering. All inputs are built in memory from the public
// Domain inits.

import XCTest
@testable import IronPathDomain

final class CompletedTrainingTimelineTests: XCTestCase {

    // MARK: - Helpers

    private func nativeSession(
        id: String?,
        finishedAt: String?,
        completed: Bool? = true,
        focusComplete: Bool? = nil,
        exercises: [ExercisePrescription]? = nil
    ) -> TrainingSession {
        TrainingSession(
            id: id,
            finishedAt: finishedAt,
            completed: completed,
            focusSessionComplete: focusComplete,
            exercises: exercises
        )
    }

    private func exercise(_ id: String, sets: Int) -> ExercisePrescription {
        ExercisePrescription(
            id: id, exerciseId: id, name: id,
            sets: (0..<sets).map { TrainingSetLog(setIndex: .integer(Int64($0)), done: true) }
        )
    }

    private func imported(_ id: String, start: String?) -> ImportedWorkoutSample {
        ImportedWorkoutSample(id: id, source: "healthkit_import", workoutType: "running", startDate: start)
    }

    private func supplemental(_ id: String?, at iso: String?, exercises: Int = 1, sets: Int = 3) -> SupplementalNativeCompletion {
        SupplementalNativeCompletion(id: id, occurredAtIso: iso, exerciseCount: exercises, performedSetCount: sets)
    }

    // MARK: - empty

    func test_allEmpty_isEmptyTimeline() {
        let timeline = CompletedTrainingTimeline.make(
            canonicalHistory: [], supplementalNatives: [], importedWorkouts: []
        )
        XCTAssertTrue(timeline.isEmpty)
        XCTAssertEqual(timeline.entries.count, 0)
    }

    // MARK: - native canonical only

    func test_nativeCanonical_listsCompletedWithCounts() {
        let session = nativeSession(
            id: "s1", finishedAt: "2026-05-27T10:00:00.000Z",
            exercises: [exercise("bench", sets: 3), exercise("squat", sets: 2)]
        )
        let timeline = CompletedTrainingTimeline.make(
            canonicalHistory: [session], supplementalNatives: [], importedWorkouts: []
        )
        XCTAssertEqual(timeline.entries.count, 1)
        guard case .native(let native) = timeline.entries[0] else { return XCTFail("expected native") }
        XCTAssertEqual(native.id, "s1")
        XCTAssertEqual(native.occurredAtIso, "2026-05-27T10:00:00.000Z")
        XCTAssertEqual(native.exerciseCount, 2)
        XCTAssertEqual(native.performedSetCount, 5)
        XCTAssertEqual(timeline.entries[0].source, .native)
    }

    func test_nonCompletedNativeSession_excluded() {
        let inProgress = nativeSession(id: "s1", finishedAt: nil, completed: false, focusComplete: false)
        let done = nativeSession(id: "s2", finishedAt: "2026-05-27T10:00:00.000Z", completed: false, focusComplete: true)
        let timeline = CompletedTrainingTimeline.make(
            canonicalHistory: [inProgress, done], supplementalNatives: [], importedWorkouts: []
        )
        // Only the focus-complete session is listed (in-progress is excluded).
        XCTAssertEqual(timeline.entries.count, 1)
        guard case .native(let native) = timeline.entries[0] else { return XCTFail("expected native") }
        XCTAssertEqual(native.id, "s2")
    }

    // MARK: - imports

    func test_imports_listedAndTagged() {
        let timeline = CompletedTrainingTimeline.make(
            canonicalHistory: [],
            supplementalNatives: [],
            importedWorkouts: [imported("w1", start: "2026-05-25T07:00:00.000Z")]
        )
        XCTAssertEqual(timeline.entries.count, 1)
        guard case .imported(let workout) = timeline.entries[0] else { return XCTFail("expected imported") }
        XCTAssertEqual(workout.id, "w1")
        XCTAssertEqual(timeline.entries[0].source, .appleHealth)
        XCTAssertEqual(timeline.entries[0].occurredAtIso, "2026-05-25T07:00:00.000Z")
    }

    // MARK: - dedup by id (canonical wins)

    func test_supplementalMatchingCanonicalId_isDeduped_canonicalWins() {
        // Canonical s1 carries 2 exercises / 5 sets; the snapshot-only copy of s1
        // claims different counts — the canonical record must be the one shown, once.
        let canonical = nativeSession(
            id: "s1", finishedAt: "2026-05-27T10:00:00.000Z",
            exercises: [exercise("bench", sets: 3), exercise("squat", sets: 2)]
        )
        let timeline = CompletedTrainingTimeline.make(
            canonicalHistory: [canonical],
            supplementalNatives: [supplemental("s1", at: "2026-05-27T10:00:00.000Z", exercises: 9, sets: 99)],
            importedWorkouts: []
        )
        XCTAssertEqual(timeline.entries.count, 1, "the same id must appear once")
        guard case .native(let native) = timeline.entries[0] else { return XCTFail("expected native") }
        XCTAssertEqual(native.exerciseCount, 2, "canonical counts win, not the supplemental's")
        XCTAssertEqual(native.performedSetCount, 5)
    }

    func test_supplementalWithoutCanonicalCounterpart_isKept() {
        // A snapshot-only completion (e.g. no per-set detail → skipped canonical)
        // must NOT be lost from the unified timeline.
        let canonical = nativeSession(id: "s1", finishedAt: "2026-05-27T10:00:00.000Z", exercises: [exercise("bench", sets: 3)])
        let timeline = CompletedTrainingTimeline.make(
            canonicalHistory: [canonical],
            supplementalNatives: [supplemental("only-local", at: "2026-05-26T08:00:00.000Z", exercises: 2, sets: 4)],
            importedWorkouts: []
        )
        XCTAssertEqual(timeline.entries.count, 2)
        let ids = timeline.entries.compactMap { entry -> String? in
            if case .native(let native) = entry { return native.id }
            return nil
        }
        XCTAssertEqual(Set(ids), ["s1", "only-local"])
    }

    func test_supplementalWithNilId_cannotCollide_isKept() {
        let canonical = nativeSession(id: "s1", finishedAt: "2026-05-27T10:00:00.000Z", exercises: [exercise("bench", sets: 1)])
        let timeline = CompletedTrainingTimeline.make(
            canonicalHistory: [canonical],
            supplementalNatives: [supplemental(nil, at: "2026-05-20T08:00:00.000Z")],
            importedWorkouts: []
        )
        XCTAssertEqual(timeline.entries.count, 2)
    }

    // MARK: - unified ordering (most recent first, stable, nil last)

    func test_unifiedOrdering_mostRecentFirst_acrossSources() {
        let timeline = CompletedTrainingTimeline.make(
            canonicalHistory: [
                nativeSession(id: "native-old", finishedAt: "2026-05-10T10:00:00.000Z", exercises: [exercise("a", sets: 1)]),
                nativeSession(id: "native-new", finishedAt: "2026-05-28T10:00:00.000Z", exercises: [exercise("b", sets: 1)]),
            ],
            supplementalNatives: [supplemental("supp-mid", at: "2026-05-20T10:00:00.000Z")],
            importedWorkouts: [imported("imp-newest", start: "2026-05-30T10:00:00.000Z")]
        )
        let orderedIds: [String] = timeline.entries.map { entry in
            switch entry {
            case .native(let native): return native.id ?? "?"
            case .imported(let workout): return workout.id ?? "?"
            }
        }
        XCTAssertEqual(orderedIds, ["imp-newest", "native-new", "supp-mid", "native-old"])
    }

    func test_nilTimestamps_sortLast_stably() {
        let timeline = CompletedTrainingTimeline.make(
            canonicalHistory: [
                nativeSession(id: "has-time", finishedAt: "2026-05-28T10:00:00.000Z", exercises: [exercise("a", sets: 1)]),
                nativeSession(id: "no-time-1", finishedAt: nil, exercises: [exercise("b", sets: 1)]),
                nativeSession(id: "no-time-2", finishedAt: nil, exercises: [exercise("c", sets: 1)]),
            ],
            supplementalNatives: [], importedWorkouts: []
        )
        let orderedIds: [String] = timeline.entries.compactMap {
            if case .native(let native) = $0 { return native.id }
            return nil
        }
        // dated row first; the two undated rows keep their input order (stable).
        XCTAssertEqual(orderedIds, ["has-time", "no-time-1", "no-time-2"])
    }

    // MARK: - determinism

    func test_make_isDeterministic() {
        let history = [nativeSession(id: "s1", finishedAt: "2026-05-27T10:00:00.000Z", exercises: [exercise("a", sets: 2)])]
        let imports = [imported("w1", start: "2026-05-25T07:00:00.000Z")]
        let first = CompletedTrainingTimeline.make(canonicalHistory: history, supplementalNatives: [], importedWorkouts: imports)
        let second = CompletedTrainingTimeline.make(canonicalHistory: history, supplementalNatives: [], importedWorkouts: imports)
        XCTAssertEqual(first, second)
    }
}
