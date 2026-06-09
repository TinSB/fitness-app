// FU-1 Focus live read-path tests — branch + wiring tests for `resolveFocusTrainingState`.
//
// Covers, over the GENUINE RedeDataHealth clean view (no IO, no live store — the thin
// app-layer loader supplies the already-cleaned `NextWorkoutAppDataLoadOutcome`):
//   1. missing / unreadable → honest empty / unavailable.
//   2. A real AppData with EMPTY templates → the chain SEEDS DefaultTrainingData.initialTemplates
//      (FU-1 load-seed restoration), the scheduler resolves the default program's today template,
//      and the resulting Focus slice is BYTE-EQUAL to the direct
//      buildCleanAppDataView→(seeded)decode→scheduler→createCleanTrainingDecisionInput→
//      buildTrainingDecisionFromCleanInput pipeline (proving it is the real engine output, not a
//      fabricated one).
//   3. A real AppData with a NON-EMPTY (user) templates slot → the user's OWN template/exercises
//      are used (the seed fires ONLY on empty).
// The injected `now` matches the parity clock so results are deterministic.

import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

final class FocusTrainingReadPathTests: XCTestCase {

    /// The injected instant — the same UTC parity instant the CoreSliceTestKit gaps derive from.
    private func fixedNow() -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(identifier: "UTC")
        return f.date(from: CoreSliceTestKit.deterministicClockIso)!
    }

    /// The same UTC ISO-8601 the resolver derives from `now` (round-trips the parity clock).
    private let nowIso = CoreSliceTestKit.deterministicClockIso

    private func sessionsWithBaseline() -> [TrainingSession] {
        [CoreSliceTestKit.session(id: "sc-late", gap: 2),
         CoreSliceTestKit.session(id: "sc-early", gap: 9)]
    }

    // MARK: - JSON fixtures (a raw document carrying a `templates[]` slot)

    private func exerciseJSON(
        id: String, name: String, muscle: String, kind: String, sets: Int, repMin: Int, repMax: Int
    ) -> JSONValue {
        .object(OrderedJSONObject(entries: [
            .init(key: "id", value: .string(id)),
            .init(key: "name", value: .string(name)),
            .init(key: "muscle", value: .string(muscle)),
            .init(key: "kind", value: .string(kind)),
            .init(key: "sets", value: .number(.integer(Int64(sets)))),
            .init(key: "repMin", value: .number(.integer(Int64(repMin)))),
            .init(key: "repMax", value: .number(.integer(Int64(repMax)))),
        ]))
    }

    private func templateJSON(id: String, name: String, duration: Int, exercises: [JSONValue]) -> JSONValue {
        .object(OrderedJSONObject(entries: [
            .init(key: "id", value: .string(id)),
            .init(key: "name", value: .string(name)),
            .init(key: "focus", value: .string("")),
            .init(key: "duration", value: .number(.integer(Int64(duration)))),
            .init(key: "note", value: .string("")),
            .init(key: "exercises", value: .array(exercises)),
        ]))
    }

    /// Build a clean view from an in-memory AppData. `templates` nil → no slot at all (the
    /// empty-seed case); a present array → the user's templates slot.
    private func cleanView(sessions: [TrainingSession], templates: [JSONValue]?) -> CleanAppDataView {
        var entries: [OrderedJSONObject.Entry] = [
            .init(key: "schemaVersion", value: .number(.integer(Int64(SchemaVersion.current.rawValue)))),
            .init(key: "history", value: .array(sessions.map { $0.encoded() })),
            .init(key: "todayStatus", value: CoreSliceTestKit.todayStatusJSON()),
        ]
        if let templates {
            entries.append(.init(key: "templates", value: .array(templates)))
        }
        let appData = AppData(schemaVersion: .current, root: OrderedJSONObject(entries: entries))
        return buildCleanAppDataView(appData, clock: CoreSliceTestKit.fixedClock)
    }

    /// Mirror of the resolver's private `focusTemplateExercise` projection — an INDEPENDENT copy so
    /// the test verifies the mapping rather than trusting it.
    private func expectedDTO(from exercise: ExerciseTemplate) -> TrainingDecisionTemplateExercise? {
        guard let id = exercise.id, !id.isEmpty else { return nil }
        return TrainingDecisionTemplateExercise(
            id: id,
            name: exercise.name ?? id,
            muscle: exercise.muscle ?? "",
            kind: exercise.kind ?? "",
            sets: exercise.sets?.intValue ?? 0,
            repMin: exercise.repMin?.intValue ?? 0,
            repMax: exercise.repMax?.intValue ?? 0
        )
    }

    // MARK: - missing / unreadable → honest states

    func test_missing_resolvesToEmpty() {
        XCTAssertEqual(resolveFocusTrainingState(.missing, now: fixedNow()), .empty)
    }

    func test_unreadable_resolvesToUnavailable() {
        XCTAssertEqual(resolveFocusTrainingState(.unreadable, now: fixedNow()), .unavailable)
    }

    func test_resolution_isDeterministic() {
        let view = cleanView(sessions: sessionsWithBaseline(), templates: nil)
        let a = resolveFocusTrainingState(.loaded(view), now: fixedNow())
        let b = resolveFocusTrainingState(.loaded(view), now: fixedNow())
        XCTAssertEqual(a, b)
    }

    // MARK: - EMPTY templates → seeded default program, slice == direct pipeline

    func test_loadedWithEmptyTemplates_seedsDefaultProgram_andSliceEqualsDirectPipeline() {
        // A REAL AppData (NOT FocusModePreviewData) with cleaned history but NO templates slot.
        let view = cleanView(sessions: sessionsWithBaseline(), templates: nil)

        guard case .ready(let plan) = resolveFocusTrainingState(.loaded(view), now: fixedNow()) else {
            return XCTFail("expected .ready: empty templates are seeded with the default program")
        }

        // The resolved template is one of the seeded DEFAULT program templates (the seed worked).
        let resolved = DefaultTrainingData.initialTemplates.first { $0.id == plan.templateId }
        XCTAssertNotNil(resolved, "resolved template must be a DefaultTrainingData.initialTemplates entry")
        XCTAssertFalse(plan.templateExercises.isEmpty, "a real today's template has exercises")
        XCTAssertFalse(plan.slice.perExercise.isEmpty, "the engine prescribes per-exercise targets")

        // The exercises are exactly the resolved default template's exercises, projected to the DTO.
        let expectedExercises = (resolved?.exercises ?? []).compactMap(expectedDTO(from:))
        XCTAssertEqual(plan.templateExercises, expectedExercises)

        // The Focus slice is BYTE-EQUAL to the direct engine pipeline over the SAME clean view +
        // the resolved (seeded) template's exercises — i.e. the real engine output, not fabricated.
        let expectedInput = createCleanTrainingDecisionInput(
            cleanView: view,
            metadata: CleanTrainingDecisionInputMetadata(
                nowIso: nowIso,
                trainingMode: nil,            // the fixture carries no settings.trainingMode
                acutePainReported: nil,
                explicitDeloadAssigned: nil,
                templateDurationMin: resolved?.duration?.doubleValue,
                templateExercises: expectedExercises
            )
        )
        let expectedSlice = buildTrainingDecisionFromCleanInput(expectedInput)
        XCTAssertEqual(plan.slice, expectedSlice)

        // perExercise ids line up with the resolved template's exercise ids (rows can join).
        XCTAssertEqual(Set(plan.slice.perExercise.map { $0.exerciseId }), Set(expectedExercises.map { $0.id }))
    }

    // MARK: - NON-EMPTY templates → the user's own templates (seed fires only on empty)

    func test_loadedWithUserTemplates_usesUserTemplatesNotDefault() {
        // A single CUSTOM template whose exercise ids exist in NO default program template.
        let customExercises = [
            exerciseJSON(id: "custom-press", name: "自定义推", muscle: "胸", kind: "compound", sets: 3, repMin: 6, repMax: 10),
            exerciseJSON(id: "custom-curl", name: "自定义弯举", muscle: "手臂", kind: "isolation", sets: 3, repMin: 10, repMax: 15),
        ]
        let view = cleanView(
            sessions: sessionsWithBaseline(),
            templates: [templateJSON(id: "my-day", name: "我的训练日", duration: 55, exercises: customExercises)]
        )

        guard case .ready(let plan) = resolveFocusTrainingState(.loaded(view), now: fixedNow()) else {
            return XCTFail("expected .ready for a document with cleaned history + a user template")
        }

        // The user's OWN template/exercises were used — the default seed did NOT fire.
        XCTAssertEqual(plan.templateId, "my-day")
        XCTAssertEqual(plan.templateExercises.map { $0.id }, ["custom-press", "custom-curl"])
        // Sanity: no default-program exercise id (e.g. the default push day's bench-press) leaked in.
        XCTAssertFalse(plan.templateExercises.contains { $0.id == "bench-press" })
        XCTAssertFalse(plan.slice.perExercise.isEmpty)
        XCTAssertEqual(Set(plan.slice.perExercise.map { $0.exerciseId }), Set(["custom-press", "custom-curl"]))
    }
}
