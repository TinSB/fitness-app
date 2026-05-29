// iOS-4B4 — adaptive deload decision (subset) unit tests + the deliberate-deload /
// conservative-ordering invariants. Drives buildAdaptiveDeloadDecision directly via
// @testable, plus a few engine-level finalVolumeMultiplier checks.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class TrainingDecisionDeloadParityTests: XCTestCase {

    private func status(sleep: String = "一般", energy: String = "中", soreness: [String] = ["无"]) -> TodayStatus {
        TodayStatus(sleep: sleep, energy: energy, time: "60", soreness: soreness)
    }

    private func adaptiveState(
        painByExercise: [String: Int] = [:],
        performanceDrops: [String] = [],
        issueScores: [String: Int] = [:]
    ) -> JSONValue {
        func intMap(_ m: [String: Int]) -> JSONValue {
            .object(OrderedJSONObject(entries: m.map { .init(key: $0.key, value: .number(.integer(Int64($0.value)))) }))
        }
        return .object(OrderedJSONObject(entries: [
            .init(key: "painByExercise", value: intMap(painByExercise)),
            .init(key: "performanceDrops", value: .array(performanceDrops.map { .string($0) })),
            .init(key: "issueScores", value: intMap(issueScores)),
        ]))
    }

    private func deload(
        _ todayStatus: TodayStatus,
        sessions: [TrainingSession] = [],
        adaptive: JSONValue? = nil
    ) -> DeloadDecision {
        TrainingDecisionDeload.buildAdaptiveDeloadDecision(
            history: sessions,
            todayStatus: todayStatus,
            screening: ScreeningProfile(adaptiveState: adaptive)
        )
    }

    // MARK: - level / volumeMultiplier mapping

    func test_default_status_no_adaptive_is_none() {
        let d = deload(status())
        XCTAssertEqual(d.level, .none)
        XCTAssertFalse(d.triggered)
        XCTAssertEqual(d.volumeMultiplier, 1, accuracy: 1e-9)
        XCTAssertEqual(d.strategy, .none)
    }

    func test_poor_sleep_and_low_energy_is_watch_0_9() {
        // controlled-reload-v1 case: sleep 差 && energy 低 -> +2 -> watch.
        let d = deload(status(sleep: "差", energy: "低"))
        XCTAssertEqual(d.level, .watch)
        XCTAssertTrue(d.triggered)
        XCTAssertEqual(d.volumeMultiplier, 0.9, accuracy: 1e-9)
        XCTAssertEqual(d.strategy, .reduceAccessories)
    }

    func test_single_poor_signal_is_watch() {
        // sleep 差 OR energy 低 (not both) -> +1 -> watch.
        XCTAssertEqual(deload(status(sleep: "差", energy: "中")).level, .watch)
        XCTAssertEqual(deload(status(sleep: "一般", energy: "低")).level, .watch)
    }

    func test_yellow_reduce_volume_0_75() {
        // performanceDrops 2 (+2) + sleep差&energy低 (+2) = 4 -> yellow.
        let d = deload(status(sleep: "差", energy: "低"), adaptive: adaptiveState(performanceDrops: ["a", "b"]))
        XCTAssertEqual(d.level, .yellow)
        XCTAssertEqual(d.volumeMultiplier, 0.75, accuracy: 1e-9)
        XCTAssertEqual(d.strategy, .reduceVolume)
    }

    func test_red_recovery_template_0_6() {
        // perfDrops 2 (+2) + repeatedPain 2 (+2) + sleep差&energy低 (+2) = 6 -> red.
        let d = deload(
            status(sleep: "差", energy: "低"),
            adaptive: adaptiveState(painByExercise: ["x": 2, "y": 3], performanceDrops: ["a", "b"])
        )
        XCTAssertEqual(d.level, .red)
        XCTAssertEqual(d.volumeMultiplier, 0.6, accuracy: 1e-9)
        XCTAssertEqual(d.strategy, .recoveryTemplate)
    }

    // MARK: - individual score contributors

    func test_poorRecoveryCount_from_session_status() {
        // 2 recent sessions with 差/低 status -> poorRecoveryCount 2 -> +1 -> watch.
        let sessions = [
            CoreSliceTestKit.sessionWithStatus(id: "p1", gap: 2, sleep: "差"),
            CoreSliceTestKit.sessionWithStatus(id: "p2", gap: 5, energy: "低"),
        ]
        XCTAssertEqual(deload(status(), sessions: sessions).level, .watch)
        // A single poor-recovery session is NOT enough (>=2 required) -> none.
        XCTAssertEqual(deload(status(), sessions: [CoreSliceTestKit.sessionWithStatus(id: "p1", gap: 2, sleep: "差")]).level, .none)
    }

    func test_repeatedPain_threshold_is_2() {
        XCTAssertEqual(deload(status(), adaptive: adaptiveState(painByExercise: ["x": 1])).level, .none) // <2 ignored
        XCTAssertEqual(deload(status(), adaptive: adaptiveState(painByExercise: ["x": 2])).level, .watch) // ==1 count -> +1
    }

    func test_issueScores_threshold_is_4() {
        XCTAssertEqual(deload(status(), adaptive: adaptiveState(issueScores: ["i": 3])).level, .none) // <4 ignored
        // need >=2 high issues for +1; one is not enough on its own.
        XCTAssertEqual(deload(status(), adaptive: adaptiveState(issueScores: ["i": 4])).level, .none)
        XCTAssertEqual(deload(status(), adaptive: adaptiveState(issueScores: ["i": 4, "j": 5])).level, .watch)
    }

    func test_multi_soreness_adds_point() {
        XCTAssertEqual(deload(status(soreness: ["肩", "膝"])).level, .watch) // >=2 soreness -> +1
    }

    // MARK: - lapse-reset deferral is golden-neutral (restart case)

    func test_restart_longGap_neutral_sessions_is_none_regardless_of_resetFatigue() {
        // The restart-28d-gap fixture shape: long-gap neutral sessions + default status.
        // resetFatigue (deferred) would force none; the score is ALSO 0 here, so the
        // deferral changes nothing. finalVolumeMultiplier comes from the restart phase.
        let sessions = [CoreSliceTestKit.session(id: "r1", gap: 30), CoreSliceTestKit.session(id: "r2", gap: 44)]
        XCTAssertEqual(deload(status(), sessions: sessions).level, .none)
    }

    // MARK: - deliberate deload + conservative ordering (engine level)

    func test_deload_week_is_deliberate_explicitDeload_not_adaptive() throws {
        // deload-week-v1: explicitDeloadAssigned drives sessionIntent=deload-week, but
        // the ADAPTIVE deload does not fire (finalVolumeMultiplier stays 0.9, volumeMode trim).
        let s = buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(gap: 2, explicitDeloadAssigned: true))
        XCTAssertEqual(s.sessionIntent, .deloadWeek)
        XCTAssertEqual(s.finalVolumeMultiplier, 0.9, accuracy: 1e-9)
        XCTAssertEqual(s.volumeMode, .trim)
    }

    func test_severe_is_more_conservative_than_reentry_and_normal() {
        let severe = buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(gap: 2, acutePainReported: true)).finalVolumeMultiplier
        let reentry = buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(gap: 20)).finalVolumeMultiplier
        let normal = buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(gap: 2)).finalVolumeMultiplier
        XCTAssertLessThan(severe, reentry)   // 0.3 < 0.65
        XCTAssertLessThan(reentry, normal)   // 0.65 < 0.9
    }
}
